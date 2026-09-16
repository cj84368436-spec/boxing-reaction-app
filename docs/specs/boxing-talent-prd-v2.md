# 복싱 재능 알아보기 — PRD v2

**상태:** P0 개발 기준 확정본  
**플랫폼 목표:** 앱인토스(Toss Mini App)  
**화면:** 세로 9:16  
**제품 단계:** P0 Vertical Slice → P1 Gameplay MVP → P2 Measurement → P3 Monetization → P4 Growth

---

## 1. 제품 정의

상대 복서가 날리는 실제 복싱 기반 공격을 보고 순간적으로 피하거나 막으면서 **게임 기반 복싱 방어 감각**을 측정하고, 시큰둥하고 얄미운 베테랑 관장에게 평가받는 짧은 기록도전형 게임.

외부 제목은 **「복싱 재능 알아보기」**를 유지한다. 다만 제품 내부에서는 실제 복싱 재능 전체를 측정한다고 주장하지 않는다.

실제 측정 구성요소:
- 시각적 공격 판별
- 선택반응
- 방어 선택
- 연속 대응
- 입력 통제

향후 검증해야 할 핵심 질문:
> 복싱 경험자가 비경험자보다 유의하게 높은 게임 점수를 받는가?

그렇지 않다면 “복싱 재능”이라는 서사의 타당성을 재검토한다.

---

## 2. 핵심 사용자 루프

1. 관장이 사용자를 대수롭지 않게 본다.
2. 사용자가 상대 펀치를 보고 피하거나 막는다.
3. 성공/피격의 손맛을 즉시 느낀다.
4. 결과에서 점수와 관장 평가를 받는다.
5. “한 번 더 하면 더 잘할 수 있다”는 감정으로 재도전한다.
6. 고득점에서는 관장의 태도가 변한다.

핵심 감정 목표:
- 낮은 점수: “열받네. 다시 해본다.”
- 중간 점수: “조금만 하면 더 올라가는데?”
- 높은 점수: “이건 공유하고 싶다.”

---

## 3. 관장 캐릭터

### 정의
낡은 동네 복싱체육관의 베테랑 관장. 사용자를 기본적으로 얕보고 기대하지 않지만 실력은 정확하게 알아본다.

### 배치
- 링 밖 오른쪽 뒤 코너
- 기본 팔짱
- 플레이 중 보조 캐릭터
- 결과 화면에서는 메인 평가자

### 감정 단계
1. 무관심
2. 비꼼
3. 흥미
4. 진지한 관찰
5. 체면이 무너진 놀람

대표 대사:
- “그걸 맞나?”
- “자네는… 그냥 돌아가게.”
- “……어?”
- “다시 해보게.”
- “.....홀뤼....”
- “제발 복싱계의 빛이 되어주게!!”

관장 대사/표정은 공격 cue와 겹치지 않는 안전구간에서만 발생한다.

---

## 4. 시점 및 조작

### 시점
1인칭.

### MVP 4버튼
- LEFT
- RIGHT
- BACK
- GUARD

좌/우 버튼의 의미는 기술명이 아니라 **방어가 끝났을 때 머리가 위치하는 최종 공간 방향**이다.

- 직선 공격 + LEFT/RIGHT → 슬립 애니메이션
- 훅 + LEFT/RIGHT → 해당 방향으로 종료되는 위빙/롤
- BACK → 거리 빼기
- GUARD → 공격 위치에 맞는 블록

### 후속 필수 기능
6버튼 고급모드는 반드시 추가한다.
- 좌 슬립
- 우 슬립
- 좌 위빙
- 우 위빙
- 스웨이
- 가드

P0/P1의 4버튼은 초보 진입용이고, 6버튼은 복싱 기술 선택 자체를 평가하는 고급모드다.

---

## 5. 복싱 원리와 게임 판정 철학

실제 복싱에서는 하나의 공격에 여러 방어가 가능하므로 게임도 단일 정답 퀴즈로 만들지 않는다.

P1 목표 판정:
- PERFECT
- GOOD
- SAFE
- HIT

P0에서는 손맛 검증을 위해:
- PERFECT
- SAFE
- HIT

