import {chromium} from './qa-runtime.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';
const b=await chromium.launch({headless:true});const errors=[],results=[];
try{for(const width of [390,320]){
 const p=await b.newPage({viewport:{width,height:width===390?844:568}});p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await p.addInitScript(()=>{window.audioPlays=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.audioPlays.push(this.src);return original.call(this);};});
 await p.clock.install();await p.clock.pauseAt(new Date());await p.goto('http://127.0.0.1:3000/?seed=123&debug=1',{waitUntil:'networkidle'});await p.clock.runFor(16);
 const decoded=await p.evaluate(async()=>{const context=new AudioContext();const data=await context.decodeAudioData(await(await fetch('/src/app/assets/sfx/knockout.wav')).arrayBuffer());const duration=data.duration;await context.close();return duration;});assert.ok(Math.abs(decoded-2.2)<.01);
 await p.locator('#fast-button').click();await p.clock.runFor(18000);
 assert.match(await p.locator('#result-title').innerText(),/다운/);assert.equal(await p.locator('#punch-count').innerText(),'5 / 10');assert.match(await p.locator('#lives').innerText(),/0 \/ 5/);
 assert.equal(await p.locator('#lives').isVisible(),true);
 const first=await p.locator('#coach-result .coach-line').innerText();assert.equal(await p.locator('.result-row').count(),5);
 const bells=()=>p.evaluate(()=>window.audioPlays.filter(x=>x.endsWith('/knockout.wav')).length);assert.equal(await bells(),1);
 await p.clock.runFor(5000);assert.equal(await bells(),1);await p.screenshot({path:'artifacts/cloud-qa/knockout-'+width+'.png'});
 await p.locator('#retry-button').click();await p.clock.runFor(16);assert.match(await p.locator('#lives').innerText(),/5 \/ 5/);await p.clock.runFor(18000);const second=await p.locator('#coach-result .coach-line').innerText();assert.notEqual(first,second);assert.equal(await bells(),2);
 await p.locator('#retry-button').click();await p.locator('#sound-button').click();await p.clock.runFor(18000);assert.equal(await bells(),2);await p.locator('#sound-button').click();await p.clock.runFor(1000);assert.equal(await bells(),2);
 await p.locator('#retry-button').click();await p.clock.runFor(16);const schedule=await p.evaluate(()=>window.__p0Preview.snapshot().scheduledAttacks);let elapsed=16;
 for(const a of schedule){const t=a.attackStartScheduledAtMs+300;await p.clock.runFor(t-elapsed);elapsed=t;await p.locator('[data-btn="'+(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT')+'"]').click();}
 await p.clock.runFor(1000);assert.match(await p.locator('#result-title').innerText(),/10 \/ 10 방어 성공/);assert.equal(await bells(),2);assert.match(await p.locator('#lives').innerText(),/5 \/ 5/);
 const retry=await p.locator('#retry-button').boundingBox();assert.ok(retry.y+retry.height<=(width===390?844:568));results.push({width,first,second,bellPlays:2,decodedSeconds:decoded,mutedNoReplay:true,successNoKnockout:true});await p.close();
}assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/cloud-qa/knockout-browser.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));}finally{await b.close();}
