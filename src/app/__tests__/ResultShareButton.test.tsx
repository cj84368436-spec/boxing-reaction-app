jest.mock('@apps-in-toss/framework',()=>({getTossShareLink:jest.fn()}));
import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {ResultShareButton} from '../components/ResultShareButton';
import {PlayRuntime} from '../product/playRuntime';
import {createResultShareAdapter} from '../sharing/resultShareAdapter';
import {emptyProgress,recordRound,type RoundRecord} from '../session/progression';
const record:RoundRecord={level:1,cleared:false,resolved:9,survived:8,lives:0,perfect:4,streak:2,reactionMs:240,at:1};
const setup=(show:()=>Promise<{action:string}>,platform='ios')=>{
 const runtime=new PlayRuntime();const round=runtime.startRound({level:1});runtime.endRound(round,'knockout');
 const adapter=createResultShareAdapter({platform:()=>platform,getLink:async()=>{throw Error('offline');},show},{handoffDelayMs:0});
 const stored=JSON.stringify(recordRound(emptyProgress(),record));
 const view=render(<ResultShareButton runtime={runtime} roundId={round.id} record={record} adapter={adapter} isCurrent={()=>true}/>);
 return {runtime,view,stored};
};
test.each([['ios','sharedAction','activity_completed'],['ios','dismissedAction','cancelled'],['android','sharedAction','sheet_open']])('callback %s/%s does not change the result or count',async(platform,action,outcome)=>{
 const {runtime,stored}=setup(async()=>({action}),platform);fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));
 await waitFor(()=>expect(runtime.events.snapshot().find(e=>e.name==='share_outcome')?.data.outcome).toBe(outcome));
 expect(runtime.deathsSinceLastAd).toBe(1);expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(1);
 expect(JSON.stringify(recordRound(emptyProgress(),record))).toBe(stored);expect(screen.getByRole('button',{name:'친구에게 기록 보내기'})).toBeEnabled();
 expect(runtime.events.snapshot().filter(e=>e.name==='share_tap')).toHaveLength(1);
});
test('rapid taps produce one request and one outcome',async()=>{
 let done!:(v:{action:string})=>void;const show=jest.fn(()=>new Promise<{action:string}>(r=>{done=r;}));const {runtime}=setup(show);
 const button=screen.getByRole('button',{name:'친구에게 기록 보내기'});fireEvent.press(button);fireEvent.press(button);
 await waitFor(()=>expect(show).toHaveBeenCalledTimes(1));await act(async()=>done({action:'dismissedAction'}));
 expect(runtime.events.snapshot().filter(e=>e.name==='share_outcome')).toHaveLength(1);
});
test('native rejection shows a short error and permits a later attempt',async()=>{
 const show=jest.fn().mockRejectedValueOnce(Error('native')).mockResolvedValue({action:'dismissedAction'});const {runtime}=setup(show);
 fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await waitFor(()=>expect(screen.getByText('공유창을 열지 못했어요. 다시 시도해 주세요.')).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await waitFor(()=>expect(show).toHaveBeenCalledTimes(2));await act(async()=>{});expect(runtime.deathsSinceLastAd).toBe(1);
});
test('unmount before link resolves abandons the sheet and never updates a new screen',async()=>{
 let link!:(v:string)=>void;const show=jest.fn(async()=>({action:'sharedAction'}));const runtime=new PlayRuntime();
 const adapter=createResultShareAdapter({platform:()=> 'ios',getLink:()=>new Promise<string>(r=>{link=r;}),show});
 const view=render(<ResultShareButton runtime={runtime} roundId="old" record={record} adapter={adapter} isCurrent={()=>true}/>);
 fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await act(async()=>{});view.unmount();await act(async()=>link('https://example.test/link'));
 expect(show).not.toHaveBeenCalled();expect(runtime.events.snapshot().find(e=>e.name==='share_outcome')?.data.outcome).toBe('abandoned');
});
test('analytics exception does not prevent a native request',async()=>{
 const show=jest.fn(async()=>({action:'dismissedAction'}));const {runtime}=setup(show);jest.spyOn(runtime.events,'record').mockImplementation(()=>{throw Error('analytics');});
 fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await waitFor(()=>expect(show).toHaveBeenCalledTimes(1));await act(async()=>{});expect(runtime.deathsSinceLastAd).toBe(1);
});
