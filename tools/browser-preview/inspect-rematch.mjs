import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { P0_ATTACKS } from '../../.preview-dist/game/config/p0Attacks.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const date=new Date('2026-09-15T07:00:00Z');await page.clock.install({time:date});await page.clock.pauseAt(date);
 await page.goto('http://127.0.0.1:3000/?debug=1&seed=123');await page.waitForFunction(()=>!!window.__p0Preview);
 await page.locator('#fast-button').click();
 const snap=()=>page.evaluate(()=>window.__p0Preview.snapshot());
 const advance=async t=>{const now=(await snap()).nowMs;if(t>now)await page.clock.runFor(t-now);};
 const original=await snap();
 for(const a of original.scheduledAttacks){const d=P0_ATTACKS[a.attackId];await advance(a.attackStartScheduledAtMs+(a.attackIndex===8?d.responseWindowEndMs+10:d.cueAnchorMs+40));await page.locator('[data-btn="'+(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT')+'"]').click();}
 await page.clock.runFor(1000);const result=await snap();
 assert.equal(result.results.filter(r=>r.outcome==='HIT').length,1);
 assert.match(await page.locator('#coach-result').innerText(),/딱 한 대/);
 assert.match(await page.locator('#rematch-title').innerText(),/9번째 훅/);
 assert.match(await page.locator('#rematch-body').innerText(),/0.01초/);
 await page.screenshot({path:'release/rematch-loop/near-miss-390.png'});
 await page.setViewportSize({width:320,height:568});await page.screenshot({path:'release/rematch-loop/near-miss-320.png'});
 const bounds=await page.locator('#retry-button').boundingBox();assert.ok(bounds&&bounds.height>=44&&bounds.y+bounds.height<=568);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await page.getByRole('button',{name:'다시 도전',exact:true}).click();const retry=await snap();
 assert.equal(retry.seed,original.seed);assert.deepEqual(retry.flattenedAttackOrder,original.flattenedAttackOrder);assert.equal(retry.results.length,0);
 // Public small-screen presentation, without developer controls.
 await page.goto('http://127.0.0.1:3000/?seed=123');await page.locator('#fast-button').click();
 let elapsed=0;
 for(const a of original.scheduledAttacks) {
   const d=P0_ATTACKS[a.attackId], target=a.attackStartScheduledAtMs+(a.attackIndex===8?d.responseWindowEndMs+10:d.cueAnchorMs+40);
   await page.clock.runFor(target-elapsed);elapsed=target;
   await page.locator('[data-btn="'+(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT')+'"]').click();
 }
 await page.clock.runFor(1000);
 const focus=await page.locator('#rematch-body').boundingBox(), content=await page.locator('.result-content').boundingBox();
 assert.ok(focus&&content&&focus.y+focus.height<=content.y+content.height);
 assert.equal(await page.locator('#result-title').innerText(),'9 / 10 방어 성공');
 await page.screenshot({path:'release/rematch-loop/near-miss-320.png'});
 assert.deepEqual(errors,[]);
 await writeFile('release/rematch-loop/browser.json',JSON.stringify({hitCount:1,target:'9번째 훅',lateMs:10,seedPreserved:retry.seed===original.seed,patternPreserved:true,retryClearsResults:true,bounds,overflow,errors},null,2));console.log('Verified actual one-hit loss, exact late evidence, same-pattern retry, 320px layout.');
} finally { await browser.close(); }
