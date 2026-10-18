import './build-product-qa.mjs';
import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='artifacts/viral-20261017';mkdirSync(out,{recursive:true});
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const results=[],errors=[];
const ko=n=>({level:1,cleared:false,resolved:n+1,survived:n,lives:0,perfect:n-4,streak:n-4,reactionMs:200,at:1});
const eventCount=(p,name)=>p.evaluate(name=>window.__p0Preview.runtime.events.snapshot().filter(e=>e.name===name).length,name);
const count=p=>p.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd);
try{
 for(const [width,height] of [[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  const time=new Date('2026-10-16T12:00:00Z');await p.clock.install({time});await p.clock.pauseAt(time);
  await p.goto(`http://127.0.0.1:${server.address().port}/?debug=1&qaAds=1&qaShare=1&seed=123`,{waitUntil:'networkidle'});
  await p.evaluate(value=>localStorage.setItem('boxing-survival-v1',JSON.stringify(value)),{version:1,unlocked:1,best:{1:ko(20)},bestStreak:{1:16},recentByDifficulty:{1:ko(8)}});
  await p.reload({waitUntil:'networkidle'});await p.clock.fastForward(16);await p.locator('#begin-button').click();await p.clock.fastForward(16);
  const snapshot=await p.evaluate(()=>window.__p0Preview.snapshot());let elapsed=16*.65;
  for(const attack of snapshot.scheduledAttacks.slice(0,8)){
   const target=attack.attackStartScheduledAtMs+300;await p.clock.fastForward((target-elapsed)/.65);elapsed=target;
   await p.locator(`[data-btn="${attack.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click();
  }
  await p.clock.fastForward(16000);assert.match(await p.locator('#result-title').innerText(),/12 \/ 30/);
  const stored=await p.evaluate(()=>localStorage.getItem('boxing-survival-v1'));
  for(const selector of ['#result-title','#coach-result','#retry-button','#share-result-button']){const b=await p.locator(selector).boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=height);}
  await p.screenshot({path:`${out}/share-result-${width}.png`});
  await p.locator('#share-result-button').click();await p.evaluate(()=>document.getElementById('share-result-button').click());
  await p.locator('#qa-share').waitFor();assert.equal(await p.locator('#qa-share').count(),1);assert.equal(await eventCount(p,'share_tap'),1);
  const text=await p.locator('#qa-share-text').innerText();assert.match(text,/12 \/ 30/);assert.match(text,/4회 더/);assert.doesNotMatch(text,/seed|roundId|runtimeId|새로운 개인 최고|\p{Extended_Pictographic}/u);
  await p.locator('#qa-share-cancel').click();await p.waitForFunction(()=>!document.getElementById('share-result-button').disabled);
  assert.equal(await count(p),1);assert.equal(await eventCount(p,'game_start'),1);assert.equal(await p.evaluate(()=>localStorage.getItem('boxing-survival-v1')),stored);
  assert.equal(await p.evaluate(()=>window.__p0Preview.runtime.events.snapshot().filter(e=>e.name==='share_outcome').at(-1).data.outcome),'cancelled');
  await p.locator('#share-result-button').click();await p.locator('#qa-share-complete').click();await p.waitForFunction(()=>!document.getElementById('share-result-button').disabled);
  assert.equal(await count(p),1);assert.equal(await eventCount(p,'game_start'),1);
  await p.locator('#retry-button').click();await p.clock.fastForward(20000);assert.equal(await count(p),2);
  await p.locator('#share-result-button').click();await p.locator('#qa-share-fail').click();await p.waitForFunction(()=>!document.getElementById('share-result-button').disabled);
  assert.match(await p.locator('#share-note').innerText(),/열지 못했어요/);assert.equal(await count(p),2);assert.match(await p.locator('#retry-label').innerText(),/광고/);
  await p.locator('#retry-button').click();await p.locator('#qa-ad-reward').click();await p.locator('#qa-ad-dismiss').click();await p.clock.fastForward(16);
  assert.equal(await p.locator('#punch-count').innerText(),'0 / 30');assert.equal(await count(p),0);assert.equal(await eventCount(p,'game_start'),3);
  results.push({width,height,mockOnly:true,privateDataExcluded:true,actualImprovement:true,duplicatePrevented:true,cancelPreserves:true,errorPreserves:true,retryPrimary:true,adLoopPreserved:true});await p.clock.fastForward(20000);assert.equal(await count(p),1);
  // Presentation fixtures exercise every requested result without pretending to be saved games.
  for(const [name,current,previous,best] of [
   ['first',ko(4),null,null],['improved',ko(14),ko(8),ko(20)],['declined',ko(12),ko(17),ko(20)],
   ['best',ko(18),ko(14),ko(17)],
   ['clear',{...ko(29),resolved:30,survived:30,cleared:true,lives:3,perfect:12,streak:3},ko(24),null],
   ['clear-best',{...ko(29),resolved:30,survived:30,cleared:true,lives:3,perfect:12,streak:3},null,{...ko(29),resolved:30,survived:30,cleared:true,lives:3,perfect:10,streak:3}],
  ]){
   const evidence=await p.evaluate(async({current,previous,best})=>{
    const {renderViralResult}=await import('/viral-result-preview.mjs');
    const {buildRecentComparison}=await import('/.preview-dist/app/product/recentComparison.js');
    const {buildShareResult}=await import('/.preview-dist/app/sharing/shareResult.js');
    const input={record:current,previousBest:best??undefined,comparison:buildRecentComparison(previous??undefined,current),results:[]};
    renderViralResult(input);document.getElementById('result-card').classList.add('visible');document.querySelector('.result-content').scrollTop=0;
    return {text:buildShareResult(input).text,score:document.getElementById('result-title').textContent,coach:document.getElementById('coach-result').textContent,best:document.getElementById('record-title').textContent,comparison:document.getElementById('recent-comparison').textContent};
   },{current,previous,best});
   assert.ok(evidence.text.includes(evidence.score));
   if(name==='first')assert.doesNotMatch(evidence.text,/최고/);
   if(name==='improved'){assert.match(evidence.comparison,/\+6/);assert.match(evidence.text,/6회 더/);}
   if(name==='declined'){assert.match(evidence.comparison,/−5/);assert.doesNotMatch(evidence.text,/더 버텼/);}
   if(name.startsWith('clear'))assert.match(evidence.text,/30 \/ 30 완주/);
   for(const selector of ['#result-title','#coach-result','#retry-button']){const b=await p.locator(selector).boundingBox();const viewport=await p.locator('.result-content').boundingBox();assert.ok(b&&viewport&&b.y>=viewport.y&&b.y+b.height<=viewport.y+viewport.height,`${name} ${width} ${selector} visible inside scroll viewport`);}
   await p.screenshot({path:`${out}/viral-${name}-${width}.png`});
   await p.locator('#share-result-button').click({trial:true});
   await p.locator('#result-details > summary').click();assert.ok(await p.locator('#result-list').isVisible());
   await p.locator('#result-details > summary').click();assert.equal(await p.locator('#result-list').isVisible(),false);
   results.push({width,height,fixture:name,scoreAndShareAgree:true,retryInitiallyVisible:true,shareAccessible:true,detailsClickable:true,evidence});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/viral-browser.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
