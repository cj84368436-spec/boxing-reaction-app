import type {RoundRecord} from '../session/progression.js';
import {buildResultFacts} from '../product/resultFacts.js';
import type {RecentComparison} from '../product/recentComparison.js';

export interface ShareResult {title:string;text:string;isPersonalBest:boolean}
export function buildShareResult({record,previousBest,comparison}: {
  record:RoundRecord;previousBest?:RoundRecord;comparison?:RecentComparison|null;
}):ShareResult|null {
  const facts=buildResultFacts({record,previousBest,comparison});if(!facts)return null;
  const {title,isPersonalBest}=facts;
  const lines=[title,`${facts.difficulty} · ${facts.resultText} ${record.cleared?'완주':'버텼어요'}`,facts.perfectText];
  if(isPersonalBest)lines.push('새로운 개인 최고');
  else if(comparison?.comparison==='improved')lines.push(comparison.message);
  lines.push('내 기록에도 도전해보세요.');
  return {title,text:lines.join('\n'),isPersonalBest};
}
