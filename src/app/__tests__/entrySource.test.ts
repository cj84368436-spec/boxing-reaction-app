import {parseEntrySource,readEntrySource,SHARED_ENTRY_URI,APP_ENTRY_URI} from '../product/entrySource';
import {PlayRuntime} from '../product/playRuntime';
import {ProductEvents} from '../product/productEvents';
import {mapProductEvent} from '../analytics/appsAnalyticsAdapter';

test.each([
 [APP_ENTRY_URI,'direct'],[APP_ENTRY_URI+'/','direct'],[SHARED_ENTRY_URI,'shared_result'],
 [SHARED_ENTRY_URI+'/','shared_result'],[SHARED_ENTRY_URI+'?referrer=external_share','shared_result'],
 [APP_ENTRY_URI+'?source=shared_result','direct'],[SHARED_ENTRY_URI+'?source=evil','shared_result'],
 [APP_ENTRY_URI+'/wrong','unknown'],[APP_ENTRY_URI+'/shared/extra','unknown'],
 ['intoss://other/shared','unknown'],['https://boxing-talent-test/shared','unknown'],
 [APP_ENTRY_URI+'/shared%2Fextra','unknown'],[APP_ENTRY_URI+'/shared?x=%ZZ','unknown'],
 [APP_ENTRY_URI+'/shared?x='+'x'.repeat(5000),'unknown'],['','unknown'],[null,'unknown'],[undefined,'unknown'],
 ['intoss://boxing-talent-test@evil/shared','unknown'],['/shared','unknown'],
])('classifies only the official app path (%s)',(uri,expected)=>expect(parseEntrySource(uri)).toBe(expected));
test('URI bridge exceptions are nonblocking and are not logged as raw data',()=>{
 expect(readEntrySource(()=>{throw Error('private URI');})).toBe('unknown');
 expect(SHARED_ENTRY_URI).toBe('intoss://boxing-talent-test/shared');
 expect(SHARED_ENTRY_URI).not.toMatch(/[?#]/);
});
test.each(['direct','shared_result','unknown'] as const)('initial %s survives navigation, tutorial and rounds but not a fresh runtime',source=>{
 const events=new ProductEvents(),runtime=new PlayRuntime(events,null);
 expect(events.snapshot()).toEqual([]);
 runtime.initializeEntrySource(source);runtime.initializeEntrySource('direct');
 runtime.track('landing_view',{entry_source:'evil'});runtime.track('tutorial_start');runtime.completeTutorial();
 runtime.track('landing_view');const round=runtime.startRound({source:'landing',entry_source:'evil'});
 runtime.endRound(round,'knockout');runtime.prepareRetry('free_retry');runtime.startRound({source:'free_retry'});
 expect(runtime.entrySource).toBe(source);
 expect(events.snapshot().every(e=>e.data.entry_source===source)).toBe(true);
 expect(events.snapshot().filter(e=>e.name==='app_open')).toHaveLength(1);
 expect(runtime.deathsSinceLastAd).toBe(1);
 expect(new PlayRuntime(new ProductEvents(),'direct').entrySource).toBe('direct');
});
test('omitted initialization safely defaults to unknown on first event',()=>{
 const runtime=new PlayRuntime(new ProductEvents(),null);runtime.startRound();runtime.initializeEntrySource('shared_result');
 expect(runtime.events.snapshot().map(e=>e.name)).toEqual(['app_open','game_start']);
 expect(runtime.entrySource).toBe('unknown');
});
test.each(['direct','shared_result','unknown','private-user',null,undefined])('analytics allows only finite entry_source values: %s',source=>{
 for(const name of ['app_open','landing_view','game_start'] as const){
 const p=mapProductEvent({name,at:1,data:{entry_source:source??null,uri:'private URI'}},{appVersion:'test'})!;
 expect(p.params.entry_source).toBe(['direct','shared_result','unknown'].includes(source as string)?source:'unknown');
 expect(JSON.stringify(p)).not.toContain('private');
 }
});