3단계만 사용한다.

### 훅 canonical 판정
기본 정면·중거리 상황에서:
- 상대 리드(왼손) 훅 → 플레이어 RIGHT 위빙을 canonical PERFECT로 둔다.
- 상대 리어(오른손) 훅 → 플레이어 LEFT 위빙을 canonical PERFECT로 확장 예정.

이는 복싱의 절대 법칙이 아니라 **현재 게임 상황의 대표 최적 방어**다. 다른 방어는 실제 애니메이션 궤적/거리 조건에 따라 판정한다.

### 가드
가드는 실제로 방어 가능한 공격을 억지로 HIT 처리하지 않는다.
생존에는 강하지만 최적 회피보다 낮은 DefenseQuality를 주어 고득점에 불리하게 만든다.

가드 피로도/가드 브레이크는 P0에 넣지 않는다.

---

## 6. Attack 데이터 모델

내부 공격은 다음처럼 정규화한다.

```text
HAND
LEAD / REAR

PUNCH_TYPE
JAB / STRAIGHT / HOOK / UPPERCUT

TARGET
HEAD / BODY
```

공격 객체는 최소 다음 필드를 가진다.

```text
attackId
hand
punchType
target
animationId
cueAnchorMs
impactMs
responseWindowStartMs
responseWindowEndMs
speedTier
defenseMatrix
```

P0에서는:
- LEAD + JAB + HEAD
- REAR + STRAIGHT + HEAD
- LEAD + HOOK + HEAD

세 공격만 사용한다.

---

## 7. 타이밍 모델

`reactionCueTime`처럼 “사람이 실제로 알아차린 순간”을 가정하지 않는다.

### cueAnchor
개발자가 공격의 판별 단서가 명확히 표현되는 기준 프레임/시간으로 지정한 시점.

### impactTime
방어하지 않으면 펀치가 플레이어에게 도달하는 시점.

### responseWindowStart / End
정상 방어 입력을 받아들이는 범위.

반응시간은 기기 로컬 monotonic clock 기준으로 계산한다.
서버 왕복시간은 절대 판정에 사용하지 않는다.

### P0 Run Schedule

P0의 콤보 내부 공격 시작 시각은 각 콤보 시작을 0ms로 둔
`attackStartOffsetsMs`로 정의한다. 모든 내부 attack-start interval은 650ms다.

| comboId | attackStartOffsetsMs | recoveryAfterMs |
| :--- | :--- | ---: |
| `single-jab` | `[0]` | 700 |
| `single-straight` | `[0]` | 700 |
| `single-hook` | `[0]` | 850 |
| `double-jab-straight` | `[0, 650]` | 900 |
| `double-jab-hook` | `[0, 650]` | 900 |
| `triple-jab-straight-hook` | `[0, 650, 1300]` | 1000 |

- `attackStartOffsetsMs`는 콤보 내부 공격 시작 간격이다.
- `recoveryAfterMs`는 마지막 공격 impact로 정의되는 comboEnd 이후의 간격이다.
- 다음 콤보는 `comboEnd + recoveryAfterMs`에 시작한다.
- 마지막 콤보의 `recoveryAfterMs`는 결과 공개 전 최종 판정 유지 구간으로 사용한다.
- `visualRecoveryMs`와 animation completion은 Run Schedule 계산에 사용하지 않는다.

현재 값으로 countdown부터 마지막 recovery 종료까지 계산한 P0 runtime은 14,070ms다.
이는 canonical schedule 기록값이며 15~20초 UX 목표를 hard engine invariant로 만들지 않는다.
실제 playable/device QA 후에는 internal 650ms cadence가 아니라 `recoveryAfterMs`를 우선 튜닝한다.

---

## 8. 입력 엔진

### InputStatus
- VALID
- EARLY
- LATE
- MULTI_INPUT
- NO_INPUT

### DefenseOutcome
- PERFECT
- SAFE
- HIT

입력 상태와 방어 품질은 서로 다른 축이다.

### 연타 Input Buffer
이전 방어가 성공한 직후 다음 공격 cue 직전의 정상 선입력을 허용한다.

