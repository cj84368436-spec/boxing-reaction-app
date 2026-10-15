import {DefenseTutorial} from '../components/DefenseTutorial';
import {resultSummary} from '../product/resultSummary';
import {attackLabel} from '../motion/attackNames';
import {playRuntime, type PlayRuntime, type ProductRound, type AdLease, type FullScreenKind} from '../product/playRuntime';
import {InlineAd, Storage} from '@apps-in-toss/framework';
import {IOScrollView} from '@granite-js/react-native';
import {ART_SOURCES} from '../assets/artSources';
import { LEVELS, SURVIVAL_PUNCHES, type Level } from '../session/survivalRules';
import { emptyProgress, parseProgressWithStatus, recordRound, summarizeRound, recordText, compareRecords, earnsPromotion, isHighScore, type RoundRecord } from '../session/progression';
import { startChallenge, submitChallenge, standingText, readCompetition, overviewText, type Challenge, type CompetitionInput } from '../session/competitionClient';
import { useSafeAreaInsets } from '@granite-js/native/react-native-safe-area-context';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/GameText';
import type { GameClock } from '../../game/engine/GameClock';
import type { DefenseInput } from '../../game/model/types';
import { createCanonicalGameClock } from '../canonicalEngineImports';
import { BoxerRig } from '../components/BoxerRig';
import { CoachReaction } from '../components/CoachReaction';
import { getCoachMoment, getRematchReview } from '../motion/coachPresentation';
import { candidateFailureReason } from '../session/candidateRules';
import { CoachDialogue } from '../motion/coachDialogue';
import { COACH_INTRO } from '../motion/boxingArtwork';
import { DefenseControls } from '../components/DefenseControls';
import { isExtraDefense, type DefenseControlInput } from '../session/advancedDefense';
import {
  TemporarySfxPlayer,
  type PlaytestSoundCue,
} from '../components/TemporarySfxPlayer';
import { getSurvivalMotionAsset, getSurvivalMotionSourceIds } from '../motion/p0MotionRegistry';
import { getFirstPersonFrame } from '../motion/firstPersonPresentation';
import { RoundClock, ROUND_SPEEDS } from '../session/RoundClock';
import {
  createRewardedRetryAdGate,
  type RewardedRetryAdGate,
  type RewardedRetryAdState,
} from '../ads/rewardedRetryAd';
import {ACTIVE_RECORDS_BANNER_AD_GROUP_ID} from '../ads/adGroupIds';
import {
  createStageInterstitialAdGate,
  type StageInterstitialAdGate,
  type StageInterstitialAdState,
} from '../ads/stageInterstitialAd';
import {
  P0TenPunchSession,
  type TenPunchSessionResult,
  type TenPunchSessionSnapshot,
} from '../session/P0TenPunchSession';

interface P0GameScreenProps {
  readonly runtime?: PlayRuntime;
  readonly clock?: GameClock;
  readonly readyLeadInMs?: number;
  readonly seed?: number;
  readonly debugMode?: boolean;
  readonly competitionBaseUrl?: string;
  readonly retryAdGate?: RewardedRetryAdGate;
  readonly stageAdGate?: StageInterstitialAdGate;
  readonly skipStartupAdLoad?: boolean;
}

const TOTAL_PUNCHES = SURVIVAL_PUNCHES;
const PROGRESS_KEY = 'boxing-survival-v1';
const PROGRESS_LOAD_TIMEOUT_MS = 8000;
let progressWriteQueue: Promise<void> = Promise.resolve();
function enqueueProgressWrite(serialized: string): Promise<void> {
  const write = progressWriteQueue.then(() => Storage.setItem(PROGRESS_KEY, serialized));
  progressWriteQueue = write.catch(() => undefined);
  return write;
}
async function readProgressRaw(): Promise<string | null> {
  await progressWriteQueue;
  return Storage.getItem(PROGRESS_KEY);
}
// SDK 2.x TopTransparentNavigation overlays a 44-point row below the safe area.
const HOST_NAVIGATION_HEIGHT = 44;
const MOTION_ASSETS = Object.fromEntries(Object.keys(getSurvivalMotionSourceIds()).map(id => [id, getSurvivalMotionAsset(id)]));

function isDefenseWindowOpen(snapshot: TenPunchSessionSnapshot): boolean {
  const attack = snapshot.currentAttack;
  return (
    attack.gameState === 'RESPONSE_WINDOW' &&
    attack.responseEndAtMs != null &&
    attack.nowMs <= attack.responseEndAtMs
  );
}

function statusFor(snapshot: TenPunchSessionSnapshot): string {
  if (isDefenseWindowOpen(snapshot)) return 'DEFEND';
  if (
    snapshot.currentAttack.gameState === 'COUNTDOWN' ||
    snapshot.currentAttack.gameState === 'READY'
  ) {
    return 'READY';
  }
  return 'BOX';
}

function soundFor(result: TenPunchSessionResult): PlaytestSoundCue {
  return {
    id: result.attackInstanceId,
    sound:
      result.outcome === 'HIT'
        ? result.attackId === 'LEAD_JAB_HEAD' ? 'hitJab' : result.attackId === 'REAR_STRAIGHT_HEAD' ? 'hitStraight' : 'hitHook'
        : result.telemetry.inputButton === 'GUARD'
          ? 'guard'
          : 'evade',
  };
}

function resultDescription(result: TenPunchSessionResult): string {
  const button = result.telemetry.inputButton;
  const input = button == null ? '입력 없음' : ({LEFT:'왼쪽 회피', RIGHT:'오른쪽 회피', BACK:'뒤로 피하기', GUARD:'가드', DUCK:'숙이기', STEP_IN:'앞으로 파고들기'} as Record<string,string>)[button] ?? '알 수 없는 입력';
  const reason = result.outcome === 'PERFECT' ? '완벽하게 피함' : result.outcome === 'SAFE' ? '안전하게 방어' :
    result.telemetry.inputStatus === 'VALID' ? candidateFailureReason(result.attackId,button) :
    ({NO_INPUT:'누르지 않아 맞음', EARLY:'너무 일찍 누름', LATE:'늦게 누름', MULTI_INPUT:'버튼을 동시에 누름'} as Record<string,string>)[result.telemetry.inputStatus] ?? '방어 실패';
  return `${input} · ${reason}`;
}

