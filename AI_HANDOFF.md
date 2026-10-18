# 최신 상태: 출시 감사 네 결함 수정 (2026-10-18)

- clear → 다음 난이도 광고 가능성을 CTA 앞과 accessibilityHint로 안내. 실패/미지원 전환 및 광고 주기·성공 계약은 유지한다.
- 방어 버튼의 비터치 접근성 activation을 추가하고 물리 pressIn 입력과 중복되지 않게 했다. RN Pressability 즉시/지연 해제·취소, 접근성만으로 신규 튜토리얼→실제 경기 검증. 실제 VoiceOver/TalkBack은 미완료다.
- 재도전 대비: 정상/눌림/비활성 주 문구 5.99/7.20/11.37:1. QR 개발 문구를 소비자 안내로 변경했다.
- 이번 실행: 엔진 47 / 앱 459(55 suites) / preview 13, 타입·빌드 통과. 전용 RN 64 tests, 320/375/390 브라우저 수정 QA 및 product-loop/recent/revisit/records/share/viral/entry-source·mock Analytics QA 통과.
- [수정 보고서](docs/audits/RELEASE_FIXES_2026-10-18.md). 기존 미커밋 구현 보존. 커밋·push·업로드·배포 없음.
- **정식 출시 불가 유지:** C1/C2, 실제 공유창/HTTPS→Toss 진입/Live Analytics, OS 접근성 실기기 및 등급·썸네일·설명·콘솔 자료 게이트 미완료. 기존 감사·기기 체크리스트 보존.

# 이전 상태: 결과 공유 진입 계측 (2026-10-18)

- 공유 링크 내부 URI를 `intoss://boxing-talent-test/shared`로 변경했다. 공식 getSchemeUri로 최초 URI를 읽고 direct/shared_result/unknown을 runtime에 한 번 고정한다. query/원본 URI/식별자 전송과 Storage 추가 없음.
- app_open 전에 출처를 확정한 뒤 기존 journal replay와 eventLog adapter를 연결한다. 모든 운영 이벤트에 allowlist entry_source를 유지한다. 실제 게임 source/retry 의미, 광고·튜토리얼·recent/revisit·viral UI는 그대로다.
- /shared와 미등록 경로는 기존 홈을 사용한다. 홈 UI·공유 문구는 변경하지 않았다. 과거 root 공유 링크는 소급 식별하지 못한다.
- 검증: engine 47 / 앱 443(54 suites) / preview 13, 타입·앱 빌드 통과. 3화면 × 3출처 실제 경기/광고 QA 및 product-loop/recent/revisit/records/share/viral QA 통과.
- [공유 진입 계약·콘솔 지표·검증](docs/SHARED_ENTRY_2026-10-18.md). 이벤트 횟수≠사용자 수. 전체 game_start/landing에는 재도전이 포함된다.
- **C1/C2, 실제 RN 공유창, HTTPS 링크 → Toss 진입, SDK 비정상 URI 부팅 경계, Live 수집은 여전히 실기기 검증 보류.** 배포·push·실제 이벤트 전송 없음.

# 이전 상태: Apps in Toss 운영 Analytics 연결 (2026-10-17)

- 기존 ProductEvents의 500개 메모리 journal을 보존하고 observer → Apps adapter → 공식 `eventLog` 경로를 추가했다. native entry에서 한 번 연결하며 먼저 기록된 app_open을 replay한다. SDK 2.10.10 RN API에 없는 소문자 Analytics.screen/click을 호출하지 않는다.
- 핵심 17개 이벤트만 `boxing_` namespace로 전송한다. ad_request/ad_loaded는 로컬만 유지한다. payload allowlist, 임시 경기/광고 연결 토큰, 동기/비동기 실패 및 5초 지연 격리, 중복 제거와 동시 요청 상한 적용. 자체 큐/재시도/서버/추적 ID 영구 저장 없음.
- 개발·Sandbox·browser preview는 전송 비활성, Jest는 명시적 mock. QR는 공식 문서상 콘솔 수집 대상이 아니다. Live 수집/콘솔 표시를 실제 검증한 것은 아니다. **출시 다음 날 분석 > 이벤트에서 boxing_ 이벤트를 확인**한다.
- game_end/result_view에 기존 계산값 기반 계측 속성만 추가했다. 게임 UI·lifecycle·death/광고 전이·share adapter·recent/revisit·기록 schema/comparator·package/lockfile 변경 없음.
- 검증: 엔진 47 / 앱 404(52 suites) / preview 13, 타입·앱 빌드, product-loop/recent/revisit/records/share/viral browser QA 통과. 보호 파일 110개 변경 없음.
- [운영 계측 계약·콘솔 확인 가이드](docs/APPS_ANALYTICS_2026-10-17.md). 이벤트 수≠사용자 수. 공식 DAU는 대시보드에서 확인하되 per-event 고유 사용자/세션 정의 및 콘솔 raw join 가능 여부는 별도 확인한다. entry_source는 unknown: external_share만으로 결과 공유 유입을 특정할 수 없다.
- **C1/C2 및 실제 RN 공유창/수신 링크 검증은 계속 보류.** 운영 수집 확인 또한 별도 게이트이며 배포·push·실제 Analytics 전송 테스트는 하지 않았다.

