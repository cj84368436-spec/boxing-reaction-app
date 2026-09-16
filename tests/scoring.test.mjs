import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOutcome, summarizeOutcomes } from '../dist/game/engine/ScoreAccumulator.js';

test('P0 score weights PERFECT 2 SAFE 1 HIT 0', () => {
  assert.equal(scoreOutcome('PERFECT'), 2);
  assert.equal(scoreOutcome('SAFE'), 1);
  assert.equal(scoreOutcome('HIT'), 0);
});

test('summary reports outcome counts and points', () => {
  assert.deepEqual(summarizeOutcomes(['PERFECT', 'SAFE', 'HIT', 'PERFECT']), {
    perfect: 2,
    safe: 1,
    hit: 1,
    points: 5
  });
});
