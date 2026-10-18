import {APP_ENTRY_URI, SHARED_ENTRY_URI, parseEntrySource} from '/.preview-dist/app/product/entrySource.js';
import {renderViralResult} from './viral-result-preview.mjs';
import {setPreviewShareContext} from './share-preview.mjs';
import {buildRevisitPrompt,revisitPromptEventData} from '/.preview-dist/app/product/revisitPrompt.js';
import {buildRecentComparison,recentComparisonEventData} from '/.preview-dist/app/product/recentComparison.js';
import {recentRecordText} from '/.preview-dist/app/product/recentRecords.js';
import {PlayRuntime} from '/.preview-dist/app/product/playRuntime.js';
import {resultSummary} from '/.preview-dist/app/product/resultSummary.js';
import {attackLabel} from '/.preview-dist/app/motion/attackNames.js';
// Explicit browser fixtures, not a real Toss HTTPS/native bridge round trip.
const fixtureUri=location.pathname==='/shared'?SHARED_ENTRY_URI:location.pathname==='/__qa_unknown_entry'?APP_ENTRY_URI+'/unknown':APP_ENTRY_URI;
const productRuntime=new PlayRuntime(undefined,parseEntrySource(fixtureUri));
let productRound=null,qaAds=null,retryPhase='idle',stagePhase='idle',pendingAdStart=null,adLease=null;
const qaAdMode=new URLSearchParams(location.search).get('qaAds')==='1';
if(qaAdMode){const {createQaAds}=await import('/qa-product.js');qaAds=createQaAds((name,data)=>productRuntime.track(name,{...data,roundId:productRound?.id??null}));}
function adThen(kind,run){
 if(adLease||pendingAdStart)return;
 if(!qaAds){if(kind==='interstitial')run();else byId('retry-note').textContent='현재 이 환경에서는 광고를 이용할 수 없어요. 난이도 선택으로 돌아가 내 기록을 확인할 수 있어요.';return;}
 const lease=productRuntime.acquireAd({},kind);if(!lease)return;adLease=lease;
 const complete=()=>{if(adLease!==lease)return;kind==='rewarded'?productRuntime.completeReward(lease):productRuntime.releaseAd(lease);adLease=null;if(document.hidden)pendingAdStart=run;else run();};
 const attempted=(kind==='rewarded'?qaAds.rewarded:qaAds.stage).attempt(complete);
 if(!attempted&&adLease===lease){productRuntime.releaseAd(lease);adLease=null;}
}
function requestPlay(seed,rate,source='free_retry'){
 if(productRuntime.fullScreenBusy||pendingAdStart)return;
 const required=productRuntime.requiresReward;
 const retry=required||source==='free_retry'?productRuntime.prepareRetry(required?'ad_retry':'free_retry'):null;
 productRuntime.track(required?'ad_retry_tap':'free_retry_tap',{roundId:retry?.previousRoundId??null});
 if(required)adThen('rewarded',()=>start(seed,rate,null,'ad_retry'));
 else start(seed,rate,null,source);
}
import { LEVELS } from '/.preview-dist/app/session/survivalRules.js';
import { emptyProgress, parseProgress, recordRound, summarizeRound, recordText, earnsPromotion, isHighScore } from '/.preview-dist/app/session/progression.js';
import { startChallenge, submitChallenge, standingText, readCompetition, overviewText } from '/.preview-dist/app/session/competitionClient.js';
import { CoachDialogue } from '/.preview-dist/app/motion/coachDialogue.js';
import { ART_ATLAS } from '/.preview-dist/app/motion/artAtlas.js';
import { selectSpriteFrame, selectSpriteSheet } from '/.preview-dist/app/motion/cartoonSprites.js';
import { candidateFailureReason } from '/.preview-dist/app/session/candidateRules.js';
import { RoundClock, ROUND_SPEEDS } from '/.preview-dist/app/session/RoundClock.js';
import { PreviewTenPunchSession } from './preview-session.mjs';
import { getFirstPersonFrame } from '/.preview-dist/app/motion/firstPersonPresentation.js';
import { buildBoxerArtwork, buildPlayerGloves, buildCoachArtwork, COACH_INTRO } from '/.preview-dist/app/motion/boxingArtwork.js';
import { getCoachMoment, getRematchReview } from '/.preview-dist/app/motion/coachPresentation.js';