P0 초기 실험값:
- pre-cue buffer: 100ms
- 동시입력 탐지: 35ms

두 값 모두 제품 기준이 아니라 실기기 튜닝 시작값이다.

정상 연속 회피를 EARLY/난사로 오판해서는 안 된다.

P0의 다음 공격 pre-cue buffer 시작 시각은 다음과 같이 계산한다.

```text
nextBufferStart = nextAttackStart + next.cueAnchorMs - preCueBufferMs
```

모든 인접 공격에서 `nextBufferStart`는 이전 공격의 response window 종료보다 늦고,
이전 공격 impact와 같거나 늦어야 한다. Buffer 경계 입력은 현재 공격의 resolved 상태와
관계없이 다음 `targetAttackInstanceId`로 귀속되어야 한다.

`MULTI_INPUT`은 두 입력이 모두 VALID이고 동일한 `targetAttackInstanceId`에 귀속된 경우에만
35ms 동시입력 검사를 수행한다. 이전 공격 입력이나 EARLY/LATE/NO_INPUT은 다음 공격의
`MULTI_INPUT` 후보가 될 수 없다.

---

## 9. 실제 복싱 콤비네이션

P1부터 완전 랜덤 생성 대신 실제 복싱에서 쓰이는 검증 Combo Library를 사용한다.

예시:
- 더블잽
- 잽 → 스트레이트
- 잽 → 리드훅
- 리드 바디훅 → 리드 헤드훅(Double Hook)
- 잽 → 스트레이트 → 리드훅
- 헤드↔바디 레벨 체인지
- 더블바디 → 더블훅 계열

데이터에서는 “바디”처럼 모호하게 저장하지 않고 손 + 펀치 종류 + 타깃을 명시한다.

P0에서는 비교 가능성을 위해 고정된 10펀치 시퀀스를 사용한다.

---

## 10. 테스트 시간

MVP 기본 가설은 30초지만 하드코딩하지 않는다.

향후:
- 30초
- 45초
- 60초

프로파일로 바꿀 수 있어야 한다.

시간만이 아니라:
- targetPunchCount
- targetComboCount

도 관리해야 한다.

P0는 재미 검증이 목적이므로 UX 목표는 15~20초다. 이 범위는 현재 hard engine invariant가
아니며, 실제 playable/device QA 결과에 따라 콤보 사이 `recoveryAfterMs`를 조정한다.

---

## 11. 시험 공정성

P1/P2에서 자유 랜덤보다 **통제된 동형 시험 세트**를 우선한다.

세트별로 다음을 유사하게 맞춘다.
- 총 펀치 수
- 단발/2연타/3연타/4연타 수
- 직선/훅/바디 비율
- LEFT/RIGHT/BACK/GUARD 기대 사용량
- 속도 tier

`DifficultyBudget`이라는 추상적 숫자 하나만으로 동등성을 주장하지 않는다.

---

## 12. 최종 점수 방향

기존의 40/35/20/5 단순 합산은 같은 행동을 중복 계산할 위험이 있어 폐기한다.

P1/P2 방향:

```text
EventScore = DefenseQuality × ReactionFactor
```

각 펀치 EventScore를 기본으로 집계하고:
- 연타에서의 성능 저하
- EARLY/난사
- 최소 유효 이벤트 수

등을 소규모 보정한다.

결과 화면의:
- 반응속도
- 방어 판단력
- 연속 대응력

은 최종점수의 독립 배점이 아니라 **진단지표**로 본다.

P0에서는 임시로:
- PERFECT = 2
- SAFE = 1
- HIT = 0

만 사용한다.

---

## 13. 반응속도 표시

“실제 신경학적 반응속도”라고 표현하지 않는다.

표현:
> 게임 측정 반응속도

단일 최고값은 예측 입력/이상치 영향을 받으므로 기록 지표로 사용하지 않는다.
P2에서는 run-level 중앙반응시간 등 안정적인 지표를 검토한다.

기기별 레이턴시 보정값을 임의로 만들지 않는다. 먼저 실제 중급 Android / 플래그십 Android / iPhone에서 편향을 측정한다.

---

## 14. 백분위

