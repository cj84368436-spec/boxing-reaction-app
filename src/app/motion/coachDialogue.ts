import type { CoachMood } from './boxingArtwork.js';

export const COACH_LINES = {
  brokenStreak: ['그럼 그렇지..'],
  firstMiss: ['그걸 맞나?', '허, 주먹 구경하러 왔나?', '눈은 뜨고 있는 거지?', '인사는 주먹으로 받는군.'],
  repeatedMiss: ['피하라고 했지, 받아내라고 했나?', '주먹이 자네를 참 잘 찾는군.', '방금 것도 못 봤나?', '몸보다 마음이 먼저 도망갔군.'],
  lastLife: ['한 대 남았네. 집 갈 준비는 됐나?', '다리는 링에 있는데 정신은 집에 갔군.', '다음 건 좀 피하게. 나도 민망하니.', '설마 또 맞을 생각인가?'],
  streak: ['……방금 건 제법인데.', '흠. 이제 눈이 따라오는군.', '잠깐. 이것도 피한다고?', '운이라고 하기엔 좀 오래 가네.'],
  downEarly: ['주먹 구경은 그만. 한 번은 피해보게.', '버튼 하나만 골라보게. 욕심은 나중에.', '다섯 대나 받았군. 다음엔 움직임부터 보게.'],
  downLate: ['버티긴 했는데, 결국 누웠군.', '거의 다 와서 집에 가는 건가?', '끝까지 서 있어야 실력이지.', '아깝다는 말은 일어나서 하게.'],
  survived: ['겨우 버텼군. 다음엔 좀 피하면서 해보게.', '서 있긴 하네. 그건 인정하지.', '이 정도에 만족할 건 아니겠지?', '살아남았다고 어깨가 벌써 올라가나?'],
  good: ['흠. 우연은 아닌 모양이군.', '제법이네. 딱 그만큼만 인정하지.', '다음 판에도 그러는지 보겠네.', '오늘은 발이 좀 가벼운 모양이야.'],
  perfect: ['……어? 한 대도 안 맞았어?', '오늘 내가 좀 피곤해서 그렇네.', '흠… 방금 건 인정하지.', '누가 미리 알려줬나? 다시 해보게.'],
} as const;
type Stage = keyof typeof COACH_LINES;

/** Shuffle once per stage; rendering the same event never consumes another line. */
export class CoachDialogue {
  private bags = new Map<Stage, string[]>();
  private previous = new Map<Stage, string>();
  private current = new Map<Stage, {event: string; line: string}>();
  constructor(private readonly random: () => number = Math.random) {}
  beginRound(): void { this.current.clear(); }
  pick(stage: Stage, event: string): string {
    const current = this.current.get(stage);
    if (current?.event === event) return current.line;
    let bag = this.bags.get(stage);
    if (!bag?.length) {
      bag = [...COACH_LINES[stage]];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      if (bag.at(-1) === this.previous.get(stage)) [bag[0], bag[bag.length - 1]] = [bag.at(-1)!, bag[0]!];
      this.bags.set(stage, bag);
    }
    const line = bag.pop()!;
    this.previous.set(stage, line); this.current.set(stage, {event, line});
    return line;
  }
}

export function resultCoachReaction(counts: Readonly<{PERFECT: number; SAFE: number; HIT: number}>, knockedOut: boolean, dialogue: CoachDialogue, event: string) {
  const total = counts.PERFECT + counts.SAFE + counts.HIT;
  const stage: Stage = knockedOut ? (counts.HIT / Math.max(total, 1) >= 0.7 ? 'downEarly' : 'downLate') : counts.PERFECT === total && total > 0 ? 'perfect' : counts.HIT <= 1 ? 'good' : 'survived';
  const mood: CoachMood = stage === 'perfect' ? 'surprised' : stage === 'good' ? 'interested' : 'smirk';
  return {mood, line: dialogue.pick(stage, event), note: knockedOut ? '다섯 번 피격되어 다운됐습니다. 다시 도전해보세요.' : '다음 판에는 완벽 회피 기록을 높여보세요.'};
}
