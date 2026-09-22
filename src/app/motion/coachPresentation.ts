import { candidateFailureReason, CANDIDATE_ATTACKS } from '../session/candidateRules.js';
import { P0_ATTACKS } from '../../game/config/p0Attacks.js';
import { coachVerdict } from './boxingArtwork.js';
import type { TenPunchSessionResult, TenPunchSessionSnapshot } from '../session/P0TenPunchSession.js';
import type { CoachMood } from './boxingArtwork.js';

export interface CoachMoment { readonly mood: CoachMood; readonly line: string }
// Presentation-only quiet margins. Canonical cue, response and impact remain untouched.
const AFTER_CONTACT_MS = 240;
const BEFORE_NEXT_ATTACK_MS = 120;
export function getCoachMoment(snapshot: TenPunchSessionSnapshot): CoachMoment | null {
  const latest = snapshot.latestResult;
  if (!latest || snapshot.sessionCompleted) return null;
  const next = snapshot.scheduledAttacks[latest.attackIndex + 1];
  if (!next || next.comboIndex === latest.comboIndex || next.attackStartScheduledAtMs == null) return null;
  if (snapshot.nowMs < latest.telemetry.impactScheduledAtMs + AFTER_CONTACT_MS ||
      snapshot.nowMs >= next.attackStartScheduledAtMs - BEFORE_NEXT_ATTACK_MS) return null;
  const firstHit = snapshot.results.find(result => result.outcome === 'HIT');
  if (firstHit?.comboIndex === latest.comboIndex)
    return { mood: 'smirk', line: snapshot.ruleset === 'candidate' ? ['힘 빼고. 주먹부터 보게.', '서두르면 내가 이기지.', '방금 어깨 봤나?'][latest.comboIndex % 3]! : '그걸 맞나?' };
  if (snapshot.results.length >= 3 && snapshot.results.slice(-3).every(result => result.outcome !== 'HIT'))
    return { mood: snapshot.results.filter(r => r.outcome === 'PERFECT').length >= 6 ? 'surprised' : 'interested', line: snapshot.ruleset === 'candidate' ? ['……방금 건 제법인데.', '흠. 이제 눈이 따라오는군.', '잠깐. 이것도 피한다고?'][latest.comboIndex % 3]! : '……어?' };
  return null;
}

// Report an actual recorded miss; this never changes the result or timing window.
export function getRematchReview(results: readonly TenPunchSessionResult[], speed = 1, candidate = false) {
  const counts = { PERFECT: 0, SAFE: 0, HIT: 0 };
  for (const result of results) counts[result.outcome]++;
  const hits = results.filter(result => result.outcome === 'HIT');
  const reaction = results.length === 10 && counts.HIT === 1
    ? { mood: 'smirk' as const, line: '아홉 번은 잘했는데. 딱 한 대 맞았네?', note: '놓친 한 번을 넘기면, 관장도 인정해야 합니다.' }
    : coachVerdict(counts);
  const replaySameSeed = hits.length > 0;
  const roundSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const closeLate = hits.map(result => {
    const attack = candidate ? CANDIDATE_ATTACKS[result.attackId] : P0_ATTACKS[result.attackId as keyof typeof P0_ATTACKS];
    const {inputAtMs, inputButton, inputStatus, attackStartScheduledAtMs} = result.telemetry;
    if (!attack || inputStatus !== 'LATE' || inputAtMs == null || inputButton == null || attack.defenseMatrix[inputButton] === 'HIT') return null;
    const lateMs = (inputAtMs - attackStartScheduledAtMs - attack.responseWindowEndMs) / roundSpeed;
    return lateMs > 0 && lateMs <= 80 ? {result, lateMs} : null;
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null).sort((a,b) => a.lateMs - b.lateMs)[0];
  const target = closeLate?.result ?? hits[0];
  const label = target?.attackId === 'LEAD_JAB_HEAD' ? '잽' : target?.attackId === 'REAR_STRAIGHT_HEAD' ? '스트레이트' : '훅';
  let focusTitle = counts.PERFECT === 10 ? '관장의 말문을 막았습니다' : '열 번을 버텼습니다';
  let focusBody = counts.PERFECT === 10 ? '모두 완벽 회피. 새 공격 순서에서도 보여주세요.' : '방어 성공. 다음에는 완벽 회피를 늘려보세요.';
  if (target) {
    focusTitle = String(target.attackIndex + 1) + '번째 ' + label;
    if (closeLate) {
      focusTitle += ' · 조금 늦었어요';
      focusBody = '방어 가능한 시점보다 ' + Number((closeLate.lateMs / 1000).toFixed(3)).toString() + '초 늦게 눌렀어요. 이번에는 주먹이 움직일 때 반응해보세요.';
    } else {
      focusBody = target.telemetry.inputStatus === 'EARLY' ? '주먹이 움직이기 전에 눌렀어요. 다음에는 움직임을 보고 한 번 눌러보세요.'
        : target.telemetry.inputStatus === 'MULTI_INPUT' ? '여러 버튼을 함께 눌렀어요. 다음에는 한 방향만 골라보세요.'
        : target.telemetry.inputStatus === 'LATE' ? '방어할 수 있는 시점을 지났어요. 주먹이 닿기 전에 반응해보세요.'
        : target.telemetry.inputStatus === 'VALID' ? candidate ? candidateFailureReason(target.attackId, target.telemetry.inputButton) : '훅이 오는 쪽으로 움직였어요. 오른쪽으로 숙여 피하거나 가드해보세요.'
        : '입력이 없었어요. 주먹이 움직이면 방어 버튼을 한 번 눌러보세요.';
    }
  }
  if (candidate && counts.PERFECT >= 8 && counts.HIT === 0) {
    focusTitle = '인정 도장 · 관장의 팔짱을 풀었다';
    focusBody = '눈은 진짜군. 오늘부터 자네는 도전자야. 다음 패턴에서도 실력을 보여주세요.';
  }
  return { reaction, focusTitle, focusBody, replaySameSeed,
    retryLabel: replaySameSeed ? '관장에게 다시 도전' : '새 순서로 다시 도전',
    retryNote: replaySameSeed ? '같은 공격 순서 · 같은 속도' : '새 공격 순서 · 같은 속도' };
}
