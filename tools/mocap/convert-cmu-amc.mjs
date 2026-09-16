import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifySourceFile } from './source-integrity.mjs';

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function multiplyMatrix(a, b) {
  const out = new Array(9).fill(0);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      for (let k = 0; k < 3; k += 1) {
        out[row * 3 + column] += a[row * 3 + k] * b[k * 3 + column];
      }
    }
  }
  return out;
}

function transposeMatrix(matrix) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8]
  ];
}

function rotateVector(matrix, vector) {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2]
  ];
}

function axisRotation(axis, degrees) {
  const radians = degrees * Math.PI / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  if (axis === 'z') return [c, -s, 0, s, c, 0, 0, 0, 1];
  throw new Error(`Unsupported rotation axis: ${axis}`);
}

function orderedRotation(order, valuesByAxis) {
  let rotation = IDENTITY;
  for (const rawAxis of order) {
    const axis = rawAxis.toLowerCase();
    rotation = multiplyMatrix(axisRotation(axis, valuesByAxis[axis] ?? 0), rotation);
  }
  return rotation;
}

function numericValues(parts) {
  return parts.map(Number).filter(Number.isFinite);
}

export function parseAsf(text) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim());
  const skeleton = {
    lengthScale: 1,
    root: { order: ['tx', 'ty', 'tz', 'rx', 'ry', 'rz'], axisOrder: 'XYZ', orientation: [0, 0, 0] },
    bones: {},
    hierarchy: { root: [] }
  };

  let section = '';
  let bone = null;
  let inHierarchy = false;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(':')) {
      section = line.toLowerCase();
      inHierarchy = false;
      continue;
    }
    const parts = line.split(/\s+/);

    if (section === ':units' && parts[0].toLowerCase() === 'length') {
      skeleton.lengthScale = Number(parts[1]);
      continue;
    }
    if (section === ':root') {
      const key = parts[0].toLowerCase();
      if (key === 'order') skeleton.root.order = parts.slice(1).map((part) => part.toLowerCase());
      else if (key === 'axis') skeleton.root.axisOrder = parts[1];
      else if (key === 'orientation') skeleton.root.orientation = numericValues(parts.slice(1));
      continue;
    }
    if (section === ':bonedata') {
      const key = parts[0].toLowerCase();
      if (key === 'begin') {
        bone = { name: '', direction: [0, 0, 0], length: 0, axis: [0, 0, 0], axisOrder: 'XYZ', dof: [], parent: null };
      } else if (key === 'end' && bone) {
        skeleton.bones[bone.name] = bone;
        bone = null;
      } else if (bone) {
        if (key === 'name') bone.name = parts[1];
        else if (key === 'direction') bone.direction = numericValues(parts.slice(1, 4));
        else if (key === 'length') bone.length = Number(parts[1]) * skeleton.lengthScale;
        else if (key === 'axis') {
          bone.axis = numericValues(parts.slice(1, 4));
          bone.axisOrder = parts[4] ?? 'XYZ';
        } else if (key === 'dof') bone.dof = parts.slice(1).map((part) => part.toLowerCase());
      }
      continue;
    }
    if (section === ':hierarchy') {
      if (parts[0].toLowerCase() === 'begin') {
        inHierarchy = true;
        continue;
      }
      if (parts[0].toLowerCase() === 'end') {
        inHierarchy = false;
        continue;
      }
      if (inHierarchy) {
        const [parent, ...children] = parts;
        skeleton.hierarchy[parent] = children;
        for (const child of children) {
          if (!skeleton.bones[child]) throw new Error(`Hierarchy references missing bone: ${child}`);
          skeleton.bones[child].parent = parent;
        }
      }
    }
  }

  if (Object.keys(skeleton.bones).length === 0) throw new Error('ASF contains no bones');
  return skeleton;
}

export function parseAmc(text) {
  const frames = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(':')) continue;
    if (/^\d+$/.test(line)) {
      current = { number: Number(line), channels: {} };
      frames.push(current);
      continue;
    }
    if (!current) throw new Error('AMC channel encountered before first frame');
    const [name, ...values] = line.split(/\s+/);
    current.channels[name] = numericValues(values);
  }
  if (frames.length === 0) throw new Error('AMC contains no frames');
  return frames;
}

