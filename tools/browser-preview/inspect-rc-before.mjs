import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.clock.install(); await page.clock.pauseAt(new Date());
await page.goto('http://127.0.0.1:3000/?debug=1&seed=123'); await page.waitForFunction(()=>window.__p0Preview);
await page.screenshot({path:'release/rc/before-start.png'});
await page.locator('#fast-button').click();
const s=await page.evaluate(()=>window.__p0Preview.snapshot());
console.log(JSON.stringify(s.scheduledAttacks));
for (const a of s.scheduledAttacks.slice(0,3)) {
 const impact={LEAD_JAB_HEAD:480,REAR_STRAIGHT_HEAD:540,LEAD_HOOK_HEAD:620}[a.attackId];
 for(const t of [0,190,impact-100,impact,impact+120]){
 const now=await page.evaluate(()=>window.__p0Preview.snapshot().nowMs);
 await page.clock.runFor(Math.max(0,a.attackStartScheduledAtMs+t-now));
 await page.screenshot({path:`release/rc/before-${a.attackIndex}-${t}.png`});
 }
}
await page.clock.runFor(30000); await page.screenshot({path:'release/rc/before-fail.png'});
await page.locator('#retry-button').click();
const ss=await page.evaluate(()=>window.__p0Preview.snapshot());
for(const a of ss.scheduledAttacks){const now=await page.evaluate(()=>window.__p0Preview.snapshot().nowMs);await page.clock.runFor(Math.max(0,a.attackStartScheduledAtMs+250-now));await page.locator('[data-btn="GUARD"]').click();}
await page.clock.runFor(1200); console.log('guard results',await page.evaluate(()=>window.__p0Preview.snapshot().results.map(r=>r.outcome)));
await page.screenshot({path:'release/rc/before-guard.png'});await browser.close();
