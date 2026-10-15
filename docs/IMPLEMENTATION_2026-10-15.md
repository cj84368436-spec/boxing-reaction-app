# 1차 구현 보고서 — 2026-10-15

작업 기준: 사용자 최신 승인. branch `main`, 기준 HEAD `b5907aa0dbe31b738834db7abadeae31041a8f1a`. 현재 working tree에 구현했으며 커밋·push·배포·광고 콘솔 변경·외부 계측 전송은 하지 않았다. **클라우드 구현/검증 결과이며 실제 토스 기기 제품 완료 판정은 아니다.**

## 1. 구현한 것

- 첫 KO 결과에서 광고 없이 바로 재도전한다. 두 번째 KO 결과에서는 광고가 필요함을 CTA로 알린다. 다른 패턴·해금된 다음 난이도·홈 재시작에서도 같은 카운터를 적용한다.
- clear는 사망으로 세지 않고 같은 난이도 재도전은 무료다. clear→다음 단계만 기존 interstitial을 사용한다. 기록 banner는 유지한다.
- 보상+닫힘 확인 후 짧은 준비로 재경기한다. 비활성 앱에서는 경기 생성까지 보류한다. 일반 경기 중 앱 전환은 기존 일시정지/계속하기를 유지한다.
- 중복 KO·광고 탭·callback을 막고, 광고 오류 후 홈 이동 및 unmount의 늦은 callback을 폐기한다.
- 첫 기록/실제 최고 갱신을 구분한다. 상세 로그와 핵심 복기는 같은 공격 이름 함수를 사용한다(어퍼컷 포함).
- 4→5, 8→10, 14→15 등 가까운 목표, 실제 PERFECT/SAFE/피격 횟수 기반 요약을 보여준다. 전체 로그는 접어두되 그대로 보존한다. 근거 없는 재능 단정 대사를 없애고 실제 실패 행동 설명을 연결한다.
- 첫 사용자에게 실제 방어 버튼 LEFT→GUARD 연습을 제공한다. 성공 피드백 4초+기존 준비 2초에 입력 시간이 더해진다. 연습은 경기 생성·기록·목숨·광고에서 분리한다. 기록이 있는 사용자와 해당 runtime에서 연습을 마친 사용자는 생략한다.

## 2. 광고 정책

```text
새 runtime: 0
  └ KO → 1 ─ 다시 도전(무료) → KO → 2
                                      ├ 실패/보상 없는 종료/오류 → 2 유지
                                      └ reward + dismissed → 0
                                          └ foreground → 준비 → 실제 경기
clear: 카운터 유지 / 같은 난이도 무료
clear→다음 난이도: 기존 interstitial 1회
기록 화면: 기존 banner
```

카운터는 Storage에 쓰지 않는다. runtime singleton + 경기별 소유권 token으로 종료를 한 번만 집계한다. 광고 controller가 정상 성공을 통지한 현재 작업만 reset한다. 두 이벤트 순서가 달라도 처리한다. 기존의 ‘보상만 수신한 뒤 타임아웃 복구 탭을 눌러 성공’ 예외 경로는 엄격한 성공 계약과 충돌하여 제거했다.

## 3. 의도적으로 바꾸지 않은 것

`src/game`, 기준 `tests`, `tools/mocap`, 모든 session 규칙/기록 계산, PNG/WAV 원본, 모션·입력·판정·30회·가드·난이도 배율은 그대로다. v1 기록 스키마와 비교 순서, 연속 PERFECT와 유효 PERFECT 반응 표본 의미를 보존했다. 새 의존성·새 광고 포맷·새 지면·순위/오늘의 코스 활성화·새 점수는 추가하지 않았다.

보호 파일 **72개**를 기준 HEAD와 바이트 비교하여 차이 0개. `package-lock.json` SHA256: `4bd241bf973703f8f7b8c6f70b442dca2d219a00519920e8222cab072e7eea14`.

## 4. 테스트 결과

클라우드 기준선: `npm ci` 후 기존 engine 47/app 216, preview 12, 타입 검사 및 네 가지 앱 번들 통과. 설치 전후 lockfile 동일.

최종 검증:

| 실행 명령 | 결과 |
|---|---|
| `npm test` | engine 47 + app 243 통과, 앱 37 suites |
| `npm run typecheck:app` | 통과 |
| `npm run build:app` | Android/iOS × RN 0.84.0/0.72.6 빌드, 로컬 .ait 생성 |
| `npm run test:preview` | 12 통과 |
| `node tools/browser-preview/check-product-loop.mjs` | 320/390px 루프 통과 |
| `node tools/browser-preview/check-records.mjs` | 320/390px 기록 흐름 통과 |
| `node tools/browser-preview/check-survival.mjs` | 3단계 완주/해금/기록 유지/목숨1 clear 통과 |
| `node tools/browser-preview/check-champion-uppercut.mjs` | 6버튼/어퍼컷 실제 프레임 표시 통과 |
| `git diff --check` | 통과 |
| 보호 경로 `git diff --exit-code` 및 바이트 비교 | 차이 없음 |

QA 실행에는 `BOXING_QA_MODULES=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules`, `BOXING_BROWSER_PATH=/usr/bin/chromium`을 사용했다. 코드에는 이 머신 경로를 하드코딩하지 않는다. QA는 프로젝트 의존성을 먼저 찾고 환경변수 경로를 fallback으로 사용한다.

