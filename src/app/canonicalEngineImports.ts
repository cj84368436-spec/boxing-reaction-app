import { P0_ATTACKS } from '../game/config/p0Attacks.js';
import { P0_SEQUENCE, countPunches } from '../game/config/p0Sequence.js';
import { P0_TIMING } from '../game/config/p0Timing.js';
import { PerformanceGameClock, type GameClock } from '../game/engine/GameClock.js';

export type { GameClock };

export function createCanonicalGameClock(): GameClock {
  return new PerformanceGameClock();
}

export function getCanonicalEngineSummary() {
  return {
    attackIds: Object.keys(P0_ATTACKS),
    comboCount: P0_SEQUENCE.length,
    punchCount: countPunches(P0_SEQUENCE),
    preCueBufferMs: P0_TIMING.preCueBufferMs,
  } as const;
}