P2 이전에는 구현하지 않는다.

서버 데이터가 충분하지 않을 때 가상의 사용자 분포를 실제 통계처럼 표시하지 않는다.

가능한 표시:
- 사전 테스트 참가자 기준 상위 X%
- 데이터 수집 중

사용자 기록은 최소:
- firstValidScore — 측정/연구용
- bestScore — 게임 경쟁용

으로 분리한다.

BEST 기반 백분위는 명칭도 “개인 최고기록 기준 상위 X%”처럼 정확히 표시한다.

---

## 15. 광고

P3에서 다룬다.

제품 가설:
- 첫 플레이 무료
- 재도전 일부 무료
- 이후 사용자가 명시적으로 선택하는 리워드 광고 기반 추가 기회 검토

정확한 무료 횟수는 코어 재도전율을 먼저 측정한 뒤 결정한다.

출시 직전 최신 앱인토스 광고 정책을 공식 문서로 다시 확인한다.

---

## 16. 비주얼

방향:
> 세미카툰 + 복싱 만화적 과장 + 모바일 가독성 우선

상대 복서는 공격 가독성 중심.
관장은 캐릭터성 중심.

관장은 특정 기존 작품 캐릭터를 복제하지 않고 “노련하고 얄미운 동네 복싱 관장” archetype을 독자적으로 만든다.

피격 연출:
- 짧은 흔들림
- 타격음
- 짧은 flash/blur

다음 cue를 가릴 정도의 긴 stun은 금지한다.

---

## 16-A. 상대 복서 Motion Pipeline

### 계층 구분

| 계층 | 역할 | 변경 권한 |
| :--- | :--- | :--- |
| CMU Motion Source | 인체 운동학 원천 데이터 | 변경 시 사용자 승인 + 검증 |
| Game Canonical Timing | cueAnchorMs / impactMs / responseWindow | 변경 불가. motion이 여기에 retiming됨 |
| Visual Presentation Layer | character rig retarget + 시각 연출 | 원본 motion 보존 조건으로 제한적 허용 |

Motion source가 game timing을 결정하지 않는다. game canonical timing에 motion이 맞춰진다.

### 원칙

- CMU Motion Capture Database를 motion source로 사용한다.
- 19관절(pelvis, spine, chest, neck, head, 양팔 3관절, 양다리 4관절) world-space XYZ를 source로 보존한다.
- Forward Kinematics는 ASF axis 및 AMC dof를 정확히 반영한다.
- 원본 19관절 motion dataset은 반드시 보존한다.
- 무단 smoothing은 금지한다. smoothing이 필요하면 원본과 분리된 post-process 단계로 적용하고, joint·방법·파라미터를 기록하며 사용자 승인을 받는다.
- character rig retarget 과정에서 캐릭터 비율 조정은 허용된다.
- cue 가독성이나 가드 형태 개선을 위한 post-process가 필요하면 원본 motion과 분리하고 사용자 승인 후 적용한다.
- game canonical timing(cueAnchorMs, impactMs)은 post-process로도 변경하지 않는다.
- glove depth 과장은 최소화한다. 1.5x를 초과하는 배율을 사전 승인 없이 사용하지 않는다.
- 실제 게임 그래픽은 이 motion source 위에 boxer character rig를 retarget하여 구현한다.
- P0의 650ms cadence에서는 다음 공격이 이전 공격의 visual recovery 완료 전에 시작할 수 있다.
- 공격 사이 pose handoff/transition은 presentation layer 책임이며 canonical schedule을 지연시키지 않는다.
- visual recovery 완료 대기, animation completion 기반 GameClock 진행, pose transition을 이유로 한 650ms cadence 변경을 금지한다.

### P0 공식 Motion Source

CMU MoCap 원본 ASF/AMC는 Git에 포함하지 않는다.
`tools/mocap/motion-sources.json`에 subject/trial/URL이 기록되어 있으며
`tools/mocap/rebuild-motion-assets.mjs`로 언제든 재생성 가능하다.

