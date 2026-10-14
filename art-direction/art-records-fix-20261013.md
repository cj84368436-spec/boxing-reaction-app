# 이미지 누락·기록 화면 오류 보완 (2026-10-13)

## 확인된 사실

- 사용자의 iPhone 사진에서 버전 20261013-11은 앱·게임 진행·경기 결과까지 실행된다. 복서·관장·글러브·체육관이 비어 있고, 기록 버튼에서는 일반 오류가 반복된다고 보고했다.
- 광고 영상 표시를 사진으로 확인했다. 광고 종료 후 `userEarnedReward` 수신 및 재도전은 확인되지 않았다. Android 재현은 확인되지 않았다.
- 기존 AIT의 네이티브 JS에서 PNG require 모듈이 모두 빈 함수였다. 설치된 Granite mpack Bundler의 PNG `empty` loader와 일치하며 이미지 원본 데이터가 번들에서 빠져 있었다.
- 기록 화면은 일반 ScrollView 아래 InlineAd를 놓았다. SDK InlineAd가 광고를 받은 뒤 사용하는 실제 ImpressionArea로 현재 화면의 기록 버튼을 테스트하면 `IOProviderMissingError`가 발생한다. 원본 iPhone 스택은 없으므로 기기에서 발생한 예외와의 직접 일치는 아직 미확인이다.

## 수정

- 원본 PNG 7개를 변환 없이 `data:image/png;base64` URI source로 생성한다. 원본 PNG의 폭·높이·바이트를 유지하며 복서·관장·글러브·배경이 이 source를 사용한다.
- 외부 이미지 서버 없이 번들 자체에 데이터를 넣는다. 재생성 스크립트는 앱 빌드·개발·앱 테스트 전 실행된다.
- 기록 스크롤을 실제 Granite IOScrollView로 바꿔 배너 노출 감지 컨텍스트를 제공한다. 광고 지면 ID와 보상 지급 규칙은 유지한다.
- 소스맵의 위치 매핑을 유지하고 sourcesContent의 원본 중복만 제외한다. 이미지 포함 최초 빌드 96,555,738바이트에서 최종 48,737,996바이트로 감소했다. 기존 6,918,593바이트보다 크므로 실제 기기의 진입 시간·메모리·이미지 표시 확인은 필요하다.

## 검증

- 수정 전: 이미지 source 테스트 및 실제 SDK 노출 감지 모듈을 사용하는 기록 테스트 실패. 이후 관련 19개 통과.
- 최종 `npm.cmd test`: 엔진 47 + 앱 190 = **237개**, 앱 30개 suite 통과.
- `npm.cmd run typecheck:app` 통과. `npm.cmd run build:app`: RN 0.84.0/0.72.6, iOS/Android 통과.
- AIT 네 개 JS를 직접 읽어 image source 표현식을 실행하고 PNG 7개의 원본 바이트·크기를 대조했다. 모든 번들에서 실제 IOScrollView, index/_404, 소스맵 매핑 유지·중복 제외를 확인했다.
- `src/game/`, `tests/`, `tools/mocap/` 32개와 원본 PNG 8개, 총 40개 파일이 진단 C 기준본과 바이트 일치한다.
- 배너 SDK의 노출 감지 모듈과 스크롤 컨테이너는 테스트에서 실제 코드를 사용했다. 광고 요청·토스 네이티브 호스트·PNG 실제 디코딩은 로컬 테스트에 포함하지 않았다.

## 산출물·승인 경계

- `boxing-talent-test.ait`: deploymentId `01a13531-b323-79fe-8f99-eca65ddf14cc`, 48,737,996바이트.
- SHA-256: `45ffbc8d1e4ede5afc56e0b39aabe5e52a88168c8f18e8e7cff0c87f2329e865`.
- 이전 업로드 20261013-11의 파일은 `release-backup/boxing-talent-test-20261013-before-art-records-fix.ait`에 보존했다.
- 사용자 새 이미지·기록 수정본 업로드 및 본인 테스트 링크 발급 승인 후 업로드 완료. PUT HTTP 200, 서버 빌드 CREATED, SDK 2.10.10. 버전 **20261013-12**, 본인 테스트 푸시 성공(isTested=true, deployed=false). 검수·출시 미수행. 기기 QA는 별도 대기한다.
- 테스트 전용 링크: `intoss-private://boxing-talent-test?_deploymentId=01a13531-b323-79fe-8f99-eca65ddf14cc`.
- [버전 20261013-12 테스트 QR](https://apps-in-toss.toss.im/workspace/36427/mini-app/78237/app-build?testDeploymentId=01a13531-b323-79fe-8f99-eca65ddf14cc&testVersionName=20261013-12).
- 기기 확인 항목: 복서/관장/배경/글러브, 기록 열기·닫기 및 배너, 광고 종료 후 재도전, 초기 진입 시간.

## 근거

- 로컬: `node_modules/@granite-js/mpack/dist/bundler/Bundler.js`의 asset empty loader, `@granite-js/react-native/src/impression-area/ImpressionArea.tsx`의 provider 검사, `@apps-in-toss/framework/dist/index.js`의 InlineAd 렌더.
- [React Native URI Data Images](https://reactnative.dev/docs/images#uri-data-images): URI source 지원. 공식 문서는 큰 이미지의 data URI를 권장하지 않으므로 이 수정본은 실제 기기 속도를 확인한 후 출시 판단한다.
- 상세 산출물 검사: `art-records-bundle-audit-20261013.json`. 실행: `node art-direction/art-records-bundle-audit.cjs`.
- 로그: `art-records-tests-20261013.log`, `art-records-build-20261013.log`.
