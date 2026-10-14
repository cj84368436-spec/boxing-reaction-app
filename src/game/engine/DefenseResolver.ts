import type { AttackDefinition, DefenseInput, DefenseOutcome } from '../model/types.js';

export function resolveDefense(
  attack: AttackDefinition,
  input: DefenseInput
): DefenseOutcome {
  return attack.defenseMatrix[input];
}
