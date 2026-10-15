# 2026-10-15 재도전 루프 구현 계획

기준: 사용자가 승인한 1차 구현 정책(2026-10-15). 현재 main working tree에서 직접 구현하며 커밋·배포·외부 계측 전송은 하지 않는다.

## 목적과 경계

첫 knockout 후 무료 재도전, 두 번째 knockout 후 rewarded 광고, 정상 보상+닫힘 후 짧은 준비로 실제 재경기를 연결한다. 카운터는 runtime 메모리에서 화면 이동/remount에도 유지하고 프로세스 새 실행에서는 0이다. clear는 증가시키지 않는다. clear 후 동일 난이도는 무료이며 다음 난이도 전환 interstitial 및 기록 banner는 유지한다. 하나의 사용자 행동에서 fullscreen 광고를 겹치지 않는다.

공격 판정·타이밍·30회·모션·가드·기록 비교/저장 스키마를 보존한다. 기존 광고 controller를 재사용한다. 새로운 서버/SDK/영구 광고 카운터를 추가하지 않는다.

## 설계

- `src/app/product/playRuntime.ts`: runtime singleton과 주입 가능한 runtime 클래스. 실제 경기 ID, 종료 중복 방지, death count, fullscreen 광고 작업의 소유권. 화면 state와 별개로 유지한다.
- `P0GameScreen.tsx`: 기존 경기 시작/결과 경로에 정책을 연결한다. 광고 후 inactive 상태는 시작 의도를 보류하고 foreground에서 준비부터 시작한다. 일반 일시정지는 수동 재개를 유지한다.
- 기존 `ads/*`: 정상 성공 계약과 cleanup을 유지한다. 계측 hook은 선택 사항이며 소비자 오류가 광고를 막지 않는다.
- `attackNames.ts`, `resultSummary.ts`: 모든 공격 이름 공통화, 실제 기록 기반 가까운 목표와 피드백. 기록 알고리즘은 수정하지 않는다.
- `DefenseTutorial.tsx`: 실제 방어 버튼과 표현을 재사용하는 별도 연습. 경기 세션/저장/광고와 분리한다. 최초 runtime에서만 완료 여부를 기억하며 재도전에 반복하지 않는다.
- `productEvents.ts`: roundId와 retry origin을 가진 이벤트 contract, bounded local adapter. 외부 전송 없음.
- `tools/browser-preview/*`: 기존 QA import를 환경 독립 resolver로 이식. SDK 광고와 분리된 실행 가능한 로컬 검증을 제공한다.

## 단계와 검증

- [x] Phase 1: `npm ci`, `npm test`, `npm run typecheck:app`, `npm run build:app`, `npm run test:preview`. lockfile 불변 확인. Windows QA path를 resolver로 대체하고 외부 artifact 없는 검사는 불가로 기록.
- [x] Phase 2: 첫 사망 무료/두 번째 광고/clear 유지/화면 이동/remount/새 runtime/round 중복 테스트를 먼저 실패시킨 뒤 runtime과 화면 연결 구현.
- [x] Phase 3: reward+dismissed 양방향 순서, 실패/중도 닫힘/중복/늦은 callback/unmount, 두 fullscreen 경쟁, background에서 보류 후 foreground 준비를 검증. 기존 컨트롤러 안전성 보존.
- [x] Phase 4: 첫 기록/실제 최고 갱신, 모든 공격의 상세/복기 이름 일치 테스트 → 최소 수정.
- [x] Phase 5: 4→5, 8→10, 14→15 목표 및 표본 부족/clear/기록 의미 테스트 → 결과 요약, 관장 행동 피드백, 상세 기록 접기.
- [x] Phase 6: 실제 입력 연습과 완료 흐름, 기록/사망/광고/경기 이벤트 제외 테스트 → 분리 튜토리얼. 엔진 변경 필요 시 보류 사유 기록.
- [x] Phase 7: 광고 요청·표시·보상·닫힘·완료·실제 재시작 분리, 오류 격리 테스트. 브라우저 실행 QA, 전체 테스트·타입·앱 빌드, 보호 파일 diff와 git status 확인. 최신 결정/인수인계/README 업데이트.

## 집중 검토

1. clear 이후 이전 death=1이 유지되는지, 동일 난이도 무료인지.
2. death=2에서 홈/난이도/기록으로 이동해도 관문이 유지되는지.
3. SDK 완료가 앱 active보다 앞설 때 준비 시계조차 백그라운드에서 진행하지 않는지.
4. unmount와 광고 복귀가 교차할 때 이전 소유자의 콜백이 새 화면을 시작하지 않는지.
5. tutorial 입력이 경기 결과/저장/사망/실제 경기 이벤트에 들어가지 않는지.

## 영향도

광고 빈도와 재도전 선택을 직접 바꾸므로 수익 효과는 실사용 데이터로 판단한다. 결과/튜토리얼은 새 점수를 만들지 않는다. 기록 schema 변경과 사용자 데이터 migration은 없다. 광고 controller·UI·신규 product 모듈·관련 테스트·QA·문서만 변경한다.
