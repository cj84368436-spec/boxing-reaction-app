# 현재 제품 결정 — 2026-10-15

사용자가 승인한 1차 구현 기준. 이 문서는 과거 README·AI_HANDOFF·감사 제안·기존 광고 정책보다 우선한다. 과거 기록은 삭제하지 않는다.

## 광고와 경기

- **2 knockout = rewarded 광고 1회.** 0 → 첫 KO 1 → 무료 재도전 → 둘째 KO 2 → rewarded `userEarnedReward`와 `dismissed` 모두 확인 → 0 → 준비 후 재경기.
- 첫 결과 CTA는 `다시 도전`, 둘째 결과 CTA는 `광고 보고 다시 도전`. 실패·보상 없는 닫힘·SDK 오류·타임아웃은 성공이 아니다. 실패 후 카운터 2를 유지한다.
- clear는 death가 아니다. 기존 count=1도 유지하며 같은 난이도 재도전은 무료다.
- clear 후 실제 다음 난이도 이동에만 기존 INTERSTITIAL을 유지한다. 이미 해금된 난이도로 KO 후 이동하면 death 정책을 적용하며 interstitial을 겹치지 않는다.
- 기록 화면 BANNER 유지. 광고 SDK·지면 ID·콘솔 설정은 변경하지 않는다.
- 카운터는 JS runtime 메모리 상태다. 홈·기록·난이도·화면 remount에서 유지, 앱 프로세스 완전 재시작 시 0. Toss Storage에 저장하지 않는다. 영구 저장+TTL은 실제 우회 데이터가 생긴 후 별도 판단한다.
- 엔진 runId와 별개인 고유 product roundId를 생성한다. 같은 round의 종료는 한 번만 집계한다. fullscreen 작업은 runtime 소유권으로 하나만 허용한다.
- 광고 완료가 inactive/background에 도착하면 경기 생성 자체를 보류한다. foreground에서 기존 2초 준비부터 시작한다. 일반 경기 중 앱 전환은 기존 수동 `계속하기`를 유지한다.
- 오류 뒤 홈 이동·unmount는 해당 광고 작업을 폐기한다. 이전 callback이 다른 화면에서 경기를 시작하거나 카운터를 초기화하지 않는다.

## 결과와 연습

- 공격 수 30회, 타이밍·판정·모션·가드·난이도 배율·기록 비교 순서와 v1 저장 스키마 유지.
- streak는 연속 PERFECT, 평균 반응시간은 유효 PERFECT 표본이다. 생존은 기존 `resolved - (knockout ? 1 : 0)`을 유지한다.
- 다음 목표는 현재 생존보다 큰 가장 가까운 5회 단위(5/10/15/20/25/30). clear는 PERFECT 1회 향상, 이미 30회 PERFECT면 새 순서에서 재현을 제안한다.
- 잘한 점·놓친 점은 관찰한 횟수만 사용한다. 성공 표본이 없으면 강점을 만들지 않는다. 첫 기록과 실제 최고 갱신을 구분한다. 상세 기록은 기본 접힘이며 데이터는 유지한다.
- 최초 사용자의 시작 버튼은 LEFT→GUARD 버튼 몸풀기로 연결한다. 기존 DefenseControls를 재사용하고 실제 경기/저장/광고를 만들지 않는다. 두 성공 피드백 각 2초 + 기존 경기 준비 2초, 입력 시간에 따라 길어질 수 있다.
- 몸풀기 완료는 runtime에만 기억한다. 이미 저장된 경기 기록이 있는 사용자는 생략한다. 새 저장 키를 추가하지 않는다. 공격 타이밍을 가르치는 시뮬레이션이 아니라 안전한 입력 연습이다.
- 관장의 까칠함을 유지하되 근거 없는 재능 단정은 제거하고 결과에 실제 실패 공격/행동 설명을 연결한다.

## 제품 이벤트와 KPI 한계

`src/app/product/productEvents.ts`의 로컬 adapter는 최대 500개를 runtime 메모리에 유지한다. 외부 전송·서버·analytics SDK·영구 사용자 ID는 없다. `playRuntime.events.snapshot()`으로 검증할 수 있다. observer뿐 아니라 동기식 `adapter.record()` 예외도 runtime 경계에서 격리한다. `analyticsFailureCount`로 adapter 예외 횟수를 로컬 검사할 수 있으며 게임/광고로 다시 던지지 않는다. Promise 기반 API나 외부 전송은 추가하지 않았다.

재도전은 runtime에 마지막 종료 경기 ID와 `pendingRetry`(previousRoundId, retryType)를 유지한다. 화면 unmount는 이 문맥을 삭제하지 않는다. 무료/광고 재도전 선택 후 실제 session.start가 성공한 시점에만 일치하는 문맥을 소비하고 `game_start`와 `retry_game_start`를 한 번씩 연결한다. 광고 실패·보상만·닫힘만으로 소비하지 않는다. 홈에서 새 도전 또는 clear 후 다음 난이도 시작은 retry가 아니며 previousRoundId=null이다. 홈으로 명시적 취소하면 pending 문맥을 지운다. 단, 2 KO가 남아 홈/remount에서 보상 광고로 재개하는 행동은 마지막 종료 경기의 ad_retry다. 앱 runtime 재시작 시 모든 문맥이 사라진다.

- app_open, landing_view, tutorial_start/complete
- game_start/end, result_view, free_retry_tap, ad_retry_tap, retry_game_start
- ad_request/loaded/start/reward/dismissed/complete/fail

모든 이벤트: at, runtimeId, deathsSinceLastAd. 경기 이벤트: roundId, 시작 시 level/source/previousRoundId, 종료 시 reason=clear|knockout. 광고 이벤트: format, adRequestId, 발생 시 roundId. ad_start는 native `show`, ad_reward는 `userEarnedReward`, ad_complete는 rewarded에서 보상+닫힘이다. stage fallback 진행은 ad_complete가 아니다. preload와 재생은 adRequestId로 연결한다. 타임아웃 뒤 늦은 정상 완료는 같은 요청에 ad_fail 및 ad_complete 모두 남을 수 있으므로 완료 여부를 최종 상태로 집계한다. 중복 native callback은 한 요청 내 같은 이벤트를 중복 기록하지 않는다.

로컬 검증 가능: runtime당 실제 경기 수, 무료/광고 CTA→실제 재시작, 광고 요청→표시→완료→경기, clear/KO 구분. 클릭을 재경기로 세지 않는다. 화면 재방문은 별도 landing_view다. 장기간/전체 사용자 KPI, D1/D7, ARPDAU, 실제 광고 수익은 수집 기반·광고 매출 연동이 없어 아직 계산할 수 없다. 500개 초과/앱 재시작 시 기록이 사라지므로 운영 통계 수집으로 사용하지 않는다.

## 검증 범위

DEV PREVIEW의 `?debug=1&qaAds=1`은 기존 광고 controller + 명시적 모의 native port를 사용한다. 실제 SDK 요청/광고 수익은 발생하지 않는다. 기본 preview에는 native 광고가 없어 두 번째 KO 후 실제 광고를 완료할 수 없다. 기록 banner·몸풀기와 네이티브 UI는 RN 컴포넌트 테스트로 따로 검증한다. 브라우저 결과를 Toss 기기 통과로 해석하지 않는다.

2026-10-15 제품 감사 원문과 일부 evidence artifacts는 클라우드에 누락되어 있다. 현재 구현의 blocker가 아니다. 추후 원문을 `docs/audits/PRODUCT_AUDIT_2026-10-15.md`에 역사 자료로 보존할 수 있으며 이 결정보다 우선하지 않는다.
