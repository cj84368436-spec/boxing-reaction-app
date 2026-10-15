import {AdEvents, type AdEventObserver} from './adEvents';
import {loadFullScreenAd, showFullScreenAd} from '@apps-in-toss/framework';
import {ACTIVE_STAGE_INTERSTITIAL_AD_GROUP_ID} from './adGroupIds';
import type {FullScreenAdPort} from './rewardedRetryAd';
import {AdOperation, AD_LOAD_TIMEOUT_MS, AD_SHOW_TIMEOUT_MS} from './adOperation';

export {ACTIVE_STAGE_INTERSTITIAL_AD_GROUP_ID, LIVE_STAGE_INTERSTITIAL_AD_GROUP_ID} from './adGroupIds';

export type StageInterstitialAdPhase = 'idle' | 'loading' | 'ready' | 'showing' | 'error' | 'unsupported';

export interface StageInterstitialAdState {
  readonly phase: StageInterstitialAdPhase;
  readonly message?: string;
}

export interface StageInterstitialAdGate {
  prepare(observer: (state: StageInterstitialAdState) => void): () => void;
  attempt(onClosed: () => void): boolean;
  dispose(): void;
}

const sdkPort: FullScreenAdPort = {
  isLoadSupported: () => loadFullScreenAd.isSupported(),
  isShowSupported: () => showFullScreenAd.isSupported(),
  load: ({adGroupId, onEvent, onError}) =>
    loadFullScreenAd({options: {adGroupId}, onEvent, onError}),
  show: ({adGroupId, onEvent, onError}) =>
    showFullScreenAd({options: {adGroupId}, onEvent, onError}),
};

export class StageInterstitialAdController implements StageInterstitialAdGate {
  private operation?: AdOperation;
  private observer: ((state: StageInterstitialAdState) => void) | undefined;
  private phase: StageInterstitialAdPhase = 'idle';

  private readonly events:AdEvents;
  constructor(
    private readonly port: FullScreenAdPort = sdkPort,
    private readonly adGroupId = ACTIVE_STAGE_INTERSTITIAL_AD_GROUP_ID,
    observer?:AdEventObserver,
  ) {this.events=new AdEvents('interstitial',observer);}

  prepare(observer: (state: StageInterstitialAdState) => void): () => void {
    this.observer = observer;
    this.load();
    return () => this.dispose();
  }

  attempt(onClosed: () => void): boolean {
    if (this.phase === 'showing') return false;
    if (this.phase !== 'ready') {
      // An explicit tap after returning may abandon a silent show operation.
      if (this.phase === 'error') this.operation?.stop();
      onClosed();
      if (this.phase === 'error' && this.observer) this.load();
      return false;
    }
    let supported: boolean;
    try { supported = this.port.isShowSupported(); }
    catch { this.events.emit('ad_fail','sdk');this.emit('error'); onClosed(); return false; }
    if (!supported) {
      this.events.emit('ad_fail','unsupported');
      this.emit('unsupported');
      onClosed();
      return false;
    }

    const operation = this.startOperation();
    const finish = (failed=false) => {
      if (!operation.active) return;
      operation.stop();
      this.events.emit(failed?'ad_fail':'ad_complete',failed?'show':undefined);
      this.emit('idle');
      onClosed();
      if (this.observer) this.load();
    };

    this.emit('showing');
    operation.after(AD_SHOW_TIMEOUT_MS, () => {
      this.events.emit('ad_fail','show_timeout');
      // A timer cannot prove that native ad UI has closed. Never auto-start.
      this.emit('error', '광고 응답이 지연됩니다. 광고를 닫고 다음 난이도 버튼을 다시 눌러 주세요.');
    });
    try { operation.attach(this.port.show({
      adGroupId: this.adGroupId,
      onEvent: event => {
        if(!operation.active)return;
        if(event.type==='show')this.events.emit('ad_start');
        if(event.type==='dismissed'){this.events.emit('ad_dismissed');finish();}
        if(event.type==='failedToShow')finish(true);
      },
      onError: ()=>finish(true),
    })); } catch { finish(true); return false; }
    return true;
  }

  dispose(): void {
    this.operation?.stop();
    this.operation = undefined;
    this.phase = 'idle';
    this.observer = undefined;
  }

  private load(): void {
    this.events.request();
    const operation = this.startOperation();
    let supported: boolean;
    try { supported = this.port.isLoadSupported(); }
    catch { this.events.emit('ad_fail','sdk');this.emit('error'); return; }
    if (!supported) {
      this.events.emit('ad_fail','unsupported');
      this.emit('unsupported');
      return;
    }
    this.emit('loading');
    const fail = () => {
      if (!operation.active) return;
      operation.stop();
      this.events.emit('ad_fail','load');
      this.emit('error');
    };
    operation.after(AD_LOAD_TIMEOUT_MS, fail);
    try { operation.attach(this.port.load({
      adGroupId: this.adGroupId,
      onEvent: event => {
        if (!operation.active || event.type !== 'loaded') return;
        operation.stop();
        this.events.emit('ad_loaded');
        this.emit('ready');
      },
      onError: fail,
    })); } catch {
      fail();
    }
  }

  private startOperation(): AdOperation {
    this.operation?.stop();
    return this.operation = new AdOperation();
  }

  private emit(phase: StageInterstitialAdPhase, message?: string): void {
    this.phase = phase;
    this.observer?.({phase, ...(message ? {message} : {})});
  }
}

export function createStageInterstitialAdGate(observer?:AdEventObserver): StageInterstitialAdGate {
  return new StageInterstitialAdController(undefined,undefined,observer);
}

