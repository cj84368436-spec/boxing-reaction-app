jest.mock('@apps-in-toss/framework', () => ({
  loadFullScreenAd: Object.assign(jest.fn(), {isSupported: () => false}),
  showFullScreenAd: Object.assign(jest.fn(), {isSupported: () => false}),
}));

import {
  RewardedRetryAdController,
  type FullScreenAdPort,
  type RewardedRetryAdState,
} from '../ads/rewardedRetryAd';

describe('rewarded retry ad', () => {
  it('records native events once, distinguishes show from request and survives a broken analytics sink',()=>{
    const events:string[]=[];const controller=new RewardedRetryAdController(port,undefined,(name)=>{events.push(name);throw new Error('local sink');});
    controller.prepare(()=>{});loadEvent?.({type:'loaded'});loadEvent?.({type:'loaded'});
    const done=jest.fn();controller.attempt(done);
    showEvent?.({type:'requested'});expect(events).not.toContain('ad_start');
    showEvent?.({type:'show'});showEvent?.({type:'show'});
    showEvent?.({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}});
    showEvent?.({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}});
    expect(done).not.toHaveBeenCalled();showEvent?.({type:'dismissed'});showEvent?.({type:'dismissed'});
    expect(done).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['ad_request','ad_loaded','ad_start','ad_reward','ad_dismissed','ad_complete']);
  });
  it.each(['isLoadSupported', 'load'] as const)('handles a synchronous %s failure without granting a reward', method => {
    const controller = new RewardedRetryAdController({...port,
      [method]: () => {throw new Error('bridge failed');}});
    expect(() => controller.prepare(state => states.push(state))).not.toThrow();
    expect(states.at(-1)?.phase).toBe('error');
    let rewards = 0;
    expect(() => controller.attempt(() => {rewards++;})).not.toThrow();
    expect(rewards).toBe(0);
  });

  it.each(['isShowSupported', 'show'] as const)('does not reward a synchronous %s failure', method => {
    const controller = new RewardedRetryAdController({...port,
      [method]: () => {throw new Error('bridge failed');}});
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    let rewards = 0;
    expect(() => controller.attempt(() => {rewards++;})).not.toThrow();
    expect(states.at(-1)?.phase).toBe('error');
    expect(rewards).toBe(0);
  });

  let loadEvent: ((event: {type: 'loaded'}) => void) | undefined;
  let loadError: ((error: unknown) => void) | undefined;
  let showEvent:
    | ((event:
        | {type: 'requested' | 'show' | 'impression' | 'clicked' | 'dismissed' | 'failedToShow'}
        | {type: 'userEarnedReward'; data: {unitType: string; unitAmount: number}}) => void)
    | undefined;
  let showError: ((error: unknown) => void) | undefined;
  let port: FullScreenAdPort;
  let states: RewardedRetryAdState[];

  beforeEach(() => {
    jest.useFakeTimers();
    loadEvent = undefined;
    loadError = undefined;
    showEvent = undefined;
    showError = undefined;
    states = [];
    port = {
      isLoadSupported: () => true,
      isShowSupported: () => true,
      load: jest.fn(({onEvent, onError}) => {
        loadEvent = onEvent;
        loadError = onError;
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

  it('releases subscriptions even when the SDK completes synchronously', () => {
    const cleanupLoad = jest.fn(), cleanupShow = jest.fn(), reward = jest.fn();
    const controller = new RewardedRetryAdController({...port,
      load: ({onEvent}) => {onEvent({type: 'loaded'}); return cleanupLoad;},
      show: ({onEvent}) => {
        onEvent({type: 'userEarnedReward', data: {unitType: '재도전', unitAmount: 1}});
        onEvent({type: 'dismissed'});
        return cleanupShow;
      },
    });
    controller.prepare(state => states.push(state));
    controller.attempt(reward);
    expect(reward).toHaveBeenCalledTimes(1);
    expect(cleanupLoad).toHaveBeenCalledTimes(1);
    expect(cleanupShow).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('grants exactly once when the reward arrives after dismissal, including after the waiting deadline', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(reward);
    showEvent?.({type: 'dismissed'});
    jest.advanceTimersByTime(5000);
    expect(states.at(-1)?.phase).toBe('error');
    showEvent?.({type: 'userEarnedReward', data: {unitType: '재도전', unitAmount: 1}});
    showEvent?.({type: 'dismissed'});
    expect(reward).toHaveBeenCalledTimes(1);
  });

  it('times out loading, allows retry, and rejects callbacks from the old load', () => {
    const controller = new RewardedRetryAdController(port);
    controller.prepare(state => states.push(state));
    const oldLoad = loadEvent;
    jest.advanceTimersByTime(15000);
    expect(states.at(-1)?.phase).toBe('error');
    controller.attempt(jest.fn());
    oldLoad?.({type: 'loaded'});
    expect(states.at(-1)?.phase).toBe('loading');
    loadEvent?.({type: 'loaded'});
    expect(states.at(-1)?.phase).toBe('ready');
  });

  it('never grants reward without dismissal even after the show deadline and recovery tap', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type:'loaded'});
    controller.attempt(reward);
    const oldShow = showEvent;
    showEvent?.({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}});
    jest.advanceTimersByTime(120000);
    controller.attempt(reward);
    expect(reward).not.toHaveBeenCalled();
    oldShow?.({type:'dismissed'});
    expect(reward).not.toHaveBeenCalled();
    loadEvent?.({type:'loaded'});
    controller.attempt(reward);
    showEvent?.({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}});
    showEvent?.({type:'dismissed'});
    expect(reward).toHaveBeenCalledTimes(1);
  });

  it('never rewards a missing show callback and ignores that attempt after manual recovery', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(reward);
    const oldShow = showEvent;
    jest.advanceTimersByTime(120000);
    expect(states.at(-1)?.phase).toBe('error');
    controller.attempt(reward);
    oldShow?.({type: 'userEarnedReward', data: {unitType: '재도전', unitAmount: 1}});
    oldShow?.({type: 'dismissed'});
    expect(reward).not.toHaveBeenCalled();
    expect(states.at(-1)?.phase).toBe('loading');
  });

  it('cleans up timers and late rewards when disposed during the dismissal wait', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(reward);
    showEvent?.({type: 'dismissed'});
    controller.dispose();
    expect(jest.getTimerCount()).toBe(0);
    showEvent?.({type: 'userEarnedReward', data: {unitType: '재도전', unitAmount: 1}});
    expect(reward).not.toHaveBeenCalled();
  });

  it('uses the issued live rewarded group and grants retry only after reward and close', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();

    controller.prepare(state => states.push(state));
    expect(port.load).toHaveBeenCalledWith(expect.objectContaining({adGroupId: 'ait.v2.live.0a25ead0c3b642ae'}));
    expect(controller.attempt(reward)).toBe(false);

    loadEvent?.({type: 'loaded'});
    expect(states.at(-1)?.phase).toBe('ready');
    expect(controller.attempt(reward)).toBe(true);
    expect(port.show).toHaveBeenCalledWith(expect.objectContaining({adGroupId: 'ait.v2.live.0a25ead0c3b642ae'}));
    expect(reward).not.toHaveBeenCalled();

    showEvent?.({type: 'userEarnedReward', data: {unitType: 'retry', unitAmount: 1}});
    showEvent?.({type: 'userEarnedReward', data: {unitType: 'retry', unitAmount: 1}});
    expect(reward).not.toHaveBeenCalled();
    showEvent?.({type: 'dismissed'});
    expect(reward).toHaveBeenCalledTimes(1);
  });

  it('does not reward early closure and allows manual reload after waiting for delayed reward', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(reward);

    showEvent?.({type: 'dismissed'});

    expect(reward).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(states.at(-1)?.phase).toBe('error');
    controller.attempt(reward);
    expect(states.at(-1)).toMatchObject({phase: 'loading'});
    expect(port.load).toHaveBeenCalledTimes(2);
  });

  it('does not retry on load or show failure and keeps a retryable error message', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadError?.(new Error('offline'));
    expect(states.at(-1)).toMatchObject({phase: 'error'});
    expect(reward).not.toHaveBeenCalled();

    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(reward);
    showError?.(new Error('show failed'));
    expect(reward).not.toHaveBeenCalled();
    expect(states.at(-1)?.message).toContain('표시하지 못했습니다');
  });

  it('ignores late callbacks after dispose', () => {
    const controller = new RewardedRetryAdController(port);
    const reward = jest.fn();
    controller.prepare(state => states.push(state));
    loadEvent?.({type: 'loaded'});
    controller.attempt(reward);
    controller.dispose();

    showEvent?.({type: 'userEarnedReward', data: {unitType: 'retry', unitAmount: 1}});
    showEvent?.({type: 'dismissed'});

    expect(reward).not.toHaveBeenCalled();
  });
});



