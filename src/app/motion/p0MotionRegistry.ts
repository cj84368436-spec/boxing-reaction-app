import leadHookJson from '../../game/assets/motion/lead-hook.json';
import leadJabJson from '../../game/assets/motion/lead-jab.json';
import rearStraightJson from '../../game/assets/motion/rear-straight.json';
import { sampleMotionPose } from './sampleMotionPose';
import type { MotionAsset, SampledPose } from './types';

const ASSETS = {
  LEAD_JAB_HEAD: leadJabJson as unknown as MotionAsset,
  REAR_STRAIGHT_HEAD: rearStraightJson as unknown as MotionAsset,
  LEAD_HOOK_HEAD: leadHookJson as unknown as MotionAsset,
} as const;

export function getP0MotionAsset(attackId: string): MotionAsset {
  const asset = ASSETS[attackId as keyof typeof ASSETS];
  if (asset == null || asset.attackId !== attackId) {
    throw new Error(`No canonical P0 motion asset for ${attackId}`);
  }
  return asset;
}

export function getP0MotionSourceIds(): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(ASSETS).map(([attackId, asset]) => [attackId, asset.source.id]),
  );
}

export function sampleP0AttackPose(attackId: string, elapsedMs: number): SampledPose {
  return sampleMotionPose(getP0MotionAsset(attackId), elapsedMs);
}
