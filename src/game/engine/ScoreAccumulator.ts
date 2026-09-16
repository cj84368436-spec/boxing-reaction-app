import type { DefenseOutcome, P0ScoreSummary } from '../model/types.js';

export function scoreOutcome(outcome: DefenseOutcome): number {
  switch (outcome) {
    case 'PERFECT':
      return 2;
    case 'SAFE':
      return 1;
    case 'HIT':
      return 0;
  }
}

export function summarizeOutcomes(outcomes: readonly DefenseOutcome[]): P0ScoreSummary {
  let perfect = 0;
  let safe = 0;
  let hit = 0;
  let points = 0;

  for (const outcome of outcomes) {
    points += scoreOutcome(outcome);
    if (outcome === 'PERFECT') perfect += 1;
    else if (outcome === 'SAFE') safe += 1;
    else hit += 1;
  }

  return { perfect, safe, hit, points };
}
