import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { buildBoxerArtwork } from '../../.preview-dist/app/motion/boxingArtwork.js';
import { projectCombatPose } from '../../.preview-dist/app/motion/firstPersonPresentation.js';
import { P0TenPunchSession } from '../../.preview-dist/app/session/P0TenPunchSession.js';
import { P0_ATTACKS } from '../../.preview-dist/game/config/p0Attacks.js';
const require=createRequire(import.meta.url), sharp=require('C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out='release/adversarial-2026-09-15'; await mkdir(out,{recursive:true});
const sources={LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'};
const audit=[];
for(const input of ['GUARD','BACK','RIGHT']) for(const interval of [50,100,200,400]) {
  const counts={PERFECT:0,SAFE:0,HIT:0}; let flawless=0;
  for(let seed=0;seed<20;seed++) {
    let now=0; const s=new P0TenPunchSession({nowMs:()=>now},sources,{seed});s.start({leadInMs:2000});
    for(now=0;now<=22000;now+=10) {if(s.tick().sessionCompleted)break;if(now%interval===0)s.handleInput(input);}
    assert.equal(s.snapshot().results.length,10);
    for(const r of s.snapshot().results)counts[r.outcome]++;
    if(s.snapshot().results.every(r=>r.outcome!=='HIT'))flawless++;
  }
  audit.push({input,interval,counts,flawless});
}
function xml(n){const attrs=Object.entries(n.attrs).filter(([k])=>k!=='testID').map(([k,v])=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+v+'"').join(' ');return '<'+n.tag+' '+attrs+'>'+ (n.children??[]).map(xml).join('')+'</'+n.tag+'>';}
const tiles=[]; let col=0;
for(const file of ['lead-jab','rear-straight','lead-hook']) {
 const a=JSON.parse(await readFile('src/game/assets/motion/'+file+'.json','utf8'));const def=P0_ATTACKS[a.attackId];
 let row=0;for(const ms of [0,def.cueAnchorMs,def.impactMs,def.impactMs+90]) {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="280" height="430" viewBox="0 0 280 430"><rect width="280" height="430" fill="#142433"/><text x="10" y="20" fill="white" font-size="14">'+file+' '+ms+'ms</text><g transform="translate(0 30)">'+buildBoxerArtwork(projectCombatPose(a,ms)).map(xml).join('')+'</g></svg>';
  tiles.push({input:await sharp(Buffer.from(svg)).png().toBuffer(),left:col*280,top:row*430});row++;
 }col++;
}
await sharp({create:{width:840,height:1720,channels:4,background:'#142433'}}).composite(tiles).png().toFile(out+'/motion-contact-sheet.png');
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const stamp=new Date('2026-09-15T07:00:00Z');await page.clock.install({time:stamp});await page.clock.pauseAt(stamp);
await page.goto('http://127.0.0.1:3000/?debug=1&seed=123');await page.waitForFunction(()=>!!window.__p0Preview);
await page.locator('#fast-button').click();await page.clock.runFor(2500);
assert.equal(await page.locator('[data-testid="corner-coach"]').count(),0);
assert.ok(await page.locator('#coach-ringside svg').isVisible());
await page.screenshot({path:out+'/gameplay-390.png'});
await page.setViewportSize({width:320,height:568});await page.screenshot({path:out+'/gameplay-320.png'});
const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.defense-btn')].map(b=>({height:b.getBoundingClientRect().height,bottom:b.getBoundingClientRect().bottom})),stage:document.querySelector('#stage').getBoundingClientRect().height}));
assert.equal(layout.overflow,false);assert.ok(layout.buttons.every(b=>b.height>=44&&b.bottom<=568));
await browser.close();assert.deepEqual(errors,[]);
await writeFile(out+'/after.json',JSON.stringify({audit,layout,errors},null,2));console.log(JSON.stringify({audit,layout,errors}));
