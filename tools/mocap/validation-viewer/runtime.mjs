const EPSILON = 1e-9;

export const MOTION_ASSET_URLS = Object.freeze({
  jab: new URL('../../../src/game/assets/motion/lead-jab.json', import.meta.url),
  straight: new URL('../../../src/game/assets/motion/rear-straight.json', import.meta.url),
  hook: new URL('../../../src/game/assets/motion/lead-hook.json', import.meta.url)
});

const EXPECTED_ATTACK_IDS = Object.freeze({
  jab: 'LEAD_JAB_HEAD',
  straight: 'REAR_STRAIGHT_HEAD',
  hook: 'LEAD_HOOK_HEAD'
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function scale(vector, factor) {
  return vector.map((value) => value * factor);
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  if (length < EPSILON) throw new Error('Cannot normalize a zero vector');
  return scale(vector, 1 / length);
}

function interpolate(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

function sourceFrameAtTime(timeline, timeMs) {
  const bounded = clamp(timeMs, timeline[0].timeMs, timeline.at(-1).timeMs);
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const from = timeline[index];
    const to = timeline[index + 1];
    if (bounded <= to.timeMs) {
      const amount = (bounded - from.timeMs) / (to.timeMs - from.timeMs);
      return from.sourceFrame + (to.sourceFrame - from.sourceFrame) * amount;
    }
  }
  return timeline.at(-1).sourceFrame;
}

export async function loadMotionAssets(fetcher = fetch) {
  const entries = await Promise.all(Object.entries(MOTION_ASSET_URLS).map(async ([key, url]) => {
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status ?? 'unknown'}`);
    const asset = await response.json();
    if (asset.attackId !== EXPECTED_ATTACK_IDS[key]) {
      throw new Error(`Unexpected attackId for ${key}: ${asset.attackId}`);
    }
    return [key, asset];
  }));
  return Object.fromEntries(entries);
}

export function samplePose(data, timeMs) {
  const bounded = clamp(timeMs, 0, data.visualRecoveryMs);
  const sourceFrame = sourceFrameAtTime(data.timeline, bounded);
  let upperIndex = data.frames.findIndex((frame) => frame.sourceFrame >= sourceFrame);
  if (upperIndex < 0) upperIndex = data.frames.length - 1;
  const lowerIndex = Math.max(0, upperIndex - 1);
  const lower = data.frames[lowerIndex];
  const upper = data.frames[upperIndex];
  const span = upper.sourceFrame - lower.sourceFrame;
  const amount = span === 0 ? 0 : (sourceFrame - lower.sourceFrame) / span;
  const joints = {};
  for (const joint of data.jointNames) {
    joints[joint] = interpolate(lower.joints[joint], upper.joints[joint], amount);
  }
  return { tMs: bounded, sourceFrame, joints };
}

function cameraBasis(pose, camera = 'front') {
  const up = normalize(subtract(pose.neck, pose.pelvis));
  const shoulderAxis = normalize(subtract(pose.lShoulder, pose.rShoulder));
  const forward = normalize(cross(shoulderAxis, up));
  const angle = camera === 'quarter' ? Math.PI / 4 : 0;
  const viewForward = normalize(add(
    scale(forward, Math.cos(angle)),
    scale(shoulderAxis, -Math.sin(angle))
  ));
  const viewRight = normalize(cross(up, viewForward));
  return { up, viewForward, viewRight };
}

export function projectPose(pose, camera = 'front', referencePose = pose) {
  const center = referencePose.pelvis;
  const basis = cameraBasis(referencePose, camera);
  const focalLength = 18;
  const projected = {};
  for (const [joint, point] of Object.entries(pose)) {
    const local = subtract(point, center);
    const depth = dot(local, basis.viewForward);
    const perspectiveScale = clamp(focalLength / (focalLength - depth * 0.72), 0.65, 1.9);
    projected[joint] = {
      x: dot(local, basis.viewRight) * perspectiveScale,
      y: dot(local, basis.up) * perspectiveScale,
      depth,
      scale: perspectiveScale
    };
  }
  return projected;
}

function segment(part, from, to, width, side) {
  return { kind: 'segment', part, from, to, width, side, depth: (from.depth + to.depth) / 2 };
}

function projectedDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildRigCommands(projectedPose, options = {}) {
  const gloveScale = options.gloveScale ?? 1;
  if (gloveScale < 1 || gloveScale > 1.5) {
    throw new Error('gloveScale must be between 1.0 and 1.5');
  }

  const pose = projectedPose;
  const commands = [{
    kind: 'polygon',
    part: 'torso',
    points: [pose.lShoulder, pose.rShoulder, pose.rHip, pose.pelvis, pose.lHip],
    depth: (pose.chest.depth + pose.pelvis.depth) / 2
  }];
  commands.push(segment('spine', pose.pelvis, pose.chest, 0.48, 'center'));
  commands.push(segment('neck', pose.chest, pose.neck, 0.27, 'center'));
  commands.push({
    kind: 'circle',
    part: 'head',
    center: pose.head,
    radius: Math.max(0.55, projectedDistance(pose.neck, pose.head) * 0.92),
    depth: pose.head.depth
  });

  for (const side of ['l', 'r']) {
    commands.push(segment('upperArm', pose[`${side}Shoulder`], pose[`${side}Elbow`], 0.38, side));
    commands.push(segment('forearm', pose[`${side}Elbow`], pose[`${side}Hand`], 0.32, side));
    commands.push({
      kind: 'glove',
      part: 'glove',
      side,
      center: pose[`${side}Hand`],
      radius: Math.max(
        0.42,
        projectedDistance(pose[`${side}Elbow`], pose[`${side}Hand`]) * 0.27
      ) * gloveScale,
      gloveScale,
      depth: pose[`${side}Hand`].depth
    });
    commands.push(segment('leg', pose[`${side}Hip`], pose[`${side}Knee`], 0.48, side));
    commands.push(segment('leg', pose[`${side}Knee`], pose[`${side}Ankle`], 0.39, side));
    commands.push(segment('foot', pose[`${side}Ankle`], pose[`${side}Toe`], 0.31, side));
  }
  return commands.sort((a, b) => a.depth - b.depth);
}

export function getFreezePoints(data) {
  const timing = data.canonicalTiming;
  return [
    { id: 'ready', timeMs: 0 },
    { id: 'pre-cue', timeMs: Math.max(0, timing.cueAnchorMs - 20) },
    { id: 'cue', timeMs: timing.cueAnchorMs },
    { id: 'pre-impact', timeMs: timing.responseWindowEndMs },
    { id: 'impact', timeMs: timing.impactMs },
    { id: 'recovery', timeMs: data.visualRecoveryMs }
  ];
}
