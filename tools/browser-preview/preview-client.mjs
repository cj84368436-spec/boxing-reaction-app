import { candidateFailureReason } from '/.preview-dist/app/session/candidateRules.js';
import { RoundClock, ROUND_SPEEDS } from '/.preview-dist/app/session/RoundClock.js';
import { PreviewTenPunchSession } from './preview-session.mjs';
import { getFirstPersonFrame } from '/.preview-dist/app/motion/firstPersonPresentation.js';
import { buildBoxerArtwork, buildPlayerGloves, buildCoachArtwork, COACH_INTRO } from '/.preview-dist/app/motion/boxingArtwork.js';
import { getCoachMoment, getRematchReview } from '/.preview-dist/app/motion/coachPresentation.js';

const byId = id => document.getElementById(id);
const svg = byId('boxer-svg'), stage = byId('stage'), status = byId('status');
const buttons = [...document.querySelectorAll('.defense-btn')];
const bars = [...document.querySelectorAll('.progress-bar')];
const assets = {}, acceptedAt = new Map();
const clock = new RoundClock({ nowMs: () => performance.now() });
let session, playedResults = 0, showingResults = false, started = false, paused = false;
let soundEnabled = true, frameId = null;
const sounds = Object.fromEntries(['evade', 'guard', 'hit', 'hitJab', 'hitStraight', 'hitHook', 'recognition'].map(kind => {
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
function renderCoach(id, reaction) {
  const card = byId(id); card.className = 'coach-card';
  const portrait = element('svg', {viewBox:'0 0 136 160', role:'img', 'aria-label':'얄미운 관장'});
  portrait.append(...buildCoachArtwork(reaction.mood).map(artworkElement));
  const copy = document.createElement('div'); copy.className='coach-copy';
  for (const [className, text] of [['coach-label','동네 체육관 · 관장'],['coach-line',reaction.line],['coach-note',reaction.note]]) {
    const row = document.createElement('div'); row.className=className; row.textContent=text; copy.append(row);
  }
  card.replaceChildren(portrait,copy);
}
function draw(frame) {
  const world = element('g', { 'data-testid': 'opponent-world', transform:
    `translate(${frame.cameraX} ${frame.cameraY}) translate(140 165) scale(${frame.cameraScale}) translate(-140 -165)` });
  if (frame.cueActive) {
    const point = frame.pose[frame.hand];
    world.append(element('polyline', { points: [...frame.trail, point].map(p => `${p.x},${p.y}`).join(' '),
      fill: 'none', stroke: '#f3c969', 'stroke-width': 18, 'stroke-linecap': 'round', opacity: .22 }));
  }
  world.append(...buildBoxerArtwork(frame.pose, frame.cueActive ? frame.hand : undefined).map(artworkElement));
  const gloves = element('g', { 'data-testid': 'player-gloves', opacity: .85 + frame.guard * .15 });
  gloves.append(...buildPlayerGloves(frame.guard).map(artworkElement));
  const moment = getCoachMoment(session.snapshot());
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
  status.textContent = !started ? '공격마다 버튼 한 번' : paused ? '일시 정지' : showingResults ? '라운드 완료' :
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
  if (session.tick().sessionCompleted) return;
  const receipt = session.handleInput(input);
  if (receipt.status === 'VALID' && !acceptedAt.has(receipt.targetAttackInstanceId)) {
    acceptedAt.set(receipt.targetAttackInstanceId, receipt.atMs);
  }
  if (receipt.status === 'VALID') notice = {text: ({LEFT:'왼쪽 회피',RIGHT:'오른쪽 회피',BACK:'거리 빼기',GUARD:'가드'})[receipt.input] + ' · 동작 중', until:clock.nowMs()+160};
  if (receipt.status !== 'VALID') notice = {text: receipt.status === 'EARLY' ? '너무 빠름 · 복귀 뒤 다시 입력' : receipt.status === 'LATE' ? '조금 더 일찍 눌러보세요' : '버튼 하나만 눌러주세요', until:clock.nowMs()+200};
  return receipt;
}

function showResults(snapshot) {
  const totals = { PERFECT: 0, SAFE: 0, HIT: 0 };
  const labels = { LEAD_JAB_HEAD: '잽', REAR_STRAIGHT_HEAD: '스트레이트', LEAD_HOOK_HEAD: '훅' };
  for (const result of snapshot.results) totals[result.outcome]++;
  for (const outcome of Object.keys(totals)) byId(`summary-${outcome.toLowerCase()}`).textContent = `${({PERFECT:'완벽 회피',SAFE:'안전 방어',HIT:'피격'})[outcome]} ${totals[outcome]}`;
  byId('result-title').textContent = `${totals.PERFECT + totals.SAFE} / 10 방어 성공`;
  const rematch = getRematchReview(snapshot.results, speed, true);
  if (totals.HIT === 0 && totals.PERFECT >= 8 && soundEnabled) {sounds.recognition.currentTime=0; void sounds.recognition.play().catch(()=>{});}
  renderCoach('coach-result', rematch.reaction);
  byId('rematch-title').textContent = rematch.focusTitle;
  byId('rematch-body').textContent = rematch.focusBody;
  byId('retry-label').textContent = rematch.retryLabel;
  byId('retry-note').textContent = rematch.retryNote;
  byId('result-list').replaceChildren(...snapshot.results.map(result => {
    const row = document.createElement('div'); row.className = 'result-row';
    const attack = document.createElement('div'); attack.className = 'result-attack';
    attack.textContent = `#${result.attackIndex + 1} ${labels[result.attackId]}`;
    const detail = document.createElement('div'); detail.className = 'result-detail';
    const input = {LEFT:'왼쪽 회피',RIGHT:'오른쪽 회피',BACK:'뒤로 피하기',GUARD:'가드'}[result.telemetry.inputButton] ?? '입력 없음';
    const reason = result.outcome !== 'HIT' ? result.outcome === 'PERFECT' ? '완벽하게 피함' : '안전하게 방어' :
      result.telemetry.inputStatus === 'NO_INPUT' ? '누르지 않아 맞음' : result.telemetry.inputStatus === 'VALID' ? candidateFailureReason(result.attackId,result.telemetry.inputButton) :
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
  status.textContent = '라운드 완료';
  focusButton('retry-button');
}

function start(seed, selectedSpeed = speed) {
  if (started && !session.snapshot().sessionCompleted) return;
  const returning = started;
  stopAudio();
  speed = selectedSpeed; clock.start(speed); started = true; paused = false; notice = null;
  byId('intro-card').hidden = true; byId('pause-card').hidden = true; byId('pause-button').hidden = false;
  session = new PreviewTenPunchSession(clock, Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.source.id])), { seed });
  acceptedAt.clear(); playedResults = 0; showingResults = false;
  byId('seed-input').value = String(session.snapshot().seed);
  byId('result-card').classList.remove('visible');
  stage.classList.remove('hit');
  document.querySelector('.controls').hidden = false;
  buttons.forEach(button => { button.disabled = false; button.classList.remove('pressed'); });
  session.start({ leadInMs: (returning ? 800 : 2000) * speed });
  focusButton('pause-button'); requestFrame();
}

for (const button of buttons) {
  button.addEventListener('pointerdown', event => { if (button.disabled) return; event.preventDefault(); button.classList.add('pressed'); handleInput(button.dataset.btn); });
  // Keyboard / assistive activation has no pointerdown. Avoid a second touch input.
  button.addEventListener('click', event => { if (event.detail === 0) handleInput(button.dataset.btn); });
  for (const name of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(name, () => button.classList.remove('pressed'));
}
const keys = { KeyA: 'LEFT', KeyD: 'RIGHT', KeyS: 'BACK', KeyW: 'GUARD' };
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
addEventListener('visibilitychange', () => { if (document.hidden) pauseRound(); });
addEventListener('blur', pauseRound);
byId('begin-button').addEventListener('click', () => start(session.snapshot().seed, ROUND_SPEEDS.relaxed));
byId('fast-button').addEventListener('click', () => start(session.snapshot().seed, ROUND_SPEEDS.original));
byId('mode-button').addEventListener('click', () => {
  clock.pause(); started = false; paused = false; showingResults = false; playedResults = 0; acceptedAt.clear();
  session = new PreviewTenPunchSession(clock, Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.source.id])), {seed:session.snapshot().seed});
  byId('result-card').classList.remove('visible'); byId('intro-card').hidden=false; byId('pause-button').hidden=true;
  document.querySelector('.controls').hidden=true; stopAudio(); focusButton('begin-button'); requestFrame();
});
byId('retry-button').addEventListener('click', () => { const snapshot = session.snapshot(); start(getRematchReview(snapshot.results, speed, true).replaySameSeed ? snapshot.seed : (snapshot.seed + 1) >>> 0); });
byId('new-pattern-button').addEventListener('click', () => start((session.snapshot().seed + 1) >>> 0));
byId('replay-seed-button').addEventListener('click', () => start(session.snapshot().seed));
byId('start-seed-button').addEventListener('click', () => {
  const seed = Number(byId('seed-input').value);
  if (Number.isInteger(seed) && seed >= 0) start(seed);
});

async function init() {
  renderCoach('coach-intro', COACH_INTRO);
  for (const file of ['lead-jab.json', 'rear-straight.json', 'lead-hook.json']) {
    const response = await fetch(`/src/game/assets/motion/${file}`);
    if (!response.ok) throw new Error(`Motion load failed: ${response.status}`);
    const asset = await response.json(); assets[asset.attackId] = asset;
  }
  const rawSeed = new URLSearchParams(location.search).get('seed');
  session = new PreviewTenPunchSession(clock, Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.source.id])),
    { seed: rawSeed !== null && Number.isInteger(Number(rawSeed)) ? Number(rawSeed) : Date.now() >>> 0 });
  byId('seed-input').value = String(session.snapshot().seed);
  requestFrame();
  if (debug) window.__p0Preview = { snapshot: () => session.snapshot(), handleInput, retrySameSeed: () => start(session.snapshot().seed), startSeed: start };
}
function tick() {
    frameId = null;
    const snapshot = started && !paused ? session.tick() : session.snapshot();
    draw(getFirstPersonFrame(snapshot, assets, acceptedAt));
    byId('punch-count').textContent = `${snapshot.results.length} / 10`;
    byId('instance').textContent = snapshot.currentAttack.attackInstanceId;
    bars.forEach((bar, index) => { bar.className = `progress-bar ${snapshot.results.length > index ? `resolved ${snapshot.results[index].outcome.toLowerCase()}` : snapshot.currentAttackIndex === index ? 'current' : ''}`; });
    for (const result of snapshot.results.slice(playedResults)) playSfx(result);
    playedResults = snapshot.results.length;
    buttons.forEach(button => { button.disabled = !started || paused || snapshot.sessionCompleted; });
    // Leave the final contact/recovery visible before covering it with results.
    if (snapshot.sessionCompleted && !showingResults && snapshot.nowMs - snapshot.latestResult.telemetry.impactScheduledAtMs >= 280) { showResults(snapshot); byId('pause-button').hidden = true; }
    if (started && !paused && !showingResults) requestFrame();
}
init().catch(error => { status.textContent = `ERROR ${error.message}`; console.error(error); });
