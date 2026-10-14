import { P0TenPunchSession } from '../session/P0TenPunchSession';
import { getSurvivalMotionSourceIds } from '../motion/p0MotionRegistry';
import { getSurvivalMotionAsset } from '../motion/p0MotionRegistry';
import { getFirstPersonFrame } from '../motion/firstPersonPresentation';

function runInput(attackId: string, input: string, level: 1 | 2 | 3 = 3) {
  let now = 0;
  const session = new P0TenPunchSession({ nowMs: () => now }, getSurvivalMotionSourceIds(), {
    ruleset: 'candidate', survivalLevel: level, maxHits: 31, seed: 9,
  });
  session.start();
  const attack = session.snapshot().scheduledAttacks.find(item => item.attackId === attackId)!;
  now = attack.attackStartScheduledAtMs! + 200;
  session.tick();
  const receipt = session.handleInput(input as Parameters<typeof session.handleInput>[0]);
  now = attack.attackStartScheduledAtMs! + 650;
  const result = session.tick().results.find(item => item.attackInstanceId === attack.attackInstanceId);
  return { receipt, result };
}

test.each([
  ['LEAD_JAB_HEAD', 'DUCK', 'SAFE'],
  ['REAR_STRAIGHT_HEAD', 'DUCK', 'PERFECT'],
  ['LEAD_HOOK_HEAD', 'DUCK', 'SAFE'],
  ['LEAD_HOOK_HEAD', 'STEP_IN', 'PERFECT'],
  ['REAR_STRAIGHT_HEAD', 'STEP_IN', 'HIT'],
  ['LEAD_UPPERCUT_HEAD', 'DUCK', 'HIT'],
  ['LEAD_UPPERCUT_HEAD', 'STEP_IN', 'HIT'],
])('champion %s with %s resolves %s', (attackId, input, expected) => {
  const { receipt, result } = runInput(attackId, input);
  expect(receipt.status).toBe('VALID');
  expect(result?.outcome).toBe(expected);
  expect(result?.telemetry.inputButton).toBe(input);
});

test('beginner defense stays unchanged', () => {
  expect(runInput('LEAD_JAB_HEAD', 'LEFT', 1).result?.outcome).toBe('PERFECT');
});

test.each([1, 2] as const)('level %s rejects champion-only defense input', level => {
  expect(() => runInput('LEAD_JAB_HEAD', 'DUCK', level)).toThrow('Champion-only defense input');
});

test.each([
  ['LEAD_JAB_HEAD', 'DUCK', 'cameraY', -1],
  ['LEAD_HOOK_HEAD', 'STEP_IN', 'cameraScale', 1],
] as const)('%s with %s visibly moves the camera', (attackId, input, axis, limit) => {
  let now = 0;
  const ids = getSurvivalMotionSourceIds();
  const assets = Object.fromEntries(Object.keys(ids).map(id => [id, getSurvivalMotionAsset(id)]));
  const session = new P0TenPunchSession({ nowMs: () => now }, ids, {ruleset:'candidate',survivalLevel:3,maxHits:31,seed:9});
  session.start();
  const attack = session.snapshot().scheduledAttacks.find(item => item.attackId === attackId)!;
  now = attack.attackStartScheduledAtMs! + 300;
  session.tick();
  session.handleInput(input as Parameters<typeof session.handleInput>[0]);
  now += 80;
  const frame = getFirstPersonFrame(session.tick(), assets, new Map());
  if (axis === 'cameraY') expect(frame.cameraY).toBeLessThan(limit);
  else expect(frame.cameraScale).toBeGreaterThan(limit);
});
