# 출시 전 최종 제품 감사 — 2026-10-18 (한국 시간)

## 판정: 불가 — 현재 상태의 즉시 정식 출시 기준

기본 반복 플레이 루프는 이번 실행에서도 작동했다. 그러나 **클리어 뒤 단계 이동 광고의 사전 고지 누락(P1)**, **필수 튜토리얼/방어 버튼의 접근성 활성화 경로 누락(P1)**을 재현했다. 여기에 실기기 부팅·광고·복귀 확인 및 등급/등록 자료 증빙이 남아 있다. 코드를 다시 만드는 단계가 아니라 이 두 결함과 출시 게이트를 먼저 닫아야 한다.

P0(데이터 파괴, 광범위한 즉시 크래시, 잘못된 보상 지급)는 이번 범위에서 새로 확인하지 않았다. 이는 P0 부재를 모든 기기에서 보장한다는 뜻이 아니다. **C1/C2와 실제 공유·Live Analytics는 미검증 상태를 유지한다.**

이번에는 제품 코드 수정·커밋·push·업로드·배포·실제 광고/Analytics 전송을 하지 않았다. 새 감사 보고서와 진단용 artifacts만 작성했다.

## 1. 기준 상태와 보존

- branch: `main`
- HEAD: `be1f723c803a07ef2bf1f0c78cb8013e2d54fb73` (`feat: establish v1 product loop baseline`)
- 시작 시 tracked 변경 19개, untracked 파일 44개. 최근 기록/재방문/공유/바이럴/Analytics/공유 유입의 상당 부분이 working tree에만 있다. 현재 HEAD만으로 출시하면 이 기능들을 포함하지 못한다.
- 감사 시작 시 기존 파일 358개의 SHA-256, Git status와 binary diff를 보존했다. 기존 untracked 파일도 해시에 포함했다.
- `src/game`, `tests`, `tools/mocap`, package.json, package-lock.json은 HEAD 대비 차이 없음. 최근 기능의 변경은 별도 working tree에 남아 있으며 이를 되돌리지 않았다.
- 재현 자료: [보존 manifest](../../artifacts/release-audit-20261018/before.json), [초기 status](../../artifacts/release-audit-20261018/status-before.txt), [초기 diff](../../artifacts/release-audit-20261018/working-tree.patch).
- 출시 승인 이후에는 검증한 소스·기능·AIT 해시를 하나의 후보 버전으로 묶을 필요가 있다. 이번 감사에서 커밋/태그를 추가하지 않았다.

## 2. 검증 방법과 한계

현재 소스로 preview TS를 생성하고 Chromium에서 320×568, 375×667, 390×844 흐름을 새로 실행했다. 스크린샷은 모두 이번 감사에서 촬영하고 직접 열어 확인한 것이다. 과거 캡처나 과거 통과 숫자를 이번 증거로 사용하지 않았다.

추가로 현재 RN 화면·저장·광고 controller·계측·공유 테스트를 다시 실행하고, 별도 artifact에 세 가지 적대적 probe를 작성했다. 제품 테스트 파일 자체는 수정하지 않았다.

**중요한 환경 차이:** 브라우저는 DEV PREVIEW다. RN 튜토리얼과 실제 네이티브 공유창, 호스트 닫기/뒤로가기, Toss 배너를 렌더링하지 않는다. browser에는 RN 기본 제품에서 비활성인 ‘오늘의 코스’ UI가 남아 있다. preview 경기는 실제 recent 저장에서 제외된다. 따라서 아래 화면을 그대로 출시 스크린샷으로 사용하거나 native 통과 증거로 제출하면 안 된다. 튜토리얼은 RN 실행 probe로 검증했으나 실제 화면 캡처는 **실기기 부재로 확보하지 못했다**.

## 3. 사용자 여정 — 단계별 상태

