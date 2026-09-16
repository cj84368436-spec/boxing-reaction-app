import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const EXPECTED_SOURCES = {
  LEAD_JAB_HEAD: {
    range: [1076, 1156],
    recovery: 1156,
    asfSha256: '99d2d33666408903424f0ff3fca2ad6f1641eee29d10611eec46585a867563f2',
    amcSha256: 'a80936acae23821eb0a575614c7cf282518bf2be30fd14b3983dc8d8351d897d'
  },
  REAR_STRAIGHT_HEAD: {
    range: [470, 540],
    recovery: 538,
    asfSha256: '99d2d33666408903424f0ff3fca2ad6f1641eee29d10611eec46585a867563f2',
    amcSha256: '42d62fa9474f86d8ab77c9bee5cf1133c8b30aaffa62ef7a851832522f031587'
  },
  LEAD_HOOK_HEAD: {
    range: [244, 315],
    recovery: 314,
    asfSha256: '96a22ac52ac15bd464c296028936be0ae7d2f0ee4a056202b1aa17f4ad02ec7f',
    amcSha256: 'a2648d51ea42461d8667557f8721fa8ff8463341838defdf7c2d32a96f19cba5'
  }
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(ROOT, relativePath), 'utf8'));
}

test('manifest ranges, source hashes, anchors and canonical metadata match each asset', async () => {
  const manifest = await readJson('tools/mocap/motion-sources.json');
  assert.equal(manifest.sources.length, 3);

  for (const source of manifest.sources) {
    const expected = EXPECTED_SOURCES[source.attackId];
    assert.ok(expected, `Unexpected attackId ${source.attackId}`);
    assert.match(source.asfSha256, SHA256_PATTERN);
    assert.match(source.amcSha256, SHA256_PATTERN);
    assert.equal(source.asfSha256, expected.asfSha256);
    assert.equal(source.amcSha256, expected.amcSha256);
    assert.deepEqual([source.frameRange.start, source.frameRange.end], expected.range);
    assert.equal(source.anchors.visualRecovery.sourceFrame, expected.recovery);

    const asset = await readJson(source.motionAsset);
    assert.equal(asset.attackId, source.attackId);
    assert.equal(asset.source.id, `${source.subject}_${String(source.trial).padStart(2, '0')}`);
    assert.equal(asset.frames[0].sourceFrame, source.frameRange.start);
    assert.equal(asset.frames.at(-1).sourceFrame, source.frameRange.end);
    assert.equal(asset.selection.startFrame, source.frameRange.start);
    assert.equal(asset.selection.endFrame, source.frameRange.end);
    assert.equal(asset.selection.recoveryFrame, source.anchors.visualRecovery.sourceFrame);
    assert.deepEqual(asset.canonicalTiming, source.canonicalTiming);
    assert.equal(asset.visualRecoveryMs, source.anchors.visualRecovery.timeMsNonCanonical);
  }
});

test('converter exposes convertAsfAmc as the shared library entry point', async () => {
  const converter = await import('../tools/mocap/convert-cmu-amc.mjs');
  assert.equal(typeof converter.convertAsfAmc, 'function');
});

test('converter verifies both source hashes before parsing ASF/AMC input', async () => {
  const { convertAsfAmc } = await import('../tools/mocap/convert-cmu-amc.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'boxing-motion-converter-test-'));
  const asfPath = join(directory, 'fixture.asf');
  const amcPath = join(directory, 'fixture.amc');
  const options = {
    asfPath,
    amcPath,
    attackId: 'FIXTURE',
    attackName: 'Fixture',
    sourceId: 'fixture_01',
    asfUrl: 'https://example.invalid/fixture.asf',
    amcUrl: 'https://example.invalid/fixture.amc',
    attribution: 'fixture',
    sourceFps: 120,
    frameStart: 1,
    frameEnd: 4,
    readyFrame: 1,
    cueFrame: 2,
    impactFrame: 3,
    recoveryFrame: 4,
    canonicalTiming: {
      cueAnchorMs: 120,
      impactMs: 480,
      responseWindowStartMs: 120,
      responseWindowEndMs: 450
    },
    visualRecoveryMs: 760
  };

  try {
    await writeFile(asfPath, 'asf\n', 'utf8');
    await writeFile(amcPath, 'amc\n', 'utf8');
    await assert.rejects(
      () => convertAsfAmc(options),
      /Invalid expected SHA-256.*ASF/i
    );
    await assert.rejects(
      () => convertAsfAmc({
        ...options,
        asfSha256: 'abd2e6e511293103b0ecef96cf909ea03d9ad029fd92bf51b2908bdcda2b134f',
        amcSha256: '0'.repeat(64)
      }),
      /SHA-256 mismatch.*AMC/i
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('source integrity verification accepts the expected SHA-256 and rejects a mismatch', async () => {
  const { verifySourceFile } = await import('../tools/mocap/source-integrity.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'boxing-motion-integrity-test-'));
  const path = join(directory, 'source.amc');

  try {
    await writeFile(path, 'verified source\n', 'utf8');
    const expected = 'd97c768fac71eff240db75bcdc191ec9b6c8a1175f57c000c51c896f50fb0fc6';
    assert.equal(await verifySourceFile(path, expected, 'fixture AMC'), expected);
    await assert.rejects(
      () => verifySourceFile(path, '0'.repeat(64), 'fixture AMC'),
      /SHA-256 mismatch.*fixture AMC/i
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('source download policy rejects non-HTTPS URLs before network access', async () => {
  const { assertHttpsUrl } = await import('../tools/mocap/source-integrity.mjs');
  assert.equal(assertHttpsUrl('https://mocap.cs.cmu.edu/source.amc').protocol, 'https:');
  assert.throws(
    () => assertHttpsUrl('http://mocap.cs.cmu.edu/source.amc'),
    /HTTPS URL required/i
  );
});

test('viewer loader reads all three canonical motion assets instead of embedded copies', async () => {
  const { loadMotionAssets } = await import('../tools/mocap/validation-viewer/runtime.mjs');
  const assets = await loadMotionAssets(async (url) => {
    const relativePath = new URL(url).pathname.split('/src/game/assets/motion/').at(-1);
    const data = await readJson(`src/game/assets/motion/${relativePath}`);
    return { ok: true, json: async () => data };
  });

  assert.deepEqual(
    Object.fromEntries(Object.entries(assets).map(([key, asset]) => [key, asset.attackId])),
    {
      jab: 'LEAD_JAB_HEAD',
      straight: 'REAR_STRAIGHT_HEAD',
      hook: 'LEAD_HOOK_HEAD'
    }
  );
});

test('reproducibility comparison checks frames, XYZ, timing and animation anchors semantically', async () => {
  const { compareMotionAssets } = await import('../tools/mocap/audit-motion-assets.mjs');
  const committed = await readJson('src/game/assets/motion/lead-jab.json');
  const rebuilt = structuredClone(committed);
  assert.deepEqual(compareMotionAssets(committed, rebuilt), {
    frameCount: true,
    sourceFrames: true,
    jointNames: true,
    xyz: true,
    canonicalTiming: true,
    animationAnchors: true,
    equal: true
  });

  rebuilt.frames[0].joints.lHand[2] += 0.001;
  const mismatch = compareMotionAssets(committed, rebuilt);
  assert.equal(mismatch.xyz, false);
  assert.equal(mismatch.equal, false);
});
