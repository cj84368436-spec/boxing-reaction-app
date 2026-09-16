import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer, startServer } from './server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const JOINT_NAMES = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'lHip', 'lKnee', 'lAnkle', 'lToe', 'rHip', 'rKnee', 'rAnkle', 'rToe',
  'lShoulder', 'lElbow', 'lHand', 'rShoulder', 'rElbow', 'rHand',
];

test('canonical preview assets retain finite 19-joint Ready frames', async () => {
  const expected = [
    ['lead-jab.json', 'LEAD_JAB_HEAD', '144_13'],
    ['rear-straight.json', 'REAR_STRAIGHT_HEAD', '144_20'],
    ['lead-hook.json', 'LEAD_HOOK_HEAD', '14_01'],
  ];
  for (const [filename, attackId, sourceId] of expected) {
    const asset = JSON.parse(await readFile(join(ROOT, 'src/game/assets/motion', filename), 'utf8'));
    assert.equal(asset.attackId, attackId);
    assert.equal(asset.source.id, sourceId);
    for (const joint of JOINT_NAMES) {
      assert.equal(asset.frames[0].joints[joint].length, 3);
      assert.ok(asset.frames[0].joints[joint].every(Number.isFinite));
    }
  }
});

test('preview UI exposes ten-punch controls and results without central verdict text', async () => {
  const html = await readFile(join(__dirname, 'preview.html'), 'utf8');
  for (const input of ['LEFT', 'RIGHT', 'BACK', 'GUARD']) {
    assert.match(html, new RegExp(`data-btn="${input}"`));
  }
  assert.equal((html.match(/class="progress-bar"/g) ?? []).length, 10);
  assert.ok(html.includes('id="result-list"'));
  assert.ok(html.includes('id="seed-input"'));
  assert.ok(html.includes('id="replay-seed-button"'));
  assert.ok(!html.includes('id="attack-feedback"'));
  assert.ok(!html.includes('id="feedback-title"'));
});

test('preview composes the shared seeded ten-punch session without gameplay overrides', async () => {
  const { P0TenPunchSession } = await import('../../.preview-dist/app/session/P0TenPunchSession.js');
  const { PreviewTenPunchSession } = await import('./preview-session.mjs');
  const clock = { value: 0, nowMs() { return this.value; } };
  const session = new PreviewTenPunchSession(clock, {
    LEAD_JAB_HEAD: '144_13', REAR_STRAIGHT_HEAD: '144_20', LEAD_HOOK_HEAD: '14_01',
  }, { seed: 123 });

  assert.ok(session instanceof P0TenPunchSession);
  assert.deepEqual(Object.getOwnPropertyNames(PreviewTenPunchSession.prototype), ['constructor']);
  session.start({ leadInMs: 0 });
  clock.value = 200;
  assert.equal(session.handleInput('RIGHT').status, 'VALID');
  clock.value = 30_000;
  const completed = session.tick();
  assert.equal(completed.comboOrderIds.length, 6);
  assert.equal(completed.scheduledAttacks.length, 10);
  assert.equal(completed.results.length, 10);
  assert.equal(completed.sessionCompleted, true);

  clock.value = 31_000;
  session.retry({ leadInMs: 0, seed: 123 });
  assert.equal(session.snapshot().seed, 123);
  assert.deepEqual(session.snapshot().comboOrderIds, completed.comboOrderIds);
  assert.deepEqual(session.snapshot().results, []);
});

test('preview server serves only allowlisted preview resources', async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const htmlResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(htmlResponse.status, 200);
    assert.ok((await htmlResponse.text()).includes('P0 Browser Preview'));
    const sharedResponse = await fetch(`http://127.0.0.1:${port}/.preview-dist/app/session/P0TenPunchSession.js`);
    assert.equal(sharedResponse.status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/package.json`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('preview server advances to the next port when preferred port is occupied', async () => {
  const occupied = createPreviewServer();
  await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  const preferredPort = occupied.address().port;
  let preview;
  try {
    preview = await startServer(preferredPort, 2);
    assert.equal(preview.port, preferredPort + 1);
  } finally {
    if (preview) await new Promise((resolve) => preview.server.close(resolve));
    await new Promise((resolve) => occupied.close(resolve));
  }
});

test('all browser presentation modules remain available from the preview output', async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const visited = new Set();
  async function check(path) {
    if (visited.has(path)) return;
    visited.add(path);
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, `Missing browser module: ${path}`);
    const source = await response.text();
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.' ) || match[1].startsWith('/')) {
        await check(new URL(match[1], origin + path).pathname);
      }
    }
  }
  try { await check('/preview-client.mjs'); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
