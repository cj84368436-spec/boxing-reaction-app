# 앱 진입 404 오류 수정 검증 (2026-10-13)

## 원인과 수정

담당자 로그의 `404 page not found. Please create a ...` 예외는 Granite `getScreenPathMapConfig`가 필수 `/_404` 화면을 찾지 못할 때 발생한다. 기존 Android/iOS 번들 4개에는 `./index.tsx`만 등록되어 있었고, 첫 화면 코드 자체는 포함되어 있었다.

`pages/_404.tsx`를 기본 export 화면으로 추가했다. Granite의 `getRouteScreens`가 이를 발견해 `/_404` 화면과 알 수 없는 경로용 `*` 매핑을 정상 구성한다. 이 페이지는 게임 재실행 안내만 표시하며 게임 로직은 변경하지 않는다.

## 이번 실행의 검증

- 회귀 테스트: 실제 페이지 목록과 모듈을 실제 SDK `getRouteScreens`/`getScreenPathMapConfig`에 전달한다. 수정 전 담당자 로그와 동일한 예외로 실패했고 수정 후 통과했다.
- `npm.cmd test`: 엔진 47개, 앱 175개, 합계 222개 통과. Jest 28개 테스트 파일 통과.
- `npm.cmd run typecheck:app`: 종료 코드 0.
- `npm.cmd run build:app`: 종료 코드 0. RN 0.84.0 및 RN 0.72.6, Android/iOS 빌드 완료.
- 생성된 소스맵 4개 모두 실제 `require-context:./pages`에 `./index.tsx`와 `./_404.tsx` 포함 확인.
- 보호 영역 `src/game/`, `tests/`, `tools/mocap/` 32개 파일의 변경 전후 합산 SHA-256 동일: `d9e23fc833aabbd5289e4de7e85a08f92ea208edd4995b640b86939fd0fd13e2`.

샌드박스에서는 Jest의 임시 경로에 `realpath EPERM`이 발생해 테스트가 시작되지 않았다. 이후 승인된 일반 권한 실행으로 실제 테스트와 빌드 결과를 확인했다. 초기 테스트에 노출된 SDK 내부 함수의 타입 선언 문제도 정리한 최종 상태에서 전체 테스트와 타입 검사를 다시 통과했다.

## 산출물과 배포 상태

- 수정본: `boxing-talent-test.ait`, 6,908,328바이트, SHA-256 `8383c89376d329baafd85307fe7116a98e2726e8876dcca109dbb6a3ad073be1`.
- 이전 번들 백업: `release-backup/boxing-talent-test-20261013-before-router-fix.ait`, 6,904,519바이트, SHA-256 `0d9f0b84223ba382e049d552f1df35672a052e592da61d55cefd419734f8bd63`.
- 새 번들의 업로드, 검수 요청, 출시 및 문의 답변 전송은 수행하지 않았다.
- 실제 기기 진입 성공은 미확인이다. 수정본을 업로드한 뒤 휴대폰에서 첫 화면 진입과 게임 진행을 확인해야 한다.
