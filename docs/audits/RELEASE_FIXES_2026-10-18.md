# 출시 감사 P1/P2 수정 및 회귀 — 2026-10-18

정식 출시 판정은 **불가(실기기 및 필수 출시 자료 게이트 미완료)**를 유지한다. 이 문서는 [기존 감사](RELEASE_READINESS_AUDIT_2026-10-18.md)의 네 결함에 대한 후속 수정 기록이며, 원문이나 실기기 체크리스트를 대체하지 않는다.

## 수정 범위와 재현 전후

| 항목 | 수정 전 | 수정 후 / 검증 | 상태 |
|---|---|---|---|
| P1 단계 광고 안내 | clear 후 다음 난이도 버튼에 광고 안내·hint 없음 | loading/ready에서 버튼 바로 앞에 “이동할 때 광고가 표시될 수 있어요.”, 동일 hint. error/unsupported에서는 표시하지 않고 기존 무광고 전환. 같은 난이도 무료 재도전에는 안내 없음 | 코드·RN 및 browser mock 검증 완료 |
| P1 방어 접근성 | `onPress` 활성화만으로 LEFT→GUARD 진행 불가 | 비터치 접근성 click은 방어 1회와 해제를 함께 실행. 물리 입력은 기존 pressIn 시점 유지. 실제 설치 RN Pressability에서 즉시·지연 pressOut, 취소, 후속 접근성 click 검증 | 부분 해결: 코드 회귀 통과, VoiceOver/TalkBack 실기기 미완료 |
| P2 재도전 대비 | 흰 글씨 / #E5484D = 3.91:1 | 정상 #B92E36, 눌림 #A5262E, 비활성 #533038. 투명도 대신 색상을 지정. 크기·primary 우선순위 유지 | 수정 완료 |
| P2 미지원 광고 문구 | “QR에서 광고 테스트”, SDK 안내에 QR 개발 문구 | “광고 이용 불가”, “현재 이 환경에서는 광고를 이용할 수 없어요.” 및 난이도 선택→내 기록 안내. count=2 유지, 무료 재경기 차단 | 수정 완료 |

재도전 대비는 실제 RN 스타일 callback과 browser computed style의 전경/배경으로 계산했다. 정상/눌림/비활성 주 문구는 각각 **5.99 / 7.20 / 11.37:1**, 작은 보조 문구는 **4.89 / 5.88 / 9.28:1**이다. RN은 실제 disabled 상태, browser는 disabled CSS fixture를 사용했다.

## 입력 이벤트 근거와 범위

설치된 RN 0.84 `Libraries/Pressability/Pressability.js`는 responder release 및 비포인터 `onClick` 모두에서 onPress를 호출한다. 물리 터치의 `NativeTouchEvent`에는 touches/changedTouches가 있으며 이 이벤트를 onPress에서 재처리하지 않는다. 실제 defense 입력 호출은 기존 onPressIn에 남긴다. held 상태 중 보조 activation도 중복 실행하지 않는다. 비터치 click은 finally에서 pressOut을 호출해 일회성 방어가 눌림 상태로 남지 않게 한다. disabled 전환 시 로컬 held 상태도 비운다.

테스트는 설치된 Pressability 상태 머신을 직접 실행하며, 0ms release(onPress 뒤 지연 pressOut) 및 200ms release(pressOut 뒤 onPress), responder terminate 이후 click을 검사한다. LEFT/RIGHT/BACK/GUARD/DUCK/STEP_IN의 보조 활성화·해제, disabled 무시도 검사한다. RN 화면 통합에서는 실제 onClick 경로만으로 신규 사용자 튜토리얼을 마치고 game_start 1회, count=0, 기록 미저장을 확인했다.

이 결과는 OS 스크린리더의 실제 이벤트 발생을 입증하지 않는다. 앱 빌드는 RN 0.84와 0.72.6 대상 산출물을 만들므로 실제 Toss iOS/Android에서 VoiceOver/TalkBack 활성화, 물리 입력 혼용, 포커스 이동·비활성 전환을 확인해야 한다.

## 변경 파일

제품(3개):

- `src/app/components/DefenseControls.tsx`: 접근성 activation, 물리 이벤트 중복 방지, hint.
- `src/app/screens/P0GameScreen.tsx`: 단계 광고 사전 안내, 미지원 안내, 재도전 색상.
- `src/app/ads/rewardedRetryAd.ts`: 미지원 문구 2곳만 교체. controller 상태 전이 수정 없음.

검증/preview:

