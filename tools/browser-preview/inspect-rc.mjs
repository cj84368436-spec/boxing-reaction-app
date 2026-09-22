import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { P0_ATTACKS } from '../../.preview-dist/game/config/p0Attacks.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],report={strategies:{},errors};
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.clock.pauseAt(new Date());
 async function load(width=390,height=844){await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:3001/?debug=1&seed=123');await page.waitForFunction(()=>window.__p0Preview);}
 const snap=()=>page.evaluate(()=>window.__p0Preview.snapshot());
 async function advance(t){const now=(await snap()).nowMs;if(t>now)await page.clock.runFor(t-now);}
 async function play(strategy,lateIndex=-1){const first=await snap();for(const a of first.scheduledAttacks){const def=P0_ATTACKS[a.attackId];await advance(a.attackStartScheduledAtMs+(a.attackIndex===lateIndex?def.responseWindowEndMs+1:300));if(strategy!=='NONE')await page.locator(`[data-btn="${strategy==='READ'?(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'):strategy}"]`).click();}await page.clock.runFor(1000);return snap();}
 await load();await page.screenshot({path:'release/rc/after-start-390.png'});
 for(const strategy of ['GUARD','BACK','LEFT','RIGHT','NONE','READ']){
  await load();await page.locator('#fast-button').click();const result=await play(strategy);
  const hits=result.results.filter(r=>r.outcome==='HIT').length;report.strategies[strategy]={hits,guard:result.guardEnergy};assert.equal(result.results.length,10);assert.equal(hits===0,strategy==='READ');
  await page.screenshot({path:`release/rc/after-${strategy}.png`});
  if(strategy==='READ')assert.match(await page.locator('#rematch-title').innerText(),/인정 도장/);
  const old=result.flattenedAttackOrder.join(',');await page.locator('#retry-button').click();const retry=await snap();assert.equal(retry.results.length,0);assert.equal(retry.guardEnergy,2);if(hits)assert.equal(retry.flattenedAttackOrder.join(','),old);else assert.notEqual(retry.flattenedAttackOrder.join(','),old);
 }
 await load();await page.locator('#fast-button').click();await advance(2200);await page.locator('#pause-button').click();const paused=await snap();await page.clock.runFor(4000);assert.equal((await snap()).nowMs,paused.nowMs);await page.locator('#resume-button').click();await page.clock.runFor(32);assert.ok((await snap()).nowMs>paused.nowMs);report.pauseResume=true;
 // Full preparation -> extension -> contact -> recovery, actual rendered stage at 80ms intervals.
 await load();await page.locator('#fast-button').click();const schedule=(await snap()).scheduledAttacks;const sheets=[];
 for(const a of schedule.slice(0,3)){
  const frames=[];const impact=P0_ATTACKS[a.attackId].impactMs;
  for(const elapsed of [0,80,160,240,320,400,impact-16,impact+16,impact+96,impact+176,impact+256,impact+336].sort((a,b)=>a-b)){
   await advance(a.attackStartScheduledAtMs+elapsed);
   const buffer=await page.locator('#stage').screenshot();frames.push({elapsed,b64:buffer.toString('base64')});
   if(elapsed===impact+16){assert.equal((await snap()).results.length,a.attackIndex+1);assert.equal(await page.locator('#stage').evaluate(e=>e.classList.contains('hit')),true);}
  }
  sheets.push({id:a.attackId,frames});
 }
 const sheetPage=await browser.newPage({viewport:{width:1120,height:1430}});
 for(const sheet of sheets){await sheetPage.setContent(`<body style="margin:0;background:#07111b;color:white;font:14px sans-serif"><h2>${sheet.id}: 준비 → 접촉 → 복귀</h2><div style="display:grid;grid-template-columns:repeat(4,280px)">${sheet.frames.map(f=>`<div><div>${f.elapsed} ms</div><img width="280" height="420" style="object-fit:contain" src="data:image/png;base64,${f.b64}"></div>`).join('')}</div></body>`);await sheetPage.screenshot({path:`release/rc/motion-${sheet.id}.png`});}await sheetPage.close();report.motionFrames=36;
 for(const size of [[320,568],[390,844]]){
  await load(...size);await page.screenshot({path:`release/rc/intro-${size[0]}.png`});await page.locator('#fast-button').click();await advance(2300);
  const controls=await page.locator('.controls').boundingBox();assert.ok(controls.y+controls.height<=size[1]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`release/rc/play-${size[0]}.png`});
  const result=await play('READ',9);assert.equal(result.results.filter(r=>r.outcome==='HIT').length,1);assert.match(await page.locator('#rematch-body').innerText(),/0.001초/);
  await page.screenshot({path:`release/rc/result-${size[0]}.png`});const retry=await page.locator('#retry-button').boundingBox();assert.ok(retry.y+retry.height<=size[1]&&retry.height>=44);
 }
 // Pointer held: exactly one maneuver; keyboard repeats likewise do not auto-defend.
 await load();await page.locator('#fast-button').click();await advance(2300);const b=await page.locator('[data-btn="LEFT"]').boundingBox();await page.mouse.move(b.x+20,b.y+20);await page.mouse.down();await page.clock.runFor(20000);await page.mouse.up();assert.equal((await snap()).results.filter(r=>r.outcome!=='HIT').length,1);report.heldPress=true;
 await load();await page.locator('#fast-button').click();await advance(2300);await page.evaluate(()=>{document.querySelector('[data-btn="LEFT"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));document.querySelector('[data-btn="RIGHT"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));});await advance(2500);assert.equal((await snap()).results[0].telemetry.inputStatus,'MULTI_INPUT');report.simultaneous=true;
 assert.deepEqual(errors,[]);await writeFile('release/rc/browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
