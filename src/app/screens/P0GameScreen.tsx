import { useSafeAreaInsets } from '@granite-js/native/react-native-safe-area-context';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GameClock } from '../../game/engine/GameClock';
import type { DefenseInput } from '../../game/model/types';
import { createCanonicalGameClock } from '../canonicalEngineImports';
import { BoxerRig } from '../components/BoxerRig';
import { CoachReaction } from '../components/CoachReaction';
import { getCoachMoment, getRematchReview } from '../motion/coachPresentation';
import { candidateFailureReason } from '../session/candidateRules';
import { COACH_INTRO } from '../motion/boxingArtwork';
import { DefenseControls } from '../components/DefenseControls';
import { type DefenseControlMode } from '../session/advancedDefense';
import {
  TemporarySfxPlayer,
  type PlaytestSoundCue,
} from '../components/TemporarySfxPlayer';
import { getP0MotionAsset, getP0MotionSourceIds } from '../motion/p0MotionRegistry';
import { getFirstPersonFrame } from '../motion/firstPersonPresentation';
import { RoundClock, ROUND_SPEEDS } from '../session/RoundClock';
import {
  P0TenPunchSession,
  type TenPunchSessionResult,
  type TenPunchSessionSnapshot,
} from '../session/P0TenPunchSession';

interface P0GameScreenProps {
  readonly clock?: GameClock;
  readonly readyLeadInMs?: number;
  readonly seed?: number;
  readonly debugMode?: boolean;
}

const TOTAL_PUNCHES = 10;
// SDK 2.x TopTransparentNavigation overlays a 44-point row below the safe area.
const HOST_NAVIGATION_HEIGHT = 44;
const MOTION_ASSETS = Object.fromEntries(Object.keys(getP0MotionSourceIds()).map(id => [id, getP0MotionAsset(id)]));
const INPUT_LABELS: Record<DefenseInput, string> = {
  LEFT:'왼쪽 회피', RIGHT:'오른쪽 회피', BACK:'뒤로 피하기', GUARD:'가드',
  SLIP_LEFT:'좌 슬립', SLIP_RIGHT:'우 슬립', WEAVE_LEFT:'좌 위빙',
  WEAVE_RIGHT:'우 위빙', SWAY:'스웨이',
};

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

function attackLabel(attackId: string): string {
  if (attackId === 'LEAD_JAB_HEAD') return '잽';
  if (attackId === 'REAR_STRAIGHT_HEAD') return '스트레이트';
  return '훅';
}

function resultDescription(result: TenPunchSessionResult): string {
  const button = result.telemetry.inputButton;
  const input = button == null ? '입력 없음' : INPUT_LABELS[button];
  const reason = result.outcome === 'PERFECT' ? '완벽하게 피함' : result.outcome === 'SAFE' ? '안전하게 방어' :
    result.telemetry.inputStatus === 'VALID' ? candidateFailureReason(result.attackId,button) :
    ({NO_INPUT:'누르지 않아 맞음', EARLY:'너무 일찍 누름', LATE:'늦게 누름', MULTI_INPUT:'버튼을 동시에 누름'} as Record<string,string>)[result.telemetry.inputStatus] ?? '방어 실패';
  return `${input} · ${reason}`;
}

