import { getCoachMoment, getRematchReview } from '../motion/coachPresentation';
import { P0TenPunchSession } from '../session/P0TenPunchSession';
import { P0_ATTACKS } from '../../game/config/p0Attacks';

const sources = { LEAD_JAB_HEAD: '144_13', REAR_STRAIGHT_HEAD: '144_20', LEAD_HOOK_HEAD: '14_01' };
function run() {
  const clock = { value: 0, nowMs() { return this.value; } };
  const session = new P0TenPunchSession(clock, sources, { seed: 123 });
  session.start();
  return { clock, session };
}
test('coach reacts to a hit only between combos, never over an attack or its cue', () => {
  const { clock, session } = run();
  let reactions = 0;
  for (clock.value = 0; clock.value < 16000; clock.value += 10) {
    const snapshot = session.tick();
    const moment = getCoachMoment(snapshot);
    if (!moment) continue;
    reactions++;
    expect(moment.line).toBe('그걸 맞나?');
    expect(snapshot.latestResult?.outcome).toBe('HIT');
    for (const attack of snapshot.scheduledAttacks) {
      const start = attack.attackStartScheduledAtMs!;
      const definition = P0_ATTACKS[attack.attackId as keyof typeof P0_ATTACKS];
      expect(snapshot.nowMs >= start && snapshot.nowMs <= start + definition.impactMs).toBe(false);
    }
  }
  expect(reactions).toBeGreaterThan(0);
});
test('consecutive defences change the coach reaction without treating guards as perfect evasions', () => {
  const { clock, session } = run();
  const schedule = session.snapshot().scheduledAttacks;
  let observed = false;
  for (const attack of schedule) {
    const definition = P0_ATTACKS[attack.attackId as keyof typeof P0_ATTACKS];
    clock.value = attack.attackStartScheduledAtMs! + definition.cueAnchorMs;
    expect(getCoachMoment(session.tick())).toBeNull();
    session.handleInput('GUARD');
    clock.value = attack.attackStartScheduledAtMs! + definition.impactMs + 260;
    const snapshot = session.tick();
    const moment = getCoachMoment(snapshot);
    if (moment) {
      expect(moment).toEqual({ mood: 'interested', line: '……어?' });
      expect(snapshot.results.every(result => result.outcome === 'SAFE')).toBe(true);
      observed = true;
    }
  }
  expect(observed).toBe(true);
});
test('intro and finished rounds leave evaluation to their own cards', () => {
  const { clock, session } = run();
  expect(getCoachMoment(session.snapshot())).toBeNull();
  clock.value = 30000;
  expect(getCoachMoment(session.tick())).toBeNull();
});

test('candidate taunts are stable between combos and stay clear of attack cues', () => {
 const {CoachDialogue}=require('../motion/coachDialogue');const {CANDIDATE_ATTACKS}=require('../session/candidateRules');
 let now=0;const session=new P0TenPunchSession({nowMs:()=>now},sources,{seed:123,ruleset:'candidate',maxHits:5});session.start();const dialogue=new CoachDialogue(()=>.3);const observed=new Set<string>();
 for(now=0;now<12000;now+=20){const s=session.tick();const moment=getCoachMoment(s,dialogue);if(!moment)continue;observed.add(moment.line);expect(getCoachMoment(s,dialogue)).toEqual(moment);for(const a of s.scheduledAttacks){const start=a.attackStartScheduledAtMs!;expect(now>=start && now<=start+CANDIDATE_ATTACKS[a.attackId].impactMs).toBe(false);}}
 expect(observed.size).toBeGreaterThanOrEqual(2);
});

test.each([2,3])('broken streak taunt requires three successful defences (%s before hit)',successful=>{
 const {CoachDialogue}=require('../motion/coachDialogue');const {CANDIDATE_ATTACKS}=require('../session/candidateRules');let now=0;
 const session=new P0TenPunchSession({nowMs:()=>now},sources,{seed:123,ruleset:'candidate',maxHits:5,survivalLevel:1});session.start();const schedule=session.snapshot().scheduledAttacks;const dialogue=new CoachDialogue(()=>.3);const final=successful===3?4:2;
 for(let i=0;i<=final;i++){const a=schedule[i]!;now=a.attackStartScheduledAtMs!+300;session.tick();if(i!==successful)session.handleInput(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT');now=a.attackStartScheduledAtMs!+CANDIDATE_ATTACKS[a.attackId].impactMs+260;session.tick();if(successful===3&&i===3)expect(getCoachMoment(session.snapshot(),dialogue)).toBeNull();}
 const moment=getCoachMoment(session.snapshot(),dialogue);expect(moment).not.toBeNull();if(successful===3){expect(moment).toEqual({mood:'smirk',line:'그럼 그렇지..'});expect(getCoachMoment(session.snapshot(),dialogue)).toEqual(moment);}else expect(moment?.line).not.toBe('그럼 그렇지..');
 now=schedule[final+1]!.attackStartScheduledAtMs!;expect(getCoachMoment(session.tick(),dialogue)).toBeNull();
});

test.each([
 {name:'the final attack',earlyHits:0,defendFrom:0},
 {name:'a knockout',earlyHits:4,defendFrom:4},
])('shows the broken-streak taunt on the result card after $name',({earlyHits,defendFrom})=>{
 const {CoachDialogue}=require('../motion/coachDialogue');const {CANDIDATE_ATTACKS}=require('../session/candidateRules');let now=0;
 const session=new P0TenPunchSession({nowMs:()=>now},sources,{seed:124,ruleset:'candidate',maxHits:5,survivalLevel:1});session.start();const schedule=session.snapshot().scheduledAttacks;
 const finalIndex=earlyHits===4?7:29;
 for(let i=0;i<=finalIndex;i++){const a=schedule[i]!;now=a.attackStartScheduledAtMs!+300;session.tick();if(i>=defendFrom&&i<finalIndex)session.handleInput(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT');now=a.attackStartScheduledAtMs!+CANDIDATE_ATTACKS[a.attackId].impactMs;session.tick();}
 const snapshot=session.snapshot();
 const review=getRematchReview(snapshot.results,1,true,{dialogue:new CoachDialogue(()=>.3),event:snapshot.runId,knockedOut:snapshot.knockedOut===true,totalPunches:30});
 expect(review.reaction).toMatchObject({mood:'smirk',line:'그럼 그렇지..'});
});