# 이전 상태: 공유를 고려한 결과 화면 (2026-10-17)

- 큰 생존 수/완주 → 실제 기록 기반 관장 한 줄 → 최근/최고 비교·가까운 목표 → primary 재도전 → 친구 질문·보조 공유 → 상세 복기로 정리했다. 홈·게임 엔진·광고 gate·공유 adapter·저장 정책은 유지한다.
- `resultFacts`를 화면과 공유 문구가 함께 사용하고, `buildViralResultPresentation`은 deterministic 문구만 만든다. 첫 기록과 실제 최고 갱신을 구분한다. 과거 v1 best는 recent 자격 검사로 배제하지 않는다.
- `친구에게 기록 보내기`는 기존 텍스트 공유를 실행한다. 친구 대결·보상·순위·새 이벤트는 추가하지 않았다. 상세 영역의 기록은 보존하며 저장 실패 안내는 접지 않는다.
- 이번 검증: 엔진 47 / 앱 372 / preview 13 통과, 타입·빌드 통과. 320/375/390 browser 검증과 기존 product/recent/revisit/records QA 통과. [상세 결과](docs/VIRAL_RESULT_2026-10-17.md).
- **C1/C2 및 실제 Apps in Toss 공유창·링크 진입 검증은 계속 보류.** 공유 욕구/공유율·재도전율 효과를 클라우드 테스트로 입증한 것은 아니다. 기존 실기기 체크리스트 유지.

# 이전 상태: 실제 경기 결과 텍스트 공유 (2026-10-16)

- 결과 화면 재도전 아래 보조 `결과 공유` 버튼. 난이도·이번 생존/완주·PERFECT와 실제 최고 갱신 또는 개선 한 줄만 공유한다. 첫 기록은 신기록으로 표현하지 않고 이모티콘·사용자 ID·roundId/runtimeId·seed는 payload에 넣지 않는다.
- React Native 기본 Share 사용. SDK 2.10.10의 share는 native 반환을 기다리지 않는 void wrapper여서 선택하지 않았다. iOS 활동 완료/취소와 Android chooser 호출 응답을 구분하며 전송/수신 성공으로 해석하지 않는다.
- 공식 getTossShareLink로 기존 `intoss://boxing-talent-test` 홈 링크만 생성한다. 실패·1.5초 초과 시 텍스트만 공유한다. challenge/추적 파라미터·동일 seed 실행 없음. 공유 유입 측정은 아직 불가.
- singleton adapter의 요청 잠금, Android handoff 1초 중복 방어, 화면 종료/재도전 시 늦은 링크 요청 폐기. 공유 실패/취소는 경기·기록·광고 카운터를 바꾸지 않는다. lifecycle/광고 controller/저장 모델 변경 없음.
- 내부 로컬 이벤트 share_tap/share_outcome 추가. [공유 구현·검증 기록](docs/RESULT_SHARE_2026-10-16.md). 외부 분석 전송·배포·실제 메시지 전송 테스트 안 함.
- **C1/C2 및 실제 공유창/수신 링크의 Apps in Toss 기기 검증은 보류.** [기존 기기 체크리스트](docs/DEVICE_VALIDATION_V1.md)는 보존했다. 친구 대결·동일 조건 challenge 등 다음 기능은 구현하지 않는다.

# 이전 상태: 최근 기록 기반 홈 다음 목표 (2026-10-16)

- 기존 난이도별 recent/best를 읽어 홈 기록 영역에 목표 하나만 표시한다. `buildRevisitPrompt` 순수 함수가 생성하며 새 저장 필드·history·방문일·미션·보상은 없다.
- 생존 차이 5회 이내는 ‘최고 생존 기록까지 N회’, 더 멀면 기존 결과 화면의 가까운 목표를 재사용한다. comparator 동점 또는 과거 clear 뒤 최근 KO는 최고 기록 재도전, 최근 완주자는 PERFECT 기반 목표 또는 최고 기록 재도전이다. 타이밍·30회·최고 기록 comparator·recent 저장 방식은 유지한다.
- recent가 best보다 좋은 불일치는 목표를 숨기고 `landing_view`의 `revisit_prompt_issue=recent_ahead_of_best`로 식별한다. 정상 저장·복원 경로에서는 재현되지 않았다. 임의 데이터 복구나 초기화를 하지 않는다.
- 기존 시작 버튼과 광고 gate를 그대로 사용한다. `landing_view`/홈 출발 `game_start`에 목표 유무·종류를 포함하고 결과 retry/다음 난이도 출발은 목표 전환으로 귀속하지 않는다. 외부 analytics 없음.
- [이번 구현·검증 기록](docs/REVISIT_PROMPT_2026-10-16.md). **C1/C2 실기기 검증은 계속 보류**이며 [기존 체크리스트](docs/DEVICE_VALIDATION_V1.md)를 유지한다. 결과 공유 등 다음 기능은 자동 진행하지 않는다.

