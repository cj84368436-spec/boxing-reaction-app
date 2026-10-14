import {loadFullScreenAd, showFullScreenAd} from '@apps-in-toss/framework';

import {ACTIVE_REWARDED_RETRY_AD_GROUP_ID} from './adGroupIds';
import {AdOperation, AD_LOAD_TIMEOUT_MS, AD_SHOW_TIMEOUT_MS, AD_REWARD_WAIT_MS} from './adOperation';

export {ACTIVE_REWARDED_RETRY_AD_GROUP_ID, LIVE_REWARDED_RETRY_AD_GROUP_ID} from './adGroupIds';

type LoadEvent = {type: 'loaded'};
type ShowEvent =
  | {type: 'requested' | 'show' | 'impression' | 'clicked' | 'dismissed' | 'failedToShow'}
  | {type: 'userEarnedReward'; data: {unitType: string; unitAmount: number}};

interface LoadParams {
  readonly adGroupId: string;
  readonly onEvent: (event: LoadEvent) => void;
  readonly onError: (error: unknown) => void;
}

interface ShowParams {
  readonly adGroupId: string;
  readonly onEvent: (event: ShowEvent) => void;
  readonly onError: (error: unknown) => void;
}

export interface FullScreenAdPort {
  readonly isLoadSupported: () => boolean;
  readonly isShowSupported: () => boolean;
  readonly load: (params: LoadParams) => () => void;
  readonly show: (params: ShowParams) => () => void;
}

export type RewardedRetryAdPhase = 'idle' | 'loading' | 'ready' | 'showing' | 'error' | 'unsupported';

export interface RewardedRetryAdState {
  readonly phase: RewardedRetryAdPhase;
  readonly message: string;
  readonly actionLabel?: string;
}

export interface RewardedRetryAdGate {
  prepare(observer: (state: RewardedRetryAdState) => void): () => void;
  attempt(onRewardedAndClosed: () => void): boolean;
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

export class RewardedRetryAdController implements RewardedRetryAdGate {
  private operation?: AdOperation;
  private recoverAfterReturn?: () => void;
  private observer: ((state: RewardedRetryAdState) => void) | undefined;
  private phase: RewardedRetryAdPhase = 'idle';

  constructor(
    private readonly port: FullScreenAdPort = sdkPort,
    private readonly adGroupId = ACTIVE_REWARDED_RETRY_AD_GROUP_ID,
  ) {}

  prepare(observer: (state: RewardedRetryAdState) => void): () => void {
    this.observer = observer;
    this.load();
    return () => this.dispose();
  }

  attempt(onRewardedAndClosed: () => void): boolean {
    if (this.phase === 'error') {
      if (this.recoverAfterReturn) this.recoverAfterReturn();
      else this.load('광고 다시 준비 중…');
      return false;
    }
    if (this.phase !== 'ready') return false;
    let supported: boolean;
    try { supported = this.port.isShowSupported(); }
    catch { this.emit('error', '광고를 표시하지 못했습니다. 다시 눌러 주세요.'); return false; }
    if (!supported) {
      this.emit('unsupported', '광고는 토스 앱의 QR 테스트에서 확인할 수 있습니다.');
      return false;
    }

    const operation = this.startOperation();
    let rewardEarned = false;
    let closed = false;
    let timedOut = false;
    const finishReward = () => {
      if (!operation.active) return;
      operation.stop();
      this.recoverAfterReturn = undefined;
      this.emit('idle', '');
      onRewardedAndClosed();
    };
    const fail = () => {
      if (!operation.active) return;
      operation.stop();
      this.recoverAfterReturn = undefined;
      this.emit('error', '광고를 표시하지 못했습니다. 다시 눌러 주세요.');
    };
    const offerRecovery = () => {
      this.recoverAfterReturn = () => {
        // This is an explicit tap on the returned game, never a timer award.
        if (rewardEarned) finishReward();
        else this.load('광고 다시 준비 중…');
      };
      this.emit('error', closed
        ? '광고 보상 확인이 지연됩니다. 다시 준비하거나 잠시 기다려 주세요.'
        : '광고 응답이 지연됩니다. 광고 화면을 닫고 다시 눌러 주세요.',
      rewardEarned ? '광고 닫고 재도전' : closed ? '광고 다시 불러오기' : '광고 닫고 다시 준비');
    };
    this.emit('showing', '광고 재생 중…');
    operation.after(AD_SHOW_TIMEOUT_MS, () => {timedOut = true; offerRecovery();});
    try { operation.attach(this.port.show({
      adGroupId: this.adGroupId,
      onEvent: event => {
        if (!operation.active) return;
        if (event.type === 'userEarnedReward') {
          rewardEarned = true;
          if (closed) finishReward();
          else if (timedOut) offerRecovery();
          else this.emit('showing', '광고 시청 완료 · 닫으면 재도전합니다.');
          return;
        }
        if (event.type === 'dismissed') {
          if (closed) return;
          closed = true;
          if (rewardEarned) finishReward();
          else {
            this.emit('showing', '광고 보상을 확인하고 있습니다…');
            // Keep listening after this deadline until manual retry/dispose.
            operation.after(AD_REWARD_WAIT_MS, offerRecovery);
          }
          return;
        }
        if (event.type === 'failedToShow') {
          fail();
        }
      },
      onError: fail,
    })); } catch {
      fail();
      return false;
    }
    return true;
  }

  dispose(): void {
    this.operation?.stop();
    this.operation = undefined;
    this.recoverAfterReturn = undefined;
    this.phase = 'idle';
    this.observer = undefined;
  }

  private load(message = '광고 준비 중…'): void {
    const operation = this.startOperation();
    let supported: boolean;
    try { supported = this.port.isLoadSupported(); }
    catch { this.emit('error', '광고를 불러오지 못했습니다. 다시 눌러 주세요.'); return; }
    if (!supported) {
      this.emit('unsupported', '광고는 토스 앱의 QR 테스트에서 확인할 수 있습니다.');
      return;
    }
    this.emit('loading', message);
    const fail = (failureMessage = '광고를 불러오지 못했습니다. 다시 눌러 주세요.') => {
      if (!operation.active) return;
      operation.stop();
      this.emit('error', failureMessage);
    };
    operation.after(AD_LOAD_TIMEOUT_MS, () => fail('광고 준비 시간이 초과됐습니다. 다시 눌러 주세요.'));
    try { operation.attach(this.port.load({
      adGroupId: this.adGroupId,
      onEvent: event => {
        if (!operation.active || event.type !== 'loaded') return;
        operation.stop();
        this.emit('ready', '광고 준비 완료');
      },
      onError: () => fail(),
    })); } catch {
      fail();
    }
  }

  private startOperation(): AdOperation {
    this.operation?.stop();
    this.recoverAfterReturn = undefined;
    return this.operation = new AdOperation();
  }

  private emit(phase: RewardedRetryAdPhase, message: string, actionLabel?: string): void {
    this.phase = phase;
    this.observer?.({phase, message, ...(actionLabel ? {actionLabel} : {})});
  }
}

export function createRewardedRetryAdGate(): RewardedRetryAdGate {
  return new RewardedRetryAdController();
}