| 단계 | 관찰 및 판정 | 새 증거 |
|---|---|---|
| 1 홈 | 테마·시작 버튼은 명확. 320/375에서는 설명이 조밀하다. 기존 홈 시작 경로 정상 | 320-01-home, 375-01-home |
| 2 튜토리얼 | 일반 터치 pressIn으로 LEFT→GUARD→실제 경기 시작. 기록/광고와 분리. 접근성 활성화는 진행 불가(A2) | runtime-probe 로그; native 화면 캡처 미확보 |
| 3 게임 | 목숨 5, 고정 버튼, 30회 구조, 정지/재개 유지. 합성 입력으로 완주, 무입력으로 KO 재현 | 390-02-game, clear-performance, RN 실행 |
| 4 첫 KO 결과 | 4/30·관장 한 줄·목표 5회·첫 기록 표시. 다시 도전이 공유보다 먼저 보임. 실제 무료 경기 재개 | 320-03-first-ko |
| 5 둘째 KO/광고 재도전 | ‘광고 보고 다시 도전’ 표시. mock 실패는 무료 경기로 이어지지 않음. 다시 불러오기 후 정상 보상+닫힘에 경기 1회 시작 | 320-04/05/06/07, RN 실행 |
| 6 clear/다음 난이도 | 30/30 강조, 같은 난이도 무료. 다음 단계 interstitial은 실행되지만 사전 고지가 없음(A1) | 390-12-clear, AUDIT_CLEAR_CTA |
| 7 결과 공유/복귀 | 보조 CTA, 실제 기록 문구. mock 취소 뒤 결과/재도전 유지. RN mock 오류·중복·복귀도 통과 | 320-09-share-mock, shareGameScreen 재실행 |
| 8 기록/홈 재방문 | 기존 기록 화면 왕복 정상. RN에서 recent/best 분리·재방문 목표 복원 확인 | 320-10-records, 390-11-revisit-home, recent/revisit 재실행 |

### 이번 감사 화면

스크린샷에는 preview/mock 한계가 있다. 아래 순서대로 읽되 단계 2의 native 튜토리얼 화면은 빠져 있다.

1. 홈 — 테마와 시작 버튼. 오늘의 코스 문구는 preview 차이이며 native 출시 기능이 아니다.

![320 홈](../../artifacts/release-audit-20261018/320-01-home.png)

3. 게임 — 현재 상태와 고정 방어 버튼. 이 캡처는 준비 상태이며 실제 사람의 공격 인식 성공을 증명하지 않는다.

![390 게임 준비](../../artifacts/release-audit-20261018/390-02-game.png)

4. 첫 KO — 기록·다음 목표·primary 재도전·secondary 공유.

![320 첫 KO](../../artifacts/release-audit-20261018/320-03-first-ko.png)

5. 둘째 KO와 광고 완료 후 경기 — 실제 광고 대신 명시적 native callback mock을 사용했다.

![320 둘째 KO](../../artifacts/release-audit-20261018/320-04-second-ko.png)
![320 광고 뒤 경기](../../artifacts/release-audit-20261018/320-07-retry-game.png)

6. 완주 — 단계 이동 CTA에 광고 안내가 없는 상태. 하단 seed 영역은 이 완주 검사용 debug UI이며 native 출시 화면이 아니다.

![390 완주](../../artifacts/release-audit-20261018/390-12-clear.png)

7. 공유 — 모의 창의 문구 검증. 실제 iOS/Android chooser의 캡처가 아니다.

![320 공유 mock](../../artifacts/release-audit-20261018/320-09-share-mock.png)

8. 기록 — native recent 저장/배너는 이 preview 화면으로 검증하지 않았다.

![320 기록](../../artifacts/release-audit-20261018/320-10-records.png)

## 4. 확인된 결함

### A1 · P1 · 클리어 후 다음 난이도 광고의 사전 고지 누락

