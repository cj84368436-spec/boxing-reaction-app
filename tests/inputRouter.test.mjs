import test from 'node:test';
import assert from 'node:assert/strict';
import { routeInput, detectMultiInput } from '../dist/game/engine/InputRouter.js';

const current = {
  attackInstanceId: 'jab-1',
  cueAtMs: 1000,
  responseStartAtMs: 1000,
  responseEndAtMs: 1360,
  impactAtMs: 1480
};
const next = {
  attackInstanceId: 'straight-2',
  cueAtMs: 1500,
  responseStartAtMs: 1500,
  responseEndAtMs: 1890,
  impactAtMs: 2040
};

test('valid current input routes to current attack', () => {
  const result = routeInput({ atMs: 1275, input: 'RIGHT' }, {
    current,
    currentResolved: false,
    next,
    preCueBufferMs: 100
  });
  assert.deepEqual(result, {
    kind: 'BUTTON',
    atMs: 1275,
    input: 'RIGHT',
    status: 'VALID',
    targetAttackInstanceId: 'jab-1',
    buffered: false
  });
});

test('input after current resolve can buffer for next combo attack', () => {
  const result = routeInput({ atMs: 1430, input: 'LEFT' }, {
    current,
    currentResolved: true,
    next,
    preCueBufferMs: 100
  });
  assert.deepEqual(result, {
    kind: 'BUTTON',
    atMs: 1430,
    input: 'LEFT',
    status: 'VALID',
    targetAttackInstanceId: 'straight-2',
    buffered: true
  });
});

test('input too early for current attack is EARLY', () => {
  const result = routeInput({ atMs: 800, input: 'LEFT' }, {
    current,
    currentResolved: false,
    next,
    preCueBufferMs: 100
  });
  assert.deepEqual(result, {
    kind: 'BUTTON',
    atMs: 800,
    input: 'LEFT',
    status: 'EARLY',
    buffered: false
  });
});

test('input after response window is LATE when there is no next combo attack', () => {
  const result = routeInput({ atMs: 1400, input: 'LEFT' }, {
    current,
    currentResolved: false,
    preCueBufferMs: 100
  });
  assert.deepEqual(result, {
    kind: 'BUTTON',
    atMs: 1400,
    input: 'LEFT',
    status: 'LATE',
    buffered: false
  });
});

test('near-simultaneous different buttons are MULTI_INPUT', () => {
  const previous = routeInput(
    { atMs: 1200, input: 'LEFT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );
  const routed = routeInput(
    { atMs: 1228, input: 'RIGHT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );

  assert.equal(
    detectMultiInput(previous, routed, 35),
    true
  );
});

test('near-simultaneous inputs for different attacks are not MULTI_INPUT', () => {
  const anotherAttack = { ...current, attackInstanceId: 'straight-2' };
  const previous = routeInput(
    { atMs: 1200, input: 'LEFT' },
    { current, currentResolved: false, preCueBufferMs: 100 }
  );
  const routed = routeInput(
    { atMs: 1228, input: 'RIGHT' },
    { current: anotherAttack, currentResolved: false, preCueBufferMs: 100 }
  );

  assert.equal(
    detectMultiInput(previous, routed, 35),
    false
  );
});

test('a LATE input cannot seed MULTI_INPUT for the next attack', () => {
  const late = routeInput(
    { atMs: 1400, input: 'LEFT' },
    { current, currentResolved: false, preCueBufferMs: 100 }
  );
  const valid = routeInput(
    { atMs: 1430, input: 'RIGHT' },
    { current, currentResolved: true, next, preCueBufferMs: 100 }
  );

  assert.equal(
    detectMultiInput(late, valid, 35),
    false
  );
});

test('routeInput preserves a button event for direct MULTI_INPUT detection', () => {
  const previous = routeInput(
    { atMs: 1200, input: 'LEFT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );
  const routed = routeInput(
    { atMs: 1228, input: 'RIGHT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );

  assert.deepEqual(previous, {
    kind: 'BUTTON',
    atMs: 1200,
    input: 'LEFT',
    status: 'VALID',
    targetAttackInstanceId: 'jab-1',
    buffered: false
  });
  assert.equal(detectMultiInput(previous, routed, 35), true);
});

test('the same button twice within 35ms is not MULTI_INPUT', () => {
  const previous = routeInput(
    { atMs: 1200, input: 'LEFT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );
  const routed = routeInput(
    { atMs: 1235, input: 'LEFT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );

  assert.equal(detectMultiInput(previous, routed, 35), false);
});

test('an EARLY button and a buffered VALID button are not MULTI_INPUT', () => {
  const early = routeInput(
    { atMs: 900, input: 'LEFT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );
  const buffered = routeInput(
    { atMs: 1430, input: 'RIGHT' },
    { current, currentResolved: true, next, preCueBufferMs: 100 }
  );

  assert.equal(early.status, 'EARLY');
  assert.equal(buffered.status, 'VALID');
  assert.equal(buffered.buffered, true);
  assert.equal(detectMultiInput(early, buffered, 35), false);
});

test('NO_INPUT has no fake button and is not a MULTI_INPUT candidate', () => {
  const noInput = {
    kind: 'NO_INPUT',
    status: 'NO_INPUT',
    targetAttackInstanceId: 'jab-1'
  };
  const valid = routeInput(
    { atMs: 1200, input: 'RIGHT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );

  assert.equal(Object.hasOwn(noInput, 'input'), false);
  assert.equal(detectMultiInput(noInput, valid, 35), false);
});

test('MULTI_INPUT includes the 35ms boundary but excludes 36ms', () => {
  const previous = routeInput(
    { atMs: 1200, input: 'LEFT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );
  const atBoundary = routeInput(
    { atMs: 1235, input: 'RIGHT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );
  const outsideBoundary = routeInput(
    { atMs: 1236, input: 'RIGHT' },
    { current, currentResolved: false, next, preCueBufferMs: 100 }
  );

  assert.equal(detectMultiInput(previous, atBoundary, 35), true);
  assert.equal(detectMultiInput(previous, outsideBoundary, 35), false);
});

test('repeated attack types remain separate attack instances', () => {
  const jabInstanceA = { ...current, attackInstanceId: 'jab-instance-a' };
  const jabInstanceB = { ...current, attackInstanceId: 'jab-instance-b' };
  const firstJab = routeInput(
    { atMs: 1200, input: 'LEFT' },
    { current: jabInstanceA, currentResolved: false, preCueBufferMs: 100 }
  );
  const secondJab = routeInput(
    { atMs: 1228, input: 'RIGHT' },
    { current: jabInstanceB, currentResolved: false, preCueBufferMs: 100 }
  );

  assert.equal(firstJab.targetAttackInstanceId, 'jab-instance-a');
  assert.equal(secondJab.targetAttackInstanceId, 'jab-instance-b');
  assert.equal(detectMultiInput(firstJab, secondJab, 35), false);
});
