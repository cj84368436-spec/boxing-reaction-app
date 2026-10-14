# 글러브·효과음·사용법 보완 (2026-10-13)

## 기기에서 확인된 상태

- 사용자 iPhone 사진에서 상대 복서·배경·관장 이미지가 표시되고 게임이 진행됨을 확인했다. 파란 글러브는 좌상단에서 잘렸으며 사용자는 효과음이 들리지 않는다고 보고했다.
- 이번 사진은 경기 중 화면이다. 기록 버튼의 실제 기기 성공 여부와 Android 동작은 확인하지 않았다.

## 원인과 수정

- 설치된 react-native-svg의 iOS `RNSVGGroup.mm`은 중첩 Svg 영역을 `(0, 0, width, height)`에서 잘라 그린다. Svg의 x/y에만 의존하던 SpriteImage를 각자 이동·잘림 범위를 가진 G로 감쌌다. 양손은 별도 SVG 화면층에서 `xMidYMax meet`로 표시해 상대 캐릭터의 화면 채우기 자르기와 분리했다. 기존 크기 128×195를 유지했고, 양손의 기본 위치와 가드 위치를 280×400 영역 안으로 옮겼다. 원본 이미지·모션·판정은 유지했다.
- 설치된 Granite Video iOS AVPlayerProvider의 `loadSource`는 HTTP(S) 이외 주소를 파일 경로로 취급한다. 기존 `data:audio/wav;base64,...`는 파일이 아니므로 지원 경로가 아니다. 기존 8개 WAV 바이트를 그대로 쓰는 로컬 HTML audio 플레이어로 교체했다. 외부 음원 서버나 새 권한은 추가하지 않았다.
- 소리 끄기·백그라운드·일시정지·광고 중에는 플레이어를 제거한다. 복귀할 때 지난 효과음은 반복하지 않는다. 문서 자체도 숨겨질 때 소리를 멈춘다. 실제 재생 오류는 게임을 중단하지 않고 소리 버튼에 ‘소리 재생 실패’로 표시한다.
- 사용법을 공격별 회피 방향 세 줄과 목숨·가드 규칙으로 줄였다. 게임·관장·조작 버튼에 iOS `hangul-word` 줄바꿈과 Android 기본 고품질 줄바꿈·자동 하이픈 없음 설정을 적용했다. 기기의 글자 크기 설정은 유지한다.

## 검증과 한계

- 수정 전 글러브 위치·오디오 경로·짧은 안내 테스트 실패 확인, 수정 후 관련 31개 통과.
- 전체 엔진 47개 + 앱 199개 = 246개 테스트 통과. 앱 타입 검사 통과. iOS/Android × RN 0.72.6/0.84.0 네 종류 빌드 통과.
- HTML 오디오 테스트는 원본 8개 WAV 포함, 새 충돌 시 이전 소리 중단, 숨김·재생 거부·지연된 이전 콜백을 검사한다. 오디오 요소는 테스트 대역이므로 스피커 출력 성공을 증명하지 않는다.
- 실제 최종 AIT 네 개의 원본 PNG/WAV 바이트, named WebView 연결, 이동 G, 글러브 화면층, 간단 안내·줄바꿈, 기록용 IOScrollView 및 index/_404 연결을 검사했다. 보호 영역 32파일과 원본 PNG 8파일이 기존 기준본과 일치한다.
- 아이폰에서 양손 표시·가드 위치·실제 효과음·줄바꿈·광고 후 복귀는 새 버전으로 확인해야 한다. 특히 ‘소리 켜짐’은 사용자 설정이며 들리는 소리를 자동 검증한 표시가 아니다.

## 산출물과 전달

- deploymentId: `01a13548-5d03-75a0-acdf-e780644c222e`
- AIT: `boxing-talent-test.ait`, 48,747,319바이트
- SHA-256: `50b42ffc1cd20e45512cd2d5698f9e9c471b31a4510c6ffba5e44aa82fae7bf9`
- 이전 버전 12 AIT 보존: `release-backup/boxing-talent-test-20261013-before-glove-audio-readability.ait`
- 로그: `glove-audio-readability-tests-20261013.log`, `glove-audio-readability-types-20261013.log`, `glove-audio-readability-build-20261013.log`
- 실제 AIT 검사: `glove-audio-readability-bundle-audit.cjs`, 결과 JSON.
- 사용자가 이 특정 수정본의 업로드·본인 테스트 링크 발급을 승인했다. 버전 `20261013-13` 생성, PUT HTTP 200, 서버 빌드 CREATED·SDK 2.10.10, 본인 테스트 푸시 성공(isTested=true, deployed=false). 검수·출시는 하지 않았다. 서버 상태는 실제 기기 실행 성공의 증거가 아니다.
- [이 버전 테스트 QR](https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a13548-5d03-75a0-acdf-e780644c222e&testVersionName=20261013-13)
- 본인 토스 직접 실행: `intoss-private://boxing-talent-test?_deploymentId=01a13548-5d03-75a0-acdf-e780644c222e`

API 근거: [React Native Text](https://reactnative.dev/docs/text), [React Native WebView Reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md). iOS SVG·Video 판단은 현재 설치된 SDK 소스에서 확인했다.
