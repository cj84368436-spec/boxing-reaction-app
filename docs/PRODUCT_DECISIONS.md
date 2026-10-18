# 현재 제품 결정 — 2026-10-16

사용자가 승인한 1차 구현·최근 경기 비교·홈 다음 목표·결과 공유 기준. 이 문서는 과거 README·AI_HANDOFF·감사 제안·기존 광고 정책보다 우선한다. 과거 기록은 삭제하지 않는다.

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

- 공격 수 30회, 타이밍·판정·모션·가드·난이도 배율·최고 기록 비교 순서와 기존 v1 필드 의미 유지. 최근 기록은 아래 선택 필드로 확장한다.
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

## 최근 경기 1회 비교 — 2026-10-16

- 같은 난이도의 최근 정상 종료 경기(clear/knockout) 1회만 저장한다. 기존 `boxing-survival-v1`의 `version:1`을 유지하고 선택 필드 `recentByDifficulty: Partial<Record<Level, RoundRecord>>`를 추가한다. 앱 재실행 시 복원하며 광고 카운터는 계속 runtime 전용이다.
- 기존 v1 데이터에 recent가 없으면 비교하지 않는다. 최고 기록에서 직전 기록을 추정하지 않는다. 손상된 recent 항목만 제외하고 기존 원문 백업/복구 정책을 사용한다. 기존 best·해금·streak를 강제 초기화하지 않는다.
- 실제 product game_end 승인과 완결된 RoundRecord를 확인한 결과 확정 경계에서 previousRecent → 비교 → best 갱신 → recent 교체 → 기존 저장 큐 1회 쓰기 순으로 처리한다. 렌더/상세 로그 토글은 중복 저장하지 않는다. 저장 실패는 기존 안내와 메모리 상태 유지로 처리하고 경기·광고·재도전을 막지 않는다.
- 튜토리얼·준비·중단·시작하지 않은 경기·광고 실패·비정상 종료는 recent에 포함하지 않는다. DEV PREVIEW는 주입된 비교 fixture를 보여줄 수 있지만 브라우저 가짜 경기를 recent로 저장하지 않는다. 기존 preview best 저장은 그대로 유지한다.
- 생존 수 변화 우선, 같으면 PERFECT 변화, 완주끼리는 남은 목숨/PERFECT의 실제 변화를 표시한다. 서로 반대 방향이면 mixed, 표시 지표가 같으면 그 지표가 같다고만 표현한다. reaction/streak까지 동일한 성적이라고 단정하지 않는다. KO→clear는 ‘이번에는 30회 완주’이며 직전 KO만으로 생애 첫 완주라고 말하지 않는다.
- 최고 기록 comparator(clear → survival → lives → PERFECT → reaction)는 그대로다. 최근 비교는 최고 판정이나 새 점수가 아니다.
- 결과 제목 아래 작은 비교 문구, 기록 화면 난이도별 최고/최근 구분만 추가한다. 가까운 목표·광고 CTA·상세 로그·튜토리얼 시간은 유지한다.
- 새 이벤트 대신 `result_view`에 `has_recent_comparison`, `previous_result`, `current_result`, `comparison`을 추가한다. 결과 문자열은 `knockout:12/30` 또는 `clear:30/30`; comparison은 improved/declined/same/mixed 또는 null이다. level은 난이도, roundId는 노출 경기다. `retry_game_start.previousRoundId`와 연결해 비교 노출 이후 실제 재경기를 구분한다. 기존 로컬 adapter만 사용하며 외부 수집/전송은 없다.
- C1/C2 실기기 검증은 모바일 환경 제약으로 보류한다. 기존 [실기기 체크리스트](DEVICE_VALIDATION_V1.md)는 유지한다. 이번 recent 구현은 기기 게이트 통과를 뜻하지 않으며 lifecycle/광고를 추측으로 변경하지 않는다.

## 최근 기록 기반 홈 다음 목표 — 2026-10-16