export function P0GameScreen({
  runtime = playRuntime,
  clock,
  readyLeadInMs = 2000,
  seed,
  debugMode = false,
  competitionBaseUrl,
  retryAdGate,
  stageAdGate,
  skipStartupAdLoad = false,
}: P0GameScreenProps) {
  const safeArea = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const [roundClock] = useState(() => new RoundClock(clock ?? createCanonicalGameClock()));
  const [rewardedRetryAd] = useState(() => retryAdGate ?? createRewardedRetryAdGate((name,data)=>runtime.track(name,{...data,roundId:productRoundRef.current?.id??null})));
  const [retryAdState, setRetryAdState] = useState<RewardedRetryAdState>({phase: 'idle', message: ''});
  const [, updateRuntime] = useState(0);
  const retryRequired = runtime.requiresReward;
  const productRoundRef = useRef<ProductRound | undefined>(undefined);
  const ownerRef = useRef({});
  const adLeaseRef = useRef<AdLease | null>(null);
  const mountedRef = useRef(true);
  const pendingBeginRef = useRef<(() => void) | null>(null);
  const [adResetVersion,setAdResetVersion]=useState(0);
  const [waitingForForeground, setWaitingForForeground] = useState(false);
  const retryPhaseRef = useRef<RewardedRetryAdState['phase']>('idle');
  const stagePhaseRef = useRef<StageInterstitialAdState['phase']>('idle');
  useEffect(() => runtime.subscribe(() => updateRuntime(value => value + 1)), [runtime]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingBeginRef.current = null;
      if (adLeaseRef.current) runtime.releaseAd(adLeaseRef.current);
      adLeaseRef.current = null;
    };
  }, [runtime]);
  const [stageInterstitialAd] = useState(() => stageAdGate ?? createStageInterstitialAdGate((name,data)=>runtime.track(name,{...data,roundId:productRoundRef.current?.id??null})));
  const [stageAdState, setStageAdState] = useState<StageInterstitialAdState>({phase: 'idle'});
  const clockRef = useRef(roundClock);
  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const resultsReadyRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundFailed, setSoundFailed] = useState(false);
  const foregroundRef = useRef(AppState.currentState !== 'inactive' && AppState.currentState !== 'background');
  const [foreground, setForeground] = useState(foregroundRef.current);
  const [level,setLevel]=useState<Level>(1);
  const [progress,setProgress]=useState(emptyProgress);
  const progressRef=useRef(progress);
  const storageWritableRef=useRef(false);
  const [loaded,setLoaded]=useState(false);
  const [storageNote,setStorageNote]=useState('');
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [previousBest,setPreviousBest]=useState<RoundRecord>();
  const [rankNote,setRankNote]=useState('');
  const [connecting,setConnecting]=useState(false);
  const connectingRef=useRef(false);
  const [tutorialLevel,setTutorialLevel]=useState<Level | null>(null);
  const [recordsOpen,setRecordsOpen]=useState(false);
  const [recordsNote,setRecordsNote]=useState('');
  const requestVersion=useRef(0);
  useEffect(()=>()=>{requestVersion.current++;},[]);
  const closeRecords=()=>{requestVersion.current++;setRecordsOpen(false);};
  const openRecords=async()=>{
    if(!loaded||connectingRef.current)return;
    const version=++requestVersion.current;setRecordsOpen(true);
    if(!competitionBaseUrl){setRecordsNote('');return;}
    setRecordsNote('오늘의 기록 불러오는 중…');
    try{const v=await readCompetition(competitionBaseUrl);if(version===requestVersion.current)setRecordsNote(overviewText(v));}
    catch{if(version===requestVersion.current)setRecordsNote('온라인 기록을 불러오지 못했습니다. 개인 기록은 위에서 볼 수 있습니다.');}
  };
  const challengeRef=useRef<Challenge|undefined>(undefined);
  const inputsRef=useRef<CompetitionInput[]>([]);
  const savedRound=useRef<string|undefined>(undefined);
  useEffect(()=>{
    let active=true;
    const timeout=setTimeout(()=>{
      if(!active)return;
      active=false;storageWritableRef.current=false;
      setStorageNote('기록을 불러오지 못했습니다. 이번 실행의 기록만 유지됩니다.');
      setLoaded(true);
    },PROGRESS_LOAD_TIMEOUT_MS);
    (async()=>{
    try{
      const raw=await readProgressRaw();if(!active)return;
      const parsed=parseProgressWithStatus(raw);progressRef.current=parsed.progress;setProgress(parsed.progress);
      if(parsed.damaged&&raw!==null){
        try{await Storage.setItem(`${PROGRESS_KEY}-backup-${Date.now()}`,raw);if(active)setStorageNote('손상된 기록에서 복구 가능한 기록을 살렸습니다.');}
        catch{if(active)setStorageNote('손상 원문을 보존하지 못해 저장을 중지했습니다.');return;}
      }
      if(active)storageWritableRef.current=true;
    }catch{if(active){storageWritableRef.current=false;setStorageNote('기록을 불러오지 못했습니다. 이번 실행의 기록만 유지됩니다.');}}
    finally{clearTimeout(timeout);if(active)setLoaded(true);}
  })();return()=>{active=false;clearTimeout(timeout);};},[]);
  const [speed, setSpeed] = useState<number>(ROUND_SPEEDS.relaxed);
  const [notice, setNotice] = useState<{text: string; until: number} | null>(null);
  const [initialSession] = useState(() =>
    new P0TenPunchSession(roundClock, getSurvivalMotionSourceIds(), {
      ruleset: 'candidate', maxHits: 5, survivalLevel:1,
      ...(seed == null ? {} : { seed }),
    }),
  );
  const sessionRef = useRef(initialSession);
  const [snapshot, setSnapshot] = useState(() => sessionRef.current.snapshot());
  const dialogue = useRef(new CoachDialogue());
  const acceptedAt = useRef(new Map<string, number>());
  const latestResult = snapshot.latestResult;
  const showResults = snapshot.sessionCompleted && latestResult != null &&
    snapshot.nowMs - latestResult.telemetry.impactScheduledAtMs >= 280;
  resultsReadyRef.current = showResults;
  useEffect(() => {
    if (started && snapshot.sessionCompleted && productRoundRef.current) {
      runtime.endRound(productRoundRef.current, snapshot.knockedOut ? 'knockout' : 'clear');
    }
  }, [runtime, started, snapshot.sessionCompleted, snapshot.knockedOut]);
  useEffect(() => {
    if (skipStartupAdLoad) return;
    return stageInterstitialAd.prepare(state => {
      stagePhaseRef.current = state.phase;
      setStageAdState(state);
    });
  }, [stageInterstitialAd, skipStartupAdLoad, adResetVersion]);
  useEffect(() => {
    if (!retryRequired) return;
    return rewardedRetryAd.prepare(state => {
      retryPhaseRef.current = state.phase;
      setRetryAdState(state);
    });
  }, [retryRequired, rewardedRetryAd, adResetVersion]);
  useEffect(() => {
    if (!foreground || !pendingBeginRef.current) return;
    const beginPending = pendingBeginRef.current;
    pendingBeginRef.current = null;
    setWaitingForForeground(false);
    beginPending();
  }, [foreground]);

  const pauseRound = useCallback(() => {
    if (!startedRef.current || pausedRef.current || resultsReadyRef.current) return;
    pausedRef.current = true;
    clockRef.current.pause();
    setPaused(true);
  }, []);

  useEffect(() => {
    if (!started || paused || showResults) return;
    let frameId = 0;
    let cancelled = false;
    const sampleFrame = () => {
      if (cancelled || pausedRef.current || !startedRef.current) return;
      setSnapshot(sessionRef.current.tick());
      frameId = requestAnimationFrame(sampleFrame);
    };
    frameId = requestAnimationFrame(sampleFrame);
    return () => { cancelled = true; cancelAnimationFrame(frameId); };
  }, [started, paused, showResults]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foregroundRef.current = state === 'active';
      setForeground(state === 'active');
      if (state !== 'active') pauseRound();
    });
    // Android's notification shade can take focus without changing AppState.
    const blur = AppState.addEventListener('blur', () => { foregroundRef.current=false;setForeground(false);pauseRound(); });
    const focus = AppState.addEventListener('focus', () => { foregroundRef.current=true;setForeground(true); });
    return () => { subscription.remove(); blur.remove(); focus.remove(); };
  }, [pauseRound]);

  const begin = (selected: Level, roundSeed = seed, challenge?: Challenge, source = 'landing') => {
    if (runtime.requiresReward || runtime.fullScreenBusy || !foregroundRef.current) return;
    if ((!loaded || connecting) && !challenge) return;
    if (startedRef.current && !sessionRef.current.snapshot().sessionCompleted) return;
    if(!challenge && selected>progress.unlocked)return;
    requestVersion.current++;setRecordsOpen(false);setDetailsOpen(false);
    const rate=LEVELS[selected].rate;
    startedRef.current=true; pausedRef.current=false; resultsReadyRef.current=false;
    challengeRef.current=challenge; inputsRef.current=[]; savedRound.current=undefined;
    setRankNote(challenge?'오늘의 동일 코스 · 종료 후 기록 비교':'');
    dialogue.current.beginRound(); acceptedAt.current.clear(); setNotice(null);setPaused(false);
    clockRef.current.start(rate);setSpeed(rate);setLevel(selected);
    sessionRef.current=new P0TenPunchSession(clockRef.current,getSurvivalMotionSourceIds(),{ruleset:'candidate',maxHits:5,survivalLevel:selected,...(roundSeed==null?{}:{seed:roundSeed})});
    sessionRef.current.start({leadInMs:challenge?.leadInMs??readyLeadInMs*rate});
    productRoundRef.current = runtime.startRound({level:selected,source});
    setStarted(true);setSnapshot(sessionRef.current.tick());
  };
  const beginDaily=async()=>{
    if(runtime.requiresReward){
      afterRetryReward(()=>{void beginDaily();});
      return;
    }
    if(!competitionBaseUrl||connectingRef.current)return;connectingRef.current=true;setConnecting(true);
    const version=++requestVersion.current;
    try{const challenge=await startChallenge(competitionBaseUrl);if(version===requestVersion.current)begin(challenge.level,challenge.seed,challenge);}catch{if(version===requestVersion.current){setRankNote('비교 서버 연결 실패 · 다시 시도해 주세요.');setRecordsNote('비교 서버 연결 실패 · 다시 시도해 주세요.');}}finally{connectingRef.current=false;setConnecting(false);}
  };

  const frame = useMemo(
    () => getFirstPersonFrame(snapshot, MOTION_ASSETS, acceptedAt.current),
    [snapshot],
  );
  const coachMoment = getCoachMoment(snapshot, dialogue.current);
  const rematch = getRematchReview(snapshot.results, speed, true, showResults ? {dialogue: dialogue.current, event: snapshot.runId, knockedOut: snapshot.knockedOut === true, totalPunches:TOTAL_PUNCHES} : undefined);
  const recognized = showResults && snapshot.results.every(r=>r.outcome !== 'HIT') && snapshot.results.filter(r=>r.outcome === 'PERFECT').length >= 24;
  const soundCue: PlaytestSoundCue | undefined = showResults && snapshot.knockedOut ? {id:snapshot.runId + ':knockout', sound:'knockout'} : recognized ? {id:snapshot.runId + ':recognition', sound:'recognition'} : latestResult == null ? undefined : soundFor(latestResult);
  const hitVisible = frame.hit;
  const windowOpen = isDefenseWindowOpen(snapshot);
  const counts = snapshot.results.reduce(
    (summary, result) => ({ ...summary, [result.outcome]: summary[result.outcome] + 1 }),
    { PERFECT: 0, SAFE: 0, HIT: 0 },
  );

  const handleDefensePressIn = (input: DefenseControlInput) => {
    if (!startedRef.current || pausedRef.current || sessionRef.current.tick().sessionCompleted) return;
    if(challengeRef.current && !isExtraDefense(input))inputsRef.current.push({atMs:clockRef.current.nowMs(),input});
    const receipt = sessionRef.current.handleInput(input);
    if (receipt.status === 'VALID' && !acceptedAt.current.has(receipt.targetAttackInstanceId)) {
      acceptedAt.current.set(receipt.targetAttackInstanceId, receipt.atMs);
    }
    if (receipt.status === 'VALID') setNotice({text: ({LEFT:'왼쪽 회피',RIGHT:'오른쪽 회피',BACK:'거리 빼기',GUARD:'가드',DUCK:'숙이기',STEP_IN:'앞으로 파고들기'} as Record<string,string>)[receipt.input] + ' · 동작 중', until:clockRef.current.nowMs()+160});
    if (receipt.status !== 'VALID') setNotice({text: receipt.status === 'EARLY' ? '너무 빠름 · 복귀 뒤 다시 입력' : receipt.status === 'LATE' ? '조금 더 일찍 눌러보세요' : '버튼 하나만 눌러주세요', until:clockRef.current.nowMs()+200});
    setSnapshot(sessionRef.current.snapshot());
  };

  const handleRetry = (retrySeed?: number, source = 'free_retry') => {
    if(!sessionRef.current.snapshot().sessionCompleted)return;
    if(challengeRef.current){void beginDaily();return;}
    begin(level,retrySeed??snapshot.seed,undefined,source);
  };
  const runFullScreenAd = (kind: FullScreenKind, onComplete: () => void) => {
    if (!mountedRef.current || pendingBeginRef.current || !foregroundRef.current) return;
    const phase = kind === 'rewarded' ? retryPhaseRef.current : stagePhaseRef.current;
    const previous = adLeaseRef.current;
    if (previous) {
      // An explicit recovery tap retires the old action. Its callbacks cannot start a game.
      if (previous.kind !== kind || phase !== 'error') return;
      runtime.releaseAd(previous);
      adLeaseRef.current = null;
    }
    const lease = runtime.acquireAd(ownerRef.current, kind);
    if (!lease) return;
    adLeaseRef.current = lease;
    const complete = () => {
      if (!mountedRef.current || adLeaseRef.current !== lease) return;
      const accepted = kind === 'rewarded' ? runtime.completeReward(lease) : runtime.releaseAd(lease);
      if (!accepted) return;
      adLeaseRef.current = null;
      if (foregroundRef.current) onComplete();
      else {
        pendingBeginRef.current = onComplete;
        setWaitingForForeground(true);
      }
    };
    const attempted = kind === 'rewarded'
      ? rewardedRetryAd.attempt(complete)
      : stageInterstitialAd.attempt(complete);
    if (!attempted && adLeaseRef.current === lease) {
      runtime.releaseAd(lease);
      adLeaseRef.current = null;
    }
  };
  const afterRetryReward = (onRewarded: () => void) => runFullScreenAd('rewarded', onRewarded);
  const requestBegin = (selected: Level) => {
    if(runtime.requiresReward){const retry=runtime.prepareRetry('ad_retry');runtime.track('ad_retry_tap',{roundId:retry?.previousRoundId??null,level:selected});afterRetryReward(()=>begin(selected,seed,undefined,'ad_retry'));}
    else if(!runtime.tutorialCompleted && Object.keys(progressRef.current.best).length===0)setTutorialLevel(selected);
    else begin(selected);
  };
  const handleNextLevel = () => {
    if (!sessionRef.current.snapshot().sessionCompleted || level >= 3 || progress.unlocked <= level) return;
    const nextLevel = (level + 1) as Level;
    if(snapshot.knockedOut){requestBegin(nextLevel);return;}
    runFullScreenAd('interstitial', () => begin(nextLevel,seed,undefined,'next_level'));
  };
  const handleRewardedRetry = (retrySeed?: number) => {
    if(!sessionRef.current.snapshot().sessionCompleted || pendingBeginRef.current)return;
    if(runtime.fullScreenBusy && adLeaseRef.current?.kind!=='rewarded')return;
    if(runtime.requiresReward){const retry=runtime.prepareRetry('ad_retry');runtime.track('ad_retry_tap',{roundId:retry?.previousRoundId??null,level});afterRetryReward(() => handleRetry(retrySeed,'ad_retry'));}
    else {const retry=runtime.prepareRetry('free_retry');runtime.track('free_retry_tap',{roundId:retry?.previousRoundId??null,level});handleRetry(retrySeed);}
  };
  const retryAdPressable = !waitingForForeground && stageAdState.phase !== 'showing' &&
    (!retryRequired || retryAdState.phase === 'ready' || retryAdState.phase === 'error');
  const retryAdLabel = !retryRequired ? '다시 도전' : retryAdState.phase === 'ready' ? '광고 보고 다시 도전' : retryAdState.phase === 'error' ? retryAdState.actionLabel ?? '광고 다시 불러오기' : retryAdState.phase === 'showing' ? '광고 재생 중…' : retryAdState.phase === 'unsupported' ? 'QR에서 광고 테스트' : '광고 준비 중…';
  useEffect(()=>{if(loaded&&!started&&!recordsOpen&&tutorialLevel===null)runtime.track('landing_view');},[runtime,loaded,started,recordsOpen,tutorialLevel]);
  useEffect(()=>{if(tutorialLevel!==null)runtime.track('tutorial_start');},[runtime,tutorialLevel]);
  const roundRecord=useMemo(()=>summarizeRound(snapshot,level,speed),[snapshot,level,speed]);
  const summary = resultSummary(roundRecord, snapshot.results);
  useEffect(()=>{
    if(!showResults||savedRound.current===snapshot.runId)return;
    runtime.track('result_view',{roundId:productRoundRef.current?.id??null,level});
    savedRound.current=snapshot.runId;const base=progressRef.current;setPreviousBest(base.best[level]);
    const next=recordRound(base,roundRecord);progressRef.current=next;setProgress(next);
    if(loaded&&storageWritableRef.current)void enqueueProgressWrite(JSON.stringify(next)).catch(()=>setStorageNote('기록 저장 실패 · 이번 실행에서는 유지됩니다.'));
    const challenge=challengeRef.current;
    if(challenge && competitionBaseUrl)void submitChallenge(challenge,inputsRef.current,competitionBaseUrl).then(r=>{if(challengeRef.current===challenge)setRankNote(standingText(r));}).catch(()=>{if(challengeRef.current===challenge)setRankNote('온라인 기록 제출 실패 · 개인 기록은 유지됩니다.');});
  },[showResults,snapshot.runId,level,loaded,roundRecord,competitionBaseUrl]);

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: safeArea.top + HOST_NAVIGATION_HEIGHT + 8,
          paddingRight: Math.max(safeArea.right, 12),
          paddingBottom: Math.max(safeArea.bottom, 12),
          paddingLeft: Math.max(safeArea.left, 12),
        },
      ]}
    >
      <TemporarySfxPlayer cue={soundCue} onPlaybackError={() => setSoundFailed(true)} onPlaybackSuccess={() => setSoundFailed(false)} enabled={soundEnabled && foreground && !paused && retryAdState.phase !== 'showing' && stageAdState.phase !== 'showing' && (!showResults || recognized || snapshot.knockedOut === true)} />

      <View style={styles.hud}>
        <View style={styles.hudTitle}>
          <Text style={styles.title}>복싱재능테스트</Text>
          {skipStartupAdLoad ? <Text style={{color:'#D4AF66',fontSize:11}}>진단 버전 · 시작 광고 호출 제외</Text> : null}
          <Text testID="lives" style={styles.status}>{`목숨 ${'♥'.repeat(snapshot.livesRemaining ?? 5)}${'♡'.repeat(5-(snapshot.livesRemaining ?? 5))} · ${snapshot.livesRemaining ?? 5} / 5`}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.punchCount}>{snapshot.results.length} / {TOTAL_PUNCHES}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={soundEnabled ? '소리 끄기' : '소리 켜기'} style={styles.soundButton} onPress={() => setSoundEnabled(value => !value)}>
            <Text style={styles.soundText}>{!soundEnabled ? '소리 꺼짐' : soundFailed ? '소리 재생 실패' : '소리 켜짐'}</Text>
          </Pressable>
        </View>
      </View>
          <View style={[styles.liveBadge, debugMode && windowOpen && styles.liveBadgeCue]}>
            <View style={[styles.liveDot, debugMode && windowOpen && styles.liveDotCue]} />
            <Text numberOfLines={1} style={styles.liveText}>{!started ? LEVELS[level].name+' · 30회 생존 도전' : paused ? '일시 정지' : showResults ? snapshot.knockedOut ? '다운 · 경기 종료' : '라운드 클리어' : debugMode ? statusFor(snapshot) : notice && snapshot.nowMs < notice.until ? notice.text : frame.feedback || '주먹을 보세요'}</Text>
          </View>

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_PUNCHES }, (_, index) => (
          <View
            key={index}
            testID={`attack-progress-${index}`}
            style={[
              styles.progressBar,
              snapshot.results.length > index && styles.progressResolved,
              snapshot.results[index]?.outcome === 'SAFE' && styles.progressSafe,
              snapshot.results[index]?.outcome === 'HIT' && styles.progressHit,
              snapshot.currentAttackIndex === index &&
                snapshot.results.length <= index &&
                styles.progressCurrent,
            ]}
          />
        ))}
      </View>

      <View style={[styles.stage, hitVisible && styles.stageHit, frame.contact && frame.outcome === 'PERFECT' && styles.stageEvaded]}>
        <Image source={ART_SOURCES.gym} resizeMode="cover" style={StyleSheet.absoluteFillObject} accessible={false}/>
        <View
          testID="first-person-camera"
          style={styles.camera}
        >
          <BoxerRig frame={frame} />
        </View>
        {hitVisible ? <View testID="hit-reaction" style={styles.hitFlash} /> : null}

        {started && !paused && !showResults ? (
          <Text pointerEvents="none" style={styles.roundHint}>
            {snapshot.nowMs < snapshot.scheduledAttacks[0]!.attackStartScheduledAtMs!
              ? `준비 ${Math.ceil((snapshot.scheduledAttacks[0]!.attackStartScheduledAtMs! - snapshot.nowMs) / (speed * 1000))}`
              : frame.feedback}
          </Text>
        ) : null}
        {!started && !recordsOpen && tutorialLevel===null ? (
          <View style={styles.introCard}>
          <ScrollView contentContainerStyle={[styles.introContent, compact && styles.introCompact]}>
            <CoachReaction reaction={COACH_INTRO} />
            <Text style={styles.introTitle}>주먹을 보고 피하세요</Text>
            <View style={styles.howTo}>
              <Text style={styles.introDirection}>잽 → 왼쪽 또는 오른쪽</Text>
              <Text style={styles.introDirection}>스트레이트 → 왼쪽</Text>
              <Text style={styles.introDirection}>훅 → 오른쪽</Text>
            </View>
            <Text style={styles.introBody}>30회 버티면 성공 · 목숨 5개</Text>
            <Text style={styles.introBody}>가드 2회 · 회피하면 1회 회복</Text>
            <Text style={styles.smallPrint}>챔피언: 6버튼 · 어퍼컷 추가</Text>
          </ScrollView>
          <View style={styles.introActions}>
            <View style={{flexDirection:'row',gap:6}}>{([1,2,3] as const).map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={LEVELS[item].name} disabled={!loaded||item>progress.unlocked} onPress={()=>setLevel(item)} style={[styles.levelButton,{backgroundColor:item===level?'#D4AF66':'#233A4D',opacity:item>progress.unlocked?.45:1}]}><Text style={{color:item===level?'#14262A':'#E2E9E5',fontWeight:'800'}}>{item>progress.unlocked?'🔒 ':''}{LEVELS[item].name}</Text></Pressable>)}</View>
            <Text style={styles.smallPrint}>{recordText(progress.best[level])} · 연속 최고 {progress.bestStreak[level]??0}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="도전 시작" accessibilityHint={retryRequired?'광고 시청 후 다시 도전할 수 있어요.':undefined} disabled={!loaded||connecting||(retryRequired&&!retryAdPressable)} style={styles.beginButton} onPress={()=>requestBegin(level)}><Text style={styles.beginText}>{!loaded?'기록 불러오는 중':retryRequired?(retryAdState.phase==='ready'?'광고 보고 '+LEVELS[level].name+' 도전':retryAdLabel):LEVELS[level].name+' 도전 시작'}</Text></Pressable>
            {retryRequired?<Text accessibilityLiveRegion="polite" style={styles.smallPrint}>{retryAdState.message||'광고 시청 후 다시 도전할 수 있어요.'}</Text>:null}
            <Pressable accessibilityRole="button" accessibilityLabel="내 기록 보기" disabled={connecting||!loaded} style={styles.replayButton} onPress={()=>void openRecords()}><Text style={styles.replayText}>내 기록 보기</Text></Pressable>
            <Text style={styles.smallPrint}>{rankNote||storageNote||'30회를 버티면 다음 단계 해금'}</Text>
          </View></View>
        ) : null}
        {tutorialLevel!==null ? <DefenseTutorial active={foreground} onComplete={()=>{runtime.completeTutorial();const selected=tutorialLevel;setTutorialLevel(null);begin(selected);}}/> : null}
        {recordsOpen ? <View style={styles.introCard} accessibilityViewIsModal>
          <IOScrollView contentContainerStyle={styles.introContent}>
            <Text accessibilityRole="header" style={styles.introTitle}>내 기록</Text>
            {([1,2,3] as const).map(n=><View key={n} style={styles.recordCard}><Text style={styles.rematchTitle}>{LEVELS[n].name}</Text><Text style={styles.rematchBody}>{recordText(progress.best[n])} · 연속 최고 {progress.bestStreak[n]??0}</Text></View>)}
            {competitionBaseUrl ? <>
              <Text style={styles.rematchTitle}>오늘의 코스</Text><Text style={styles.introBody}>모두 같은 도전자 난이도와 공격 순서로 겨룹니다.</Text>
              <Text accessibilityLiveRegion="polite" style={styles.smallPrint}>{recordsNote}</Text>
            </> : null}
            <View style={styles.recordsAd}><InlineAd adGroupId={ACTIVE_RECORDS_BANNER_AD_GROUP_ID} theme="dark" tone="grey" variant="card" /></View>
          </IOScrollView>
          <View style={styles.introActions}>
            {competitionBaseUrl ? <Pressable accessibilityRole="button" accessibilityLabel="오늘의 코스 도전" disabled={connecting||!loaded||(retryRequired&&!retryAdPressable)} onPress={()=>void beginDaily()} style={styles.beginButton}><Text style={styles.beginText}>{connecting?'연결 중…':retryRequired?'광고 보고 오늘의 코스 도전':'오늘의 코스 도전'}</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="기록 닫기" onPress={closeRecords} style={styles.replayButton}><Text style={styles.replayText}>돌아가기</Text></Pressable>
          </View>
        </View>:null}
        {paused ? (
          <ScrollView style={styles.introCard} contentContainerStyle={styles.introContent}><Text style={styles.introTitle}>잠시 쉬어갑니다</Text><Text style={styles.introBody}>멈춘 순간부터 이어집니다.{"\n"}준비되면 계속하기를 눌러주세요.</Text><Pressable accessibilityRole="button" accessibilityLabel="계속하기" style={styles.beginButton} onPress={() => {pausedRef.current=false; clockRef.current.resume(); setPaused(false);}}><Text style={styles.beginText}>계속하기</Text></Pressable></ScrollView>
        ) : started && !snapshot.sessionCompleted ? (
          <Pressable accessibilityRole="button" accessibilityLabel="일시 정지" style={styles.pauseButton} onPress={pauseRound}><Text style={styles.replayText}>Ⅱ 정지</Text></Pressable>
        ) : null}
        {showResults ? (
          <View style={styles.resultCard}>
            <ScrollView style={styles.resultList} contentContainerStyle={styles.resultContent}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.resultHeading}>{snapshot.knockedOut ? `다운 · ${roundRecord.survived} / 30 생존` : `클리어 · 목숨 ${roundRecord.lives}개`}</Text>
            <Text style={styles.rematchTitle}>{summary.goal}</Text>
            {summary.strength ? <Text style={styles.rematchBody}>{summary.strength}</Text> : null}
            {summary.weakness ? <Text style={styles.rematchBody}>{summary.weakness}</Text> : null}
            <CoachReaction compact={compact} reaction={{...rematch.reaction, note:snapshot.knockedOut ? `${rematch.focusTitle}. ${rematch.focusBody}` : rematch.reaction.note}} />
            <View style={styles.recordCard}>
              <Text style={styles.rematchTitle}>{!previousBest?'첫 기록을 남겼어요':compareRecords(roundRecord,previousBest)<0?'새로운 최고 기록!':recordText(previousBest)}</Text>
              <Text style={styles.rematchBody}>완벽 회피 {roundRecord.perfect}/30 · 최장 연속 {roundRecord.streak}회{isHighScore(roundRecord)?' · 관장의 인정 달성!':''}</Text>
              <Text style={styles.rematchBody}>{earnsPromotion(roundRecord)?level<3?LEVELS[(level+1) as Level].name+' 단계 해금!':'최고 단계 클리어!':'같은 공격 순서로 다시 연습할 수 있어요'}</Text>
              <Text style={styles.smallPrint}>{rankNote||storageNote||'난이도별 최고 기록은 이 기기에 저장됩니다.'}</Text>
            </View>
            <View testID="rematch-focus" style={styles.rematchFocus}>
              <Text style={styles.rematchTitle}>{rematch.focusTitle}</Text>
              <Text style={styles.rematchBody}>{rematch.focusBody}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text testID="summary-perfect" style={styles.textPerfect}>완벽 회피 {counts.PERFECT}</Text>
              <Text testID="summary-safe" style={styles.textSafe}>안전 방어 {counts.SAFE}</Text>
              <Text testID="summary-hit" style={styles.textHit}>피격 {counts.HIT}</Text>
            </View>
              <Pressable accessibilityRole="button" accessibilityLabel={detailsOpen ? '상세 기록 접기' : '상세 기록 보기'} accessibilityState={{expanded:detailsOpen}} onPress={() => setDetailsOpen(value => !value)} style={styles.replayButton}><Text style={styles.replayText}>{detailsOpen ? '상세 기록 접기' : '상세 기록 보기'}</Text></Pressable>
              {detailsOpen && snapshot.results.map((result) => (
                <View key={result.attackInstanceId} testID={`result-${result.attackIndex}`} style={styles.resultRow}>
                  <Text style={[styles.resultAttack, result.outcome === 'PERFECT' ? styles.textPerfect : result.outcome === 'SAFE' ? styles.textSafe : styles.textHit]}>#{result.attackIndex + 1} {attackLabel(result.attackId)}</Text>
                  <Text style={styles.resultDetail}>
                    {resultDescription(result)}{debugMode ? ` · ${result.telemetry.inputStatus} · ${result.telemetry.reactionMs == null ? '—' : Math.round(result.telemetry.reactionMs / speed)} ms` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
            {!challengeRef.current && level<3 && progress.unlocked>level ? <Pressable accessibilityRole="button" accessibilityLabel={retryRequired ? "광고 보고 다음 난이도 도전" : "다음 난이도 도전"} disabled={waitingForForeground || stageAdState.phase === 'showing' || (retryRequired && !retryAdPressable)} style={[styles.beginButton,stageAdState.phase === 'showing'&&{opacity:.55}]} onPress={handleNextLevel}><Text style={styles.beginText}>{stageAdState.phase === 'showing'?'광고 재생 중…':`${retryRequired ? "광고 보고 " : ""}다음 난이도 도전 · ${LEVELS[(level+1) as Level].name}`}</Text></Pressable>:null}
            {stageAdState.message && !challengeRef.current && level<3 && progress.unlocked>level ? <Text accessibilityLiveRegion="polite" style={styles.smallPrint}>{stageAdState.message}</Text> : null}
            <Pressable
              accessibilityLabel={retryAdLabel}
              accessibilityHint={retryRequired ? "광고 시청 후 다시 도전할 수 있어요." : undefined}
              accessibilityRole="button"
              disabled={!retryAdPressable}
              onPress={() => handleRewardedRetry(rematch.replaySameSeed ? snapshot.seed : (snapshot.seed + 1) >>> 0)}
              style={({ pressed }) => [styles.retryButton, !retryAdPressable && {opacity: 0.55}, pressed && styles.retryPressed]}
            >
              <Text style={styles.retryText}>{retryAdLabel}</Text>
              <Text style={styles.rematchNote}>{challengeRef.current ? '오늘의 같은 코스에 다시 도전합니다.' : rematch.retryNote}</Text>
            </Pressable>
            {retryRequired ? <><Text style={styles.adDisclosure}>광고 시청 후 다시 도전할 수 있어요.</Text><Text accessibilityLiveRegion="polite" style={styles.smallPrint}>{retryAdState.message}</Text></> : null}
            {waitingForForeground ? <Text accessibilityLiveRegion="polite" style={styles.smallPrint}>돌아오면 준비 후 바로 시작합니다.</Text> : null}
            <View style={{flexDirection:'row',gap:8}}>{!challengeRef.current ? <Pressable accessibilityLabel={retryRequired ? "광고 보고 다른 패턴 도전" : "다른 패턴 도전"} accessibilityRole="button" disabled={!retryAdPressable} style={[styles.replayButton,{flex:1},!retryAdPressable&&{opacity:0.55}]} onPress={() => handleRewardedRetry((snapshot.seed + 1) >>> 0)}><Text style={styles.replayText}>{retryRequired ? "광고 보고 다른 패턴" : "다른 패턴"}</Text></Pressable>:null}
            <Pressable accessibilityLabel="난이도 선택" accessibilityRole="button" disabled={waitingForForeground||retryAdState.phase==='showing'||stageAdState.phase==='showing'} style={[styles.replayButton,{flex:1}]} onPress={() => {
              if(adLeaseRef.current){
                (adLeaseRef.current.kind==='rewarded'?rewardedRetryAd:stageInterstitialAd).dispose();
                runtime.releaseAd(adLeaseRef.current);adLeaseRef.current=null;setAdResetVersion(value=>value+1);
              }
              runtime.cancelRetry();
              requestVersion.current++;clockRef.current.pause(); startedRef.current=false; pausedRef.current=false; resultsReadyRef.current=false; setStarted(false); setPaused(false); acceptedAt.current.clear(); setNotice(null);
              challengeRef.current=undefined;setRankNote('');setLevel(Math.min(level,progress.unlocked) as Level);
              sessionRef.current = new P0TenPunchSession(clockRef.current, getSurvivalMotionSourceIds(), {seed:snapshot.seed, ruleset:'candidate', maxHits:5,survivalLevel:level});
              setSnapshot(sessionRef.current.snapshot());
            }}><Text style={styles.replayText}>난이도 선택</Text></Pressable></View>
            {debugMode ? (
              <Pressable
                accessibilityLabel="REPLAY SEED"
                accessibilityRole="button"
                disabled={!retryAdPressable}
                onPress={() => handleRewardedRetry(snapshot.seed)}
                style={styles.replayButton}
              >
                <Text style={styles.replayText}>같은 공격으로 다시</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {started && !paused && !showResults ? <View pointerEvents="none" style={styles.canvasLabel}>
          <Text style={styles.canvasLabelText}>{`가드 ${'●'.repeat(snapshot.guardEnergy ?? 2)}${'○'.repeat(2-(snapshot.guardEnergy ?? 2))} · 회피로 회복`}</Text>
        </View> : null}
      </View>

      {started && !showResults ? <CoachReaction compact reaction={{
        mood: !paused && coachMoment ? coachMoment.mood : counts.PERFECT >= 6 ? 'surprised' : counts.PERFECT >= 3 ? 'interested' : 'smirk',
        line: !paused && coachMoment ? coachMoment.line : paused ? '쉬고 오게. 기다리지.' : '',
        note: '',
      }} /> : null}

      {debugMode ? <View style={styles.debugRow}>
        <Text style={styles.debugId}>{snapshot.currentAttack.attackInstanceId}</Text>
        <Text style={styles.debugInput}>SEED {snapshot.seed}</Text>
      </View> : null}
      {started && !showResults ? <View style={styles.controlsArea}>
        <DefenseControls
          key={`${snapshot.runId}:${started}:${paused}`}
          compact={compact}
          level={level}
          disabled={!started || paused || snapshot.sessionCompleted}
          onDefensePressIn={handleDefensePressIn}
          onDefensePressOut={() => undefined}
        />
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rematchFocus: { padding: 12, marginTop: 10, borderRadius: 12, backgroundColor: '#203435', gap: 5 },
  rematchTitle: { color: '#F3C969', fontSize: 14, fontWeight: '800' },
  rematchBody: { color: '#D1DEDA', fontSize: 12, lineHeight: 18 },
  rematchNote: { color: '#FFE2DB', fontSize: 10, lineHeight: 15 },
  introContent: { flexGrow: 1, padding: 12, gap: 9, justifyContent: 'flex-start' },
  introCompact: { padding: 14, gap: 10, justifyContent: 'flex-start' },
  introActions: { padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#243B4D' },
  smallPrint: { color: '#9DB0C1', fontSize: 12, lineHeight: 18 },
  hudTitle: { flex: 1, paddingRight: 8 },
  soundButton: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#172A3A' },
  soundText: { color: '#DCE8F1', fontSize: 12, fontWeight: '700' },
  resultContent: { paddingBottom: 10 },
  introCard: { ...StyleSheet.absoluteFillObject, zIndex: 12, backgroundColor: 'rgba(7,20,23,0.68)' },
  introEyebrow: { color: '#F3C969', fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  introTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  introBody: { color: '#E0E5D7', fontSize: 12, lineHeight: 19 },
  howTo: {gap: 6, paddingVertical: 4},
  introDirection: {color: '#F8EBCF', fontSize: 15, lineHeight: 23, fontWeight: '700'},
  beginButton: { minHeight: 44, backgroundColor: '#F3C969', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  beginText: { color: '#18202B', fontSize: 14, fontWeight: '800' },
  roundHint: { position: 'absolute', top: 16, left: 10, right: 10, textAlign: 'center', color: '#F3C969', fontSize: 13, fontWeight: '800' },
  pauseButton: { position: 'absolute', bottom: 8, right: 8, minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: '#142536', borderRadius: 8 },
  coach: { color: '#C3CFDA', fontSize: 13, lineHeight: 19, textAlign: 'center', marginVertical: 8 },
  screen: { flex: 1, gap: 6, backgroundColor: '#10262B' },
  hud: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F7FAFC', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  status: { marginTop: 4, color: '#9DB0C1', fontSize: 11, fontWeight: '600' },
  punchCount: { color: '#DCE8F1', fontSize: 11, fontWeight: '900' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 28, paddingHorizontal: 9, borderRadius: 99, borderWidth: 1, borderColor: '#35536B', backgroundColor: '#102333' },
  liveBadgeCue: { borderColor: '#E5484D', backgroundColor: '#3A1B24' },
  liveDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#56D68B' },
  liveDotCue: { backgroundColor: '#FF7A80' },
  liveText: { color: '#CFE8DA', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  levelButton: {flex:1,minHeight:40,alignItems:'center',justifyContent:'center',borderRadius:8},
  recordCard: {padding:10,backgroundColor:'#193532',borderRadius:10,gap:5,marginBottom:8},
  progressRow: { flexDirection: 'row', gap: 2, paddingHorizontal: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 99, backgroundColor: '#2A4052' },
  progressCurrent: { backgroundColor: '#FF7A80' },
  progressSafe: { backgroundColor: '#F3C969' },
  progressHit: { backgroundColor: '#FF7A80' },
  progressResolved: { backgroundColor: '#56D68B' },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, borderWidth: 3, borderColor: '#0A1518', backgroundColor: '#132433' },
  stageEvaded: { borderColor: '#56D68B' },
  stageHit: { borderColor: '#FF666D' },
  camera: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  hitFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 80, 86, 0.16)' },
  rope: { position: 'absolute', left: -16, right: -16, height: 4, borderRadius: 99, backgroundColor: '#8E343A', opacity: 0.72 },
  ropeTop: { top: '23%' },
  ropeMiddle: { top: '48%' },
  ropeBottom: { top: '73%' },
  cornerLeft: { position: 'absolute', left: 12, top: '16%', bottom: '12%', width: 10, borderRadius: 8, backgroundColor: '#273E51' },
  cornerRight: { position: 'absolute', right: 12, top: '16%', bottom: '12%', width: 10, borderRadius: 8, backgroundColor: '#273E51' },
  ceilingGlow: { position: 'absolute', top: -90, width: 260, height: 180, borderRadius: 130, backgroundColor: 'rgba(245, 217, 164, 0.13)' },
  resultCard: { ...StyleSheet.absoluteFillObject, zIndex: 10, padding: 14, gap: 8, backgroundColor: '#07111B' },
  resultHeading: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  textPerfect: { color: '#56D68B', fontSize: 12, fontWeight: '800' },
  textSafe: { color: '#F3C969', fontSize: 12, fontWeight: '800' },
  textHit: { color: '#FF7A80', fontSize: 12, fontWeight: '800' },
  resultList: { flex: 1, borderTopWidth: 1, borderTopColor: '#243B4D' },
  resultRow: { minHeight: 52, paddingVertical: 8, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#243B4D' },
  resultAttack: { color: '#DCE8F1', fontSize: 10, fontWeight: '900' },
  resultDetail: { marginTop: 3, color: '#AFBFCD', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  retryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E5484D' },
  retryPressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  adDisclosure: { color: '#AFBFCD', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  recordsAd: { marginTop: 16, marginBottom: 12 },
  replayButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#233A4D', borderRadius: 12 },
  replayText: { color: '#DCE8F1', fontSize: 13, fontWeight: '700' },
  canvasLabel: { position: 'absolute', left: 12, bottom: 10, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(7, 17, 27, 0.78)' },
  canvasLabelText: { color: '#B6C5D1', fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  debugRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  debugId: { color: '#607A8F', fontSize: 9, fontWeight: '700' },
  debugInput: { color: '#8AA0B4', fontSize: 9, fontWeight: '800' },
  controlsArea: { paddingTop: 0 },
});



