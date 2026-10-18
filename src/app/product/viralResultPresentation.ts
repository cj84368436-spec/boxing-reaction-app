import {buildResultFacts,type ResultFactsInput} from './resultFacts.js';
import {resultSummary} from './resultSummary.js';
import {ATTACK_NAMES,attackLabel} from '../motion/attackNames.js';
import type {TenPunchSessionResult} from '../session/P0TenPunchSession.js';

export const RESULT_SHARE_LABEL='친구에게 기록 보내기';
/** Deterministic copy based on this round only; no ability or personality inference. */
export function buildViralResultPresentation(input:ResultFactsInput&{results:readonly TenPunchSessionResult[]}) {
  const facts=buildResultFacts(input);if(!facts)return null;
  const {record,results}=input,summary=resultSummary(record,results);
  const misses=new Map<string,number>();
  for(const r of results)if(r.outcome==='HIT'&&ATTACK_NAMES[r.attackId])misses.set(r.attackId,(misses.get(r.attackId)??0)+1);
  // Stable alphabetical tie-break: neither rerenders nor random choice change the review.
  const repeated=[...misses].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
  let headline:string,coachLine:string;
  if(record.cleared){
    headline=record.perfect===30?'빈틈없이 끝냈군':'끝까지 버텼군';
    coachLine=record.perfect===30?'30회 모두 완벽 회피. 다음 순서에서도 보여줘.':`30회 완주, PERFECT ${record.perfect}회. 다음엔 한 번 더 정확하게.`;
  }else if(facts.survivalDelta!==null&&facts.survivalDelta>0){
    headline='지난 기록을 넘었군';coachLine=`지난번보다 ${facts.survivalDelta}회 더 버텼군. ${record.survived+1}번째도 버텨봐.`;
  }else if(repeated&&repeated[1]>=2){
    headline=`${attackLabel(repeated[0])}를 다시 보자`;coachLine=`${attackLabel(repeated[0])}에 ${repeated[1]}번 맞았군. 다음엔 그 주먹부터 읽어봐.`;
  }else{
    headline=record.survived>=15?'끈질기게 버텼군':'다음 한 번을 노려봐';coachLine=`${record.survived}회까지 버텼군. ${record.survived+1}번째를 그냥 내주진 마.`;
  }
  return {...facts,...summary,headline,coachLine,
    comparisonDelta:facts.survivalDelta?`${facts.survivalDelta>0?'+':'−'}${Math.abs(facts.survivalDelta)}`:null,
    previousLabel:input.comparison?.previousLabel??null,
    viralPrompt:record.cleared?'친구도 끝까지 버틸 수 있을까?':'친구는 몇 회까지 버틸까?',
    shareButtonLabel:RESULT_SHARE_LABEL,
  };
}
