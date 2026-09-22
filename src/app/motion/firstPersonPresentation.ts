import { candidateCombatPose } from './candidateCombatPose.js';
import { candidateFailureReason } from '../session/candidateRules.js';
import { P0_ATTACKS } from '../../game/config/p0Attacks.js';
import type { TenPunchSessionSnapshot } from '../session/P0TenPunchSession.js';
import { projectFrontPose } from './projectFrontPose.js';
import { sampleMotionPose } from './sampleMotionPose.js';
import { JOINT_NAMES, type MotionAsset, type ScreenPose } from './types.js';

export const COMBAT_VIEW = { width: 280, height: 400, targetX: 140, targetY: 165 } as const;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

// A fixed camera sits just beyond the contact plane, facing the Ready head.
// Calibration changes the viewpoint, never the source joints or punch trajectory.
const calibrations = new WeakMap<MotionAsset, {
  ready: ReturnType<typeof sampleMotionPose>['joints'];
  hx: number; hz: number; rightX: number; rightZ: number;
  forwardX: number; forwardZ: number; eyeDepth: number; eyeY: number;
  offsetY: number; focal: number;
}>();
// Approved 2026-09-15: source frame 275 preceded the hook sweep. Frame 289
// aligns the bent-arm contact with the unchanged 620 ms game impact.
// The original dataset, joint coordinates, Ready/cue/recovery anchors stay intact.
const presentationAssets = new WeakMap<MotionAsset, MotionAsset>();
function presentationAsset(asset: MotionAsset): MotionAsset {
  const impact = P0_ATTACKS.LEAD_HOOK_HEAD.impactMs;
  if (asset.attackId !== 'LEAD_HOOK_HEAD' || asset.source.id !== '14_01' ||
      !asset.timeline.some(p => p.timeMs === impact && p.sourceFrame === 275)) return asset;
  let calibrated = presentationAssets.get(asset);
  if (!calibrated) {
    calibrated = { ...asset, timeline: asset.timeline.map(p => p.timeMs === impact ? { ...p, sourceFrame: 289 } : p) };
    presentationAssets.set(asset, calibrated);
  }
  return calibrated;
}

export function projectCombatPose(asset: MotionAsset, elapsedMs: number): ScreenPose {
  asset = presentationAsset(asset);
  let c = calibrations.get(asset);
  if (!c) {
    const ready = sampleMotionPose(asset, 0).joints;
    const attack = P0_ATTACKS[asset.attackId as keyof typeof P0_ATTACKS];
    const initial = projectFrontPose(ready, ready);
    const contact = projectFrontPose(sampleMotionPose(asset, attack.impactMs).joints, ready);
    const head = initial.head;
    const hand = attack.hand === 'REAR' ? contact.rHand : contact.lHand;
    const hx = head.x / head.scale, hz = head.depth;
    const dx = hand.x / hand.scale - hx, dz = hand.depth - hz;
    const reach = Math.hypot(dx, dz);
    const forwardX = dx / reach, forwardZ = dz / reach;
    const eyeDepth = reach + 3;
    // Match Ready head size across clips with different source reach.
    const focal = eyeDepth * 35;
    // Solve the fixed camera height so Ready head=(140,100), contact=(140,165).
    // This also removes vertical jumps between independent motion recordings.
    const eyeY = (65 - 35 * head.y / head.scale + focal / 3 * hand.y / hand.scale) / (focal / 3 - 35);
    c = { ready, hx, hz, rightX: forwardZ, rightZ: -forwardX,
      forwardX, forwardZ, eyeDepth, eyeY, focal,
      offsetY: (hand.y / hand.scale - eyeY) * focal / 3 };
    calibrations.set(asset, c);
  }
  const projected = projectFrontPose(sampleMotionPose(asset, elapsedMs).joints, c.ready);
  return Object.fromEntries(JOINT_NAMES.map(joint => {
    const p = projected[joint];
    const x = p.x / p.scale - c.hx, z = p.depth - c.hz;
    const depth = x * c.forwardX + z * c.forwardZ;
    const distance = Math.max(2, c.eyeDepth - depth);
    return [joint, {
      x: COMBAT_VIEW.targetX + (x * c.rightX + z * c.rightZ) * c.focal / distance,
      y: COMBAT_VIEW.targetY - ((p.y / p.scale - c.eyeY) * c.focal / distance - c.offsetY),
      depth, scale: c.eyeDepth / distance,
    }];
  })) as ScreenPose;
}