# 이전 상태: 같은 난이도 최근 경기 1회 비교 (2026-10-16)

- v1-product-loop-baseline 위에 최근 경기 비교만 추가. `boxing-survival-v1`에 선택적 `recentByDifficulty`를 저장하며 기존 최고 기록·비교 순서는 유지한다. 이전 v1 데이터에는 최근 기록이 없는 것으로 처리한다.
- 실제 product game_end가 승인된 clear/knockout의 결과 확정 시 직전 최근 기록을 먼저 비교한 뒤 이번 기록으로 교체한다. 튜토리얼·중단·광고 실패·preview 가짜 경기는 최근 기록에 포함하지 않는다.
- 결과에 직전 경기 변화, 내 기록에 최고/최근을 구분한다. `result_view`의 비교 유무·이전/현재 결과·비교 분류를 기존 roundId로 `retry_game_start`에 연결한다. 외부 전송 없음.
- 검증 결과와 저장 호환성: [최근 경기 비교 구현 기록](docs/RECENT_COMPARISON_2026-10-16.md). 광고·death counter·lifecycle·튜토리얼·엔진 변경 없음.
- **C1 focus/AppState 순서와 C2 reward 이후 dismissed 누락: 실기기 검증 보류.** 기존 체크리스트를 보존하며 1차 제품 루프 실기기 완료로 판정하지 않는다. 다음 기능은 별도 결정 후 진행한다.

# 이전 기준: 2회 knockout 재도전 루프 (2026-10-15)

- 기준 태그: `v1-product-loop-baseline` (로컬). [실기기 검증 체크리스트](docs/DEVICE_VALIDATION_V1.md)의 iOS/Android 실행은 아직 남아 있다. 2026-10-16 사용자 결정으로 실기기 게이트를 보류하고 최근 경기 비교만 먼저 진행한다. C1/C2 해결·실기기 통과를 의미하지 않는다.

- 독립 검증 후 A1(재마운트 재도전 계측), A2(adapter 예외 격리), A3(챔피언 잽 STEP_IN 실패 설명)만 보완했다. [수정·검증 기록](docs/FIXES_A123_2026-10-15.md)을 참조한다. C1 lifecycle 순서/C2 dismissed 누락은 실기기 검증 대기이며 정책·튜토리얼 시간은 유지한다.
- 최신 정책은 [PRODUCT_DECISIONS](docs/PRODUCT_DECISIONS.md)를 따른다. 아래 2026-10-14 및 이전 기록은 역사 자료이며 매 사망 광고 정책을 복구하지 않는다.
- 현재 main working tree에서 구현. runtime당 2 KO→rewarded, 첫 KO 무료, clear 같은 난이도 무료. 다음 단계 interstitial/기록 banner 유지. 광고 완료는 reward+native dismissed 모두 필요하다.
- `src/app/product/`에 runtime 정책/고유 경기 ID/로컬 이벤트/결과 목표, `DefenseTutorial`에 경기와 분리한 버튼 연습. 카운터 영구 저장·기록 schema 변경 없음.
- 광고 완료는 foreground까지 경기 생성 보류. 오류 후 홈 이동의 늦은 callback도 폐기. 첫 기록/최고 갱신 분리, 전체 공격 표시명 공통화, 상세 기록 기본 접힘.
- 구현/검증 기록: [1차 구현 보고서](docs/IMPLEMENTATION_2026-10-15.md). 실제 토스 기기 광고·lifecycle 확인은 남아 있다. 배포·업로드·원격 push·외부 계측 전송 안 함.
- 2026-10-15 제품 감사 원문·일부 evidence artifact 누락 유지. 기존 art-direction 자료는 보존했다.

## 이전 상태: 광고 우회·본인 시점 가드 보완 (2026-10-14)

- 목숨 소진 후 홈·기록·난이도 변경·해금된 다음 단계에서도 보상 광고 요구를 유지한다. 실제 컨트롤러를 포함해 보상 없는 닫기·오류·중복 탭·두 번째 목숨 소진을 회귀 검사했다. 홈 `목숨은 다섯. 주먹을 읽고 끝까지 버텨보세요.` 문구 삭제.
- 본인 시점 좌우 손을 잘못 그려 엄지가 중앙으로 향한 생성 후보를 제외했다. 새 별도 PNG는 엄지 바깥쪽, 닫힌 grip 면, 연속 손목/팔을 사용한다. 글러브·팔을 한 장으로 균일 표시하고 양손 겹침과 상대 눈 가림을 줄였다. 정상 가드에 대한 이전 단정적 설명은 철회한다. 원본 art·모션·판정은 보존.
- 최종 260개 테스트(엔진47+앱213), 타입 검사, Android/iOS × RN 두 버전 빌드 통과. 실제 AIT 네 번들·보호 원본40개 검사 통과. 크기 세 가지·대기/중간/가드 SVG 9장 데스크톱 확인. 실제 기기 품질 확인은 남아 있다.
- 최종 AIT `01a135df-3b9e-7b7d-985d-f98ca0988f93`, 51,171,019바이트, SHA256 `78589d39e12716a0669f0e85146b5433d4eb4e56438007c5d9bcdaa2aaf7a5ab`. 사용자 `업로드해` 승인 후 **버전20261014-15** 등록, PUT HTTP200·업로드 완료 성공, 서버 CREATED·SDK2.10.10 확인. 본인 테스트 푸시 성공(`isTested=true`, `deployed=false`). 실제 기기 검증 대기, 검수·출시 안 함. 제외된 후보 deployment `01a135d0-b0b6-79d0-92d1-f6aa203e7678`은 업로드 금지.
- [버전15 테스트 QR](https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a135df-3b9e-7b7d-985d-f98ca0988f93&testVersionName=20261014-15), 본인 직접 실행 `intoss-private://boxing-talent-test?_deploymentId=01a135df-3b9e-7b7d-985d-f98ca0988f93`. 서버 응답 기록 `art-direction/retry-guard-upload-20261014.json`.
- 상세 `art-direction/retry-guard-fix-20261014.md`, 그림 `art-direction/guard-reference-preview-20261014/comparison-corrected.png`, 프롬프트 `art-direction/guard-generation-20261014.json`.

