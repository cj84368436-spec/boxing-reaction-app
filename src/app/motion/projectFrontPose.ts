import {
  JOINT_NAMES,
  type JointPose,
  type ProjectedPose,
  type ScreenPose,
  type Vector3,
} from './types.js';

const EPSILON = 1e-9;

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: Vector3, factor: number): Vector3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < EPSILON) {
    throw new Error('Cannot project a pose with a zero camera vector');
  }
  return scale(vector, 1 / length);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function projectFrontPose(pose: JointPose, ready: JointPose = pose): ProjectedPose {
  const up = normalize(subtract(ready.neck, ready.pelvis));
  const shoulderAxis = normalize(subtract(ready.lShoulder, ready.rShoulder));
  const viewForward = normalize(cross(shoulderAxis, up));
  const viewRight = normalize(cross(up, viewForward));
  const center = ready.pelvis;
  const focalLength = 18;
  const projected = {} as ProjectedPose;

  for (const joint of JOINT_NAMES) {
    const local = subtract(pose[joint], center);
    const depth = dot(local, viewForward);
    const perspectiveScale = clamp(focalLength / (focalLength - depth * 0.72), 0.65, 1.9);
    projected[joint] = {
      x: dot(local, viewRight) * perspectiveScale,
      y: dot(local, up) * perspectiveScale,
      depth,
      scale: perspectiveScale,
    };
  }
  return projected;
}

export function fitProjectedPose(
  pose: ProjectedPose,
  width: number,
  height: number,
  padding: number,
  reference: ProjectedPose = pose,
): ScreenPose {
  if (width <= padding * 2 || height <= padding * 2) {
    throw new Error('Rig viewport must be larger than its padding');
  }

  const xs = JOINT_NAMES.map((joint) => reference[joint].x);
  const ys = JOINT_NAMES.map((joint) => reference[joint].y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const spanX = maximumX - minimumX;
  const spanY = maximumY - minimumY;
  if (spanX < EPSILON || spanY < EPSILON) {
    throw new Error('Projected pose must have non-zero width and height');
  }

  const fitScale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const centerX = (minimumX + maximumX) / 2;
  const contentHeight = spanY * fitScale;
  const top = (height - contentHeight) / 2;
  const fitted = {} as ScreenPose;

  for (const joint of JOINT_NAMES) {
    const point = pose[joint];
    fitted[joint] = {
      x: width / 2 + (point.x - centerX) * fitScale,
      y: top + (maximumY - point.y) * fitScale,
      depth: point.depth,
      scale: point.scale,
    };
  }
  return fitted;
}
