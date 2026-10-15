# 1차 제품 루프 — Apps in Toss 실기기 검증 체크리스트

상태: **실기기 실행 전 / 미검증**. 클라우드 회귀 통과는 실기기 통과가 아니다. 이 문서 작성 단계에서는 제품 코드, 광고 설정, lifecycle, 튜토리얼을 변경하지 않는다.

기준 소스: 로컬 태그 `v1-product-loop-baseline`. 테스트할 빌드의 정확한 hash는 다음 명령으로 확인하고 각 실행 기록에 적는다.

```sh
git rev-parse 'v1-product-loop-baseline^{commit}'
git status --short
```

앱 package version만으로 빌드를 식별하지 않는다. QR/설치에 사용한 .ait 파일명·SHA-256·빌드 시각·commit hash를 함께 기록한다. 기준 코드로 만든 빌드인지 확인한다. 이번 작업에는 외부 배포·콘솔 변경·새 지면 생성이 포함되지 않는다.

## 1. 준비 및 관측 가능성

- [ ] 실제 iPhone/iOS와 Android 기기를 각각 준비한다. 모델, OS, Toss 버전, 앱 버전, commit hash, 네트워크(Wi-Fi/모바일/제한)를 기록한다.
- [ ] 허용된 Apps in Toss Sandbox/QR 실기기 환경을 사용한다. 현재 지면/SDK 설정을 보존하고 실제 callback이 오는지 확인한다. DEV PREVIEW의 `qaAds=1`은 실기기 증거로 사용하지 않는다.
- [ ] 초기 runtime을 준비한다. 단순 홈 이동이나 미니앱 닫기를 프로세스 종료로 간주하지 않는다. Toss 프로세스를 완전히 종료한 뒤 새로 실행하고 새 runtimeId 및 deathCount=0을 확인한다. 기존 기록은 삭제하지 않는다.
- [ ] 화면 녹화와 기기 로그를 함께 시작한다. 테스트 계정 외 개인 정보·토큰은 기록하지 않는다.
- [ ] 아래 로그를 비중단 logpoint 또는 사용 가능한 호스트 디버깅 기능으로 수집한다. 타이밍 검사 중 멈추는 breakpoint는 쓰지 않는다. 디버거가 타이밍에 영향을 줄 수 있으므로 이상이 있으면 디버거 없는 화면 녹화로도 반복한다.

### 코드 변경 없이 수집할 로그

| 관찰 대상 | 위치/방법 | 필수 내용 |
| --- | --- | --- |
| 제품 이벤트 | `src/app/product/playRuntime.ts`의 `track`, 또는 debugger scope에서 `runtime.events.snapshot()` 읽기 | at, runtimeId, roundId, previousRoundId, source, deathsSinceLastAd, event name |
| 원본 광고 callback | `src/app/ads/rewardedRetryAd.ts`의 load/show `onEvent`, `onError` 진입부 | 수신 시각, 원본 event.type, error 종류, 해당 광고 요청. active 검사 **이전** 수신도 구분 |
| AppState 변화 | `P0GameScreen.tsx`의 `AppState.addEventListener('change', ...)` | 시각, 전달된 state, `AppState.currentState` |
| focus/blur | 같은 파일의 focus/blur listener 진입부 | 시각, focus 또는 blur, `AppState.currentState`, 가능하면 foregroundRef 값 |
| 실제 경기 시작 | 같은 파일의 session.start 다음 runtime.startRound 및 game_start | 시각, roundId, source, 이전 경기 ID, 당시 AppState/화면 가시성 |
| 경기 진행 여부 | background 진입 직전과 복귀 시 session snapshot 읽기 + 화면 녹화 | 결과 수, 목숨, 경기 시계, 준비 상태, 첫 공격/피격 시각 |

예: 해당 handler의 유효한 scope에 비중단 logpoint로 `Date.now()`, state/event.type, `AppState.currentState`를 남긴다. JS 로그와 녹화의 공통 시작 마커를 기록하고 동일 시계의 ms 순서로 비교한다. Android에서 가능하면 호스트 Activity resumed/window focus 로그도 같이 남긴다.

현재 제품 journal은 AppState/focus를 저장하지 않고 최대 500개 이벤트만 runtime 메모리에 보관한다. 앱 종료나 500개 초과 전에 필요한 로그를 로컬로 내보낸다. `playRuntime`은 전역 객체로 노출되어 있다고 가정하지 않는다. debugger scope에서 접근해야 한다. 단순 제품 journal에는 중복/무시된 원본 SDK callback이 모두 남지 않으므로 C2는 원본 수신 로그도 필요하다.

