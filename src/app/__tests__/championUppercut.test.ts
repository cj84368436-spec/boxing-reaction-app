import { survivalPatterns } from '../session/survivalRules';
import { CHAMPION_UPPERCUT } from '../session/championRules';
import { selectSpriteFrame, selectSpriteSheet } from '../motion/cartoonSprites';
import { candidateCombatPose } from '../motion/candidateCombatPose';
import { getSurvivalMotionAsset, getSurvivalMotionSourceIds } from '../motion/p0MotionRegistry';
import { P0TenPunchSession } from '../session/P0TenPunchSession';

const flatten = (seed: number, level: 1 | 2 | 3) => survivalPatterns(seed, level).flatMap(combo => combo.attacks.map(attack => attack.attackId));

test('uppercut belongs only to deterministic thirty-punch champion rounds', () => {
  for (const level of [1, 2] as const) {
    expect(flatten(9, level)).toHaveLength(30);
    expect(flatten(9, level)).not.toContain('LEAD_UPPERCUT_HEAD');
  }
  expect(flatten(9, 3)).toHaveLength(30);
  expect(flatten(9, 3)).toContain('LEAD_UPPERCUT_HEAD');
  expect(flatten(9, 3)).toEqual(flatten(9, 3));
});

test('uppercut keeps the approved four-button judgment', () => {
  expect(CHAMPION_UPPERCUT.defenseMatrix).toEqual({ LEFT: 'SAFE', RIGHT: 'SAFE', BACK: 'PERFECT', GUARD: 'SAFE' });
});

test('uppercut frames and upward strike remain finite', () => {
  expect(selectSpriteFrame('LEAD_UPPERCUT_HEAD', 0)).toBe(0);
  expect(selectSpriteFrame('LEAD_UPPERCUT_HEAD', 400)).toBeGreaterThan(0);
  expect(selectSpriteFrame('LEAD_UPPERCUT_HEAD', 620)).toBe(3);
  const ready = candidateCombatPose('LEAD_UPPERCUT_HEAD', 0);
  const hit = candidateCombatPose('LEAD_UPPERCUT_HEAD', 620);
  expect(hit.lHand.y).toBeLessThan(ready.lHand.y);
  for (const pose of [ready, hit]) for (const point of Object.values(pose)) {
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  }
});

test('champion uppercut uses its own drawing during the strike and the shared ready pose outside it', () => {
  expect(selectSpriteSheet('LEAD_UPPERCUT_HEAD', 0)).toBe('jab');
  expect(selectSpriteSheet('LEAD_UPPERCUT_HEAD', 2)).toBe('uppercut');
  expect(selectSpriteSheet('LEAD_UPPERCUT_HEAD', 3)).toBe('uppercut');
  expect(selectSpriteSheet('LEAD_UPPERCUT_HEAD', 5)).toBe('jab');
  expect(selectSpriteSheet('REAR_STRAIGHT_HEAD', 2)).toBe('straight');
});

test('the native survival screen can construct champion with an uppercut presentation asset', () => {
  const ids=getSurvivalMotionSourceIds();
  expect(ids.LEAD_UPPERCUT_HEAD).toBe('authored-uppercut-v1');
  expect(getSurvivalMotionAsset('LEAD_UPPERCUT_HEAD').attackId).toBe('LEAD_UPPERCUT_HEAD');
  const session=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:3,maxHits:5,seed:9});
  expect(session.snapshot().flattenedAttackOrder).toContain('LEAD_UPPERCUT_HEAD');
});