## 이전 상태: 전체 오류 점검 및 보완 (2026-10-13)

- 사용자 요청: 개별 문제를 반복해서 지시하지 않아도 전체 흐름을 점검하고 보완할 것.
- 흰 손목까지 표시하고 팔은 아래 화면 밖으로 연결했다. 짧은 경기 영역에서 상대와 내 손을 같은 배율로 함께 맞춰 얼굴 가림을 줄였다. 원본 PNG·모션·판정·카메라 계산은 유지했다.
- 앱 비활성 상태에서 광고 완료 콜백이 오면 새 경기도 일시정지한다. 기록 읽기/손상 백업이 응답하지 않으면 8초 후 로컬 플레이를 허용하고 저장 중지로 기존 데이터를 보호한다. 늦은 읽기 결과는 무시한다.
- 최종 `npm.cmd test` 254개(엔진 47 + 앱 207), 타입 검사, Android/iOS × RN 두 버전 빌드 통과. 최종 AIT 네 번들의 PNG 7개·WAV 8개·광고 ID·라우팅·이번 수정 반영 확인. 보호 원본 40개 및 기존 모션 표시/카메라 계산/스프라이트 시간 선택 3개 일치.
- 세 화면 크기·확대 글꼴 조건의 기능 흐름 테스트, 크기별 대기/가드 6장·공격 단계별 16장 데스크톱 시각 확인. 실제 기기 레이아웃·효과음 성공 또는 제품 완료를 뜻하지 않는다. 콘솔 광고 3지면 ENABLED·제한 NONE 확인.
- AIT deploymentId `01a1358f-235a-7f91-b637-6ee75ad4a7e7`, 48,754,405바이트, SHA-256 `5e3421f8334b3c4eae6631afcce05df35946c4e01d523dfc98f4dbfb2f5d3b22`. 사용자 “테스트 해보자” 요청으로 이번 전체 점검 수정본 업로드·본인 테스트 발급 진행. 버전 `20261013-14`, PUT HTTP 200, 서버 CREATED·SDK 2.10.10, 본인 테스트 푸시 성공(`isTested=true`, `deployed=false`). 실제 기기 테스트 결과 대기, 검수·출시는 안 함.
- [버전 14 테스트 QR](https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a1358f-235a-7f91-b637-6ee75ad4a7e7&testVersionName=20261013-14), 본인 직접 실행: `intoss-private://boxing-talent-test?_deploymentId=01a1358f-235a-7f91-b637-6ee75ad4a7e7`.
- 상세: `art-direction/full-audit-20261013.md`. 이전 로컬 AIT: `release-backup/boxing-talent-test-20261013-before-full-audit.ait`.

## 이전 상태: 사운드 컨테이너·글러브 비율 보완 (2026-10-13)

- 버전 13 iPhone 사진의 상단 공백은 사운드 WebView의 바깥 flex:1 컨테이너 때문이다. 실제 SDK 래퍼를 유지한 테스트로 재현 후 바깥 영역도 absolute 1×1, flex:0으로 분리했다.
- 상대 slice / 내 손 meet의 배율 차이를 없애고 실제 경기장 크기에 맞는 같은 viewBox를 적용했다. 내 글러브 가로 1.25배(160×240), 대기 아래 배치·가드 겹침 완화. 안내 스크롤을 위부터 보도록 정렬했다. 모션·판정·원본 이미지는 유지했다.
- 최종 249개 테스트(엔진 47 + 앱 202), 타입 검사·네 가지 네이티브 빌드 통과. 실제 AIT 네 종류 검사 및 보호 원본 40개 파일 일치. 세 경기장 크기의 컴포넌트 SVG를 데스크톱에서 비교했다. 실제 토스 화면·사운드 성공은 미확인이다.
- 새 AIT deploymentId 01a13568-607c-7f03-aedd-c3df04c42d92, 48,749,761바이트, SHA-256 4092ccd99ad4145dfc16a8b03ffda5f1f3be09bffb818da510a739e6bb2cbf67. 업로드·검수·출시 안 함. 늦게 재수신한 승인 메시지는 이미 업로드한 버전 13의 명시적 승인으로 이번 번들 승인과 구분한다.
- 상세: art-direction/layout-ratio-fix-20261013.md. 비교 이미지: art-direction/layout-ratio-preview-20261013/comparison.png. 이전 버전 13 AIT 백업: release-backup/boxing-talent-test-20261013-before-layout-ratio-fix.ait.

