import type { GameClock } from '../../game/engine/GameClock';
import { P0TenPunchSession } from '../session/P0TenPunchSession';

class ManualClock implements GameClock {
  constructor(private valueMs = 0) {}
  nowMs(): number { return this.valueMs; }
  set(valueMs: number): void { this.valueMs = valueMs; }
}

const MOTION_SOURCE_IDS = {
  LEAD_JAB_HEAD: '144_13',
  REAR_STRAIGHT_HEAD: '144_20',
  LEAD_HOOK_HEAD: '14_01',
} as const;

describe('advanced-mode session integration', () => {
  it('records the explicit technique and judges it without changing the timing router', () => {
    const clock = new ManualClock();
    const session = new P0TenPunchSession(clock, MOTION_SOURCE_IDS, {
      seed: 123,
      ruleset: 'candidate',
      controlMode: 'ADVANCED',
    });
    session.start();
    session.tick();
    expect(session.snapshot().flattenedAttackOrder[0]).toBe('LEAD_JAB_HEAD');

    clock.set(200);
    expect(session.handleInput('SLIP_LEFT')).toEqual(expect.objectContaining({
      status: 'VALID',
      input: 'SLIP_LEFT',
    }));
    clock.set(480);
    session.tick();

    expect(session.snapshot().results[0]).toEqual(expect.objectContaining({
      outcome: 'PERFECT',
      telemetry: expect.objectContaining({ inputButton: 'SLIP_LEFT' }),
    }));
  });
});
