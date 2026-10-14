import { validateAttackDefinition } from '../../game/model/attack.js';

export const CHAMPION_UPPERCUT = validateAttackDefinition({
  attackId: 'LEAD_UPPERCUT_HEAD', hand: 'LEAD', punchType: 'UPPERCUT', target: 'HEAD',
  animationId: 'opponent.uppercut.lead.head.v1', cueAnchorMs: 190, impactMs: 620,
  responseWindowStartMs: 190, responseWindowEndMs: 590, speedTier: 1,
  defenseMatrix: { LEFT: 'SAFE', RIGHT: 'SAFE', BACK: 'PERFECT', GUARD: 'SAFE' },
});
