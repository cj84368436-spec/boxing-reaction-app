import {
  buildRigCommands,
  getFreezePoints,
  loadMotionAssets,
  projectPose,
  samplePose
} from './runtime.mjs';

const state = {
  assets: null,
  attackKey: 'jab',
  gloveScale: 1,
  playing: false,
  looping: true,
  playbackSpeed: 1,
  timeMs: 0,
  lastAnimationTime: 0
};

const elements = {
  frontCanvas: document.querySelector('#frontCanvas'),
  quarterCanvas: document.querySelector('#quarterCanvas'),
  status: document.querySelector('#status'),
  sourceSummary: document.querySelector('#sourceSummary'),
  presets: document.querySelector('#presets'),
  timeline: document.querySelector('#timeline'),
  cueRegion: document.querySelector('#cueRegion'),
  impactMarker: document.querySelector('#impactMarker'),
  playhead: document.querySelector('#playhead'),
  play: document.querySelector('#play'),
  loop: document.querySelector('#loop'),
  speed: document.querySelector('#speed')
};

const currentAsset = () => state.assets[state.attackKey];

function screenPoint(point, width, height) {
  const unit = Math.min(width / 18, height / 11.8);
  return { x: width / 2 + point.x * unit, y: height * 0.66 - point.y * unit, unit };
}

function drawStage(context, width, height, timeMs, asset) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#172334');
  gradient.addColorStop(0.72, '#0b121c');
  gradient.addColorStop(1, '#070b11');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = '#243047';
  context.lineWidth = 1;
  const floorY = height * 0.96;
  context.beginPath();
  context.moveTo(0, floorY);
  context.lineTo(width, floorY);
  context.stroke();

  const { cueAnchorMs, impactMs } = asset.canonicalTiming;
  const markerColor = Math.abs(timeMs - impactMs) < 1
    ? '#ffcf52'
    : Math.abs(timeMs - cueAnchorMs) < 1 ? '#62d8ff' : null;
  if (markerColor) {
    context.strokeStyle = markerColor;
    context.lineWidth = 3;
    context.strokeRect(5, 5, width - 10, height - 10);
  }
}

function drawCommand(context, command, width, height) {
  const point = (value) => screenPoint(value, width, height);
  if (command.kind === 'polygon') {
    const points = command.points.map(point);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const item of points.slice(1)) context.lineTo(item.x, item.y);
    context.closePath();
    context.fillStyle = '#263753';
    context.fill();
    context.strokeStyle = '#7c8da9';
    context.lineWidth = Math.max(1.5, points[0].unit * 0.07);
    context.stroke();
    return;
  }

  if (command.kind === 'segment') {
    const from = point(command.from);
    const to = point(command.to);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.lineCap = 'round';
    context.lineWidth = command.width * from.unit * ((command.from.scale + command.to.scale) / 2);
    context.strokeStyle = command.part === 'forearm'
      ? '#b6c3d7'
      : command.part === 'upperArm' ? '#667a99' : command.part === 'spine' ? '#263753' : '#3b4c69';
    context.stroke();
    context.strokeStyle = '#0b1018';
    context.lineWidth *= 0.18;
    context.stroke();
    return;
  }

  const center = point(command.center);
  const radius = command.radius * center.unit * command.center.scale;
  if (command.kind === 'circle') {
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.fillStyle = '#c89c7b';
    context.fill();
    context.strokeStyle = '#101722';
    context.lineWidth = Math.max(3, radius * 0.2);
    context.stroke();
    return;
  }

  const gradient = context.createRadialGradient(
    center.x - radius * 0.3,
    center.y - radius * 0.35,
    radius * 0.12,
    center.x,
    center.y,
    radius
  );
  gradient.addColorStop(0, command.side === 'l' ? '#ff7777' : '#ff8b65');
  gradient.addColorStop(1, command.side === 'l' ? '#a90f26' : '#a62b18');
  context.beginPath();
  context.ellipse(center.x, center.y, radius * 1.08, radius * 0.9, command.side === 'l' ? -0.22 : 0.22, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.strokeStyle = '#35070d';
  context.lineWidth = Math.max(2, radius * 0.13);
  context.stroke();
}

function renderView(camera, canvas, pose, asset, referencePose) {
  const context = canvas.getContext('2d');
  drawStage(context, canvas.width, canvas.height, state.timeMs, asset);
  const projected = projectPose(pose.joints, camera, referencePose);
  for (const command of buildRigCommands(projected, { gloveScale: state.gloveScale })) {
    drawCommand(context, command, canvas.width, canvas.height);
  }
  context.fillStyle = '#aebbd0';
  context.font = '13px monospace';
  context.fillText(
    `${Math.round(state.timeMs)} ms · source #${pose.sourceFrame.toFixed(2)}`,
    18,
    canvas.height - 18
  );
}

