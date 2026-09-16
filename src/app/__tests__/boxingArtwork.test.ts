import { buildBoxerArtwork, buildPlayerGloves, coachVerdict } from '../motion/boxingArtwork';
import { projectCombatPose } from '../motion/firstPersonPresentation';
import { getP0MotionAsset } from '../motion/p0MotionRegistry';

describe('boxing presentation follows the protected pose', () => {
  it.each(['LEAD_JAB_HEAD', 'REAR_STRAIGHT_HEAD', 'LEAD_HOOK_HEAD'])(
    'does not mutate any joint while drawing %s through recovery', attackId => {
      for (const ms of [0, 120, 190, 350, 480, 540, 620, 760, 1000]) {
        const pose = projectCombatPose(getP0MotionAsset(attackId), ms);
        const before = JSON.stringify(pose);
        const drawing = JSON.stringify(buildBoxerArtwork(pose));
        expect(JSON.stringify(pose)).toBe(before);
        expect(drawing).not.toMatch(/NaN|Infinity/);
        for (const side of ['left', 'right']) expect(drawing).toContain(`opponent-glove-${side}`);
      }
    },
  );

  it('keeps both player gloves visible and finite at rest and full guard', () => {
    for (const guard of [0, .5, 1]) {
      const drawing = JSON.stringify(buildPlayerGloves(guard));
      expect(drawing).not.toMatch(/NaN|Infinity/);
      expect(drawing).toContain('player-glove-left');
      expect(drawing).toContain('player-glove-right');
    }
  });

  it('bases the coach response on the actual round and distinguishes blocking from perfect evasion', () => {
    expect(coachVerdict({ PERFECT: 10, SAFE: 0, HIT: 0 }).mood).toBe('surprised');
    expect(coachVerdict({ PERFECT: 0, SAFE: 10, HIT: 0 }).mood).toBe('interested');
    expect(coachVerdict({ PERFECT: 7, SAFE: 0, HIT: 3 }).mood).toBe('interested');
    expect(coachVerdict({ PERFECT: 0, SAFE: 0, HIT: 10 }).mood).toBe('smirk');
  });
});
