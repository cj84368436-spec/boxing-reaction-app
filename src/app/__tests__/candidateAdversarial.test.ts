import { candidateCombatPose } from '../motion/candidateCombatPose';
import { P0_ATTACKS } from '../../game/config/p0Attacks';
import { P0TenPunchSession } from '../session/P0TenPunchSession';
const ids={LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'};
function fixture(){let now=0;const s=new P0TenPunchSession({nowMs:()=>now},ids,{seed:123,ruleset:'candidate'});s.start();return {s,at(t:number){now=t;s.tick();}};}
test('continuous authored poses have no jumps, contact matches impact, and legs stay outside crop',()=>{
 for(const [id,attack] of Object.entries(P0_ATTACKS)){
  let previous=candidateCombatPose(id,0);
  for(let t=16;t<attack.impactMs+400;t+=16){const p=candidateCombatPose(id,t);for(const key of Object.keys(p) as (keyof typeof p)[]){expect(Number.isFinite(p[key].x+p[key].y)).toBe(true);expect(Math.hypot(p[key].x-previous[key].x,p[key].y-previous[key].y)).toBeLessThan(20);}expect(p.lKnee.y).toBeGreaterThan(500);previous=p;}
  const p=candidateCombatPose(id,attack.impactMs),hand=attack.hand==='REAR'?p.rHand:p.lHand;expect(hand.x).toBe(140);expect(hand.y).toBe(165);
 }
 const hook=candidateCombatPose('LEAD_HOOK_HEAD',620);expect(hook.lElbow.x-hook.lHand.x).toBeGreaterThan(80);
});
test('early attempt recovers visibly instead of permanently consuming an attack',()=>{const {s,at}=fixture();at(20);expect(s.handleInput('LEFT').status).toBe('EARLY');at(100);expect(s.handleInput('RIGHT').status).toBe('EARLY');at(300);expect(s.handleInput('LEFT').status).toBe('VALID');at(480);expect(s.snapshot().results[0]?.outcome).toBe('PERFECT');});
test('two directions simultaneously fail honestly',()=>{const {s,at}=fixture();at(300);s.handleInput('LEFT');s.handleInput('RIGHT');at(480);expect(s.snapshot().results[0]?.telemetry.inputStatus).toBe('MULTI_INPUT');});
test.each([450,451])('inclusive late boundary %d matches telemetry',(t)=>{const {s,at}=fixture();at(t);s.handleInput('LEFT');at(480);expect(s.snapshot().results[0]?.outcome).toBe(t===450?'PERFECT':'HIT');expect(s.snapshot().results[0]?.telemetry.inputAtMs).toBe(t);});
test('holding one press does not defend subsequent attacks',()=>{const {s,at}=fixture();at(300);s.handleInput('LEFT');at(30000);expect(s.snapshot().results.filter(r=>r.outcome!=='HIT')).toHaveLength(1);});
test('guard drains only at impact, evasion restores it, and invalid input cannot restore it',()=>{const {s,at}=fixture();at(300);s.handleInput('GUARD');expect(s.snapshot().guardEnergy).toBe(2);at(480);expect(s.snapshot().guardEnergy).toBe(1);const next=s.snapshot().scheduledAttacks[1]!;at(next.attackStartScheduledAtMs!+300);s.handleInput('LEFT');at(next.attackStartScheduledAtMs!+540);expect(s.snapshot().guardEnergy).toBe(2);});
test('three variants are deterministic and have distinct rhythm and attack decisions',()=>{const orders=[];for(const seed of [123,124,125]){const s=new P0TenPunchSession({nowMs:()=>0},ids,{seed,ruleset:'candidate'});s.start();orders.push(s.snapshot().flattenedAttackOrder.join(','));}expect(new Set(orders).size).toBe(3);});
import { getRematchReview } from '../motion/coachPresentation';
test('candidate near miss uses exact recorded milliseconds, not a fabricated minimum',()=>{const {s,at}=fixture();at(451);s.handleInput('LEFT');at(30000);expect(getRematchReview(s.snapshot().results,1,true).focusBody).toContain('0.001초');});
test('late wrong-side straight is not described as a near-miss correct dodge',()=>{const {s,at}=fixture();at(300);s.handleInput('LEFT');at(480);const a=s.snapshot().scheduledAttacks[1]!;at(a.attackStartScheduledAtMs!+511);s.handleInput('RIGHT');at(30000);expect(getRematchReview(s.snapshot().results,1,true).focusBody).not.toMatch(/0\.001초/);});