## 이전 상태: 글러브·효과음·사용법 보완 (2026-10-13)

- 사용자 iPhone 사진에서 복서·배경·관장 이미지와 게임 진행을 확인했다. 글러브는 좌상단에서 잘렸고 효과음이 들리지 않는다고 보고했다. 기록 버튼의 실제 기기 성공은 이번 사진으로 확인하지 않았다.
- 중첩 SVG를 G로 이동·격리하고 양손을 별도 contain-fit 화면층으로 표시한다. 원본 이미지·크기·모션·판정 유지. 현재 Granite iOS Video는 data: WAV를 파일 경로로 해석하므로 기존 8개 WAV를 로컬 HTML audio로 재생하도록 변경했다. 음소거·앱 전환·광고 중 중단, 지난 효과음 반복 방지, 재생 실패 표시를 유지/보완했다.
- 사용법을 회피 방향 세 줄과 목숨·가드 규칙으로 줄이고 게임·관장·버튼에 한글 단어 줄바꿈을 적용했다.
- 전체 246개 테스트(엔진 47 + 앱 199), 타입 검사, 네 가지 RN 빌드 통과. 최종 AIT 네 종류의 원본 PNG/WAV·SVG 이동·WebView·안내·줄바꿈·기록 컨테이너·index/_404 검사 통과. 보호 40파일 일치. 실제 아이폰 양손·효과음·줄바꿈 확인 대기.
- AIT deploymentId 01a13548-5d03-75a0-acdf-e780644c222e, 48,747,319바이트, SHA-256 50b42ffc1cd20e45512cd2d5698f9e9c471b31a4510c6ffba5e44aa82fae7bf9. 사용자 이 수정본 업로드·본인 테스트 링크 발급 승인. 버전 20261013-13 등록, PUT HTTP 200, 업로드 완료 성공. 서버 빌드 CREATED·SDK 2.10.10, 본인 테스트 푸시 성공(isTested=true, deployed=false). 테스트 QR·직접 링크는 상세 문서에 기록. 검수·출시 안 함.
- 상세: art-direction/glove-audio-readability-fix-20261013.md. 이전 버전 12 AIT는 release-backup/boxing-talent-test-20261013-before-glove-audio-readability.ait에 보존.

## 이전 상태: 이미지 데이터 누락·기록 배너 컨테이너 보완 (2026-10-13)


- 사용자 iPhone 사진으로 20261013-11의 게임 진입·경기 진행·결과·광고 영상 표시 확인. 복서/관장/글러브/배경은 비어 있고 기록 버튼은 일반 오류. Android·광고 종료/보상은 미확인.
- 기존 실제 AIT의 PNG require가 빈 모듈로 컴파일된 것을 확인. Granite가 로컬 asset를 제외하기 때문. 원본 PNG 7개의 바이트와 크기를 URI source로 생성해 렌더러에 전달. 원본 이미지는 보존했다.
- SDK InlineAd의 실제 ImpressionArea를 사용한 기록 버튼 테스트에서 IOProviderMissingError를 재현. 기록 ScrollView를 Granite IOScrollView로 수정 후 통과. 실기기 원본 기록 오류 스택은 없으므로 동일 예외 여부는 아직 직접 확인하지 못했다.
- 최종 237개 테스트(엔진 47 + 앱 190), 타입 검사·네 가지 네이티브 빌드 통과. 실제 AIT 네 개에서 이미지 7개의 원본 바이트·크기와 IOScrollView·index/_404를 검사. 보호 32개 + 원본 PNG 8개 바이트 일치.
- 이미지 소스맵 중복을 제외해 96.6MB → 48.7MB. 매핑은 유지. 기존 6.9MB보다 크므로 기기 초기 진입 시간·메모리·표시는 추가 확인 필요.
- 현재 AIT: `01a13531-b323-79fe-8f99-eca65ddf14cc`, 48,737,996바이트, SHA-256 `45ffbc8d1e4ede5afc56e0b39aabe5e52a88168c8f18e8e7cff0c87f2329e865`. 사용자 새 이미지·기록 수정본 업로드 및 본인 테스트 링크 발급 승인 후 PUT HTTP 200, 서버 빌드 CREATED, SDK 2.10.10 확인. 버전 `20261013-12`, 본인 테스트 푸시 성공(isTested=true, deployed=false). 기기 이미지/기록/광고 종료 QA 대기. 검수·출시 안 함. 이전 버전 11 AIT는 `release-backup/boxing-talent-test-20261013-before-art-records-fix.ait`에 보존. 상세·테스트 링크: `art-direction/art-records-fix-20261013.md`.