function channelRotation(dof, values) {
  const byAxis = {};
  const order = [];
  for (let index = 0; index < dof.length; index += 1) {
    const axis = dof[index];
    if (axis.startsWith('r')) {
      const shortAxis = axis[1];
      order.push(shortAxis);
      byAxis[shortAxis] = values[index] ?? 0;
    }
  }
  return orderedRotation(order, byAxis);
}

function rootTransform(skeleton, frame) {
  const values = frame.channels.root ?? [];
  const translation = [0, 0, 0];
  const rotations = {};
  const rotationOrder = [];
  skeleton.root.order.forEach((channel, index) => {
    const value = values[index] ?? 0;
    if (channel[0] === 't') translation['xyz'.indexOf(channel[1])] = value * skeleton.lengthScale;
    if (channel[0] === 'r') {
      rotationOrder.push(channel[1]);
      rotations[channel[1]] = value;
    }
  });
  const rootAxis = orderedRotation(skeleton.root.axisOrder, {
    x: skeleton.root.orientation[0],
    y: skeleton.root.orientation[1],
    z: skeleton.root.orientation[2]
  });
  return {
    position: translation,
    rotation: multiplyMatrix(rootAxis, orderedRotation(rotationOrder, rotations))
  };
}

export function forwardKinematics(skeleton, frame) {
  const root = rootTransform(skeleton, frame);
  const points = { root: [...root.position] };
  const orientations = { root: root.rotation };

  const visit = (name) => {
    const bone = skeleton.bones[name];
    const parentName = bone.parent ?? 'root';
    if (parentName !== 'root' && !points[parentName]) visit(parentName);
    const parentPosition = points[parentName] ?? root.position;
    const parentRotation = orientations[parentName] ?? root.rotation;
    const axis = orderedRotation(bone.axisOrder, { x: bone.axis[0], y: bone.axis[1], z: bone.axis[2] });
    const motion = channelRotation(bone.dof, frame.channels[name] ?? []);
    const localRotation = multiplyMatrix(multiplyMatrix(axis, motion), transposeMatrix(axis));
    const globalRotation = multiplyMatrix(parentRotation, localRotation);
    const extent = rotateVector(globalRotation, bone.direction.map((value) => value * bone.length));
    points[name] = parentPosition.map((value, index) => value + extent[index]);
    orientations[name] = globalRotation;
  };

  for (const name of Object.keys(skeleton.bones)) visit(name);
  return points;
}

export const JOINT_MAP = Object.freeze({
  pelvis: 'root',
  spine: 'lowerback',
  chest: 'thorax',
  neck: 'upperneck',
  head: 'head',
  lHip: 'lhipjoint',
  lKnee: 'lfemur',
  lAnkle: 'ltibia',
  lToe: 'ltoes',
  rHip: 'rhipjoint',
  rKnee: 'rfemur',
  rAnkle: 'rtibia',
  rToe: 'rtoes',
  lShoulder: 'lclavicle',
  lElbow: 'lhumerus',
  lHand: 'lhand',
  rShoulder: 'rclavicle',
  rElbow: 'rhumerus',
  rHand: 'rhand'
});

export function selectJoints(points, jointMap = JOINT_MAP) {
  return Object.fromEntries(Object.entries(jointMap).map(([joint, bone]) => {
    if (!points[bone]) throw new Error(`Missing source bone for ${joint}: ${bone}`);
    return [joint, points[bone].map((value) => Number(value.toFixed(6)))];
  }));
}

function validateIntegerAnchor(frame, name, start, end) {
  if (!Number.isInteger(frame) || frame < start || frame > end) {
    throw new Error(`${name} frame must be an integer inside the selected range`);
  }
}

