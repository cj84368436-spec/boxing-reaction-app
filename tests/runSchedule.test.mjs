import test from 'node:test';
import assert from 'node:assert/strict';
import { P0_SEQUENCE, countPunches } from '../dist/game/config/p0Sequence.js';
import { P0_TIMING } from '../dist/game/config/p0Timing.js';
import { routeInput } from '../dist/game/engine/InputRouter.js';

function comboById(comboId) {
  const combo = P0_SEQUENCE.find((candidate) => candidate.comboId === comboId);
  assert.ok(combo, `missing combo ${comboId}`);
  return combo;
}

function absoluteTimeline(combo, comboStartAtMs = 0) {
  return combo.attacks.map((attack, attackIndex) => {
    const attackStartAtMs = comboStartAtMs + combo.attackStartOffsetsMs[attackIndex];
    return {
      attackInstanceId: `${combo.comboId}:${attackIndex}`,
      attackId: attack.attackId,
      attackStartAtMs,
      cueAtMs: attackStartAtMs + attack.cueAnchorMs,
      responseStartAtMs: attackStartAtMs + attack.responseWindowStartMs,
      responseEndAtMs: attackStartAtMs + attack.responseWindowEndMs,
      impactAtMs: attackStartAtMs + attack.impactMs
    };
  });
}

function multiHitTimelines() {
  return P0_SEQUENCE
    .filter((combo) => combo.attacks.length > 1)
    .map((combo) => absoluteTimeline(combo));
}

test('P0 sequence stores the approved attack-start offsets', () => {
  assert.deepEqual(
    P0_SEQUENCE.map((combo) => combo.attackStartOffsetsMs),
    [
      [0],
      [0],
      [0],
      [0, 650],
      [0, 650],
      [0, 650, 1300]
    ]
  );
});

test('every combo offset list starts at zero, matches its attacks, and strictly increases', () => {
  for (const combo of P0_SEQUENCE) {
    assert.equal(combo.attackStartOffsetsMs[0], 0, combo.comboId);
    assert.equal(combo.attackStartOffsetsMs.length, combo.attacks.length, combo.comboId);

    for (let index = 1; index < combo.attackStartOffsetsMs.length; index += 1) {
      assert.ok(
        combo.attackStartOffsetsMs[index] > combo.attackStartOffsetsMs[index - 1],
        combo.comboId
      );
    }
  }
});

test('approved schedule preserves exactly ten punches', () => {
  assert.equal(countPunches(P0_SEQUENCE), 10);
});

test('multi-hit combos produce the approved absolute canonical timeline', () => {
  assert.deepEqual(absoluteTimeline(comboById('double-jab-straight')), [
    {
      attackInstanceId: 'double-jab-straight:0',
      attackId: 'LEAD_JAB_HEAD',
      attackStartAtMs: 0,
      cueAtMs: 120,
      responseStartAtMs: 120,
      responseEndAtMs: 450,
      impactAtMs: 480
    },
    {
      attackInstanceId: 'double-jab-straight:1',
      attackId: 'REAR_STRAIGHT_HEAD',
      attackStartAtMs: 650,
      cueAtMs: 800,
      responseStartAtMs: 800,
      responseEndAtMs: 1160,
      impactAtMs: 1190
    }
  ]);

  assert.deepEqual(absoluteTimeline(comboById('double-jab-hook')), [
    {
      attackInstanceId: 'double-jab-hook:0',
      attackId: 'LEAD_JAB_HEAD',
      attackStartAtMs: 0,
      cueAtMs: 120,
      responseStartAtMs: 120,
      responseEndAtMs: 450,
      impactAtMs: 480
    },
    {
      attackInstanceId: 'double-jab-hook:1',
      attackId: 'LEAD_HOOK_HEAD',
      attackStartAtMs: 650,
      cueAtMs: 840,
      responseStartAtMs: 840,
      responseEndAtMs: 1240,
      impactAtMs: 1270
    }
  ]);

  assert.deepEqual(absoluteTimeline(comboById('triple-jab-straight-hook')), [
    {
      attackInstanceId: 'triple-jab-straight-hook:0',
      attackId: 'LEAD_JAB_HEAD',
      attackStartAtMs: 0,
      cueAtMs: 120,
      responseStartAtMs: 120,
      responseEndAtMs: 450,
      impactAtMs: 480
    },
    {
      attackInstanceId: 'triple-jab-straight-hook:1',
      attackId: 'REAR_STRAIGHT_HEAD',
      attackStartAtMs: 650,
      cueAtMs: 800,
      responseStartAtMs: 800,
      responseEndAtMs: 1160,
      impactAtMs: 1190
    },
    {
      attackInstanceId: 'triple-jab-straight-hook:2',
      attackId: 'LEAD_HOOK_HEAD',
      attackStartAtMs: 1300,
      cueAtMs: 1490,
      responseStartAtMs: 1490,
      responseEndAtMs: 1890,
      impactAtMs: 1920
    }
  ]);
});

