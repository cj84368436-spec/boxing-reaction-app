import {buildRevisitPrompt,revisitPromptEventData} from '../product/revisitPrompt';
import {emptyProgress,recordRound,parseProgressWithStatus,compareRecords,type RoundRecord} from '../session/progression';
import {recordRecentRound} from '../product/recentRecords';
import {resultSummary} from '../product/resultSummary';

const ko=(survived:number,extra:Partial<RoundRecord>={}):RoundRecord=>({level:1,cleared:false,resolved:survived+1,survived,lives:0,perfect:0,streak:0,reactionMs:null,at:1,...extra});
const clear=(extra:Partial<RoundRecord>={}):RoundRecord=>ko(30,{cleared:true,resolved:30,lives:3,perfect:12,...extra});
const prompt=(recent?:RoundRecord,best?:RoundRecord)=>buildRevisitPrompt({recent,best,difficulty:1,unlocked:3});

test('no recent keeps both new and legacy users free of invented goals',()=>{
 expect(prompt().kind).toBe('no_recent');expect(prompt(undefined,ko(12)).message).toBeNull();
});
test.each([[8,12,4],[14,17,3]])('nearby KO %i → best %i shows the factual gap',(recent,best,gap)=>{
 expect(prompt(ko(recent),ko(best))).toMatchObject({kind:'below_best',message:`최고 생존 기록까지 ${gap}회`});
});
test('a distant best uses the exact existing nearby result goal',()=>{
 const recent=ko(4);expect(prompt(recent,ko(25))).toMatchObject({kind:'below_best',message:resultSummary(recent,[]).goal});
});
test('ties follow the actual comparator, ignoring timestamp and streak',()=>{
 const recent=ko(12,{perfect:4,streak:4,at:2});const best=ko(12,{perfect:4,streak:1});
 expect(compareRecords(recent,best)).toBe(0);
 expect(prompt(recent,best)).toMatchObject({kind:'equals_best',message:'개인 최고 기록에 다시 도전해보세요'});
});
test('equal survival with worse PERFECT or reaction is below best, never a false tie or zero gap',()=>{
 for(const [recent,best] of [[ko(12),ko(12,{perfect:4})],[ko(12,{perfect:4,reactionMs:300}),ko(12,{perfect:4,reactionMs:200})]]){
  const p=prompt(recent,best);expect(p.kind).toBe('below_best');expect(p.message).not.toContain('0회');
 }
});
test('a previous clear stays recognized even after KO; never assign completing 30 again',()=>{
 for(const survived of [8,28,29])expect(prompt(ko(survived),clear())).toMatchObject({kind:'below_best',message:'개인 최고 기록에 다시 도전해보세요'});
});
test('clear comparisons can target a factual PERFECT gap without claiming best is determined by it',()=>{
 expect(prompt(clear({perfect:10}),clear())).toMatchObject({kind:'clear_below_best',message:'완벽 회피 2회 더 도전해보세요'});
 expect(prompt(clear({perfect:4}),clear())).toMatchObject({kind:'clear_below_best',message:resultSummary(clear({perfect:4}),[]).goal});
});
test('fewer lives and more PERFECT must not invent a negative PERFECT goal',()=>{
 const p=prompt(clear({lives:2,perfect:20}),clear());expect(p.kind).toBe('clear_below_best');
 expect(p.message).toBe('개인 최고 기록에 다시 도전해보세요');
});
test('clear best never offers surviving 30 again, including a perfect 30 ceiling',()=>{
 expect(prompt(clear(),clear())).toMatchObject({kind:'clear_best',message:resultSummary(clear(),[]).goal});
 expect(prompt(clear({perfect:30,lives:5}),clear({perfect:30,lives:5}))).toMatchObject({kind:'clear_best',message:'개인 최고 기록에 다시 도전해보세요'});
});
test.each([
 [ko(13),ko(12),'recent_ahead_of_best'],
 [ko(12,{perfect:3}),ko(12),'recent_ahead_of_best'],
 [ko(12,{perfect:3,reactionMs:100}),ko(12,{perfect:3,reactionMs:200}),'recent_ahead_of_best'],
 [ko(8),undefined,'missing_best'],
 [ko(8,{level:2}),ko(12),'record_invalid'],
 [ko(8),ko(12,{at:NaN}),'record_invalid'],
])('inconsistent data hides the goal with a diagnostic reason',(recent,best,reason)=>{
 expect(prompt(recent as RoundRecord,best as RoundRecord|undefined)).toMatchObject({kind:'invalid',message:null,reason});
});
test('locked or wrong difficulty is never an invitation',()=>{
 expect(buildRevisitPrompt({recent:ko(8,{level:2}),best:ko(12,{level:2}),difficulty:2,unlocked:1})).toMatchObject({kind:'invalid',message:null,reason:'locked_difficulty'});
 expect(prompt(ko(8),ko(12,{level:2})).message).toBeNull();
});
test('current write ordering and restoration cannot naturally put recent ahead of best',()=>{
 let progress=emptyProgress();
 for(const recent of [ko(8),ko(12),ko(10),clear(),clear({perfect:15}),clear({lives:4,perfect:10})]){
  progress=recordRecentRound(recordRound(progress,recent),recent);
  const restored=parseProgressWithStatus(JSON.stringify(progress));expect(restored.damaged).toBe(false);
  expect(compareRecords(restored.progress.recentByDifficulty![1]!,restored.progress.best[1]!)).toBeGreaterThanOrEqual(0);
  expect(prompt(restored.progress.recentByDifficulty![1],restored.progress.best[1]).kind).not.toBe('invalid');
 }
});
test('event contract separates missing, invalid, exposed, and unrelated starts',()=>{
 expect(revisitPromptEventData(prompt())).toEqual({has_revisit_prompt:false,revisit_prompt_kind:'no_recent',revisit_prompt_issue:null});
 expect(revisitPromptEventData(prompt(ko(13),ko(12)))).toEqual({has_revisit_prompt:false,revisit_prompt_kind:'invalid',revisit_prompt_issue:'recent_ahead_of_best'});
 expect(revisitPromptEventData(prompt(ko(8),ko(12)))).toEqual({has_revisit_prompt:true,revisit_prompt_kind:'below_best',revisit_prompt_issue:null});
 expect(revisitPromptEventData()).toEqual({has_revisit_prompt:false,revisit_prompt_kind:null,revisit_prompt_issue:null});
});
