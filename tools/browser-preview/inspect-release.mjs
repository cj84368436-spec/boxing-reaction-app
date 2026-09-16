import { chromium } from 'file:///C:/Users/cj799/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { P0_ATTACKS } from '../../.preview-dist/game/config/p0Attacks.js';
const out='release/captures/2026-09-15';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[], results=[]; page.on('pageerror',error=>errors.push(error.message));
const stamp=new Date('2026-09-15T03:00:00Z');
await page.clock.install({time:stamp}); await page.clock.pauseAt(stamp);
const snap=()=>page.evaluate(()=>window.__p0Preview.snapshot());
const advance=async target=>{const now=(await snap()).nowMs;if(target>now)await page.clock.runFor(target-now);};
async function layout() {
  return page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth, stageScroll:document.querySelector('#stage').scrollTop,
    buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetParent && ['begin-button','fast-button','retry-button','mode-button'].includes(b.id)).map(b=>({id:b.id,top:b.getBoundingClientRect().top,bottom:b.getBoundingClientRect().bottom}))}));
}
await page.goto('http://127.0.0.1:3000/?debug=1&seed=123');
await page.waitForFunction(()=>!!window.__p0Preview);
assert.equal(await page.getByRole('img',{name:'얄미운 관장'}).count(),1);
await page.getByRole('button',{name:'원래 속도로 도전',exact:true}).click();
await page.clock.runFor(100);
await page.getByRole('button',{name:'일시 정지',exact:true}).click();
const paused=(await snap()).nowMs;await page.clock.runFor(1000);assert.equal((await snap()).nowMs,paused);
await page.getByRole('button',{name:'계속하기',exact:true}).click();
for (const attack of (await snap()).scheduledAttacks) {
  await advance(attack.attackStartScheduledAtMs+P0_ATTACKS[attack.attackId].cueAnchorMs+40);
  await page.locator(`[data-btn="${attack.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'}"]`).click();
}
await page.clock.runFor(2000);
assert.equal((await snap()).results.filter(r=>r.outcome==='PERFECT').length,10);
assert.match(await page.locator('#coach-result').innerText(),/팔짱을 풀었습니다/);
results.push({case:'perfect-evasion',count:10,coach:await page.locator('#coach-result .coach-line').innerText()});
await page.screenshot({path:out+'/05-perfect.png'});
await page.getByRole('button',{name:'다시 도전',exact:true}).click();
assert.equal((await snap()).results.length,0);
for (const attack of (await snap()).scheduledAttacks) {
  await advance(attack.attackStartScheduledAtMs+P0_ATTACKS[attack.attackId].cueAnchorMs+40);
  await page.locator('[data-btn="GUARD"]').click();
}
await page.clock.runFor(2000);
assert.equal((await snap()).results.filter(r=>r.outcome==='SAFE').length,10);
assert.match(await page.locator('#coach-result').innerText(),/빈틈이 없군/);
results.push({case:'all-guard',count:10});
await page.getByRole('button',{name:'속도 다시 선택',exact:true}).click();
await page.getByRole('button',{name:'여유 있게 시작',exact:true}).click();
await page.clock.runFor(30000);
assert.equal((await snap()).results.filter(r=>r.outcome==='HIT').length,10);
results.push({case:'relaxed-no-input',count:10});
// Public UI captures, without the developer controls.
await page.goto('http://127.0.0.1:3000/?seed=123');
await page.locator('#coach-intro svg').waitFor();
await page.screenshot({path:out+'/01-intro.png'});
await page.getByRole('button',{name:'원래 속도로 도전',exact:true}).click();
await page.clock.runFor(100);
await page.screenshot({path:out+'/02-ready.png'});
await writeFile(out+'/play-boxer.svg',await page.locator('#boxer-svg').evaluate(el=>el.outerHTML));
await page.clock.runFor(2100);
await page.screenshot({path:out+'/03-punch.png'});
await page.clock.runFor(16000);
await page.screenshot({path:out+'/04-result.png'});
for(const viewport of [{width:320,height:568},{width:390,height:844}]) {
  await page.setViewportSize(viewport);
  await page.goto('http://127.0.0.1:3000/?seed=123');
  await page.locator('#coach-intro svg').waitFor();
  const intro=await layout(); assert.equal(intro.overflow,false);assert.equal(intro.stageScroll,0);
  for(const b of intro.buttons){assert.ok(b.top>=0&&b.bottom<=viewport.height);}
  await page.screenshot({path:out+`/intro-${viewport.width}.png`});
  await page.getByRole('button',{name:'원래 속도로 도전',exact:true}).click();
  await page.clock.runFor(100);
  await page.screenshot({path:out+`/play-${viewport.width}.png`});
  await page.clock.runFor(18000);
  const end=await layout();assert.equal(end.overflow,false);assert.equal(end.stageScroll,0);
  for(const b of end.buttons){assert.ok(b.top>=0&&b.bottom<=viewport.height);}
  await page.screenshot({path:out+`/result-${viewport.width}.png`});
  results.push({case:'viewport',...viewport,intro,end});
}
assert.deepEqual(errors,[]);
await writeFile(out+'/browser-verification.json',JSON.stringify({date:'2026-09-15',runtime:'Edge headless browser preview; controlled time; actual DOM buttons',errors,results},null,2));
console.log(JSON.stringify({errors,results}));
await browser.close();