const byId = id => document.getElementById(id);
const svg = byId('boxer-svg'), stage = byId('stage'), status = byId('status');
const buttons = [...document.querySelectorAll('.defense-btn')];
const progressRow=document.querySelector('.progress');
progressRow.replaceChildren(...Array.from({length:30},()=>{const bar=document.createElement('div');bar.className='progress-bar';return bar;}));
const bars=[...progressRow.children];
const STORAGE_KEY='boxing-survival-v1';
let progress=emptyProgress(), storageNote='',level=1, challenge=null, inputs=[], connecting=false, ready=false, requestVersion=0;
try{progress=parseProgress(localStorage.getItem(STORAGE_KEY));}catch{storageNote='기록 저장을 사용할 수 없습니다.';}
function currentRevisitPrompt(){return buildRevisitPrompt({recent:progress.recentByDifficulty?.[level],best:progress.best[level],difficulty:level,unlocked:progress.unlocked});}
function trackLanding(){if(ready&&!byId('intro-card').hidden)productRuntime.track('landing_view',{level,...revisitPromptEventData(currentRevisitPrompt())});}
function renderLevels(){
 byId('level-options').replaceChildren(...[1,2,3].map(n=>{const b=document.createElement('button');b.type='button';b.textContent=(n>progress.unlocked?'🔒 ':'')+LEVELS[n].name;b.disabled=n>progress.unlocked;b.className=n===level?'selected':'';b.onclick=()=>{level=n;renderLevels();};return b;}));
 byId('begin-button').textContent=LEVELS[level].name+' 도전 시작';byId('personal-best').textContent=recordText(progress.best[level])+' · 연속 최고 '+(progress.bestStreak[level]??0);
 const prompt=currentRevisitPrompt();byId('revisit-prompt').hidden=prompt.message===null;byId('revisit-prompt').textContent=prompt.message===null?'':prompt.context+'\n'+prompt.message;
 trackLanding();
 byId('storage-note').textContent=storageNote||'30회를 버티면 다음 단계 해금';
}
function closeRecords(){requestVersion++;byId('records-card').hidden=true;byId('intro-card').hidden=false;focusButton('daily-button');trackLanding();}
async function openRecords(){
 if(!ready||connecting)return;
 const version=++requestVersion;
 byId('records-list').replaceChildren(...[1,2,3].map(n=>{const card=document.createElement('div');card.className='record-card';card.textContent=LEVELS[n].name+' · 개인 최고 · '+recordText(progress.best[n])+' · 연속 최고 '+(progress.bestStreak[n]??0);const recent=document.createElement('p');recent.dataset.recentLevel=n;recent.textContent='최근 · '+recentRecordText(progress.recentByDifficulty?.[n]);card.append(recent);return card;}));
 byId('intro-card').hidden=true;byId('records-card').hidden=false;byId('records-standing').textContent='오늘의 기록 불러오는 중…';focusButton('records-close-button');
 try{const v=await readCompetition();if(version===requestVersion)byId('records-standing').textContent=overviewText(v);}catch{if(version===requestVersion)byId('records-standing').textContent='온라인 기록을 불러오지 못했습니다. 개인 기록은 위에서 볼 수 있습니다.';}
}
async function beginDaily(){
 if(!ready||connecting)return;
 connecting=true;const version=++requestVersion;
 byId('daily-start-button').disabled=true;byId('begin-button').disabled=true;
 try{const c=await startChallenge();if(version===requestVersion)start(c.seed,LEVELS[2].rate,c);}
 catch{if(version===requestVersion){const message='비교 서버 연결 실패 · 다시 시도해 주세요.';byId('records-standing').textContent=message;byId('rank-note').textContent=message;}}
 finally{connecting=false;byId('daily-start-button').disabled=false;byId('begin-button').disabled=false;}
}

