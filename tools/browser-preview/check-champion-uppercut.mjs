import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createPreviewServer } from './server.mjs';

const server = createPreviewServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`${origin}/?seed=9&debug=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('boxing-survival-v1', JSON.stringify({version:1,unlocked:3,best:{},bestStreak:{}})));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '챔피언', exact: true }).click();
  await page.locator('#begin-button').click();
  assert.equal(await page.locator('.defense-btn:visible').count(), 6);
  const snapshot = await page.evaluate(() => window.__p0Preview.snapshot());
  const uppercut = snapshot.scheduledAttacks.find(attack => attack.attackId === 'LEAD_UPPERCUT_HEAD');
  assert.ok(uppercut, 'Champion round has an uppercut');
  let elapsed = 0;
  for (const attack of snapshot.scheduledAttacks) {
    if (attack.attackIndex > uppercut.attackIndex) break;
    const targetMs = attack.attackStartScheduledAtMs + 300;
    await page.clock.fastForward((targetMs - elapsed) / 1.12);
    elapsed = targetMs;
    const button = attack.attackId === 'LEAD_HOOK_HEAD' ? 'RIGHT' : attack.attackId === 'LEAD_UPPERCUT_HEAD' ? 'BACK' : 'LEFT';
    await page.locator(`[data-btn="${button}"]`).click();
  }
  await page.clock.fastForward(320 / 1.12);
  assert.equal(await page.locator('image[href*="uppercut.png"]').count(), 1);
  await page.screenshot({ path: 'art-direction/checks/champion-uppercut-390.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({uppercutIndex: uppercut.attackIndex, visibleButtons: 6, uppercutImageLoaded: true, screenshot: 'art-direction/checks/champion-uppercut-390.png'}));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
