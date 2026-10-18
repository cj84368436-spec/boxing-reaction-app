# Apps in Toss 운영 Analytics 연결 — 2026-10-17

> 2026-10-18 후속 변경: entry_source는 더 이상 unknown 고정이 아니다. 공식 최초 URI로 direct/shared_result/unknown을 판별한다. [최신 공유 진입 계약](SHARED_ENTRY_2026-10-18.md)을 우선하며 아래 10월 17일 검증 기록은 보존한다.

## 1. 실제 API 및 근거

설치된 `@apps-in-toss/framework` 2.10.10의 공식 `eventLog({log_name, log_type, params}): Promise<void>`를 사용한다. 별도 SDK/서버/식별자 저장소를 추가하지 않는다.

- `node_modules/@apps-in-toss/native-modules/dist/index.d.ts`: `EventLogParams`, `eventLog` 선언과 공식 예제. `log_type`은 event/screen/click 등을 허용한다.
- 같은 패키지 `dist/index.js`의 `eventLog`: 공식 `getAnonymousKey()` 결과를 `anonymous_key`로 추가하고 파라미터를 문자열로 정규화한 뒤 native `safePostMessage('eventLog', ...)`로 전달한다. Sandbox는 콘솔 출력 경로이며 최소 Toss 버전 검사를 자체 수행한다.
- framework `dist/index.js`의 `registerApp`: 공식 RN Analytics logger도 `eventLog`에 연결한다. 화면 방문 자동 로그는 별도로 유지된다.
- framework의 실제 `Analytics` 객체는 init/Press/Impression/Area다. web-framework용 소문자 `Analytics.screen/click/impression`을 RN에서 추측 호출하지 않는다. UI wrapper를 추가하지 않고 기존 ProductEvents에 연결하기 위해 하위 공식 API를 선택했다.

공식 문서(2026-10-17 확인):

