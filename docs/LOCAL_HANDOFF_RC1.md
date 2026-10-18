# 로컬 인계: 실기기 검증 후보 RC1

최신 소스는 GitHub `cloud/v1-device-rc1` 브랜치에 있다. `main`이나 예전 `v1-product-loop-baseline`만 받으면 이후 기능이 빠진다. 이 문서는 파일 전달용이며 제품 코드 변경·Toss 업로드·출시 승인을 의미하지 않는다.

## 로컬에서 바로 할 일

기존 로컬 변경을 보존하고 별도 worktree에서 받는다. 이미 같은 폴더가 있으면 다른 새 폴더 이름을 쓴다.

```sh
git fetch origin
git worktree add ../boxing-cloud-rc1 origin/cloud/v1-device-rc1
cd ../boxing-cloud-rc1
gh release download v1-device-rc1-20261018 --repo cj84368436-spec/boxing-reaction-app --pattern 'boxing-talent-test-v1-device-rc1.ait' --dir device-build
```

AIT는 GitHub **Draft Release** 첨부 파일이다. 해당 저장소의 draft release 접근 권한이 있는 계정으로 `gh` 인증이 필요하다. 소스는 브랜치에서 읽고, AIT는 release에서 받는다. release 이름의 draft는 정식 출시가 아니라 전달용 보관 상태다.

검증 대상:

- 파일: `boxing-talent-test-v1-device-rc1.ait`
- 크기: 51,298,578 bytes
- SHA-256: `32c6c34eb3b9f72b109a968a1540b6ffcb1e21fe2be2cd04d7990121770368b7`

Windows에서는 `Get-FileHash device-build/boxing-talent-test-v1-device-rc1.ait -Algorithm SHA256`, macOS/Linux에서는 `shasum -a 256 device-build/boxing-talent-test-v1-device-rc1.ait`로 확인한다. 이름만 같은 다른 파일을 사용하지 않는다. 이 파일을 받았다면 불필요하게 재빌드하지 않는다.

## 포함된 구현과 검증

2 KO rewarded / 첫 KO 무료 / clear 무료 retry / 다음 단계 interstitial / 기록 banner, 행동형 튜토리얼, 첫 기록·최고 기록 구분, 실패 복기·가까운 목표, recent 비교, 재방문 목표, 실제 결과 공유·바이럴 화면, Apps eventLog adapter, /shared 유입 계측이 포함된다. 최근 출시 감사의 광고 사전 고지·방어 접근성 경로·재도전 대비·미지원 광고 문구도 수정했다.

동일 제품 소스에서 엔진 47·앱 459(55 suites)·preview 13, 타입·빌드 및 320/375/390 browser QA가 통과했다. 후보 archive의 소스 362개와 빌드 전후 파일 해시를 확인했다. 이 브랜치의 추가 인계 문서는 빌드 동작을 변경하지 않는다. 반복 검증을 위해 엔진이나 광고 정책을 수정하지 않는다.

상세 기록:

- `AI_HANDOFF.md`
- `docs/PRODUCT_DECISIONS.md`
- `docs/audits/RELEASE_READINESS_AUDIT_2026-10-18.md`
- `docs/audits/RELEASE_FIXES_2026-10-18.md`
- `docs/DEVICE_VALIDATION_V1.md`

## 남은 게이트

정식 출시 불가 상태를 유지한다. 실제 Toss iOS/Android에서 C1 focus/AppState, C2 reward 이후 dismissed 누락, VoiceOver/TalkBack 방어, 공유창 및 HTTPS 링크 진입을 확인해야 한다. Live Analytics, 게임 등급·썸네일·최종 설명·콘솔 등록 상태도 미확인이다.

로컬에 별도로 주어진 사용자 승인에 따라 **실기기 테스트용 업로드**만 진행한다. 공식 설치 CLI/API를 확인하고 이 AIT 해시를 업로드 결과와 연결한다. production 공개·심사 제출·광고 설정 변경·새 기능 개발은 하지 않는다. API 키를 채팅이나 Git에 노출하지 않는다.
