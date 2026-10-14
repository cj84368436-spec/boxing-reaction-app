# 토스 담당자 답변의 앱 진입 경로 추가 조사

## 결론

새 AIT의 실제 라우팅 코드에서 `index` export → `createRoute('/')` → 게임 화면 등록은 정상 연결된다. 기존 담당자 로그의 정확한 예외는 index 누락을 검사하는 코드가 아니라 `/_404` 화면을 찾지 못할 때 발생한다. 새 파일의 페이지 컨텍스트로는 해당 예외가 나지 않았고, `/_404`를 제외한 비교 조건에서는 동일한 예외가 재현됐다.

추가로 SDK의 이미 등록된 앱 처리에서 **기존 root가 새 context로 교체되지 않는 경로**를 확인했다. 같은 AppRegistry와 global.Page가 유지되는 조건을 모델링하면 수정된 context를 전달해도 이전 root가 반환되어 이전 404 예외가 그대로 반복된다. 사용자 기기에서 실제로 이 상태가 유지되고 있는지는 아직 확인하지 못했다. 원인 확정이나 SDK 교체의 근거로 취급하지 않는다.

## 실제 번들 코드 검사

- 대상: 콘솔 `20261013-9`, deploymentId `01a1343d-f2d4-78ba-8a4e-4f675ba5d12c`에 업로드한 `boxing-talent-test.ait`.
- SHA-256 재확인: `039a4a5f180886572f82df4c028ef7af9541d79b8be8b1a95853c6e7b32f30ab`. 조사 중 앱 소스나 AIT를 변경하지 않았다.
- SDK AITReader로 파일을 열고 Android/iOS, RN 0.84.0/0.72.6의 JS 네 개를 직접 읽었다. 각 파일을 Node VM 구문 분석하고, Babel AST로 컴파일된 SDK 라우터·createRoute·페이지 export·requireContext 코드를 추출해 실행했다. 소스맵의 문자열 포함 여부만 검사한 것이 아니다.
- 네 개 모두 root `Route._path='/'`와 root 화면 연결이 확인됐다. 게임 함수는 이름과 identity만 대체했으며 React 렌더링·기기 브리지·게임 동작은 이 검사에 포함되지 않는다.
- `_404` 화면의 기본 export 연결도 확인했다. `_404`를 제거하는 비교 조건에서 담당자와 동일한 `404 page not found. Please create ...` 예외 재현.
- SDK는 root 화면이 없는 경우에도 config['/']를 만든다. 그러므로 기존 테스트의 config['/'] 확인만으로 root 화면 등록을 증명하기에는 부족했다. 이번 검사는 실제 screens의 root component와 Route export 연결도 확인했다.
- 로컬 React Navigation 경로 파서에서 `intoss://boxing-talent-test`, 뒤의 `/`, deployment 쿼리는 root `/`로 매핑된다. `/index`와 미등록 경로는 `/_404`로 매핑된다. `index` 파일은 `/index`가 아니라 `/`로 접근한다.
- raw `intoss-private://`는 `intoss://` prefix와 직접 일치하지 않는다. 이 결과만으로 QR 오류라고 결론내리지 않는다. AppsInToss.registerApp는 raw QR 문자열을 직접 인자로 받지 않고 네이티브 CommonModule.getConstants().schemeUri를 읽으므로, 실제 앱에서 전달되는 값과 초기 네비게이터의 fallback을 확인해야 한다.
- 실행: `node art-direction/bundle-route-deep-audit.cjs`, 종료 코드 0. 결과: `art-direction/bundle-route-deep-audit-20261013.json`.

## 기존 root 재사용 경로의 재현

새 번들 내부 `@apps-in-toss/framework`의 컴파일된 registerApp 함수는 다음 흐름이다.

1. AppRegistry.getAppKeys()에 appName이 있는지 검사한다.
2. 없을 때만 Granite.registerApp에 새 context를 전달하고 global.Page를 설정한다.
3. 이미 있으면 새 context를 등록하지 않고 기존 global.Page를 반환한다.

실제 SDK 함수를 추출하고 네이티브 registry 유지 조건만 모델링한 비교 실험:

- 이전 context(index만 있음)를 등록 → root 실행에서 404 누락 예외.
- 같은 registry와 global.Page를 유지하며 새 context(index + _404) 전달 → 이전 root와 동일한 함수 반환, 같은 404 예외.
- registry와 global.Page를 비운 후 새 context 등록 → 새 root 생성, 404 누락 예외 없음.

네 개 번들 모두 동일했다. 이것은 **조건부 재현**이며 실제 토스 호스트가 버전 전환 시 JS runtime/AppRegistry를 유지하는지는 미확인이다. 사용자에게 토스를 앱 전환 화면에서 완전히 종료한 후 새 버전 QR로 실행하는 구분 테스트를 요청했다. 앱 삭제·재설치나 SDK 수정은 요청하지 않았다.

후속 결과: 사용자가 토스를 완전히 종료하고 새 버전 QR로 실행해도 같은 오류라고 확인했다. 이전 JS 실행 상태가 남아 있다는 가설의 우선순위를 낮춘다. 이 결과만으로 다운로드 캐시나 호스트 동작까지 모두 배제하지는 않으며, SDK 등록 함수를 임의로 수정하지 않는다.

## 다른 코드 문제와 우선순위

P0GameScreen은 Android 전용 AppState `blur`/`focus`도 플랫폼 구분 없이 iOS에서 구독한다. 공식 API: https://reactnative.dev/docs/appstate . 설치된 iOS RCTAppState는 `appStateDidChange`·`memoryWarning`만 지원한다. 설치된 RCTEventEmitter.addListener는 지원되지 않은 이벤트를 debug 모드에서 기록하고 구독 수를 증가시키며, 이 코드 자체에서 throw하지 않는다. 따라서 정리할 플랫폼 불일치는 있으나 현재 일반 오류 화면의 원인으로 확정할 수 없고 우선 수정 대상으로 삼지 않았다.

광고 로드와 지원 여부 검사에는 이미 catch/오류 상태 처리가 있고 기록 읽기 실패도 처리한다. 이 사실로 SDK 전체 import와 네이티브 초기화까지 안전하다고 판단하지 않는다. SDK 자체가 페이지 렌더 전 MiniAppModule/CommonModule/TossCoreModule 및 공유 React·네비게이터를 초기화하는 과정은 기기 호스트에 의존한다. 이번 조사에서 새로 재현된 앱 코드의 확정된 치명적 예외는 없다.

## 다음 구분 기준

토스 완전 종료 후 성공하면 기존 registry/실행 환경 유지 가능성을 뒷받침한다. 그대로 실패하면 이 가설을 낮추고 새 deploymentId의 첫 JS 예외 또는 네이티브 실패 로그로 다음 단계를 정한다. 완전 종료가 성공한다 해도 특정 SDK 결함으로 단정하려면 당시 registry와 실제 선택 버전 확인이 추가로 필요하다.

출시·검수 제출·SDK 변경·프로덕션 코드 변경·새 번들 업로드는 수행하지 않았다.
