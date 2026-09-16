import test from 'node:test';
import assert from 'node:assert/strict';
import { P0_ATTACKS } from '../dist/game/config/p0Attacks.js';
import { resolveDefense } from '../dist/game/engine/DefenseResolver.js';

test('lead hook + RIGHT is PERFECT', () => {
  assert.equal(resolveDefense(P0_ATTACKS.LEAD_HOOK_HEAD, 'RIGHT'), 'PERFECT');
});

test('lead hook + GUARD is SAFE', () => {
  assert.equal(resolveDefense(P0_ATTACKS.LEAD_HOOK_HEAD, 'GUARD'), 'SAFE');
});

test('rear straight + LEFT is PERFECT', () => {
  assert.equal(resolveDefense(P0_ATTACKS.REAR_STRAIGHT_HEAD, 'LEFT'), 'PERFECT');
});

test('jab allows both slips in P0 without treating either as HIT', () => {
  const left = resolveDefense(P0_ATTACKS.LEAD_JAB_HEAD, 'LEFT');
  const right = resolveDefense(P0_ATTACKS.LEAD_JAB_HEAD, 'RIGHT');
  assert.notEqual(left, 'HIT');
  assert.notEqual(right, 'HIT');
});
