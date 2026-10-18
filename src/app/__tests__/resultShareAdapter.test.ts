import {createResultShareAdapter} from '../sharing/resultShareAdapter';
const payload={title:'복싱 감각 테스트',text:'입문\n8 / 30 버텼어요',isPersonalBest:false};
const make=(extra:Record<string,unknown>={})=>{const port={platform:()=> 'ios',getLink:jest.fn(async()=> 'https://example.test/official-link'),show:jest.fn(async(_:unknown)=>({action:'sharedAction'})),...extra};return {port,adapter:createResultShareAdapter(port as any,{handoffDelayMs:0,linkTimeoutMs:10})};};
test.each([['ios','sharedAction','activity_completed'],['ios','dismissedAction','cancelled'],['android','sharedAction','sheet_open'],['android','dismissedAction','unconfirmed']])('%s %s only reports %s',async(platform,action,outcome)=>{
 const {adapter}=make({platform:()=>platform,show:async()=>({action})});expect(await adapter.share(payload,()=>true)).toMatchObject({outcome,hasLink:true});
});
test('official resolved URL only; link failure/invalid URL falls back to text',async()=>{
 for(const getLink of [async()=>{throw Error('offline');},async()=> 'not-a-url',async()=>new Promise<string>(()=>{})]){
  const {adapter,port}=make({getLink});expect(await adapter.share(payload,()=>true)).toMatchObject({outcome:'activity_completed',hasLink:false});expect(port.show).toHaveBeenCalledWith({title:payload.title,message:payload.text});
 }
});
test('simultaneous taps and another screen cannot open a second native sheet',async()=>{
 let complete!:(v:any)=>void;const {adapter,port}=make({show:jest.fn(()=>new Promise(r=>{complete=r;}))});
 const first=adapter.share(payload,()=>true);expect(await adapter.share(payload,()=>true)).toBeNull();await new Promise(resolve=>setImmediate(resolve));
 expect(adapter.busy).toBe(true);expect(port.show).toHaveBeenCalledTimes(1);complete({action:'dismissedAction'});await first;expect(adapter.busy).toBe(false);
});
test('sync and async native failures are nonthrowing and unlock a future attempt',async()=>{
 for(const show of [()=>{throw Error('native missing');},async()=>{throw Error('native failed');}]){
  const {adapter}=make({show});expect(await adapter.share(payload,()=>true)).toMatchObject({outcome:'failed'});expect(adapter.busy).toBe(false);
 }
});
test('late link after unmount/retry never opens a sheet',async()=>{
 let resolve!:(v:string)=>void;let current=true;const {adapter,port}=make({getLink:()=>new Promise<string>(r=>{resolve=r;})});const pending=adapter.share(payload,()=>current);current=false;await Promise.resolve();resolve('https://example.test/link');
 expect(await pending).toMatchObject({outcome:'abandoned'});expect(port.show).not.toHaveBeenCalled();
});
test('unsupported OS does not call native or invent an outcome',async()=>{
 const {adapter,port}=make({platform:()=> 'web'});expect(await adapter.share(payload,()=>true)).toMatchObject({outcome:'unsupported'});expect(port.show).not.toHaveBeenCalled();
});
test('Android holds the singleton lock through the native chooser handoff',async()=>{
 jest.useFakeTimers();
 try{
  const show=jest.fn(async()=>({action:'sharedAction'}));
  const adapter=createResultShareAdapter({platform:()=> 'android',getLink:async()=>{throw Error('offline');},show});
  const first=adapter.share(payload,()=>true);await jest.advanceTimersByTimeAsync(0);expect(show).toHaveBeenCalledTimes(1);expect(adapter.busy).toBe(true);
  expect(await adapter.share(payload,()=>true)).toBeNull();await jest.advanceTimersByTimeAsync(999);expect(adapter.busy).toBe(true);
  await jest.advanceTimersByTimeAsync(1);expect(await first).toMatchObject({outcome:'sheet_open'});expect(adapter.busy).toBe(false);
 }finally{jest.useRealTimers();}
});
