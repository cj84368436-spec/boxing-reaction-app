# 결과 화면 정보 위계 개선 — 2026-10-17

## 1. 기존 문제

결과·비교·목표·관장 카드·최고 기록·실패 복기·요약이 같은 스크롤 영역에 누적됐다. 상세 로그 toggle이 CTA보다 앞에 있었고 작은 화면의 초기 스크롤 영역에서는 관장 평가가 보이지 않았다. 기존 고정 하단 재도전은 유지되었으나, 상단 기록이 작은 17px 문장이었다. 이전 화면 증거: `artifacts/viral-20261017/before/share-result-320.png`.

## 2. 변경된 위계

게임명/난이도 → 짧은 타이틀 → 큰 `N / 30` → 생존/완주·PERFECT → 관장 한 줄 → 최근/최고 비교 → 가까운 목표 → primary 재도전 → 친구 질문/공유 → 단계/패턴/홈 보조 행동 → 접힌 상세 복기.

결과 전체를 하나의 스크롤로 구성했다. 상세 피드백, 기존 인정/해금 정보, PERFECT/SAFE/HIT 요약, 실패 복기와 공격 로그는 삭제하지 않고 상세 toggle 안에 보존했다. 저장 실패/온라인 상태 안내는 접힌 영역 밖에 둔다. 홈 구조는 유지한다.

## 3. 관장 문구 규칙

`buildViralResultPresentation` 순수 함수는 난수 없이 다음 순서로 판단한다.

- 완주: `끝까지 버텼군`과 실제 PERFECT 수. 30 PERFECT는 `빈틈없이 끝냈군`.
- KO 생존 증가: 실제 차이를 사용해 `지난번보다 6회 더 버텼군. 15번째도 버텨봐.`
- 반복 피격: 실제 HIT 중 알려진 공격의 최다 횟수가 2 이상일 때만 `잽에 2번 맞았군. 다음엔 그 주먹부터 읽어봐.` 동률은 고정 순서.
- 그 외: 현재 생존 수와 다음 한 번을 언급. 하락을 개선으로 해석하지 않는다.

기존 가까운 목표 규칙과 comparator는 변경하지 않았다. `resultFacts`의 실제 기록 수치/최고 갱신 판정을 화면과 공유 문구가 함께 사용한다. 과거 v1 best를 새 recent 자격 조건으로 배제하지 않는다.

## 4. 공유 CTA

`친구는 몇 회까지 버틸까?` / 완주 시 `친구도 끝까지 버틸 수 있을까?` 아래에 `친구에게 기록 보내기`를 배치했다. 기존 RN Share adapter, 링크 생성, 중복 잠금, 오류/취소 및 계측 계약은 그대로 사용한다. 이모지, 도전장/친구 대결 약속, 공유 보상 없음.

## 5. 결과 예시

| 경우 | 표시 |
|---|---|
| 첫 경기 4/30 | 첫 기록을 남겼어요 · 목표 5번째, 최고 갱신 주장 없음 |
| 8 → 14 | 지난 경기 8/30 · +6, 실제 6회 증가 관장 평가 |
| 17 → 12 | 지난 경기 17/30 · −5, 억지 개선 문구 없음 |
| 실제 최고 갱신 | 새로운 최고 기록! · 첫 기록과 분리 |
| 30/30 완주 | 금색 기록·완주 타이틀, 실제 PERFECT와 다음 목표 |
| 완주+최고 갱신 | 최고 갱신 표시는 1회, 관장 문구에 중복 축하 없음 |
| 반복 피격 | 잽/스트레이트/훅/어퍼컷 각각 실제 공격명과 HIT 횟수 |

## 6. 작은 화면

320×568, 375×667, 390×844에서 Playwright로 확인했다. 실제 엔진 경기 결과의 공유/재도전 흐름 3건과 결과 presentation fixture 6종 × 3크기를 구분해 검사했다. fixture는 저장된 실제 경기로 집계하지 않으며 UI와 공유 생성 함수의 일치 검증에만 사용했다.

