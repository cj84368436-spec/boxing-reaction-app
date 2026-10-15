import {PlayRuntime} from '../product/playRuntime';
import {ProductEvents} from '../product/productEvents';

const retries = (runtime:PlayRuntime) => runtime.events.snapshot().filter(e=>e.name==='retry_game_start');

test.each(['free_retry','ad_retry'] as const)('consumes %s context once, only on actual matching start',retryType=>{
 const runtime=new PlayRuntime();const previous=runtime.startRound();runtime.endRound(previous,'knockout');
 runtime.prepareRetry(retryType);
 expect(retries(runtime)).toHaveLength(0);
 // An unsuccessful ad attempt and screen disposal do not consume product context.
 const lease=runtime.acquireAd({},'rewarded')!;runtime.releaseAd(lease);
 expect(retries(runtime)).toHaveLength(0);
 const next=runtime.startRound({source:retryType});
 expect(retries(runtime)).toHaveLength(1);
 expect(retries(runtime)[0]!.data).toMatchObject({previousRoundId:previous.id,roundId:next.id,source:retryType});
 runtime.prepareRetry(retryType);runtime.startRound({source:retryType});
 expect(retries(runtime)).toHaveLength(1);
});

test.each(['landing','next_level'])('%s never inherits retry context',source=>{
 const runtime=new PlayRuntime();const old=runtime.startRound();runtime.endRound(old,'clear');
 runtime.prepareRetry('free_retry');runtime.startRound({source,previousRoundId:old.id});
 expect(retries(runtime)).toHaveLength(0);
 expect(runtime.events.snapshot().filter(e=>e.name==='game_start').at(-1)!.data.previousRoundId).toBeNull();
 runtime.startRound({source:'free_retry'});expect(retries(runtime)).toHaveLength(0);
});

test('explicit cancellation and a new runtime discard retry context',()=>{
 const runtime=new PlayRuntime();const old=runtime.startRound();runtime.endRound(old,'knockout');
 runtime.prepareRetry('free_retry');runtime.cancelRetry();runtime.startRound({source:'free_retry'});
 expect(retries(runtime)).toHaveLength(0);
 const fresh=new PlayRuntime();fresh.prepareRetry('ad_retry');fresh.startRound({source:'ad_retry'});
 expect(retries(fresh)).toHaveLength(0);expect(fresh.deathsSinceLastAd).toBe(0);
});

test('the synchronous analytics adapter fails open at every product boundary',()=>{
 const events=new ProductEvents();jest.spyOn(events,'record').mockImplementation(()=>{throw Error('offline');});
 const runtime=new PlayRuntime(events);
 for(const name of ['landing_view','result_view','free_retry_tap','ad_retry_tap','ad_complete'] as const)expect(()=>runtime.track(name)).not.toThrow();
 const first=runtime.startRound();runtime.endRound(first,'knockout');runtime.prepareRetry('free_retry');
 const second=runtime.startRound({source:'free_retry'});runtime.endRound(second,'knockout');
 expect(runtime.deathsSinceLastAd).toBe(2);
 const ad=runtime.acquireAd({},'rewarded')!;expect(runtime.completeReward(ad)).toBe(true);
 expect(runtime.deathsSinceLastAd).toBe(0);expect(runtime.analyticsFailureCount).toBeGreaterThan(0);
});