| 공격 | CMU Subject / Trial | Frame 구간 | 정식 Asset |
| :--- | :--- | :--- | :--- |
| Lead Jab (LEAD_JAB_HEAD) | 144 / 13 | 1076–1156 | `src/game/assets/motion/lead-jab.json` |
| Rear Straight (REAR_STRAIGHT_HEAD) | 144 / 20 | 470–540 | `src/game/assets/motion/rear-straight.json` |
| Lead Hook (LEAD_HOOK_HEAD) | 14 / 01 | 244–315 | `src/game/assets/motion/lead-hook.json` |

### Animation Source Anchor

아래 표는 **animation source anchor**이며 game canonical timing과는 별개의 개념이다.
`visualRecovery`의 ms 값은 게임 판정 timing이 아니라 시각적 복귀 기준점(non-canonical)이다.
`p0Sequence`의 `recoveryAfterMs`(콤보 간격)와도 다른 개념이다.
따라서 source frame 구간의 마지막 프레임과 Visual Recovery 프레임은 같을 필요가 없다.

| 공격 | Ready | Visual Cue | Visual Impact | Visual Recovery (non-canonical) |
| :--- | :--- | :--- | :--- | :--- |
| Lead Jab | Frame 1076 / 0ms | Frame 1092 / 120ms | Frame 1116 / 480ms | Frame 1156 / 760ms |
| Rear Straight | Frame 470 / 0ms | Frame 484 / 150ms | Frame 505 / 540ms | Frame 538 / 820ms |
| Lead Hook | Frame 244 / 0ms | Frame 256 / 190ms | Frame 275 / 620ms | Frame 314 / 900ms |

Visual Cue / Visual Impact의 timeMs는 각 공격의 canonical `cueAnchorMs` / `impactMs`와
piecewise linear retiming으로 연결된다.

---

## 17. 홀뤼

대표 시그니처 리액션:
> “.....홀뤼....”

P0에서는 사용하지 않는다.

P1 이후 후보 조건:
- 고등급
- 피날레 콤보 완벽 방어

정확한 발생률은 플레이데이터로 조정한다. 임의로 “상위 3~5%에게 반드시 노출” 같은 목표는 두지 않는다.

---

## 18. 단계별 개발

### P0 Vertical Slice
- 잽 / 스트레이트 / 왼훅
- 4버튼
- 단발 / 2연타 / 3연타
- 15~20초
- 로컬 판정/점수
- 관장 최소 반응
- telemetry

검증 질문:
> 펀치를 보고 피하는 순간 자체가 재미있는가?

### P1 Gameplay MVP
- 오른훅
- 어퍼
- 바디 공격
- 실제 Combo Library
- 4연타
- 30초 configurable
- GOOD
- EventScore
- 관장 5단계
- BEST

### P2 Measurement
- playerHash
- 서버 검증
- 동형 시험 세트
- firstValidScore / bestScore
- 백분위

### P3 Monetization
- 광고

### P4 Growth
- 공유
- 친구 도전

### 후속 필수
- 6버튼 고급모드

---

## 19. P0 Go / No-Go

P1로 넘어가기 전 확인:
1. 대부분 공격을 구분 가능한가?
2. 정상 입력인데 HIT된다는 불만이 드문가?
3. 성공 시 실제 피한 느낌이 있는가?
4. 2~3연타가 단발보다 재미있는가?
5. 즉시 자발적 재도전이 충분히 발생하는가?

내부 초기 가설:
> 자발적 즉시 재도전율 60% 이상

60%는 외부 벤치마크가 아니라 제품 판단용 가설이다.

---

## 20. 참고 문서

복싱 방어/콤비네이션은 개발 중 공식/코칭 자료를 재검증한다.

- Boxing Canada Competition Introduction Manual  
  https://boxingcanada.org/wp-content/uploads/2025/06/Competition-Introduction-manual-EN.pdf
- England Boxing 코칭 자료  
  https://www.englandboxing.org/

앱인토스 관련 요구사항은 구현/출시 직전에 최신 공식 문서를 다시 확인한다.

- React Native  
  https://developers-apps-in-toss.toss.im/tutorials/react-native.html
- 게임 출시 체크리스트  
  https://developers-apps-in-toss.toss.im/checklist/app-game.html
