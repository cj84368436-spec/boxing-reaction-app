jest.mock('@apps-in-toss/framework', () => ({
  loadFullScreenAd: Object.assign(jest.fn(), {isSupported: () => false}),
  showFullScreenAd: Object.assign(jest.fn(), {isSupported: () => false}),
}));

import {
  StageInterstitialAdController,
  type StageInterstitialAdState,
} from '../ads/stageInterstitialAd';
import type {FullScreenAdPort} from '../ads/rewardedRetryAd';

describe('stage interstitial ad', () => {
  it.each(['isLoadSupported', 'load'] as const)('handles a synchronous %s failure without blocking the game', method => {
    const port = {isLoadSupported: () => true, isShowSupported: () => true,
      load: () => () => undefined, show: () => () => undefined};
    port[method] = () => {throw new Error('bridge failed');};
    const states: StageInterstitialAdState[] = [];
    const controller = new StageInterstitialAdController(port);
    expect(() => controller.prepare(state => states.push(state))).not.toThrow();
    expect(states.at(-1)?.phase).toBe('error');
    let continued = 0;
    expect(() => controller.attempt(() => {continued++;})).not.toThrow();
    expect(continued).toBe(1);
  });

  it.each(['isShowSupported', 'show'] as const)('continues exactly once after a synchronous %s failure', method => {
    const controller = new StageInterstitialAdController({...port,
      [method]: () => {throw new Error('bridge failed');}});
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    let continued = 0;
    expect(() => controller.attempt(() => {continued++;})).not.toThrow();
    expect(continued).toBe(1);
    showEvent?.({type: 'dismissed'});
    expect(continued).toBe(1);
  });

  let loadEvent: ((event: {type: 'loaded'}) => void) | undefined;
  let showEvent: ((event: {type: 'requested' | 'show' | 'impression' | 'clicked' | 'dismissed' | 'failedToShow'}) => void) | undefined;
  let showError: ((error: unknown) => void) | undefined;
  let port: FullScreenAdPort;
  let states: StageInterstitialAdState[];

  beforeEach(() => {
    jest.useFakeTimers();
    loadEvent = undefined;
    showEvent = undefined;
    showError = undefined;
    states = [];
    port = {
      isLoadSupported: () => true,
      isShowSupported: () => true,
      load: jest.fn(({onEvent}) => {
        loadEvent = onEvent;
        return jest.fn();
      }),
      show: jest.fn(({onEvent, onError}) => {
        showEvent = onEvent;
        showError = onError;
        return jest.fn();
      }),
    };
  });

  afterEach(() => {jest.clearAllTimers(); jest.useRealTimers();});

  it('does not detach a new load when the previous show finishes synchronously', () => {
    const loadCleanup = jest.fn(), showCleanup = jest.fn();
    let loads = 0;
    const nextLoadCleanup = jest.fn();
    const synchronous = new StageInterstitialAdController({...port,
      load: ({onEvent}) => {if (++loads === 1) onEvent({type: 'loaded'}); return loads === 1 ? loadCleanup : nextLoadCleanup;},
      show: ({onEvent}) => {onEvent({type: 'dismissed'}); return showCleanup;},
    });
    synchronous.prepare(state => states.push(state));
    synchronous.attempt(jest.fn());
    expect(states.at(-1)?.phase).toBe('loading');
    expect(showCleanup).toHaveBeenCalledTimes(1);
    expect(nextLoadCleanup).not.toHaveBeenCalled();
    synchronous.dispose();
    expect(nextLoadCleanup).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('times out loading and still lets the next stage start', () => {
    const controller = new StageInterstitialAdController(port);
    const next = jest.fn();
    controller.prepare(state => states.push(state));
    const oldLoad = loadEvent;
    jest.advanceTimersByTime(15000);
    expect(states.at(-1)?.phase).toBe('error');
    controller.attempt(next);
    expect(next).toHaveBeenCalledTimes(1);
    oldLoad?.({type: 'loaded'});
    expect(states.at(-1)?.phase).toBe('loading');
  });

  it('never starts a stage on a show timeout and recovers only on a return tap', () => {
    const controller = new StageInterstitialAdController(port);
    const next = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(next);
    const oldShow = showEvent;
    jest.advanceTimersByTime(120000);
    expect(states.at(-1)?.phase).toBe('error');
    expect(next).not.toHaveBeenCalled();
    controller.attempt(next);
    oldShow?.({type: 'dismissed'});
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('cancels pending show recovery on dispose', () => {
    const controller = new StageInterstitialAdController(port);
    const next = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(next);
    controller.dispose();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(120000);
    showEvent?.({type: 'dismissed'});
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the issued live interstitial group and continues only after dismissal', () => {
    const controller = new StageInterstitialAdController(port);
    const continueToNextStage = jest.fn();
    controller.prepare(state => states.push(state));
    expect(port.load).toHaveBeenCalledWith(expect.objectContaining({adGroupId: 'ait.v2.live.0afa67d9d8934138'}));
    loadEvent?.({type: 'loaded'});
    expect(controller.attempt(continueToNextStage)).toBe(true);
    expect(continueToNextStage).not.toHaveBeenCalled();
    showEvent?.({type: 'dismissed'});
    expect(continueToNextStage).toHaveBeenCalledTimes(1);
    expect(port.load).toHaveBeenCalledTimes(2);
  });

  it('does not block the next stage when the ad is unavailable or fails', () => {
    const unavailable = new StageInterstitialAdController({...port, isLoadSupported: () => false});
    const continueWithoutAd = jest.fn();
    unavailable.prepare(state => states.push(state));
    expect(unavailable.attempt(continueWithoutAd)).toBe(false);
    expect(continueWithoutAd).toHaveBeenCalledTimes(1);

    const controller = new StageInterstitialAdController(port);
    const continueAfterFailure = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(continueAfterFailure);
    showError?.(new Error('show failed'));
    expect(continueAfterFailure).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated taps and late callbacks', () => {
    const controller = new StageInterstitialAdController(port);
    const continueToNextStage = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    expect(controller.attempt(continueToNextStage)).toBe(true);
    expect(controller.attempt(continueToNextStage)).toBe(false);
    controller.dispose();
    showEvent?.({type: 'dismissed'});
    expect(continueToNextStage).not.toHaveBeenCalled();
  });
});

