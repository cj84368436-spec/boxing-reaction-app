import { projectFrontPose, fitProjectedPose } from '../motion/projectFrontPose';
import { sampleLeadJabReadyPose } from '../motion/leadJabReadyPose';
import { getP0MotionAsset, getP0MotionSourceIds } from '../motion/p0MotionRegistry';
import { P0TenPunchSession } from '../session/P0TenPunchSession';
import * as presentation from '../motion/firstPersonPresentation';

describe('fixed spectator camera', () => {
  it('does not move an unchanged hand when the shoulders turn', () => {
    const ready = sampleLeadJabReadyPose().joints;
    const turned = { ...ready, lShoulder: ready.rShoulder, rShoulder: ready.lShoulder };
    const baseline = projectFrontPose(ready, ready);
    const actual = projectFrontPose(turned, ready);
    expect(actual.lHand.x).toBeCloseTo(baseline.lHand.x, 8);
    expect(actual.lHand.y).toBeCloseTo(baseline.lHand.y, 8);
    expect(actual.lHand.depth).toBeCloseTo(baseline.lHand.depth, 8);
  });

  it('does not rescale the stationary head when a hand leaves the ready bounds', () => {
    const ready = projectFrontPose(sampleLeadJabReadyPose().joints);
    const extended = { ...ready, lHand: { ...ready.lHand, x: ready.lHand.x + 30 } };
    const baseline = fitProjectedPose(ready, 300, 430, 24, ready);
    const actual = fitProjectedPose(extended, 300, 430, 24, ready);
    expect(actual.head.x).toBeCloseTo(baseline.head.x, 8);
    expect(actual.head.y).toBeCloseTo(baseline.head.y, 8);
    expect(actual.lHand.x).toBeGreaterThan(300);
  });
});

describe('first-person attack and defense presentation', () => {
  const assets = Object.fromEntries(Object.keys(getP0MotionSourceIds()).map(id => [id, getP0MotionAsset(id)]));
  function setup() {
    const clock = { value: 0, nowMs() { return this.value; } };
    const session = new P0TenPunchSession(clock, getP0MotionSourceIds(), { seed: 123 });
    session.start();
    return { clock, session, times: new Map<string, number>() };
  }
  it.each([['LEAD_JAB_HEAD', 480, 'lHand'], ['REAR_STRAIGHT_HEAD', 540, 'rHand'], ['LEAD_HOOK_HEAD', 620, 'lHand']] as const)(
    '%s reaches the fixed face target at its canonical impact', (id, ms, hand) => {
      const asset = assets[id]!;
      const before = JSON.stringify(asset);
      const pose = presentation.projectCombatPose(asset, ms);
      expect(pose[hand].x).toBeCloseTo(140, 6);
      expect(pose[hand].y).toBeCloseTo(165, 6);
      expect(JSON.stringify(asset)).toBe(before);
    });
  it('keeps the landed punch visible through impact instead of switching to the next Ready', () => {
    const { clock, session, times } = setup();
    clock.value = 480;
    const snapshot = session.tick();
    expect(snapshot.results).toHaveLength(1);
    const frame = presentation.getFirstPersonFrame(snapshot, assets, times);
    expect(frame.attackId).toBe('LEAD_JAB_HEAD');
    expect(frame.pose.lHand.x).toBeCloseTo(140);
    expect(frame.hit).toBe(true);
    clock.value = 600;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).elapsedMs).toBe(600);
  });
  it('only moves for accepted input and holds the slip through impact', () => {
    const { clock, session, times } = setup();
    clock.value = 200;
    const receipt = session.handleInput('RIGHT');
    if (receipt.status === 'VALID') times.set(receipt.targetAttackInstanceId, receipt.atMs);
    clock.value = 300;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).cameraX).toBeLessThan(-40);
    clock.value = 480;
    const frame = presentation.getFirstPersonFrame(session.tick(), assets, times);
    expect(frame.cameraX).toBeLessThan(-40);
    expect(frame.hit).toBe(false);
    expect(frame.feedback).toBe('완벽 회피');
  });
  it('never animates a successful dodge after a committed early attempt', () => {
    const { clock, session, times } = setup();
    clock.value = 30; session.handleInput('RIGHT');
    clock.value = 200; session.handleInput('RIGHT');
    clock.value = 480;
    const frame = presentation.getFirstPersonFrame(session.tick(), assets, times);
    expect(frame.cameraX).toBe(0);
    expect(frame.hit).toBe(true);
    expect(frame.feedback).toBe('피격 · 너무 빠름');
  });
  it('shows the bent hook arm at impact instead of after resolution', () => {
    const asset = assets.LEAD_HOOK_HEAD!;
    const before = JSON.stringify(asset);
    const pose = presentation.projectCombatPose(asset, 620);
    expect(pose.lElbow.y - pose.lShoulder.y).toBeLessThan(40);
    expect(pose.lHand.x).toBeCloseTo(140);
    expect(pose.lHand.y).toBeCloseTo(165);
    expect(JSON.stringify(asset)).toBe(before);
  });
  it('renders guard in the same impact space', () => {
    const { clock, session, times } = setup();
    clock.value = 200;
    const receipt = session.handleInput('GUARD');
    if (receipt.status === 'VALID') times.set(receipt.targetAttackInstanceId, receipt.atMs);
    clock.value = 300;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).guard).toBe(1);
    clock.value = 480;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).feedback).toBe('안전 방어 · 가드');
  });
  it('does not show a successful dodge after simultaneous conflicting inputs', () => {
    const { clock, session, times } = setup();
    clock.value = 200;
    const receipt = session.handleInput('RIGHT');
    if (receipt.status === 'VALID') times.set(receipt.targetAttackInstanceId, receipt.atMs);
    clock.value = 220;
    session.handleInput('LEFT');
    clock.value = 300;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).cameraX).toBe(0);
    clock.value = 480;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).feedback).toBe('피격 · 하나씩 입력');
  });
  it('blends toward the next ready pose even when combo spacing truncates recovery', () => {
    const { clock, session, times } = setup();
    const schedule = session.snapshot().scheduledAttacks;
    const next = schedule.find(a => a.comboAttackIndex === 1)!;
    clock.value = next.attackStartScheduledAtMs! - 1;
    const before = presentation.getFirstPersonFrame(session.tick(), assets, times);
    clock.value += 1;
    const after = presentation.getFirstPersonFrame(session.tick(), assets, times);
    expect(Math.hypot(before.pose.head.x - after.pose.head.x, before.pose.head.y - after.pose.head.y)).toBeLessThan(2);
  });
  it('weaves under a hook and returns to neutral without carrying input to the next attack', () => {
    const { clock, session, times } = setup();
    const hook = session.snapshot().scheduledAttacks.find(a => a.attackId === 'LEAD_HOOK_HEAD')!;
    clock.value = hook.attackStartScheduledAtMs! + 250;
    session.tick();
    const receipt = session.handleInput('RIGHT');
    if (receipt.status === 'VALID') times.set(receipt.targetAttackInstanceId, receipt.atMs);
    clock.value += 100;
    expect(presentation.getFirstPersonFrame(session.tick(), assets, times).cameraY).toBeLessThan(-50);
    clock.value = hook.attackStartScheduledAtMs! + 900;
    const recovered = presentation.getFirstPersonFrame(session.tick(), assets, times);
    expect(recovered.cameraX).toBe(0);
    expect(recovered.cameraY).toBe(0);
  });
});
