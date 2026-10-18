import './build-product-qa.mjs';
import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='artifacts/shared-entry-20261017';mkdirSync(out,{recursive:true});
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true}),errors=[],results=[];
try{
 for(const [width,height] of [[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install();await p.clock.pauseAt(new Date());
  for(const [path,source] of [['/shared','shared_result'],['/','direct'],['/__qa_unknown_entry','unknown']]){
   await p.goto(`${origin}${path}?debug=1&qaAds=1&seed=123`,{waitUntil:'networkidle'});await p.clock.fastForward(16);
   await p.evaluate(async()=>{
    const {createAppsAnalyticsAdapter}=await import('/qa-product.js');window.__entryLogs=[];
    const adapter=createAppsAnalyticsAdapter(payload=>{window.__entryLogs.push(payload);return Promise.resolve();},{appVersion:'browser-fixture'});
    window.__p0Preview.runtime.events.subscribe(adapter.record,true);
   });
   await p.locator('#daily-button').click();await p.locator('#records-close-button').click();
   const before=await p.evaluate(()=>window.__p0Preview.runtime.events.snapshot().filter(e=>e.name==='game_start').length);assert.equal(before,0);
   await p.locator('#begin-button').click();await p.clock.fastForward(16);
   // Preview has no native tutorial; isolated tutorial retention is tested in RN.
   let logs=await p.evaluate(()=>window.__entryLogs);
   assert.equal(logs.filter(e=>e.log_name==='boxing_app_open').length,1);
   assert.equal(logs.filter(e=>e.log_name==='boxing_game_start').length,1);
   assert.ok(logs.some(e=>e.log_name==='boxing_landing_view'));
   assert.ok(logs.every(e=>e.params.entry_source===source));
   assert.equal(await p.locator('#punch-count').innerText(),'0 / 30');
   await p.clock.fastForward(20000);assert.equal(await p.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd),1);
   await p.locator('#retry-button').click();await p.clock.fastForward(20000);
   assert.equal(await p.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd),2);
   await p.locator('#retry-button').click();assert.match(await p.locator('#qa-ad').innerText(),/rewarded/);
   await p.locator('#qa-ad-reward').click();await p.locator('#qa-ad-dismiss').click();await p.clock.fastForward(16);
   logs=await p.evaluate(()=>window.__entryLogs);
   assert.equal(logs.filter(e=>e.log_name==='boxing_game_start').length,3);
   assert.equal(logs.filter(e=>e.log_name==='boxing_ad_complete'&&e.params.format==='rewarded').length,1);
   assert.ok(logs.every(e=>e.params.entry_source===source));
   assert.equal(await p.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd),0);
   results.push({width,height,source,actualStarts:3,koFreeRewardLoop:true,recordsReturn:true,mockAnalyticsOnly:true});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/entry-browser.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