- [RN 사용자 행동 기록](https://developers-apps-in-toss.toss.im/documentation/common/growth/analytics/user-behavior.md): RN 컴포넌트 API, Live만 수집, QR/Sandbox 제외, 출시 다음 날 확인.
- [로그/이벤트 가이드](https://developers-apps-in-toss.toss.im/guide/analytics/logging.md): log_name, 콘솔 **분석 > 이벤트**, 파라미터 확인 방법. 예시 중 web-framework 코드를 RN에 그대로 적용하지 않았다.
- [대시보드](https://developers-apps-in-toss.toss.im/guide/analytics/dashboard.md): DAU, OS/앱 버전, 유입/리텐션, 갱신 주기.
- [유입 레퍼러](https://developers-apps-in-toss.toss.im/documentation/common/growth/analytics/referrer.md): external_share는 미니앱 안과 미니앱홈/게임홈 공유를 함께 포함한다.

원문 확인본은 `artifacts/analytics-20261017/*.md`에 보존했다. 현재 콘솔에 로그인하거나 Live 이벤트를 실제 전송하여 수집을 확인한 것은 아니다.

## 2. 구현 전 확정한 매핑

모두 `eventLog`를 사용한다. 운영 이름만 adapter에서 `boxing_`를 붙인다.

| ProductEvent | log_type / 추가 분류 | 운영 전송 |
|---|---|---|
| app_open | event | 예, 설치된 adapter 실행당 1회 |
| landing_view | screen | 예, 연속 동일 노출 합침 |
| game_start | event | 예, 실제 새 경기 |
| game_end | event | 예, clear / knockout |
| result_view | screen | 예 |
| free_retry_tap, ad_retry_tap | event + event_type=click | 예 |
| retry_game_start | event | 예, 실제 시작된 재경기만 |
| ad_start, ad_reward, ad_dismissed, ad_complete, ad_fail | event | 예 |
| share_tap | event + event_type=click | 예 |
| share_outcome | event | 예 |
| tutorial_start, tutorial_complete | event | 예 |
| ad_request, ad_loaded | — | 아니요, journal 유지 |

RN Analytics의 클릭 wrapper도 `log_type=event`, `params.event_type=click`을 사용하므로 이를 따른다. 완료 상태를 임의 클릭/노출로 바꾸지 않는다. ad_reward/ad_dismissed는 C2 및 완료율 해석에 필요하므로 이번 최소 세트에 포함했다. 광고 billing 통계가 아니다.

## 3. 구조와 속성

`UI/game → ProductEvents → {500개 local journal + 선택적 observer} → Apps adapter → eventLog`

- native 진입점 `src/_app.tsx`에서 앱 runtime journal에 한 번 연결한다. import 시 먼저 기록된 app_open은 journal replay로 전달한다.
- `ProductEvents.record()`는 계속 동기 반환하며 transport를 기다리지 않는다. subscribe와 기존 observer 모두 예외를 격리한다.
- `game_end`에는 기존 summarizeRound 결과의 level/survived/perfect를 추가했다. `result_view`에는 기존 resultFacts의 실제 최고 갱신 여부와 생존/PERFECT를 추가했다. UI·기록 계산·death 정책은 변경하지 않았다.
- 운영 payload는 명시적인 키 및 enum allowlist로 만든다. journal 객체를 spread하여 전송하지 않는다.

| 범위 | 전송 필드 |
|---|---|
| 공통 | app_version(현재 package 값 0.1.0), entry_source=unknown, 해당하면 difficulty/round_id |
| game_start / retry_game_start | source, is_retry, 해당하면 previous_round_id, has_revisit_prompt/revisit_prompt_kind |
| game_end | reason, survived, perfect |
| result_view | survived, perfect, is_personal_best, has_recent_comparison, comparison=improved/declined/same/mixed/none |
| landing_view | difficulty, has_revisit_prompt |
| 광고 | format=rewarded/interstitial, ad_attempt_id, ad_fail에는 제한된 failure_reason enum |
| 공유 | result_type, survived, perfect, is_personal_best, has_recent_comparison, outcome/has_link(응답 시) |

현재 실제 시작 source는 landing/free_retry/ad_retry/next_level이다. first/revisit/same_level_retry 등의 새로운 source를 만들어 의미를 바꾸지 않는다. `is_retry`는 이전 경기 연결이 있는 free/ad retry에만 true다.

round_id/previous_round_id와 ad_attempt_id는 adapter 메모리 안에서 만든 임시 연결 토큰이다. 원본 runtimeId/roundId/adRequestId나 timestamp를 그대로 보내지 않는다. 사용자 ID가 아니며 앱 재시작 후 유지하지 않는다. 기존 규칙의 정식 version 상수가 없어 rules_version은 임의로 만들지 않았다. package 버전이 같은 빌드끼리는 app_version만으로 구분되지 않는다.

실명/전화번호/계정/raw user ID/광고 ID/공유 대상/화면/공격 로그/seed/raw input timestamp/오류 전문은 전송하지 않는다. SDK 자체의 공식 익명 키 부착을 우회하거나 직접 사용자 키를 생성하지 않는다. SDK는 값들을 문자열로 정규화하므로 콘솔 필터에서는 true/false, 1/2/3 등이 문자열로 보일 수 있다.

## 4. fail-open 및 중복

- 동기 throw, Promise reject, 5초 응답 지연 모두 gameplay로 재throw하지 않는다. 진단 카운터만 유지한다.
- 동시 미완료 요청은 32개로 제한한다. 초과 이벤트는 drop하며 자체 큐/재전송/서버를 만들지 않는다.
- timeout은 native 요청을 취소하거나 전송 실패를 확정하지 않는다. 늦은 성공/실패는 추가 집계하지 않고 catch는 유지한다. SDK 전달·순서·오프라인 재전송·서버 저장을 보장하지 않는다.
- app_open 1회; game_start/end/result_view/retry_game_start는 이벤트+경기별 중복 제거; 광고 콜백은 이벤트+요청별 중복 제거. 기존 engine/controller 안전장치는 그대로다.
- 의도적인 추가 공유/재시도 탭은 새로운 행동이므로 삭제하지 않는다.
- 연속으로 동일한 속성의 landing_view는 합친다. 경기 시작/튜토리얼 시작/결과 노출 이후 landing은 새 노출로 센다. 기록 화면 왕복처럼 중간 ProductEvent가 없는 동일 landing 재노출은 합쳐질 수 있다. 따라서 이 카운트는 엄밀한 모든 화면 방문 횟수나 고유 사용자 수가 아니다.
- 중복 키는 최근 1,024개, 경기/광고 연결은 각각 최근 256개로 메모리를 제한한다. 오래된 임의 재주입 이벤트까지 영구 중복 제거하지 않는다. 실제 round/end 및 광고 중복 방어는 기존 제품 계층에도 존재한다.

진단: adapter.diagnostics()의 attempted/failed/dropped/pending, ProductEvents.observerFailureCount. 진단은 외부로 보내지 않으며 사용자 게임 오류로 노출하지 않는다.

## 5. 환경별 동작

| 환경 | 이 연결의 동작 | 운영 콘솔 기대 |
|---|---|---|
| browser preview | native installer 미포함, local journal/mock만 | 없음 |
| Jest | 기본 native 비활성; 경계 테스트는 명시적 SDK mock | 실제 전송 없음 |
| native 개발(__DEV__) | 전송 비활성, journal 유지 | 없음 |
| native Sandbox | 전송 비활성, journal 유지 | 없음 |
| Toss QR/출시 준비 | release bundle이면 native 호출 가능; SDK/플랫폼이 수집 환경 처리 | 공식 문서상 운영 집계 없음 |
| Toss Live release | eventLog에 연결 | 출시 다음 날부터 확인, 전달/집계는 별도 Live 검증 |

getOperationalEnvironment()는 toss/sandbox만 제공하므로 이를 QR/Live 구분 API라고 주장하지 않는다. 개발자 토큰/API 키/광고 콘솔 설정은 필요하지 않으며 이번에 수정하지 않았다.

## 6. 콘솔 확인 절차

1. 승인된 절차로 Live 출시한 뒤 확인한다. 이번 작업은 로컬 빌드까지만 수행한다.
2. Apps in Toss 콘솔에서 해당 미니앱 → **분석 > 이벤트**로 이동한다. 기본 방문 로그와 구분하여 `boxing_` 이름을 찾는다.
3. 정상 1회 플레이에서 boxing_app_open → boxing_landing_view → boxing_game_start → boxing_game_end → boxing_result_view 발생 여부를 본다. knockout은 정상 game_end다.
4. 이벤트 상세에서 발생 추이/최근 발생 수 및 파라미터 목록을 열고 difficulty, source, reason, comparison 등을 선택한다. 문자열로 정규화된 값을 감안한다.
5. 첫 KO 무료 재도전은 free_retry_tap와 retry_game_start(source=free_retry)를 각각 확인한다. 광고 재도전은 ad_retry_tap, ad_start, ad_complete(format=rewarded), retry_game_start(source=ad_retry)를 구분한다. reward/dismissed 둘 중 하나만 있으면 성공으로 세지 않는다.
6. 공유는 share_tap와 share_outcome을 확인한다. Android sheet_open은 전송 완료가 아니며 iOS activity_completed도 상대방 수신 증명이 아니다.
7. **분석하기 대시보드**에서 플랫폼 DAU/리텐션을 확인한다. 공식 문서상 일반 대시보드는 오전 9시 이후 전일까지, DAU 일간은 매 정시 2시간 전까지 갱신된다. 이벤트도 실시간 도착을 전제로 판단하지 않는다.
8. Live 출시 다음 날에도 boxing 이벤트가 없으면 빌드 버전/배포 환경, native bridge 실패·timeout/drop 진단, 이벤트명과 필터를 확인한다. QR에서 없다는 이유만으로 오류 판정하지 않는다.

공식 대시보드의 DAU/리텐션 제공은 확인했다. 개별 이벤트의 고유 사용자 수/세션 중복 제거 정의와 원시 이벤트 조인·내보내기 기능은 이번 문서에서 충분히 확인되지 않았다. 이벤트 발생 수를 사용자 수라고 부르지 않는다. 실제 콘솔에서 제공하는 UV/세션 옵션을 확인하기 전에는 per-event user funnel을 검증 완료라고 표시하지 않는다.

## 7. KPI 계약

N(event)는 동일 기간/난이도의 이벤트 발생 수이며 사용자 수가 아니다. 정확한 퍼널 비율은 중복 제거 및 경기 연결을 사용할 수 있을 때 계산한다.

| 지표 | 계산/해석 |
|---|---|
| 진입·시작 발생 수 | N(landing_view), N(game_start); DAU는 공식 대시보드의 사용자 지표 |
| 홈 출발 시작 비율(발생 수) | N(game_start, source=landing) / N(landing_view). 모든 retry를 분자에 넣으면 100% 초과 가능 |
| 결과 도달률 | 결과가 있는 고유 round_id 수 / 시작한 고유 round_id 수 |
| 무료 재도전 전환 | free_retry retry_game_start의 고유 previous_round_id 수 / result_view의 고유 round_id 수 |
| 광고 완료 후 재경기 | rewarded ad_complete의 round_id에 연결된 ad_retry retry_game_start.previous_round_id 수 / rewarded ad_complete가 있는 고유 round_id 수 |
| 공유 시도율 | share_tap가 있는 고유 round_id 수 / result_view의 고유 round_id 수 |
| 단순 공유 시도 빈도 | N(share_tap) / N(result_view). 동일 결과 재공유로 100%를 넘을 수 있으며 고유 전환율과 다름 |

콘솔 이벤트 카운트·파라미터로 빈도와 분포를 확인할 기반을 구현했다. round join 계산을 콘솔 UI에서 직접 지원하는지까지 확인한 것은 아니다. 위 정확한 연결식은 이벤트 contract이며, Live 데이터 접근/집계 기능을 확인한 뒤 계산해야 한다. 기간 경계에서 시작/결과가 갈리거나 이벤트가 유실되면 왜곡될 수 있다.

## 8. 아직 측정 불가

- 공유 결과 링크만의 유입: 기존 root 링크에 결과 공유 출처가 없다. external_share에는 다른 공유 경로도 섞인다. direct/shared_result를 임의 판정하지 않고 entry_source=unknown 유지.
- 광고 실제 매출, ARPDAU, 사용자당 총 수익/LTV: 광고/정산 데이터와 별도 결합 필요.
- 실제 메시지 전송·수신·읽음, 공유 상대: native 결과로 알 수 없다.
- 고유 사용자별 행동 퍼널/세션 수의 정확한 정의: 공식 콘솔 집계 기능·기준을 별도 확인해야 한다.

## 9. 검증 및 보호

검증 로그는 `artifacts/analytics-20261017`에 저장한다. 실제 전송 없이 eventLog mock으로 매핑, 키/enum allowlist, 비밀값 배제, 호출 중복, late reject, timeout/동시 요청 상한, dev/sandbox gating, install 1회, journal replay를 검사한다. 실제 RN 화면 테스트에서는 transport throw/reject/timeout 중 KO, 무료 retry, rewarded reward+dismissed 후 1회 시작, 공유·기록 저장이 계속됨을 검증한다.

게임 UI·바이럴 결과 문구·공유 adapter·광고 controller·엔진/판정/30회·기록 schema/comparator·recent/revisit·튜토리얼·package/lockfile·기기 체크리스트는 변경하지 않는다. PlayRuntime 변경은 game_end의 선택적 계측 속성 전달뿐이며 카운터/광고/경기 상태 전이는 유지한다.

### 이번 실행 결과

| 실행 | 결과 |
|---|---|
| adapter/native/ProductEvents/RN 주요 경계 전용 테스트 5 suites | 79개 통과 |
| `npm test` | engine 47개, app 52 suites / 404개, contracts 통과 |
| `npm run typecheck:app` | 통과 |
| `npm run build:app` | RN 0.84.0/0.72.6의 Android/iOS 빌드 및 로컬 .ait 생성 통과 |
| `npm run test:preview` | 13개 통과 |
| product-loop / records browser QA | 320/390 통과 |
| recent / revisit / share browser QA | 320/375/390 통과 |
| viral result browser QA | 3크기 실제 engine 공유 흐름 및 presentation fixture 18개 통과 |
| `git diff --check` | 통과 |

기존 artifacts를 보존하려고 `artifacts/analytics-20261017/check-*.mjs` 복사본에서 import와 출력 경로만 바꾸어 실행했다. QA 환경은 `BOXING_QA_MODULES=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules`, `BOXING_BROWSER_PATH=/usr/bin/chromium`이다. 브라우저 광고/공유는 명시적 mock이며 실제 Apps in Toss 기기 검증이 아니다.

작업 시작 working tree 해시 기준 보호 파일 110개 변경 없음. screen은 event metadata 추가만, PlayRuntime은 game_end metadata 전달만 바뀌었는지 역변환 해시로 별도 확인했다. 이전 미커밋 구현과 감사 자료를 보존했다.

## 10. 실기기 게이트

C1 focus/AppState, C2 reward 이후 dismissed 누락, 실제 RN 공유창·수신 링크는 계속 검증 보류다. Analytics 연결을 구현해도 해결 또는 실기기 통과를 의미하지 않는다. Live 콘솔 수집 확인도 별도 운영 게이트다. 새 제품 기능·배포·원격 push·실제 운영 테스트 전송은 하지 않는다.
