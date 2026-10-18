import {buildViralResultPresentation} from '../product/viralResultPresentation';
import {buildShareResult} from '../sharing/shareResult';
import {buildRecentComparison} from '../product/recentComparison';
import type {RoundRecord} from '../session/progression';
import type {TenPunchSessionResult} from '../session/P0TenPunchSession';
const ko=(n:number,extra:Partial<RoundRecord>={}):RoundRecord=>({level:1,cleared:false,resolved:n+1,survived:n,lives:0,perfect:0,streak:0,reactionMs:null,at:1,...extra});
const clear=(perfect=12):RoundRecord=>({...ko(29),cleared:true,survived:30,resolved:30,lives:3,perfect,streak:3});
const view=(record:RoundRecord,previous?:RoundRecord,best?:RoundRecord,results:TenPunchSessionResult[]=[])=>buildViralResultPresentation({record,comparison:buildRecentComparison(previous,record),previousBest:best,results})!;
test('first early KO has a factual score, nearby goal, and no inflated best claim',()=>{
 const p=view(ko(4));expect(p.resultText).toBe('4 / 30');expect(p.resultCaption).toBe('4번째 공격까지 생존');expect(p.bestText).toBe('첫 기록을 남겼어요');expect(p.isPersonalBest).toBe(false);expect(p.goal).toContain('5번째');expect(p.coachLine).toContain('5');expect(p.shareButtonLabel).toBe('친구에게 기록 보내기');
 expect(JSON.stringify(p)).not.toMatch(/천재|상위|재능 점수|흉내|집에|\p{Extended_Pictographic}/u);
});
test('8 to 14 improvement is the same actual six in screen and outgoing text',()=>{
 const record=ko(14),comparison=buildRecentComparison(ko(8),record),p=view(record,ko(8),ko(20));
 expect(p.comparisonDelta).toBe('+6');expect(p.comparisonText).toBe(comparison!.message);expect(p.coachLine).toContain('6회 더 버텼군');
 expect(buildShareResult({record,comparison})!.text).toContain(p.comparisonText!);
});
test('decline and tie do not pretend to improve',()=>{
 const p=view(ko(12),ko(17),ko(20));expect(p.comparisonDelta).toBe('−5');expect(p.comparisonText).toContain('5회 적게');expect(p.coachLine).not.toMatch(/더 버텼|기록을 넘/);
 expect(view(ko(12),ko(12),ko(20)).comparisonDelta).toBeNull();
});
test('only the existing comparator can grant a new best, including reaction tie-breaks',()=>{
 const record=ko(14,{perfect:5,reactionMs:100}),best={...record,reactionMs:200};
 expect(view(record,undefined,best).isPersonalBest).toBe(true);expect(buildShareResult({record,previousBest:best})!.isPersonalBest).toBe(true);
 expect(view(record,undefined,record).isPersonalBest).toBe(false);
});
test('clear has one achievement and a non-survival goal, without duplicating a new-best celebration',()=>{
 const p=view(clear(),ko(24),clear(10));expect(p.resultText).toBe('30 / 30');expect(p.resultCaption).toBe('완주');expect(p.headline).toBe('끝까지 버텼군');expect(p.bestText).toBe('새로운 최고 기록!');expect(p.coachLine).not.toContain('최고');expect(p.goal).toContain('13회');expect(p.viralPrompt).toContain('끝까지');
 expect(view(clear(30)).goal).not.toMatch(/31/);
});
test.each(['LEAD_JAB_HEAD','REAR_STRAIGHT_HEAD','LEAD_HOOK_HEAD','LEAD_UPPERCUT_HEAD'])('repeated misses name only the actual %s attack',attackId=>{
 const names:{[key:string]:string}={LEAD_JAB_HEAD:'잽',REAR_STRAIGHT_HEAD:'스트레이트',LEAD_HOOK_HEAD:'훅',LEAD_UPPERCUT_HEAD:'어퍼컷'};
 const results=[{attackId,outcome:'HIT'},{attackId,outcome:'HIT'}] as TenPunchSessionResult[];
 const p=view(ko(14),undefined,ko(20),results);expect(p.coachLine).toContain(`${names[attackId]}에 2번 맞았군`);
 for(const [id,name] of Object.entries(names))if(id!==attackId)expect(p.coachLine).not.toContain(name);
 expect(view(ko(14),undefined,ko(20),results)).toEqual(p);
});
test('no fabricated weakness with one miss or unknown attacks; incomplete rounds have no share presentation',()=>{
 const p=view(ko(4),undefined,undefined,[{attackId:'not-real',outcome:'HIT'},{attackId:'not-real',outcome:'HIT'}] as TenPunchSessionResult[]);expect(p.coachLine).not.toContain('알 수 없는');
 expect(buildViralResultPresentation({record:ko(0),results:[]})).toBeNull();
});

test('a historical v1 personal best still counts as a previous record even without recent-match eligibility',()=>{
 const best=ko(3),record=ko(4);expect(view(record,undefined,best).isPersonalBest).toBe(true);expect(buildShareResult({record,previousBest:best})!.isPersonalBest).toBe(true);
});