- `src/app/__tests__/DefenseControls.test.tsx` (신규): 9개 RN 입력 회귀.
- `src/app/__tests__/DefenseTutorial.test.tsx`: 접근성 press 전용 완주 회귀 추가.
- `src/app/__tests__/P0GameScreen.test.tsx`: 접근성 신규 경기, 광고 안내/미지원/실패, 실제 스타일 대비 검사; 기존 clear/interstitial 검사 강화.
- `tools/browser-preview/preview-client.mjs`, `preview.html`: 대응 안내·색상만 반영. 브라우저 튜토리얼이나 native API를 새로 만들지 않음.
- `tools/browser-preview/check-release-fixes.mjs` (신규): 3개 viewport × 모의 광고/광고 없음, 사전 안내·실제 클릭·computed contrast·미지원 후 홈 이동.
- `AI_HANDOFF.md`, 이 보고서: 현재 상태 및 미완료 게이트.

## 검증 결과

- TDD: 새 접근성·안내·명암비·미지원 기대 조건의 실패를 먼저 확인했다. 초기 테스트 harness의 host/Pressable 탐색 오류는 수정하고 제품 결함 실패를 재확인했다. 기존 테스트 삭제·기대 완화 없음.
- 전용 RN 3 suites / **64 tests 통과**.
- `npm test`: 엔진 **47**, 앱 **459 / 55 suites** 통과.
- `npm run typecheck:app`: 통과.
- `npm run build:app`: 통과, 로컬 AIT 생성만 수행. 로그의 deploymentId는 업로드 증거가 아니다.
- `npm run test:preview`: **13 통과**.
- `node tools/browser-preview/check-release-fixes.mjs`: **6개 viewport/광고 조합 통과**, console pageerror 없음. 320×568, 375×667, 390×844에서 실제 retry/다음 단계/홈 버튼 클릭 및 안내 확인.
- 기존 `check-product-loop.mjs`, `check-recent.mjs`, `check-revisit.mjs`, `check-records.mjs`, `check-share.mjs`, `check-viral-result.mjs`, `check-entry-source.mjs`: **모두 통과**. 기존 증거 파일을 덮어쓰지 않도록 imports/출력 경로만 바꾼 복사본을 artifacts에서 실행했다. 정확한 실행 명령·종료 코드는 `browser-regression.json`에 기록했다.
- Analytics browser 검증은 entry-source QA의 실제 ProductEvents→Apps mapper + mock transport로 수행. 별도의 실제 운영 전송은 없다. adapter/mapping/중복/실패/개인정보 단위 테스트는 전체 Jest 회귀에 포함된다.
- 320px에서도 primary retry는 최초 결과 viewport에서 클릭 가능. 다음 단계 광고 안내와 버튼은 스크롤 후 함께 보이고 클릭 가능했다. 스크린샷 육안 확인 포함. preview에는 native 튜토리얼이 없으므로 접근성 튜토리얼 증거는 RN 테스트와 구분한다.
- 광고 KO1 무료 / KO2 rewarded / clear 무료 / reward+dismissed 1회 재시작, 실패·취소·중복·background 모의 상태 전이 통과. recent/revisit/공유 취소·오류·중복/바이럴 결과/공유 출처 계약 유지.
- `git diff --check`: 통과.

실행 증거: `artifacts/release-fixes-20261018/`의 `targeted.log`, `test.log`, `typecheck.log`, `build.log`, `preview.log`, `regression.json`, `browser-regression.json`, `browser/`.

## 보호 영역 및 출시 게이트

작업 시작 branch `main`, HEAD `be1f723c803a07ef2bf1f0c78cb8013e2d54fb73`. 기존 tracked/untracked **359개 파일**의 해시, Git status/binary diff와 원본 archive를 작업 전 보존했다. 기존 대규모 미커밋 구현은 유지한다. 커밋·push·업로드·배포·실제 광고/Analytics 전송 없음.

게임 엔진/30회/타이밍/PERFECT·SAFE·HIT/모션/입력 의미·가드·난이도, 기록 schema/comparator/recent, runtime death count, reward AND dismissed 계약, interstitial/banner, lifecycle, 튜토리얼 시간, 공유/바이럴/revisit/entry/Analytics 계약, 이미지·사운드, package.json 및 package-lock.json은 변경 대상이 아니다.

**미검증:** C1 focus/AppState 순서와 background 복귀, C2 reward 후 dismissed 누락, 실제 RN 공유창, HTTPS 공유 링크→Toss 진입, Live Analytics. 클라우드 mock 통과로 실기기 통과를 선언하지 않는다.

**출시 자료 미확인:** 게임 등급 증빙, 제출용 썸네일, 최종 설명, 콘솔 등록/심사 상태. 기존 보고서의 대표 이미지 점검과 필수 제출 자료 완료는 다르다.

남은 출시 차단 조건은 실제 iOS/Android 입력·광고·복귀·공유 검증 및 필수 출시 자료 확인이다. 네 결함의 코드 수정만으로 정식 출시 가능으로 변경하지 않는다.