- 목적은 선택한 난이도에 다시 도전할 이유 한 가지를 보여주는 것이다. 신규 사용자는 recent가 없으면 기존 홈 그대로다. 잠긴 난이도와 다른 난이도의 기록을 사용하지 않는다.
- `buildRevisitPrompt({recent,best,difficulty,unlocked})`의 kind는 no_recent / below_best / equals_best / clear_below_best / clear_best / invalid다. 기존 comparator로 전체 성적 관계를 먼저 판별한다.
- recent는 KO지만 best가 clear면 완주 이력을 존중해 최고 기록 재도전을 제안한다. 둘 다 KO인 경우 생존 차이가 1~5회면 ‘최고 생존 기록까지 N회’. 더 멀면 기존 `resultSummary`의 5회 단위 가까운 목표를 재사용한다. 생존이 같아도 PERFECT/반응시간으로 best보다 낮으면 below_best이며 최고 기록 재도전을 제안한다. 생존 수 도달을 comparator상 최고 갱신으로 보장하지 않는다.
- 완주 동점에서 PERFECT<30이면 기존 결과 목표의 PERFECT+1, 이미 PERFECT=30이면 최고 기록 재도전이다. 완주끼리 목숨이 같고 best의 PERFECT가 높으면 차이 5회 이내는 그 차이, 더 멀면 기존 PERFECT+1 목표를 사용한다. 목숨/반응시간 차이 등 나머지는 최고 기록 재도전 문구다. 이미 완주한 recent에는 ‘30회 생존/완주하기’를 목표로 주지 않는다.
- recent가 comparator상 best를 앞서거나 best가 없거나 기록이 유효하지 않으면 invalid로 목표만 숨긴다. 정상 write 순서는 best 갱신→recent 교체→한 JSON 저장이며 큐에서 직렬화한다. 해당 정상 경로와 복원 검사에서 불일치는 재현되지 않았다. 불일치 주입은 로컬 계측의 reason으로 드러내며 저장이나 comparator를 임의로 고치지 않는다.
- 홈 기존 기록 영역에 최근 기록 문맥과 목표 문구를 작게 추가한다. 별도 CTA/시작 경로는 없고 기존 버튼이 기존 광고 gate를 통과한다. 날짜·오늘·연속 접속·출석·푸시·결과 공유는 추가하지 않는다.
- Storage 필드는 추가하지 않으며 기존 best/recent를 읽기만 한다. recent 저장/복원 방식은 그대로다.
- 기존 `landing_view`와 실제 `game_start`에 `has_revisit_prompt`, `revisit_prompt_kind`, `revisit_prompt_issue`를 붙인다. level/runtimeId로 노출 난이도와 runtime을 구분한다. game_start 속성은 홈에서 실제 시작된 경우에만 그 목표 문맥을 반영하며 결과 retry/다음 난이도는 false/null이다. 광고 실패·CTA만 누르기는 game_start가 아니다. 별도 클릭 이벤트·외부 전송을 추가하지 않는다.
- C1/C2는 여전히 실기기 검증 보류다. 이번 기능의 클라우드 통과를 기기 게이트 통과로 해석하지 않는다.

## 실제 경기 결과 공유 — 2026-10-16

- 결과 공유는 재도전 아래의 보조 행동이다. 공유에 광고·보상·무료 재도전을 연결하지 않는다. 기존 deathCount/시작 gate/결과/기록을 변경하지 않는다.
- 텍스트만 공유한다. 난이도, 생존 수/30 또는 완주, PERFECT 수가 기본이다. 저장 전 previousBest와 기존 comparator로 실제 갱신한 경우에만 ‘새로운 개인 최고’를 붙인다. 첫 기록/동점은 갱신이 아니다. 최고 갱신 문구가 없고 실제 recent 개선이 있으면 한 줄만 덧붙인다. 하락 비교는 생략한다.
- 이모티콘, 능력 점수·상위 %·파이터 유형, 실명/계정 정보/전화번호/내부 user identifier/runtimeId/roundId/광고 ID/seed는 외부 payload에 포함하지 않는다. 내부 roundId는 로컬 계측에서만 사용한다.
- installed SDK의 native share는 fire-and-forget wrapper이므로 React Native Share.share를 사용한다. iOS sharedAction은 activity_completed, dismissedAction은 cancelled. Android sharedAction은 chooser 시작 직후 응답이므로 sheet_open만 기록한다. 어떤 경우에도 실제 전송/수신 완료로 단정하지 않는다. 알 수 없는 응답은 unconfirmed, 예외는 failed, 지원하지 않는 환경은 unsupported다.
- 공식 getTossShareLink와 기존 앱 루트 `intoss://boxing-talent-test`만 사용한다. 반환된 HTTPS URL을 그대로 붙이고 새로운 딥링크/추적/seed/난이도 파라미터를 만들지 않는다. 링크 실패·1.5초 초과는 텍스트 공유로 진행한다. 실제 앱 진입은 배포된 앱 상태를 따르며 현재 working tree를 자동 업로드하지 않는다.
- 공유 요청은 singleton에서 하나만 처리한다. Android는 chooser handoff 후 1초 동안 중복 요청을 더 막는다. 플랫폼 공유창이 떠 있는 동안 입력은 OS modal이 소유한다. native 응답을 기다리는 동안 게임 흐름을 대기시키지 않으며 lifecycle 로직은 변경하지 않는다. 링크를 기다리는 동안 결과를 떠나거나 광고/새 경기가 시작되면 abandoned로 폐기한다. 늦은 응답은 새 화면 상태를 갱신하지 않는다.
- share_tap/share_outcome은 기존 fail-open 로컬 ProductEvents에 기록한다. roundId, difficulty, result_type, survived, perfect, is_personal_best, has_recent_comparison(결과 비교 존재 여부), outcome, has_link(준비된 링크 유무)를 사용한다. 클릭 자체를 공유 성공으로 세지 않는다. 외부 analytics와 공유 유입 attribution은 없다.
- DEV PREVIEW는 기본적으로 native 공유 미지원 안내를 한다. `qaShare=1`은 실제 전송 없는 모의 native 응답이며 preview_mock=true를 표시한다. 이미지 카드·파일 저장 권한·새 dependency는 추가하지 않는다.
- C1 focus/AppState, C2 reward 후 dismissed 누락은 계속 실기기 검증 보류. 공유 sheet의 iOS/Android 표시·취소·복귀·중복 방어와 링크 수신/앱 진입도 실제 기기에서 별도 확인해야 한다. 기존 체크리스트는 삭제하거나 통과 처리하지 않는다.


