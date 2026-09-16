import { sampleP0AttackPose } from './p0MotionRegistry';
import type { SampledPose } from './types';

export function sampleLeadJabReadyPose(): SampledPose {
  return sampleLeadJabPose(0);
}

export function sampleLeadJabPose(elapsedMs: number): SampledPose {
  return sampleP0AttackPose('LEAD_JAB_HEAD', elapsedMs);
}
