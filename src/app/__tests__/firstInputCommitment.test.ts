import { P0_ATTACKS } from '../../game/config/p0Attacks';
import { P0AttackAttemptController } from '../session/P0AttackAttemptController';
import { P0TenPunchSession } from '../session/P0TenPunchSession';
const sources = { LEAD_JAB_HEAD: '144_13', REAR_STRAIGHT_HEAD: '144_20', LEAD_HOOK_HEAD: '14_01' };
function setup(leadInMs = 0) {
  let now = 0;
  const clock = { nowMs: () => now };
  const attempt = new P0AttackAttemptController({ attack: P0_ATTACKS.LEAD_JAB_HEAD, attackInstanceId: 'jab', motionSourceId: '144_13', clock, timelineMode: 'ABSOLUTE_SCHEDULE' });
  attempt.start({ leadInMs });
  return { attempt, set: (ms: number) => { now = ms; attempt.tick(); } };
}
describe('one committed attempt per punch', () => {
  it('cannot repair an early press by repeatedly pressing guard in the valid window', () => {
    const { attempt, set } = setup();
    set(50); attempt.handleInput('GUARD');
    for (const ms of [150, 250, 350, 440]) { set(ms); attempt.handleInput('GUARD'); }
    set(480);
    expect(attempt.snapshot().telemetry).toMatchObject({ inputAtMs: 50, inputStatus: 'EARLY', defenseOutcome: 'HIT' });
  });
  it('does not spend an attempt during the preparation countdown', () => {
    const { attempt, set } = setup(1000);
    set(500); attempt.handleInput('GUARD');
    set(1150); expect(attempt.handleInput('LEFT').status).toBe('VALID');
    set(1480); expect(attempt.snapshot().outcome).toBe('PERFECT');
  });
  it('returns the committed receipt and does not change its time or button', () => {
    const { attempt, set } = setup();
    set(150); const first = attempt.handleInput('LEFT');
    set(250); expect(attempt.handleInput('GUARD')).toEqual(first);
    set(480); expect(attempt.snapshot().telemetry).toMatchObject({ inputAtMs: 150, inputButton: 'LEFT', defenseOutcome: 'PERFECT' });
  });
  it('rejects input after a finalized punch instead of replaying its valid receipt', () => {
    const { attempt, set } = setup();
    set(150); attempt.handleInput('LEFT');
    set(480); expect(attempt.handleInput('GUARD').status).toBe('LATE');
    expect(attempt.snapshot().telemetry?.inputButton).toBe('LEFT');
  });
  it('keeps simultaneous two-button rejection sticky even after another press', () => {
    const { attempt, set } = setup();
    set(150); attempt.handleInput('LEFT');
    set(160); expect(attempt.handleInput('RIGHT').status).toBe('MULTI_INPUT');
    set(300); expect(attempt.handleInput('LEFT').status).toBe('MULTI_INPUT');
    set(480); expect(attempt.snapshot().outcome).toBe('HIT');
  });
  it.each(['GUARD', 'BACK', 'RIGHT'] as const)('blind 100 ms %s spam cannot clear a round without damage', input => {
    for (let seed = 0; seed < 20; seed++) {
      let now = 0;
      const session = new P0TenPunchSession({ nowMs: () => now }, sources, { seed });
      session.start({ leadInMs: 2000 });
      for (now = 0; now <= 22000; now += 10) {
        if (session.tick().sessionCompleted) break;
        if (now % 100 === 0) session.handleInput(input);
      }
      expect(session.snapshot().results).toHaveLength(10);
      expect(session.snapshot().results.some(r => r.outcome === 'HIT')).toBe(true);
    }
  });
});