## 이전 상태: 실기기 게임 렌더링 오류 확인·SVG import 결점 수정 (2026-10-13)

- 사용자 사진에서 진단 C `20261013-10` 최초 `앱 진입 성공` 확인. 게임 버튼 뒤 `게임 화면 실행 실패` 및 `Element type is invalid ... got: object` 실제 예외 확인. 이 실행의 실패는 게임 렌더링 단계다.
- 기존 AIT 네 개의 실제 SVG import/JSX 식을 공유 namespace 조건에서 실행해 BoxerRig·CoachReaction·SpriteImage의 기본 import가 객체로 평가되는 것을 재현. 세 파일의 default import → named `{Svg}`로 최소 수정. SDK·의존성·광고·게임 규칙 변경 없음. 기존 Jest의 Babel 규칙과 다른 생산 esbuild import 변환을 검사하는 회귀 테스트 추가.
- 전체 235개 테스트(엔진 47 + 앱 188), 타입 검사·RN 네 가지 빌드 통과. 실제 수정 AIT 네 개에서 SVG 클래스 identity·최종 소스맵·root/404 연결 검사 통과. 보호 영역 32파일 원본 일치. 수정본 실제 아이폰 진입·게임·광고 성공은 미확인.
- 새 AIT deploymentId `01a1347e-cc43-7b0d-a7d6-256c0188f115`, 6,918,593바이트, SHA-256 `856b7aec768da0940ebb04051f84f5e0340624467afc7ed99eab5b7f0928c953`. 최초 업로드는 자동 승인 심사에서 거부됐으나 사용자가 SVG 수정본 업로드·본인 테스트 링크 발급을 명시적으로 승인한 뒤 업로드했다. 버전 `20261013-11`, PUT HTTP 200, 서버 빌드 `CREATED`, SDK `2.10.10`, 테스트 푸시 성공(`isTested=true`, `deployed=false`). 진단 화면 없이 기존 root 게임 직접 진입. 실제 아이폰 진입·게임·광고 검증 대기이며 검수·출시는 안 함. 상세 및 테스트 QR: `art-direction/svg-interop-fix-20261013.md`.

## 이전 상태: 진입 진단 C 업로드·기기 결과 대기

- 후속 진단 C: `../../entry-diagnostics/20261013-c`에 별도 복사본을 만들어 root → 진단 화면 → 버튼 후 게임 모듈 초기화로 분리했다. 프로덕션 소스·기존 AIT 보존. 전체 235개 테스트·타입 검사·RN 네 종류 빌드 및 실제 AIT의 root/_404·지연 초기화 검사 통과. deploymentId `01a13470-2bbe-77a3-b1fe-ce9846a08d42`, SHA-256 `f40cdd13d2785ee641b82b2120fb81bb19b373fcd35e9d2c65e4d6b566938cf0`. 최초 업로드는 자동 승인 심사에서 거부됐으나 사용자에게 진단 C 업로드·본인 테스트 링크 발급의 명시적 승인을 받은 뒤 정상 업로드했다. 콘솔 버전 `20261013-10`, PUT HTTP 200, 업로드 완료 성공, 서버 빌드 `CREATED`, SDK `2.10.10`, 본인 테스트 푸시 성공(`isTested=true`, `deployed=false`). 기기 검증·문제 해결은 미확인, 검수·출시 안 함. 상세 및 테스트 QR: `../../entry-diagnostics/20261013-c/README-DIAGNOSTIC.md`.
- 추가 심층 조사: AIT 네 개의 실제 컴파일된 페이지 export·createRoute·컨텍스트·라우터 함수를 추출해 실행하여 root '/' 게임 화면 연결을 확인했다. `_404`를 제외한 비교 조건에서 담당자 로그와 동일한 예외 재현. 기존 테스트는 SDK가 없는 root도 config에 만드는 특성 때문에 root 등록 증거가 부족했다.
- 새 조건부 재현: 실제 SDK registerApp는 같은 appName이 AppRegistry에 이미 있으면 새 context를 무시하고 기존 global.Page를 반환한다. registry 유지 모델에서 이전 404 예외가 새 context 전달 후에도 반복되고 registry 초기화 후 사라지는 것을 네 번들에서 확인했다. 사용자는 토스를 완전히 종료한 뒤 새 버전 QR로 실행해도 같은 오류라고 확인했다. 따라서 이전 JS 실행 상태가 계속 유지된다는 가설의 우선순위를 낮췄다. 실제 기기 registry 값이나 현재 예외는 여전히 미확인이다.
- 추가 산출물: `art-direction/entry-deep-audit-20261013.md`, `art-direction/bundle-route-deep-audit.cjs`, 결과 JSON. 프로덕션 소스·AIT 변경 없음. SDK 교체·추가 업로드·출시 없음. iOS에서 Android 전용 AppState blur/focus 구독도 확인했으나 설치된 네이티브 구현은 이 경로에서 throw하지 않으므로 현재 오류 원인으로 확정하지 않는다.
- 사용자가 `20261013-9`의 테스트 푸시/QR로 실행했으며 아이폰에서 여전히 실패한다고 확인했다. 화면 문구: “일시적인 오류가 생겼어요. 문제의 원인을 찾아 해결하고 있어요. 문제가 반복된다면 고객센터로 문의해주세요.” 안드로이드 발생은 사용자 추정이며 재현 확인은 없다.
- 콘솔 재조회: 새 버전 `CREATED`, `isTested=true`, `deployed=false`. 기존 라이브는 `20261002-8`. 환경 준비·서버 빌드는 기기 실행 성공의 증거가 아니다.
- 업로드했던 `.ait`를 SDK AITReader로 직접 열어 네 개 네이티브 번들의 실제 페이지 컨텍스트에 `./index.tsx`·`./_404.tsx`가 있는 것을 재확인했다. 기존 404 누락 예외를 수정한 사실과 현재 내부 예외가 같은지는 별개다. 현재 화면은 일반 오류 안내여서 예외 유형·실패 단계는 알 수 없다.
- 기존 시작 테스트는 페이지 컨텍스트를 수동 구성하고 SDK 라우터 유틸을 검사하며 네이티브 브리지·게임 화면을 대체한다. 실제 토스 호스트의 초기화·등록·렌더링까지 검증한 테스트가 아니다. 현재 증거만으로 SDK·광고·기기 탓으로 단정하거나 임의 수정하지 않는다.
- 연결된 콘솔 도구에는 이 실행의 원본 오류 스택을 조회하는 기능이 없다. 다음 증거는 진단 C의 최초 화면·게임 로딩 결과 또는 재현 시각의 첫 JS 예외·스택/네이티브 실패 로그다. 문의 초안: `art-direction/current-ios-error-inquiry-20261013.md`. 외부 문의 전송·검수·출시는 하지 않았다. 진단 C 업로드는 위 후속 상태를 따른다.

