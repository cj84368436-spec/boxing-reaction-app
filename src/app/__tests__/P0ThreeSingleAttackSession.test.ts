import type { GameClock } from '../../game/engine/GameClock';
import { P0ThreeSingleAttackSession } from '../session/P0ThreeSingleAttackSession';

class ManualClock implements GameClock {
  constructor(private valueMs = 0) {}

  nowMs(): number {
    return this.valueMs;
  }

  set(valueMs: number): void {
    this.valueMs = valueMs;
  }
}

const MOTION_SOURCE_IDS = {
  LEAD_JAB_HEAD: '144_13',
  REAR_STRAIGHT_HEAD: '144_20',
  LEAD_HOOK_HEAD: '14_01',
} as const;

function runningSession() {
  const clock = new ManualClock(0);
  const session = new P0ThreeSingleAttackSession(clock, MOTION_SOURCE_IDS);
  session.start({ leadInMs: 0 });
  session.tick();
  return { clock, session };
}

describe('P0ThreeSingleAttackSession', () => {
  it('derives the first three attack starts from canonical sequence timing', () => {
    const { session } = runningSession();

    expect(session.snapshot().scheduledAttacks).toEqual([
      expect.objectContaining({
        comboId: 'single-jab',
        attackId: 'LEAD_JAB_HEAD',
        attackStartScheduledAtMs: 0,
      }),
      expect.objectContaining({
        comboId: 'single-straight',
        attackId: 'REAR_STRAIGHT_HEAD',
        attackStartScheduledAtMs: 1180,
      }),
      expect.objectContaining({
        comboId: 'single-hook',
        attackId: 'LEAD_HOOK_HEAD',
        attackStartScheduledAtMs: 2420,
      }),
    ]);
    expect(session.snapshot().currentAttack).toEqual(
      expect.objectContaining({
        attackId: 'LEAD_JAB_HEAD',
        cueAtMs: 120,
        responseStartAtMs: 120,
        responseEndAtMs: 450,
        impactAtMs: 480,
      }),
    );
  });

  it('continues after HIT and resolves all three attacks in canonical order', () => {
    const { clock, session } = runningSession();

    clock.set(480);
    session.tick();
    expect(session.snapshot()).toEqual(
      expect.objectContaining({
        currentComboIndex: 1,
        sessionCompleted: false,
        results: [expect.objectContaining({ attackId: 'LEAD_JAB_HEAD', outcome: 'HIT' })],
      }),
    );

    clock.set(1330);
    session.tick();
    session.handleInput('LEFT');
    clock.set(1720);
    session.tick();
    expect(session.snapshot().results[1]).toEqual(
      expect.objectContaining({ attackId: 'REAR_STRAIGHT_HEAD', outcome: 'PERFECT' }),
    );

    clock.set(2610);
    session.tick();
    session.handleInput('GUARD');
    clock.set(3040);
    session.tick();

    expect(session.snapshot()).toEqual(
      expect.objectContaining({
        currentComboIndex: 2,
        sessionCompleted: true,
        results: [
          expect.objectContaining({ outcome: 'HIT' }),
          expect.objectContaining({ outcome: 'PERFECT' }),
          expect.objectContaining({ outcome: 'SAFE' }),
        ],
      }),
    );
  });

  it('uses the same GameClock and catches up every missed attack without shifting canonical schedule', () => {
    const { clock, session } = runningSession();

    clock.set(3040);
    session.tick();

    expect(session.snapshot().sessionCompleted).toBe(true);
    expect(session.snapshot().results.map((result) => result.telemetry.impactScheduledAtMs)).toEqual([
      480,
      1720,
      3040,
    ]);
    expect(session.snapshot().results.map((result) => result.outcome)).toEqual(['HIT', 'HIT', 'HIT']);
  });

  it('routes input only to the current unresolved attack instance', () => {
    const { clock, session } = runningSession();

    clock.set(200);
    expect(session.handleInput('RIGHT')).toEqual(
      expect.objectContaining({ targetAttackInstanceId: 'run-1:combo-0:attack-0' }),
    );
    clock.set(480);
    session.tick();

    clock.set(1330);
    session.tick();
    expect(session.handleInput('LEFT')).toEqual(
      expect.objectContaining({ targetAttackInstanceId: 'run-1:combo-1:attack-0' }),
    );
  });

  it('retry creates a fresh run and clears all prior results and inputs', () => {
    const { clock, session } = runningSession();
    clock.set(3040);
    session.tick();
    const firstRunIds = session.snapshot().scheduledAttacks.map((attack) => attack.attackInstanceId);

    clock.set(4000);
    session.retry({ leadInMs: 0 });
    session.tick();
    const retried = session.snapshot();

    expect(retried.runId).toBe('run-2');
    expect(retried.results).toEqual([]);
    expect(retried.sessionCompleted).toBe(false);
    expect(retried.currentAttack.inputStatus).toBeUndefined();
    expect(retried.scheduledAttacks.map((attack) => attack.attackInstanceId)).not.toEqual(firstRunIds);
    expect(retried.currentAttack.attackInstanceId).toBe('run-2:combo-0:attack-0');
  });
});
