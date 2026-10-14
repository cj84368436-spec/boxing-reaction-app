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
 let frame:((time:number)=>void)|undefined,now:number;
 beforeEach(()=>{now=0;frame=undefined;jest.clearAllMocks();(Storage.getItem as jest.Mock).mockResolvedValue(null);(Storage.setItem as jest.Mock).mockResolvedValue(undefined);jest.spyOn(global,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});jest.spyOn(global,'cancelAnimationFrame').mockImplementation(()=>{});});
 afterEach(()=>jest.restoreAllMocks());
 function immediateRetryAd():RewardedRetryAdGate{return {prepare(observer){observer({phase:'ready',message:'테스트 광고 준비 완료'});return jest.fn();},attempt(onRewardedAndClosed){onRewardedAndClosed();return true;},dispose:jest.fn()};}
 function immediateStageAd():StageInterstitialAdGate{return {prepare(observer){observer({phase:'ready'});return jest.fn();},attempt(onClosed){onClosed();return true;},dispose:jest.fn()};}
 async function setup(retryAdGate:RewardedRetryAdGate=immediateRetryAd(),stageAdGate:StageInterstitialAdGate=immediateStageAd()){const view=render(<P0GameScreen clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={retryAdGate} stageAdGate={stageAdGate}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());return view;}
 function sample(gameMs:number){now=gameMs/.65;act(()=>frame?.(now));}
 function start(){fireEvent.press(screen.getByRole('button',{name:'도전 시작'}));}
 it.each([false,true])('keeps the knockout reward requirement through home, records and difficulty changes (%s)',async(changeLevel)=>{
   (Storage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({version:1,unlocked:2,best:{1:{level:1,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1}},bestStreak:{1:4}}));
   let finishAd:(()=>void)|undefined;
   const attempt=jest.fn(callback=>{finishAd=callback;return true;});
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt,dispose:jest.fn()};
   await setup(gate);start();sample(120000);
   expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
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
   now+=200000;act(()=>frame?.(now));
   expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
   fireEvent.press(screen.getByRole('button',{name:'난이도 선택'}));
   start();
   expect(attempt).toHaveBeenCalledTimes(2);
   expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();
 });
 it('does not bypass a knockout through the next level button when it was already unlocked',async()=>{
   (Storage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({version:1,unlocked:2,best:{1:{level:1,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1}},bestStreak:{1:4}}));
   let finishAd:(()=>void)|undefined;
   const attempt=jest.fn(callback=>{finishAd=callback;return true;});
   const stageAttempt=jest.fn(()=>true);
   await setup({prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt,dispose:jest.fn()},
     {prepare(observer){observer({phase:'ready'});return jest.fn();},attempt:stageAttempt,dispose:jest.fn()});
   start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'다음 난이도 도전'}));
   expect(attempt).toHaveBeenCalledTimes(1);
   expect(stageAttempt).not.toHaveBeenCalled();
   expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
   act(()=>finishAd?.());
   expect(screen.getByRole('button',{name:'일시 정지'})).toBeTruthy();
 });
 it('blocks home restart on ad dismissal without reward and starts only after both events',async()=>{
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
 it('keeps the reward requirement when entering the daily course from records',async()=>{
   jest.spyOn(competitionClient,'readCompetition').mockResolvedValue({day:'2026-10-13',participants:0,standing:null});
   const challenge=jest.spyOn(competitionClient,'startChallenge').mockResolvedValue({id:'test',seed:123,level:2,day:'2026-10-13',leadInMs:0});
   let finishAd:(()=>void)|undefined;
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt(callback){finishAd=callback;return true;},dispose:jest.fn()};
   render(<P0GameScreen clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={gate} stageAdGate={immediateStageAd()} competitionBaseUrl="https://example.test"/>);
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
 it('keeps a home restart locked after ad failure and a reward without dismissal',async()=>{
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
     expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');
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
 it('keeps the result until a late reward arrives after closing the ad',async()=>{
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const gate=new RewardedRetryAdController({isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:params=>{show=params;return jest.fn();},
   });
   const view=await setup(gate);start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'재도전'}));
   act(()=>show?.onEvent({type:'dismissed'}));
   expect(screen.getByText('다운 · 4 / 30 생존')).toBeTruthy();
   act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}}));
   expect(screen.getByText('0 / 30')).toBeTruthy();
   view.unmount();
 });
 it('shows an enabled recovery action without auto-starting behind a silent ad',async()=>{
   let show:Parameters<FullScreenAdPort['show']>[0]|undefined;
   const gate=new RewardedRetryAdController({isLoadSupported:()=>true,isShowSupported:()=>true,
     load:({onEvent})=>{onEvent({type:'loaded'});return jest.fn();},
     show:params=>{show=params;return jest.fn();},
   });
   const view=await setup(gate);start();sample(120000);
   jest.useFakeTimers();
   try{
     fireEvent.press(screen.getByRole('button',{name:'재도전'}));
     act(()=>show?.onEvent({type:'userEarnedReward',data:{unitType:'재도전',unitAmount:1}}));
     act(()=>jest.advanceTimersByTime(120000));
     expect(screen.getByText('다운 · 4 / 30 생존')).toBeTruthy();
     expect(screen.getByRole('button',{name:'광고 닫고 재도전'})).toBeEnabled();
     fireEvent.press(screen.getByRole('button',{name:'광고 닫고 재도전'}));
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
   render(<P0GameScreen clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123}
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
   expect(screen.getAllByText(/#\d+ 어퍼컷/).length).toBeGreaterThan(0);
   expect(screen.getByText(/숙이기 · 안전하게 방어/)).toBeTruthy();
 });
it('opens only personal records without exposing online competition',async()=>{await setup();fireEvent.press(screen.getByRole('button',{name:'내 기록 보기'}));expect(screen.getByText('내 기록')).toBeTruthy();expect(screen.queryByText('오늘의 코스')).toBeNull();expect(screen.queryByRole('button',{name:'오늘의 코스 도전'})).toBeNull();expect(screen.queryByText(/순위|백분위|상위 \d+%/)).toBeNull();expect(screen.queryByRole('button',{name:'일시 정지'})).toBeNull();expect(screen.getByTestId('records-banner')).toHaveProp('accessibilityLabel','ait.v2.live.1dae02e06eca49ee');expect(Storage.setItem).not.toHaveBeenCalled();fireEvent.press(screen.getByRole('button',{name:'기록 닫기'}));expect(screen.queryByTestId('records-banner')).toBeNull();expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled();});
 it('ends immediately on the fifth hit, plays the bell, records only resolved punches, and retries with full lives',async()=>{await setup();start();sample(120000);expect(screen.getByText('다운 · 4 / 30 생존')).toBeTruthy();expect(screen.getByTestId('summary-hit')).toHaveTextContent('피격 5');expect(screen.queryByTestId('result-5')).toBeNull();expect(COACH_LINES.downEarly.some(line=>screen.queryByText(line))).toBe(true);expect(screen.getByTestId('temporary-sfx-knockout')).toBeTruthy();await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(1));expect(screen.getByText('광고 시청 후 다시 도전할 수 있어요.')).toBeTruthy();fireEvent.press(screen.getByRole('button',{name:'재도전'}));expect(screen.getByText('0 / 30')).toBeTruthy();expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();});
 it('does not restart until the rewarded ad gate grants retry',async()=>{let finishAd:(()=>void)|undefined;const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:'테스트 광고 준비 완료'});return jest.fn();},attempt(onRewardedAndClosed){finishAd=onRewardedAndClosed;return true;},dispose:jest.fn()};await setup(gate);start();sample(120000);fireEvent.press(screen.getByRole('button',{name:'재도전'}));expect(screen.getByText('다운 · 4 / 30 생존')).toBeTruthy();act(()=>finishAd?.());expect(screen.getByText('0 / 30')).toBeTruthy();});
 it('unlocks the next level after a strong clear and persists records across remounts',async()=>{let finishStageAd:(()=>void)|undefined;const stageGate:StageInterstitialAdGate={prepare(observer){observer({phase:'ready'});return jest.fn();},attempt(onClosed){finishStageAd=onClosed;return true;},dispose:jest.fn()};const view=await setup(immediateRetryAd(),stageGate);start();const s=new P0TenPunchSession({nowMs:()=>0},ids,{ruleset:'candidate',survivalLevel:1,maxHits:5,seed:123});s.start();for(const a of s.snapshot().scheduledAttacks){sample(a.attackStartScheduledAtMs!+300);fireEvent(screen.getByRole('button',{name:a.attackId==='LEAD_HOOK_HEAD'?'오른쪽 →':'← 왼쪽'}),'pressIn');sample(a.attackStartScheduledAtMs!+650);}sample(60000);expect(screen.getByText('클리어 · 목숨 5개')).toBeTruthy();expect(screen.getByRole('button',{name:'다음 난이도 도전'})).toBeTruthy();expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();await waitFor(()=>expect(Storage.setItem).toHaveBeenCalled());const raw=(Storage.setItem as jest.Mock).mock.calls.at(-1)[1];expect(JSON.parse(raw)).toMatchObject({unlocked:2,best:{1:{perfect:30,streak:30,lives:5}}});fireEvent.press(screen.getByRole('button',{name:'다음 난이도 도전'}));expect(screen.getByText('클리어 · 목숨 5개')).toBeTruthy();act(()=>finishStageAd?.());expect(screen.getByText('0 / 30')).toBeTruthy();view.unmount();(Storage.getItem as jest.Mock).mockResolvedValue(raw);await setup();expect(screen.getByRole('button',{name:'도전자'})).toBeEnabled();expect(screen.getByRole('button',{name:'챔피언'})).toBeDisabled();});
 it('pauses without losing lives and silences audio on focus loss',async()=>{const listeners=new Map<string,Function>();jest.spyOn(AppState,'addEventListener').mockImplementation((event:any,fn:any)=>{listeners.set(event,fn);return {remove:jest.fn()};});await setup();start();sample(200);act(()=>listeners.get('blur')?.());expect(screen.getByRole('button',{name:'계속하기'})).toBeTruthy();sample(120000);expect(screen.getByText('0 / 30')).toBeTruthy();expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);act(()=>listeners.get('focus')?.());fireEvent.press(screen.getByRole('button',{name:'계속하기'}));now+=1000;act(()=>frame?.(now));expect(screen.getByText('1 / 30')).toBeTruthy();});
 it('keeps a rewarded retry paused when the ad finishes while the app is inactive',async()=>{
   const listeners=new Map<string,Function>();
   jest.spyOn(AppState,'addEventListener').mockImplementation((event:any,fn:any)=>{listeners.set(event,fn);return {remove:jest.fn()};});
   let finishAd:(()=>void)|undefined;
   const gate:RewardedRetryAdGate={prepare(observer){observer({phase:'ready',message:''});return jest.fn();},attempt(callback){finishAd=callback;return true;},dispose:jest.fn()};
   await setup(gate);start();sample(120000);
   fireEvent.press(screen.getByRole('button',{name:'재도전'}));
   act(()=>listeners.get('change')?.('inactive'));
   act(()=>finishAd?.());
   expect(screen.getByRole('button',{name:'계속하기'})).toBeTruthy();
   now+=120000;act(()=>frame?.(now));
   expect(screen.getByText('0 / 30')).toBeTruthy();
   expect(screen.getByTestId('lives')).toHaveTextContent(/5 \/ 5/);
   act(()=>listeners.get('change')?.('active'));
   expect(screen.getByRole('button',{name:'계속하기'})).toBeTruthy();
   fireEvent.press(screen.getByRole('button',{name:'계속하기'}));
   now+=1000;act(()=>frame?.(now));
   expect(screen.getByText('1 / 30')).toBeTruthy();
 });
 it('allows local play after a storage read hangs and ignores its late result',async()=>{
   let releaseRead:(raw:string)=>void=()=>{};
   (Storage.getItem as jest.Mock).mockImplementationOnce(()=>new Promise<string>(resolve=>{releaseRead=resolve;}));
   jest.useFakeTimers();
   const view=render(<P0GameScreen clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={immediateRetryAd()} stageAdGate={immediateStageAd()}/>);
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
 it('mute suppresses the knockout bell and a failed storage write does not block retry',async()=>{(Storage.setItem as jest.Mock).mockRejectedValue(new Error('unavailable'));await setup();start();fireEvent.press(screen.getByRole('button',{name:'소리 끄기'}));sample(120000);expect(screen.queryByTestId('temporary-sfx-knockout')).toBeNull();await waitFor(()=>expect(screen.getByText('기록 저장 실패 · 이번 실행에서는 유지됩니다.')).toBeTruthy());expect(screen.getByRole('button',{name:'재도전'})).toBeEnabled();});
 it('never overwrites persistent progress after a storage read failure',async()=>{(Storage.getItem as jest.Mock).mockRejectedValue(new Error('read failed'));await setup();start();sample(120000);await waitFor(()=>expect(screen.getByText('기록을 불러오지 못했습니다. 이번 실행의 기록만 유지됩니다.')).toBeTruthy());expect(Storage.setItem).not.toHaveBeenCalled();});
 it('preserves damaged source text and salvages valid clear records',async()=>{const best={level:2,cleared:true,resolved:30,survived:30,lives:2,perfect:10,streak:4,reactionMs:180,at:1};const damaged=JSON.stringify({version:1,unlocked:99,best:{2:best},bestStreak:{2:4}});(Storage.getItem as jest.Mock).mockImplementation(async(key:string)=>key==='boxing-survival-v1'?damaged:null);await setup();expect(screen.getByRole('button',{name:'챔피언'})).toBeEnabled();expect(Storage.setItem).toHaveBeenCalledWith(expect.stringContaining('backup'),damaged);});
 it('serializes round saves so an older write cannot finish after a newer record',async()=>{let releaseFirst:()=>void=()=>{};(Storage.setItem as jest.Mock).mockImplementationOnce(()=>new Promise<void>(resolve=>{releaseFirst=resolve})).mockResolvedValue(undefined);await setup();start();sample(120000);await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(1));fireEvent.press(screen.getByRole('button',{name:'재도전'}));now+=120000/.65;act(()=>frame?.(now));expect(Storage.setItem).toHaveBeenCalledTimes(1);act(()=>releaseFirst());await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(2));});
 it('waits for an in-flight save before reloading after a screen remount',async()=>{let releaseSave:()=>void=()=>{};(Storage.setItem as jest.Mock).mockImplementationOnce(()=>new Promise<void>(resolve=>{releaseSave=resolve})).mockResolvedValue(undefined);const first=await setup();start();sample(120000);await waitFor(()=>expect(Storage.setItem).toHaveBeenCalledTimes(1));first.unmount();const readsBefore=(Storage.getItem as jest.Mock).mock.calls.length;render(<P0GameScreen clock={{nowMs:()=>now}} readyLeadInMs={0} seed={123} retryAdGate={immediateRetryAd()}/>);await act(async()=>{await Promise.resolve();});expect(Storage.getItem).toHaveBeenCalledTimes(readsBefore);act(()=>releaseSave());await waitFor(()=>expect(Storage.getItem).toHaveBeenCalledTimes(readsBefore+1));await waitFor(()=>expect(screen.getByRole('button',{name:'도전 시작'})).toBeEnabled());});
});