const assets = {}, acceptedAt = new Map();
const dialogue = new CoachDialogue();
const clock = new RoundClock({ nowMs: () => performance.now() });
let session, playedResults = 0, showingResults = false, started = false, paused = false;
let soundEnabled = true, frameId = null;
const sounds = Object.fromEntries(['evade', 'guard', 'hit', 'hitJab', 'hitStraight', 'hitHook', 'recognition', 'knockout'].map(kind => {
  const audio = new Audio(`/src/app/assets/sfx/${kind}.wav`);
  audio.preload = 'auto'; audio.volume = .7;
  return [kind, audio];
}));
let speed = ROUND_SPEEDS.relaxed, notice = null;
const debug = new URLSearchParams(location.search).get('debug') === '1';
document.querySelector('.debug').hidden = !debug;
byId('replay-seed-button').hidden = !debug;
function stopAudio() { for (const audio of Object.values(sounds)) { audio.pause(); audio.currentTime = 0; } }
function requestFrame() { if (frameId === null) frameId = requestAnimationFrame(tick); }
function focusButton(id) { byId(id).focus({preventScroll:true}); }

function element(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function artworkElement(node) {
  const attrs = Object.fromEntries(Object.entries(node.attrs).map(([key, value]) => [
    key === 'testID' ? 'data-testid' : key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), value,
  ]));
  const shape = element(node.tag, attrs);
  if (node.children) shape.append(...node.children.map(artworkElement));
  return shape;
}

function sprite(sheet,index,x,y,width,height) {
  const a=ART_ATLAS[sheet], cw=a.width/a.columns, ch=a.height/a.rows;
  const crop=element('svg',{x,y,width,height,viewBox:`${(index%a.columns)*cw} ${Math.floor(index/a.columns)*ch} ${cw} ${ch}`,preserveAspectRatio:'xMidYMid meet',overflow:'hidden'});
  crop.append(element('image',{href:'/src/app/assets/art/'+(sheet==='coach'?'coach-skinny':sheet)+'.png',width:a.width,height:a.height}));
  return crop;
}

