import { buildBoxerRig } from '../motion/buildBoxerRig';
import {
  sampleLeadJabPose,
  sampleLeadJabReadyPose,
} from '../motion/leadJabReadyPose';
import { fitProjectedPose, projectFrontPose } from '../motion/projectFrontPose';
import {
  getP0MotionSourceIds,
  sampleP0AttackPose,
} from '../motion/p0MotionRegistry';

const EXPECTED_JOINTS = [
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

describe('Lead Jab Ready pose pipeline', () => {
  it('loads the canonical 0ms frame as finite 19-joint data', () => {
    const pose = sampleLeadJabReadyPose();

    expect(pose.attackId).toBe('LEAD_JAB_HEAD');
    expect(pose.timeMs).toBe(0);
    expect(Object.keys(pose.joints)).toEqual(EXPECTED_JOINTS);

    for (const joint of EXPECTED_JOINTS) {
      expect(pose.joints[joint]).toHaveLength(3);
      expect(pose.joints[joint].every(Number.isFinite)).toBe(true);
    }
  });

  it('samples canonical cue, impact, and visual recovery source frames by game time', () => {
    expect(sampleLeadJabPose(120).sourceFrame).toBe(1092);
    expect(sampleLeadJabPose(480).sourceFrame).toBe(1116);
    expect(sampleLeadJabPose(760).sourceFrame).toBe(1156);
  });

  it('clamps playback to Ready before start and visual recovery after the asset ends', () => {
    expect(sampleLeadJabPose(-100).timeMs).toBe(0);
    expect(sampleLeadJabPose(-100).sourceFrame).toBe(1076);
    expect(sampleLeadJabPose(5000).timeMs).toBe(760);
    expect(sampleLeadJabPose(5000).sourceFrame).toBe(1156);
  });

  it('keeps every interpolated 19-joint pose and rig command finite during playback', () => {
    for (const elapsedMs of [0, 60, 120, 300, 450, 480, 620, 760]) {
      const sampled = sampleLeadJabPose(elapsedMs);
      const fitted = fitProjectedPose(projectFrontPose(sampled.joints), 300, 430, 24);
      const commands = buildBoxerRig(fitted);

      for (const joint of EXPECTED_JOINTS) {
        expect(sampled.joints[joint].every(Number.isFinite)).toBe(true);
      }
      for (const command of commands) {
        expect(
          Object.values(command)
            .filter((value) => typeof value === 'number')
            .every(Number.isFinite),
        ).toBe(true);
      }
    }
  });

  it('projects and fits every joint inside a 300 by 430 boxer viewport', () => {
    const projected = projectFrontPose(sampleLeadJabReadyPose().joints);
    const fitted = fitProjectedPose(projected, 300, 430, 24);

    for (const joint of EXPECTED_JOINTS) {
      const point = fitted[joint];
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(point.depth)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(24);
      expect(point.x).toBeLessThanOrEqual(276);
      expect(point.y).toBeGreaterThanOrEqual(24);
      expect(point.y).toBeLessThanOrEqual(406);
    }
  });

  it('builds finite capsule commands for head, torso, limbs, and gloves', () => {
    const fitted = fitProjectedPose(
      projectFrontPose(sampleLeadJabReadyPose().joints),
      300,
      430,
      24,
    );
    const commands = buildBoxerRig(fitted);

    expect(commands.some((command) => command.part === 'head')).toBe(true);
    expect(commands.some((command) => command.part === 'torso')).toBe(true);
    expect(commands.filter((command) => command.part === 'glove')).toHaveLength(2);
    expect(commands.filter((command) => command.part === 'upperArm')).toHaveLength(2);
    expect(commands.filter((command) => command.part === 'forearm')).toHaveLength(2);
    expect(commands.filter((command) => command.part === 'thigh')).toHaveLength(2);
    expect(commands.filter((command) => command.part === 'shin')).toHaveLength(2);

    const torso = commands.find(
      (command) => command.kind === 'capsule' && command.part === 'torso',
    );
    expect(torso?.kind).toBe('capsule');
    if (torso?.kind === 'capsule') {
      expect(torso.x + torso.width / 2).toBeCloseTo(
        (fitted.chest.x + fitted.pelvis.x) / 2,
      );
      expect(torso.y + torso.height / 2).toBeCloseTo(
        (fitted.chest.y + fitted.pelvis.y) / 2,
      );
    }

    for (const command of commands) {
      expect(Object.values(command).filter((value) => typeof value === 'number').every(Number.isFinite)).toBe(true);
    }
  });
});

describe('P0 three-attack motion registry', () => {
  const cases = [
    ['LEAD_JAB_HEAD', 120, 480],
    ['REAR_STRAIGHT_HEAD', 150, 540],
    ['LEAD_HOOK_HEAD', 190, 620],
  ] as const;

  it('loads all three canonical motion source IDs from the assets', () => {
    expect(getP0MotionSourceIds()).toEqual({
      LEAD_JAB_HEAD: '144_13',
      REAR_STRAIGHT_HEAD: '144_20',
      LEAD_HOOK_HEAD: '14_01',
    });
  });

  it.each(cases)('samples finite Ready, cue, and impact poses for %s', (attackId, cueMs, impactMs) => {
    for (const elapsedMs of [0, cueMs, impactMs]) {
      const sampled = sampleP0AttackPose(attackId, elapsedMs);
      expect(sampled.attackId).toBe(attackId);
      expect(sampled.timeMs).toBe(elapsedMs);
      for (const joint of EXPECTED_JOINTS) {
        expect(sampled.joints[joint].every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('uses projected depth scale for a bounded common glove presentation', () => {
    const fitted = fitProjectedPose(
      projectFrontPose(sampleP0AttackPose('LEAD_JAB_HEAD', 0).joints),
      300,
      430,
      24,
    );
    const baselineGlove = buildBoxerRig(fitted).find(
      (command) => command.kind === 'circle' && command.part === 'glove' && command.side === 'left',
    );
    const closerHandPose = {
      ...fitted,
      lHand: { ...fitted.lHand, scale: fitted.chest.scale * 1.8 },
    };
    const closerGlove = buildBoxerRig(closerHandPose).find(
      (command) => command.kind === 'circle' && command.part === 'glove' && command.side === 'left',
    );

    expect(baselineGlove?.kind).toBe('circle');
    expect(closerGlove?.kind).toBe('circle');
    if (baselineGlove?.kind === 'circle' && closerGlove?.kind === 'circle') {
      expect(closerGlove.diameter).toBeGreaterThan(baselineGlove.diameter);
      expect(closerGlove.diameter).toBeLessThanOrEqual(44 * 1.5);
    }
  });
});
