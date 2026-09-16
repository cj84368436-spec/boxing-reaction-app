import { RoundClock } from '../session/RoundClock';
import { projectCombatPose } from '../motion/firstPersonPresentation';
import { getP0MotionAsset } from '../motion/p0MotionRegistry';

describe('readable round', () => {
  it('keeps the opponent centered across all three Ready poses', () => {
    for (const id of ['LEAD_JAB_HEAD', 'REAR_STRAIGHT_HEAD', 'LEAD_HOOK_HEAD']) {
      const pose = projectCombatPose(getP0MotionAsset(id), 0);
      expect(Math.abs(pose.head.x - 140)).toBeLessThan(8);
      expect(pose.head.y).toBeCloseTo(100, 5);
    }
  });
  it('slows the shared timeline, freezes in the background, and resumes without catch-up hits', () => {
    const source = { time: 0, nowMs() { return this.time; } };
    const clock = new RoundClock(source);
    source.time = 1000;
    expect(clock.nowMs()).toBe(0);
    clock.start(0.65);
    source.time = 2000;
    expect(clock.nowMs()).toBe(650);
    clock.pause();
    source.time = 12000;
    expect(clock.nowMs()).toBe(650);
    clock.resume();
    source.time = 13000;
    expect(clock.nowMs()).toBe(1300);
  });
});
