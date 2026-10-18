# 최근 기록 기반 홈 다음 목표 — 2026-10-16

최근 경기 비교가 구현된 main working tree를 보존하며 홈 목표만 추가했다. 커밋·업로드·배포·외부 데이터 전송은 하지 않았다.

## 1. 목표 생성 규칙

`src/app/product/revisitPrompt.ts`의 순수 함수가 기존 comparator로 관계를 확인한 뒤 목표 하나를 반환한다.

| 상태 | kind / 동작 |
| --- | --- |
| recent 없음 | no_recent / 목표 숨김 |
| 둘 다 KO, recent 생존 8 / best 12 | below_best / 최고 생존 기록까지 4회 |
| 둘 다 KO, 차이 5회 초과 | below_best / 기존 결과 화면의 가까운 5회 단위 목표 재사용 |
| comparator 동점 | equals_best / 개인 최고 기록 재도전 |
| 생존 동일, PERFECT·반응시간으로 낮은 성적 | below_best / 최고 기록 재도전, 가짜 0회 차이·동점 표현 없음 |
| recent KO / best clear | below_best / 최고 기록 재도전. 과거 완주 이력을 인정하고 30회 완주를 다시 목표로 주지 않음 |
| 둘 다 clear, 목숨 동일·PERFECT가 낮음 | clear_below_best / 차이 5회 이내면 그 차이, 더 멀면 기존 PERFECT+1 목표 |
| 둘 다 clear, 목숨·반응시간 등으로 낮은 성적 | clear_below_best / 최고 기록 재도전 |
| clear 동점 | clear_best / PERFECT+1. 이미 PERFECT 30이면 최고 기록 재도전 |
| recent가 best보다 앞섬·기록 부적합·best 누락·잠긴 난이도 | invalid / 목표 숨김, 로컬 계측에 reason |

생존 목표에 도달하는 것을 comparator상 최고 갱신으로 보장하지 않는다. 정상 저장 경로의 best 갱신→recent 교체→직렬화된 단일 JSON 쓰기를 조사했으며, 개선·악화·clear 전환·복원 테스트에서 recent>best는 재현되지 않았다. 불일치 주입 시에는 정상 UX로 감추지 않고 `recent_ahead_of_best`로 진단한다. 임의 복구·초기화는 하지 않는다.

## 2. 홈 UI

기존 기록 영역에 최근 경기 문맥과 목표 문구를 작은 글씨로 추가했다. 선택 난이도 기준이며 잠긴 난이도는 제외한다. 기존 시작 버튼과 handler를 그대로 사용한다. 새 CTA·미션 화면은 없다. 브라우저 320×568, 375×667, 390×844에서 목표/시작/기록 버튼의 화면 내 위치와 실제 클릭을 검사했다.

## 3. 저장 데이터

기존 `recentByDifficulty`와 `best`를 읽기만 한다. 새 Storage 필드·방문일·history는 없다. 신규/과거 v1 사용자는 recent가 없으면 기존 흐름을 유지한다. 같은 저장 데이터로 앱 runtime을 다시 만들었을 때 같은 목표가 복원된다. 홈 진입·난이도 선택·경기 시작 시 추가 저장이 발생하지 않는 테스트를 포함했다.

## 4. 계측

기존 `landing_view`와 `game_start`에 `has_revisit_prompt`, `revisit_prompt_kind`, `revisit_prompt_issue`를 추가한다. level/runtimeId로 노출 난이도와 실행을 구분한다. 홈 출발 실제 경기만 목표 문맥을 가지며 결과 retry·다음 난이도 출발은 false/null이다. 광고 실패·reward 단독·클릭만으로 game_start를 생성하지 않는다. 별도 CTA 이벤트·외부 SDK·전송은 없다. 로컬 계약 검증이며 실제 재방문율 상승을 측정한 것은 아니다.

## 5. 검증

| 실행 | 결과 |
| --- | --- |
| `jest --runInBand src/app/__tests__/revisitPrompt.test.ts src/app/__tests__/revisitGameScreen.test.tsx` | 신규 31개 통과 (순수 함수 19, 화면 12) |
| `npm test` | 엔진 47개, 앱 330개 / 44 suites, contract 검사 통과 |
| `npm run typecheck:app` | 통과 |
| `npm run build:app` | Android/iOS × RN 0.84.0/0.72.6, 로컬 .ait 생성 성공 |
| `npm run test:preview` | 12개 통과 |
| `check-revisit.mjs` | 세 화면 크기, 난이도/재실행/불일치/완주 이력/기존 광고 gate 통과 |
| `check-recent.mjs` | 세 화면 크기, 비교·기록·CTA·모의 광고·preview recent 저장 제외 통과 |
| 기존 `check-product-loop.mjs`, `check-records.mjs` | 광고 루프·clear·기록 접근 회귀 통과 |

새 동작 및 완주 이력 경계는 구현 전 실패를 확인한 뒤 통과시켰다. 로그·JSON·스크린샷은 `artifacts/revisit-20261016/`에 보존했다. 기존 QA는 출력 경로만 바꾼 복사본을 사용해 과거 artifacts를 덮어쓰지 않았다. 실행 환경은 `BOXING_QA_MODULES=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules`, `BOXING_BROWSER_PATH=/usr/bin/chromium`이다.

## 6. 광고·최근 기록 회귀

KO1 무료, KO2 rewarded, clear death 제외/같은 난이도 무료, stage interstitial, reward+dismiss 후 실제 경기 1회, 실패 시 count 유지, 기록·결과 CTA·튜토리얼·첫 기록/최고 기록·recent 비교가 기존 테스트에서 통과했다. 특히 홈 목표가 보인 상태의 두 번째 KO gate를 실제 controller의 모의 port로 실행하고 중복 탭/콜백과 reward 단독을 검사했다.

이번 작업 직전 파일 해시와 대조해 엔진/판정/30회/난이도/모션/광고/runtime/lifecycle 관련 모듈·튜토리얼·progression comparator·recent 저장/비교·package/lockfile·기기 체크리스트 등 보호 파일 97개는 동일하다. 화면 파일의 이번 변경은 목표 표시와 계측 payload에 한정된다.

## 7. C1/C2

**실제 Apps in Toss iOS/Android의 C1 focus/AppState 순서와 C2 reward 이후 dismissed 누락은 여전히 실기기 검증 보류다.** 해결·허용 수준·1차 제품 루프 기기 완료로 판정하지 않는다. [기존 체크리스트](DEVICE_VALIDATION_V1.md)를 유지한다. 브라우저 광고는 모의 port이며 실제 SDK 완료를 입증하지 않는다.

## 8. 다음 후보

다음 제품 기능 후보는 결과 공유다. 별도 결정 전에 구현하지 않는다. 스트릭·출석·랭킹·오늘의 코스·친구 대결·푸시는 이번에 추가하지 않았다.
