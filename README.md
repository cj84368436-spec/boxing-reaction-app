# 복싱앱 스타터 패키지

이 폴더는 **「복싱 재능 알아보기」 P0 Vertical Slice**를 Codex/Antigravity가 제각각 재해석하지 않도록 만든 기준 패키지입니다.

## 지금 들어있는 것

- `docs/specs/boxing-talent-prd-v2.md` — 무엇을 만들지 정한 최신 PRD
- `docs/plans/p0-vertical-slice-plan.md` — P0를 어떤 순서로 만들지 정한 구현 계획
- `src/game/` — 판정 엔진의 **기준 구현(Canonical Implementation)**
- `tests/` — 기준 구현을 지키는 자동 테스트
- `AGENTS.md` — Codex/Antigravity가 반드시 따라야 할 작업 규칙
- `AI_HANDOFF.md` — 각 에이전트에게 처음 전달할 복붙용 지시문

## 가장 중요한 사용법

1. 이 폴더를 Git 저장소로 만든다.
2. Codex와 Antigravity 모두 이 **동일한 프로젝트**를 작업환경으로 연다.
3. `AGENTS.md` → PRD → P0 계획 → 테스트 순으로 먼저 읽게 한다.
4. 메인 구현자는 한 명만 정한다. 권장: **Codex = 메인 구현**.
5. Antigravity는 리뷰/실험/보조 작업을 맡기고, 같은 파일을 동시에 수정하지 않는다.
6. 기준 엔진을 바꾸려면 먼저 이유를 설명하고 사용자 승인을 받게 한다.

## 현재 코드 검증

이 패키지는 외부 테스트 라이브러리 없이 Node.js + TypeScript만으로 핵심 엔진을 검증할 수 있습니다.

```bash
npm test
```

현재 검증 대상:

- 왼훅 → 오른쪽 회피 = `PERFECT`
- 오른손 스트레이트 → 왼쪽 회피 = `PERFECT`
- 잽에서 좌/우 슬립을 P0에서 섣불리 HIT 처리하지 않음
- 다음 연타를 위한 pre-cue input buffer
- EARLY / LATE 구분
- 동시 다중입력 탐지
- P0 고정 시퀀스 10펀치
- P0 임시 점수

## 아직 없는 것

이 패키지는 **완성된 React Native 앱이 아닙니다.**

P0 핵심 판정 엔진과 문서가 기준으로 들어 있으며, Codex가 이를 앱인토스 React Native 프로젝트에 통합하면서 다음을 구현해야 합니다.

- 실제 상대 복서 화면
- 4버튼 UI
- 펀치/회피 애니메이션
- 관장 3상태
- 피격 연출/사운드
- 실기기 프레임/입력 로그

서버, 광고, 백분위, 공유, 6버튼은 P0에서 구현하지 않습니다.