## 이전 상태: 광고·404 보완본 콘솔 업로드 및 테스트 준비 완료 (2026-10-13)

- 닫힘→늦은 보상 순서도 재도전을 한 번만 실행. 닫힘만으로는 보상하지 않으며 새 시도·화면 이탈 후 과거 콜백을 무시한다.
- 광고 로드 15초, 표시 120초의 복구 기한 적용. 닫힘 후 보상 확인 5초가 지나면 수동 재시도 가능하되 새 시도 전까지 늦은 보상을 수신한다. 표시 시간 초과만으로 게임을 자동 시작하지 않고, 돌아온 게임 화면에서 사용자가 눌러 복구한다.
- `src/app/ads/adOperation.ts`로 타이머·구독 정리. 동기 완료 및 이전 작업의 늦은 이벤트 방어. 게임 화면에 복구 버튼 문구·단계 전환 안내 반영.
- 수정 전 실패 7개 재현, 최종 `npm.cmd test` 엔진 47 + 앱 187 = 234개 통과, 앱 타입 검사·RN 0.84.0/0.72.6 Android/iOS 빌드 통과. 보호 영역 32개 파일 변경 없음.
- 새 `boxing-talent-test.ait`: 6,918,607바이트, SHA-256 `039a4a5f180886572f82df4c028ef7af9541d79b8be8b1a95853c6e7b32f30ab`. 소스맵 4개에서 최종 수정 소스·실제 광고 ID 3종·404 페이지 확인, 테스트 광고 ID 없음.
- 404 수정본 백업: `release-backup/boxing-talent-test-20261013-before-ad-recovery.ait`.
- 사용자 요청으로 콘솔 버전 `20261013-9` 업로드 완료. deploymentId `01a1343d-f2d4-78ba-8a4e-4f675ba5d12c`, 파일 PUT HTTP 200, 서버 빌드 `CREATED`, SDK `2.10.10`. 본인 토스 앱 테스트 푸시 성공. `isTested=true`는 테스트 환경 준비만 의미하며 실제 기기 QA는 미확인이다. 검수 요청·출시는 수행하지 않았다.
- 테스트 QR: https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a1343d-f2d4-78ba-8a4e-4f675ba5d12c&testVersionName=20261013-9
- 상세 검증: `art-direction/ad-recovery-fix-20261013.md`. 이전 출시 검토에서 제기한 2개 결점은 보완되었으며, 실제 광고 표시와 닫기·기기 진입 확인은 별도 필요.

## 이전 상태: 앱 진입 404 오류 수정·로컬 빌드 완료 (2026-10-13)

- 추가 출시 검토: 광고 3종은 콘솔에서 활성·제한 없음, 실제 ID 일치. 실적 report=null이라 노출은 미확인. 라이브 버전은 2026-10-13 조회에서도 `20261002-8`이다.
- 출시 보류 권고: 가짜 광고 포트에서 닫힘→늦은 보상 순서의 보상 유실 및 콜백 미수신 때 무한 대기 경로를 재현. 기기 발생 여부는 미확인. 이번 검토에서 게임 코드는 수정하지 않았으며, 보완 후 새 빌드·기기 QA 필요. 상세: `art-direction/release-audit-20261013.md`, 재현: `node art-direction/ad-event-audit.cjs`.

