# AGENTS.md — 복싱 재능 알아보기 작업 규칙

## 1. 작업 맥락과 실행 원칙

- 모든 답변은 한국어로 간결하게 작성한다. 결론, 변경 이유, 실제 검증 결과를 우선한다.
- 새 작업에서는 `AI_HANDOFF.md`와 현재 브랜치·변경 목록을 확인한다. 구현 전 PRD(`docs/specs/boxing-talent-prd-v2.md`), P0 계획(`docs/plans/p0-vertical-slice-plan.md`), 관련 소스·테스트에서 요청에 필요한 부분을 읽는다. 디렉터리 전체를 매번 읽지 않는다.
- 같은 대화에서 확인한 자료는 변경·실패·구체적 불확실성이 없으면 다시 읽지 않는다. 검색은 관련 파일부터 좁게 시작하고 결과를 요약한다.
- 사용자의 최신 명시적 지시와 승인 범위를 우선한다. 오래된 계획·인계문과 충돌하면 현재 요청에 맞춰 해석하며 필수 정보만 질문한다.
- 승인된 범위의 코드 확인, 원인 분석, 최소 수정, 관련 검증은 자율적으로 끝낸다. 이미 받은 승인을 다시 묻지 않는다. 기준 구현·모션 보호와 배포·외부 전송 등 별도 승인 경계는 유지한다.
- 스킬은 명시적으로 요청되었거나 결과에 실질적으로 필요한 경우만 사용한다. 별도 설계 절차, 서브에이전트·팀, 외부 AI 검토, 반복 개선은 필요한 이유를 제안하고 동의받은 범위만 실행한다. 워크플로를 자동 연쇄 실행하지 않는다.
- 기존 미커밋 변경과 다른 작업본을 보존한다. 과거 커밋이나 인계문을 근거로 현재 파일을 되돌리지 않는다.

## 2. P0 범위 고정

P0의 목적은 **“펀치를 보고 피하는 0.5초가 재미있는가”**를 검증하는 것이다.

P0에 포함:
- 1인칭 세로 화면
- 상대 오소독스 1명
- 잽 / 오른손 스트레이트 / 왼훅
- 4버튼: LEFT / RIGHT / BACK / GUARD
- 단발 / 2연타 / 3연타
- 15~20초
- PERFECT / SAFE / HIT 임시 판정
- 로컬 점수
- 관장 최소 반응
- 로컬 telemetry

P0에서 금지:
- 서버
- 로그인
- 광고
- 백분위
- 공유
- 100점 최종 공식
- 바디 / 어퍼 / 오른훅
- 4연타
- 6버튼
- 사우스포
- 페인트
- 랭킹

“나중에 필요할 것 같아서” 미리 구현하지 않는다.

## 3. 기준 구현 보호

`src/game/`의 판정 로직과 `tests/`는 Canonical Implementation이다.

다음을 임의로 바꾸지 않는다.
- 4버튼의 의미
- InputStatus / DefenseOutcome 분리
- 왼훅 + RIGHT = PERFECT
- 오른손 스트레이트 + LEFT = PERFECT
- combo pre-cue input buffer 개념
- cueAnchor / impact / response window 분리
- P0 고정 공격 시퀀스

변경이 필요하다면:
1. 문제를 재현한다.
2. 왜 현재 사양이 잘못됐는지 근거를 제시한다.
3. 변경 영향 범위를 적는다.
4. 사용자 승인을 받은 뒤 테스트부터 수정한다.

## 3-A. Motion Pipeline 회귀 방지 규칙

`src/game/assets/motion/`과 `tools/mocap/`은 검증 완료된 P0 Motion Pipeline이다.

