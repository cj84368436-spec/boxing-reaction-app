import {
  JOINT_NAMES,
  type JointPose,
  type MotionAsset,
  type MotionFrame,
  type SampledPose,
  type Vector3,
} from './types.js';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolateVector(from: Vector3, to: Vector3, amount: number): Vector3 {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

function sourceFrameAtTime(asset: MotionAsset, timeMs: number): number {
  const first = asset.timeline[0];
  const last = asset.timeline.at(-1);
  if (first == null || last == null) {
    throw new Error('Motion timeline must contain at least one point');
  }

  const bounded = clamp(timeMs, first.timeMs, last.timeMs);
  for (let index = 0; index < asset.timeline.length - 1; index += 1) {
    const from = asset.timeline[index];
    const to = asset.timeline[index + 1];
    if (from == null || to == null) {
      throw new Error('Motion timeline contains an invalid gap');
    }
    if (bounded <= to.timeMs) {
      const span = to.timeMs - from.timeMs;
      const amount = span === 0 ? 0 : (bounded - from.timeMs) / span;
      return from.sourceFrame + (to.sourceFrame - from.sourceFrame) * amount;
    }
  }
  return last.sourceFrame;
}

function cloneFiniteVector(frame: MotionFrame, joint: (typeof JOINT_NAMES)[number]): Vector3 {
  const vector = frame.joints[joint];
  if (vector == null || vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new Error(`Motion joint ${joint} must contain finite XYZ data`);
  }
  return [vector[0], vector[1], vector[2]];
}

export function sampleMotionPose(asset: MotionAsset, elapsedMs: number): SampledPose {
  if (!Number.isFinite(elapsedMs)) {
    throw new Error('Motion elapsed time must be finite');
  }
  if (asset.jointNames.length !== JOINT_NAMES.length) {
    throw new Error(`Expected ${JOINT_NAMES.length} motion joints`);
  }

  const bounded = clamp(elapsedMs, 0, asset.visualRecoveryMs);
  const sourceFrame = sourceFrameAtTime(asset, bounded);
  let upperIndex = asset.frames.findIndex((frame) => frame.sourceFrame >= sourceFrame);
  if (upperIndex < 0) {
    upperIndex = asset.frames.length - 1;
  }
  const lowerIndex = Math.max(0, upperIndex - 1);
  const lower = asset.frames[lowerIndex];
  const upper = asset.frames[upperIndex];
  if (lower == null || upper == null) {
    throw new Error('Motion asset must contain frames');
  }

  const span = upper.sourceFrame - lower.sourceFrame;
  const amount = span === 0 ? 0 : (sourceFrame - lower.sourceFrame) / span;
  const joints = {} as JointPose;
  for (const joint of JOINT_NAMES) {
    joints[joint] = interpolateVector(
      cloneFiniteVector(lower, joint),
      cloneFiniteVector(upper, joint),
      amount,
    );
  }

  return { attackId: asset.attackId, timeMs: bounded, sourceFrame, joints };
}
