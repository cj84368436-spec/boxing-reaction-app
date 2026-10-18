import type {RoundRecord} from '../session/progression.js';
import {isCompletedRecentRecord} from './recentRecords.js';

export interface RecentComparison {
  previousLabel:string;
  previousResult:string;
  comparison:'improved'|'declined'|'same'|'mixed';
  message:string;
}
const resultKey=(r:RoundRecord)=>`${r.cleared?'clear':'knockout'}:${r.survived}/30`;

/** Display comparison only; deliberately independent of the personal-best comparator. */
export function buildRecentComparison(previous:RoundRecord|undefined,current:RoundRecord):RecentComparison|null {
  if(!previous||previous.level!==current.level||!isCompletedRecentRecord(previous,current.level)||!isCompletedRecentRecord(current,current.level))return null;
  const base={previousLabel:`지난 경기 ${previous.survived} / 30${previous.cleared?' 완주':''}`,previousResult:resultKey(previous)};
  if(current.cleared!==previous.cleared)return {...base,comparison:current.cleared?'improved':'declined',message:current.cleared?'이번에는 30회 완주했어요':`지난 경기는 완주 · 이번에는 ${current.survived} / 30`};
  const survival=current.survived-previous.survived;
  if(survival!==0)return {...base,comparison:survival>0?'improved':'declined',message:`지난 경기보다 ${Math.abs(survival)}회 ${survival>0?'더':'적게'} 버텼어요`};
  const perfect=current.perfect-previous.perfect;
  const lives=current.cleared?current.lives-previous.lives:0;
  const changes:number[]=[perfect,lives].filter(n=>n!==0);
  const comparison=changes.length===0?'same':changes.some(n=>n>0)&&changes.some(n=>n<0)?'mixed':changes[0]!>0?'improved':'declined';
  const details:string[]=[];
  if(lives!==0)details.push(`목숨 ${previous.lives} → ${current.lives}`);
  if(perfect!==0)details.push(`완벽 회피 ${previous.perfect} → ${current.perfect}`);
  const message=details.length?`${current.cleared?'둘 다 완주':'생존 수는 같아요'} · ${details.join(' · ')}`:current.cleared?'완주 · 남은 목숨과 완벽 회피 수가 같아요':'생존 수와 완벽 회피 수가 같아요';
  return {...base,comparison,message};
}

export function recentComparisonEventData(comparison:RecentComparison|null,current:RoundRecord) {
  return {has_recent_comparison:comparison!==null,previous_result:comparison?.previousResult??null,current_result:resultKey(current),comparison:comparison?.comparison??null};
}
