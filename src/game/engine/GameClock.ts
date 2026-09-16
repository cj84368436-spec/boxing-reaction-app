export interface GameClock {
  nowMs(): number;
}

export class PerformanceGameClock implements GameClock {
  nowMs(): number {
    return performance.now();
  }
}