회귀 범위: 0→1→2→광고→0, clear 중 count 유지, clear 동일 단계 무료, load/show 실패·보상 미획득·중복 탭/callback·remount·홈/기록/난이도·새 runtime·foreground 보류·unmount, rewarded/interstitial 경쟁, 오류 후 banner 화면 이동, 첫 기록/최고 갱신, 전체 공격 이름, 연습 격리, native 이벤트 중복 및 계측 오류 격리.

증거: `artifacts/cloud-qa/validation/` 실행 로그(실패 재현 및 수정 후 결과 모두 보존), `product-loop.json`, `protected-files.json`, 크기별 스크린샷. 과거 `art-direction` 자료는 덮어쓰지 않았다.

## 5. 실제 플레이/preview 검증

Playwright Chromium으로 실제 DOM과 게임 엔진을 실행했다. 입력을 주지 않아 첫 KO→무료 retry, 실제 버튼 입력으로 clear→같은 단계 무료 retry→clear→interstitial→다음 단계 KO(총 두 번째)→rewarded 실패→재요청→보상만 수신(카운터2 유지)→background 닫힘(카운터0, 경기 미시작)→foreground 준비→KO(카운터1)→홈/기록 이동을 확인했다. 320/390px 모두 브라우저 오류 0개. 페이지 새 실행 시 카운터0을 확인했다.

광고는 **기존 controller + 명시적인 QA 모의 native port**로 실행했다. 실제 Toss 광고가 아니다. native 화면·banner와 버튼 연습은 React Native 렌더링/입력 테스트로 따로 확인했다. Preview는 튜토리얼·native 배너를 재현하지 않으며 네이티브 화면과 일부 표시 차이가 있다. 기존 preview의 로컬 daily QA는 기존 기능 회귀일 뿐 제품 활성화/외부 전송이 아니다.

## 6. 실기기에서 확인할 것

- Toss iOS/Android에서 실제 reward/dismissed 순서·누락·닫기·광고 실패·중복 및 복귀 AppState/focus 순서.
- Android 뒤로가기, 광고 중 프로세스 종료/재진입, 실제 foreground 복귀 준비 UX.
- 작은 화면·큰 시스템 글꼴·스크린리더에서 튜토리얼/결과/배너/CTA, 저사양 성능.
- 실제 효과음·진동·손가락 입력 체감, 느린 네트워크.

자동 foreground 준비는 로컬 lifecycle 테스트에서 안전하게 동작한다. OS에서 lifecycle 이벤트가 예상과 다르면 기존 일반 일시정지 경로가 남아 있으므로 수동 계속하기가 나타날 수 있다. 실제 기기 검증 전 제거하지 않는다.

## 7. 계측 가능한 KPI

runtime별 실제 경기 수, landing→game_start, 결과→무료 retry 선택→실제 경기, 광고 retry 선택→native show→보상/닫힘→완료→실제 경기. 각 실제 roundId와 이전 경기 ID로 연결하며 game_end는 clear/KO를 구분한다. native 광고 이벤트는 adRequestId와 format으로 연결한다. 연습은 실제 경기 수에 들어가지 않는다.

외부 수집 없이 최근 500개 메모리 이벤트만 제공한다. 따라서 현 단계에서 운영 전체 사용자 통계·D1/D7·ARPDAU·사용자당 실제 광고 수익은 측정할 수 없다. 표시 이벤트는 수익/청구 노출 증명이 아니다. 세부 contract/주의사항은 PRODUCT_DECISIONS를 따른다.

## 8. 남은 리스크

- **확인된 누락:** 2026-10-15 제품 감사 원문 및 일부 evidence artifacts. 구현 blocker는 아니며 누락으로 보존한다.
- **실행 불가 — 기준 artifact 부재:** `scripts/check-rc-preservation.mjs`가 요구하는 `../boxing-app-p0-ten-punch-playtest`가 없다. 임의 기준으로 통과시키지 않았다. 현재 HEAD 보호 파일 비교와 별개다.
- **확인된 기존 QA 제약:** 일부 예전 inspect/check 스크립트는 10회·옛 버튼 UI를 전제로 한다. Windows import는 이식했지만 모두 최신 제품 시나리오 검증으로 선언하지 않았다. 위 실행한 네 개 browser QA만 현재 검증 결과다. 기존 survival QA의 챔피언 PERFECT 입력은 어퍼컷 BACK으로 바로잡았다.
- **제품 판단:** 카운터를 영구 저장하지 않으므로 완전 재시작으로 광고 주기를 다시 시작할 수 있다. 승인된 정책이며 TTL/영구 저장은 이번에 추가하지 않았다.
- **가설:** 첫 무료 재도전·목표·몸풀기가 재플레이/사용자당 총 광고 수익을 개선하는지는 실사용 데이터가 필요하다. 튜토리얼은 입력 연습이며 공격 읽기 학습 효과를 검증한 것은 아니다.

## 9. git diff 요약

화면의 시작/결과/광고 연결, runtime 정책·로컬 이벤트·결과 요약 모듈, 분리 연습 컴포넌트, 광고 성공 계약의 timeout 예외 및 계측 hook, 공격명/관장 문구, 관련 회귀 테스트를 변경했다. QA resolver·모의 광고 실행기·preview 결과 표현·최신 정책/인수인계를 추가했다. package/lockfile 및 보호 엔진·기록 스키마는 변경하지 않았다. 모든 변경은 현재 main working tree에 남겨 두었다.