function renderCoach(id, reaction) {
  const card = byId(id); card.className = 'coach-card';
  const portrait = element('svg', {viewBox:'0 0 136 160', role:'img', 'aria-label':'얄미운 관장'});
  if(id==='coach-ringside') {portrait.setAttribute('viewBox','0 0 136 105');portrait.setAttribute('preserveAspectRatio','xMidYMin slice');}
  portrait.append(sprite('coach',{smirk:0,interested:1,surprised:2}[reaction.mood],0,0,136,160));
  const copy = document.createElement('div'); copy.className='coach-copy';
  for (const [className, text] of [['coach-label','동네 체육관 · 관장'],['coach-line',reaction.line],['coach-note',reaction.note]]) {
    const row = document.createElement('div'); row.className=className; row.textContent=text; copy.append(row);
  }
  card.replaceChildren(portrait,copy);
}
function draw(frame) {
  const world = element('g', { 'data-testid': 'opponent-world', transform:
    `translate(${frame.cameraX} ${frame.cameraY}) translate(140 165) scale(${frame.cameraScale}) translate(-140 -165)` });
  const cel=selectSpriteFrame(frame.attackId,frame.elapsedMs);
  const sheet=selectSpriteSheet(frame.attackId,cel);
  const drawnCel=cel===5 || (sheet==='straight' && cel===1)?0:cel;
  const fighter=element('g',{transform:sheet==='straight' && cel===1?'rotate(-3 140 300)':'rotate(0)'});
  fighter.append(sprite(sheet,drawnCel,10,8,260,520));world.append(fighter);
  const gloves=element('g',{'data-testid':'player-gloves'});
  const guard=Math.max(0,Math.min(1,frame.guard)), gy=270-guard*175;
  gloves.append(sprite('gloves',0,-30+guard*92,gy,128,195),sprite('gloves',1,182-guard*92,gy,128,195));
  const moment = getCoachMoment(session.snapshot(), dialogue);
  const liveCoach = byId('coach-ringside');
  liveCoach.hidden = !started || showingResults;
  const reaction = { mood: !paused && moment ? moment.mood : session.snapshot().results.filter(r=>r.outcome==='PERFECT').length >= 6 ? 'surprised' : session.snapshot().results.filter(r=>r.outcome==='PERFECT').length >= 3 ? 'interested' : 'smirk', line: !paused && moment ? moment.line : paused ? '쉬고 오게. 기다리지.' : '', note: '' };
  const key = reaction.mood + reaction.line;
  if (liveCoach.dataset.reaction !== key) {
    renderCoach('coach-ringside', reaction);
    liveCoach.querySelector('.coach-line').id = 'coach-live-line';
    liveCoach.dataset.reaction = key;
  }
  const contact = element('g', {opacity:frame.contact ? 1 : 0});
  if (frame.contact && (frame.hit || frame.guard > .5)) {
    const cx = 140 + frame.cameraX, cy = 165 + frame.cameraY;
    for (let i=0;i<8;i++) { const a=i*Math.PI/4; contact.append(element('line', {
      x1:cx+Math.cos(a)*43,y1:cy+Math.sin(a)*43,x2:cx+Math.cos(a)*54,y2:cy+Math.sin(a)*54,
      stroke:frame.hit?'#ff7a80':'#f3c969','stroke-width':3,'stroke-linecap':'round' })); }
  }
  svg.replaceChildren(world, contact, gloves);
  stage.classList.toggle('hit', frame.hit);
  stage.classList.toggle('evaded', frame.contact && frame.outcome === 'PERFECT');
  status.textContent = !started ? '공격마다 버튼 한 번' : paused ? '일시 정지' : showingResults ? session.snapshot().knockedOut ? '다운 · 경기 종료' : '라운드 클리어' :
    notice && clock.nowMs() < notice.until ? notice.text : frame.feedback || '주먹을 보세요';
  const snapshot = session.snapshot();
  const until = snapshot.scheduledAttacks[0].attackStartScheduledAtMs - snapshot.nowMs;
  byId('round-hint').textContent = !started || paused || showingResults ? '' : until > 0 ? `준비 ${Math.ceil(until / (speed * 1000))}` :
    frame.feedback;
  byId('mode-label').hidden = !started || paused || showingResults;
  byId('mode-label').textContent = `가드 ${'●'.repeat(snapshot.guardEnergy)}${'○'.repeat(2-snapshot.guardEnergy)} · 회피로 회복`;
}

