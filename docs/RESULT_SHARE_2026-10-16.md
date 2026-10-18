# 결과 텍스트 공유 — 2026-10-16

기존 recent/revisit 구현이 있는 main working tree를 보존하고 결과 공유만 추가했다. 새 의존성·커밋·원격 push·업로드·배포·실제 외부 메시지 전송은 하지 않았다.

## 1. 사용한 API와 근거

- Native 공유: React Native `Share.share({title,message}, {dialogTitle,subject})`.
- 설치된 Apps in Toss 2.10.10 `@apps-in-toss/native-modules/dist/index.d.ts`는 `share({message}): Promise<void>`를 공개한다. 그러나 해당 `dist/index.js`의 구현은 `CommonModule2.share(message)`를 반환/await하지 않는다. 따라서 공유창 종료까지 요청 잠금을 유지하거나 취소를 식별하는 API로 선택하지 않았다.
- 설치된 React Native의 `Libraries/Share/Share.js`는 iOS에서 sharedAction/dismissedAction을, Android에서 sharedAction을 반환한다. Android `ReactAndroid/src/main/java/com/facebook/react/modules/share/ShareModule.kt`는 chooser를 startActivity한 직후 Promise를 resolve한다. Android 응답을 실제 공유 완료나 취소로 해석하지 않는다.
- 공식 SDK `getTossShareLink`는 기존 `intoss://<appName>` 경로의 공유 URL 생성을 지원한다. `granite.config.ts`의 scheme/appName 및 기존 루트 진입 문서와 일치하는 `intoss://boxing-talent-test`만 사용한다.
- 설치된 타입/소스와 빌드가 근거다. 실제 Toss 호스트가 각 기기에서 RN Share native module을 제공하고 올바르게 반환하는지는 아직 실기기 미검증이다.

## 2. 공유 내용

순수 함수 `buildShareResult`가 난이도, 이번 생존 수/30 또는 완주, PERFECT 수를 만든다. 저장 전 previousBest와 기존 comparator로 실제 갱신한 경우에만 ‘새로운 개인 최고’를 표시한다. 첫 기록·동점에는 붙이지 않는다. 최고 갱신 문구가 없을 때 실제 recent 개선 한 줄을 선택적으로 포함하고 하락 비교는 생략한다.

예: `복싱 감각 테스트 / 입문 · 12 / 30 버텼어요 / PERFECT 8회 / 지난 경기보다 4회 더 버텼어요 / 내 기록에도 도전해보세요.` 각 항목은 실제 메시지에서 줄바꿈된다.

이모티콘·가짜 능력 평가·랭킹·백분위와 실명/계정/전화번호/user identifier/runtimeId/roundId/광고 ID/seed는 payload에 넣지 않는다. 이미지 생성·파일 권한·공유 보상은 없다.

## 3. UI

재도전 및 기존 결과 보조 버튼 아래에 낮은 강조의 `결과 공유` 버튼을 배치했다. 결과/피드백 영역은 기존 스크롤을 유지한다. 새 컴포넌트가 공유 상태와 오류 안내를 관리하며 기존 화면의 시작/재도전/lifecycle handler를 수정하지 않았다.

## 4. 링크와 유입

사용자가 공유를 누를 때 `getTossShareLink`를 호출하고 반환된 HTTPS URL만 메시지 끝에 붙인다. SDK 오류·유효하지 않은 URL·1.5초 초과 시 텍스트만 공유한다. 늦게 반환된 URL로 두 번째 공유를 실행하지 않는다.

링크는 앱 홈 진입이다. 실제 공개 링크 생성/수신/열기 및 배포된 앱으로의 연결은 기기에서 확인해야 한다. 현재 작업본을 자동 업로드하지 않는다. seed·난이도 자동 실행·친구 기록 전달·공유 유입 파라미터를 만들지 않았다. **공유 시도 측정 가능, 공유 유입 측정은 아직 불가**다.

## 5. 계측

기존 fail-open 로컬 ProductEvents에 `share_tap`, `share_outcome`만 추가했다. 내부 속성은 roundId, difficulty, result_type, survived, perfect, is_personal_best, has_recent_comparison이다. 마지막 속성은 결과 화면 비교의 존재 여부이며 비교 문구의 공유 포함 여부와는 다르다. outcome에는 준비된 링크 유무인 has_link도 포함한다.

| 상태 | 기록 | 의미 |
| --- | --- | --- |
| iOS sharedAction | activity_completed | OS 공유 활동 완료 응답. 상대방 수신을 증명하지 않음 |
| iOS dismissedAction | cancelled | 사용자 취소 응답 |
| Android sharedAction | sheet_open | chooser 호출 응답. 실제 전송/취소를 구분하지 못함 |
| 알 수 없는 native action | unconfirmed | 성공으로 추정하지 않음 |
| 예외 | failed | 오류를 격리 |
| 지원하지 않는 플랫폼 | unsupported | native 요청 없음 |
| 링크 대기 중 결과 이탈/새 경기/광고 시작 | abandoned | 공유창을 열지 않고 요청 폐기 |

