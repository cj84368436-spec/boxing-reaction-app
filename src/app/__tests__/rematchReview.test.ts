import { P0_ATTACKS } from '../../game/config/p0Attacks';
import { P0TenPunchSession } from '../session/P0TenPunchSession';
import { getRematchReview } from '../motion/coachPresentation';
function play(lateIndex: number | null, speed = 1) {
  let now = 0; const session = new P0TenPunchSession({nowMs: () => now}, {LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'}, {seed:123});session.start();
  for(const scheduled of session.snapshot().scheduledAttacks) {
    const attack=P0_ATTACKS[scheduled.attackId as keyof typeof P0_ATTACKS];
    now=scheduled.attackStartScheduledAtMs!+(scheduled.attackIndex===lateIndex ? attack.responseWindowEndMs+10 : attack.cueAnchorMs+40);
    session.tick(); session.handleInput(scheduled.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT');
    now=scheduled.attackStartScheduledAtMs!+attack.impactMs;session.tick();
  }
  return {snapshot:session.snapshot(),review:getRematchReview(session.snapshot().results,speed)};
}
test('one genuine late miss receives a specific rematch target and unchanged results',()=>{
  const {snapshot,review}=play(8);const before=JSON.stringify(snapshot.results);
  expect(review.reaction.line).toBe('아홉 번은 잘했는데. 딱 한 대 맞았네?');
  expect(review.focusTitle).toBe('9번째 훅 · 조금 늦었어요');
  expect(review.focusBody).toContain('0.01초');
  expect(review.replaySameSeed).toBe(true);
  expect(JSON.stringify(snapshot.results)).toBe(before);
});
test('late evidence converts game clock to actual relaxed-mode time',()=>{
  expect(play(8,.5).review.focusBody).toContain('0.02초');
});
test('a clean win is acknowledged and offers a fresh round, never a fabricated near miss',()=>{
  const {review}=play(null);
  expect(review.replaySameSeed).toBe(false);
  expect(review.reaction.mood).toBe('surprised');
  expect(review.focusBody).not.toMatch(/늦|아깝|놓쳤/);
});
test('no-input losses do not get a fabricated timing deficit',()=>{
  const {snapshot}=play(null);
  const results=snapshot.results.map(r=>({...r,outcome:'HIT' as const,telemetry:{...r.telemetry,inputStatus:'NO_INPUT' as const,inputAtMs:undefined}}));
  const review=getRematchReview(results);
  expect(review.focusBody).not.toMatch(/[0-9]초|조금만|아깝/);
  expect(review.focusBody).toContain('한 번');
});