function render() {
  if (!state.assets) return;
  const asset = currentAsset();
  const referencePose = samplePose(asset, 0).joints;
  const pose = samplePose(asset, state.timeMs);
  renderView('front', elements.frontCanvas, pose, asset, referencePose);
  renderView('quarter', elements.quarterCanvas, pose, asset, referencePose);
  elements.playhead.style.width = `${(state.timeMs / asset.visualRecoveryMs) * 100}%`;
  elements.status.textContent = `${state.timeMs.toFixed(1)} ms · source #${pose.sourceFrame.toFixed(2)}`;
  for (const button of elements.presets.querySelectorAll('button')) {
    button.classList.toggle('active', Math.abs(Number(button.dataset.time) - state.timeMs) < 1);
  }
}

function updateAttackUi() {
  const asset = currentAsset();
  const timing = asset.canonicalTiming;
  elements.sourceSummary.textContent = [
    `CMU ${asset.source.id}`,
    `${asset.selection.startFrame}–${asset.selection.endFrame}`,
    `visual recovery #${asset.selection.recoveryFrame}`,
    `Cue ${timing.cueAnchorMs}ms / Impact ${timing.impactMs}ms`
  ].join(' · ');
  elements.cueRegion.style.left = `${(timing.responseWindowStartMs / asset.visualRecoveryMs) * 100}%`;
  elements.cueRegion.style.width = `${((timing.responseWindowEndMs - timing.responseWindowStartMs) / asset.visualRecoveryMs) * 100}%`;
  elements.impactMarker.style.left = `${(timing.impactMs / asset.visualRecoveryMs) * 100}%`;
  const labels = {
    ready: 'Ready',
    'pre-cue': 'Cue 직전',
    cue: 'Cue',
    'pre-impact': 'Impact 직전',
    impact: 'Impact',
    recovery: 'Recovery'
  };
  elements.presets.replaceChildren(...getFreezePoints(asset).map((point) => {
    const button = document.createElement('button');
    button.dataset.time = point.timeMs;
    button.innerHTML = `<strong>${labels[point.id]}</strong><span>${point.timeMs}ms</span>`;
    button.addEventListener('click', () => {
      state.playing = false;
      state.timeMs = point.timeMs;
      elements.play.textContent = '▶ 재생';
      render();
    });
    return button;
  }));
  render();
}

function animationLoop(timestamp) {
  if (!state.lastAnimationTime) state.lastAnimationTime = timestamp;
  const delta = (timestamp - state.lastAnimationTime) * state.playbackSpeed;
  state.lastAnimationTime = timestamp;
  if (state.playing) {
    state.timeMs += delta;
    const duration = currentAsset().visualRecoveryMs;
    if (state.timeMs >= duration) {
      state.timeMs = state.looping ? 0 : duration;
      if (!state.looping) {
        state.playing = false;
        elements.play.textContent = '▶ 재생';
      }
    }
  }
  render();
  requestAnimationFrame(animationLoop);
}

function bindControls() {
  for (const button of document.querySelectorAll('[data-attack]')) {
    button.addEventListener('click', () => {
      document.querySelector('[data-attack].active')?.classList.remove('active');
      button.classList.add('active');
      state.attackKey = button.dataset.attack;
      state.timeMs = 0;
      state.playing = false;
      elements.play.textContent = '▶ 재생';
      updateAttackUi();
    });
  }
  for (const button of document.querySelectorAll('[data-glove-scale]')) {
    button.addEventListener('click', () => {
      document.querySelector('[data-glove-scale].active')?.classList.remove('active');
      button.classList.add('active');
      state.gloveScale = Number(button.dataset.gloveScale);
      render();
    });
  }
  elements.play.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing && state.timeMs >= currentAsset().visualRecoveryMs) state.timeMs = 0;
    elements.play.textContent = state.playing ? '⏸ 일시정지' : '▶ 재생';
  });
  elements.loop.addEventListener('click', () => {
    state.looping = !state.looping;
    elements.loop.classList.toggle('active', state.looping);
    elements.loop.textContent = state.looping ? '🔁 반복 On' : '반복 Off';
  });
  elements.speed.addEventListener('change', () => { state.playbackSpeed = Number(elements.speed.value); });
  document.querySelector('#stepBack').addEventListener('click', () => {
    state.playing = false;
    state.timeMs = Math.max(0, state.timeMs - 1000 / currentAsset().sourceFps);
    elements.play.textContent = '▶ 재생';
    render();
  });
  document.querySelector('#stepForward').addEventListener('click', () => {
    state.playing = false;
    state.timeMs = Math.min(currentAsset().visualRecoveryMs, state.timeMs + 1000 / currentAsset().sourceFps);
    elements.play.textContent = '▶ 재생';
    render();
  });
  elements.timeline.addEventListener('click', (event) => {
    const bounds = elements.timeline.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    state.timeMs = ratio * currentAsset().visualRecoveryMs;
    state.playing = false;
    elements.play.textContent = '▶ 재생';
    render();
  });
}

try {
  state.assets = await loadMotionAssets();
  bindControls();
  updateAttackUi();
  requestAnimationFrame(animationLoop);
} catch (error) {
  elements.status.textContent = `로드 실패: ${error.message}. 저장소 루트에서 로컬 HTTP 서버로 실행하세요.`;
  console.error(error);
}
