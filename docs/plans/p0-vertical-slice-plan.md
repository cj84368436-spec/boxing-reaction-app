# 복싱 재능 알아보기 — P0 Vertical Slice 구현 계획

## 목표

15~20초짜리 최소 플레이에서 **“상대 펀치를 보고 피하는 행위 자체가 재미있는지”** 검증한다.

## 구현 순서

### 1. 프로젝트/앱인토스 RN 기반
- 최신 앱인토스 공식 문서 재확인
- RN + SDK 2.x 기반 구성
- 세로 fullscreen
- Safe Area
- background 진입 시 게임/사운드 정리

### 2. 기준 엔진 보존
이미 존재하는 다음 파일을 우선 사용한다.
- `src/game/model/*`
- `src/game/config/*`
- `src/game/engine/*`
- `src/game/telemetry/*`

먼저:
```bash
npm test
```
로 기준 테스트를 통과시키고 RN 통합을 시작한다.

### 3. 상대 복서 Motion Pipeline 구현

`tools/mocap/motion-sources.json`과 `src/game/assets/motion/`의 검증된 dataset을 기반으로 아래 순서대로 구현한다.

1. **Motion Asset 준비 확인**
   - `src/game/assets/motion/` 에 3개 JSON 존재 확인
   - `node --test tests/mocapMotionContract.test.mjs` 전체 PASS 확인

2. **Forward Kinematics 재현성 확보**
   - `tools/mocap/convert-cmu-amc.mjs`로 언제든 재생성 가능한지 확인
   - `npm run audit:motion -- --source-dir <CMU 원본 디렉터리>`로 3개 asset을 임시 디렉터리에 재생성하고 semantic equality 확인
   - 모든 ASF/AMC 입력은 변환 전에 `motion-sources.json`의 SHA-256과 일치해야 함
   - 새 motion source 추가 시 이 도구만 사용

3. **19관절 Motion Dataset → Boxer Character Rig Retarget**
   - 19관절 world-space XYZ 기반으로 boxer character rig 구동
   - 캐릭터 비율 조정은 허용. 원본 포즈/궤적의 임의 수정은 금지
   - 별도 rig retarget QA 항목으로 관리

4. **2.5D Projection 구현**
   - Ready 기준 고정 camera basis로 정면 2.5D 렌더링
   - depth(Z축) 기반 원근 표현
   - 저장소 루트에서 로컬 HTTP 서버를 실행하고 `tools/mocap/validation-viewer/viewer.html`로 canonical asset을 직접 확인

5. **Canonical Timing 연결**
   - `p0Attacks.ts`의 `cueAnchorMs` / `impactMs` / `responseWindow` 불변 유지
   - Animation Anchor와 piecewise linear retiming으로 연결
   - `p0Sequence.ts`의 `attackStartOffsetsMs`를 GameClock 기반 절대시각으로 변환
   - visual recovery와 animation completion은 다음 공격 시작 조건으로 사용하지 않음

6. **Pose Handoff 계약**
   - 650ms cadence에서 다음 공격이 이전 visual recovery 전에 시작하는 상황을 정상으로 처리
   - BoxerRig presentation layer가 공격 사이 pose handoff/transition을 담당
   - pose transition 때문에 canonical attack start를 지연하거나 변경하지 않음

7. **Cue / Impact 시각 연출**
   - Cue 구간 전조 강조 (연출 허용, 포즈 변형 불가)
   - Impact flash / 피격 흔들림

8. **실기기 QA**
   - jank / frame drop 여부
   - cue 가독성 (3개 공격 시각 구별성)
   - impact 손맛
   - motionSourceId 포함 telemetry 기록 확인

### 4. 4버튼
- LEFT / RIGHT / BACK / GUARD
- 버튼은 충분히 크고 위치 고정
- 좌우 대칭
- 2×2 배치를 우선 실험하고 1×4와 비교 가능하게 설계

### 5. 회피/피격
- 직선: slip
- 왼훅 + RIGHT: weave
- BACK: 거리 빼기
- GUARD: 하이가드
- HIT: 짧은 흔들림/타격음

판정과 애니메이션 완료는 분리한다.

### 6. 고정 P0 시퀀스
1. Jab — `[0]`
2. Straight — `[0]`
3. Lead Hook — `[0]`
4. Jab → Straight — `[0, 650]`
5. Jab → Lead Hook — `[0, 650]`
6. Jab → Straight → Lead Hook — `[0, 650, 1300]`

총 10펀치.

각 배열은 콤보 시작 기준 `attackStartOffsetsMs`이며 모든 내부 interval은 650ms다.
`comboEnd`는 마지막 공격의 impact 시점이다. `recoveryAfterMs`는 comboEnd 이후 다음 콤보까지의
간격으로 internal offset과 분리한다. 기존 값 700 / 700 / 850 / 900 / 900 / 1000ms를 유지한다.

현재 countdown 3000ms, 여섯 콤보, 기존 recovery를 합친 계산 runtime은 14,070ms다.
15~20초는 hard engine invariant가 아니라 playable/device QA의 UX 목표다. 시간이 짧다고
internal cadence를 늘리지 말고, 실제 QA 후 `recoveryAfterMs`를 튜닝한다.

### 7. 입력 버퍼 검증
반드시 확인:
- 첫 공격 방어 직후 다음 입력이 false EARLY가 되지 않는가?
- 한 공격에 대한 추가 입력이 다음 공격을 오염시키지 않는가?
- 동시 두 버튼 입력을 탐지하는가?
- `nextAttackStart + next.cueAnchorMs - preCueBufferMs`가 이전 response window 종료보다 늦고 impact와 같거나 늦은가?
- buffer 경계 입력이 현재 공격 resolved 상태와 관계없이 다음 `targetAttackInstanceId`로 귀속되는가?
- `MULTI_INPUT`이 동일 `targetAttackInstanceId`의 VALID 입력끼리만 발생하는가?
- 이전 공격 또는 LATE 입력이 다음 공격의 `MULTI_INPUT`을 만들지 않는가?

### 8. 관장 최소 구현
- NEUTRAL
- MOCK
- INTERESTED

대사:
- 첫 피격 안전구간: “그걸 맞나?”
- 연속 성공 후: “……어?”
- 좋은 종료: “흠. 생각보단 낫군.”

다음 공격 cue 중에는 대사를 띄우지 않는다.

### 9. Telemetry
각 공격에 최소 기록:
- attackInstanceId
- comboId/index
- 실제 cue/impact 시각
- 입력 시각/버튼/status
- outcome
- reactionMs
- cue 주변 frame time / dropped frame 가능 여부
- motionSourceId (사용된 motion dataset 식별자, e.g. "144_13")

### 10. 실기기 QA
최소:
- 최근 iPhone
- 플래그십 Android
- 중급 Android

확인:
- 입력 누락
- false EARLY
- cue 주변 jank
- 피격 연출이 다음 공격을 가리는지

### 11. 사용자 테스트
복싱 비경험자 + 경험자 분리.

핵심 관찰:
- 공격이 읽히는가?
- 피했을 때 손맛이 있는가?
- 맞은 이유를 이해하는가?
- 연타가 더 재미있는가?
- 결과 후 자발적으로 재도전하는가?

## P0 합격 후에만 추가
- 바디
- 어퍼
- 오른훅
- 4연타
- 30초
- GOOD
- EventScore
- BEST

서버/광고/백분위/공유는 그 이후다.
