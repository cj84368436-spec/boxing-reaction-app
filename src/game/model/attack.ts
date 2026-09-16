import type { AttackDefinition } from './types.js';

export function validateAttackDefinition(attack: AttackDefinition): AttackDefinition {
  if (attack.responseWindowStartMs > attack.responseWindowEndMs) {
    throw new Error(`${attack.attackId}: response window start must be <= end`);
  }
  if (attack.cueAnchorMs > attack.impactMs) {
    throw new Error(`${attack.attackId}: cueAnchorMs must be <= impactMs`);
  }
  if (attack.responseWindowEndMs > attack.impactMs) {
    throw new Error(`${attack.attackId}: response window must close by impactMs`);
  }
  if (attack.speedTier < 1) {
    throw new Error(`${attack.attackId}: speedTier must be >= 1`);
  }
  return attack;
}
