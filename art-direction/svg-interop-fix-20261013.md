# 아이폰 실기기 오류의 SVG import 변환 수정

## 실기기에서 새로 확인한 증거

사용자가 진단 C `20261013-10`으로 보내준 두 사진에서 최초 `앱 진입 성공` 화면을 확인했다. 게임 로딩 버튼 이후에는 `게임 화면 실행 실패`와 다음 실제 예외가 표시됐다.

`Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object.`

따라서 이 실행은 게임 모듈 로딩 전의 SDK 등록·root 진입까지 성공했으며, 게임 렌더링 단계에서 유효하지 않은 객체 컴포넌트를 받았다. 사진의 React 스택에는 앱 컴포넌트 이름이 없으므로 이 스택만으로 특정 컴포넌트를 단정하지 않았다.

## 소스와 실제 번들에서 좁힌 문제

- 최초 게임 화면은 BoxerRig·CoachReaction을 그리고 이들은 SpriteImage를 사용한다. 세 파일 모두 `react-native-svg`의 기본 import를 JSX 타입으로 사용했다.
- 설치된 SVG 라이브러리는 namespace 객체에 `default`와 `Svg` 클래스를 내보낸다. 토스의 Granite 공유 모듈 어댑터는 `module.exports = sharedModule.get()`를 사용한다.
- 기존 업로드 `20261013-9` AIT의 실제 컴파일 코드에서는 `__toESM(require_react_native_svg(), 1).default`가 JSX 타입에 들어간다. Node 방식의 기본 import 해석에서 이 값은 SVG 클래스가 아니라 namespace 객체가 된다. 프로젝트 `package.json`의 `type: module`과 관계가 있다. [esbuild 공식 설명](https://esbuild.github.io/content-types/#default-exports)
- 공유 모듈을 namespace 형태로 제공하는 조건에서 기존 AIT의 실제 변환 함수와 JSX 타입 식을 실행했다. RN 0.84.0/0.72.6의 iOS/Android 네 종류, 세 컴포넌트 모두 object로 평가됐다. `__esModule` 표식이 있는 경우와 없는 경우 모두 검사했다. 실제 토스 호스트의 공유 객체를 직접 덤프한 검사는 아니다.
- 기존 Jest는 Babel import 규칙을 사용하므로 이 생산 번들의 변환 결점을 잡지 못했다. 이번 회귀 테스트는 실제 프로젝트 경로·ESM 설정·esbuild·Granite와 같은 공유 모듈 어댑터를 사용한다.

## 최소 수정 및 현재 검증

BoxerRig·CoachReaction·SpriteImage의 `import Svg`를 `import {Svg}`로 변경했다. SDK·의존성·게임 규칙·광고 ID·페이지 구성은 변경하지 않았다. 진단 화면을 제거하는 변경도 없으며 생산 후보는 기존처럼 게임에 직접 진입한다.

- 수정 전 회귀 테스트 실패: 컴포넌트 자리에 namespace object.
- 수정 후 회귀 테스트 통과. 기존 기본 import 비교 조건은 여전히 namespace object로 평가되고, 실제 파일의 named import는 Svg 함수 identity를 유지한다.
- 최종 `npm.cmd test`: 엔진 47 + 앱 188 = 235개 통과, 앱 Jest 29개 suite. `typecheck:app`·`build:app` 성공.
- 수정 AIT 네 개에서 실제 컴파일된 JSX 타입이 `.Svg`로 연결되며, 공유 namespace 조건에서 클래스/함수로 평가되는 것을 확인했다. 세 최종 컴포넌트 소스가 소스맵 내용과 일치.
- 새 AIT에서도 실제 root → P0GameScreen 및 `_404` 페이지 등록 검사 성공.
- 보호 영역 `src/game/`, `tests/`, `tools/mocap/` 총 32파일이 변경 전 진단 C 복사본과 byte 단위로 동일.
- 백업: `release-backup/boxing-talent-test-20261013-before-svg-interop.ait`.
- 증거: `svg-import-before-after-20261013.json`, `svg-fixed-route-audit-20261013.json`, `svg-interop-tests-20261013.log`, `svg-interop-build-20261013.log`.

## 산출물 및 기기 검증 경계

- 파일: `boxing-talent-test.ait`, 6,918,593바이트
- deploymentId: `01a1347e-cc43-7b0d-a7d6-256c0188f115`
- SHA-256: `856b7aec768da0940ebb04051f84f5e0340624467afc7ed99eab5b7f0928c953`

실기기 사진의 오류와 일치하는 번들 결점을 재현하고 수정했으나, 수정본의 아이폰 정상 진입·게임·광고 표시를 아직 확인하지 않았다. 외부 업로드·테스트 링크 상태는 인계 기록의 최신 항목을 따른다. 검수·출시는 진행하지 않는다.

최초 업로드 준비 도구 호출은 자동 승인 심사에서 기존 진단 C 승인이 새 SVG 수정본까지 포함하지 않는다는 이유로 거부됐다. 이후 사용자가 새 SVG 수정본의 토스 콘솔 업로드 및 본인 테스트 링크 발급을 명시적으로 승인했다. 승인 후 `20261013-11`로 등록, 파일 PUT HTTP 200 및 업로드 완료 호출 성공. 서버 컴파일 `CREATED`, SDK `2.10.10`, 본인 테스트 푸시 성공(`isTested=true`, `deployed=false`). 검수·출시는 진행하지 않았다. 실제 기기 실행 성공은 아직 미확인이다.

- 테스트 QR: https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a1347e-cc43-7b0d-a7d6-256c0188f115&testVersionName=20261013-11
- 직접 실행: `intoss-private://boxing-talent-test?_deploymentId=01a1347e-cc43-7b0d-a7d6-256c0188f115`