- [ ] 실제 환경에서 위 로그 접근 방법을 확인했다.
- [ ] 접근할 수 없으면 C1/C2는 **검증 불가(관측 수단 부재)**로 남긴다. 별도 진단 빌드가 필요하면 그 사실을 기록하며 이번 기준 코드에 로깅 기능을 임의 추가하지 않는다.
- [ ] iOS에서 RN focus/blur 이벤트가 제공되지 않으면 `N/A: 플랫폼 미제공`으로 기록한다. AppState 및 실제 화면 복귀 시점은 여전히 확인한다. Android focus 순서 검사를 생략하는 근거로 사용하지 않는다.

## 2. 기본 루프 — 두 OS에서 각각 수행

각 행을 독립 실행 기록과 연결한다. KO는 입력하지 않아 목숨을 소진하는 방식으로 재현할 수 있다. deathCount를 debugger에서 강제로 바꾸지 않는다.

| ID | 실행 절차 | 기대 결과 | iOS / Android |
| --- | --- | --- | --- |
| B01 | 새 runtime에서 시작. 신규 사용자라면 몸풀기 수행 후 실제 경기 진입 | count=0. 몸풀기는 경기/KO/광고 보상에 포함되지 않음 | □ / □ |
| B02 | 첫 경기 KO → 결과의 다시 도전 탭 | 0→1. full-screen 광고 **표시 없이** 새로운 game_start 1회, free_retry 연결 | □ / □ |
| B03 | 재경기에서 두 번째 KO → CTA 확인 → 탭 | 1→2. 광고 필요 문구 표시. rewarded 1회 표시, 완료 전 새 경기 없음 | □ / □ |
| B04 | rewarded 정상 시청·닫기 | reward AND dismissed 후 2→0. foreground에서 짧은 준비와 game_start 정확히 1회. 추가 CTA 불필요 | □ / □ |
| B05 | 이어진 경기 KO → 무료 retry → 다시 KO | 다시 0→1 무료, 1→2 광고 조건. 한 번의 완료로 이후 광고가 영구 면제되지 않음 | □ / □ |
| B06 | B03 결과에서 같은 패턴/다른 패턴, 홈, 기록, 해금된 난이도 선택을 각각 시도 | runtime count=2 유지. 실제 다음 경기 전에 rewarded 필요. records banner가 스크롤/CTA를 가리지 않음 | □ / □ |
| B07 | count=0 또는 1에서 실제 30회 완주 → 같은 난이도 retry | clear는 count 유지. 같은 난이도 retry 무료, 새 경기 1회 | □ / □ |
| B08 | clear → 새 난이도 이동 | 기존 interstitial 정책 적용. 같은 행동에서 rewarded 연속 표시 없음. count 유지 | □ / □ |
| B09 | KO1 → 무료 retry → clear → interstitial → 새 난이도 KO | count 1 유지 후 2. 다음 retry rewarded 요구는 현재 정책상 정상. 광고 간 시간도 기록 | □ / □ |
| B10 | count=2에서 화면 재진입/remount가 가능한 실제 경로 → 광고 완료 | 동일 runtime이면 count 유지. previousRoundId 연결된 retry_game_start 및 실제 경기 각각 1회 | □ / □ |
| B11 | count=2에서 Toss 프로세스 완전 종료 → 새 실행 | 새 runtimeId, count=0. 최고 기록은 유지 | □ / □ |
| B12 | 무료/광고/다음 단계 CTA를 빠르게 반복 탭, 광고 로딩 중 홈·기록·다른 CTA 시도 | 같은 행동으로 복수 show/복수 경기 생성 없음. rewarded와 interstitial 동시 표시 없음 | □ / □ |

광고 preload 요청과 화면 표시를 혼동하지 않는다. 첫 KO에서 금지되는 것은 재도전을 막는 광고 표시이며 다른 지면 preload 유무는 별도 기록한다. 중복 광고는 adRequestId별 요청/표시와 사용자의 별도 재시도 행동을 구분해 판정한다.

## 3. 광고 callback 및 lifecycle — 기본 전제 count=2

매 시나리오 전에 실제 KO로 count=2를 만들고 요청 ID를 기록한다. 성공 후 다음 시나리오의 count를 다시 준비한다. SDK callback 순서를 임의 주입해 실기기에서 관찰한 것으로 보고하지 않는다. 가능한 광고 소재/기기/네트워크에서 관측하고, 나오지 않은 순서나 오류는 `미재현`으로 남긴다.

