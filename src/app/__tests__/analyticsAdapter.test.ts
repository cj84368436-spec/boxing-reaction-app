import {createAppsAnalyticsAdapter,mapProductEvent} from '../analytics/appsAnalyticsAdapter';
import {ProductEvents,type ProductEvent,type ProductEventName} from '../product/productEvents';
import {PlayRuntime} from '../product/playRuntime';
const event=(name:ProductEventName,data:ProductEvent['data']={}):ProductEvent=>({name,data,at:123});
const context={appVersion:'0.1.0',roundId:'r-test-1',previousRoundId:'r-test-0',difficulty:1};
test.each(['app_open','landing_view','game_start','game_end','result_view','free_retry_tap','ad_retry_tap','retry_game_start','ad_start','ad_reward','ad_dismissed','ad_complete','ad_fail','share_tap','share_outcome','tutorial_start','tutorial_complete'] as const)('%s has a namespaced official eventLog payload',name=>{
 const p=mapProductEvent(event(name,{level:1,source:'free_retry',previousRoundId:'old',reason:'knockout',survived:8,perfect:3}),context)!;
 expect(p.log_name).toBe('boxing_'+name);expect(p.params.app_version).toBe('0.1.0');expect(p.params.entry_source).toBe('unknown');
 expect(p.log_type).toBe(['landing_view','result_view'].includes(name)?'screen':'event');
 if(name.endsWith('_tap'))expect(p.params.event_type).toBe('click');
});
test('debug/preload events stay local, and arbitrary fields or string contents never leave',()=>{
 expect(mapProductEvent(event('ad_request'),context)).toBeNull();expect(mapProductEvent(event('ad_loaded'),context)).toBeNull();
 const p=mapProductEvent(event('share_outcome',{roundId:'private-round',seed:123,runtimeId:'private-runtime',userId:'private-user',phone:'private-phone',message:'private-target',outcome:'sheet_open',difficulty:1,perfect:4,survived:8,has_link:true,result_type:'knockout'}),context)!;
 expect(p.params.outcome).toBe('sheet_open');expect(p.params.round_id).toBe('r-test-1');expect(JSON.stringify(p)).not.toMatch(/private|seed|phone|runtimeId|userId|message/);
 expect(mapProductEvent(event('ad_fail',{reason:'private arbitrary error'}),context)!.params.failure_reason).toBeUndefined();
});
test('start, end, comparison and share semantics are structured and bounded',()=>{
 expect(mapProductEvent(event('game_start',{source:'free_retry',previousRoundId:'old'}),context)!.params).toMatchObject({is_retry:true,source:'free_retry'});
 expect(mapProductEvent(event('game_start',{source:'landing'}),context)!.params.is_retry).toBe(false);
 expect(mapProductEvent(event('game_end',{reason:'knockout',survived:4,perfect:0}),context)!.params).toMatchObject({reason:'knockout',survived:4,perfect:0});
 const p=mapProductEvent(event('result_view',{has_recent_comparison:true,comparison:'declined',previous_result:'knockout:17/30',current_result:'knockout:12/30',survived:12,is_personal_best:false}),context)!;
 expect(p.params).toMatchObject({comparison:'declined',survived:12,is_personal_best:false});expect(p.params.previous_result).toBeUndefined();
 expect(mapProductEvent(event('game_end',{survived:999,perfect:NaN,reason:'crash'}),context)!.params.reason).toBeUndefined();
});
test('deduplicates lifecycle events while retaining local journal and legitimate later landing/taps',async()=>{
 const send=jest.fn(async(_payload:any)=>{}),a=createAppsAnalyticsAdapter(send,{appVersion:'0.1.0'}),events=new ProductEvents();
 const runtime=new PlayRuntime(events);const detach=events.subscribe(a.record,true);
 events.record('app_open');runtime.track('landing_view',{level:1});runtime.track('landing_view',{level:1});
 const first=runtime.startRound({level:1,source:'landing'});runtime.endRound(first,'knockout');runtime.endRound(first,'knockout');
 runtime.track('result_view',{roundId:first.id,level:1,survived:4});runtime.track('result_view',{roundId:first.id,level:1,survived:4});
 runtime.prepareRetry('free_retry');runtime.track('free_retry_tap',{roundId:first.id});const second=runtime.startRound({level:1,source:'free_retry'});
 runtime.track('retry_game_start',{roundId:second.id,previousRoundId:first.id,level:1,source:'free_retry'});
 runtime.track('landing_view',{level:1});await Promise.resolve();
 const logs=send.mock.calls.map(c=>c[0]);expect(logs.filter(p=>p.log_name==='boxing_app_open')).toHaveLength(1);expect(logs.filter(p=>p.log_name==='boxing_landing_view')).toHaveLength(2);expect(logs.filter(p=>p.log_name==='boxing_game_end')).toHaveLength(1);expect(logs.filter(p=>p.log_name==='boxing_result_view')).toHaveLength(1);
 const retry=logs.filter(p=>p.log_name==='boxing_retry_game_start');expect(retry).toHaveLength(1);expect(retry[0]!.params.previous_round_id).toBe(logs.find(p=>p.log_name==='boxing_game_start')!.params.round_id);
 expect(events.snapshot().filter(e=>e.name==='result_view')).toHaveLength(2);detach();a.dispose();
});
test('sync throw, async reject and timeout never block game or subsequent events',async()=>{
 jest.useFakeTimers();try{
 const send=jest.fn().mockImplementationOnce(()=>{throw Error('throw');}).mockRejectedValueOnce(Error('reject')).mockImplementationOnce(()=>new Promise(()=>{})).mockResolvedValue(undefined);
 const a=createAppsAnalyticsAdapter(send,{appVersion:'0.1.0',timeoutMs:50});const events=new ProductEvents(a.record),runtime=new PlayRuntime(events);
 runtime.track('landing_view',{level:1});const round=runtime.startRound({level:1,source:'landing'});expect(runtime.endRound(round,'knockout')).toBe(true);
 await Promise.resolve();jest.advanceTimersByTime(51);await Promise.resolve();expect(a.diagnostics().failed).toBe(3);expect(runtime.deathsSinceLastAd).toBe(1);
 runtime.prepareRetry('free_retry');expect(runtime.startRound({source:'free_retry'}).id).not.toBe(round.id);expect(send).toHaveBeenCalled();a.dispose();
 }finally{jest.useRealTimers();}
});
test('preview-marked events never dispatch; ad order and deliberate new requests remain distinct',()=>{
 const send=jest.fn(),a=createAppsAnalyticsAdapter(send,{appVersion:'0.1.0'});
 a.record(event('share_tap',{preview_mock:true}));expect(send).not.toHaveBeenCalled();
 for(const name of ['ad_dismissed','ad_reward','ad_complete'] as const){a.record(event(name,{format:'rewarded',adRequestId:'rewarded-1'}));a.record(event(name,{format:'rewarded',adRequestId:'rewarded-1'}));}
 expect(send).toHaveBeenCalledTimes(3);expect(send.mock.calls.map(c=>c[0].log_name)).toEqual(['boxing_ad_dismissed','boxing_ad_reward','boxing_ad_complete']);
 a.record(event('ad_complete',{format:'rewarded',adRequestId:'rewarded-2'}));expect(send).toHaveBeenCalledTimes(4);a.dispose();
});
test('late rejection after timeout stays handled; pending work is bounded without retries',async()=>{
 jest.useFakeTimers();try{
  let reject!:(error:Error)=>void;
  const send=jest.fn(()=>new Promise<void>((_,r)=>{reject=r;})),a=createAppsAnalyticsAdapter(send,{appVersion:'0.1.0',timeoutMs:10});
  for(let i=0;i<40;i++)a.record(event('share_tap',{roundId:'test-round'}));
  expect(send).toHaveBeenCalledTimes(32);expect(a.diagnostics().dropped).toBe(8);
  jest.advanceTimersByTime(11);expect(a.diagnostics().pending).toBe(0);expect(a.diagnostics().failed).toBe(32);
  reject(Error('late'));await Promise.resolve();expect(a.diagnostics().failed).toBe(32);expect(send).toHaveBeenCalledTimes(32);a.dispose();
 }finally{jest.useRealTimers();}
});
test('privacy allowlist applies to every public event and unknown enum contents',()=>{
 for(const name of ['app_open','landing_view','game_start','game_end','result_view','free_retry_tap','ad_retry_tap','retry_game_start','ad_start','ad_reward','ad_dismissed','ad_complete','ad_fail','share_tap','share_outcome'] as const){
  const p=mapProductEvent(event(name,{seed:56789,real_name:'secret-name',phone:'secret-phone',userId:'secret-user',runtimeId:'secret-runtime',roundId:'secret-round',advertisingId:'secret-ad',target:'secret-recipient',source:'secret-source',outcome:'secret-outcome',format:'secret-format',reason:'secret-error',previous_result:'secret-previous',timestamp:12345}),{appVersion:'0.1.0'});
  expect(JSON.stringify(p)).not.toMatch(/secret|56789|12345/);
 }
});