- 위치: [P0GameScreen.tsx:574](../../src/app/screens/P0GameScreen.tsx#L574), `handleNextLevel` 406–410, `stageInterstitialAd.ts`의 ready 상태.
- 재현: 새 runtime → 입문 30회 clear → interstitial preload ready → 결과의 ‘다음 난이도 도전 · 도전자’ 선택.
- 기대: 누르기 전에 전면 광고가 이어짐을 이해할 수 있어야 한다. 광고 정책/횟수 변경은 필요 없다.
- 실제: 결과의 전체 Text 및 버튼 accessibilityHint 어디에도 광고 안내가 없는 상태에서 `port.show` 1회 호출. 재현 로그 `AUDIT_CLEAR_CTA`에 광고 없는 화면 텍스트와 label이 남아 있다.
- 영향: 성공한 사용자가 예상하지 못한 전면 광고를 보게 된다. 이탈·불신 및 심사 반려 위험. 공식 게임 가이드의 ‘광고를 예상할 수 없는 상태에서 전면 광고 노출 금지’와 충돌한다.
- 권고: 다음 난이도 광고가 이어질 때 CTA 또는 인접 문구로 짧게 고지. 같은 난이도 retry 무료, 기존 interstitial 정책은 유지.
- 근거: [실행 로그](../../artifacts/release-audit-20261018/adversarial-probes.log), 위 완주 캡처, [공식 게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-game).

### A2 · P1 · 필수 연습/방어 버튼의 접근성 활성화 경로 누락

- 위치: [DefenseControls.tsx:33](../../src/app/components/DefenseControls.tsx#L33), [DefenseTutorial.tsx:37](../../src/app/components/DefenseTutorial.tsx#L37).
- 재현: 기록 없는 사용자 → 도전 시작 → 왼쪽 버튼에 표준 press 활성화 → 3초 대기. 이어 같은 버튼에 pressIn을 전달해 비교.
- 기대: 접근성 활성화로도 연습을 진행할 수 있어야 한다. 기존 물리 터치 판정과 중복 입력을 만들면 안 된다.
- 실제: press는 단계 1에 그대로 머물며, pressIn에서는 단계 2로 진행. 컨트롤에 onPressIn/Out만 있고 onPress/접근성 대체 활성화가 없다.
- 설치된 RN 0.84 `Pressability.js:531`은 accessibility click에서 **onPress만** 호출함을 명시한다. 따라서 단순 테스트 명칭 차이만으로 판단한 것이 아니다.
- 영향: 스크린리더/보조 입력의 클릭 경로로 신규 사용자가 필수 튜토리얼을 넘지 못할 수 있다. 인게임 방어도 같은 컨트롤을 사용한다.
- 권고: 접근성 활성화 경로를 추가하되 physical pressIn timing을 보존하고 입력 1회성을 검증. VoiceOver/TalkBack 실제 장치 테스트 필요.
- 구분: 핸들러 누락과 RN 표준 활성화 실패는 **확인된 결함**. 각 OS/보조기기의 실제 제스처 전달 결과 및 비시각적 게임 이용성 전체는 **미검증**.

### A3 · P2 · 핵심 재도전 CTA의 작은 글자 대비 부족

- 위치: [P0GameScreen.tsx:724](../../src/app/screens/P0GameScreen.tsx#L724).
- 실제: 흰색 #FFFFFF, 배경 #E5484D, 글자 13pt, 대비 약 **3.91:1**. 일반 텍스트 WCAG AA 참고 기준 4.5:1에 미달하며 13pt bold는 큰 글자 예외에 해당하지 않는다.
- 영향: 저시력·밝은 환경에서 핵심 CTA 가독성이 약해질 수 있다.
- 권고: 색 또는 글자 표현의 최소 조정. 전체 리디자인은 불필요하다. 이 측정만으로 앱 전체 접근성 준수/위반을 판정하지 않는다.

### A4 · P2 · 광고 미지원 시 소비자 화면에 개발용 QR 안내 노출

- 위치: [P0GameScreen.tsx:420](../../src/app/screens/P0GameScreen.tsx#L420).
- 재현: 광고 SDK isSupported=false → 두 번째 KO → 결과.
- 실제: 비활성 CTA `QR에서 광고 테스트`. 적대적 RN probe로 확인. 사용자에게 실행 가능한 복구 행동을 설명하지 않는다.
- 영향: 미지원 환경에서 재도전이 왜 막혔는지 이해하기 어렵다.
- 권고: SDK 지원 조건에 맞는 소비자용 안내와 홈 이동을 명확히 한다. 광고 실패를 무료 재도전으로 바꾸라는 권고가 아니다.

## 5. 개선 권고 / 제품 위험 — 결함으로 단정하지 않음

| 우선순위 | 판단 | 권고 |
|---|---|---|
| P2 | 첫 화면의 공격/가드/해금 설명이 많고 몸풀기는 LEFT/GUARD만 연습한다. 실제 훅·스트레이트 구분 난이도는 합성 입력으로 평가할 수 없다 | 처음 하는 사람의 실제 1~3경기 관찰. 이해율·첫 무료 재경기 후 개선을 확인한 뒤 문구 축소 판단 |
| P2 | KO 때 HUD 5/30, 결과 4/30은 resolved vs survived로 각각 설명 가능하지만 숫자가 다르게 보인다 | 숫자 의미를 더 분명히 하거나 결과에서 중복 지표 위계를 낮추는 방향 검토 |
| P2 | 홈 ‘복싱재능테스트’, 결과/공유 ‘복싱 감각 테스트’로 명칭이 다름 | 콘솔/아이콘/앱/공유의 명칭 원칙 통일. 가짜 능력 점수는 추가하지 않음 |
| P2 | preview에 오늘의 코스가 보이고 RN 튜토리얼/실제 recent 저장/배너가 없다. 작은 화면과 접근성의 최종 판단을 preview에 의존하면 놓칠 수 있음 | RN 실기기 캡처를 출시 시각 검증의 기준으로 사용. preview 전용 기능을 제품 결함으로 오인하지 말 것 |
| P2 | KO1→clear→stage interstitial→다음 KO rewarded의 광고 밀도 | 현재 확정 정책대로다. 광고 간 시간·재경기·이탈·정산 데이터를 본 뒤 판단. 카운터 reset 변경 권고 없음 |
| P2 | native 번들당 약 17.9MB, artSources base64 약 15MB | 저사양 기기 cold-start·메모리·터치 지연 측정. 현재 용량만으로 성능 결함 확정하지 않음 |
| P2 | 미커밋 working tree가 실질적 출시 후보이고 이전 문서의 버전/자료 링크가 낡음 | 수정/검증 후 별도 승인된 커밋·AIT 해시·기기 결과를 동일 후보에 연결 |
| P3 | 텍스트 공유와 사실 기반 관장 문구는 작동하지만 ‘공유하고 싶은가’는 데이터 없음 | result_view→share_tap과 retry_game_start를 함께 관찰. 공유율 상승만으로 성공 판단 금지 |
| P3 | OG 이미지/공유 수신 화면의 매력은 실제 메신저에서 미검증 | 기존 공식 링크의 미리보기만 실기기에서 확인. 친구 대결/보상 기능은 범위 밖 |

## 6. 출시 자료 및 정책 대조

2026-10-18에 공식 [미니앱 등록](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace)·[게임 출시](https://developers-apps-in-toss.toss.im/checklist/app-game)·서비스 정책을 새로 읽었다. 인증된 콘솔 설정이나 심사 상태에는 접근하지 않았다. 아래 ‘저장소에서 없음’은 ‘콘솔에도 없음’을 의미하지 않는다.

| 항목 | 실제 확인 | 출시 판단 |
|---|---|---|
| 앱 정보 | appName boxing-talent-test, appType game, displayName 복싱재능테스트, SDK 2.10.10, 권한 [] | 코드 확인. 콘솔 최종 이름·카테고리·운영자 정보 별도 대조 |
| 앱 아이콘 | 현재 brand.icon URL에서 600×600 PNG를 직접 받아 열어 확인. alpha 255로 불투명, 복싱 테마 | 규격/응답 확인. 과거 ‘아이콘 빈 값’ 보고는 현재와 다름 |
| 게임 대표 썸네일 | 가이드 1932×828 PNG. 현재 repo의 PNG 전수 규격 검색에서 해당 후보 없음 | 콘솔 등록본/원본 확보 필요(P1 출시 자료 게이트) |
| 상세 설명/부제 | 최종 제출본 찾지 못함. `RELEASE_PROGRESS.md:55`의 release/출시자료.md는 현재 없음 | 최종 설명 확인 필요. 30초 테스트/정밀 재능 평가로 소개하면 현재 게임과 불일치 |
| 스토어 스크린샷 | 선택 제출. 제출한다면 세로 636×1048 최소 3장 또는 가로 1504×741 최소 1장 | 등록 상태 미확인. 이번 DEV 캡처를 그대로 제출하지 말 것 |
| 게임 등급 | 공식 등록 문서는 등급 심의 증빙을 요구함. repo에서 현재 증명서/동일 게임 스토어 URL 확인 못함 | **P1 출시 게이트**. 콘솔 증빙 확인 필요. 미발급이라고 단정하지 않음 |
| AIT 용량 | 파일 51,295,135 bytes; 공식 reader로 ZIP을 읽어 압축 해제 합계 76,972,168 bytes, RN 0.84/0.72 iOS/Android 4번들+맵 | 공식 압축 해제 100MB 한도 이내. 업로드/심사 승인 증거는 아님 |
| 광고 | live 지면 ID 설정, preload 및 보상+닫힘 계약 확인. 다음 단계 광고 고지 문제 A1 | 실제 지면 노출·지원 OS·무음/복귀·배너 위치·성능은 실기기 게이트 |
| 종료/뒤로/안전영역 | 호스트 닫기 버튼과 네이티브 시스템 동작에 의존 | 모든 화면 종료, Android back, 종료 확인, Dynamic Island는 실기기 필수 |
| 최초 화면/반응 시간 | 공식 기준 최초 화면 10초 이내, 인터랙션 2초 이상 지연 없음 | 로컬 browser 수치로 native 준수 판정 불가 |
| 기록/식별키 | 기록은 Toss Storage, 개인 최고/recent 복원. 직접 getUserKeyForGame 저장은 없음. Analytics는 SDK 공식 익명 처리 | 공식 ‘사용자 식별키’ 항목의 로컬 기록 게임 적용 범위를 확인. 임의 persistent ID를 추가하라는 권고가 아님 |
| 개인정보/문의/약관 | 최소 payload allowlist, 별도 계정/연락처 수집 없음. 콘솔 문의 채널/적용 약관 최종본은 확인 못함 | SDK 익명 Analytics 포함 고지·정책 적용 범위와 운영자 문의 채널을 제출 전 확인 |
| 저작권 | 그림은 art-direction에 생성 경위, 소리는 CC0 원문·원본·출처 문서 존재 | 주요 출처 확인. 콘솔 제출 자산까지 권리 증빙 보관 필요; 법적 승인으로 간주하지 않음 |

게임 등급 안내는 [등록 문서의 5-3 게임 등급분류](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace#5-3.-game-rating)를 따른다. 일반 게임에 웹보드 전용 의무를 무작정 적용하지 않았다.

## 7. 성능·작은 화면·오류 복구

- 이번 브라우저 320/375/390 첫 KO·둘째 KO 모두 primary retry 48px, share 44px 높이. 320에서 retry y=354, share y=436으로 첫 viewport 안에서 실제 클릭했다. 공유가 primary를 밀어내는 실패는 관찰하지 않았다.
- 375 preview 홈에서 상단 관장 문구가 잘리는 모습을 관찰했다. RN 홈은 별도 ScrollView 구성이라 native의 동일 결함으로 확정하지 않았다.
- 로컬 browser 최초 홈 networkidle까지 929ms(일반), 1210ms(CPU 4배 throttling). 5초 rAF 표본 각각 300개, p95 16.7/16.8ms, 50ms 초과 0개. localhost·데스크톱·짧은 표본이며 RN 메모리/저사양/느린 네트워크/터치 지연 측정이 아니다.
- RN probe에서 저장 read 지연 8초 fallback, 저장 실패 후 플레이/재도전, 손상 기록 보존/복구, 저장 순서 보존이 작동했다.
- 광고 실패는 카운터 2 유지. ‘다시 불러오기’와 ‘광고 보고 다시 도전’ 두 탭으로 재준비되는 흐름을 실제 mock에서 확인했다. 실패 직후 탭 1회가 즉시 show한다고 가정한 최초 capture harness는 수정했으며 제품 결함으로 보고하지 않았다.
- 공유 오류/취소가 결과·카운터·기록을 변경하지 않았고 중복 share 요청 방어를 재확인했다.
- Analytics throw/reject/timeout 격리와 allowlist를 현재 코드로 재실행했다. 외부 전송은 하지 않았다.
- 시스템 글자 확대, VoiceOver/TalkBack, 색각, 햅틱/무음, 지속 부하·발열·배터리는 아직 미검증.

## 8. 실기기/운영 미검증 — 확인된 결함과 별개

| 우선순위/게이트 | 남은 검증 |
|---|---|
| P1 / 정식 출시 전 | 최신 후보의 iOS/Android cold start, 10초 기준, 호스트 닫기/Android back/안전영역/무음/가로세로 |
| P1 / 정식 출시 전 | 실제 KO1 무료 → KO2 rewarded → 정상 완료 후 준비 및 game_start 정확히 1회, 실패·취소·중복·빠른 이동 |
| P1 / C1 유지 | focus→AppState active 및 반대 순서, 알림창·잠금·앱 전환·광고 Activity 복귀. 실제 foreground 전 경기 진행 금지 |
| P1 / C2 유지 | reward 이후 dismissed 누락의 실제 발생 여부·복구 비용. 엄격 AND 계약을 자동 성공으로 완화하지 않음 |
| P1 / 공유 루프 승인 전 | 실제 RN 공유창 취소/복귀, HTTPS 링크 클릭→Toss→/shared, 앱 재시작 시 source reset, 악성/빈 URI의 SDK 초기 라우팅 |
| 운영 개시 검증 | Live boxing_app_open/landing_view/game_start의 entry_source 및 광고/공유 이벤트 수집. QR/Sandbox 미수집은 정상 범위. Live 수집은 공개 전 local 테스트로 증명할 수 없으며 제한된 운영 확인 후 판정 |

과거 `art-direction/current-ios-error-inquiry-20261013.md`에는 iPhone 진입 오류 문의 초안이 남아 있다. **과거 문서만으로 현재 코드의 재현 결함으로 세지 않았다.** 그러나 최신 빌드의 실기기 시작 성공 증거가 없으므로 해결됐다고 표시할 수도 없다.

Analytics의 game_start 횟수는 사용자 수가 아니며 재도전 포함 game_start/landing 비율은 100%를 넘을 수 있다. 광고 이벤트는 매출/ARPDAU가 아니다. shared_result는 전용 경로 유입이지 특정 공유인→수신인 매칭이 아니다.

## 9. 이번에 직접 실행한 검증

| 명령/실행 | 결과 |
|---|---|
| `npm run build:preview-session` | 현재 preview 모델 생성 성공; 제품 소스 변경 없음 |
| `node .../jest.js --config artifacts/release-audit-20261018/jest.config.cjs --runInBand` | RN 화면/회귀 복사본 46개 + 새 probe 2개 = 48 통과 |
| 같은 명령 `--testNamePattern AUDIT` | 적대적 probe 3개 통과(위 2개 재확인 + unsupported CTA 신규 1개). 여기서 통과는 **문제 재현 성공**을 뜻함 |
| `node .../jest.js --runInBand --runTestsByPath ...` | share/recent/revisit/analytics/entry/viral/release 설정 9 suites, 101개 통과 |
| `capture.mjs` | 3크기 홈→게임→KO→무료 retry→KO→mock 광고 실패/재시도→새 경기→공유 취소→기록/홈, browser pageerror 0 |
| `clear-performance.mjs` | 320/390 합성 입력 30회 완주, 별도 실제 시간 browser 성능 표본 |
| 공식 AIT reader + ZIP 목록 | 압축 해제 용량 및 4플랫폼 번들 구성 확인 |
| Git diff/hash 검증 | 제품 소스·기존 변경 보존. package/lockfile/엔진 변경 없음 |

명령·새 probe·로그·DOM/좌표·스크린샷은 [감사 artifact 폴더](../../artifacts/release-audit-20261018/)에 저장했다. 이번은 진단 작업이므로 전체 npm test/typecheck/build를 다시 실행하지 않았다. 이전 전체 테스트 통과를 이번 감사 통과 수치로 복사하지 않았다.

## 10. 수정/확인 순서

1. **P1 A1**: 다음 단계 광고의 사전 고지. 광고 횟수/포맷 정책을 보존하는 작은 문구 변경으로 해결 가능한지 검토.
2. **P1 A2**: 필수 연습과 방어 컨트롤의 접근성 활성화, 터치 중복/타이밍 회귀 포함. 실제 VoiceOver/TalkBack 확인.
3. **P1 출시 자료**: 등급 증빙, 최종 앱 설명·썸네일·문의/정책 정보와 콘솔 등록 상태 확인. 보고서의 ‘없음’과 콘솔 상태를 혼동하지 않음.
4. **P1 실기기 게이트**: 최신 동일 후보를 iOS/Android에서 부팅→광고→복귀→공유 링크까지 검증. C1/C2 로그 포함.
5. **P2 A3/A4**: CTA 대비와 광고 미지원 문구. 가능한 작은 수정으로 우선 처리하되 광고 면제/새 정책으로 확장하지 않음.
6. **P2/P3**: 명칭·설명 밀도·QA 일치성·공유 매력·장기 광고 밀도는 운영 데이터/사용성 관찰에 따라 판단.
7. 별도 승인 후 출시 후보를 고정하고, 제한된 Live에서 수집/유입 속성을 검증한다. 이번 감사에서는 어느 단계도 자동 수정·배포하지 않았다.

확인된 P1과 출시 게이트를 닫기 전에는 ‘기능 구현 완료’를 ‘정식 출시 가능’으로 바꾸지 않는다.