function playSfx(result) {
  if (!soundEnabled || paused || document.hidden) return;
  const kind = result.outcome === 'HIT' ? result.attackId === 'LEAD_JAB_HEAD' ? 'hitJab' : result.attackId === 'REAR_STRAIGHT_HEAD' ? 'hitStraight' : 'hitHook' : result.telemetry.inputButton === 'GUARD' ? 'guard' : 'evade';
  const audio = sounds[kind];
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function handleInput(input) {
  if (!session || !started || paused) return;
  if (level !== 3 && (input === 'DUCK' || input === 'STEP_IN')) return;
  if (session.tick().sessionCompleted) return;
  if(challenge)inputs.push({atMs:clock.nowMs(),input});
  const receipt = session.handleInput(input);
  if (receipt.status === 'VALID' && !acceptedAt.has(receipt.targetAttackInstanceId)) {
    acceptedAt.set(receipt.targetAttackInstanceId, receipt.atMs);
  }
  if (receipt.status === 'VALID') notice = {text: ({LEFT:'왼쪽 회피',RIGHT:'오른쪽 회피',BACK:'거리 빼기',GUARD:'가드',DUCK:'숙이기',STEP_IN:'앞으로 파고들기'})[receipt.input] + ' · 동작 중', until:clock.nowMs()+160};
  if (receipt.status !== 'VALID') notice = {text: receipt.status === 'EARLY' ? '너무 빠름 · 복귀 뒤 다시 입력' : receipt.status === 'LATE' ? '조금 더 일찍 눌러보세요' : '버튼 하나만 눌러주세요', until:clock.nowMs()+200};
  return receipt;
}

function showResults(snapshot) {
  const totals = { PERFECT: 0, SAFE: 0, HIT: 0 };
  productRuntime.endRound(productRound,snapshot.knockedOut?'knockout':'clear');
  if(productRuntime.requiresReward&&qaAds)qaAds.rewarded.prepare(state=>{retryPhase=state.phase;if(state.phase==='error'&&adLease){productRuntime.releaseAd(adLease);adLease=null;}byId('retry-label').textContent=state.phase==='ready'?'광고 보고 다시 도전':state.phase==='error'?'광고 다시 불러오기':'광고 준비 중…';});
  for (const result of snapshot.results) totals[result.outcome]++;
  for (const outcome of Object.keys(totals)) byId(`summary-${outcome.toLowerCase()}`).textContent = `${({PERFECT:'완벽 회피',SAFE:'안전 방어',HIT:'피격'})[outcome]} ${totals[outcome]}`;
  const record=summarizeRound(snapshot,level,speed),old=progress.best[level];
  // Browser simulation can display a seeded recent record, but never becomes a real recent match.
  const comparison=buildRecentComparison(progress.recentByDifficulty?.[level],record);
  productRuntime.track('result_view',{roundId:productRound.id,level,...recentComparisonEventData(comparison,record)});
  const sharedRoundId=productRound.id;setPreviewShareContext({record,previousBest:old,comparison,roundId:sharedRoundId,runtime:productRuntime,isCurrent:()=>showingResults&&productRound?.id===sharedRoundId&&!productRuntime.fullScreenBusy});
  const summary=resultSummary(record,snapshot.results);byId('nearby-goal').textContent=summary.goal;byId('result-strength').textContent=summary.strength??'';byId('result-weakness').textContent=summary.weakness??'';byId('result-details').open=false;
  progress=recordRound(progress,record);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));}catch{storageNote='기록 저장 실패 · 이번 실행에서는 유지됩니다.';}
  byId('record-detail').textContent='완벽 회피 '+record.perfect+'/30 · 최장 연속 '+record.streak+'회';
  if(isHighScore(record))byId('record-detail').textContent+=' · 관장의 인정 달성!';
  byId('promotion-note').textContent=earnsPromotion(record)?level<3?LEVELS[level+1].name+' 단계 해금!':'최고 단계 클리어!':'같은 공격 순서로 다시 연습할 수 있어요';
  byId('promote-button').hidden=level===3||progress.unlocked<=level||!!challenge;
  byId('promote-ad-disclosure').hidden=byId('promote-button').hidden||snapshot.knockedOut||!['loading','ready'].includes(stagePhase);
  byId('promote-button').textContent=level<3?'다음 난이도 도전 · '+LEVELS[level+1].name:'';
  byId('rank-note').textContent=challenge?'기록 검증 중…':storageNote||'난이도별 최고 기록은 이 브라우저에 저장됩니다.';
  if(challenge){const submitted=challenge;submitChallenge(submitted,inputs).then(r=>{if(challenge===submitted)byId('rank-note').textContent=standingText(r);}).catch(()=>{if(challenge===submitted)byId('rank-note').textContent='비교 기록 제출 실패 · 개인 기록은 유지됩니다.';});}

  const rematch = getRematchReview(snapshot.results, speed, true, {dialogue, event:snapshot.runId, knockedOut:snapshot.knockedOut === true,totalPunches:30});
  if (snapshot.knockedOut && soundEnabled && !paused && !document.hidden) {stopAudio(); sounds.knockout.currentTime=0; void sounds.knockout.play().catch(()=>{});}
  if (totals.HIT === 0 && totals.PERFECT >= 24 && soundEnabled) {sounds.recognition.currentTime=0; void sounds.recognition.play().catch(()=>{});}
  renderViralResult({record,previousBest:old,comparison,results:snapshot.results});
  document.querySelector('.result-content').scrollTop=0;
  byId('rematch-title').textContent = rematch.focusTitle;
  byId('rematch-body').textContent = rematch.focusBody;
  byId('retry-label').textContent = productRuntime.requiresReward?'광고 보고 다시 도전':'다시 도전';
  byId('new-pattern-button').hidden=!!challenge;
  byId('retry-note').textContent = challenge ? '오늘의 같은 코스에 다시 도전합니다.' : rematch.retryNote;
  byId('result-list').replaceChildren(...snapshot.results.map(result => {
    const row = document.createElement('div'); row.className = 'result-row';
    const attack = document.createElement('div'); attack.className = 'result-attack';
    attack.textContent = `#${result.attackIndex + 1} ${attackLabel(result.attackId)}`;
    const detail = document.createElement('div'); detail.className = 'result-detail';
    const input = {LEFT:'왼쪽 회피',RIGHT:'오른쪽 회피',BACK:'뒤로 피하기',GUARD:'가드',DUCK:'숙이기',STEP_IN:'앞으로 파고들기'}[result.telemetry.inputButton] ?? '입력 없음';
    const reason = result.outcome !== 'HIT' ? result.outcome === 'PERFECT' ? '완벽하게 피함' : '안전하게 방어' :
      result.telemetry.inputStatus === 'NO_INPUT' ? '누르지 않아 맞음' : result.telemetry.inputStatus === 'VALID' ? ['DUCK','STEP_IN'].includes(result.telemetry.inputButton) ? '공격을 피하지 못함' : candidateFailureReason(result.attackId,result.telemetry.inputButton) :
      {EARLY:'너무 일찍 누름',LATE:'늦게 누름',MULTI_INPUT:'버튼을 동시에 누름'}[result.telemetry.inputStatus] ?? '방어 실패';
    detail.textContent = `${input} · ${reason}`;
    if (debug) detail.textContent += ` · ${result.telemetry.inputStatus} · ${result.telemetry.reactionMs == null ? '—' : Math.round(result.telemetry.reactionMs / speed)} ms`;
    attack.style.color = {PERFECT:'#56d68b',SAFE:'#f3c969',HIT:'#ff7a80'}[result.outcome];
    row.append(attack, detail); return row;
  }));
  byId('result-card').classList.add('visible');
  showingResults = true;
  byId('coach-ringside').hidden = true;
  document.querySelector('.controls').hidden = true;
  byId('round-hint').textContent = '';
  byId('mode-label').hidden = true;
  status.textContent = snapshot.knockedOut ? '다운 · 경기 종료' : '라운드 클리어';
  focusButton('retry-button');
}