| ID | 실행 절차 | 기대 결과/기록 | iOS / Android |
| --- | --- | --- | --- |
| A01 | 정상 완료 중 reward→dismissed 순서 관찰 | reward만 도착하면 count=2·재경기 없음. dismissed 뒤 0·재경기 1회 | □ / □ |
| A02 | 정상 완료 중 dismissed→reward 순서 관찰 | dismissed만으로 성공 아님. 이후 reward 도착 시 0·재경기 1회. 관측되지 않으면 미재현 | □ / □ |
| A03 | 보상 획득 전 광고의 닫기/취소를 사용 | 보상이 실제로 없으면 count=2, 무료 재경기 없음. 닫기 제공 여부 및 후속 reward 유무 기록 | □ / □ |
| A04 | 광고 로딩 전 네트워크 차단/제한 후 retry | 실제 load error/timeout 확인 시 count=2. 연결 복구 후 명시적 광고 재시도 가능 | □ / □ |
| A05 | loaded 이후 표시 전 네트워크 변화 등 허용된 수동 조건에서 표시 실패 유도 | failedToShow/onError가 실제 수신되면 count=2·재경기 없음. 캐시 광고가 정상 표시되면 실패 재현으로 세지 않음 | □ / □ |
| A06 | 광고 중 홈으로 나가 background 유지 → 광고 종료/복귀 | background에서 game_start/공격 진행 없음. 두 성공 callback이 모두 오면 count=0 가능하나 실제 경기 시작은 foreground까지 대기 | □ / □ |
| A07 | 광고 재생 도중 다시 foreground 복귀 | 광고/경기 화면이 중복되지 않음. 정상 완료 후 준비→경기 1회 | □ / □ |
| A08 | 광고 중 잠금 → 10초 이상 대기 → 해제 | 숨겨진 동안 공격/목숨 소모 없음. 실제 복귀와 callback 순서 기록 | □ / □ |
| A09 | 광고 중 다른 앱 이동 → 대기 → 복귀, 빠른 전환도 반복 | 중복 광고/경기 및 백그라운드 진행 없음 | □ / □ |
| A10 | Android 광고 중 시스템 뒤로가기(제스처 포함) | 실제 닫기/무시/호스트 이탈 동작 기록. 보상 없는 닫기는 count=2. 앱 이탈 후 늦은 callback 오염 없음 | N/A / □ |
| A11 | Android 알림창을 내렸다 닫기. iOS는 제어센터/알림센터 진입·복귀 | AppState 변화 유무와 focus/blur를 별도 기록. 사용자에게 보이지 않을 때 경기 진행 없음 | □ / □ |
| A12 | 광고 직전/오류 후 빠른 화면 전환, 가능한 경우 미니앱 닫기·재진입 | unmount된 화면의 늦은 callback이 새 경기 생성/카운터 중복 초기화를 일으키지 않음. runtime 유지 여부 함께 기록 | □ / □ |

실패 시 광고 다시 시도 및 홈 이동 가능 여부도 기록한다. 보상 없는 종료에서 자동 무료 재경기를 기대하지 않는다. 일반 경기 도중 background 후 수동 계속하기가 필요한 기존 동작과 광고 완료 후 자동 준비 복귀를 구분한다.

## 4. C1 집중 검사 — 실제 foreground보다 먼저 시작되는가

A06~A12에서 다음 순서 각각을 실제로 수집한다. Android에서는 두 순서가 관찰되는지 반복하고 관찰 횟수를 남긴다. 발생하지 않은 순서는 미재현이다.

- [ ] `focus → AppState active`
- [ ] `AppState active → focus`
- [ ] `focus`만 발생하고 AppState는 이미 active였던 경우(예: 알림창)
- [ ] reward/dismissed 완료가 background/inactive 상태에서 도착한 경우

각 trace에 광고 창 종료 시각, focus, AppState active, 호스트 실제 화면 가시성/조작 가능 시각, game_start, 준비 표시, 첫 공격 시각을 나란히 적는다. active 하나만 보고 실제 화면이 foreground라고 단정하지 않는다.

**결함 판정:** 실제 앱 화면이 foreground가 되기 전에 game_start가 발생하거나, 화면보다 게임이 먼저 진행하거나, 숨겨진 동안 공격 해결/피격/목숨 감소가 발생하면 C1 결함으로 기록한다. 준비 표시만 확인하고 통과시키지 않는다. 시작 시점 로그나 화면 증거가 없으면 검증 불가다. 재현 전 lifecycle 코드를 추측으로 수정하지 않는다.

## 5. C2 집중 검사 — reward 후 dismissed 누락

