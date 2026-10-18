import {createAppsAnalyticsAdapter} from '../analytics/appsAnalyticsAdapter';
import {PlayRuntime} from '../product/playRuntime';
jest.mock('react-native/Libraries/Utilities/useWindowDimensions',()=>({__esModule:true,default:jest.fn(()=>({width:390,height:844,scale:3,fontScale:1}))}));
jest.mock('@granite-js/react-native',()=>{const {dirname,join}=require('node:path');const sdk=dirname(require.resolve('@granite-js/react-native/package.json'));return {IOScrollView:jest.requireActual(join(sdk,'src/intersection-observer/IOScrollView')).default};});
jest.mock('@apps-in-toss/framework',()=>{const React=require('react');const {View}=require('react-native');const {dirname,join}=require('node:path');const sdk=dirname(require.resolve('@granite-js/react-native/package.json'));
  jest.doMock(join(sdk,'src/visibility'),()=>({useVisibility:()=>true}));
  const {ImpressionArea}=jest.requireActual(join(sdk,'src/impression-area/ImpressionArea'));
  return {
  loadFullScreenAd:Object.assign(jest.fn(),{isSupported:()=>false}),
  showFullScreenAd:Object.assign(jest.fn(),{isSupported:()=>false}),
  Storage:{getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>undefined)},
  // Match the loaded SDK banner's real visibility wrapper, without native ad requests.
  InlineAd:({adGroupId}:any)=>React.createElement(ImpressionArea,null,React.createElement(View,{testID:'records-banner',accessibilityLabel:adGroupId})),
};});
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import React from 'react';import {AppState, ScrollView, StyleSheet,useWindowDimensions} from 'react-native';
import {Storage} from '@apps-in-toss/framework';
import {P0GameScreen} from '../screens/P0GameScreen';import {P0TenPunchSession} from '../session/P0TenPunchSession';import {COACH_LINES} from '../motion/coachDialogue';import type {RewardedRetryAdGate} from '../ads/rewardedRetryAd';
import type {StageInterstitialAdGate} from '../ads/stageInterstitialAd';
import {StageInterstitialAdController} from '../ads/stageInterstitialAd';
import {RewardedRetryAdController, type FullScreenAdPort} from '../ads/rewardedRetryAd';
import * as competitionClient from '../session/competitionClient';
jest.mock('@granite-js/native/react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,right:0,bottom:20,left:0})}));
jest.mock('@granite-js/native/@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>undefined)}}));
jest.mock('../components/TemporarySfxPlayer',()=>{const {View}=require('react-native');return {TemporarySfxPlayer:({cue,enabled=true}:any)=>cue&&enabled?<View testID={'temporary-sfx-'+cue.sound}/>:null};});
 const ids={LEAD_JAB_HEAD:'j',REAR_STRAIGHT_HEAD:'s',LEAD_HOOK_HEAD:'h'};
describe('30-punch survival screen',()=>{
 let runtime:PlayRuntime;
 let frame:((time:number)=>void)|undefined,now:number;
 beforeEach(()=>{runtime=new PlayRuntime();runtime.completeTutorial();now=0;frame=undefined;jest.clearAllMocks();(Storage.getItem as jest.Mock).mockResolvedValue(null);(Storage.setItem as jest.Mock).mockResolvedValue(undefined);jest.spyOn(global,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});jest.spyOn(global,'cancelAnimationFrame').mockImplementation(()=>{});});
 afterEach(()=>jest.restoreAllMocks());
 function immediateRetryAd():RewardedRetryAdGate{return {prepare(observer){observer({phase:'ready',message:'테스트 광고 준비 완료'});return jest.fn();},attempt(onRewardedAndClosed){onRewardedAndClosed();return true;},dispose:jest.fn()};}
 function immediateStageAd():StageInterstitialAdGate{return {prepare(observer){observer({phase:'ready'});return jest.fn();},attempt(onClosed){onClosed();return true;},dispose:jest.fn()};}
 async function setup(retryAdGate:RewardedRetryAdGate=immediateRetryAd(),stageAdGate:StageInterstitialAdGate=immediateStageAd()){const view=render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={retryAdGate} stageAdGate={stageAdGate}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());return view;}
 function sample(gameMs:number){now=gameMs/.65;act(()=>frame?.(now));}
 function primeDeath(){runtime.endRound(runtime.startRound(),'knockout');}
 function knockOut(){now+=200000;act(()=>frame?.(now));}
 function start(){fireEvent.press(screen.getByRole('button',{name:'도전 시작'}));}
 it.each(['direct','shared_result','unknown'] as const)('retains %s through records, tutorial, remount and an actual game',async source=>{
   runtime=new PlayRuntime(undefined,source);
   const send=jest.fn(async(_payload:any)=>{}),adapter=createAppsAnalyticsAdapter(send,{appVersion:'test'});
   runtime.events.subscribe(adapter.record,true);
   const view=await setup();
   fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
   fireEvent.press(screen.getByRole('button',{name:'기록 닫기'}));
   view.unmount();await setup();jest.useFakeTimers();
   try {
     start();expect(screen.getByTestId('defense-tutorial')).toBeTruthy();
     expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(0);
     fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');act(()=>jest.advanceTimersByTime(2000));
     fireEvent(screen.getByRole('button',{name:'가드'}),'pressIn');act(()=>jest.advanceTimersByTime(2000));
     expect(screen.getByText('0 / 30')).toBeTruthy();
     const logs=send.mock.calls.map(c=>c[0]);
     expect(logs.filter(p=>p.log_name==='boxing_app_open')).toHaveLength(1);
     expect(logs.filter(p=>p.log_name==='boxing_game_start')).toHaveLength(1);
     expect(logs.some(p=>p.log_name==='boxing_landing_view')).toBe(true);
     expect(logs.every(p=>p.params.entry_source===source)).toBe(true);
     expect(runtime.events.snapshot().every(e=>e.data.entry_source===source)).toBe(true);
     expect(Storage.setItem).not.toHaveBeenCalled();expect(runtime.deathsSinceLastAd).toBe(0);
   } finally {adapter.dispose();jest.useRealTimers();}
 });
 it('rerenders and repeated result effects do not duplicate operational events',async()=>{
   const send=jest.fn(async(_payload:any)=>{}),adapter=createAppsAnalyticsAdapter(send,{appVersion:'0.1.0'});runtime.events.subscribe(adapter.record,true);
   try{
     const view=await setup();
     const rerender=()=>view.rerender(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={immediateRetryAd()} stageAdGate={immediateStageAd()}/>);
     rerender();rerender();start();knockOut();rerender();rerender();await act(async()=>{});
     const count=(name:string)=>send.mock.calls.filter(c=>c[0].log_name==='boxing_'+name).length;
     expect(count('app_open')).toBe(1);expect(count('landing_view')).toBe(1);expect(count('game_start')).toBe(1);expect(count('game_end')).toBe(1);expect(count('result_view')).toBe(1);
     fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));rerender();await act(async()=>{});expect(count('retry_game_start')).toBe(1);
     expect(send.mock.calls.find(c=>c[0].log_name==='boxing_game_end')![0].params).toMatchObject({reason:'knockout',difficulty:1,survived:4,perfect:0});
   }finally{adapter.dispose();}
 });
 it('links free and remounted ad retries once, excluding a new home challenge',async()=>{
   let view=await setup();start();knockOut();
   const previous=runtime.events.snapshot().filter(e=>e.name==='game_start').at(-1)!.data.roundId;
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
   let retries=runtime.events.snapshot().filter(e=>e.name==='retry_game_start');
   expect(retries).toHaveLength(1);expect(retries[0]!.data.previousRoundId).toBe(previous);
   knockOut();const second=runtime.events.snapshot().filter(e=>e.name==='game_start').at(-1)!.data.roundId;
   view.unmount();view=await setup();start();
   retries=runtime.events.snapshot().filter(e=>e.name==='retry_game_start');
   expect(retries).toHaveLength(2);expect(retries[1]!.data.previousRoundId).toBe(second);
   expect(screen.getByText('0 / 30')).toBeTruthy();
   knockOut();fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));start();
   expect(runtime.events.snapshot().filter(e=>e.name==='retry_game_start')).toHaveLength(2);
   expect(runtime.events.snapshot().filter(e=>e.name==='game_start').at(-1)!.data.previousRoundId).toBeNull();
 });
 it('does not report a retry when session start fails before a new round exists',async()=>{
   await setup();start();knockOut();
   const starts=runtime.events.snapshot().filter(e=>e.name==='game_start').length;
   jest.spyOn(P0TenPunchSession.prototype,'start').mockImplementationOnce(()=>{throw Error('test start failure');});
   expect(()=>fireEvent.press(screen.getByRole('button',{name:'다시 도전'}))).toThrow('test start failure');
   expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(starts);
   expect(runtime.events.snapshot().filter(e=>e.name==='retry_game_start')).toHaveLength(0);
 });
 it('continues input, KO, free retry, and one rewarded retry when adapter.record throws',async()=>{
   jest.spyOn(runtime.events,'record').mockImplementation(()=>{throw Error('adapter failed');});
   const starts=jest.spyOn(runtime,'startRound');let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},show:jest.fn(p=>{show=p;return jest.fn();})};
   await setup(new RewardedRetryAdController(port,undefined,(name,data)=>runtime.track(name,data)));
   start();expect(starts).toHaveBeenCalledTimes(1);
   fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');knockOut();
   expect(runtime.deathsSinceLastAd).toBe(1);
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));expect(starts).toHaveBeenCalledTimes(2);
   knockOut();expect(runtime.deathsSinceLastAd).toBe(2);
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
   act(()=>{show?.onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}});show?.onEvent({type:'dismissed'});show?.onEvent({type:'dismissed'});});
   expect(starts).toHaveBeenCalledTimes(3);expect(runtime.deathsSinceLastAd).toBe(0);
   expect(screen.getByText('0 / 30')).toBeTruthy();expect(runtime.analyticsFailureCount).toBeGreaterThan(0);
 });
 it('new user reaches exactly one real game through accessibility activation only',async()=>{
   runtime=new PlayRuntime();await setup();jest.useFakeTimers();
   try {
     start();const event={nativeEvent:{},currentTarget:1,target:1};
     fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'click',event);
     act(()=>jest.advanceTimersByTime(2000));
     fireEvent(screen.getByRole('button',{name:'가드'}),'click',event);
     act(()=>jest.advanceTimersByTime(2000));
     expect(screen.queryByTestId('defense-tutorial')).toBeNull();expect(screen.getByText('0 / 30')).toBeTruthy();
     expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(1);
     expect(runtime.deathsSinceLastAd).toBe(0);expect(Storage.setItem).not.toHaveBeenCalled();
   }finally{jest.useRealTimers();}
 });
 it('keeps tutorial outside real rounds, storage, lives, and the ad counter',async()=>{
   runtime=new PlayRuntime();
   const startRound=jest.spyOn(runtime,'startRound');
   const retry=immediateRetryAd(),stage=immediateStageAd();
   const retryAttempt=jest.spyOn(retry,'attempt'),stageAttempt=jest.spyOn(stage,'attempt');
   await setup(retry,stage);jest.useFakeTimers();
   try {
     start();expect(screen.getByTestId('defense-tutorial')).toBeTruthy();
     fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');
     act(()=>jest.advanceTimersByTime(2000));
     expect(startRound).not.toHaveBeenCalled();
     expect(Storage.setItem).not.toHaveBeenCalled();
     expect(runtime.deathsSinceLastAd).toBe(0);
     expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);
     fireEvent(screen.getByRole('button',{name:'가드'}),'pressIn');
     act(()=>jest.advanceTimersByTime(2000));
     expect(startRound).toHaveBeenCalledTimes(1);
     expect(screen.queryByTestId('defense-tutorial')).toBeNull();
     expect(retryAttempt).not.toHaveBeenCalled();expect(stageAttempt).not.toHaveBeenCalled();
   } finally {jest.useRealTimers();}
 });
 it('distinguishes the first record from an improvement of an existing record',async()=>{
   const first=await setup();start();knockOut();
   expect(screen.getByText('첫 기록을 남겼어요')).toBeTruthy();
   expect(screen.queryByText('새로운 최고 기록!')).toBeNull();
   first.unmount();
   (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({version:1,unlocked:1,best:{1:{level:1,cleared:false,resolved:4,survived:3,lives:0,perfect:0,streak:0,reactionMs:null,at:1}},bestStreak:{1:0}}));
   await setup();start();knockOut();
   expect(screen.getByText('새로운 최고 기록!')).toBeTruthy();
 });
 it('prioritizes a close goal and keeps detailed evidence collapsed until requested',async()=>{
   await setup();start();knockOut();
   expect(screen.getByText('다음 목표: 5번째 공격까지 버티기')).toBeTruthy();
   expect(screen.queryByTestId('result-0')).toBeNull();
   fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));
   expect(screen.getByTestId('result-0')).toBeTruthy();
   fireEvent.press(screen.getByRole('button',{name:'상세 기록 접기'}));
   expect(screen.queryByTestId('result-0')).toBeNull();
 });
 it.each([false,true])('retry text contrast, including note and pressed state (disabled=%s)',async disabled=>{
   if(disabled)primeDeath();await setup(disabled?new RewardedRetryAdController():immediateRetryAd());start();knockOut();
   const button=screen.getByRole('button',{name:disabled?'광고 이용 불가':'다시 도전'});
   let pressable=button;while(typeof pressable.props.style!=='function'&&pressable.parent)pressable=pressable.parent;
   const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
   const mix=(a:number[],b:number[],o:number)=>a.map((v,i)=>v*o+b[i]!*(1-o));
   const lum=(c:number[])=>c.map(v=>v/255).reduce((sum,v,i)=>sum+[.2126,.7152,.0722][i]!*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4),0);
   for(const pressed of [false,true]){
     const style=StyleSheet.flatten(pressable.props.style({pressed}));const opacity=style.opacity??1;
     const bg=mix(rgb(style.backgroundColor),rgb('#07111B'),opacity);
     const labels=button.findAll(n=>typeof n.type==='string'&&String(n.type)==='Text');
     expect(labels.length).toBeGreaterThan(0);
     for(const label of labels){
       const color=StyleSheet.flatten(label.props.style).color;
       const fg=mix(rgb(color),rgb('#07111B'),opacity);
       expect((lum(fg)+.05)/(lum(bg)+.05)).toBeGreaterThanOrEqual(4.5);
     }
   }
 });
 it('offers a first knockout retry without requesting an ad',async()=>{
   const attempt=jest.fn();
   await setup({prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt,dispose:jest.fn()});
   start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
   expect(attempt).not.toHaveBeenCalled();
   expect(screen.getByText('0 / 30')).toBeTruthy();
 });
 it('runs the 0→1→2→reward→0 cycle and ignores duplicate native callbacks',async()=>{
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:jest.fn(params=>{show=params;return jest.fn();})};
   await setup(new RewardedRetryAdController(port));start();knockOut();
   expect(runtime.deathsSinceLastAd).toBe(1);
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
   expect(port.show).not.toHaveBeenCalled();
   const freeRetry=runtime.events.snapshot().filter(e=>e.name==='retry_game_start');
   expect(freeRetry).toHaveLength(1);expect(freeRetry[0]!.data.previousRoundId).not.toBeNull();
   knockOut();expect(runtime.deathsSinceLastAd).toBe(2);
   const button=screen.getByRole('button',{name:'광고 보고 다시 도전'});
   fireEvent.press(button);fireEvent.press(button);
   expect(port.show).toHaveBeenCalledTimes(1);
   act(()=>show?.onEvent({type:'dismissed'}));
   expect(runtime.events.snapshot().filter(e=>e.name==='retry_game_start')).toHaveLength(1);
   expect(runtime.deathsSinceLastAd).toBe(2);
   act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}}));
   expect(runtime.deathsSinceLastAd).toBe(0);
   expect(screen.getByText('0 / 30')).toBeTruthy();
   sample(400000); // Third game's knockout.
   expect(runtime.deathsSinceLastAd).toBe(1);
   act(()=>{show?.onEvent({type:'dismissed'});show?.onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}});});
   expect(runtime.deathsSinceLastAd).toBe(1);
   expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');
   const retries=runtime.events.snapshot().filter(e=>e.name==='retry_game_start');
   expect(retries).toHaveLength(2);expect(retries[1]!.data.previousRoundId).not.toBeNull();
   expect(retries[1]!.data.source).toBe('ad_retry');
 });
 it('retires an errored rewarded action when navigating home before late callbacks',async()=>{
   primeDeath();let finish:(()=>void)|undefined;let observe:any;
   const gate:RewardedRetryAdGate={prepare(cb){observe=cb;cb({phase:'ready',message:''});return jest.fn();},attempt(cb){finish=cb;return true;},dispose:jest.fn()};
   await setup(gate);start();knockOut();
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
   act(()=>observe({phase:'error',message:'광고 닫고 다시 준비'}));
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
   expect(screen.getByTestId('records-banner')).toBeTruthy();
   act(()=>finish?.());
   expect(runtime.deathsSinceLastAd).toBe(2);
   expect(screen.getByTestId('records-banner')).toBeTruthy();
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
 });
 it('allows only one next-level fullscreen action and blocks competing retry and navigation',async()=>{
   let stageShow:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:jest.fn(params=>{stageShow=params;return jest.fn();})};
   const retry=immediateRetryAd(),retryAttempt=jest.spyOn(retry,'attempt');
   await setup(retry,new StageInterstitialAdController(port));start();
   const s=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:1,maxHits:5,seed:123});s.start();
   for(const a of s.snapshot().scheduledAttacks){sample(a.attackStartScheduledAtMs!+300);fireEvent(screen.getByRole('button',{name:a.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽'}),'pressIn');sample(a.attackStartScheduledAtMs!+650);}sample(60000);
   const next=screen.getByRole('button',{name:'다음 난이도 도전'});
   const staleRetry=screen.getByRole('button',{name:'다시 도전'});
   expect(screen.getByText('이동할 때 광고가 표시될 수 있어요.')).toBeTruthy();
   expect(next.props.accessibilityHint).toBe('이동할 때 광고가 표시될 수 있어요.');
   expect(staleRetry.props.accessibilityHint).toBeUndefined();
   fireEvent.press(next);fireEvent.press(next);fireEvent.press(staleRetry);
   expect(port.show).toHaveBeenCalledTimes(1);expect(retryAttempt).not.toHaveBeenCalled();
   expect(screen.getByRole('button',{name:'난이도 선택'})).toBeDisabled();
   expect(screen.getByText('완주 · PERFECT 30회')).toBeTruthy();
   act(()=>{stageShow?.onEvent({type:'dismissed'});stageShow?.onEvent({type:'dismissed'});});
   expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(2);
   expect(runtime.events.snapshot().filter(e=>e.name==='retry_game_start')).toHaveLength(0);
   expect(screen.getByText('0 / 30')).toBeTruthy();
   expect(retryAttempt).not.toHaveBeenCalled();expect(runtime.fullScreenBusy).toBe(false);
 });
 it.each(['unsupported','error'] as const)('clear stage %s keeps fallback transition without claiming an ad',async phase=>{
   const port:FullScreenAdPort={isLoadSupported:()=>phase!=='unsupported',isShowSupported:()=>phase!=='unsupported',load:({onError})=>{onError(Error('load'));return jest.fn();},show:jest.fn()};
   await setup(immediateRetryAd(),new StageInterstitialAdController(port));start();
   const s=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:1,maxHits:5,seed:123});s.start();
   for(const a of s.snapshot().scheduledAttacks){sample(a.attackStartScheduledAtMs!+300);fireEvent(screen.getByRole('button',{name:a.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽'}),'pressIn');sample(a.attackStartScheduledAtMs!+650);}sample(60000);
   expect(screen.queryByText('이동할 때 광고가 표시될 수 있어요.')).toBeNull();
   const next=screen.getByRole('button',{name:'다음 난이도 도전'});expect(next.props.accessibilityHint).toBeUndefined();
   fireEvent.press(next);expect(port.show).not.toHaveBeenCalled();expect(screen.getByText('0 / 30')).toBeTruthy();
   expect(runtime.deathsSinceLastAd).toBe(0);expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(2);
 });
 it('unsupported rewarded state offers consumer guidance, home and no free bypass',async()=>{
   primeDeath();await setup(new RewardedRetryAdController());start();knockOut();
   const starts=runtime.events.snapshot().filter(e=>e.name==='game_start').length;
   expect(screen.getByText('현재 이 환경에서는 광고를 이용할 수 없어요.')).toBeTruthy();
   expect(screen.queryByText(/QR/)).toBeNull();
   const retry=screen.getByRole('button',{name:'광고 이용 불가'});expect(retry).toBeDisabled();fireEvent.press(retry);
   expect(runtime.deathsSinceLastAd).toBe(2);expect(runtime.events.snapshot().filter(e=>e.name==='game_start')).toHaveLength(starts);
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));expect(screen.getByRole('button',{name:'내 기록 보기'})).toBeTruthy();
   expect(runtime.deathsSinceLastAd).toBe(2);
 });
 it('preserves runtime deaths through remount and ignores an unmounted ad completion',async()=>{
   primeDeath();
   let finish:(()=>void)|undefined;
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt(cb){finish=cb;return true;},dispose:jest.fn()};
   const view=await setup(gate);start();knockOut();
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
   view.unmount();expect(runtime.fullScreenBusy).toBe(false);
   await setup();
   act(()=>finish?.());
   expect(runtime.deathsSinceLastAd).toBe(2);
   expect(screen.getByText('광고 보고 입문 도전')).toBeTruthy();
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
 });
 it('keeps one death through a clear and retries the same level without either fullscreen ad',async()=>{
   primeDeath();
   const retry=immediateRetryAd(),stage=immediateStageAd();
   const retryAttempt=jest.spyOn(retry,'attempt'),stageAttempt=jest.spyOn(stage,'attempt');
   await setup(retry,stage);start();
   const scheduled=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:1,maxHits:5,seed:123});
   scheduled.start();
   for(const attack of scheduled.snapshot().scheduledAttacks){
     sample(attack.attackStartScheduledAtMs!+300);
     fireEvent(screen.getByRole('button',{name:attack.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽'}),'pressIn');
     sample(attack.attackStartScheduledAtMs!+650);
   }
   sample(60000);
   expect(screen.getByText('완주 · PERFECT 30회')).toBeTruthy();
   expect(runtime.deathsSinceLastAd).toBe(1);
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
   expect(screen.getByText('0 / 30')).toBeTruthy();
   expect(retryAttempt).not.toHaveBeenCalled();expect(stageAttempt).not.toHaveBeenCalled();
 });
 it.each([false,true])('keeps the knockout reward requirement through home, records and difficulty changes (%s)',async(changeLevel)=>{primeDeath();
   (Storage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({version:1,unlocked:2,best:{1:{level:1,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1}},bestStreak:{1:4}}));
   let finishAd:(()=>void)|undefined;
   const attempt=jest.fn(callback=>{finishAd=callback;return true;});
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt,dispose:jest.fn()};
   await setup(gate);start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
   fireEvent.press(screen.getByRole('button',{name:'기록 닫기'}));
   if(changeLevel)fireEvent.press(screen.getByRole('button',{name:'도전자'}));
   start();
   expect(attempt).toHaveBeenCalledTimes(1);
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
   act(()=>finishAd?.());
   expect(screen.getByRole('button',{name:'일시 정지'})).toBeTruthy();
   expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);
   knockOut();
   expect(runtime.deathsSinceLastAd).toBe(1);
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
   knockOut();
   fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   start();
   expect(attempt).toHaveBeenCalledTimes(2);
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
 });
 it('does not bypass a knockout through the next level button when it was already unlocked',async()=>{primeDeath();
   (Storage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({version:1,unlocked:2,best:{1:{level:1,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1}},bestStreak:{1:4}}));
   let finishAd:(()=>void)|undefined;
   const attempt=jest.fn(callback=>{finishAd=callback;return true;});
   const stageAttempt=jest.fn(()=>true);
   await setup({prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt,dispose:jest.fn()},
     {prepare(observer){observer({phase:'ready'});return jest.fn();},attempt:stageAttempt,dispose:jest.fn()});
   start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다음 난이도 도전'}));
   expect(attempt).toHaveBeenCalledTimes(1);
   expect(stageAttempt).not.toHaveBeenCalled();
   fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
   act(()=>finishAd?.());
   expect(screen.getByRole('button',{name:'일시 정지'})).toBeTruthy();
 });
 it('blocks home restart on ad dismissal without reward and starts only after both events',async()=>{primeDeath();
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:jest.fn(params=>{show=params;return jest.fn();})};
   await setup(new RewardedRetryAdController(port));start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   start();start();
   expect(port.show).toHaveBeenCalledTimes(1);
   act(()=>show?.onEvent({type:'dismissed'}));
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
   act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}}));
   expect(screen.getByRole('button',{name:'일시 정지'})).toBeTruthy();
 });
 it('keeps the reward requirement when entering the daily course from records',async()=>{primeDeath();
   jest.spyOn(competitionClient,'readCompetition').mockResolvedValue({day:'2026-10-13',participants:0,standing:null});
   const challenge=jest.spyOn(competitionClient,'startChallenge').mockResolvedValue({id:'test',seed:123,level:2,day:'2026-10-13',leadInMs:0});
   let finishAd:(()=>void)|undefined;
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt(callback){finishAd=callback;return true;},dispose:jest.fn()};
   render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={gate} stageAdGate={immediateStageAd()} competitionBaseUrl="https://example.test"/>);
   await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());
   start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
   fireEvent.press(screen.getByRole('button',{name:'오늘의 코스 도전'}));
   expect(challenge).not.toHaveBeenCalled();
   expect(screen.getByText('내 기록')).toBeTruthy();
   act(()=>finishAd?.());
   await waitFor(()=>expect(screen.getByRole('button',{name:'일시 정지'})).toBeTruthy());
   expect(challenge).toHaveBeenCalledTimes(1);
 });
 it('keeps a home restart locked after ad failure and a reward without dismissal',async()=>{primeDeath();
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const gate=new RewardedRetryAdController({isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:params=>{show=params;return jest.fn();}});
   await setup(gate);start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   start();act(()=>show?.onError(new Error('ad failed')));
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
   start(); // Reload, then explicitly tap again to show the new ad.
   start();act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}}));
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
   act(()=>show?.onEvent({type:'dismissed'}));
   expect(screen.getByRole('button',{name:'일시 정지'})).toBeTruthy();
 });
 it.each([[320,568,1],[390,844,1],[430,932,1.6]])('completes the start-records-pause-result-return flow at %sx%s with font scale %s',async(width,height,fontScale)=>{
   jest.mocked(useWindowDimensions).mockReturnValue({width,height,fontScale,scale:3});
   const view=await setup();
   try{
     fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
     expect(screen.getByText('내 기록')).toBeTruthy();
     fireEvent.press(screen.getByRole('button',{name:'기록 닫기'}));
     start();
     fireEvent.press(screen.getByRole('button',{name:'소리 끄기'}));
     fireEvent.press(screen.getByRole('button',{name:'일시 정지'}));
     sample(50000);
     expect(screen.getByText('0 / 30')).toBeTruthy();
     expect(screen.getByRole('button',{name:'가드'})).toBeDisabled();
     fireEvent.press(screen.getByRole('button',{name:'계속하기'}));
     now+=120000;act(()=>frame?.(now));
     fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
     expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();
     fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
     expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled();
     fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
     expect(screen.getByText(/최고 생존/)).toBeTruthy();
   }finally{view.unmount();jest.mocked(useWindowDimensions).mockReturnValue({width:390,height:844,fontScale:1,scale:3});}
 });
 it('gives concise directions and keeps Korean words together',async()=>{
   const view=await setup();
   // Long introduction must begin at its top, even when the buttons leave
   // little room. flex-end can push the first lines outside the scroll area.
   const intro=view.UNSAFE_getAllByType(ScrollView)[0]!;
   expect(StyleSheet.flatten(intro.props.contentContainerStyle).justifyContent).toBe('flex-start');
   for(const line of ['잽 → 왼쪽 또는 오른쪽','스트레이트 → 왼쪽','훅 → 오른쪽','30회 버티면 성공 · 목숨 5개','가드 2회 · 회피하면 1회 회복']) {
     expect(screen.getByText(line)).toHaveProp('lineBreakStrategyIOS','hangul-word');
   }
   expect(screen.queryByText(/화면 아래 버튼을 눌러 피하세요/)).toBeNull();
   expect(screen.queryByText('목숨은 다섯. 주먹을 읽고 끝까지 버텨보세요.')).toBeNull();
   expect(screen.getByText('서른 번. 끝까지 서 있으면 인정하지.')).toHaveProp('lineBreakStrategyIOS','hangul-word');
 });
 it('keeps the result until a late reward arrives after closing the ad',async()=>{primeDeath();
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const gate=new RewardedRetryAdController({isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:params=>{show=params;return jest.fn();},
   });
   const view=await setup(gate);start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
   act(()=>show?.onEvent({type:'dismissed'}));
   expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');
   act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}}));
   expect(screen.getByText('0 / 30')).toBeTruthy();
   view.unmount();
 });
 it('shows an enabled recovery action without auto-starting behind a silent ad',async()=>{primeDeath();
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const gate=new RewardedRetryAdController({isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:params=>{show=params;return jest.fn();},
   });
   const view=await setup(gate);start();sample(120000);
   jest.useFakeTimers();
   try{
     fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
     act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}}));
     act(()=>jest.advanceTimersByTime(120000));
     expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');
     expect(screen.getByRole('button',{name:'광고 닫고 다시 준비'})).toBeEnabled();
     fireEvent.press(screen.getByRole('button',{name:'광고 닫고 다시 준비'}));
     expect(runtime.deathsSinceLastAd).toBe(2);
     expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');
     fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
     act(()=>{show?.onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}});show?.onEvent({type:'dismissed'});});
     expect(screen.getByText('0 / 30')).toBeTruthy();
   }finally{view.unmount();jest.clearAllTimers();jest.useRealTimers();}
 });
 it('shows the exact registered app name on the game screen',async()=>{
   await setup();
   expect(screen.getByText('복싱재능테스트')).toBeTruthy();
 });
 it('restores champion unlock through Toss Storage instead of unsupported AsyncStorage',async()=>{
   (Storage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({version:1,unlocked:3,best:{2:{level:2,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1}},bestStreak:{2:4}}));
   await setup();
   expect(screen.getByRole('button',{name:'챔피언'})).toBeEnabled();
 });
 it('diagnostic startup bypass lets the game open even when the ad bridge throws',async()=>{
   const gate=new StageInterstitialAdController({
     isLoadSupported:()=>true,isShowSupported:()=>true,
     load:()=>{throw new Error('diagnostic host bridge failure');},
     show:()=>()=>undefined,
   });
   render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123}
     retryAdGate={immediateRetryAd()} stageAdGate={gate} skipStartupAdLoad />);
   await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());
   start();
   expect(screen.getByText('0 / 30')).toBeTruthy();
   expect(screen.getAllByTestId(/attack-progress-/)).toHaveLength(30);
 });
 it('shows new coach, 30 attacks, and locked upper levels before starting',async()=>{await setup();expect(screen.getByText('서른 번. 끝까지 서 있으면 인정하지.')).toBeTruthy();expect(screen.getByText('0 / 30')).toBeTruthy();expect(screen.getByRole('button',{name:'도전자'})).toBeDisabled();expect(screen.getByRole('button',{name:'챔피언'})).toBeDisabled();expect(screen.getByRole('button',{name:'내 기록 보기'})).toBeEnabled();start();expect(screen.getAllByTestId(/attack-progress-/)).toHaveLength(30);expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);});
 it('unlocks six defense buttons only in champion and explains the reward',async()=>{
   const clear={level:2,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1};
   (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({version:1,unlocked:3,best:{2:clear},bestStreak:{2:4}}));
   const view=await setup();
   expect(screen.getByText(/챔피언.*6버튼.*어퍼컷/)).toBeTruthy();
   start();
   expect(screen.queryByRole('button',{name:'숙이기'})).toBeNull();
   view.unmount();
   await setup();
   fireEvent.press(screen.getByRole('button',{name:'챔피언'}));
   start();
   expect(screen.getByRole('button',{name:'숙이기'})).toBeEnabled();
   expect(screen.getByRole('button',{name:'앞으로 파고들기'})).toBeEnabled();
 });
 it('names the uppercut correctly in a completed champion result',async()=>{
   const clear={level:2,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1};
   (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({version:1,unlocked:3,best:{2:clear},bestStreak:{2:4}}));
   await setup();
   fireEvent.press(screen.getByRole('button',{name:'챔피언'}));
   start();
   const sourceIds={...ids,LEAD_UPPERCUT_HEAD:'authored-uppercut-v1'};
   const plan=new P0TenPunchSession({nowMs:()=>0},sourceIds,{ruleset:'candidate',survivalLevel:3,maxHits:5,seed:123});
   plan.start();
   expect(plan.snapshot().flattenedAttackOrder).toContain('LEAD_UPPERCUT_HEAD');
   for(const attack of plan.snapshot().scheduledAttacks){
     now=(attack.attackStartScheduledAtMs!+300)/1.12;
     act(()=>frame?.(now));
     const label=attack.attackIndex===0&&attack.attackId==='LEAD_JAB_HEAD'?'숙이기':attack.attackId==='LEAD_UPPERCUT_HEAD'?'뒤로 피하기':attack.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽';
     fireEvent(screen.getByRole('button',{name:label}),'pressIn');
     now=(attack.attackStartScheduledAtMs!+650)/1.12;
     act(()=>frame?.(now));
   }
   now=60000/1.12;act(()=>frame?.(now));
   fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));
   expect(screen.getAllByText(/#\d+ 어퍼컷/).length).toBeGreaterThan(0);
   expect(screen.getByText(/숙이기 · 안전하게 방어/)).toBeTruthy();
 });
