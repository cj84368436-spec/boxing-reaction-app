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

  constructor(
    private readonly port: FullScreenAdPort = sdkPort,
    private readonly adGroupId = ACTIVE_STAGE_INTERSTITIAL_AD_GROUP_ID,
  ) {}

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
    catch { this.emit('error'); onClosed(); return false; }
    if (!supported) {
      this.emit('unsupported');
      onClosed();
      return false;
    }

    const operation = this.startOperation();
    const finish = () => {
      if (!operation.active) return;
      operation.stop();
      this.emit('idle');
      onClosed();
      if (this.observer) this.load();
    };

    this.emit('showing');
    operation.after(AD_SHOW_TIMEOUT_MS, () => {
      // A timer cannot prove that native ad UI has closed. Never auto-start.
      this.emit('error', '광고 응답이 지연됩니다. 광고를 닫고 다음 난이도 버튼을 다시 눌러 주세요.');
    });
    try { operation.attach(this.port.show({
      adGroupId: this.adGroupId,
      onEvent: event => {
        if (event.type === 'dismissed' || event.type === 'failedToShow') finish();
      },
      onError: finish,
    })); } catch { finish(); return false; }
    return true;
  }

  dispose(): void {
    this.operation?.stop();
    this.operation = undefined;
    this.phase = 'idle';
    this.observer = undefined;
  }

  private load(): void {
    const operation = this.startOperation();
    let supported: boolean;
    try { supported = this.port.isLoadSupported(); }
    catch { this.emit('error'); return; }
    if (!supported) {
      this.emit('unsupported');
      return;
    }
    this.emit('loading');
    const fail = () => {
      if (!operation.active) return;
      operation.stop();
      this.emit('error');
    };
    operation.after(AD_LOAD_TIMEOUT_MS, fail);
    try { operation.attach(this.port.load({
      adGroupId: this.adGroupId,
      onEvent: event => {
        if (!operation.active || event.type !== 'loaded') return;
        operation.stop();
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

export function createStageInterstitialAdGate(): StageInterstitialAdGate {
  return new StageInterstitialAdController();
}