- [ ] 원본 userEarnedReward 수신 시각과 요청 ID 기록.
- [ ] 같은 요청의 원본 dismissed 수신 여부/시각 기록. 화면을 닫은 사실과 callback 수신을 구분.
- [ ] 광고 창이 닫혔는데 dismissed가 없으면 정상 foreground에서 계속 관찰한다. 기존 show 타임아웃(120초, background의 타이머 지연 가능)을 포함한 실제 대기 시간을 기록한다.
- [ ] 즉시 재시도하기 전 로그를 보존한다. 나중에 dismissed가 도착했는지, 앱 종료/unmount로 이전 요청이 폐기됐는지 구분한다.
- [ ] `reward 수신 → dismissed 미수신 → 사용자가 다시 광고를 봐야 함`이 발생하면 반드시 C2 사례로 기록한다. count, 지연, 안내 문구, 재시도 횟수/추가 광고 수, 이탈 여부를 남긴다.
- [ ] 새 광고를 시작한 뒤 온 과거 callback과 원래 요청의 정상 지연 완료를 구분한다.

정책은 reward AND dismissed이며 120초 자동 성공을 기대하지 않는다. journal 유실·디버거 단절 때문에 수신 여부를 모르는 경우 callback 누락으로 확정하지 않는다. 관측된 보상 획득 요청 수 N, dismissed 누락 사례 수 M, 재시청 강제 사례 수 K, 최대 지연을 OS별로 보고한다. 0/N은 관찰 범위에서의 결과이며 발생 불가능의 증거가 아니다.

**허용 가능한 수준은 아직 수치로 확정하지 않았다.** C2가 발생했다면 M/N, K/N과 사용자 영향을 제시해 제품 책임자의 명시적 수용 판단을 기록한다. 검증자가 임의 임계치를 만들거나 자동 복구를 추가하지 않는다.

## 6. 시나리오별 기록 양식

각 실행마다 복사한다. 공란 대신 미관측/미재현/N/A와 이유를 적는다.

```text
실행 ID / 시나리오 ID / 실행자 / 일시:
기기 모델 / OS 버전 / Toss 버전:
앱 버전 / commit hash / .ait SHA-256 / 빌드 시각:
runtimeId / roundId / previousRoundId / 난이도:
네트워크 / 디버거 연결 여부 / 시작 전 기록 유무:
사전 조건 및 실제 조작 순서:
deathCount 전 → 후:
광고 format / adRequestId:
광고 원본 이벤트 순서 (각각 ms 포함):
제품 광고 이벤트 순서 (ad_start/reward/dismissed/complete/fail):
AppState 이벤트 순서 (각각 ms 포함):
focus/blur 이벤트 순서 (각각 ms 포함, 미제공이면 N/A):
호스트 foreground 및 실제 화면 가시성 시각:
실제 game_start 시각 / roundId / 발생 횟수:
retry_game_start 횟수 / 이전 round 연결:
준비 화면 시각 / 첫 공격 시각:
background 전·후 결과 수 / 목숨 / 경기 시계:
문제 발생 여부 / 기대 결과 / 실제 결과:
결과: PASS / FAIL / 미재현 / 검증 불가 / N/A
영상·원본 로그 경로 / C1·C2 분류 / 비고:
```

타임라인 상세 양식:

| 순서 | 동일 기기 시각(ms) | 관찰원(JS/호스트/영상) | 이벤트·상태 | count | roundId / adRequestId | 화면 가시성 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |

## 7. 최종 판정과 후속 작업 제한

iOS/Android 각각 결과와 증거를 취합한다. 현재는 모두 미검증이다.

- [ ] 첫 KO에서 광고 없이 실제 무료 재경기 진입.
- [ ] 두 번째 KO에서 rewarded 요구.
- [ ] 정상 광고 완료 후 실제 game_start 정확히 1회.
- [ ] 중복 광고 없음.
- [ ] background에서 경기 진행 없음.
- [ ] C1 문제 없음: 실제 foreground/화면 및 이벤트 순서 증거 확보.
- [ ] C2 문제 없음(관찰 표본 명시), 또는 발생률·영향을 근거로 제품 책임자가 명시적으로 수용.

판정 기록: iOS 결과 ___ / Android 결과 ___ / 미재현·검증 불가 목록 ___ / C2 수용 여부·판정자·날짜 ___ / 증거 경로 ___

위 조건을 실제로 확인한 뒤 **1차 제품 루프 완료**로 판정한다. 관측 공백이나 결함이 남으면 클라우드 기준선 상태를 유지하고 미확인 항목을 명시한다. 그 이후에만 최근 기록 비교·재방문 이유·결과 공유 등 2차 개선으로 넘어간다. 이 체크리스트 작성이나 태그 생성 자체는 실기기 통과 선언이 아니다.
