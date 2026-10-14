# 광고 우회·본인 시점 가드 보완 (2026-10-14)

## 원인과 수정

- 목숨 소진 뒤 `난이도 선택`은 경기 상태를 초기화하면서 결과 화면에만 있던 광고 요구를 없앴다. 목숨 소진 플래그를 경기 초기화와 분리하고, 홈 시작·다른 난이도·해금된 다음 난이도·기록의 오늘의 코스가 같은 보상 관문을 거치도록 수정했다. 보상 없는 광고 닫기·광고 오류·중복 탭은 재도전을 허용하지 않는다. 실제 RewardedRetryAdController를 이용한 회귀 테스트로 확인했다.
- 홈의 `목숨은 다섯. 주먹을 읽고 끝까지 버텨보세요.`를 삭제하고 빈 관장 설명 영역도 생기지 않게 했다.
- 앞선 가드 그림은 본인 시점의 좌우 손을 잘못 그려 엄지가 가운데로 향했고, 손가락 패드가 낱개로 드러난 듯한 형태였다. 해당 후보를 제외했다. 새 PNG는 왼쪽 셀에 본인 왼손, 오른쪽 셀에 본인 오른손을 두고 엄지 윤곽을 바깥쪽으로 수정했다. 너클 뒷면 대신 닫힌 글러브의 안쪽 grip 면을 사용한다. 정상 가드에 대한 단정적인 이전 설명은 철회한다.
- 글러브·흰 손목·긴 팔을 한 장으로 같은 배율로 표시한다. 팔을 별도 잘라 늘리지 않는다. 양손 크기는 140 scene units, 위치 x=0/140, 가드 최상단 y>=110으로 두어 양손 영역이 겹치지 않고 ready 머리의 시야를 남긴다. 기존 128의 약 1.094배이며 1.5배 제한 안이다.
- 원본 `gloves.png`는 그대로 보존했다. 제외한 안쪽 엄지 후보는 `gloves-rejected-inward-thumbs-20261014.png`에 남겼다. 그 후보로 만든 deployment `01a135d0-b0b6-79d0-92d1-f6aa203e7678`은 업로드하지 않는다.

## 그림의 근거와 확인 범위

- 사용자 첨부 high-guard 자세와 [England Boxing 코칭 핸드북 p.67](https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf)의 정면·측면 사진을 참고했다. 공식 자료는 수직 전완·광대뼈 부근 손 위치의 근거이며, 생성 그림이 정확한 해부학을 충족한다는 자동 보증은 아니다.
- 생성 방식은 imagegen 편집이다. 정확한 프롬프트·참조·선택 파일은 `guard-generation-20261014.json`에 기록했다.
- 최종 선택: `src/app/assets/art/gloves-high-guard.png`, RGBA 1024×1536, SHA-256 `4cb13d14f9c92a6f49c28eec90d8a701e5e102170b420ec556c52e01723fe02c`. 모서리와 가운데 빈 영역 alpha=0. 셀 안의 글러브/커프 전체 윤곽과 metadata는 `guard-asset-20261014.json`에 기록했다.
- 실제 RN `BoxerRig`/`PlayerDefenseFeedback`를 SVG로 내보내 320×240, 390×420, 430×650의 대기·중간·가드 총 9장을 데스크톱에서 확인했다. 비교: `guard-reference-preview-20261014/comparison-corrected.png`. 원본 이미지를 새로 그린 모의 렌더러가 아니라 현재 컴포넌트의 그림 레이어를 사용하되, 실제 iPhone Yoga 레이아웃/토스 실행 검증은 아니다.

## 실행한 검증

- 광고 우회는 기존 코드에서 테스트 실패를 먼저 확인한 뒤 수정했다. 실제 보상 컨트롤러를 포함해 홈·기록·난이도 변경·두 번째 소진·보상 없는 닫기·광고 오류를 검사했다.
- 양손 겹침은 기존 코드에서 3개 실패를 재현했다(`guard-orientation-red-20261014.log`). 수정 후 크기·클리핑·균일 배율·양손 분리 관련 8개 테스트와 SVG 내보내기 1개 통과.
- 최종 `npm.cmd test`: 엔진 47 + 앱 213 = 260개 통과, 앱 33 suites.
- 최종 `npm.cmd run typecheck:app` 통과. `npm.cmd run build:app` Android/iOS × RN 0.84.0/0.72.6 네 종류 통과.
- `retry-guard-bundle.cjs`: 실제 AIT 네 번들에 PNG 7개·WAV 8개·라우팅·기록 컨테이너·광고 관문·홈 문구 삭제·이번 그림/배치가 포함됨을 확인했다. 보호 원본 40개 일치.
- 로그: `retry-guard-tests-20261014.log`, `retry-guard-types-20261014.log`, `retry-guard-build-20261014.log`, `retry-guard-bundle-20261014.json`.

## 전달 상태

- 최신 로컬 AIT deploymentId `01a135df-3b9e-7b7d-985d-f98ca0988f93`, 51,171,019바이트, SHA-256 `78589d39e12716a0669f0e85146b5433d4eb4e56438007c5d9bcdaa2aaf7a5ab`.
- 사용자 `업로드해` 요청으로 위 동일 SHA256의 수정본을 등록·업로드했다. 버전 `20261014-15`, PUT HTTP200, 업로드 완료 성공. 서버 CREATED·SDK2.10.10 확인, 본인 테스트 푸시 성공(`isTested=true`, `deployed=false`). 검수·출시는 진행하지 않았다. 실제 기기 테스트 성공을 뜻하지 않는다. 증거 `retry-guard-upload-20261014.json`.
- [버전15 테스트 QR](https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a135df-3b9e-7b7d-985d-f98ca0988f93&testVersionName=20261014-15), 본인 직접 실행 `intoss-private://boxing-talent-test?_deploymentId=01a135df-3b9e-7b7d-985d-f98ca0988f93`.
- 실제 iPhone에서 엄지/가드 각도·글러브 크기·전체 화면·광고 보상 이후 재도전 확인은 남아 있다. 자동 테스트와 데스크톱 그림을 제품 완료 또는 실기기 성공으로 취급하지 않는다.
