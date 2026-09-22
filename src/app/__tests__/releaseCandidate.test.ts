import { P0TenPunchSession } from '../session/P0TenPunchSession';
const ids = {LEAD_JAB_HEAD:'144_13',REAR_STRAIGHT_HEAD:'144_20',LEAD_HOOK_HEAD:'14_01'};
function run(button: 'LEFT'|'RIGHT'|'BACK'|'GUARD'|'read') {
 let now=0; const session=new P0TenPunchSession({nowMs:()=>now},ids,{seed:123,ruleset:'candidate'});
 session.start(); const schedule=session.snapshot().scheduledAttacks;
 for(const a of schedule){now=a.attackStartScheduledAtMs!+300;session.tick();session.handleInput(button==='read'?(a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT'):button);now=a.attackStartScheduledAtMs!+620;session.tick();}
 now=30000;return session.tick();
}
describe('release candidate readable round',()=>{
 test.each(['LEFT','RIGHT','BACK','GUARD'] as const)('%s alone cannot clear',button=>expect(run(button).results.some(r=>r.outcome==='HIT')).toBe(true));
 test('reading the attacks clears the same fixed windows',()=>expect(run('read').results.every(r=>r.outcome==='PERFECT')).toBe(true));
 test('single punches teach before combos, guard meter is visible',()=>{const s=run('read');expect(s.comboOrderIds.slice(0,3)).toEqual(['single-jab','single-straight','single-hook']);expect(s.guardEnergy).toBe(2);});
 test('same seed retry restores guard and reproduces pattern',()=>{let now=0;const s=new P0TenPunchSession({nowMs:()=>now},ids,{seed:123,ruleset:'candidate'});s.start();const a=s.snapshot().flattenedAttackOrder;now=30000;s.tick();s.retry({seed:123});expect(s.snapshot().flattenedAttackOrder).toEqual(a);expect(s.snapshot().guardEnergy).toBe(2);});
});