- 토스 담당자 로그와 같은 `404 page not found` 예외를 실제 Granite 라우터로 재현. 첫 화면 `index`는 기존 번들에 있었고, 필수 `/_404` 페이지 누락이 원인.
- `pages/_404.tsx` 추가. 기본 export를 통해 Granite가 `/_404`로 등록하며, 알 수 없는 경로에는 게임 재실행 안내를 표시.
- `src/app/__tests__/routeStartup.test.ts` 추가. 실제 페이지 모듈과 SDK 라우터로 초기화 실패를 먼저 확인한 뒤 수정 후 통과. 기기 전용 브리지만 제외하며 라우터 동작은 대체하지 않음.
- 최종 검증: `npm.cmd test` 엔진 47개 + 앱 175개 = 222개 통과, `typecheck:app` 통과, `build:app` RN 0.84.0/0.72.6 Android·iOS 빌드 통과. 소스맵 4개 모두 `index`와 `_404` 페이지 포함 확인.
- 수정된 로컬 산출물: `boxing-talent-test.ait`, SHA-256 `8383c89376d329baafd85307fe7116a98e2726e8876dcca109dbb6a3ad073be1`.
- 이전 .ait는 `release-backup/boxing-talent-test-20261013-before-router-fix.ait`에 보존. 보호 영역 `src/game/`, `tests/`, `tools/mocap/` 32개 파일의 내용 해시 변경 없음.
- 새 번들 업로드·검수 요청·출시는 하지 않음. 실제 휴대폰에서 수정본 진입 성공은 아직 미확인. 이전 대화의 콘솔 조회에서 라이브 버전은 `20261002-8`로 확인됨.
- 상세 증거: `art-direction/router-startup-fix.md`. 이 폴더에는 Git 메타데이터가 없어 현재 브랜치/커밋 상태는 확인할 수 없음.

## 이전 상태: 토스 반려 수정본 업로드 (2026-10-02)

- 토스 앱 78237 / workspace 36427: 반려 사유인 테스트 광고 ID와 앱 이름 불일치를 수정. 콘솔에서 실제 광고 ID 3개를 확인했고 테스트 ID를 생산 코드에서 제거.
- granite 브랜드명과 게임 화면 제목을 등록명 `복싱재능테스트`로 통일. 진입 경로를 진단 B 화면에서 P0GameScreen 직접 진입으로 복원. 이전 Storage·광고 브리지 예외 처리는 유지.
- 221개 테스트(엔진 47 + 앱 174), 앱 타입 검사 및 RN 0.84/0.72의 iOS/Android 빌드 통과. .ait의 JS/소스맵 8개에서 테스트 광고 ID·DiagnosticEntry 없음, 실제 광고 ID 및 등록명 확인.
- 수정본 `20261002-8`, deploymentId `01a0fa9f-d0ad-71cb-a5cd-62db1e07cfae`. 토스 업로드 및 컴파일 요청 완료. 재검수 제출/출시 완료로 해석하지 말 것.
- 새 버전 휴대폰 테스트 완료 및 검토 요청을 사용자가 확인한 다음 제출한다. 이전 iPhone 실행 오류 원인은 확정되지 않았고 실제 기기 정상 실행도 아직 미확인.
- 이전 파일은 `release-backup/boxing-talent-test-20261002-before-release-fix.ait`에 보존. 보호 엔진·모션 변경 없음.

## 이전 상태: 기록 조회 분리·완주 승급 수정 (2026-09-20)

현재 폴더는 boxing-app-cartoon-rebuild. 최신 결점·수정·출시 경계는 art-direction/release-review.md를 따른다.

- 오늘의 코스·기록 보기는 조회 화면. 별도 도전 버튼에서 경기 시작. 앱에서도 개인 기록 조회 가능.
- 30회를 완주하면 다음 단계 해금. 기존 완주 기록도 parseProgress에서 소급 해금. 고득점은 관장의 인정 별도 성취.
- 다음 경기 시작이 이전 제출을 취소하는 문제, 초기 로딩 클릭, 폐기된 요청의 뒤늦은 시작, 네트워크 무한 대기를 수정.
- 단계 이름 변경은 사용자가 보류. 입문·도전자·챔피언 유지.
- 세 번 이상 연속 방어하다 피격 시 관장 "그럼 그렇지.." 추가. 연타 중 피격도 해당 연타 종료 후 안전 구간에서 반응.
- 181개 테스트, 앱 타입·빌드 통과. 브라우저 320/390의 기록 조회와 세 단계 및 목숨 1개·완벽13회 완주 승급 확인.
- 실제 기기 QA, 공개 비교 서버·앱 연결, 순위 악용 대응, 앱 아이콘은 미완료. 배포하지 않음.
- 원본 src69개와 보호 엔진·모션32개 변경 없음. 이전 survival-update.md의 고득점 승급 조건은 위 완주 기준으로 대체됨.


