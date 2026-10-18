# 최근 경기 1회 비교 — 2026-10-16

기준: `v1-product-loop-baseline` / `be1f723c803a07ef2bf1f0c78cb8013e2d54fb73`, main working tree. 이번 범위는 최근 경기 비교뿐이다. 커밋·업로드·배포·외부 계측 전송은 하지 않았다.

## 저장과 호환

- 기존 `boxing-survival-v1`, `version:1`, `RoundRecord` 필드를 유지하고 선택 필드 `recentByDifficulty`만 추가했다. 난이도별 최대 1회, 전체 최대 3회다. 별도 history는 없다.
- 기존 v1 데이터에 recent가 없으면 정상 로드하고 비교를 숨긴다. 기존 최고 기록으로 최근 기록을 만들어내지 않는다. 최고 기록·해금·연속 PERFECT와 comparator는 유지한다.
- 제품 roundId의 정상 game_end 승인과 완결된 record를 확인한다. 기존 결과 저장 경계에서 직전 recent로 비교를 만든 뒤 이번 경기로 교체한다. best와 recent를 기존 큐로 한 번에 저장한다. 결과 재렌더/상세 로그 열기는 다시 저장하지 않는다.
- clear/knockout만 포함한다. 튜토리얼·시작 전·중단·거부된 종료·광고 실패는 recent를 만들지 않는다. preview는 주입 fixture의 비교를 표시하지만 가짜 경기를 recent로 저장하지 않는다.
- 잘못된 recent 항목은 제외하고 다른 난이도와 best를 복구한다. 기존 손상 원문 백업/저장 실패 정책을 그대로 따른다. 쓰기 실패 시 이번 실행의 메모리 기록을 유지하고 결과·무료/광고 재도전을 계속할 수 있다. 실패한 쓰기의 앱 재시작 후 복원은 보장하지 않는다.

## 비교와 화면

| 직전 → 이번 | 표시 |
| --- | --- |
| recent 없음 | 비교 없음, 기존 첫 기록 UX |
| 8 → 12 | 지난 경기보다 4회 더 버텼어요 |
| 15 → 10 | 지난 경기보다 5회 적게 버텼어요 |
| 12 → 12, PERFECT 동일 | 생존 수와 완벽 회피 수가 같아요 |
| KO 24 → clear | 이번에는 30회 완주했어요 |
| clear → KO 11 | 지난 경기는 완주 · 이번에는 11 / 30 |
| clear → clear | 달라진 목숨/PERFECT의 이전 → 현재 값 |

완주 목숨이 증가하고 PERFECT가 감소하면 `mixed`로 분류한다. 생존이 같아도 PERFECT가 다르면 그 변화를 표시한다. 표시 지표가 같다는 말은 반응시간·streak까지 같은 성적이라는 의미가 아니다. 최고 기록 판단에는 기존 comparator를 사용한다. 직전 KO만으로 생애 첫 완주라고 단정하지 않는다.

결과 제목 아래 작은 비교 문구를 추가했다. 가까운 목표/피드백/상세 기록과 고정 재도전 CTA는 유지했다. 내 기록 화면은 각 난이도에서 개인 최고와 최근 기록을 분리한다.

## 계측

별도 이벤트를 추가하지 않고 `result_view`에 다음을 포함한다.

- `has_recent_comparison`: 비교 노출 유무
- `previous_result`: 예 `knockout:8/30`, 없으면 null
- `current_result`: 예 `knockout:12/30`
- `comparison`: improved / declined / same / mixed / null

기존 `level`, `roundId`를 유지한다. `result_view.roundId`와 `retry_game_start.previousRoundId`로 비교 노출 후 실제 재경기를 연결한다. CTA 탭만으로 재경기를 계산하지 않는다. 기존 runtime 로컬 adapter만 사용하므로 운영 사용자별 효과나 D1/수익을 측정한 결과는 아니다.

## 이번 실행 검증

| 실행 | 결과 |
| --- | --- |
| `jest --runInBand src/app/__tests__/recentRecords.test.ts src/app/__tests__/recentComparison.test.ts src/app/__tests__/recentGameScreen.test.tsx` | 신규 34/34 통과 |
| `npm test` | 엔진 47/47, 앱 299/299 (42 suites), contract 검사 통과 |
| `npm run typecheck:app` | 통과 |
| `npm run build:app` | Android/iOS × RN 0.84.0/0.72.6 빌드 및 로컬 AIT 생성 성공 |
| `npm run test:preview` | 12/12 통과 |
| `node tools/browser-preview/check-recent.mjs` | 320×568, 375×667, 390×844 통과 |
| 기존 `check-product-loop.mjs` | 320/390 폭, 무료/광고 retry·clear·stage·background 모의 흐름 통과 |
| 기존 `check-records.mjs`, `check-survival.mjs`, `check-champion-uppercut.mjs` | 기록 접근, 난이도 3단계·해금·best 보존, 챔피언 6버튼/어퍼컷 통과 |
| 기준 태그와 보호 파일 비교 / `git diff --check` | 보호 94개 동일, whitespace 오류 없음 |

QA 환경: `BOXING_QA_MODULES=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules`, `BOXING_BROWSER_PATH=/usr/bin/chromium`. 기존 QA는 출력 경로만 바꾼 복사본을 `artifacts/recent-20261016/`에서 실행하여 이전 증거를 덮어쓰지 않았다. 상세 로그·JSON·스크린샷도 같은 디렉터리에 있다. 신규 테스트는 구현 전 실패를 확인한 뒤 통과시켰다.

브라우저에서는 비교 문구, 가까운 목표/잘한 점/놓친 점 스크롤, 상세 기록 실제 열기/닫기, 무료 retry, 둘째 KO 광고 CTA, 모의 reward+dismiss 후 실제 새 경기, 기록 닫기까지 클릭했다. native 화면 테스트는 실제 session을 진행시켜 recent 저장·재마운트 복원·저장 실패·중복 저장 방지·직전 경기와 retry 이벤트 연결을 확인했다. 브라우저 fixture 저장과 실제 앱 Storage 검증을 혼동하지 않는다.

광고 회귀는 KO1→무료, KO2→rewarded, clear 시 count 유지, 같은 난이도 clear retry 무료, reward+dismiss→재경기, 새 runtime count=0을 확인했다. 실패/불완전 보상·중복 callback·A1/A2/A3의 기존 테스트도 전체 앱 회귀에 포함되어 통과했다.

## 보호와 남은 게이트

`src/game`, 실제 session/판정/타이밍/30회/가드/난이도, 모션·PNG/WAV, 광고 controller, runtime death counter, 튜토리얼, package.json/package-lock.json, 실기기 체크리스트는 변경하지 않았다. progression의 `summarizeRound`, `compareRecords`, `earnsPromotion`, `isHighScore`, `RoundRecord` 정의도 기준 태그와 동일하다. 저장 모델은 요청한 선택 필드만 추가했다.

**C1 focus/AppState active 순서, C2 reward 이후 dismissed 누락은 실제 Apps in Toss iOS/Android에서 아직 검증하지 않았다. 실기기 검증 보류 상태이며 해결이나 1차 제품 루프 실기기 완료로 선언하지 않는다.** 기존 [체크리스트](DEVICE_VALIDATION_V1.md)를 그대로 유지한다.

다음 후보는 최근 기록을 활용한 작은 재방문 이유 제공을 우선 제안한다. 결과 공유는 그 다음 후보이며 이번 작업에서는 둘 다 구현하지 않는다.
