import { P0_SEQUENCE } from '../../game/config/p0Sequence';
import type { GameClock } from '../../game/engine/GameClock';
import { createSeededComboOrder } from '../session/seededComboOrder';
import { P0TenPunchSession } from '../session/P0TenPunchSession';

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

describe('seeded ten-punch playtest session', () => {
  it('reproduces the same combo and flattened attack order from the same seed', () => {
    const first = createSeededComboOrder(P0_SEQUENCE, 123);
    const second = createSeededComboOrder(P0_SEQUENCE, 123);

    expect(first.map((combo) => combo.comboId)).toEqual([
      'triple-jab-straight-hook',
      'double-jab-hook',
      'double-jab-straight',
      'single-jab',
      'single-hook',
      'single-straight',
    ]);
    expect(second).toEqual(first);
    expect(first.flatMap((combo) => combo.attacks.map((attack) => attack.attackId))).toEqual([
      'LEAD_JAB_HEAD',
      'REAR_STRAIGHT_HEAD',
      'LEAD_HOOK_HEAD',
      'LEAD_JAB_HEAD',
      'LEAD_HOOK_HEAD',
      'LEAD_JAB_HEAD',
      'REAR_STRAIGHT_HEAD',
      'LEAD_JAB_HEAD',
      'LEAD_HOOK_HEAD',
      'REAR_STRAIGHT_HEAD',
    ]);
  });

  it('can produce another order without changing combo internals or ten-punch invariants', () => {
    const order = createSeededComboOrder(P0_SEQUENCE, 456);

    expect(order.map((combo) => combo.comboId)).toEqual([
      'triple-jab-straight-hook',
      'double-jab-hook',
      'single-straight',
      'single-jab',
      'double-jab-straight',
      'single-hook',
    ]);
    expect(new Set(order.map((combo) => combo.comboId)).size).toBe(6);
    expect(order.flatMap((combo) => combo.attacks)).toHaveLength(10);
    for (const combo of order) {
      const canonical = P0_SEQUENCE.find((candidate) => candidate.comboId === combo.comboId);
      expect(combo.attacks).toEqual(canonical?.attacks);
      expect(combo.attackStartOffsetsMs).toEqual(canonical?.attackStartOffsetsMs);
    }
  });

  it('finalizes exactly one result for every attack after a late-frame catch-up', () => {
    const clock = new ManualClock(0);
    const session = new P0TenPunchSession(clock, MOTION_SOURCE_IDS, { seed: 123 });
    session.start({ leadInMs: 0 });

    clock.set(30_000);
    const snapshot = session.tick();

    expect(snapshot.comboOrderIds).toHaveLength(6);
    expect(snapshot.scheduledAttacks).toHaveLength(10);
    expect(snapshot.results).toHaveLength(10);
    expect(new Set(snapshot.results.map((result) => result.attackInstanceId)).size).toBe(10);
    expect(snapshot.results.every((result) => result.telemetry.inputStatus === 'NO_INPUT')).toBe(true);
    expect(snapshot.sessionCompleted).toBe(true);
  });

  it('routes a real press in the next combo attack buffer to only that attack instance', () => {
    const clock = new ManualClock(0);
    const session = new P0TenPunchSession(clock, MOTION_SOURCE_IDS, { seed: 1 });
    session.start({ leadInMs: 0 });

    clock.set(480);
    session.tick();
    clock.set(740);
    const receipt = session.handleInput('RIGHT');

    expect(receipt).toEqual(
      expect.objectContaining({
        status: 'VALID',
        buffered: true,
        targetAttackInstanceId: 'run-1:combo-0:attack-1',
      }),
    );

    clock.set(1_270);
    session.tick();
    expect(session.snapshot().results).toEqual([
      expect.objectContaining({ attackInstanceId: 'run-1:combo-0:attack-0', outcome: 'HIT' }),
      expect.objectContaining({ attackInstanceId: 'run-1:combo-0:attack-1', outcome: 'PERFECT' }),
    ]);
  });

  it('retry clears outcomes and inputs while supporting new-seed and same-seed replay', () => {
    const clock = new ManualClock(0);
    const seeds = [123, 456];
    const session = new P0TenPunchSession(clock, MOTION_SOURCE_IDS, {
      seedFactory: () => seeds.shift() ?? 999,
    });
    session.start({ leadInMs: 0 });
    const firstOrder = session.snapshot().comboOrderIds;
    clock.set(30_000);
    session.tick();

    clock.set(31_000);
    session.retry({ leadInMs: 0 });
    const newSeedRun = session.snapshot();
    expect(newSeedRun.seed).toBe(456);
    expect(newSeedRun.comboOrderIds).not.toEqual(firstOrder);
    expect(newSeedRun.results).toEqual([]);
    expect(newSeedRun.currentAttack.inputStatus).toBeUndefined();
    expect(newSeedRun.sessionCompleted).toBe(false);

    clock.set(60_000);
    session.tick();
    clock.set(61_000);
    session.retry({ leadInMs: 0, seed: 123 });
    const replay = session.snapshot();
    expect(replay.seed).toBe(123);
    expect(replay.comboOrderIds).toEqual(firstOrder);
    expect(replay.results).toEqual([]);
    expect(replay.currentAttack.attackInstanceId).toBe('run-3:combo-0:attack-0');
  });
});
