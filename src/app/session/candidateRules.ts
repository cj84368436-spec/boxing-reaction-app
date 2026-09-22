import { P0_ATTACKS } from '../../game/config/p0Attacks.js';
import type { AttackDefinition, ComboDefinition } from '../../game/model/types.js';
export const CANDIDATE_ATTACKS: Readonly<Record<string, AttackDefinition>> = {
 ...P0_ATTACKS,
 REAR_STRAIGHT_HEAD: {...P0_ATTACKS.REAR_STRAIGHT_HEAD, defenseMatrix:{LEFT:'PERFECT',RIGHT:'HIT',BACK:'HIT',GUARD:'SAFE'}},
};
export const GUARD_CAPACITY = 2;
export const EARLY_RECOVERY_MS = 240;
export function candidatePatterns(seed: number): readonly ComboDefinition[] {
 const j=CANDIDATE_ATTACKS.LEAD_JAB_HEAD!,s=CANDIDATE_ATTACKS.REAR_STRAIGHT_HEAD!,h=CANDIDATE_ATTACKS.LEAD_HOOK_HEAD!;
 const variation=(seed>>>0)%3;
 return [
 {comboId:'single-jab',attacks:[j],attackStartOffsetsMs:[0],recoveryAfterMs:850},
 {comboId:'single-straight',attacks:[s],attackStartOffsetsMs:[0],recoveryAfterMs:850},
 {comboId:'single-hook',attacks:[h],attackStartOffsetsMs:[0],recoveryAfterMs:950},
 {comboId:'one-two',attacks:variation===1?[s,j]:[j,s],attackStartOffsetsMs:[0,720],recoveryAfterMs:1000},
 {comboId:'offbeat-hook',attacks:variation===2?[h,s]:[j,h],attackStartOffsetsMs:[0,1040],recoveryAfterMs:1050},
 {comboId:'final-exam',attacks:variation===0?[j,s,h]:variation===1?[h,j,s]:[s,h,j],attackStartOffsetsMs:[0,720,1660],recoveryAfterMs:1000},
 ];
}
export function candidateFailureReason(attackId:string,input?:string):string {
 if(input==='GUARD') return '가드 소진 · 회피로 회복하세요';
 if(attackId==='LEAD_JAB_HEAD' && input?.startsWith('WEAVE')) return '잽에는 위빙보다 좌우 슬립이 정확해요';
 if(attackId==='REAR_STRAIGHT_HEAD') {
  if(input==='BACK'||input==='SWAY') return '전진 스트레이트 · 뒤로도 닿아요';
  if(input?.startsWith('SLIP')||input?.startsWith('WEAVE')) return '뒷손 스트레이트는 좌 슬립으로 피하세요';
  return '오른쪽은 뒷손 궤적 · 왼쪽으로 피하세요';
 }
 if(attackId==='LEAD_HOOK_HEAD' && (input?.startsWith('SLIP')||input?.startsWith('WEAVE'))) return '리드 훅은 우 위빙으로 피하세요';
 return '훅 안쪽으로 이동 · 오른쪽으로 숙이세요';
}
