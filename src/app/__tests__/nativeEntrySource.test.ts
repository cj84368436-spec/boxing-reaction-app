jest.mock('@apps-in-toss/framework',()=>({
 getSchemeUri:jest.fn(),eventLog:jest.fn(async()=>{}),getOperationalEnvironment:jest.fn(()=> 'toss'),
 AppsInToss:{registerApp:jest.fn((container)=>container)},
}));
jest.mock('../../../require.context',()=>({context:{}}));
import {getSchemeUri,eventLog,AppsInToss} from '@apps-in-toss/framework';
import {initializeNativeEntrySource} from '../product/nativeEntrySource';
import {PlayRuntime} from '../product/playRuntime';
import {ProductEvents} from '../product/productEvents';
import {installNativeProductAnalytics} from '../analytics/nativeProductAnalytics';

beforeEach(()=>{jest.clearAllMocks();Object.defineProperty(global,'__DEV__',{value:false,configurable:true,writable:true});});
afterEach(()=>{Object.defineProperty(global,'__DEV__',{value:true,configurable:true,writable:true});});
test.each([
 ['intoss://boxing-talent-test','direct'],['intoss://boxing-talent-test/shared','shared_result'],
 ['intoss://boxing-talent-test/no-such-path','unknown'],['','unknown'],
])('initial bridge %s reaches app_open, landing and actual round with %s',(uri,source)=>{
 jest.mocked(getSchemeUri).mockReturnValue(uri);
 const runtime=new PlayRuntime(new ProductEvents(),null);
 initializeNativeEntrySource(runtime);const adapter=installNativeProductAnalytics(runtime.events)!;
 runtime.track('landing_view',{level:1});runtime.startRound({source:'landing',level:1});
 expect(jest.mocked(eventLog).mock.calls.map(c=>[c[0].log_name,c[0].params.entry_source])).toEqual([
  ['boxing_app_open',source],['boxing_landing_view',source],['boxing_game_start',source],
 ]);
 jest.mocked(getSchemeUri).mockReturnValue('intoss://boxing-talent-test');initializeNativeEntrySource(runtime);
 expect(runtime.entrySource).toBe(source);expect(eventLog).toHaveBeenCalledTimes(3);adapter.dispose();
});
test('failed URI attribution still permits home, KO and free retry',()=>{
 jest.mocked(getSchemeUri).mockImplementationOnce(()=>{throw Error('bridge unavailable');});
 const runtime=new PlayRuntime(new ProductEvents(),null);initializeNativeEntrySource(runtime);
 runtime.track('landing_view');const r=runtime.startRound({source:'landing'});runtime.endRound(r,'knockout');
 runtime.prepareRetry('free_retry');runtime.startRound({source:'free_retry'});
 expect(runtime.entrySource).toBe('unknown');expect(runtime.deathsSinceLastAd).toBe(1);
 expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(2);
});
test('real app bootstrap resolves attribution before journal replay and route registration',()=>{
 jest.mocked(getSchemeUri).mockReturnValue('intoss://boxing-talent-test/shared');
 require('../../_app');
 expect(eventLog).toHaveBeenCalledWith(expect.objectContaining({log_name:'boxing_app_open',params:expect.objectContaining({entry_source:'shared_result'})}));
 expect(AppsInToss.registerApp).toHaveBeenCalledTimes(1);
 expect(jest.mocked(getSchemeUri).mock.invocationCallOrder[0]!).toBeLessThan(jest.mocked(eventLog).mock.invocationCallOrder[0]!);
 expect(jest.mocked(eventLog).mock.invocationCallOrder[0]!).toBeLessThan(jest.mocked(AppsInToss.registerApp).mock.invocationCallOrder[0]!);
});
