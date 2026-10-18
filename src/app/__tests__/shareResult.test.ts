import {buildShareResult} from '../sharing/shareResult';
import {buildRecentComparison} from '../product/recentComparison';
import type {RoundRecord} from '../session/progression';
const ko=(n:number,extra:Partial<RoundRecord>={}):RoundRecord=>({level:1,cleared:false,resolved:n+1,survived:n,lives:0,perfect:0,streak:0,reactionMs:null,at:1,...extra});
test('first KO uses actual difficulty/survival/PERFECT without a record claim or emoji',()=>{
 const result=buildShareResult({record:ko(8)})!;
 expect(result.text).toContain('입문');expect(result.text).toContain('8 / 30');expect(result.text).toContain('PERFECT 0회');
 expect(result.isPersonalBest).toBe(false);expect(result.text).not.toMatch(/최고|신기록|[\p{Extended_Pictographic}]/u);
});
test('actual comparator improvement, tie, and decline keep best claims honest',()=>{
 expect(buildShareResult({record:ko(12),previousBest:ko(8)})!.isPersonalBest).toBe(true);
 expect(buildShareResult({record:ko(12),previousBest:ko(12)})!.text).not.toContain('새로운 개인 최고');
 expect(buildShareResult({record:ko(8),previousBest:ko(12)})!.isPersonalBest).toBe(false);
 expect(buildShareResult({record:ko(12,{perfect:3,reactionMs:100}),previousBest:ko(12,{perfect:3,reactionMs:200})})!.isPersonalBest).toBe(true);
});
test('positive recent is optional; decline and absent comparisons are omitted',()=>{
 const current=ko(12);const comparison=buildRecentComparison(ko(8),current);
 expect(buildShareResult({record:current,comparison})!.text).toContain('4회 더');
 const decline=buildRecentComparison(ko(15),current);
 expect(buildShareResult({record:current,comparison:decline})!.text).not.toContain('지난 경기');
 expect(buildShareResult({record:current})!.text).not.toContain('지난 경기');
});
test('clear and champion difficulty are factual; private fields never leave',()=>{
 const record={...ko(29,{level:3,perfect:12}),cleared:true,survived:30,lives:3};
 const shared=buildShareResult({record:{...record,seed:123,roundId:'private-round',runtimeId:'private-runtime',userId:'private-user'} as RoundRecord})!;
 expect(shared.text).toContain('챔피언');expect(shared.text).toContain('30 / 30 완주');expect(shared.text).toContain('PERFECT 12회');
 expect(shared.text).not.toMatch(/private|123|seed|runtime|roundId|상위|재능 점수/);
});
test('incomplete results and foreign previous best cannot create fabricated claims',()=>{
 expect(buildShareResult({record:ko(0)})).toBeNull();
 expect(buildShareResult({record:ko(12),previousBest:ko(8,{level:2})})!.isPersonalBest).toBe(false);
});
