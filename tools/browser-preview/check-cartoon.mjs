import {chromium} from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {P0TenPunchSession} from '../../.preview-dist/app/session/P0TenPunchSession.js';
import {P0_ATTACKS} from '../../.preview-dist/game/config/p0Attacks.js';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const ids={LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'};
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],results=[];
try{
for(const width of [390,320]){
 const height=width===390?844:568,p=await browser.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await p.clock.install();await p.clock.pauseAt(new Date());await p.goto('http://127.0.0.1:3000/?seed=123',{waitUntil:'networkidle'});await p.clock.runFor(16);
 await p.screenshot({path:`art-direction/checks/intro-${width}.png`});
 await p.locator('#fast-button').click();await p.clock.runFor(2220);await p.screenshot({path:`art-direction/checks/ready-${width}.png`});
 const controls=await p.locator('.controls').boundingBox();assert.ok(controls.y+controls.height<=height,'controls fit');
 await p.locator('#pause-button').click();await p.clock.runFor(500);assert.equal(await p.locator('#pause-card').isVisible(),true);await p.locator('#resume-button').click();await p.clock.runFor(280);await p.screenshot({path:`art-direction/checks/jab-${width}.png`});
 await p.clock.runFor(18000);assert.match(await p.locator('#result-title').innerText(),/0 \/ 10/);await p.screenshot({path:`art-direction/checks/failure-${width}.png`});
 await p.locator('#retry-button').click();await p.clock.runFor(16);assert.equal(await p.locator('#punch-count').innerText(),'0 / 10');
 const s=new P0TenPunchSession({nowMs:()=>0},ids,{seed:123,ruleset:'candidate'});s.start({leadInMs:800});let elapsed=16;
 for(const a of s.snapshot().scheduledAttacks){const t=a.attackStartScheduledAtMs+300;await p.clock.runFor(t-elapsed);elapsed=t;await p.locator(`[data-btn="${a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click();}
 await p.clock.runFor(1000);assert.match(await p.locator('#result-title').innerText(),/10 \/ 10/);await p.screenshot({path:`art-direction/checks/success-${width}.png`});
 results.push({width,height,controlsFit:true,noInputHits:10,perfectDefenses:10,retry:true,pauseResume:true});await p.close();
}
assert.deepEqual(errors,[]);await writeFile('art-direction/checks/browser.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