export function P0GameScreen({
  clock,
  readyLeadInMs = 2000,
  seed,
  debugMode = false,
}: P0GameScreenProps) {
  const safeArea = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const [roundClock] = useState(() => new RoundClock(clock ?? createCanonicalGameClock()));
  const clockRef = useRef(roundClock);
  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const resultsReadyRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [foreground, setForeground] = useState(true);
  const [speed, setSpeed] = useState<number>(ROUND_SPEEDS.relaxed);
  const [controlMode, setControlMode] = useState<DefenseControlMode>('BEGINNER');
  const [notice, setNotice] = useState<{text: string; until: number} | null>(null);
  const [initialSession] = useState(() =>
    new P0TenPunchSession(roundClock, getP0MotionSourceIds(), {
      ruleset: 'candidate',
      controlMode,
      ...(seed == null ? {} : { seed }),
    }),
  );
  const sessionRef = useRef(initialSession);
  const [snapshot, setSnapshot] = useState(() => sessionRef.current.snapshot());
  const acceptedAt = useRef(new Map<string, number>());
  const latestResult = snapshot.latestResult;
  const showResults = snapshot.sessionCompleted && latestResult != null &&
    snapshot.nowMs - latestResult.telemetry.impactScheduledAtMs >= 280;
  resultsReadyRef.current = showResults;

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
      setForeground(state === 'active');
      if (state !== 'active') pauseRound();
    });
    // Android's notification shade can take focus without changing AppState.
    const blur = AppState.addEventListener('blur', () => { setForeground(false); pauseRound(); });
    const focus = AppState.addEventListener('focus', () => setForeground(true));
    return () => { subscription.remove(); blur.remove(); focus.remove(); };
  }, [pauseRound]);

  const selectControlMode = (mode: DefenseControlMode) => {
    if (startedRef.current) return;
    setControlMode(mode);
    sessionRef.current = new P0TenPunchSession(clockRef.current, getP0MotionSourceIds(), {
      ruleset: 'candidate', controlMode: mode, ...(seed == null ? {} : { seed }),
    });
    setSnapshot(sessionRef.current.snapshot());
  };

  const begin = (rate: number) => {
    if (startedRef.current) return;
    startedRef.current = true;
    pausedRef.current = false;
    resultsReadyRef.current = false;
    clockRef.current.start(rate); setSpeed(rate);
    sessionRef.current.start({ leadInMs: readyLeadInMs * rate });
    startedRef.current = true; setStarted(true);
    setSnapshot(sessionRef.current.tick());
  };

  const frame = useMemo(
    () => getFirstPersonFrame(snapshot, MOTION_ASSETS, acceptedAt.current),
    [snapshot],
  );
  const coachMoment = getCoachMoment(snapshot);
  const rematch = getRematchReview(snapshot.results, speed, true);
  const recognized = showResults && snapshot.results.every(r=>r.outcome !== 'HIT') && snapshot.results.filter(r=>r.outcome === 'PERFECT').length >= 8;
  const soundCue: PlaytestSoundCue | undefined = recognized ? {id:snapshot.runId + ':recognition', sound:'recognition'} : latestResult == null ? undefined : soundFor(latestResult);
  const hitVisible = frame.hit;
  const windowOpen = isDefenseWindowOpen(snapshot);
  const counts = snapshot.results.reduce(
    (summary, result) => ({ ...summary, [result.outcome]: summary[result.outcome] + 1 }),
    { PERFECT: 0, SAFE: 0, HIT: 0 },
  );

  const handleDefensePressIn = (input: DefenseInput) => {
    if (!startedRef.current || pausedRef.current || sessionRef.current.tick().sessionCompleted) return;
    const receipt = sessionRef.current.handleInput(input);
    if (receipt.status === 'VALID' && !acceptedAt.current.has(receipt.targetAttackInstanceId)) {
      acceptedAt.current.set(receipt.targetAttackInstanceId, receipt.atMs);
    }
    if (receipt.status === 'VALID') setNotice({text: INPUT_LABELS[receipt.input] + ' · 동작 중', until:clockRef.current.nowMs()+160});
    if (receipt.status !== 'VALID') setNotice({text: receipt.status === 'EARLY' ? '너무 빠름 · 복귀 뒤 다시 입력' : receipt.status === 'LATE' ? '조금 더 일찍 눌러보세요' : '버튼 하나만 눌러주세요', until:clockRef.current.nowMs()+200});
    setSnapshot(sessionRef.current.snapshot());
  };

  const handleRetry = (retrySeed?: number) => {
    if (!sessionRef.current.snapshot().sessionCompleted) return;
    resultsReadyRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    clockRef.current.resume();
    acceptedAt.current.clear();
    setNotice(null);
    sessionRef.current.retry({
      leadInMs: Math.min(800, readyLeadInMs) * speed,
      ...(retrySeed == null ? {} : { seed: retrySeed }),
    });
    setSnapshot(sessionRef.current.snapshot());
  };

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
      <TemporarySfxPlayer cue={soundCue} enabled={soundEnabled && foreground && !paused && (!showResults || recognized)} />

      <View style={styles.hud}>
        <View style={styles.hudTitle}>
          <Text style={styles.title}>복싱 10타 챌린지</Text>
          <Text style={styles.status}>주먹을 읽고, 한 번씩 피하세요</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.punchCount}>{snapshot.results.length} / {TOTAL_PUNCHES}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={soundEnabled ? '소리 끄기' : '소리 켜기'} style={styles.soundButton} onPress={() => setSoundEnabled(value => !value)}>
            <Text style={styles.soundText}>{soundEnabled ? '소리 켜짐' : '소리 꺼짐'}</Text>
          </Pressable>
        </View>
      </View>
          <View style={[styles.liveBadge, debugMode && windowOpen && styles.liveBadgeCue]}>
            <View style={[styles.liveDot, debugMode && windowOpen && styles.liveDotCue]} />
            <Text numberOfLines={1} style={styles.liveText}>{!started ? '공격마다 버튼 한 번' : paused ? '일시 정지' : showResults ? '라운드 완료' : debugMode ? statusFor(snapshot) : notice && snapshot.nowMs < notice.until ? notice.text : frame.feedback || '주먹을 보세요'}</Text>
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
        <View style={[styles.rope, styles.ropeTop]} />
        <View style={[styles.rope, styles.ropeMiddle]} />
        <View style={[styles.rope, styles.ropeBottom]} />
        <View style={styles.cornerLeft} />
        <View style={styles.cornerRight} />
        <View style={styles.ceilingGlow} />
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
        {!started ? (
          <View style={styles.introCard}>
          <ScrollView contentContainerStyle={[styles.introContent, compact && styles.introCompact]}>
            <CoachReaction reaction={COACH_INTRO} />
            <Text style={styles.introTitle}>주먹을 보고, 피하세요.</Text>
            <Text style={styles.introBody}>{controlMode === 'ADVANCED'
              ? <>기술을 직접 골라 방어하세요.{"\n"}잽은 좌우 슬립, 뒷손 스트레이트는 좌 슬립.{"\n"}리드 훅은 우 위빙이 정확합니다.</>
              : <>화면 아래 버튼을 눌러 피하세요.{"\n"}짧은 잽은 좌우, 어깨를 젖히는 뒷손은 왼쪽.{"\n"}팔을 벌려 옆으로 오는 훅은 오른쪽으로 숙이세요.</>}</Text>
            <Text style={styles.introBody}>가드는 두 번, 회피하면 한 칸 회복.{"\n"}스트레이트는 뒤로 빠져도 닿아요.</Text>
          </ScrollView>
          <View style={styles.introActions}>
            <View style={styles.modeRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="초보 4버튼" accessibilityState={{selected:controlMode==='BEGINNER'}} style={[styles.modeButton, controlMode==='BEGINNER' && styles.modeButtonSelected]} onPress={() => selectControlMode('BEGINNER')}><Text style={styles.modeText}>초보 4버튼</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="고급 6버튼" accessibilityState={{selected:controlMode==='ADVANCED'}} style={[styles.modeButton, controlMode==='ADVANCED' && styles.modeButtonSelected]} onPress={() => selectControlMode('ADVANCED')}><Text style={styles.modeText}>고급 6버튼</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="여유 있게 시작" style={styles.beginButton} onPress={() => begin(ROUND_SPEEDS.relaxed)}><Text style={styles.beginText}>여유 있게 시작</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="원래 속도로 도전" style={styles.replayButton} onPress={() => begin(ROUND_SPEEDS.original)}><Text style={styles.replayText}>원래 속도로 도전</Text></Pressable>
            <Text style={styles.smallPrint}>회피는 한 동작씩. 너무 빠르면 복귀 뒤 다시 누르세요.</Text>
          </View></View>
        ) : null}
        {paused ? (
          <ScrollView style={styles.introCard} contentContainerStyle={styles.introContent}><Text style={styles.introTitle}>잠시 쉬어갑니다</Text><Text style={styles.introBody}>멈춘 순간부터 이어집니다.{"\n"}준비되면 계속하기를 눌러주세요.</Text><Pressable accessibilityRole="button" accessibilityLabel="계속하기" style={styles.beginButton} onPress={() => {pausedRef.current=false; clockRef.current.resume(); setPaused(false);}}><Text style={styles.beginText}>계속하기</Text></Pressable></ScrollView>
        ) : started && !snapshot.sessionCompleted ? (
          <Pressable accessibilityRole="button" accessibilityLabel="일시 정지" style={styles.pauseButton} onPress={pauseRound}><Text style={styles.replayText}>Ⅱ 정지</Text></Pressable>
        ) : null}
        {showResults ? (
          <View style={styles.resultCard}>
            <ScrollView style={styles.resultList} contentContainerStyle={styles.resultContent}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.resultHeading}>{counts.PERFECT + counts.SAFE} / 10 방어 성공</Text>
            <CoachReaction compact={compact} reaction={rematch.reaction} />
            <View testID="rematch-focus" style={styles.rematchFocus}>
              <Text style={styles.rematchTitle}>{rematch.focusTitle}</Text>
              <Text style={styles.rematchBody}>{rematch.focusBody}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text testID="summary-perfect" style={styles.textPerfect}>완벽 회피 {counts.PERFECT}</Text>
              <Text testID="summary-safe" style={styles.textSafe}>안전 방어 {counts.SAFE}</Text>
              <Text testID="summary-hit" style={styles.textHit}>피격 {counts.HIT}</Text>
            </View>
              {snapshot.results.map((result) => (
                <View key={result.attackInstanceId} testID={`result-${result.attackIndex}`} style={styles.resultRow}>
                  <Text style={[styles.resultAttack, result.outcome === 'PERFECT' ? styles.textPerfect : result.outcome === 'SAFE' ? styles.textSafe : styles.textHit]}>#{result.attackIndex + 1} {attackLabel(result.attackId)}</Text>
                  <Text style={styles.resultDetail}>
                    {resultDescription(result)}{debugMode ? ` · ${result.telemetry.inputStatus} · ${result.telemetry.reactionMs == null ? '—' : Math.round(result.telemetry.reactionMs / speed)} ms` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              accessibilityLabel="다시 도전"
              accessibilityRole="button"
              onPress={() => handleRetry(rematch.replaySameSeed ? snapshot.seed : (snapshot.seed + 1) >>> 0)}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
            >
              <Text style={styles.retryText}>{rematch.retryLabel}</Text>
              <Text style={styles.rematchNote}>{rematch.retryNote}</Text>
            </Pressable>
            <Pressable accessibilityLabel="다른 패턴 도전" accessibilityRole="button" style={styles.replayButton} onPress={() => handleRetry((snapshot.seed + 1) >>> 0)}><Text style={styles.replayText}>다른 패턴 도전</Text></Pressable>
            <Pressable accessibilityLabel="속도 다시 선택" accessibilityRole="button" style={styles.replayButton} onPress={() => {
              clockRef.current.pause(); startedRef.current=false; pausedRef.current=false; resultsReadyRef.current=false; setStarted(false); setPaused(false); acceptedAt.current.clear(); setNotice(null);
              sessionRef.current = new P0TenPunchSession(clockRef.current, getP0MotionSourceIds(), {seed:snapshot.seed, ruleset:'candidate', controlMode});
              setSnapshot(sessionRef.current.snapshot());
            }}><Text style={styles.replayText}>속도 다시 선택</Text></Pressable>
            {debugMode ? (
              <Pressable
                accessibilityLabel="REPLAY SEED"
                accessibilityRole="button"
                onPress={() => handleRetry(snapshot.seed)}
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
          mode={controlMode}
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
  introContent: { flexGrow: 1, padding: 20, gap: 14, justifyContent: 'center' },
  introCompact: { padding: 14, gap: 10, justifyContent: 'flex-start' },
  introActions: { padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#243B4D' },
  smallPrint: { color: '#9DB0C1', fontSize: 12, lineHeight: 18 },
  hudTitle: { flex: 1, paddingRight: 8 },
  soundButton: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#172A3A' },
  soundText: { color: '#DCE8F1', fontSize: 12, fontWeight: '700' },
  resultContent: { paddingBottom: 10 },
  introCard: { ...StyleSheet.absoluteFillObject, zIndex: 12, backgroundColor: 'rgba(7,17,27,0.96)' },
  introEyebrow: { color: '#F3C969', fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  introTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  introBody: { color: '#C3CFDA', fontSize: 14, lineHeight: 22 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: '#52677A', borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172A3A' },
  modeButtonSelected: { borderColor: '#F3C969', backgroundColor: '#3B3522' },
  modeText: { color: '#F7FAFC', fontSize: 13, fontWeight: '800' },
  beginButton: { minHeight: 44, backgroundColor: '#F3C969', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  beginText: { color: '#18202B', fontSize: 14, fontWeight: '800' },
  roundHint: { position: 'absolute', top: 16, left: 10, right: 10, textAlign: 'center', color: '#F3C969', fontSize: 13, fontWeight: '800' },
  pauseButton: { position: 'absolute', bottom: 8, right: 8, minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: '#142536', borderRadius: 8 },
  coach: { color: '#C3CFDA', fontSize: 13, lineHeight: 19, textAlign: 'center', marginVertical: 8 },
  screen: { flex: 1, gap: 8, backgroundColor: '#07111B' },
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
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 99, backgroundColor: '#2A4052' },
  progressCurrent: { backgroundColor: '#FF7A80' },
  progressSafe: { backgroundColor: '#F3C969' },
  progressHit: { backgroundColor: '#FF7A80' },
  progressResolved: { backgroundColor: '#56D68B' },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#2A4052', backgroundColor: '#132433' },
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
  replayButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#233A4D', borderRadius: 12 },
  replayText: { color: '#DCE8F1', fontSize: 13, fontWeight: '700' },
  canvasLabel: { position: 'absolute', left: 12, bottom: 10, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(7, 17, 27, 0.78)' },
  canvasLabelText: { color: '#B6C5D1', fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  debugRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  debugId: { color: '#607A8F', fontSize: 9, fontWeight: '700' },
  debugInput: { color: '#8AA0B4', fontSize: 9, fontWeight: '800' },
  controlsArea: { paddingTop: 0 },
});
