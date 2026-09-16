export const JOINT_NAMES = [
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  'lHip',
  'lKnee',
  'lAnkle',
  'lToe',
  'rHip',
  'rKnee',
  'rAnkle',
  'rToe',
  'lShoulder',
  'lElbow',
  'lHand',
  'rShoulder',
  'rElbow',
  'rHand',
] as const;

export type JointName = (typeof JOINT_NAMES)[number];
export type Vector3 = readonly [number, number, number];
export type JointPose = Record<JointName, Vector3>;

export interface MotionFrame {
  readonly sourceFrame: number;
  readonly joints: JointPose;
}

export interface MotionTimelinePoint {
  readonly timeMs: number;
  readonly sourceFrame: number;
}

export interface MotionAsset {
  readonly attackId: string;
  readonly source: {
    readonly id: string;
  };
  readonly visualRecoveryMs: number;
  readonly timeline: readonly MotionTimelinePoint[];
  readonly jointNames: readonly JointName[];
  readonly frames: readonly MotionFrame[];
}

export interface SampledPose {
  readonly attackId: string;
  readonly timeMs: number;
  readonly sourceFrame: number;
  readonly joints: JointPose;
}

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly scale: number;
}

export type ProjectedPose = Record<JointName, ProjectedPoint>;

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly scale: number;
}

export type ScreenPose = Record<JointName, ScreenPoint>;

export type RigPart =
  | 'torso'
  | 'neck'
  | 'head'
  | 'upperArm'
  | 'forearm'
  | 'glove'
  | 'thigh'
  | 'shin'
  | 'foot';

export interface CapsuleRigCommand {
  readonly kind: 'capsule';
  readonly part: RigPart;
  readonly side: 'left' | 'right' | 'center';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotationDeg: number;
  readonly depth: number;
  readonly color: string;
}

export interface CircleRigCommand {
  readonly kind: 'circle';
  readonly part: 'head' | 'glove';
  readonly side: 'left' | 'right' | 'center';
  readonly x: number;
  readonly y: number;
  readonly diameter: number;
  readonly depth: number;
  readonly color: string;
}

export type RigCommand = CapsuleRigCommand | CircleRigCommand;
