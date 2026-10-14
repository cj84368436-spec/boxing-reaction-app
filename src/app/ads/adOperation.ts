// These are ad recovery deadlines, separate from game/attack timing.
export const AD_LOAD_TIMEOUT_MS = 15_000;
export const AD_SHOW_TIMEOUT_MS = 120_000;
export const AD_REWARD_WAIT_MS = 5_000;

/** Owns callbacks and one deadline, including synchronous SDK callbacks. */
export class AdOperation {
  active = true;
  private cleanup?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  attach(cleanup: () => void): void {
    if (this.active) this.cleanup = cleanup;
    else cleanup();
  }

  after(ms: number, callback: () => void): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    if (!this.active) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.active) callback();
    }, ms);
  }

  stop(): void {
    this.active = false;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const cleanup = this.cleanup;
    this.cleanup = undefined;
    cleanup?.();
  }
}