function start(seed, selectedSpeed = LEVELS[level].rate, daily = null, source='landing') {
  if(productRuntime.requiresReward||productRuntime.fullScreenBusy||document.hidden)return;
  if (!ready || (connecting && !daily) || (started && !session.snapshot().sessionCompleted)) return;
  requestVersion++;byId('records-card').hidden=true;
  if(!daily && level>progress.unlocked)return;
  const revisitData=revisitPromptEventData(!started&&!daily&&!byId('intro-card').hidden?currentRevisitPrompt():undefined);
  const returning = started;
  challenge=daily;inputs=[];if(daily)level=daily.level;
  dialogue.beginRound();
  stopAudio();
  speed = selectedSpeed; clock.start(speed); started = true; paused = false; notice = null;
  byId('intro-card').hidden = true; byId('pause-card').hidden = true; byId('pause-button').hidden = false;
  session = new PreviewTenPunchSession(clock, Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.source.id])), { seed, maxHits:5, survivalLevel:level });
  acceptedAt.clear(); playedResults = 0; showingResults = false;
  byId('seed-input').value = String(session.snapshot().seed);
  byId('result-card').classList.remove('visible');
  stage.classList.remove('hit');
  document.querySelector('.controls').hidden = false;
  buttons.forEach(button => { button.hidden = ['DUCK','STEP_IN'].includes(button.dataset.btn) && level !== 3; button.disabled = button.hidden; button.classList.remove('pressed'); });
  session.start({ leadInMs: daily?.leadInMs ?? (returning ? 800 : 2000) * speed });
  productRound=productRuntime.startRound({level,source,...revisitData});
  focusButton('pause-button'); requestFrame();
}