test('adjacent canonical response windows never overlap', () => {
  for (const timeline of multiHitTimelines()) {
    for (let index = 0; index < timeline.length - 1; index += 1) {
      assert.ok(timeline[index].responseEndAtMs < timeline[index + 1].responseStartAtMs);
    }
  }
});

test('every next pre-cue buffer begins after the prior response window and impact', () => {
  for (const timeline of multiHitTimelines()) {
    for (let index = 0; index < timeline.length - 1; index += 1) {
      const current = timeline[index];
      const next = timeline[index + 1];
      const nextBufferStartAtMs = next.cueAtMs - P0_TIMING.preCueBufferMs;

      assert.ok(nextBufferStartAtMs > current.responseEndAtMs);
      assert.ok(nextBufferStartAtMs >= current.impactAtMs);
    }
  }
});

test('a pre-cue buffer boundary input routes to the next attack regardless of current resolution', () => {
  for (const timeline of multiHitTimelines()) {
    for (let index = 0; index < timeline.length - 1; index += 1) {
      const current = timeline[index];
      const next = timeline[index + 1];
      const atMs = next.cueAtMs - P0_TIMING.preCueBufferMs;

      for (const currentResolved of [false, true]) {
        assert.deepEqual(
          routeInput(
            { atMs, input: 'LEFT' },
            { current, currentResolved, next, preCueBufferMs: P0_TIMING.preCueBufferMs }
          ),
          {
            kind: 'BUTTON',
            atMs,
            status: 'VALID',
            input: 'LEFT',
            targetAttackInstanceId: next.attackInstanceId,
            buffered: true
          }
        );
      }
    }
  }
});

test('an input at the next cue routes to the next attack without buffering', () => {
  for (const timeline of multiHitTimelines()) {
    for (let index = 0; index < timeline.length - 1; index += 1) {
      const current = timeline[index];
      const next = timeline[index + 1];

      assert.deepEqual(
        routeInput(
          { atMs: next.cueAtMs, input: 'RIGHT' },
          { current, currentResolved: false, next, preCueBufferMs: P0_TIMING.preCueBufferMs }
        ),
        {
          kind: 'BUTTON',
          atMs: next.cueAtMs,
          status: 'VALID',
          input: 'RIGHT',
          targetAttackInstanceId: next.attackInstanceId,
          buffered: false
        }
      );
    }
  }
});

test('current recovery values remain separate from internal attack-start offsets', () => {
  assert.deepEqual(
    P0_SEQUENCE.map((combo) => combo.recoveryAfterMs),
    [700, 700, 850, 900, 900, 1000]
  );
  assert.deepEqual(
    P0_SEQUENCE.map((combo) => combo.attackStartOffsetsMs),
    [[0], [0], [0], [0, 650], [0, 650], [0, 650, 1300]]
  );
});

test('current canonical P0 schedule calculates to 14,070ms without enforcing a UX range', () => {
  const comboDurationsMs = P0_SEQUENCE.map((combo) => {
    const lastIndex = combo.attacks.length - 1;
    return combo.attackStartOffsetsMs[lastIndex] + combo.attacks[lastIndex].impactMs;
  });
  const recoveryTotalMs = P0_SEQUENCE.reduce(
    (total, combo) => total + combo.recoveryAfterMs,
    0
  );
  const runtimeMs =
    P0_TIMING.countdownMs +
    comboDurationsMs.reduce((total, durationMs) => total + durationMs, 0) +
    recoveryTotalMs;

  assert.deepEqual(comboDurationsMs, [480, 540, 620, 1190, 1270, 1920]);
  assert.equal(recoveryTotalMs, 5050);
  assert.equal(runtimeMs, 14070);
});

test('run schedule data contains no presentation-layer recovery timing', () => {
  for (const combo of P0_SEQUENCE) {
    assert.equal(Object.hasOwn(combo, 'visualRecoveryMs'), false);
    for (const attack of combo.attacks) {
      assert.equal(Object.hasOwn(attack, 'visualRecoveryMs'), false);
    }
  }
});