export async function convertAsfAmc({
  asfPath,
  amcPath,
  asfSha256,
  amcSha256,
  outputPath,
  attackId,
  attackName,
  sourceId,
  asfUrl,
  amcUrl,
  attribution,
  sourceFps = 120,
  frameStart,
  frameEnd,
  readyFrame = frameStart,
  cueFrame,
  impactFrame,
  recoveryFrame = frameEnd,
  canonicalTiming,
  visualRecoveryMs
}) {
  await verifySourceFile(asfPath, asfSha256, `${attackId ?? sourceId} ASF`);
  await verifySourceFile(amcPath, amcSha256, `${attackId ?? sourceId} AMC`);
  const [asfText, amcText] = await Promise.all([
    readFile(asfPath, 'utf8'),
    readFile(amcPath, 'utf8')
  ]);
  const skeleton = parseAsf(asfText);
  const sourceFrames = parseAmc(amcText);
  const start = Number(frameStart);
  const end = Number(frameEnd);
  const selected = sourceFrames.filter((frame) => frame.number >= start && frame.number <= end);
  if (selected.length !== end - start + 1) throw new Error(`Expected ${end - start + 1} source frames, got ${selected.length}`);
  validateIntegerAnchor(readyFrame, 'Ready', start, end);
  validateIntegerAnchor(cueFrame, 'Cue', start, end);
  validateIntegerAnchor(impactFrame, 'Impact', start, end);
  validateIntegerAnchor(recoveryFrame, 'Recovery', start, end);
  if (!(readyFrame < cueFrame && cueFrame < impactFrame && impactFrame < recoveryFrame)) {
    throw new Error('Expected ready < cue < impact < recovery source frames');
  }

  const data = {
    schemaVersion: 1,
    attackId,
    attackName,
    source: {
      id: sourceId,
      database: 'Carnegie Mellon University Motion Capture Database',
      asfUrl,
      amcUrl,
      attribution
    },
    sourceFps,
    selection: { startFrame: start, endFrame: end, readyFrame, cueFrame, impactFrame, recoveryFrame },
    canonicalTiming,
    visualRecoveryMs,
    timeline: [
      { label: 'ready', sourceFrame: readyFrame, timeMs: 0 },
      { label: 'cue', sourceFrame: cueFrame, timeMs: canonicalTiming.cueAnchorMs },
      { label: 'impact', sourceFrame: impactFrame, timeMs: canonicalTiming.impactMs },
      { label: 'recovery', sourceFrame: recoveryFrame, timeMs: visualRecoveryMs }
    ],
    jointNames: Object.keys(JOINT_MAP),
    frames: selected.map((frame) => ({ sourceFrame: frame.number, joints: selectJoints(forwardKinematics(skeleton, frame)) }))
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

function parseCliOptions(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith('--')) throw new Error(`Unexpected argument: ${flag}`);
    options[flag.slice(2)] = argv[index + 1];
  }
  return options;
}

async function main(argv) {
  const options = parseCliOptions(argv);
  const required = [
    'asf', 'amc', 'asf-sha256', 'amc-sha256', 'out', 'source', 'start', 'end', 'cue', 'impact'
  ];
  for (const key of required) if (!options[key]) throw new Error(`Missing --${key}`);

  const [subject] = options.source.split('_');
  const cueAnchorMs = Number(options['cue-ms'] ?? 120);
  const impactMs = Number(options['impact-ms'] ?? 480);
  await convertAsfAmc({
    asfPath: options.asf,
    amcPath: options.amc,
    asfSha256: options['asf-sha256'],
    amcSha256: options['amc-sha256'],
    outputPath: options.out,
    attackId: options['attack-id'] ?? options.source,
    attackName: options['attack-name'] ?? options.source,
    sourceId: options.source,
    asfUrl: options['asf-url'] ?? `https://mocap.cs.cmu.edu/subjects/${subject}/${subject}.asf`,
    amcUrl: options['amc-url'] ?? `https://mocap.cs.cmu.edu/subjects/${subject}/${options.source}.amc`,
    attribution: options.attribution ?? 'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.',
    sourceFps: Number(options.fps ?? 120),
    frameStart: Number(options.start),
    frameEnd: Number(options.end),
    readyFrame: Number(options.ready ?? options.start),
    cueFrame: Number(options.cue),
    impactFrame: Number(options.impact),
    recoveryFrame: Number(options.recovery ?? options.end),
    canonicalTiming: {
      cueAnchorMs,
      impactMs,
      responseWindowStartMs: Number(options['response-start-ms'] ?? cueAnchorMs),
      responseWindowEndMs: Number(options['response-end-ms'] ?? impactMs)
    },
    visualRecoveryMs: Number(options['visual-recovery-ms'] ?? 760)
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
