import './build-product-qa.mjs';
import {chromium} from './qa-runtime.mjs';
import {createPreviewServer} from './server.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const output=resolve(process.env.BOXING_REVISIT_QA_OUTPUT??'artifacts/revisit-20261016');mkdirSync(output,{recursive:true});
const ko=(survived,level=1)=>({level,cleared:false,resolved:survived+1,survived,lives:0,perfect:0,streak:0,reactionMs:null,at:1});
const fixture={version:1,unlocked:2,best:{1:ko(12),2:ko(17,2),3:ko(18,3)},bestStreak:{1:0,2:0,3:0},recentByDifficulty:{1:ko(8),2:ko(14,2),3:ko(16,3)}};
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const results=[],errors=[];
const events=(page,name)=>page.evaluate(name=>window.__p0Preview.runtime.events.snapshot().filter(e=>e.name===name),name);
try{
 for(const [width,height] of [[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const time=new Date('2026-10-16T12:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
  await page.goto(`http://127.0.0.1:${server.address().port}/?debug=1&qaAds=1&seed=123`,{waitUntil:'networkidle'});
  async function seed(value){await page.evaluate(value=>localStorage.setItem('boxing-survival-v1',JSON.stringify(value)),value);await page.reload({waitUntil:'networkidle'});await page.clock.fastForward(16);}
  await seed(fixture);
  const prompt=page.locator('#revisit-prompt');assert.match(await prompt.innerText(),/지난 기록 8 \/ 30\n최고 생존 기록까지 4회/);
  for(const selector of ['#revisit-prompt','#begin-button','#daily-button']){
   const box=await page.locator(selector).boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=height,`${width}: ${selector} accessible`);
  }
  assert.equal((await events(page,'landing_view')).length,1);
  await page.screenshot({path:resolve(output,`revisit-home-${width}.png`)});
  await page.getByRole('button',{name:'도전자',exact:true}).click();assert.match(await prompt.innerText(),/지난 기록 14 \/ 30\n최고 생존 기록까지 3회/);
  assert.equal((await events(page,'landing_view')).at(-1).data.level,2);
  assert.equal(await page.getByRole('button',{name:'🔒 챔피언',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'입문',exact:true}).click();
  await page.locator('#daily-button').click();await page.locator('#records-close-button').click();assert.match(await prompt.innerText(),/최고 생존 기록까지 4회/);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('boxing-survival-v1'))),fixture);
  await page.reload({waitUntil:'networkidle'});await page.clock.fastForward(16);assert.match(await prompt.innerText(),/최고 생존 기록까지 4회/);
  await page.locator('#begin-button').click();await page.clock.fastForward(16);
  assert.equal((await events(page,'game_start')).length,1);assert.equal((await events(page,'game_start'))[0].data.has_revisit_prompt,true);
  await page.clock.fastForward(20000);await page.locator('#retry-button').click();await page.clock.fastForward(20000);
  assert.equal(await page.evaluate(()=>window.__p0Preview.runtime.deathsSinceLastAd),2);
  assert.equal((await events(page,'game_start'))[1].data.has_revisit_prompt,false);
  await page.locator('#mode-button').click();const before=(await events(page,'game_start')).length;
  await page.locator('#begin-button').click();assert.match(await page.locator('#qa-ad').innerText(),/rewarded/);
  assert.equal((await events(page,'game_start')).length,before);
  await page.locator('#qa-ad-reward').click();assert.equal((await events(page,'game_start')).length,before);
  await page.locator('#qa-ad-dismiss').click();await page.clock.fastForward(16);
  assert.equal((await events(page,'game_start')).length,before+1);
  assert.equal((await events(page,'game_start')).at(-1).data.has_revisit_prompt,true);
  assert.equal(await page.locator('#punch-count').innerText(),'0 / 30');
  const clear={...ko(29),cleared:true,survived:30,lives:3,perfect:12};
  await seed({...fixture,best:{1:clear},recentByDifficulty:{1:ko(28)}});
  assert.match(await prompt.innerText(),/개인 최고 기록에 다시 도전해보세요/);
  await seed({...fixture,best:{1:clear},recentByDifficulty:{1:{...clear,perfect:10}}});
  assert.match(await prompt.innerText(),/완벽 회피 2회 더 도전해보세요/);
  const {recentByDifficulty,...legacy}=fixture;await seed(legacy);assert.equal(await prompt.isVisible(),false);
  await seed({...fixture,recentByDifficulty:{1:ko(13)}});assert.equal(await prompt.isVisible(),false);
  assert.equal((await events(page,'landing_view'))[0].data.revisit_prompt_issue,'recent_ahead_of_best');
  await page.locator('#begin-button').click();assert.equal((await events(page,'game_start')).length,1);
  results.push({width,height,goalAccessible:true,difficultyIsolated:true,lockedExcluded:true,restartRestores:true,noStorageWritesOnHome:true,actualStart:true,homeRewardGate:true,invalidNonBlocking:true,legacyHidden:true,priorClearRespected:true});await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'revisit-browser.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
