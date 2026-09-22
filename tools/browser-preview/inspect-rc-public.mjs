import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { P0TenPunchSession } from '../../.preview-dist/app/session/P0TenPunchSession.js';
import { P0_ATTACKS } from '../../.preview-dist/game/config/p0Attacks.js';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const ids={LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage();await page.clock.install();await page.clock.pauseAt(new Date());
for(const width of [320,390]){
 await page.setViewportSize({width,height:width===320?568:844});await page.goto('http://127.0.0.1:3001/?seed=123');await page.locator('#fast-button').click();
 const s=new P0TenPunchSession({nowMs:()=>0},ids,{seed:123,ruleset:'candidate'});s.start({leadInMs:2000});let elapsed=0;
 for(const a of s.snapshot().scheduledAttacks){const d=P0_ATTACKS[a.attackId];const t=a.attackStartScheduledAtMs+(a.attackIndex===9?d.responseWindowEndMs+1:300);await page.clock.runFor(t-elapsed);elapsed=t;await page.locator(`[data-btn="${a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click();if(a.attackIndex===0)await page.screenshot({path:`release/rc/public-play-${width}.png`});}
 await page.clock.runFor(1000);await page.screenshot({path:`release/rc/public-result-${width}.png`});
 const focus=await page.locator('#rematch-body').boundingBox(),content=await page.locator('.result-content').boundingBox();assert.ok(focus.y+focus.height<=content.y+content.height,'miss explanation must fit without scrolling');
 await page.locator('#retry-button').click();await page.clock.runFor(820);assert.equal(await page.locator('#punch-count').innerText(),'0 / 10');
}
let stats={rounds:0,clears:0,highestDefended:0,totalDefended:0};
for(let seed=0;seed<90;seed++)for(const step of [20,50,90,140]){let now=0,state=seed+1;const s=new P0TenPunchSession({nowMs:()=>now},ids,{seed,ruleset:'candidate'});s.start();for(now=0;now<20000;now+=step){if(s.tick().sessionCompleted)break;state=(Math.imul(state,1664525)+1013904223)>>>0;s.handleInput(['LEFT','RIGHT','BACK','GUARD'][(state>>>16)%4]);}now=30000;const out=s.tick(),defended=out.results.filter(r=>r.outcome!=='HIT').length;stats.rounds++;stats.totalDefended+=defended;stats.highestDefended=Math.max(stats.highestDefended,defended);if(defended===10)stats.clears++;}
assert.ok(stats.totalDefended / stats.rounds < 7);stats.meanDefended=stats.totalDefended/stats.rounds;await writeFile('release/rc/spam-results.json',JSON.stringify(stats,null,2));console.log(stats);
}finally{await browser.close();}
