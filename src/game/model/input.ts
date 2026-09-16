import type { DefenseInputEvent } from './types.js';

export function reactionTimeMs(cueAtMs: number, input: DefenseInputEvent): number {
  return input.atMs - cueAtMs;
}
