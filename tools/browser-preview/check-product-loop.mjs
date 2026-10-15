import './build-product-qa.mjs';
import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const errors=[],results=[];
async function advance(page,ms){await page.clock.fastForward(ms);}
async function count(page){return page.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd);}
async function clear(page,rate){
 await advance(page,16);const s=await page.evaluate(()=>window.__p0Preview.snapshot());let elapsed=16*rate;
 for(const a of s.scheduledAttacks){const t=a.attackStartScheduledAtMs+300;await advance(page,(t-elapsed)/rate);elapsed=t;await page.locator('[data-btn="'+(a.attackId==='LEAD_UPPERCUT_HEAD'?'BACK':a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT')+'"]').click();}
 await advance(page,1400/rate);assert.match(await page.locator('#result-title').innerText(),/클리어/);
}
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:width===320?568:844}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install();await p.clock.pauseAt(new Date());await p.goto('http://127.0.0.1:'+server.address().port+'/?debug=1&qaAds=1&seed=123',{waitUntil:'networkidle'});await advance(p,16);
  await p.locator('#begin-button').click();await advance(p,20000);
  assert.equal(await count(p),1);assert.equal(await p.locator('#retry-label').innerText(),'다시 도전');
  assert.equal(await p.locator('#record-title').innerText(),'첫 기록을 남겼어요');assert.equal(await p.locator('#nearby-goal').innerText(),'다음 목표: 5번째 공격까지 버티기');
  assert.equal(await p.locator('#result-list').isVisible(),false);
  await p.screenshot({path:`artifacts/cloud-qa/product-first-ko-${width}.png`});
  await p.locator('#retry-button').click();await clear(p,.65);assert.equal(await count(p),1);
  await p.locator('#retry-button').click();assert.equal(await p.locator('#qa-ad').count(),0);await clear(p,.65);
  await p.locator('#promote-button').click();assert.match(await p.locator('#qa-ad').innerText(),/interstitial/);
  await p.locator('#qa-ad-dismiss').click();await advance(p,20000);assert.equal(await count(p),2);
  await p.locator('#retry-button').click();assert.match(await p.locator('#qa-ad').innerText(),/rewarded/);
  await p.locator('#qa-ad-fail').click();assert.equal(await count(p),2);
  await p.locator('#retry-button').click();await p.waitForFunction(()=>document.getElementById('retry-label').textContent==='광고 보고 다시 도전');
  await p.locator('#retry-button').click();await p.screenshot({path:`artifacts/cloud-qa/product-mock-ad-${width}.png`});
  await p.locator('#qa-ad-reward').click();assert.equal(await count(p),2);
  const gamesBefore=await p.evaluate(()=>window.__p0Preview.runtime.events.snapshot().filter(e=>e.name==='game_start').length);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));});
  await p.locator('#qa-ad-dismiss').click();assert.equal(await count(p),0);await advance(p,20000);
  assert.equal(await p.evaluate(()=>window.__p0Preview.runtime.events.snapshot().filter(e=>e.name==='game_start').length),gamesBefore);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));});
  await advance(p,16);assert.equal(await p.locator('#punch-count').innerText(),'0 / 30');
  await advance(p,20000);assert.equal(await count(p),1);assert.equal(await p.locator('#retry-label').innerText(),'다시 도전');
  await p.locator('#mode-button').click();await p.locator('#daily-button').click();assert.equal(await count(p),1);await p.screenshot({path:`artifacts/cloud-qa/product-records-${width}.png`});
  const events=await p.evaluate(()=>window.__p0Preview.runtime.events.snapshot());assert.equal(events.filter(e=>e.name==='ad_complete'&&e.data.format==='rewarded').length,1);
  results.push({width,firstFree:true,clearDoesNotCount:true,sameLevelFree:true,nextLevelInterstitial:true,failedAdRetainsTwo:true,rewardAndDismiss:true,backgroundDefersStart:true,homeRecordsKeepCounter:true,events});
  await p.reload({waitUntil:'networkidle'});assert.equal(await count(p),0);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/cloud-qa/product-loop.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({widths:results.map(r=>r.width),scenarios:results.map(({events,...rest})=>rest),errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
