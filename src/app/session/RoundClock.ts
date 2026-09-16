import type { GameClock } from '../../game/engine/GameClock.js';

// One clock drives BOTH the engine and its animation. Canonical timings stay intact.
export const ROUND_SPEEDS = { relaxed: 0.65, original: 1 } as const;
export class RoundClock implements GameClock {
  private elapsed = 0;
  private anchor = 0;
  private rate = 1;
  private running = false;
  constructor(private readonly source: GameClock) {}
  nowMs(): number {
    return this.elapsed + (this.running ? Math.max(0, this.source.nowMs() - this.anchor) * this.rate : 0);
  }
  start(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Round speed must be positive');
    this.rate = rate;
    this.elapsed = 0;
    this.anchor = this.source.nowMs();
    this.running = true;
  }
  pause(): void { this.elapsed = this.nowMs(); this.running = false; }
  resume(): void { if (!this.running) { this.anchor = this.source.nowMs(); this.running = true; } }
}
