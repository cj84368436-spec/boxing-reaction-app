# P0 Playable Shell Design

## Goal

Apps in Toss SDK 2.x의 Granite React Native 런타임에서 세로 게임 화면을 열고, canonical Lead Jab 모션의 Ready pose를 정면 2.5D capsule boxer로 렌더링하며, 하단에 LEFT / RIGHT / BACK / GUARD 버튼을 표시한다.

## Boundaries

- 기준선은 `42378c4770223f363e9d040766604e6727e1a78e`와 annotated tag `p0-game-engine-baseline`이다.
- `src/game/**`, `tools/mocap/**`, 기존 테스트는 읽기 전용이다.
- 공격 재생, 판정, 세션, 점수, 사운드, 햅틱, 서버 기능은 구현하지 않는다.
- 앱 UI는 canonical 엔진을 import하지만 게임 상태를 실행하지 않는다.

## Platform

- `create-granite-app` 1.0.43 scaffold를 기준으로 한다.
- `@apps-in-toss/framework` 2.10.10, `@granite-js/react-native` 1.0.43, React 19.2.3, React Native 0.84.0을 사용한다.
- `ait build`로 Apps in Toss artifact를 만든다.
- 앱 타입은 game이며 권한은 요청하지 않는다.
- safe area는 공식 Granite `useSafeAreaInsets()` 훅으로 대응한다.

## Rendering decision

Granite가 생성한 micro-frontend shared registry에 `react-native-svg`가 포함되고 `@granite-js/native@1.0.43`도 15.15.3을 제공하므로 같은 버전을 직접 의존성으로 고정한다. 각 관절 구간은 회전된 SVG rounded rectangle capsule, 머리와 글러브는 원, 그림자는 타원으로 렌더링한다. 이 방식은 점/선 skeleton이 아니며 Skia/WebView/3D 엔진을 추가하지 않는다.

현재 공식 Windows 패키지는 생성 코드에 절대경로 백슬래시를 이스케이프하지 않는 결함이 있다. `postinstall`/`prebuild:app`에서 정확히 알려진 네 파일만 forward slash로 정규화하고, 패키지 코드가 달라지면 임의 적용하지 않고 즉시 실패한다.

## Data flow

1. `lead-jab.json`을 Metro JSON module로 직접 import한다.
2. `sampleReadyPose()`가 timeline의 0ms를 sample하여 finite 19-joint pose를 반환한다.
3. `projectFrontPose()`가 Ready pose에서 고정 camera basis를 계산하고 정면 2.5D 좌표를 만든다.
4. `fitProjectedPose()`가 300×430 rig viewport 안에 전신을 여백과 함께 맞춘다.
5. `buildBoxerRig()`가 torso/head/upper arm/forearm/glove/thigh/shin/foot capsule 명령을 생성한다.
6. `BoxerRig`가 명령을 `react-native-svg` capsule rig로 그린다.

## UI structure

- `P0GameScreen`: safe area, 최소 HUD, ring/gym 배경, boxer stage, 2×2 defense controls.
- `BoxerRig`: Ready pose의 capsule renderer.
- `DefenseControls`: 버튼별 순간 pressed 상태만 표시하며 engine에는 입력을 전달하지 않는다.

## Verification

- 기존 Node test 47개가 그대로 통과해야 한다.
- Jest app contract로 canonical module import, JSON load, finite 19 joints, finite/in-bounds projection, finite rig commands, 화면/버튼/pressed state를 검증한다.
- app typecheck와 `ait build`를 실행한다.
- Metro dev server가 기동되는지 확인한다.
- Sandbox 및 실제 기기 시각 품질은 실행 가능한 환경에서만 별도로 판정한다.