### 절대 금지
- `tools/mocap/convert-cmu-amc.mjs`(Codex Reference FK)를 임의로 재작성
- 19관절 구성을 임의로 축소 또는 변경
- ASF axis / AMC dof 처리 방식을 추측으로 수정
- mocap source에 맞춰 canonical `cueAnchorMs` / `impactMs` / `responseWindow` 값 변경
- Ready 기준 고정 Camera Basis를 없애거나 frame마다 재계산으로 변경
- `samplePose(data, tMs)`의 deterministic 순수함수 구조를 상태 의존 방식으로 변경
- 검증 없이 projection 또는 renderer를 재설계
- glove 배율을 1.5x 초과로 사전 승인 없이 사용하여 타격감을 대체
- 원본 motion source를 보존하지 않고 수동 keyframe으로 전면 교체
- 시각 품질을 자동 테스트로 PASS 선언

### 허용 (반드시 원본 보존 + 사용자 승인 조건)
- **smoothing**: 원본 dataset과 별도 분리 + joint·방법·파라미터 기록 + 적용 전후 수치 비교 + 승인.
  P0 현재 3개 검증 motion에는 기본 적용하지 않는다.
- **수동 post-process**: 원본 motion과 분리 + cue 가독성/가드 형태 개선 목적만 + 승인.
- **character rig retarget에서의 캐릭터 비율 조정**: 허용. 원본 포즈/궤적 자체의 변형은 불가.

### 변경 절차
1. 어느 파일의 어느 수식이 문제인지 수치로 증명한다.
2. `tests/fixtures/lead-jab-regression.json` 기준으로 비교 수치를 제시한다.
3. 영향 범위를 명시한다.
4. 사용자 승인 후 진행한다.

### Motion Source 추가/교체 시
- 반드시 `tools/mocap/convert-cmu-amc.mjs`를 사용한다.
- Lead Jab regression fixture(`tests/fixtures/lead-jab-regression.json`)를 기준으로 FK 수치를 비교한다.
- `tools/mocap/motion-sources.json`에 새 source를 등록한다.
- 사용자 육안 검증 전에 "PASS"를 선언하지 않는다.

## 4. TDD

새 동작을 추가하거나 버그를 고칠 때:
1. 실패하는 테스트 작성
2. 실제로 실패 확인
3. 최소 구현
4. 관련 테스트 통과 확인 후 코드 변경 완료 시 8절의 필수 검증 수행
5. 리팩터링

## 5. 게임 로직과 UI 분리

React Component 내부에 판정 규칙을 넣지 않는다.

UI는 엔진에 입력을 전달하고 결과를 표현한다.

애니메이션 완료 이벤트가 판정 엔진의 진행을 막아서는 안 된다.

## 6. timing 하드코딩 금지

공격별 timing은 설정/AttackDefinition에 둔다.

UI 파일 안에 `300`, `450` 같은 판정 ms 값을 직접 넣지 않는다.

## 7. 관장 개입

관장 대사/표정은 다음 공격 cue를 가리지 않는 안전구간에서만 표현한다.

## 8. 완료 주장 전 검증

- 코드 변경 중에는 실패 재현과 변경 영역의 관련 테스트를 실행한다. 코드 변경 완료 시 `npm.cmd test`를 한 번 실행하고 결과를 확인한다. 이미 최종 변경 상태에서 통과했다면 반복하지 않는다.
- 앱 코드·설정·의존성이 바뀌면 `npm.cmd run typecheck:app`과 `npm.cmd run build:app`을 실행한다. 브라우저 미리보기 변경에는 `npm.cmd run test:preview`를 추가한다.
- 문서만 수정하거나 읽기 전용 분석만 한 경우에는 게임 테스트·빌드를 실행하지 않는다. 문서 diff와 참조 경로를 확인한다.
- 필요한 검증이 통과하면 종료한다. 새로운 변경·실패·구체적 위험 없이 테스트와 검토를 반복하지 않으며 절약을 이유로 필수 검증을 생략하지 않는다.
- 과거 보고서의 통과 기록과 이번 실행 결과를 구분한다. 자동 테스트로 시각적 재미나 사용자 체감 품질을 PASS 선언하지 않는다.
- React Native 통합 후 앱인토스 Sandbox 실제 기기 실행을 확인하기 전에는 제품 완료로 선언하지 않는다. 데스크톱 검증과 기기 검증 상태를 별도로 보고한다.
