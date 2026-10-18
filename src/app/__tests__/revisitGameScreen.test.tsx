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
import React from 'react';
import {Storage} from '@apps-in-toss/framework';
import {P0GameScreen} from '../screens/P0GameScreen';import {P0TenPunchSession} from '../session/P0TenPunchSession';import type {RewardedRetryAdGate} from '../ads/rewardedRetryAd';
import {RewardedRetryAdController, type FullScreenAdPort} from '../ads/rewardedRetryAd';
jest.mock('@granite-js/native/react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,right:0,bottom:20,left:0})}));
jest.mock('@granite-js/native/@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>undefined)}}));
jest.mock('../components/TemporarySfxPlayer',()=>{const {View}=require('react-native');return {TemporarySfxPlayer:({cue,enabled=true}:any)=>cue&&enabled?<View testID={'temporary-sfx-'+cue.sound}/>:null};});

import type {RoundRecord,Progress} from '../session/progression';
const ko=(survived:number,level:1|2|3=1):RoundRecord=>({level,cleared:false,resolved:survived+1,survived,lives:0,perfect:0,streak:0,reactionMs:null,at:1});
const fixture=():Progress=>({version:1,unlocked:1,best:{1:ko(12)},bestStreak:{1:0},recentByDifficulty:{1:ko(8)}});
describe('home revisit prompt uses the existing start gate',()=>{
 let runtime:PlayRuntime,frame:((t:number)=>void)|undefined,now:number;
 beforeEach(()=>{jest.clearAllMocks();runtime=new PlayRuntime();now=0;frame=undefined;
  (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(fixture()));(Storage.setItem as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(global,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});jest.spyOn(global,'cancelAnimationFrame').mockImplementation(()=>{});
 });
 afterEach(()=>jest.restoreAllMocks());
 async function setup(gate?:RewardedRetryAdGate){const view=render(<P0GameScreen runtime={runtime} clock={{nowMs:()=>now}} seed={123} readyLeadInMs={0} retryAdGate={gate}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());return view;}
 const events=(name:string)=>runtime.events.snapshot().filter(e=>e.name===name);
 const start=()=>fireEvent.press(screen.getByRole('button',{name:'도전 시작'}));
 it('restored records show one small prompt, track exposure, and actually start without writing storage',async()=>{
  await setup();expect(screen.getByTestId('revisit-prompt')).toHaveTextContent(/최고 생존 기록까지 4회/);
  expect(screen.getByTestId('revisit-prompt')).toHaveTextContent(/지난 기록 8 \/ 30/);
  expect(events('landing_view')).toHaveLength(1);expect(events('landing_view')[0]!.data).toMatchObject({level:1,has_revisit_prompt:true,revisit_prompt_kind:'below_best'});
  expect(events('game_start')).toHaveLength(0);start();expect(screen.getByText('0 / 30')).toBeTruthy();
  expect(events('game_start')).toHaveLength(1);expect(events('game_start')[0]!.data).toMatchObject({has_revisit_prompt:true,revisit_prompt_kind:'below_best'});
  expect(Storage.setItem).not.toHaveBeenCalled();expect(runtime.deathsSinceLastAd).toBe(0);
 });
 it.each([
  [ko(28),'개인 최고 기록에 다시 도전해보세요'],
  [{...ko(29),cleared:true,survived:30,lives:3,perfect:10},'완벽 회피 2회 더 도전해보세요'],
  [{...ko(29),cleared:true,survived:30,lives:3,perfect:12},'다음 목표: 완벽 회피 13회'],
 ] as const)('home respects a prior clear with recent %j',async(recent,message)=>{
  const p=fixture();p.best[1]={...ko(29),cleared:true,survived:30,lives:3,perfect:12};p.recentByDifficulty![1]=recent;
  (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(p));await setup();
  expect(screen.getByTestId('revisit-prompt')).toHaveTextContent(message,{exact:false});
  expect(screen.getByTestId('revisit-prompt')).not.toHaveTextContent(/30번째 공격까지/);start();expect(events('game_start')).toHaveLength(1);
 });
 it('a fresh runtime restores the same goal with no new storage field',async()=>{
  const view=await setup();const text=screen.getByTestId('revisit-prompt').props.children;view.unmount();runtime=new PlayRuntime();await setup();
  expect(screen.getByTestId('revisit-prompt').props.children).toEqual(text);expect(Storage.setItem).not.toHaveBeenCalled();
 });
 it('legacy best without recent hides the prompt and keeps normal start',async()=>{
  const p=fixture();delete p.recentByDifficulty;(Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(p));await setup();
  expect(screen.queryByTestId('revisit-prompt')).toBeNull();start();expect(events('game_start')[0]!.data.has_revisit_prompt).toBe(false);
 });
 it('a new user still enters the isolated tutorial with no fabricated prompt',async()=>{
  (Storage.getItem as jest.Mock).mockResolvedValue(null);await setup();expect(screen.queryByTestId('revisit-prompt')).toBeNull();start();
  expect(screen.getByTestId('defense-tutorial')).toBeTruthy();expect(events('game_start')).toHaveLength(0);expect(Storage.setItem).not.toHaveBeenCalled();
 });
 it('selection uses only that difficulty and cannot expose a locked goal',async()=>{
  const p=fixture();p.unlocked=2;p.best[2]=ko(16,2);p.recentByDifficulty![2]=ko(14,2);p.best[3]=ko(18,3);p.recentByDifficulty![3]=ko(16,3);
  (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(p));await setup();
  fireEvent.press(screen.getByRole('button',{name:'도전자'}));expect(screen.getByTestId('revisit-prompt')).toHaveTextContent(/최고 생존 기록까지 2회/);
  expect(events('landing_view')).toHaveLength(2);expect(events('landing_view')[1]!.data.level).toBe(2);
  expect(screen.getByRole('button',{name:'챔피언'})).toBeDisabled();fireEvent.press(screen.getByRole('button',{name:'챔피언'}));
  expect(screen.getByTestId('revisit-prompt')).toHaveTextContent(/지난 기록 14 \/ 30/);start();expect(events('game_start')[0]!.data.level).toBe(2);
 });
 it('recent ahead of best is hidden and diagnosable, never silently repaired or blocking',async()=>{
  const p=fixture();p.recentByDifficulty![1]=ko(13);(Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(p));await setup();
  expect(screen.queryByTestId('revisit-prompt')).toBeNull();expect(events('landing_view')[0]!.data).toMatchObject({has_revisit_prompt:false,revisit_prompt_kind:'invalid',revisit_prompt_issue:'recent_ahead_of_best'});
  start();expect(events('game_start')).toHaveLength(1);expect(Storage.setItem).not.toHaveBeenCalled();
 });
 it('home CTA at two KO waits for reward AND dismissed, then starts once with prompt context',async()=>{
  for(let i=0;i<2;i++){const round=runtime.startRound();runtime.endRound(round,'knockout');}
  let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
  const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},show:jest.fn(p=>{show=p;return jest.fn();})};
  await setup(new RewardedRetryAdController(port));expect(screen.getByTestId('revisit-prompt')).toBeTruthy();const before=events('game_start').length;
  start();start();expect(port.show).toHaveBeenCalledTimes(1);expect(events('game_start')).toHaveLength(before);
  act(()=>show!.onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}}));expect(events('game_start')).toHaveLength(before);expect(runtime.deathsSinceLastAd).toBe(2);
  act(()=>{show!.onEvent({type:'dismissed'});show!.onEvent({type:'dismissed'});});
  expect(events('game_start')).toHaveLength(before+1);expect(events('game_start').at(-1)!.data).toMatchObject({source:'ad_retry',has_revisit_prompt:true,revisit_prompt_kind:'below_best'});
  expect(runtime.deathsSinceLastAd).toBe(0);expect(screen.getByText('0 / 30')).toBeTruthy();expect(Storage.setItem).not.toHaveBeenCalled();
 });
 it('ad failure is not an actual start despite the home prompt',async()=>{
  for(let i=0;i<2;i++){runtime.endRound(runtime.startRound(),'knockout');}
  let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
  const port:FullScreenAdPort={isLoadSupported:()=>true,isShowSupported:()=>true,load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},show:p=>{show=p;return jest.fn();}};
  await setup(new RewardedRetryAdController(port));const before=events('game_start').length;start();act(()=>show!.onEvent({type:'failedToShow'}));
  expect(events('game_start')).toHaveLength(before);expect(runtime.deathsSinceLastAd).toBe(2);expect(Storage.setItem).not.toHaveBeenCalled();
 });
 it('a result retry is not falsely attributed to a new landing prompt',async()=>{
  await setup();start();now=30000;act(()=>frame?.(now));now=40000;act(()=>frame?.(now));
  expect(runtime.deathsSinceLastAd).toBe(1);fireEvent.press(screen.getByRole('button',{name:'다시 도전'}));
  expect(events('game_start')).toHaveLength(2);expect(events('game_start')[1]!.data).toMatchObject({has_revisit_prompt:false,revisit_prompt_kind:null});
  expect(events('retry_game_start')).toHaveLength(1);await act(async()=>{});
 });
});
