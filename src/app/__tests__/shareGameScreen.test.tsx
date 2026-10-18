import {createAppsAnalyticsAdapter} from '../analytics/appsAnalyticsAdapter';
import {ProductEvents} from '../product/productEvents';
import {PlayRuntime} from '../product/playRuntime';
jest.mock('react-native/Libraries/Utilities/useWindowDimensions',()=>({__esModule:true,default:jest.fn(()=>({width:390,height:844,scale:3,fontScale:1}))}));
jest.mock('@granite-js/react-native',()=>{const {dirname,join}=require('node:path');const sdk=dirname(require.resolve('@granite-js/react-native/package.json'));return {IOScrollView:jest.requireActual(join(sdk,'src/intersection-observer/IOScrollView')).default};});
jest.mock('@apps-in-toss/framework',()=>{const React=require('react');const {View}=require('react-native');const {dirname,join}=require('node:path');const sdk=dirname(require.resolve('@granite-js/react-native/package.json'));
  jest.doMock(join(sdk,'src/visibility'),()=>({useVisibility:()=>true}));
  const {ImpressionArea}=jest.requireActual(join(sdk,'src/impression-area/ImpressionArea'));
  return {
  loadFullScreenAd:Object.assign(jest.fn(),{isSupported:()=>false}),
  showFullScreenAd:Object.assign(jest.fn(),{isSupported:()=>false}),
  getTossShareLink:jest.fn(async()=> 'https://example.test/official-root'),
  Storage:{getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>undefined)},
  // Match the loaded SDK banner's real visibility wrapper, without native ad requests.
  InlineAd:({adGroupId}:any)=>React.createElement(ImpressionArea,null,React.createElement(View,{testID:'records-banner',accessibilityLabel:adGroupId})),
};});
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import React from 'react';import {AppState, ScrollView, StyleSheet,useWindowDimensions} from 'react-native';
import {Storage,getTossShareLink} from '@apps-in-toss/framework';
import {Share} from 'react-native';
import {P0GameScreen} from '../screens/P0GameScreen';import {P0TenPunchSession} from '../session/P0TenPunchSession';import {COACH_LINES} from '../motion/coachDialogue';import type {RewardedRetryAdGate} from '../ads/rewardedRetryAd';
import type {StageInterstitialAdGate} from '../ads/stageInterstitialAd';
import {StageInterstitialAdController} from '../ads/stageInterstitialAd';
import {RewardedRetryAdController, type FullScreenAdPort} from '../ads/rewardedRetryAd';
import * as competitionClient from '../session/competitionClient';
jest.mock('@granite-js/native/react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,right:0,bottom:20,left:0})}));
jest.mock('@granite-js/native/@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>undefined)}}));
jest.mock('../components/TemporarySfxPlayer',()=>{const {View}=require('react-native');return {TemporarySfxPlayer:({cue,enabled=true}:any)=>cue&&enabled?<View testID={'temporary-sfx-'+cue.sound}/>:null};});

describe('result sharing preserves real game flow',()=>{
 let runtime:PlayRuntime,now:number,frame:((time:number)=>void)|undefined;
 beforeEach(()=>{jest.clearAllMocks();runtime=new PlayRuntime();runtime.completeTutorial();now=0;
  (Storage.getItem as jest.Mock).mockResolvedValue(null);(Storage.setItem as jest.Mock).mockResolvedValue(undefined);
  (getTossShareLink as jest.Mock).mockResolvedValue('https://example.test/official-root');
  jest.spyOn(global,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});jest.spyOn(global,'cancelAnimationFrame').mockImplementation(()=>{});
 });
 afterEach(()=>jest.restoreAllMocks());
 async function setup(gate?:RewardedRetryAdGate){render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={gate??{prepare:cb=>{cb({phase:'ready',message:''});return jest.fn();},attempt:cb=>{cb();return true;},dispose:jest.fn()}}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());fireEvent.press(screen.getByRole('button',{name:'도전 시작'}));}
 async function ko(){now+=30000;act(()=>frame?.(now));now+=1000;act(()=>frame?.(now));await act(async()=>{});expect(screen.getByRole('button',{name:'친구에게 기록 보내기'})).toBeTruthy();}
 const starts=()=>runtime.events.snapshot().filter(e=>e.name==='game_start').length;
 it('cancel and error preserve results, stored records, free retry, and the next rewarded gate',async()=>{
  const show=jest.spyOn(Share,'share').mockResolvedValueOnce({action:'dismissedAction'}).mockRejectedValueOnce(Error('native failure'));
  await setup();await ko();const writes=(Storage.setItem as jest.Mock).mock.calls.length;
  expect(screen.getByTestId('viral-result-score')).toHaveTextContent('4 / 30');
  expect(screen.getByTestId('viral-coach-line')).toHaveTextContent(/관장/ );
  expect(screen.queryByTestId('rematch-focus')).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));expect(screen.getByTestId('rematch-focus')).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'상세 기록 접기'}));
  fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await waitFor(()=>expect(runtime.events.snapshot().find(e=>e.name==='share_outcome')?.data.outcome).toBe('cancelled'));
  expect(getTossShareLink).toHaveBeenCalledWith('intoss://boxing-talent-test/shared');
  expect(show.mock.calls[0]![0].message).toContain('4 / 30');expect(show.mock.calls[0]![0].message).not.toContain('새로운 개인 최고');
  expect(screen.getByText('첫 기록을 남겼어요')).toBeTruthy();expect(runtime.deathsSinceLastAd).toBe(1);expect(starts()).toBe(1);expect(Storage.setItem).toHaveBeenCalledTimes(writes);
  fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));expect(starts()).toBe(2);await ko();
  const before=(Storage.setItem as jest.Mock).mock.calls.length;expect(screen.getByTestId('recent-comparison')).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await waitFor(()=>expect(screen.getByText('공유창을 열지 못했어요. 다시 시도해 주세요.')).toBeTruthy());
  expect(runtime.deathsSinceLastAd).toBe(2);expect(Storage.setItem).toHaveBeenCalledTimes(before);expect(screen.getByTestId('recent-comparison')).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));expect(starts()).toBe(3);expect(runtime.deathsSinceLastAd).toBe(0);expect(screen.getByText('0 / 30')).toBeTruthy();
 });
 it.each(['throw','reject','timeout'] as const)('native analytics %s cannot block KO, free retry, rewarded completion or sharing',async failure=>{
  const transport=jest.fn(()=>{if(failure==='throw')throw Error('analytics');if(failure==='reject')return Promise.reject(Error('analytics'));return new Promise<void>(()=>{});});
  const adapter=createAppsAnalyticsAdapter(transport,{appVersion:'0.1.0',timeoutMs:10});runtime=new PlayRuntime(new ProductEvents(adapter.record));runtime.completeTutorial();
  let ad:Parameters<FullScreenAdPort['show']>[0]|undefined;
  const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},show:jest.fn(options=>{ad=options;return jest.fn();})};
  jest.spyOn(Share,'share').mockResolvedValue({action:'dismissedAction'});
  try{
   await setup(new RewardedRetryAdController(port,undefined,(name,data)=>runtime.track(name,data)));await ko();
   expect(runtime.events.snapshot().find(e=>e.name==='game_end')!.data).toMatchObject({level:1,reason:'knockout',survived:4,perfect:0});
   expect(runtime.events.snapshot().find(e=>e.name==='result_view')!.data).toMatchObject({survived:4,perfect:0,is_personal_best:false});
   fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await waitFor(()=>expect(runtime.events.snapshot().some(e=>e.name==='share_outcome')).toBe(true));
   fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));expect(starts()).toBe(2);await ko();expect(runtime.deathsSinceLastAd).toBe(2);
   fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));expect(port.show).toHaveBeenCalledTimes(1);
   act(()=>ad?.onEvent({type:'show'}));act(()=>ad?.onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}}));expect(starts()).toBe(2);
   act(()=>ad?.onEvent({type:'dismissed'}));act(()=>ad?.onEvent({type:'dismissed'}));expect(starts()).toBe(3);expect(runtime.deathsSinceLastAd).toBe(0);
   expect(runtime.events.snapshot().filter(e=>e.name==='ad_complete')).toHaveLength(1);expect(transport).toHaveBeenCalled();expect(Storage.setItem).toHaveBeenCalled();
  }finally{adapter.dispose();}
 });
 it('navigation/retry while a link is pending never opens a late sheet over the new game',async()=>{
  let link!:(value:string)=>void;(getTossShareLink as jest.Mock).mockImplementation(()=>new Promise<string>(r=>{link=r;}));const show=jest.spyOn(Share,'share').mockResolvedValue({action:'sharedAction'});
  await setup();await ko();fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));await act(async()=>{});
  fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));await act(async()=>link('https://example.test/late'));
  expect(show).not.toHaveBeenCalled();expect(starts()).toBe(2);expect(screen.getByText('0 / 30')).toBeTruthy();
 });
 it('native share return after background/active preserves the completed game',async()=>{
  let change:((s:string)=>void)|undefined;jest.spyOn(AppState,'addEventListener').mockImplementation((event,cb:any)=>{if(event==='change')change=cb;return {remove:jest.fn()};});
  let done!:(value:{action:'sharedAction'})=>void;const show=jest.spyOn(Share,'share').mockImplementation(()=>new Promise(r=>{done=r;}));
  await setup();await ko();fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));fireEvent.press(screen.getByRole('button',{name:'친구에게 기록 보내기'}));
  await waitFor(()=>expect(show).toHaveBeenCalledTimes(1));act(()=>change?.('background'));act(()=>change?.('active'));await act(async()=>done({action:'sharedAction'}));
  expect(starts()).toBe(1);expect(runtime.deathsSinceLastAd).toBe(1);expect(screen.getByRole('button',{name:'다시 도전'})).toBeEnabled();
 });
});
