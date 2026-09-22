import type { AttackDefinition, BeginnerDefenseInput, DefenseInput, DefenseOutcome } from '../model/types.js';

export function resolveDefense(
  attack: AttackDefinition,
  input: DefenseInput
): DefenseOutcome {
  return attack.defenseMatrix[input as BeginnerDefenseInput] ?? 'HIT';
}
