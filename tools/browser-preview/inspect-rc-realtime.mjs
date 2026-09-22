import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(()=>{window.__audioEvents=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const at=performance.now();const source=this.src;return play.call(this).then(()=>window.__audioEvents.push({source,at,ok:true}),e=>window.__audioEvents.push({source,at,ok:false,error:e.name}));};});
 await page.goto('http://127.0.0.1:3001/?debug=1&seed=123');await page.waitForFunction(()=>window.__p0Preview);await page.locator('#fast-button').click();
 await page.evaluate(()=>{const api=window.__p0Preview;const now=api.snapshot().nowMs;for(const a of api.snapshot().scheduledAttacks)setTimeout(()=>document.querySelector(`[data-btn="${a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click(),Math.max(0,a.attackStartScheduledAtMs+300-now));window.__frames=[];let previous=performance.now();const observe=t=>{window.__frames.push(t-previous);previous=t;if(!api.snapshot().sessionCompleted)requestAnimationFrame(observe);};requestAnimationFrame(observe);});
 await page.locator('#result-card.visible').waitFor({timeout:25000});
 const report=await page.evaluate(()=>({outcomes:window.__p0Preview.snapshot().results.map(r=>r.outcome),frames:window.__frames.length,maxFrameGapMs:Math.max(...window.__frames.slice(1)),audio:window.__audioEvents}));
 assert.equal(report.outcomes.filter(o=>o==='PERFECT').length,10);assert.ok(report.frames>300);assert.equal(report.audio.filter(a=>a.ok).length,11);
 await page.screenshot({path:'release/rc/realtime-victory.png'});await writeFile('release/rc/realtime.json',JSON.stringify(report,null,2));console.log(JSON.stringify({outcomes:report.outcomes,frames:report.frames,maxFrameGapMs:report.maxFrameGapMs,successfulAudio:report.audio.filter(a=>a.ok).length}));
}finally{await browser.close();}
