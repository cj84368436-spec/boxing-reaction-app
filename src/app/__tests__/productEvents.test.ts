import {ProductEvents} from '../product/productEvents';
import {PlayRuntime} from '../product/playRuntime';
test('keeps a bounded local journal and isolates observer failure',()=>{
 const events=new ProductEvents(()=>{throw new Error('offline');},3);
 for(let i=0;i<5;i++)expect(()=>events.record('landing_view',{index:i})).not.toThrow();
 expect(events.snapshot()).toHaveLength(3);
 expect(events.snapshot()[0]!.data.index).toBe(2);
});
test('uses distinct product rounds and emits one end for each actual round',()=>{
 const events=new ProductEvents();const runtime=new PlayRuntime(events);
 const first=runtime.startRound({level:1,source:'landing'});
 runtime.endRound(first,'knockout');runtime.endRound(first,'knockout');
 runtime.prepareRetry('free_retry');
 const second=runtime.startRound({level:1,source:'free_retry'});
 runtime.endRound(second,'clear');
 expect(events.snapshot().filter(e=>e.name==='game_end').map(e=>e.data.reason)).toEqual(['knockout','clear']);
 const retries=events.snapshot().filter(e=>e.name==='retry_game_start');
 expect(retries).toHaveLength(1);expect(retries[0]!.data.previousRoundId).toBe(first.id);
 expect(events.snapshot().filter(e=>e.name==='app_open')).toHaveLength(1);
});
test('async observer rejection is isolated and cannot mutate the bounded journal',async()=>{
 const events=new ProductEvents(async event=>{(event.data as Record<string,unknown>).seed='mutated';throw Error('rejected');});
 events.record('game_start',{level:1});await Promise.resolve();await Promise.resolve();
 expect(events.observerFailureCount).toBe(1);expect(events.snapshot()[0]!.data).toEqual({level:1});
});