외부 analytics 전송은 없다. 실제 수신율/공유 유입 전환율을 계산한 것이 아니다.

## 6. 오류·취소·중복

singleton adapter의 요청 잠금과 컴포넌트의 즉시 ref 잠금으로 중복 native 호출을 막는다. Android는 즉시 resolve하는 chooser handoff를 고려해 1초 동안 잠금을 더 유지한다. 실제 OS modal이 입력을 소유하는 동작과 Android 뒤로가기 후 재시도는 기기 확인 항목이다.

공유 취소·오류·지연은 deathCount/기록/광고 상태/경기 세션을 변경하지 않는다. 실패하면 짧은 안내 후 재시도할 수 있고 재도전 CTA는 계속 동작한다. 링크 대기 중 재도전/화면 이탈 시 실제 native 공유를 호출하지 않는다. 늦은 native 응답은 이전 round의 로컬 이벤트만 기록하며 새 화면을 갱신하지 않는다. Analytics 예외도 공유/게임을 막지 않는다.

## 7. 이번 실행 검증

| 실행 | 결과 |
| --- | --- |
| 공유 전용 Jest 4 suites (`shareResult`, `resultShareAdapter`, `ResultShareButton`, `shareGameScreen`) | 25/25 통과 |
| `npm test` | 엔진 47/47, 앱 355/355 / 48 suites, contract 검사 통과 |
| `npm run typecheck:app` | 통과 |
| `npm run build:app` | Android/iOS × RN 0.84.0/0.72.6 빌드 및 로컬 AIT 생성 성공 |
| `npm run test:preview` | 13/13 통과 |
| `check-share.mjs` | 320×568, 375×667, 390×844: 문구/개인정보 제외/클릭/중복/취소/모의 활동 완료/오류/재도전 통과 |
| `check-recent.mjs`, `check-revisit.mjs` | 동일 세 크기에서 기존 비교·홈 목표·기록·시작 경로 통과 |
| 기존 `check-product-loop.mjs`, `check-records.mjs` | 광고·clear·기록 화면 회귀 통과 |
| `git diff --check`, 작업 전 파일 해시 대조 | whitespace 오류 없음, 보호 파일 97개 동일 |

공유 모듈의 preview 서버 허용 경로 누락은 실행 중 확인하여 해당 파일만 명시적으로 허용했고 HTTP 회귀 테스트를 추가했다. native adapter 소스는 preview에서 제공하지 않는다. 기본 preview는 공유 미지원 안내, `qaShare=1`은 모의 UI/응답만 사용하며 실제 전송이 없다. 이벤트에도 preview_mock=true를 표시한다.

로그·JSON·스크린샷은 `artifacts/share-20261016/`에 보존했다. QA 환경: `BOXING_QA_MODULES=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules`, `BOXING_BROWSER_PATH=/usr/bin/chromium`. 기존 QA의 출력 경로만 바꾼 복사본을 사용하여 과거 증거를 덮어쓰지 않았다.

## 8. 기존 루프와 보호 영역

KO1 무료, KO2 rewarded, clear 같은 난이도 무료, reward+dismiss 후 경기 1회, recent 비교, revisit 목표, 튜토리얼, records 회귀가 통과했다. 실제 P0 session을 진행한 RN 테스트에서 공유 취소/오류 뒤 기록 쓰기 횟수와 deathCount가 동일하고 다음 무료/광고 재경기가 시작되는 것을 확인했다.

엔진·공격·타이밍·판정·30회·난이도·모션·가드·광고 controller·runtime death counter·튜토리얼·recent 저장 모델·revisit 규칙·comparator·package.json/package-lock.json은 작업 전과 동일하다. 메인 화면 변경은 공유 컴포넌트 import/결과 CTA 삽입뿐이다. ProductEvents는 이벤트 이름 union만 확장했다.

## 9. 실기기 보류

**C1 focus/AppState 순서 및 C2 reward 후 dismissed 누락은 여전히 Apps in Toss 실기기 검증 보류다.** [기존 체크리스트](DEVICE_VALIDATION_V1.md)는 변경하지 않았다. 이번 모의 공유 background/active 테스트를 C1/C2 통과로 해석하지 않는다.

공유 자체도 iPhone/Android에서 native module 지원, 공유창 실제 표시/취소/복귀, Android 빠른 반복 탭·뒤로가기, 오류 후 재도전, 실제 URL 생성·수신 앱에서 열기를 별도로 검증해야 한다. 실제 전달·수신을 확인했다고 선언하지 않는다.

## 10. 다음 단계

우선 실제 공유창과 공유 링크의 앱 진입을 확인한다. 친구 대결/동일 조건 challenge는 현재 필수가 아니며 사용자 필요가 확인된 후 별도 검토한다. 이번 구현에는 포함하지 않았다.
