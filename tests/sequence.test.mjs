import test from 'node:test';
import assert from 'node:assert/strict';
import { P0_SEQUENCE, countPunches } from '../dist/game/config/p0Sequence.js';

test('P0 sequence contains 3 singles, 2 doubles, and 1 triple', () => {
  assert.deepEqual(P0_SEQUENCE.map((combo) => combo.attacks.length), [1, 1, 1, 2, 2, 3]);
});

test('P0 sequence contains exactly 10 punches', () => {
  assert.equal(countPunches(P0_SEQUENCE), 10);
});
