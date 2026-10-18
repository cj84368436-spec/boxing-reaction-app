# 결과 공유 진입 계측 — 2026-10-18

## 범위와 근거

결과 공유 링크의 **최초 실행 출처**만 구분한다. 친구 기록·추천인·challenge·보상·새 모드 없음. 기존 500개 ProductEvents journal → Apps Analytics adapter → `eventLog` 경로를 유지한다.

설치 SDK 확인:

- `@apps-in-toss/framework` 2.10.10은 native-modules의 `getSchemeUri(): string`을 공식 재노출한다. `node_modules/@apps-in-toss/native-modules/dist/index.d.ts`의 설명은 “처음에 화면에 진입한 스킴 값… 페이지 이동으로 인한 URI 변경은 반영되지 않음”이다.
- framework `dist/index.js`의 `registerApp`도 같은 API 값을 Granite `initialScheme`으로 사용한다. 비동기 Linking API나 임의 query source를 추측하지 않았다.
- 설치 타입과 [공식 미니앱 공유 링크 문서](https://developers-apps-in-toss.toss.im/documentation/common/growth/share/miniapp-share-link.md)는 `intoss://<앱이름>/about?name=test` 형태를 지원한다. 공식 문서 확인본은 `artifacts/shared-entry-20261017/official-share-link.md`에 보존했다.
- Granite 1.0.43의 실제 createRoute/getRouteScreens/getScreenPathMapConfig를 사용한다. `pages/shared.tsx` → `src/pages/shared.tsx` → 기존 `P0GameScreen`. `_404`도 기존 홈으로 연결한다.

## URI와 runtime 계약

| 입력 | 출처 |
|---|---|
| `intoss://boxing-talent-test` 또는 `/` | `direct` |
| `intoss://boxing-talent-test/shared` 또는 `/shared/` | `shared_result` |
| 빈 값, 다른 앱/스킴, 미등록 경로, 잘못된 인코딩, 4096자 초과, API 예외 | `unknown` |

공유 URI는 기존 root에서 **`intoss://boxing-talent-test/shared`**로 바뀐다. HTTPS URL 자체는 계속 공식 `getTossShareLink`가 생성한다. 앱이 임의 HTTPS 주소를 만들지 않는다. URL에 사용자·runtime·round·seed·점수·PERFECT·추천인 정보를 넣지 않는다. 기존 공유 텍스트·RN Share 호출·취소/오류/중복 방어는 유지한다.

query/fragment는 출처 지정에 사용하지 않는다. `/shared?source=evil`은 경로만 보고 shared_result, root의 `?source=shared_result`는 direct다. query를 journal이나 Analytics에 복사하지 않는다. URL API/polyfill 의존 없이 제한된 공식 scheme/host/path만 검사한다. `intoss-private` 등 별도 개발 스킴을 운영 direct/shared로 추측하지 않는다.

Native singleton은 app_open을 잠시 보류한다. `src/_app.tsx`에서 **초기 URI 읽기 → runtime 출처 고정 및 app_open → Analytics journal replay → 앱 등록/화면 표시** 순으로 초기화한다. 읽기 실패는 unknown으로 확정한다. 초기화 전 이벤트가 먼저 발생하는 예외 경로도 unknown app_open을 먼저 기록하고 흐름을 계속한다.

출처는 첫 확정 뒤 변경할 수 없다. tutorial·records·home·난이도·screen remount·재도전에도 유지한다. 이미 열린 runtime에서 다른 링크를 열어도 최초 출처를 덮어쓰지 않는다. 새 runtime은 다시 판정하며 Storage 필드를 추가하지 않는다. event 호출자가 임의 entry_source를 전달해도 runtime 값이 우선한다. adapter도 direct/shared_result/unknown allowlist를 적용한다.

홈 안내 문구는 추가하지 않았다. 공유 경로와 미등록 경로 모두 기존 홈·시작 버튼·튜토리얼·광고 gate를 사용한다.

## Analytics와 콘솔 해석

운영 전송하는 기존 이벤트 모두에 고정된 `entry_source`가 포함된다. 특히:

| 이벤트 | 의미 |
|---|---|
| boxing_app_open | runtime 시작, 1회 |
| boxing_landing_view | 기존 홈 노출 |
| boxing_game_start | 기존 정책에 따라 실제 생성된 경기 |

기존 `source=landing/free_retry/ad_retry/next_level`과 `is_retry` 의미는 그대로다. entry_source는 최초 유입, source는 이번 경기 시작 행동이다. 기존 boxing_ namespace, 개인정보 allowlist, 임시 경기/광고 연결 토큰, fail-open, 중복 제거, mock/dev/sandbox 차단을 유지한다. 원본 URI는 전송하지 않는다.

Live 배포 후 다음 날 콘솔 **분석 > 이벤트**에서 위 log_name과 `entry_source` 파라미터를 확인한다. 콘솔에서 파라미터 조건별 조회가 가능한 범위를 실제 계정에서 확인하고, 같은 기간·배포 버전으로 비교한다.

- 일반 진입 이벤트 수: `boxing_app_open WHERE entry_source=direct`.
- 공유 진입 이벤트 수: `boxing_app_open WHERE entry_source=shared_result`.
- 공유 홈 노출 수 L: `boxing_landing_view WHERE entry_source=shared_result`.
- 공유 유입 실제 경기 수 G: `boxing_game_start WHERE entry_source=shared_result`.
- 요청한 시작 지표: `G / L`. direct도 같은 방식으로 비교한다. **재도전을 포함하므로 이 비율은 100%를 넘을 수 있으며 사용자 전환율이 아니다.**
- 홈에서 시작한 경기만 보려면 game_start에 `source=landing` 조건을 추가한다. 홈 재방문·재경기 때문에 이 역시 고유 사용자/첫 실행 전환율과 다르다.
- 진짜 사용자/세션 단위 전환은 공식 콘솔의 고유 사용자·세션 및 퍼널 집계 지원/정의를 확인한 뒤 산출한다. runtime ID를 사용자 ID로 보내지 않는다.

share_tap과 shared_result 진입 총량을 볼 수 있으나 특정 공유 건과 특정 진입을 연결할 수 없다. 기존에 발행된 root 공유 링크는 새 코드에서도 direct이며 소급 식별하지 못한다. shared_result는 전용 경로 유입을 뜻하며 실제 메시지 전송/수신 증명이 아니다. 광고 수익/ARPDAU/수신 대상도 측정하지 않는다.

## 검증

검증은 2026-10-17~18에 실행했고 이어받은 기록을 포함해 `artifacts/shared-entry-20261017/`에 보존한다.

- parser/runtime/allowlist/native bootstrap/실제 Granite route 전용: 37개 통과.
- RN 화면: direct/shared_result/unknown에서 records 왕복 → remount → 기존 두 단계 tutorial → 실제 game_start 1회 및 전체 이벤트의 동일 출처 확인.
- `npm test`: engine 47개, 앱 54 suites / 443개, 계약 검사 통과.
- `npm run typecheck:app`: 통과. 새 route 등록 뒤 설치된 공식 generator를 실행하여 src/router.gen.ts를 갱신했다. 이번 프로젝트 build 설정은 generator를 자동 호출하지 않는다.
- 생성 명령: `node --input-type=module -e "import {router} from '@granite-js/plugin-router'; router({watch:false}).build.handler();"`.
- `npm run build:app`: Android/iOS, RN 0.84.0/0.72.6 및 로컬 .ait 생성 통과. 업로드하지 않았다.
- `npm run test:preview`: 13개 통과.
- `check-entry-source.mjs`: 320×568, 375×667, 390×844 × 3개 출처, 총 9흐름. 실제 engine 시작 → KO1 무료 → KO2 mock rewarded → reward+닫힘 → 실제 경기 1회, 고정 출처, records 왕복 확인.
- product-loop/records QA: 320/390. recent/revisit/share QA: 320/375/390. viral result QA: 실제 공유 mock 흐름 및 결과 fixture 18개 통과.
- 기존 throw/reject/timeout, 취소/실패/중복 공유, recent/revisit/first-best, 광고/튜토리얼 회귀 포함. 실제 native 전송 없이 mock을 사용했다.

Browser `/shared`, `/__qa_unknown_entry`는 명시적 URI fixture다. 실제 Toss HTTPS 링크나 native bridge를 재현한 것이 아니다. browser에 native Analytics bootstrap을 넣지 않으며 QA용 pure adapter + mock transport만 사용한다. Preview에는 RN 튜토리얼이 없으므로 그 유지 검증은 RN 화면 테스트 결과로 구분한다.

## 미검증 경계

**C1 focus/AppState, C2 reward 후 dismissed 누락, 실제 RN 공유창, 실제 공유 HTTPS 링크 클릭 → Toss 앱 진입, Live Analytics 수집은 모두 보류.** 기존 실기기 체크리스트를 유지한다.

앱 소유 URI 판별/초기화는 실패를 잡아 unknown으로 계속하며 미등록 경로는 홈으로 연결한다. 다만 SDK는 앱 밖에서 자체 getSchemeUri 호출 및 Granite의 decodeURI 초기 라우팅도 수행한다. SDK 초기화 자체의 브리지 실패/잘못된 escape 입력까지 앱의 parser 테스트로 안전하다고 증명하지 않는다. 해당 native 부팅 경계와 링크 정규화는 실기기 확인 대상이며 SDK/라우터를 monkey patch하지 않았다.

실기기 확인 시 direct/shared 새 실행 각각에서 app_open → landing_view → game_start의 동일 출처, records/tutorial 경유, 프로세스 종료 후 direct 초기화, old root 링크, malformed/빈 경로 fallback을 기록한다. 개발/QR에서 콘솔 수집이 없다는 이유만으로 실패로 판정하지 않는다. Live 콘솔에서는 실제 이벤트 수집과 속성 필터 가능 여부를 따로 확인한다.
