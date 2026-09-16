import { getCoachMoment } from '../motion/coachPresentation';
import { P0TenPunchSession } from '../session/P0TenPunchSession';
import { P0_ATTACKS } from '../../game/config/p0Attacks';

const sources = { LEAD_JAB_HEAD: '144_13', REAR_STRAIGHT_HEAD: '144_20', LEAD_HOOK_HEAD: '14_01' };
function run() {
  const clock = { value: 0, nowMs() { return this.value; } };
  const session = new P0TenPunchSession(clock, sources, { seed: 123 });
  session.start();
  return { clock, session };
}
test('coach reacts to a hit only between combos, never over an attack or its cue', () => {
  const { clock, session } = run();
  let reactions = 0;
  for (clock.value = 0; clock.value < 16000; clock.value += 10) {
    const snapshot = session.tick();
    const moment = getCoachMoment(snapshot);
    if (!moment) continue;
    reactions++;
    expect(moment.line).toBe('그걸 맞나?');
    expect(snapshot.latestResult?.outcome).toBe('HIT');
    for (const attack of snapshot.scheduledAttacks) {
      const start = attack.attackStartScheduledAtMs!;
      const definition = P0_ATTACKS[attack.attackId as keyof typeof P0_ATTACKS];
      expect(snapshot.nowMs >= start && snapshot.nowMs <= start + definition.impactMs).toBe(false);
    }
  }
  expect(reactions).toBeGreaterThan(0);
});
test('consecutive defences change the coach reaction without treating guards as perfect evasions', () => {
  const { clock, session } = run();
  const schedule = session.snapshot().scheduledAttacks;
  let observed = false;
  for (const attack of schedule) {
    const definition = P0_ATTACKS[attack.attackId as keyof typeof P0_ATTACKS];
    clock.value = attack.attackStartScheduledAtMs! + definition.cueAnchorMs;
    expect(getCoachMoment(session.tick())).toBeNull();
    session.handleInput('GUARD');
    clock.value = attack.attackStartScheduledAtMs! + definition.impactMs + 260;
    const snapshot = session.tick();
    const moment = getCoachMoment(snapshot);
    if (moment) {
      expect(moment).toEqual({ mood: 'interested', line: '……어?' });
      expect(snapshot.results.every(result => result.outcome === 'SAFE')).toBe(true);
      observed = true;
    }
  }
  expect(observed).toBe(true);
});
test('intro and finished rounds leave evaluation to their own cards', () => {
  const { clock, session } = run();
  expect(getCoachMoment(session.snapshot())).toBeNull();
  clock.value = 30000;
  expect(getCoachMoment(session.tick())).toBeNull();
});
