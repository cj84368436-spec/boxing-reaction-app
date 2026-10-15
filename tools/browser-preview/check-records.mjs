import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';import {mkdtemp,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
const directory=await mkdtemp(path.join(tmpdir(),'boxing-records-qa-'));const server=createPreviewServer({rankingFile:path.join(directory,'records.json')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});const errors=[],results=[];
try{
 for(const width of [390,320]){
  const p=await browser.newPage({viewport:{width,height:width===320?568:844}});p.on('pageerror',e=>errors.push(e.message));let starts=0;p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/challenge'))starts++;});
  let release;const loading=new Promise(r=>release=r);await p.route('**/src/game/assets/motion/lead-jab.json',async route=>{await loading;await route.continue();});
  await p.goto(origin+'/?seed=123&debug=1',{waitUntil:'domcontentloaded'});
  assert.equal(await p.locator('#begin-button').isDisabled(),true);assert.equal(await p.locator('#daily-button').isDisabled(),true);release();await p.waitForFunction(()=>!!window.__p0Preview);
  const before=await p.evaluate(()=>window.__p0Preview.snapshot());
  await p.locator('#daily-button').click();await p.waitForFunction(()=>!document.querySelector('#records-standing').textContent.includes('불러오는 중'));
  assert.equal(starts,0);assert.equal(await p.locator('#records-card').isVisible(),true);assert.equal((await p.evaluate(()=>window.__p0Preview.snapshot())).sessionStartedAtMs,before.sessionStartedAtMs);
  assert.match(await p.locator('#records-list').innerText(),/입문/);assert.match(await p.locator('#records-list').innerText(),/챔피언/);
  const action=await p.locator('#records-close-button').boundingBox();assert.ok(action.y+action.height<=(width===320?568:844));
  await p.screenshot({path:'artifacts/cloud-qa/records-'+width+'.png'});
  await p.locator('#records-close-button').click();assert.equal(await p.locator('#intro-card').isVisible(),true);
  // A late daily-start response must not restart the game after closing records.
  let respond;const responseGate=new Promise(r=>respond=r);await p.route('**/api/challenge',async route=>{await responseGate;await route.fulfill({json:{id:'qa',seed:123,level:2,day:'2026-09-20',leadInMs:2000}});});
  await p.locator('#daily-button').click();await p.locator('#daily-start-button').click();await p.locator('#records-close-button').click();respond();await p.waitForFunction(()=>!document.querySelector('#begin-button').disabled);
  assert.equal(await p.locator('#intro-card').isVisible(),true);assert.equal((await p.evaluate(()=>window.__p0Preview.snapshot())).sessionStartedAtMs,before.sessionStartedAtMs);
  await p.unroute('**/api/challenge');await p.locator('#daily-button').click();await p.locator('#daily-start-button').click();await p.waitForFunction(()=>document.querySelector('#intro-card').hidden&&document.querySelector('#records-card').hidden);
  assert.notEqual((await p.evaluate(()=>window.__p0Preview.snapshot())).sessionStartedAtMs,undefined);
  results.push({width,readDoesNotStart:true,loadingGuard:true,lateStartIgnored:true,explicitStart:true});await p.close();
 }
 assert.deepEqual(errors,[]);await writeFile('artifacts/cloud-qa/records-browser.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
