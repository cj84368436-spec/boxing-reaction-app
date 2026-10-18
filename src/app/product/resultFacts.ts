import {compareRecords,type RoundRecord} from '../session/progression.js';
import {LEVELS} from '../session/survivalRules.js';
import {isCompletedRecentRecord} from './recentRecords.js';
import type {RecentComparison} from './recentComparison.js';

export interface ResultFactsInput {
  record:RoundRecord;
  previousBest?:RoundRecord|undefined;
  comparison?:RecentComparison|null|undefined;
}
/** Public result facts shared by the screen and outgoing text. No new scoring. */
export function buildResultFacts({record,previousBest,comparison}:ResultFactsInput) {
  if(!isCompletedRecentRecord(record,record.level))return null;
  // Best records were validated by progression storage. Historical v1 bests need not meet recent-match eligibility.
  const validBest=previousBest?.level===record.level?previousBest:undefined;
  const isPersonalBest=validBest!==undefined&&compareRecords(record,validBest)<0;
  const previousKnockout=comparison?.previousResult.match(/^knockout:(\d+)\/30$/);
  const survivalDelta=!record.cleared&&previousKnockout?record.survived-Number(previousKnockout[1]):null;
  return {
    title:'복싱 감각 테스트',difficulty:LEVELS[record.level].name,
    resultText:`${record.survived} / 30`,resultCaption:record.cleared?'완주':`${record.survived}번째 공격까지 생존`,
    perfectText:`PERFECT ${record.perfect}회`,isPersonalBest,
    comparisonText:comparison?.message??null,survivalDelta,
    bestText:!validBest?'첫 기록을 남겼어요':isPersonalBest?'새로운 최고 기록!':`개인 최고 ${validBest.survived} / 30${validBest.cleared?' 완주':''} · PERFECT ${validBest.perfect}회`,
  };
}
