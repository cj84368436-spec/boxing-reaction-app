/**
 * mocapMotionContract.test.mjs
 *
 * Motion pipeline contract tests for P0.
 * Verifies structural integrity, FK regression, and animationId↔asset linkage.
 *
 * Tests 1–6: Original mocap3Attacks.test.mjs (preserved in full, paths updated)
 * Test 7:    FK regression fixture — Lead Jab Ready/Cue/Impact (6 joints ±0.01)
 * Test 8:    animationId ↔ motion asset file exists
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  samplePose,
  projectPose,
  buildRigCommands,
  getFreezePoints
} from '../tools/mocap/validation-viewer/runtime.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const EXPECTED_19_JOINTS = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'lHip', 'lKnee', 'lAnkle', 'lToe',
  'rHip', 'rKnee', 'rAnkle', 'rToe',
  'lShoulder', 'lElbow', 'lHand',
  'rShoulder', 'rElbow', 'rHand'
];

// Canonical motion asset paths (integration branch locations)
const MOTION_ASSETS = {
  LEAD_JAB_HEAD:     'src/game/assets/motion/lead-jab.json',
  REAR_STRAIGHT_HEAD: 'src/game/assets/motion/rear-straight.json',
  LEAD_HOOK_HEAD:    'src/game/assets/motion/lead-hook.json',
};

async function loadAttack(relativePath) {
  const content = await readFile(join(ROOT, relativePath), 'utf8');
  return JSON.parse(content);
}

// ── Test 1: Lead Jab structural integrity ─────────────────────────────────
test('Lead Jab dataset preserves 19 joints and matches canonical timing', async () => {
  const data = await loadAttack(MOTION_ASSETS.LEAD_JAB_HEAD);
  assert.equal(data.attackId, 'LEAD_JAB_HEAD');
  assert.deepEqual(data.jointNames, EXPECTED_19_JOINTS);
  assert.equal(data.canonicalTiming.cueAnchorMs, 120);
  assert.equal(data.canonicalTiming.impactMs, 480);
  assert.equal(data.canonicalTiming.responseWindowStartMs, 120);
  assert.equal(data.canonicalTiming.responseWindowEndMs, 450);
  assert.equal(data.visualRecoveryMs, 760,
    'visualRecoveryMs is a non-canonical animation anchor, not game timing');

  for (const frame of data.frames) {
    for (const joint of EXPECTED_19_JOINTS) {
      assert.ok(frame.joints[joint], `Missing joint ${joint} in frame ${frame.sourceFrame}`);
      assert.equal(frame.joints[joint].length, 3);
      frame.joints[joint].forEach((v) => assert.ok(Number.isFinite(v)));
    }
  }
});

// ── Test 2: Rear Straight structural integrity ────────────────────────────
test('Rear Straight dataset preserves 19 joints and matches canonical timing', async () => {
  const data = await loadAttack(MOTION_ASSETS.REAR_STRAIGHT_HEAD);
  assert.equal(data.attackId, 'REAR_STRAIGHT_HEAD');
  assert.deepEqual(data.jointNames, EXPECTED_19_JOINTS);
  assert.equal(data.canonicalTiming.cueAnchorMs, 150);
  assert.equal(data.canonicalTiming.impactMs, 540);
  assert.equal(data.canonicalTiming.responseWindowStartMs, 150);
  assert.equal(data.canonicalTiming.responseWindowEndMs, 510);
  assert.equal(data.visualRecoveryMs, 820,
    'visualRecoveryMs is a non-canonical animation anchor, not game timing');

  for (const frame of data.frames) {
    for (const joint of EXPECTED_19_JOINTS) {
      assert.ok(frame.joints[joint], `Missing joint ${joint}`);
      assert.equal(frame.joints[joint].length, 3);
      frame.joints[joint].forEach((v) => assert.ok(Number.isFinite(v)));
    }
  }
});

// ── Test 3: Lead Hook structural integrity ────────────────────────────────
test('Lead Hook dataset preserves 19 joints and matches canonical timing', async () => {
  const data = await loadAttack(MOTION_ASSETS.LEAD_HOOK_HEAD);
  assert.equal(data.attackId, 'LEAD_HOOK_HEAD');
  assert.deepEqual(data.jointNames, EXPECTED_19_JOINTS);
  assert.equal(data.canonicalTiming.cueAnchorMs, 190);
  assert.equal(data.canonicalTiming.impactMs, 620);
  assert.equal(data.canonicalTiming.responseWindowStartMs, 190);
  assert.equal(data.canonicalTiming.responseWindowEndMs, 590);
  assert.equal(data.visualRecoveryMs, 900,
    'visualRecoveryMs is a non-canonical animation anchor, not game timing');

  for (const frame of data.frames) {
    for (const joint of EXPECTED_19_JOINTS) {
      assert.ok(frame.joints[joint], `Missing joint ${joint}`);
      assert.equal(frame.joints[joint].length, 3);
      frame.joints[joint].forEach((v) => assert.ok(Number.isFinite(v)));
    }
  }
});

// ── Test 4: samplePose determinism + mutation isolation ───────────────────
test('samplePose is deterministic and immutable across all 3 attacks', async () => {
  const paths = Object.values(MOTION_ASSETS);

  for (const path of paths) {
    const data = await loadAttack(path);
    const poseA = samplePose(data, 200);
    const poseB = samplePose(data, 200);
    assert.deepEqual(poseA.joints, poseB.joints);

    // Mutation isolation
    poseA.joints.head[0] += 999;
    const poseC = samplePose(data, 200);
    assert.notEqual(poseA.joints.head[0], poseC.joints.head[0]);
    assert.deepEqual(poseB.joints, poseC.joints);
  }
});

// ── Test 5: glove scale validation ───────────────────────────────────────
test('projectPose and buildRigCommands handle 1.0x and 1.5x glove scale and reject invalid scales', async () => {
  const data = await loadAttack(MOTION_ASSETS.LEAD_JAB_HEAD);
  const readyPose = samplePose(data, 0).joints;
  const current = samplePose(data, 120);

  const frontProj   = projectPose(current.joints, 'front',   readyPose);
  const quarterProj = projectPose(current.joints, 'quarter', readyPose);

  assert.notEqual(frontProj.lHand.x, quarterProj.lHand.x);

  const cmds10 = buildRigCommands(frontProj, { gloveScale: 1.0 });
  const cmds15 = buildRigCommands(frontProj, { gloveScale: 1.5 });
  assert.ok(cmds10.length > 0);
  assert.ok(cmds15.length > 0);

  assert.throws(() => buildRigCommands(frontProj, { gloveScale: 2.0 }));
  assert.throws(() => buildRigCommands(frontProj, { gloveScale: 0.5 }));
});

// ── Test 6: freeze points match canonical timing ──────────────────────────
test('Freeze points are derived from each canonical motion asset', async () => {
  const jabPts = getFreezePoints(await loadAttack(MOTION_ASSETS.LEAD_JAB_HEAD));
  assert.equal(jabPts.find(p => p.id === 'cue').timeMs,      120);
  assert.equal(jabPts.find(p => p.id === 'impact').timeMs,   480);
  assert.equal(jabPts.find(p => p.id === 'recovery').timeMs, 760);

  const straightPts = getFreezePoints(await loadAttack(MOTION_ASSETS.REAR_STRAIGHT_HEAD));
  assert.equal(straightPts.find(p => p.id === 'cue').timeMs,      150);
  assert.equal(straightPts.find(p => p.id === 'impact').timeMs,   540);
  assert.equal(straightPts.find(p => p.id === 'recovery').timeMs, 820);

  const hookPts = getFreezePoints(await loadAttack(MOTION_ASSETS.LEAD_HOOK_HEAD));
  assert.equal(hookPts.find(p => p.id === 'cue').timeMs,      190);
  assert.equal(hookPts.find(p => p.id === 'impact').timeMs,   620);
  assert.equal(hookPts.find(p => p.id === 'recovery').timeMs, 900);
});

// ── Test 7: Lead Jab FK regression fixture (NEW) ─────────────────────────
test('Lead Jab FK regression: Ready/Cue/Impact joints match Codex reference ±0.01', async () => {
  const fixture = JSON.parse(
    await readFile(join(ROOT, 'tests/fixtures/lead-jab-regression.json'), 'utf8')
  );
  const data = await loadAttack(MOTION_ASSETS.LEAD_JAB_HEAD);
  const tol = fixture.tolerance;

  for (const snap of fixture.snapshots) {
    const pose = samplePose(data, snap.timeMs);
    for (const joint of fixture.joints) {
      const actual   = pose.joints[joint];
      const expected = snap.values[joint];
      assert.ok(actual, `Joint ${joint} missing at ${snap.label}`);
      for (let axis = 0; axis < 3; axis++) {
        const diff = Math.abs(actual[axis] - expected[axis]);
        assert.ok(
          diff <= tol,
          `[${snap.label}] ${joint}[${axis}]: expected ${expected[axis].toFixed(6)}, ` +
          `got ${actual[axis].toFixed(6)}, diff=${diff.toFixed(6)} > tol=${tol}\n` +
          `  → FK axis/dof regression detected. Do not modify convert-cmu-amc.mjs without re-verifying.`
        );
      }
    }
  }
});

// ── Test 8: animationId ↔ motion asset file exists (NEW) ─────────────────
test('Each P0 attackId maps to an existing motion asset file', async () => {
  // Also validates motion-sources.json is well-formed
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'tools/mocap/motion-sources.json'), 'utf8')
  );

  assert.ok(Array.isArray(manifest.sources), 'motion-sources.json must have sources array');
  assert.equal(manifest.sources.length, 3, 'Expected exactly 3 P0 motion sources');

  for (const source of manifest.sources) {
    const { attackId, motionAsset } = source;
    assert.ok(attackId, 'source must have attackId');
    assert.ok(motionAsset, `${attackId} must have motionAsset path`);

    // File must exist
    const fullPath = join(ROOT, motionAsset);
    await assert.doesNotReject(
      () => access(fullPath, constants.R_OK),
      `Motion asset for ${attackId} not found at: ${motionAsset}`
    );

    // File must be loadable and have matching attackId
    const content = JSON.parse(await readFile(fullPath, 'utf8'));
    assert.equal(
      content.attackId, attackId,
      `attackId mismatch in ${motionAsset}: expected ${attackId}, got ${content.attackId}`
    );

    // visualRecoveryMs must exist (non-canonical anchor)
    assert.ok(
      typeof content.visualRecoveryMs === 'number',
      `${attackId}: visualRecoveryMs must be a number (non-canonical anchor)`
    );
  }
});
