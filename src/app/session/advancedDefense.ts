import type { DefenseInput, DefenseOutcome } from '../../game/model/types.js';

export type DefenseControlInput = DefenseInput | 'DUCK' | 'STEP_IN';

const BASIC_CONTROLS = ['LEFT', 'RIGHT', 'BACK', 'GUARD'] as const;
const CHAMPION_CONTROLS = [...BASIC_CONTROLS, 'DUCK', 'STEP_IN'] as const;

const EXTRA_OUTCOMES: Readonly<Record<string, Readonly<Record<'DUCK' | 'STEP_IN', DefenseOutcome>>>> = {
  LEAD_JAB_HEAD: { DUCK: 'SAFE', STEP_IN: 'HIT' },
  REAR_STRAIGHT_HEAD: { DUCK: 'PERFECT', STEP_IN: 'HIT' },
  LEAD_HOOK_HEAD: { DUCK: 'SAFE', STEP_IN: 'PERFECT' },
  LEAD_UPPERCUT_HEAD: { DUCK: 'HIT', STEP_IN: 'HIT' },
};

export function controlsForLevel(level: 1 | 2 | 3): readonly DefenseControlInput[] {
  return level === 3 ? CHAMPION_CONTROLS : BASIC_CONTROLS;
}

export function isExtraDefense(input: DefenseControlInput): input is 'DUCK' | 'STEP_IN' {
  return input === 'DUCK' || input === 'STEP_IN';
}

export function extraDefenseOutcome(attackId: string, input: 'DUCK' | 'STEP_IN'): DefenseOutcome {
  return EXTRA_OUTCOMES[attackId]?.[input] ?? 'HIT';
}