for (const button of buttons) {
  button.addEventListener('pointerdown', event => { if (button.disabled) return; event.preventDefault(); button.classList.add('pressed'); handleInput(button.dataset.btn); });
  // Keyboard / assistive activation has no pointerdown. Avoid a second touch input.
  button.addEventListener('click', event => { if (event.detail === 0) handleInput(button.dataset.btn); });
  for (const name of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(name, () => button.classList.remove('pressed'));
}
const keys = { KeyA: 'LEFT', KeyD: 'RIGHT', KeyS: 'BACK', KeyW: 'GUARD', KeyQ: 'DUCK', KeyE: 'STEP_IN' };
addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.repeat || !keys[event.code]) return;
  event.preventDefault(); handleInput(keys[event.code]);
});
function pauseRound() {
  stopAudio();
  if (!started || showingResults || paused) return;
  clock.pause(); paused = true; byId('pause-card').hidden = false;
  byId('pause-button').hidden = true;
  buttons.forEach(button => button.classList.remove('pressed'));
  focusButton('resume-button'); requestFrame();
}
byId('pause-button').addEventListener('click', pauseRound);
byId('resume-button').addEventListener('click', () => { if (!paused) return; paused=false; clock.resume(); byId('pause-card').hidden=true; byId('pause-button').hidden=false; focusButton('pause-button'); requestFrame(); });
byId('sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled; stopAudio();
  byId('sound-button').textContent = soundEnabled ? '소리 켜짐' : '소리 꺼짐';
  byId('sound-button').setAttribute('aria-label', soundEnabled ? '소리 끄기' : '소리 켜기');
});
addEventListener('visibilitychange', () => { if (document.hidden) pauseRound();else if(pendingAdStart){const run=pendingAdStart;pendingAdStart=null;run();} });
addEventListener('blur', pauseRound);
byId('begin-button').addEventListener('click', () => {if(ready)requestPlay(session.snapshot().seed, LEVELS[level].rate,'landing');});
byId('daily-button').addEventListener('click',()=>void openRecords());
byId('daily-start-button').addEventListener('click',()=>void beginDaily());
byId('records-close-button').addEventListener('click',closeRecords);
byId('records-card').addEventListener('keydown',event=>{if(event.key==='Escape')closeRecords();if(event.key==='Tab'){const enabled=[byId('daily-start-button'),byId('records-close-button')].filter(b=>!b.disabled);event.preventDefault();enabled[(enabled.indexOf(document.activeElement)+(event.shiftKey?-1:1)+enabled.length)%enabled.length].focus();}});
byId('promote-button').addEventListener('click',()=>{if(level<3 && progress.unlocked>level){const run=()=>{level++;start((session.snapshot().seed+1)>>>0,LEVELS[level].rate,null,'next_level');};if(session.snapshot().knockedOut){if(productRuntime.requiresReward)adThen('rewarded',run);else run();}else adThen('interstitial',run);}});
byId('mode-button').addEventListener('click', () => {
  if(productRuntime.fullScreenBusy||pendingAdStart)return;
  productRuntime.cancelRetry();
  requestVersion++;challenge=null;inputs=[];level=Math.min(level,progress.unlocked);renderLevels();
  clock.pause(); started = false; paused = false; showingResults = false; playedResults = 0; acceptedAt.clear();
  session = new PreviewTenPunchSession(clock, Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.source.id])), {seed:session.snapshot().seed,maxHits:5,survivalLevel:level});
  byId('result-card').classList.remove('visible'); byId('intro-card').hidden=false; byId('pause-button').hidden=true;
  document.querySelector('.controls').hidden=true; stopAudio(); focusButton('begin-button'); requestFrame();trackLanding();
});
byId('retry-button').addEventListener('click', () => { if(challenge){void beginDaily();return;} const snapshot = session.snapshot(); requestPlay(getRematchReview(snapshot.results, speed, true).replaySameSeed ? snapshot.seed : (snapshot.seed + 1) >>> 0); });
byId('new-pattern-button').addEventListener('click', () => {if(challenge){challenge=null;level=Math.min(level,progress.unlocked);}requestPlay((session.snapshot().seed + 1) >>> 0,LEVELS[level].rate);});
byId('replay-seed-button').addEventListener('click', () => requestPlay(session.snapshot().seed));
byId('start-seed-button').addEventListener('click', () => {
  const seed = Number(byId('seed-input').value);
  if (Number.isInteger(seed) && seed >= 0) start(seed);
});

