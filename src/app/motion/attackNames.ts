/** One vocabulary for detailed logs and the focused miss review. */
export const ATTACK_NAMES: Readonly<Record<string, string>> = {
  LEAD_JAB_HEAD: '잽',
  REAR_STRAIGHT_HEAD: '스트레이트',
  LEAD_HOOK_HEAD: '훅',
  LEAD_UPPERCUT_HEAD: '어퍼컷',
};
export function attackLabel(attackId: string): string {
  return ATTACK_NAMES[attackId] ?? '알 수 없는 공격';
}