- 결과·관장 평가·primary 재도전이 초기 스크롤 viewport 안에 있음.
- 공유와 상세 toggle은 클릭 또는 스크롤 후 클릭 가능. 상세 내용 펼침/접힘 확인.
- 작은 화면에서는 하단 보조 행동/상세 내용에 스크롤이 필요할 수 있다.
- 실제 기기 글자 확대/폰트/공유창은 검증하지 못했다. 캡처가 곧 사용자 체감 품질이나 바이럴 효과의 증거는 아니다.

증거: `artifacts/viral-20261017/viral-browser.json`, `share-result-*.png`(엔진 경기), `viral-*-*.png`(presentation fixture).

## 7. 공유/재도전 회귀

RN 및 browser mock에서 공유 탭, 취소, 오류, 중복 탭, 늦은 링크/콜백, 결과 복귀 후 재도전을 검증했다. KO1 무료, KO2 rewarded, clear 사망 제외/같은 난이도 무료, 다음 단계 interstitial, reward+닫힘 완료, background 경기 보류, 홈/기록 이동 카운터 보존 회귀 통과.

기존 recent/revisit/records browser QA 통과. result_view/share_tap/share_outcome/retry_game_start 이벤트 이름·전송 방식은 변경하지 않았다. 새 variant나 analytics SDK 없음. 공유 시도율과 실제 재경기율을 기존 roundId로 함께 분석할 수 있으나 외부 수집은 여전히 없다.

## 8. 실행 검증

| 명령 | 결과 |
|---|---|
| `npm run test:app -- --runTestsByPath src/app/__tests__/viralResult.test.ts src/app/__tests__/shareGameScreen.test.tsx src/app/__tests__/ResultShareButton.test.tsx src/app/__tests__/shareResult.test.ts src/app/__tests__/resultShareAdapter.test.ts` | 초기 35개 통과, 이후 legacy best 사례 1개 추가는 전체 검사에 포함 |
| `npm run test:app -- --runTestsByPath src/app/__tests__/ViralResultHeader.test.tsx` | 6개 통과 |
| `npm test` | 엔진 47개, 앱 50 suites / 372개, contracts 통과 |
| `npm run typecheck:app` | 통과 |
| `npm run build:app` | RN 0.84.0 / 0.72.6 iOS·Android 빌드 통과, .ait 로컬 생성 |
| `npm run test:preview` | 13개 통과 |
| `node tools/browser-preview/check-viral-result.mjs` | 3크기 실제 엔진 공유 흐름 + 18개 presentation fixture 통과 |
| 기존 product-loop/share/recent/revisit/records QA | 통과 |
| `git diff --check` | 통과 |

Browser 환경: `BOXING_QA_MODULES=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules`, `BOXING_BROWSER_PATH=/usr/bin/chromium`.

기존 QA 결과를 덮어쓰지 않도록 기존 QA를 `artifacts/viral-20261017/check-*.mjs`에 복사해 import/출력 경로만 조정하여 실행했다. 원본 product-loop는 새 완주 제목 위치로, recent QA는 줄바꿈 및 상세 펼치기 동작으로 기대값을 갱신했다. 관련 기능 검사를 삭제하지 않았다.

작업 시작 working tree hash 대비 보호 파일 100개 변경 없음: 엔진·세션/기록 schema/comparator·광고 controller·모션/PNG/WAV·runtime counter·recent/revisit·튜토리얼·share adapter·package/lockfile·실기기 체크리스트. 기존 미커밋 최근 기록/재방문/공유 구현을 보존했다. 커밋/업로드/배포/실제 공유 전송 없음.

## 9. 실기기 보류

C1 focus/AppState 순서, C2 reward 이후 dismissed 누락은 계속 Apps in Toss 기기 검증 보류다. 실제 RN 공유창 결과, 수신 링크 진입도 미검증이다. 기존 `DEVICE_VALIDATION_V1.md`를 삭제하거나 통과 처리하지 않았다.

## 10. 다음 단계 후보

실제 iOS/Android에서 기존 광고/lifecycle 게이트와 공유창·앱 링크를 확인한다. 이후 result_view→share_tap과 result_view→retry_game_start를 함께 관찰해 화면 효과를 평가한다. 친구 대결·같은 seed challenge·랭킹 등은 구현하지 않았으며 별도 제품 판단 대상이다.
