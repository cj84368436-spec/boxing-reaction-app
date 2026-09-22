import type { AdvancedDefenseInput, DefenseOutcome } from '../../game/model/types';
import { resolveAdvancedDefense } from '../session/advancedDefense';

const expected: Record<string, Record<AdvancedDefenseInput, DefenseOutcome>> = {
  LEAD_JAB_HEAD: {
    SLIP_LEFT: 'PERFECT', SLIP_RIGHT: 'PERFECT', WEAVE_LEFT: 'HIT',
    WEAVE_RIGHT: 'HIT', SWAY: 'SAFE', GUARD: 'SAFE',
  },
  REAR_STRAIGHT_HEAD: {
    SLIP_LEFT: 'PERFECT', SLIP_RIGHT: 'HIT', WEAVE_LEFT: 'HIT',
    WEAVE_RIGHT: 'HIT', SWAY: 'HIT', GUARD: 'SAFE',
  },
  LEAD_HOOK_HEAD: {
    SLIP_LEFT: 'HIT', SLIP_RIGHT: 'HIT', WEAVE_LEFT: 'HIT',
    WEAVE_RIGHT: 'PERFECT', SWAY: 'SAFE', GUARD: 'SAFE',
  },
};

describe('advanced defense matrix', () => {
  it.each(Object.entries(expected))('%s keeps every technique decision explicit', (attackId, matrix) => {
    for (const [input, outcome] of Object.entries(matrix)) {
      expect(resolveAdvancedDefense(attackId, input as AdvancedDefenseInput)).toBe(outcome);
    }
  });
});
