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
import type {RoundRecord} from '../session/progression';
const koRecord=(survived:number,level:1|2|3=1):RoundRecord=>({level,cleared:false,resolved:survived+1,survived,lives:0,perfect:survived-4,streak:survived-4,reactionMs:277,at:1});
describe('recent real-game integration',()=>{
 let runtime:PlayRuntime,now:number,frame:((time:number)=>void)|undefined;
 beforeEach(()=>{jest.clearAllMocks();now=0;frame=undefined;runtime=new PlayRuntime();runtime.completeTutorial();
  (Storage.getItem as jest.Mock).mockResolvedValue(null);(Storage.setItem as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(global,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});jest.spyOn(global,'cancelAnimationFrame').mockImplementation(()=>{});
 });
 afterEach(()=>jest.restoreAllMocks());
 const gate=():RewardedRetryAdGate=>({prepare(cb){cb({phase:'ready',message:''});return jest.fn();},attempt(cb){cb();return true;},dispose:jest.fn()});
 async function setup(){const view=render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={gate()}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());return view;}
 function fixture(recent?:RoundRecord){(Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({version:1,unlocked:1,best:{1:koRecord(20)},bestStreak:{1:16},...(recent?{recentByDifficulty:{[recent.level]:recent}}:{})}));}
 function start(){fireEvent.press(screen.getByRole('button',{name:'도전 시작'}));}
 function finish(survived:number){
  const base=now;const s=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:1,maxHits:5,seed:123});s.start();
  for(const a of s.snapshot().scheduledAttacks){
   now=base+(a.attackStartScheduledAtMs!+300)/.65;act(()=>frame?.(now));
   if(survived===30||a.attackIndex<survived-4)fireEvent(screen.getByRole('button',{name:a.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽'}),'pressIn');
   now=base+(a.attackStartScheduledAtMs!+650)/.65;act(()=>frame?.(now));
   if(survived!==30&&a.attackIndex===survived)break;
  }
  now+=10000;act(()=>frame?.(now));
 }
 async function saved(){await waitFor(()=>expect(Storage.setItem).toHaveBeenCalled());const writes=(Storage.setItem as jest.Mock).mock.calls.filter(([key])=>key==='boxing-survival-v1');return JSON.parse(writes.at(-1)[1]);}
 it('first result has no comparison and stores recent only after actual game_end',async()=>{
  await setup();start();expect(Storage.setItem).not.toHaveBeenCalled();finish(8);
  expect(screen.queryByTestId('recent-comparison')).toBeNull();
  const p=await saved();expect(p.recentByDifficulty[1].survived).toBe(8);
  const end=runtime.events.snapshot().findIndex(e=>e.name==='game_end');const result=runtime.events.snapshot().findIndex(e=>e.name==='result_view');expect(end).toBeLessThan(result);
  expect(runtime.events.snapshot()[result]!.data.has_recent_comparison).toBe(false);
 });
 it.each([[8,12,'4회 더'],[15,10,'5회 적게'],[12,12,'생존 수와 완벽 회피 수가 같아요']])('compares %i → %i before overwrite and keeps the higher best',async(before,after,text)=>{
  fixture(koRecord(before));await setup();start();finish(after);
  expect(screen.getByTestId('recent-comparison')).toHaveTextContent(text,{exact:false});
  expect(screen.getByTestId('recent-comparison')).toHaveTextContent(`지난 경기 ${before} / 30`,{exact:false});
  const p=await saved();expect(p.recentByDifficulty[1].survived).toBe(after);expect(p.best[1].survived).toBe(20);
  fireEvent.press(screen.getByRole('button',{name:'상세 기록 보기'}));
  expect(runtime.events.snapshot().filter(e=>e.name==='result_view')).toHaveLength(1);expect(Storage.setItem).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
  const events=runtime.events.snapshot(),result=events.find(e=>e.name==='result_view')!,retry=events.find(e=>e.name==='retry_game_start')!;
  expect(result.data.previous_result).toBe(`knockout:${before}/30`);expect(retry.data.previousRoundId).toBe(result.data.roundId);
 });
 it('restores recent after a new runtime while best and death policy stay separate',async()=>{
  fixture(koRecord(8));const first=await setup();start();finish(12);const p=await saved();first.unmount();
  runtime=new PlayRuntime();runtime.completeTutorial();(Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(p));await setup();
  expect(runtime.deathsSinceLastAd).toBe(0);fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));
  expect(screen.getByTestId('recent-record-1')).toHaveTextContent('최근 · 생존 12 / 30',{exact:false});
  expect(screen.getByTestId('best-record-1')).toHaveTextContent('최고 생존 20/30',{exact:false});
 });
 it('does not compare a different difficulty or invent recent from a legacy best',async()=>{
  fixture(koRecord(8,2));await setup();start();finish(12);expect(screen.queryByTestId('recent-comparison')).toBeNull();
  const p=await saved();expect(p.recentByDifficulty[2].survived).toBe(8);expect(p.recentByDifficulty[1].survived).toBe(12);
 });
 it('stores clear and displays completion facts without a false lifetime first',async()=>{
  fixture(koRecord(24));await setup();start();finish(30);
  expect(screen.getByTestId('recent-comparison')).toHaveTextContent('이번에는 30회 완주',{exact:false});
  const p=await saved();expect(p.recentByDifficulty[1].cleared).toBe(true);expect(runtime.deathsSinceLastAd).toBe(0);
 });
 it('storage failure preserves the in-memory previous result and the full retry ad cycle',async()=>{
  (Storage.setItem as jest.Mock).mockRejectedValue(Error('disk unavailable'));await setup();start();finish(8);
  await waitFor(()=>expect(screen.getByText('기록 저장 실패 · 이번 실행에서는 유지됩니다.')).toBeTruthy());
  fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));finish(12);
  expect(screen.getByTestId('recent-comparison')).toHaveTextContent('4회 더',{exact:false});expect(runtime.deathsSinceLastAd).toBe(2);
  fireEvent.press(screen.getByRole('button',{name:'광고 보고 다시 도전'}));
  expect(screen.getByText('0 / 30')).toBeTruthy();expect(runtime.deathsSinceLastAd).toBe(0);
  await act(async()=>{});
 });
 it('a rejected product end cannot save recent or expose a comparison',async()=>{
  fixture(koRecord(8));await setup();jest.spyOn(runtime,'endRound').mockReturnValue(false);start();finish(12);
  expect(screen.queryByTestId('recent-comparison')).toBeNull();const p=await saved();expect(p.recentByDifficulty[1].survived).toBe(8);
 });
 it('cancelled/incomplete games and tutorial never write recent',async()=>{
  const first=await setup();start();first.unmount();expect(Storage.setItem).not.toHaveBeenCalled();
  runtime=new PlayRuntime();await setup();start();expect(screen.getByTestId('defense-tutorial')).toBeTruthy();
  fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');expect(Storage.setItem).not.toHaveBeenCalled();expect(runtime.deathsSinceLastAd).toBe(0);
 });
});