it('opens only personal records without exposing online competition',async()=>{await setup();fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));expect(screen.getByText('내 기록')).toBeTruthy();expect(screen.queryByText('오늘의 코스')).toBeNull();expect(screen.queryByRole('button',{name:'오늘의 코스 도전'})).toBeNull();expect(screen.queryByText(/순위|백분위|상위 \d+%/)).toBeNull();expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();expect(screen.getByTestId('records-banner')).toHaveProp('accessibilityLabel','ait.v2.live.1dae02e06eca49ee');expect(Storage.setItem).not.toHaveBeenCalled();fireEvent.press(screen.getByRole('button',{name:'기록 닫기'}));expect(screen.queryByTestId('records-banner')).toBeNull();expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled();});
 it('ends immediately on the fifth hit, plays the bell, records only resolved punches, and retries with full lives',async()=>{await setup();start();sample(120000);expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');expect(screen.queryByTestId('result-5')).toBeNull();expect(screen.getByTestId('viral-coach-line')).toHaveTextContent(/잽에 2번 맞았군/);expect(screen.getByTestId('temporary-sfx-knockout')).toBeTruthy();await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(1));expect(screen.queryByText('광고 시청 후 다시 도전할 수 있어요.')).toBeNull();fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));expect(screen.getByText('0 / 30')).toBeTruthy();expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();});
 it('does not restart until the rewarded ad gate grants retry',async()=>{primeDeath();let finishAd:(()=>void)|undefined;const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:'테스트 광고 준비 완료'});return jest.fn();},attempt(onRewardedAndClosed){finishAd=onRewardedAndClosed;return true;},dispose:jest.fn()};await setup(gate);start();sample(120000);fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');act(()=>finishAd?.());expect(screen.getByText('0 / 30')).toBeTruthy();});
 it('unlocks the next level after a strong clear and persists records across remounts',async()=>{let finishStageAd:(()=>void)|undefined;const stageGate:StageInterstitialAdGate={prepare(observer){observer({phase:'ready'});return jest.fn();},attempt(onClosed){finishStageAd=onClosed;return true;},dispose:jest.fn()};const view=await setup(immediateRetryAd(),stageGate);start();const s=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:1,maxHits:5,seed:123});s.start();for(const a of s.snapshot().scheduledAttacks){sample(a.attackStartScheduledAtMs!+300);fireEvent(screen.getByRole('button',{name:a.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽'}),'pressIn');sample(a.attackStartScheduledAtMs!+650);}sample(60000);expect(screen.getByText('완주 · PERFECT 30회')).toBeTruthy();expect(screen.getByRole('button',{name:'다음 난이도 도전'})).toBeTruthy();expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();await waitFor(()=>expect(Storage.setItem).toHaveBeenCalled());const raw=(Storage.setItem as jest.Mock).mock.calls.at(-1)[1];expect(JSON.parse(raw)).toMatchObject({unlocked:2,best:{1:{perfect:30,streak:30,lives:5}}});fireEvent.press(screen.getByRole('button',{name:'다음 난이도 도전'}));expect(screen.getByText('완주 · PERFECT 30회')).toBeTruthy();act(()=>finishStageAd?.());expect(screen.getByText('0 / 30')).toBeTruthy();view.unmount();(Storage.getItem as jest.Mock).mockResolvedValue(raw);await setup();expect(screen.getByRole('button',{name:'도전자'})).toBeEnabled();expect(screen.getByRole('button',{name:'챔피언'})).toBeDisabled();});
 it('pauses without losing lives and silences audio on focus loss',async()=>{const listeners=new Map<string,Function>();jest.spyOn(AppState,'addEventListener').mockImplementation((event:any,fn:any)=>{listeners.set(event,fn);return {remove:jest.fn()};});await setup();start();sample(200);act(()=>listeners.get('blur')?.());expect(screen.getByRole('button',{name:'계속하기'})).toBeTruthy();sample(120000);expect(screen.getByText('0 / 30')).toBeTruthy();expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);act(()=>listeners.get('focus')?.());fireEvent.press(screen.getByRole('button',{name:'계속하기'}));now+=1000;act(()=>frame?.(now));expect(screen.getByText('1 / 30')).toBeTruthy();});
 it('waits for foreground after rewarded completion and then prepares automatically',async()=>{primeDeath();
   const listeners=new Map<string,Function>();
   jest.spyOn(AppState,'addEventListener').mockImplementation((event:any,fn:any)=>{listeners.set(event,fn);return {remove:jest.fn()};});
   let finishAd:(()=>void)|undefined;
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt(callback){finishAd=callback;return true;},dispose:jest.fn()};
   await setup(gate);start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
   act(()=>listeners.get('change')?.('inactive'));
   act(()=>finishAd?.());
   expect(runtime.deathsSinceLastAd).toBe(0);
   expect(screen.queryByRole('button',{name:'계속하기'})).toBeNull();
   knockOut(); // No round exists yet, despite advancing wall time.
   expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');
   act(()=>listeners.get('change')?.('active'));
   expect(screen.getByText('0 / 30')).toBeTruthy();
   expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);
   expect(screen.queryByRole('button',{name:'계속하기'})).toBeNull();
 });

 it('allows local play after a storage read hangs and ignores its late result',async()=>{
   let releaseRead:(raw:string)=>void=()=>{};
   (Storage.getItem as jest.Mock).mockImplementationOnce(()=>new Promise<string>(resolve=>{releaseRead=resolve;}));
   jest.useFakeTimers();
   const view=render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={immediateRetryAd()} stageAdGate={immediateStageAd()}/>);
   try{
     await act(async()=>{await Promise.resolve();});
     expect(screen.getByRole('button',{name:'도전 시작'})).toBeDisabled();
     act(()=>jest.advanceTimersByTime(8000));
     expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled();
     expect(screen.getByText('기록을 불러오지 못했습니다. 이번 실행의 기록만 유지됩니다.')).toBeTruthy();
     start();sample(120000);
     await act(async()=>{releaseRead(JSON.stringify({version:1,unlocked:3,best:{},bestStreak:{}}));await Promise.resolve();});
     expect(Storage.setItem).not.toHaveBeenCalled();
     fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
     expect(screen.getByRole('button',{name:'챔피언'})).toBeDisabled();
   }finally{view.unmount();jest.clearAllTimers();jest.useRealTimers();}
 });
 it('mute suppresses the knockout bell and a failed storage write does not block retry',async()=>{(Storage.setItem as jest.Mock).mockRejectedValue(new Error('unavailable'));await setup();start();fireEvent.press(screen.getByRole('button',{name:'소리 끄기'}));sample(120000);expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();await waitFor(()=>expect(screen.getByText('기록 저장 실패 · 이번 실행에서는 유지됩니다.')).toBeTruthy());expect(screen.getByRole('button',{name:'다시 도전'})).toBeEnabled();});
 it('never overwrites persistent progress after a storage read failure',async()=>{(Storage.getItem as jest.Mock).mockRejectedValue(new Error('read failed'));await setup();start();sample(120000);await waitFor(()=>expect(screen.getByText('기록을 불러오지 못했습니다. 이번 실행의 기록만 유지됩니다.')).toBeTruthy());expect(Storage.setItem).not.toHaveBeenCalled();});
 it('preserves damaged source text and salvages valid clear records',async()=>{const best={level:2,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1};const damaged=JSON.stringify({version:1,unlocked:99,best:{2:best},bestStreak:{2:4}});(Storage.getItem as jest.Mock).mockImplementation(async(key:string)=>key==='boxing-survival-v1'?damaged:null);await setup();expect(screen.getByRole('button',{name:'챔피언'})).toBeEnabled();expect(Storage.setItem).toHaveBeenCalledWith(expect.stringContaining('backup'),damaged);});
 it('serializes round saves so an older write cannot finish after a newer record',async()=>{let releaseFirst:()=>void=()=>{};(Storage.setItem as jest.Mock).mockImplementationOnce(()=>new Promise<void>(resolve=>{releaseFirst=resolve})).mockResolvedValue(undefined);await setup();start();sample(120000);await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(1));fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));now+=120000/.65;act(()=>frame?.(now));expect(Storage.setItem).toHaveBeenCalledTimes(1);act(()=>releaseFirst());await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(2));});
 it('waits for an in-flight save before reloading after a screen remount',async()=>{let releaseSave:()=>void=()=>{};(Storage.setItem as jest.Mock).mockImplementationOnce(()=>new Promise<void>(resolve=>{releaseSave=resolve})).mockResolvedValue(undefined);const first=await setup();start();sample(120000);await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(1));first.unmount();const readsBefore=(Storage.getItem as jest.Mock).mock.calls.length;render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={immediateRetryAd()}/>);await act(async()=>{await Promise.resolve();});expect(Storage.getItem).toHaveBeenCalledTimes(readsBefore);act(()=>releaseSave());await waitFor(()=>expect(Storage.getItem).toHaveBeenCalledTimes(readsBefore+1));await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());});
});