async function init() {
  if(qaAds)qaAds.stage.prepare(state=>{stagePhase=state.phase;const note=byId('promote-ad-disclosure');if(note)note.hidden=byId('promote-button').hidden||session.snapshot().knockedOut||!['loading','ready'].includes(stagePhase);});
  renderLevels();renderCoach('coach-intro', COACH_INTRO);
  for (const file of ['lead-jab.json', 'rear-straight.json', 'lead-hook.json']) {
    const response = await fetch(`/src/game/assets/motion/${file}`);
    if (!response.ok) throw new Error(`Motion load failed: ${response.status}`);
    const asset = await response.json(); assets[asset.attackId] = asset;
  }
  // The native app registers the same authored uppercut source without a mocap clip.
  assets.LEAD_UPPERCUT_HEAD = {attackId:'LEAD_UPPERCUT_HEAD',source:{id:'authored-uppercut-v1'},visualRecoveryMs:860,timeline:[],jointNames:[],frames:[]};
  const rawSeed = new URLSearchParams(location.search).get('seed');
  session = new PreviewTenPunchSession(clock, Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.source.id])),
    { maxHits:5, survivalLevel:level, seed: rawSeed !== null && Number.isInteger(Number(rawSeed)) ? Number(rawSeed) : Date.now() >>> 0 });
  ready=true;byId('begin-button').disabled=false;byId('daily-button').disabled=false;trackLanding();
  byId('seed-input').value = String(session.snapshot().seed);
  requestFrame();
  if (debug) window.__p0Preview = { runtime:productRuntime, snapshot: () => session.snapshot(), handleInput, retrySameSeed: () => requestPlay(session.snapshot().seed), startSeed: start };
}
function tick() {
    frameId = null;
    const snapshot = started && !paused ? session.tick() : session.snapshot();
    draw(getFirstPersonFrame(snapshot, assets, acceptedAt));
    byId('punch-count').textContent = `${snapshot.results.length} / 30`;
    byId('lives').textContent = `목숨 ${'♥'.repeat(snapshot.livesRemaining ?? 5)}${'♡'.repeat(5-(snapshot.livesRemaining ?? 5))} · ${snapshot.livesRemaining ?? 5} / 5`;
    byId('instance').textContent = snapshot.currentAttack.attackInstanceId;
    bars.forEach((bar, index) => { bar.className = `progress-bar ${snapshot.results.length > index ? `resolved ${snapshot.results[index].outcome.toLowerCase()}` : snapshot.currentAttackIndex === index ? 'current' : ''}`; });
    for (const result of snapshot.results.slice(playedResults)) playSfx(result);
    playedResults = snapshot.results.length;
    buttons.forEach(button => { button.disabled = button.hidden || !started || paused || snapshot.sessionCompleted; });
    // Leave the final contact/recovery visible before covering it with results.
    if (snapshot.sessionCompleted && !showingResults && snapshot.nowMs - snapshot.latestResult.telemetry.impactScheduledAtMs >= 280) { showResults(snapshot); byId('pause-button').hidden = true; }
    if (started && !paused && !showingResults) requestFrame();
}
init().catch(error => { status.textContent = `ERROR ${error.message}`; console.error(error); });
