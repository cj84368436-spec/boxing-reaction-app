import type {RoundRecord} from '../session/progression.js';
import type {TenPunchSessionResult} from '../session/P0TenPunchSession.js';
import {attackLabel} from '../motion/attackNames.js';

/** Presentation only. Survival and PERFECT retain progression.ts semantics. */
export function resultSummary(record: RoundRecord, results: readonly TenPunchSessionResult[]) {
  const next = [5,10,15,20,25,30].find(value => value > record.survived) ?? 30;
  const goal = !record.cleared ? `다음 목표: ${next}번째 공격까지 버티기`
    : record.perfect < 30 ? `다음 목표: 완벽 회피 ${record.perfect + 1}회`
    : '다음 목표: 새 공격 순서에서도 30회 완벽 회피';
  const strength = record.streak >= 2 ? `잘한 점: 완벽 회피 ${record.streak}회 연속`
    : record.perfect > 0 ? `잘한 점: 완벽 회피 ${record.perfect}회`
    : results.some(result => result.outcome === 'SAFE') ? `잘한 점: 안전 방어 ${results.filter(result => result.outcome === 'SAFE').length}회` : null;
  const misses = new Map<string, number>();
  for (const result of results) if (result.outcome === 'HIT') misses.set(result.attackId, (misses.get(result.attackId) ?? 0) + 1);
  const missed = [...misses].sort((a,b) => b[1]-a[1])[0];
  return {goal, strength, weakness: missed ? `놓친 점: ${attackLabel(missed[0])} 피격 ${missed[1]}회` : null};
}
