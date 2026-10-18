jest.mock('@apps-in-toss/framework',()=>({eventLog:jest.fn(async()=>{}),getOperationalEnvironment:jest.fn(()=> 'toss')}));
import {eventLog,getOperationalEnvironment} from '@apps-in-toss/framework';
import {installNativeProductAnalytics} from '../analytics/nativeProductAnalytics';
import {ProductEvents} from '../product/productEvents';
import {PlayRuntime} from '../product/playRuntime';
afterEach(()=>{Object.defineProperty(global,'__DEV__',{value:true,configurable:true,writable:true});jest.clearAllMocks();});
test('development and sandbox never invoke the real native transport',()=>{
 const events=new ProductEvents();new PlayRuntime(events);
 Object.defineProperty(global,'__DEV__',{value:true,configurable:true,writable:true});expect(installNativeProductAnalytics(events)).toBeNull();
 Object.defineProperty(global,'__DEV__',{value:false,configurable:true,writable:true});jest.mocked(getOperationalEnvironment).mockReturnValue('sandbox');expect(installNativeProductAnalytics(events)).toBeNull();
 expect(eventLog).not.toHaveBeenCalled();
});
test('release Toss installs once, replays initial app_open, then sends official payloads via an explicit mock',async()=>{
 Object.defineProperty(global,'__DEV__',{value:false,configurable:true,writable:true});jest.mocked(getOperationalEnvironment).mockReturnValue('toss');
 const events=new ProductEvents(),runtime=new PlayRuntime(events);const adapter=installNativeProductAnalytics(events)!;
 expect(installNativeProductAnalytics(events)).toBe(adapter);runtime.track('landing_view',{level:1});await Promise.resolve();
 expect(eventLog).toHaveBeenCalledTimes(2);expect(jest.mocked(eventLog).mock.calls[0]![0]).toMatchObject({log_name:'boxing_app_open',log_type:'event',params:{app_version:'0.1.0'}});adapter.dispose();
});
test('environment lookup failure preserves local gameplay',()=>{
 Object.defineProperty(global,'__DEV__',{value:false,configurable:true,writable:true});jest.mocked(getOperationalEnvironment).mockImplementationOnce(()=>{throw Error('bridge unavailable');});
 const events=new ProductEvents(),runtime=new PlayRuntime(events);expect(installNativeProductAnalytics(events)).toBeNull();const r=runtime.startRound();runtime.endRound(r,'knockout');expect(runtime.deathsSinceLastAd).toBe(1);expect(eventLog).not.toHaveBeenCalled();
});
