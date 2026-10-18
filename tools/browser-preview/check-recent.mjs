import './build-product-qa.mjs';
import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Local browser fixtures exercise presentation. Preview games must never overwrite recent.
const output=resolve(process.env.BOXING_RECENT_QA_OUTPUT??'artifacts/recent-20261016');
mkdirSync(output,{recursive:true});
const ko=survived=>({level:1,cleared:false,resolved:survived+1,survived,lives:0,perfect:survived-4,streak:survived-4,reactionMs:277,at:1});
const legacy={version:1,unlocked:1,best:{1:ko(20)},bestStreak:{1:16}};
const fixture={...legacy,recentByDifficulty:{1:ko(8)}};
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});const results=[],errors=[];
async function finish12(page){
 await page.clock.fastForward(16);
 const s=await page.evaluate(()=>window.__p0Preview.snapshot());let elapsed=16*.65;
 for(const a of s.scheduledAttacks.slice(0,8)){
  const target=a.attackStartScheduledAtMs+300;
  await page.clock.fastForward((target-elapsed)/.65);elapsed=target;
  await page.locator(`[data-btn="${a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click();
 }
 await page.clock.fastForward(16000);
 assert.match(await page.locator('#result-title').innerText(),/12 \/ 30/);
}
try{
 for(const [width,height] of [[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const time=new Date('2026-10-16T12:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
  await page.goto(origin+'/?debug=1&qaAds=1&seed=123',{waitUntil:'networkidle'});
  await page.evaluate(value=>localStorage.setItem('boxing-survival-v1',JSON.stringify(value)),fixture);
  await page.reload({waitUntil:'networkidle'});await page.clock.fastForward(16);
  await page.locator('#begin-button').click();await finish12(page);
  const comparison=page.locator('#recent-comparison');await comparison.scrollIntoViewIfNeeded();
  assert.match(await comparison.innerText(),/지난 경기 8 \/ 30[\s\S]*4회 더/);
  await page.locator('#result-details summary').click();
  for(const selector of ['#nearby-goal','#result-strength','#result-weakness']){
   const item=page.locator(selector);assert.notEqual(await item.innerText(),'');await item.scrollIntoViewIfNeeded();
   const rect=await item.boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=height);
  }
  assert.equal(await page.locator('#result-list').isVisible(),true);
  await page.locator('#result-details summary').click();assert.equal(await page.locator('#result-list').isVisible(),false);
  await comparison.scrollIntoViewIfNeeded();
  const cta=await page.locator('#retry-button').boundingBox();assert.ok(cta&&cta.y>=0&&cta.y+cta.height<=height);
  await page.screenshot({path:resolve(output,`recent-result-${width}.png`)});
  let events=await page.evaluate(()=>window.__p0Preview.runtime.events.snapshot());
  const result=events.find(e=>e.name==='result_view');assert.equal(result.data.has_recent_comparison,true);assert.equal(result.data.comparison,'improved');
  await page.locator('#retry-button').click();await page.clock.fastForward(16);
  assert.equal(await page.locator('#punch-count').innerText(),'0 / 30');
  events=await page.evaluate(()=>window.__p0Preview.runtime.events.snapshot());
  assert.equal(events.filter(e=>e.name==='retry_game_start').length,1);
  assert.equal(events.find(e=>e.name==='retry_game_start').data.previousRoundId,result.data.roundId);
  await page.clock.fastForward(20000);assert.equal(await page.locator('#retry-label').innerText(),'광고 보고 다시 도전');
  await page.locator('#retry-button').click();assert.match(await page.locator('#qa-ad').innerText(),/rewarded/);
  await page.locator('#qa-ad-reward').click();await page.locator('#qa-ad-dismiss').click();await page.clock.fastForward(16);
  assert.equal(await page.locator('#punch-count').innerText(),'0 / 30');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('boxing-survival-v1')));
  assert.deepEqual(stored.recentByDifficulty,fixture.recentByDifficulty);assert.equal(stored.best[1].survived,20);
  // Reload restores the real recent fixture; browser simulation did not replace it.
  await page.reload({waitUntil:'networkidle'});await page.clock.fastForward(16);await page.locator('#daily-button').click();
  assert.match(await page.locator('#records-list').innerText(),/개인 최고.*최고 생존 20\/30/);
  assert.match(await page.locator('[data-recent-level="1"]').innerText(),/최근 · 생존 8 \/ 30/);
  await page.locator('[data-recent-level="3"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,`recent-records-${width}.png`)});
  await page.locator('#records-close-button').click();assert.equal(await page.locator('#intro-card').isVisible(),true);
  await page.evaluate(value=>localStorage.setItem('boxing-survival-v1',JSON.stringify(value)),legacy);
  await page.reload({waitUntil:'networkidle'});await page.clock.fastForward(16);await page.locator('#begin-button').click();await page.clock.fastForward(20000);
  assert.equal(await comparison.isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('boxing-survival-v1')).recentByDifficulty),undefined);
  results.push({width,height,comparison:true,detailsToggle:true,freeRetry:true,rewardedRetry:true,records:true,legacyWithoutRecent:true,previewExcluded:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'recent-browser.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
