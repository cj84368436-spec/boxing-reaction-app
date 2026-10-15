import {ProductEvents, type EventData, type ProductEventName} from './productEvents.js';
export type RoundEndReason = 'clear' | 'knockout';
export type FullScreenKind = 'rewarded' | 'interstitial';
export interface ProductRound {readonly id: string}
export interface AdLease {readonly owner: object; readonly kind: FullScreenKind}
export type RetryType = 'free_retry' | 'ad_retry';
interface RetryContext {readonly previousRoundId: string; readonly retryType: RetryType}

let nextRuntime = 0;
/** Memory only: survives screen remounts, never writes player progress. */
export class PlayRuntime {
  private readonly runtimeId = `runtime-${Date.now()}-${++nextRuntime}`;
  constructor(readonly events = new ProductEvents()) {this.track('app_open');}
  private analyticsFailures = 0;
  get analyticsFailureCount(): number { return this.analyticsFailures; }
  track(name:ProductEventName,data:EventData={}):void {
    try {this.events.record(name,{...data,runtimeId:this.runtimeId,deathsSinceLastAd:this.deaths});}
    catch {this.analyticsFailures++;} // Synchronous adapter failures must never block play.
  }
  private sequence = 0;
  private deaths = 0;
  private practiced = false;
  get tutorialCompleted(): boolean { return this.practiced; }
  completeTutorial(): void { if(!this.practiced)this.track('tutorial_complete');this.practiced = true; }
  private readonly rounds = new WeakSet<ProductRound>();
  private readonly ended = new WeakSet<ProductRound>();
  private lastCompletedRoundId: string | null = null;
  private pendingRetry: RetryContext | null = null;
  private ad: AdLease | null = null;
  private readonly listeners = new Set<() => void>();

  get deathsSinceLastAd(): number { return this.deaths; }
  get requiresReward(): boolean { return this.deaths >= 2; }
  get fullScreenBusy(): boolean { return this.ad !== null; }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  }
  prepareRetry(retryType: RetryType): RetryContext | null {
    this.pendingRetry = this.lastCompletedRoundId
      ? {previousRoundId:this.lastCompletedRoundId,retryType} : null;
    return this.pendingRetry;
  }
  cancelRetry(): void { this.pendingRetry = null; }
  startRound(data:EventData={}): ProductRound {
    const retry = this.pendingRetry?.retryType === data.source ? this.pendingRetry : null;
    this.pendingRetry = null;
    this.lastCompletedRoundId = null;
    const round = {id:`${this.runtimeId}:round-${++this.sequence}`};
    this.rounds.add(round);
    const event = {...data,roundId:round.id,previousRoundId:retry?.previousRoundId??null};
    this.track('game_start',event);
    if(retry)this.track('retry_game_start',event);
    return round;
  }
  endRound(round: ProductRound, reason: RoundEndReason): boolean {
    if (!this.rounds.has(round) || this.ended.has(round)) return false;
    this.ended.add(round);
    this.lastCompletedRoundId = round.id;
    if (reason === 'knockout') this.deaths = Math.min(2, this.deaths + 1);
    this.track('game_end',{roundId:round.id,reason});
    this.notify();
    return true;
  }
  acquireAd(owner: object, kind: FullScreenKind): AdLease | null {
    if (this.ad) return null;
    this.ad = {owner,kind};
    this.notify();
    return this.ad;
  }
  releaseAd(lease: AdLease): boolean {
    if (this.ad !== lease) return false;
    this.ad = null;
    this.notify();
    return true;
  }
  completeReward(lease: AdLease): boolean {
    if (this.ad !== lease || lease.kind !== 'rewarded') return false;
    this.deaths = 0;
    return this.releaseAd(lease);
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
}

export const playRuntime = new PlayRuntime();
