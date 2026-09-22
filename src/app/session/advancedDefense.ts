import type {
  AdvancedDefenseInput,
  BeginnerDefenseInput,
  DefenseInput,
  DefenseOutcome,
} from '../../game/model/types';

export type DefenseControlMode = 'BEGINNER' | 'ADVANCED';
type AdvancedAttackId = 'LEAD_JAB_HEAD' | 'REAR_STRAIGHT_HEAD' | 'LEAD_HOOK_HEAD';

const BEGINNER_CONTROLS = ['LEFT', 'RIGHT', 'BACK', 'GUARD'] as const;
const ADVANCED_CONTROLS = [
  'SLIP_LEFT',
  'SLIP_RIGHT',
  'WEAVE_LEFT',
  'WEAVE_RIGHT',
  'SWAY',
  'GUARD',
] as const;

const ADVANCED_DEFENSE_MATRIX: Record<
  AdvancedAttackId,
  Record<AdvancedDefenseInput, DefenseOutcome>
> = {
  LEAD_JAB_HEAD: {
    SLIP_LEFT: 'PERFECT', SLIP_RIGHT: 'PERFECT',
    WEAVE_LEFT: 'HIT', WEAVE_RIGHT: 'HIT',
    SWAY: 'SAFE', GUARD: 'SAFE',
  },
  REAR_STRAIGHT_HEAD: {
    SLIP_LEFT: 'PERFECT', SLIP_RIGHT: 'HIT',
    WEAVE_LEFT: 'HIT', WEAVE_RIGHT: 'HIT',
    SWAY: 'HIT', GUARD: 'SAFE',
  },
  LEAD_HOOK_HEAD: {
    SLIP_LEFT: 'HIT', SLIP_RIGHT: 'HIT',
    WEAVE_LEFT: 'HIT', WEAVE_RIGHT: 'PERFECT',
    SWAY: 'SAFE', GUARD: 'SAFE',
  },
};

export function controlsForMode(mode: DefenseControlMode): readonly DefenseInput[] {
  return mode === 'ADVANCED' ? ADVANCED_CONTROLS : BEGINNER_CONTROLS;
}

export function isAdvancedDefenseInput(input: DefenseInput): input is AdvancedDefenseInput {
  return input !== 'LEFT' && input !== 'RIGHT' && input !== 'BACK';
}

export function isBeginnerDefenseInput(input: DefenseInput): input is BeginnerDefenseInput {
  return input === 'LEFT' || input === 'RIGHT' || input === 'BACK' || input === 'GUARD';
}

export function presentationInput(input: DefenseInput | undefined): BeginnerDefenseInput | undefined {
  if (input === 'SLIP_LEFT' || input === 'WEAVE_LEFT') return 'LEFT';
  if (input === 'SLIP_RIGHT' || input === 'WEAVE_RIGHT') return 'RIGHT';
  if (input === 'SWAY') return 'BACK';
  return input;
}

export function isWeaveInput(input: DefenseInput | undefined): boolean {
  return input === 'WEAVE_LEFT' || input === 'WEAVE_RIGHT';
}

export function resolveAdvancedDefense(
  attackId: string,
  input: AdvancedDefenseInput,
): DefenseOutcome {
  return ADVANCED_DEFENSE_MATRIX[attackId as AdvancedAttackId]?.[input] ?? 'HIT';
}
