# 사운드 컨테이너·글러브 비율 보완 (2026-10-13)

## 원인과 변경

- 버전 13의 WebView는 안쪽만 1픽셀로 숨겼다. 설치된 iOS SDK의 실제 바깥 View에는 flex:1이 남아 경기장과 높이를 나눠 쓰고 있었다. TemporarySfxPlayer에 containerStyle을 추가하여 바깥 컨테이너까지 absolute 1×1, flex:0으로 분리했다. WAV·재생·광고 중 중단 방식은 유지했다.
- 상대의 slice와 내 글러브의 meet가 서로 다른 배율을 만들었다. BoxerRig가 실제 영역의 onLayout을 받아 가로 280 좌표에 맞는 높이를 계산하고, 두 SVG 모두 같은 viewBox와 xMidYMin meet를 사용한다. 원래 공격·카메라 수식 및 상대 스프라이트 좌표는 유지했다.
- 내 글러브는 128×195 → 160×240(가로 1.25배)로 보완했다. 대기는 화면 아래에서 170 좌표를 기준으로 놓고 팔 끝만 아래로 나가도록 했다. 가드 때 이동을 양쪽 12로 줄여 큰 주먹이 거의 하나처럼 겹치는 현상을 완화했다.
- 사용법 스크롤의 flex-end를 flex-start로 바꿔 내용이 길어도 첫 줄부터 볼 수 있도록 했다. 기존 간결한 문구와 단어 줄바꿈 설정은 유지했다.

## 검증

- 수정 전 실제 iOS WebView 래퍼의 flex 공간 점유 1건과 서로 다른 경기장 좌표 3건 실패 재현. 안내 정렬 1건, 이미지 비교에서 발견한 대기 얼굴 가림·가드 겹침 3건도 각각 수정 전 실패 확인.
- 최종 npm.cmd test: 엔진 47 + 앱 202 = 249개 통과, Jest 33개 모음 통과. 타입 검사 통과. iOS/Android × RN 0.84.0/0.72.6 네 종류 빌드 통과.
- 실제 WebView JS 래퍼를 유지하는 sfxContainerLayout.test.tsx를 기본 검사에 추가했다. 기존처럼 WebView 전체를 단순 View로 바꿔서 바깥 컨테이너를 놓치지 않도록 했다.
- 현재 BoxerRig·SpriteImage의 실제 SVG 속성을 추출해 320×240, 390×420, 430×650 경기장 각각 대기·가드 장면을 렌더링했다. 결과는 layout-ratio-preview-20261013/comparison.png에 있다. 정상 세로 두 영역에서 대기 얼굴과 주먹 표시를 눈으로 확인했다.
- 매우 낮은 320×240 영역은 대기 주먹과 얼굴 일부가 겹친다. 가드 중에는 손이 올라가 얼굴을 가린다. 원본 그림의 팔 끝은 가드 중 경계가 드러난다. 이 자료는 브라우저 SVG 렌더링이며 실제 토스 화면·레이아웃·소리의 성공 증거가 아니다.
- AIT 네 개의 실제 번들에서 바깥 사운드 컨테이너·동일 viewBox·글러브 크기·아래 배치·안내 정렬 확인. 원본 PNG 7개/WAV 8개 바이트 확인. Canonical 및 원본 PNG 40개 파일이 진단 C 기준과 일치했다. 기존 index/_404, 기록 IOScrollView, named SVG 연결을 보존했다.

## 산출물과 전달 상태

- AIT: boxing-talent-test.ait, 48,749,761바이트.
- deploymentId: 01a13568-607c-7f03-aedd-c3df04c42d92
- SHA-256: 4092ccd99ad4145dfc16a8b03ffda5f1f3be09bffb818da510a739e6bb2cbf67
- 이전 업로드 버전 13 백업: release-backup/boxing-talent-test-20261013-before-layout-ratio-fix.ait
- 로그: layout-ratio-tests-20261013.log, layout-ratio-types-20261013.log, layout-ratio-build-20261013.log.
- 최종 번들 검사: layout-ratio-bundle-audit.cjs 및 layout-ratio-bundle-audit-20261013.json.
- 새 AIT 업로드·본인 테스트 링크는 아직 수행하지 않았다. 늦게 다시 받은 승인 메시지는 이미 업로드한 버전 13(01a13548-5d03-75a0-acdf-e780644c222e)을 명시한다. 이번 번들의 외부 업로드 승인으로 대신 적용하지 않는다.
- 검수·출시 미수행. 실제 iPhone 전체 배치·주먹/상대 비율·기록·사운드 확인은 새 수정본 테스트에서 필요하다.
