import type {Progress, RoundRecord} from '../session/progression.js';
import type {Level} from '../session/survivalRules.js';

export function recentRecordText(record:RoundRecord|undefined):string {
  if(!record)return '아직 기록 없음';
  return `${record.cleared?`30 / 30 완주 · 목숨 ${record.lives}`:`생존 ${record.survived} / 30`} · 완벽 회피 ${record.perfect}`;
}

/** Recent is a completed real game, never an inferred best or a partial run. */
export function isCompletedRecentRecord(value:unknown, level:Level):value is RoundRecord {
  if(!value || typeof value!=='object' || Array.isArray(value))return false;
  const r=value as RoundRecord;
  if(![1,2,3].includes(level) || r.level!==level || typeof r.cleared!=='boolean')return false;
  if(!(['resolved','survived','lives','perfect','streak'] as const).every(k=>Number.isInteger(r[k])&&r[k]>=0))return false;
  if(!Number.isFinite(r.at)||r.at<0 || !(r.reactionMs===null||Number.isFinite(r.reactionMs)&&r.reactionMs>=0))return false;
  if(r.resolved>30||r.perfect>r.resolved||r.streak>r.perfect)return false;
  return r.cleared
    ? r.resolved===30&&r.survived===30&&r.lives>=1&&r.lives<=5
    : r.resolved>=5&&r.survived===r.resolved-1&&r.lives===0;
}

/** Call only after the product layer accepts a real clear/knockout. */
export function recordRecentRound(progress:Progress, record:RoundRecord):Progress {
  if(!isCompletedRecentRecord(record,record.level))return progress;
  return {...progress,recentByDifficulty:{...progress.recentByDifficulty,[record.level]:{...record}}};
}
