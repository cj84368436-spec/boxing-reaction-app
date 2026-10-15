import {CANDIDATE_ATTACKS,candidateFailureReason} from '../session/candidateRules';
import {extraDefenseOutcome} from '../session/advancedDefense';
import {ATTACK_NAMES} from '../motion/attackNames';
import {getRematchReview} from '../motion/coachPresentation';
import {P0TenPunchSession} from '../session/P0TenPunchSession';

const attacks=Object.keys(ATTACK_NAMES);
const extraFailures=attacks.flatMap(attack=>['DUCK','STEP_IN'].filter(input=>extraDefenseOutcome(attack,input as 'DUCK'|'STEP_IN')==='HIT').map(input=>[attack,input]));

test.each(extraFailures)('valid %s + %s failure never describes another attack', (attack,input)=>{
 const body=candidateFailureReason(attack,input);
 for(const other of attacks.filter(id=>id!==attack))expect(body).not.toContain(ATTACK_NAMES[other as keyof typeof ATTACK_NAMES]);
 if(attack==='LEAD_JAB_HEAD')expect(body).toContain('왼쪽');
 if(attack==='REAR_STRAIGHT_HEAD'){expect(body).toContain('왼쪽');expect(body).not.toContain('오른쪽은');}
 if(attack==='LEAD_UPPERCUT_HEAD')expect(body).toContain('뒤로');
});

test('unknown attack uses a factual generic explanation',()=>{
 expect(candidateFailureReason('UNKNOWN','STEP_IN')).not.toMatch(/잽|스트레이트|훅|어퍼컷/);
});

test('champion seed 123 actual VALID jab STEP_IN HIT has an accurate review',()=>{
 let now=0;const s=new P0TenPunchSession({nowMs:()=>now},{LEAD_JAB_HEAD:'j',REAR_STRAIGHT_HEAD:'s',LEAD_HOOK_HEAD:'h',LEAD_UPPERCUT_HEAD:'authored-uppercut-v1'},{ruleset:'candidate',survivalLevel:3,maxHits:5,seed:123});s.start();
 for(const a of s.snapshot().scheduledAttacks){
   now=a.attackStartScheduledAtMs!+300;s.tick();s.handleInput(a.attackId==='LEAD_JAB_HEAD'?'STEP_IN':a.attackId==='LEAD_UPPERCUT_HEAD'?'BACK':a.attackId==='LEAD_HOOK_HEAD'?'RIGHT':'LEFT');
   now=a.attackStartScheduledAtMs!+650;s.tick();if(s.snapshot().sessionCompleted)break;
 }
 const result=s.snapshot().results.find(r=>r.outcome==='HIT')!;
 expect(result.attackId).toBe('LEAD_JAB_HEAD');expect(result.telemetry.inputButton).toBe('STEP_IN');expect(result.telemetry.inputStatus).toBe('VALID');
 const review=getRematchReview([result],1.12,true);
 expect(review.focusTitle).toContain('잽');expect(review.focusBody).not.toContain('훅');expect(review.focusBody).toContain('왼쪽');
});

test.each(Object.entries(CANDIDATE_ATTACKS).flatMap(([attack,definition])=>Object.entries(definition.defenseMatrix).filter(([,outcome])=>outcome==='HIT').map(([input])=>[attack,input])))('basic VALID %s + %s failure names no other attack',(attack,input)=>{
 const body=candidateFailureReason(attack,input);
 for(const other of attacks.filter(id=>id!==attack))expect(body).not.toContain(ATTACK_NAMES[other as keyof typeof ATTACK_NAMES]);
});
test.each(attacks)('%s exhausted guard explains the resource failure',attack=>{
 expect(candidateFailureReason(attack,'GUARD')).toBe('가드 소진 · 회피로 회복하세요');
});
