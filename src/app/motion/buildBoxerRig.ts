import type {
  CapsuleRigCommand,
  CircleRigCommand,
  RigCommand,
  RigPart,
  ScreenPoint,
  ScreenPose,
} from './types.js';

const COLORS = {
  skin: '#D7A07B',
  shirt: '#243B53',
  shorts: '#16283B',
  limb: '#C8845F',
  glove: '#E5484D',
  shoe: '#101923',
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function distance(from: ScreenPoint, to: ScreenPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function depthScale(point: ScreenPoint, reference: ScreenPoint, minimum: number, maximum: number): number {
  const ratio = reference.scale === 0 ? 1 : point.scale / reference.scale;
  return clamp(ratio, minimum, maximum);
}

function capsule(
  part: RigPart,
  side: CapsuleRigCommand['side'],
  from: ScreenPoint,
  to: ScreenPoint,
  height: number,
  color: string,
): CapsuleRigCommand {
  const width = distance(from, to) + height;
  return {
    kind: 'capsule',
    part,
    side,
    x: (from.x + to.x) / 2 - width / 2,
    y: (from.y + to.y) / 2 - height / 2,
    width,
    height,
    rotationDeg: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
    depth: (from.depth + to.depth) / 2,
    color,
  };
}

function circle(
  part: CircleRigCommand['part'],
  side: CircleRigCommand['side'],
  center: ScreenPoint,
  diameter: number,
  color: string,
): CircleRigCommand {
  return {
    kind: 'circle',
    part,
    side,
    x: center.x - diameter / 2,
    y: center.y - diameter / 2,
    diameter,
    depth: center.depth,
    color,
  };
}

export function buildBoxerRig(pose: ScreenPose): readonly RigCommand[] {
  const commands: RigCommand[] = [
    capsule('torso', 'center', pose.lShoulder, pose.rShoulder, 44, COLORS.shirt),
    capsule('torso', 'center', pose.chest, pose.pelvis, 60, COLORS.shirt),
    capsule('torso', 'left', pose.lShoulder, pose.pelvis, 34, COLORS.shirt),
    capsule('torso', 'right', pose.rShoulder, pose.pelvis, 34, COLORS.shirt),
    capsule('neck', 'center', pose.chest, pose.neck, 18, COLORS.skin),
    circle(
      'head',
      'center',
      pose.head,
      clamp(distance(pose.neck, pose.head) * 1.75, 44, 66),
      COLORS.skin,
    ),
  ];

  const sides = [
    { prefix: 'l' as const, side: 'left' as const },
    { prefix: 'r' as const, side: 'right' as const },
  ];

  for (const { prefix, side } of sides) {
    const shoulder = pose[`${prefix}Shoulder`];
    const elbow = pose[`${prefix}Elbow`];
    const hand = pose[`${prefix}Hand`];
    const hip = pose[`${prefix}Hip`];
    const knee = pose[`${prefix}Knee`];
    const ankle = pose[`${prefix}Ankle`];
    const toe = pose[`${prefix}Toe`];
    const handDepthScale = depthScale(hand, pose.chest, 0.9, 1.5);
    const forearmDepthScale = clamp(
      (depthScale(elbow, pose.chest, 0.9, 1.2) + depthScale(hand, pose.chest, 0.9, 1.2)) / 2,
      0.9,
      1.2,
    );

    commands.push(capsule('upperArm', side, shoulder, elbow, 20, COLORS.limb));
    commands.push(capsule('forearm', side, elbow, hand, 17 * forearmDepthScale, COLORS.limb));
    commands.push(
      circle(
        'glove',
        side,
        hand,
        clamp(44 * handDepthScale, 36, 66),
        COLORS.glove,
      ),
    );
    commands.push(capsule('thigh', side, hip, knee, 28, COLORS.shorts));
    commands.push(capsule('shin', side, knee, ankle, 22, COLORS.limb));
    commands.push(capsule('foot', side, ankle, toe, 18, COLORS.shoe));
  }

  // Clothing is a single silhouette; round gloves cover their own forearm ends.
  const layer = (part: RigPart) => part === 'neck' ? -1 : part === 'glove' ? 3 : ['upperArm', 'forearm'].includes(part) ? 2 : part === 'head' ? 1 : 0;
  return commands.sort((a, b) => layer(a.part) - layer(b.part) || a.depth - b.depth);
}