## 2026-10-17 결과 화면 정보 위계

- 결과 상단에 게임명·난이도·큰 생존 수·완주 표시·관장 평가를 둔다. 최근/최고 비교와 가까운 목표 다음에 재도전을 primary로 유지한다.
- 공유는 `친구에게 기록 보내기` 보조 CTA. `친구는 몇 회까지 버틸까?`(완주자는 끝까지 버틸 수 있을까?) 안내만 추가하며 대결 기능이나 보상을 약속하지 않는다.
- 관장 문구는 완주/PERFECT, 실제 생존 증가, 반복 피격 공격명·횟수, 다음 한 번 도전 순서로 결정한다. 난수·가짜 능력·인격 비하 없음. 기록과 공유 텍스트의 기본 수치 및 최고 갱신 판정은 공통 결과 사실 모델을 사용한다.
- 상세 피드백·공격 로그는 CTA 아래에서 펼친다. 저장 실패 안내는 접지 않는다. 새 데이터 저장·이벤트·실험 variant·외부 전송 없음.
- 광고/엔진/recent/revisit/tutorial/공유 adapter 정책은 그대로다. C1/C2와 실제 native 공유 검증은 보류. 향후 공유 시도율과 실제 재도전율을 같이 보며 디자인 효과를 판정한다.


## 2026-10-17 공식 운영 Analytics 연결

- ProductEvents를 단일 제품 이벤트 source로 유지하고 500개 runtime journal 옆에 Apps in Toss eventLog adapter를 붙인다. 모든 UI에서 SDK를 직접 호출하지 않는다.
- 운영 17개 핵심 이벤트에 boxing_ 접두사. ad_request/ad_loaded는 로컬에만 남기고, 광고 reward/dismissed는 C2 및 완료 계약 해석을 위해 유지한다.
- 계측 throw/reject/timeout은 게임을 막지 않는다. local 진단과 제한된 동시 요청만 사용하며 자체 queue/retry 서버를 추가하지 않는다. SDK 전달/서버 수집은 보장하지 않는다.
- 최소 allowlist 속성과 실행 중 임시 연결 토큰만 사용한다. raw runtime/user/ad ID, seed, 공유 상대, 입력/공격 로그와 오류 전문은 보내지 않는다. 공식 SDK의 익명 사용자 집계 경로를 사용하며 자체 persistent user ID는 만들지 않는다.
- Live만 운영 집계하며 QR/Sandbox 결과는 콘솔 수집 증거로 취급하지 않는다. result-share 전용 유입은 현재 구분 불가하여 entry_source=unknown. Analytics로 광고 매출/ARPDAU/실제 공유 수신을 알 수 있다고 주장하지 않는다.
- 게임·UI·광고·공유·저장·C1/C2 정책 변경 없음. 상세 매핑/중복 정의/환경/계산식/한계는 [운영 Analytics 가이드](APPS_ANALYTICS_2026-10-17.md)를 따른다.
