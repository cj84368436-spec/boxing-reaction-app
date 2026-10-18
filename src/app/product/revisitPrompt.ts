import {compareRecords,type RoundRecord} from '../session/progression.js';
import type {Level} from '../session/survivalRules.js';
import {isCompletedRecentRecord} from './recentRecords.js';
import {resultSummary} from './resultSummary.js';

type VisibleKind='below_best'|'equals_best'|'clear_below_best'|'clear_best';
type InvalidReason='locked_difficulty'|'missing_best'|'record_invalid'|'recent_ahead_of_best';
export type RevisitPrompt=
  | {kind:'no_recent';message:null}
  | {kind:'invalid';message:null;reason:InvalidReason}
  | {kind:VisibleKind;message:string;context:string};
interface RevisitInput {
  recent:RoundRecord|undefined;
  best:RoundRecord|undefined;
  difficulty:Level;
  unlocked:Level;
}
const retryBest='개인 최고 기록에 다시 도전해보세요';

/** One presentation goal; no storage writes, reward policy, or alternative record ranking. */
export function buildRevisitPrompt({recent,best,difficulty,unlocked}:RevisitInput):RevisitPrompt {
  if(![1,2,3].includes(difficulty)||![1,2,3].includes(unlocked)||difficulty>unlocked)
    return {kind:'invalid',message:null,reason:'locked_difficulty'};
  if(recent===undefined)return {kind:'no_recent',message:null};
  if(best===undefined)return {kind:'invalid',message:null,reason:'missing_best'};
  if(!isCompletedRecentRecord(recent,difficulty)||!isCompletedRecentRecord(best,difficulty))
    return {kind:'invalid',message:null,reason:'record_invalid'};
  const order=compareRecords(recent,best);
  if(order<0)return {kind:'invalid',message:null,reason:'recent_ahead_of_best'};
  const context=recent.cleared?`최근 완주 · 완벽 회피 ${recent.perfect}회`:`지난 기록 ${recent.survived} / 30`;
  if(recent.cleared){
    const kind=order===0?'clear_best':'clear_below_best';
    if(order===0)return {kind,context,message:recent.perfect<30?resultSummary(recent,[]).goal:retryBest};
    // Lives rank before PERFECT. Do not imply a PERFECT gain alone beats a higher-life record.
    const perfectGap=best.perfect-recent.perfect;
    const message=recent.lives===best.lives&&perfectGap>0
      ? perfectGap<=5?`완벽 회피 ${perfectGap}회 더 도전해보세요`:resultSummary(recent,[]).goal
      : retryBest;
    return {kind,context,message};
  }
  if(order===0)return {kind:'equals_best',context,message:retryBest};
  // A prior clear remains a completion even when the latest game was a KO.
  if(best.cleared)return {kind:'below_best',context,message:retryBest};
  const gap=best.survived-recent.survived;
  const message=gap>0?(gap<=5?`최고 생존 기록까지 ${gap}회`:resultSummary(recent,[]).goal):retryBest;
  return {kind:'below_best',context,message};
}

/** Landing exposure and actual landing-origin starts share this minimal contract. */
export function revisitPromptEventData(prompt?:RevisitPrompt) {
  return {
    has_revisit_prompt:prompt?.message!=null,
    revisit_prompt_kind:prompt?.kind??null,
    revisit_prompt_issue:prompt?.kind==='invalid'?prompt.reason:null,
  };
}
