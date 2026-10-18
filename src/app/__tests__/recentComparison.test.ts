import {buildRecentComparison,recentComparisonEventData} from '../product/recentComparison';
import type {RoundRecord} from '../session/progression';
const ko=(survived:number,extra:Partial<RoundRecord>={}):RoundRecord=>({level:1,cleared:false,resolved:survived+1,survived,lives:0,perfect:0,streak:0,reactionMs:null,at:1,...extra});
const clear=(extra:Partial<RoundRecord>={}):RoundRecord=>ko(30,{cleared:true,resolved:30,lives:3,perfect:20,...extra});

test('first result, foreign difficulty, or invalid record has no comparison',()=>{
 expect(buildRecentComparison(undefined,ko(12))).toBeNull();
 expect(buildRecentComparison(ko(8,{level:2}),ko(12))).toBeNull();
 expect(buildRecentComparison(ko(8),ko(0))).toBeNull();
});
test.each([[8,12,'improved','4회 더'],[15,10,'declined','5회 적게'],[12,12,'same','생존 수와 완벽 회피 수가 같아요']])('%s → %s has factual survival comparison',(before,after,comparison,text)=>{
 const result=buildRecentComparison(ko(before as number),ko(after as number))!;
 expect(result.comparison).toBe(comparison);expect(result.message).toContain(text);
 expect(result.previousLabel).toContain(String(before));
});
test('KO to clear acknowledges this completion without claiming a lifetime first',()=>{
 const result=buildRecentComparison(ko(24),clear())!;
 expect(result.comparison).toBe('improved');expect(result.message).toContain('이번에는 30회 완주');
 expect(result.message).not.toContain('첫');
});
test('clear to KO is honest',()=>{
 const result=buildRecentComparison(clear(),ko(11))!;
 expect(result.comparison).toBe('declined');expect(result.message).toContain('이번에는 11 / 30');
});
test('clear comparisons show actual lives and PERFECT, including mixed changes',()=>{
 const result=buildRecentComparison(clear(),clear({lives:4,perfect:18}))!;
 expect(result.comparison).toBe('mixed');expect(result.message).toContain('목숨 3 → 4');expect(result.message).toContain('완벽 회피 20 → 18');
 expect(buildRecentComparison(clear(),clear({lives:4}))!.comparison).toBe('improved');
 expect(buildRecentComparison(clear(),clear({perfect:19}))!.comparison).toBe('declined');
});
test('same displayed metrics never imply identical reaction/streak or a best record',()=>{
 const result=buildRecentComparison(ko(12,{reactionMs:200,perfect:3,streak:1}),ko(12,{reactionMs:100,perfect:3,streak:3}))!;
 expect(result.comparison).toBe('same');expect(result.message).toBe('생존 수와 완벽 회피 수가 같아요');
 expect(buildRecentComparison(ko(12),ko(12,{perfect:2}))!.message).toContain('완벽 회피 0 → 2');
});
test('result_view context distinguishes absent comparison and supports retry join by roundId',()=>{
 expect(recentComparisonEventData(null,ko(12))).toEqual({has_recent_comparison:false,previous_result:null,current_result:'knockout:12/30',comparison:null});
 expect(recentComparisonEventData(buildRecentComparison(ko(8),ko(12)),ko(12))).toEqual({has_recent_comparison:true,previous_result:'knockout:8/30',current_result:'knockout:12/30',comparison:'improved'});
});
