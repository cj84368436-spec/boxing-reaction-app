import type { ComboDefinition } from '../model/types.js';
import { P0_ATTACKS } from './p0Attacks.js';

const { LEAD_JAB_HEAD: JAB, REAR_STRAIGHT_HEAD: STRAIGHT, LEAD_HOOK_HEAD: HOOK } = P0_ATTACKS;

export const P0_SEQUENCE: readonly ComboDefinition[] = [
  { comboId: 'single-jab', attacks: [JAB], attackStartOffsetsMs: [0], recoveryAfterMs: 700 },
  { comboId: 'single-straight', attacks: [STRAIGHT], attackStartOffsetsMs: [0], recoveryAfterMs: 700 },
  { comboId: 'single-hook', attacks: [HOOK], attackStartOffsetsMs: [0], recoveryAfterMs: 850 },
  {
    comboId: 'double-jab-straight',
    attacks: [JAB, STRAIGHT],
    attackStartOffsetsMs: [0, 650],
    recoveryAfterMs: 900
  },
  {
    comboId: 'double-jab-hook',
    attacks: [JAB, HOOK],
    attackStartOffsetsMs: [0, 650],
    recoveryAfterMs: 900
  },
  {
    comboId: 'triple-jab-straight-hook',
    attacks: [JAB, STRAIGHT, HOOK],
    attackStartOffsetsMs: [0, 650, 1300],
    recoveryAfterMs: 1000
  }
] as const;

export function countPunches(sequence: readonly ComboDefinition[]): number {
  return sequence.reduce((total, combo) => total + combo.attacks.length, 0);
}
