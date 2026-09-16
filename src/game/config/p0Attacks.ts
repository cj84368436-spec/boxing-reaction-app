import { validateAttackDefinition } from '../model/attack.js';
import type { AttackDefinition } from '../model/types.js';

const leadJabHead = validateAttackDefinition({
  attackId: 'LEAD_JAB_HEAD',
  hand: 'LEAD',
  punchType: 'JAB',
  target: 'HEAD',
  animationId: 'opponent.jab.lead.head.v1',
  cueAnchorMs: 120,
  impactMs: 480,
  responseWindowStartMs: 120,
  responseWindowEndMs: 450,
  speedTier: 1,
  defenseMatrix: {
    LEFT: 'PERFECT',
    RIGHT: 'PERFECT',
    BACK: 'SAFE',
    GUARD: 'SAFE'
  }
});

const rearStraightHead = validateAttackDefinition({
  attackId: 'REAR_STRAIGHT_HEAD',
  hand: 'REAR',
  punchType: 'STRAIGHT',
  target: 'HEAD',
  animationId: 'opponent.straight.rear.head.v1',
  cueAnchorMs: 150,
  impactMs: 540,
  responseWindowStartMs: 150,
  responseWindowEndMs: 510,
  speedTier: 1,
  defenseMatrix: {
    LEFT: 'PERFECT',
    RIGHT: 'SAFE',
    BACK: 'SAFE',
    GUARD: 'SAFE'
  }
});

const leadHookHead = validateAttackDefinition({
  attackId: 'LEAD_HOOK_HEAD',
  hand: 'LEAD',
  punchType: 'HOOK',
  target: 'HEAD',
  animationId: 'opponent.hook.lead.head.v1',
  cueAnchorMs: 190,
  impactMs: 620,
  responseWindowStartMs: 190,
  responseWindowEndMs: 590,
  speedTier: 1,
  defenseMatrix: {
    LEFT: 'HIT',
    RIGHT: 'PERFECT',
    BACK: 'SAFE',
    GUARD: 'SAFE'
  }
});

export const P0_ATTACKS = {
  LEAD_JAB_HEAD: leadJabHead,
  REAR_STRAIGHT_HEAD: rearStraightHead,
  LEAD_HOOK_HEAD: leadHookHead
} as const satisfies Record<string, AttackDefinition>;