export function getFirstPersonFrame(
  snapshot: TenPunchSessionSnapshot,
  assets: Readonly<Record<string, MotionAsset>>,
  acceptedAt: ReadonlyMap<string, number>,
) {
  // Engine advances on impact; presentation must finish the punch and recovery.
  const started = snapshot.scheduledAttacks.filter(a => a.attackStartScheduledAtMs != null && a.attackStartScheduledAtMs <= snapshot.nowMs);
  const visible = started.at(-1) ?? snapshot.scheduledAttacks[0]!;
  const attack = P0_ATTACKS[visible.attackId as keyof typeof P0_ATTACKS];
  const asset = assets[visible.attackId]!;
  const candidate = snapshot.ruleset === 'candidate';
  const project = (asset: MotionAsset, elapsed: number) => candidate ? candidateCombatPose(asset.attackId, elapsed) : projectCombatPose(asset, elapsed);
  const start = visible.attackStartScheduledAtMs ?? snapshot.nowMs;
  const elapsedMs = Math.max(0, snapshot.nowMs - start);
  const impactAt = start + attack.impactMs;
  const result = snapshot.results.find(r => r.attackInstanceId === visible.attackInstanceId);
  const inputState = result?.telemetry ?? (snapshot.currentAttack.attackInstanceId === visible.attackInstanceId ? snapshot.currentAttack : undefined);
  const input = inputState?.inputStatus === 'VALID' || (candidate && inputState?.inputStatus === 'EARLY') ? inputState.inputButton : undefined;
  const inputAt = inputState?.inputAtMs ?? result?.telemetry.inputAtMs ?? acceptedAt.get(visible.attackInstanceId) ?? snapshot.nowMs;
  const enterMs = Math.max(1, Math.min(90, impactAt - inputAt));
  const early = inputState?.inputStatus === 'EARLY';
  const strength = input == null ? 0 : ease((snapshot.nowMs - inputAt) / enterMs) * (1 - ease((snapshot.nowMs - (early ? inputAt + 100 : impactAt + 60)) / 140));
  const direction = input === 'LEFT' ? 1 : input === 'RIGHT' ? -1 : 0;
  const weaving = attack.punchType === 'HOOK' && input === 'RIGHT';
  // A lateral move into the lead hook does not clear its contact radius.
  // The right weave clears it vertically; a left attempt remains visibly caught.
  const failedStraight = candidate && attack.hand === 'REAR' && (input === 'RIGHT' || input === 'BACK');
  const clearance = failedStraight ? 18 : attack.punchType === 'HOOK' && input === 'LEFT' ? 22 : 64;
  const cameraX = strength > 0 ? direction * clearance * strength : 0;
  const cameraY = weaving && strength > 0 ? -80 * strength : 0;
  const cameraScale = input === 'BACK' ? 1 - (failedStraight ? 0.06 : 0.24) * strength : 1;
  const guard = input === 'GUARD' ? strength * (candidate && (result?.outcome === 'HIT' || (!result && snapshot.guardEnergy === 0)) ? .32 : 1) : 0;
  const age = snapshot.nowMs - impactAt;
  const hit = result?.outcome === 'HIT' && age >= 0 && age < 140;
  let pose = project(asset, elapsedMs);
  const next = snapshot.scheduledAttacks[visible.attackIndex + 1];
  if (next?.attackStartScheduledAtMs != null) {
    // The shared game schedule may start the next combo punch before the source
    // clip finishes. Blend only the recovery presentation, never the cue/impact.
    const blendStart = Math.max(impactAt + 60, Math.min(start + asset.visualRecoveryMs, next.attackStartScheduledAtMs - 100));
    const blend = ease((snapshot.nowMs - blendStart) / Math.max(1, next.attackStartScheduledAtMs - blendStart));
    const ready = project(assets[next.attackId]!, 0);
    pose = Object.fromEntries(JOINT_NAMES.map(joint => [joint, {
      x: pose[joint].x + (ready[joint].x - pose[joint].x) * blend,
      y: pose[joint].y + (ready[joint].y - pose[joint].y) * blend,
      depth: pose[joint].depth + (ready[joint].depth - pose[joint].depth) * blend,
      scale: pose[joint].scale + (ready[joint].scale - pose[joint].scale) * blend,
    }])) as ScreenPose;
  }
  const feedback = !result || age < 0 || age > 400 ? '' : result.outcome !== 'HIT'
    ? result.outcome === 'PERFECT' ? '완벽 회피' : input === 'GUARD' ? '안전 방어 · 가드' : '안전 방어'
    : result.telemetry.inputStatus === 'NO_INPUT' ? '피격 · 반응 없음'
      : result.telemetry.inputStatus === 'EARLY' ? '피격 · 너무 빠름'
        : result.telemetry.inputStatus === 'LATE' ? '피격 · 너무 늦음'
          : result.telemetry.inputStatus === 'MULTI_INPUT' ? '피격 · 하나씩 입력'
            : candidate ? '피격 · ' + candidateFailureReason(visible.attackId, input) : '피격 · 회피 방향';
  const cueActive = snapshot.nowMs >= start + attack.cueAnchorMs && age < 0;
  const hand: 'rHand' | 'lHand' = attack.hand === 'REAR' ? 'rHand' : 'lHand';
  const trail = [90, 60, 30].map(delay => project(asset, Math.max(0, elapsedMs - delay))[hand]);
  const hint = attack.punchType === 'HOOK' ? '훅 · 오른쪽으로 숙이세요'
    : attack.hand === 'REAR' ? '스트레이트 · 왼쪽으로 피하세요' : '잽 · 좌우로 피하세요';
  return { attackId: visible.attackId, elapsedMs, pose, cameraX, cameraY, cameraScale, guard, hit, feedback,
    cueActive, hand, trail, hint, contact: age >= 0 && age < 100, outcome: result?.outcome };
}
