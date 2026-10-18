import './build-product-qa.mjs';
import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=process.env.BOXING_RELEASE_QA_OUTPUT??'artifacts/release-fixes-20261018/browser';mkdirSync(out,{recursive:true});
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),results=[],errors=[];
async function contrast(page){
 const colors=await page.locator('#retry-button').evaluate(el=>({background:getComputedStyle(el).backgroundColor,opacity:getComputedStyle(el).opacity,foreground:[...el.children].map(n=>getComputedStyle(n).color)}));
 const lum=css=>css.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).reduce((s,v,i)=>s+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4),0);
 assert.equal(colors.opacity,'1');const ratios=colors.foreground.map(c=>(lum(c)+.05)/(lum(colors.background)+.05));assert.ok(ratios.every(r=>r>=4.5),JSON.stringify({colors,ratios}));return {colors,ratios};
}
async function clear(p){
 await p.clock.fastForward(16);let elapsed=16*.65;const s=await p.evaluate(()=>window.__p0Preview.snapshot());
 for(const a of s.scheduledAttacks){const t=a.attackStartScheduledAtMs+300;await p.clock.fastForward((t-elapsed)/.65);elapsed=t;await p.locator(`[data-btn="${a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click();}
 await p.clock.fastForward(1400/.65);assert.match(await p.locator('#result-caption').innerText(),/완주/);
}
try{
 for(const [width,height] of [[320,568],[375,667],[390,844]])for(const mockAds of [true,false]){
  const context=await browser.newContext({viewport:{width,height}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install();await p.clock.pauseAt(new Date());await p.goto(`http://127.0.0.1:${server.address().port}/?debug=1&seed=123${mockAds?'&qaAds=1':''}`,{waitUntil:'networkidle'});
  await p.clock.fastForward(16);await p.locator('#begin-button').click();await p.clock.fastForward(20000);
  const normal=await contrast(p),retry=p.locator('#retry-button');
  const bounds=await retry.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height,'primary retry visible');
  // Explicit CSS disabled fixture, not a simulated native ad failure.
  await retry.evaluate(el=>el.disabled=true);const disabled=await contrast(p);await retry.evaluate(el=>el.disabled=false);
  await p.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await p.mouse.down();const pressed=await contrast(p);await p.mouse.up();await clear(p);
  const note=p.locator('#promote-ad-disclosure'),next=p.locator('#promote-button');assert.equal(await note.isVisible(),mockAds);
  if(mockAds){
   assert.equal(await note.innerText(),'이동할 때 광고가 표시될 수 있어요.');await note.scrollIntoViewIfNeeded();
   await next.click({trial:true});const n=await note.boundingBox(),b=await next.boundingBox();assert.ok(n.y>=0&&n.y+n.height<=b.y&&b.y+b.height<=height,'disclosure visible before stage tap');
   assert.equal(await next.getAttribute('aria-describedby'),'promote-ad-disclosure');
  }
  await p.screenshot({path:`${out}/clear-${mockAds?'mock-ad':'no-ad'}-${width}.png`});
  await next.click();assert.equal(await p.locator('#qa-ad').count(),mockAds?1:0);
  if(mockAds)await p.locator('#qa-ad-dismiss').click();await p.clock.fastForward(16);assert.equal(await p.locator('#punch-count').innerText(),'0 / 30');
  if(!mockAds){
   await p.clock.fastForward(20000);await retry.click();assert.match(await p.locator('#retry-note').innerText(),/현재 이 환경에서는 광고를 이용할 수 없어요/);
   assert.doesNotMatch(await p.locator('#retry-note').innerText(),/QR|qaAds/);assert.equal(await p.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd),2);
   await p.locator('#mode-button').click();assert.equal(await p.locator('#begin-button').isVisible(),true);
  }
  results.push({width,height,mockAds,normal,disabledCssFixture:disabled,pressed,preTapDisclosure:true,existingStagePath:true});await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/release-fixes-browser.json`,JSON.stringify({results,errors,nativeAccessibilityTested:false},null,2));console.log(JSON.stringify({cases:results.length,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
