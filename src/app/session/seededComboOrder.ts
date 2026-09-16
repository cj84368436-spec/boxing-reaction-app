import type { ComboDefinition } from '../../game/model/types.js';

const UINT32_RANGE = 0x1_0000_0000;

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error('Playtest seed must be a finite integer');
  }
  return seed >>> 0;
}

export function createSeededComboOrder(
  sequence: readonly ComboDefinition[],
  seed: number,
): readonly ComboDefinition[] {
  let state = normalizeSeed(seed);
  const shuffled = [...sequence];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const swapIndex = Math.floor((state / UINT32_RANGE) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
}
