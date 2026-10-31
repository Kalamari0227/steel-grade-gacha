# 게임판 산출물과 검증 범위

Task39 문서와 Task40 검증 도구를 통합한 상태입니다. Task37은 별도 개별 검증을 통과했으며, 최종40/41/42의 경로·수량·해시는 실제 외부 receipt가 완성된 뒤 확인합니다. 아래 역사 수치를 최종 수치로 승격하지 않습니다.

<a id="status"></a>
## 현재 전달 상태

이 문서는 검토 대기 상태의 게임용 안내입니다. 현재 생성된 중간 release를 최종본으로 지정하지 않습니다. 최종 전체 검사의 실제 expected/unexpected/skipped/flaky와 Node 결과, Fsource·Fpackage 식별값은 해당 실행의 외부 receipt를 직접 읽어 확인합니다. 미래 최종 manifest·archive·preview가 이미 존재한다고 간주하지 않습니다.

원계획42개와 후속43–47, F1–F4를 합친51개 전체는 독립 검토와 사용자의 명시적 최종 인수가 필요합니다. 역사적 부분 검토 E/final은 유지하며 새 전체 검토는 E/final-full을 사용합니다. 이 문서만으로 전체 완료를 선언하지 않습니다.

<a id="history"></a>
## 역사 보관본과 보존 출처

이 절의 교육용 문서·E receipt 링크는 전체 checkout에서 읽는 역사 참조이며 portable archive 내부 실행 의존성이 아닙니다.

Task1의 [worktree 기록](../../../.omo/evidence/game-edition/game-20261025-01a16bac/task-1/worktree.json)은 별도 game-edition과 branch `게임용`, 당시 base/HEAD `d3f52b6f3c79d6ccb579d362953242631b832a74`를 기록합니다. 현재 Git metadata는 추후 전달 작업에서 다시 읽습니다. [baseline 기록](../../../.omo/evidence/game-edition/game-20261025-01a16bac/task-1/baselines.json)의 원본 규칙 commit `6784048524c722b7d1057cb28e372b6cce5dc6cf`와 교육용 timing/reference 보관본은 역할이 다릅니다. [교육용 보존 기록](education-v1.md)을 게임판 회귀 결과로 사용하지 않습니다.

Task32 [archive receipt](../../../.omo/evidence/game-edition/game-20261025-01a16bac/task-32/game-sources.receipt.json)·[독립 확인](../../../.omo/evidence/game-edition/game-20261025-01a16bac/task-32/independent-verification.json)은 당시 portable production 보관본에 한정됩니다. archive SHA `cf433ed0d72009e1bf1e281e98badae1f03c5d81fbc4000ce22d1394bc108878`, source-manifest SHA `e71220b1db916739aeab0f5983b0ea5bed1771cfc7a217f0dd63552e5fe8979a`, 당시 strict release `7983de6df4c36af9a8d4adbc27d439e40637e8245cdffef0c6dadee72e2fdb1b`입니다. 이는 최종 F 식별값이 아닙니다. 독립 확인의21 Node tests,1,847 payload/1,848 regular tar members,1,568 mappings,28 fresh WAV와246 strict output SHA 대조도 이 역사 snapshot 범위입니다.

현재 archive collector의 명시적 수집 목록에는 docs/design의 제작 가이드와 README.md·docs/game-maintenance.md·docs/releases/game-edition.md가 포함됩니다. 실제 보관본의 포함 파일과 SHA는 해당 source-manifest 및 archive receipt로 확인합니다. 전체 GUI QA checkout·Playwright 브라우저·교육용 baseline을 archive 안에 묶어 제공하는 계약도 아닙니다. [안전한 복원과 제작 가이드](../design/game-production.md)의 실행 도구와 provenance-map 계약을 사용하세요.

<a id="evidence"></a>
## 최종 근거를 연결하는 방법

SGG_DOCUMENTATION_INPUTS는 [문서 계약 입력](../game-maintenance.md#qa)의 실제 사용자 공급·실행 receipt 경로입니다. Task39는 고정 소스로 새 archive를 만들고 같은 validator로 추출·원본 접근 차단·28 WAV 재현·strict build/package를 실행합니다. Task41까지 그 입력과 release가 같으면 이 실제 근거를 유지하고 최종 package 위치에 결속합니다. 역사32 archive를 사용한 별도 복원 근거는 역사 범위를 명시합니다. 외부 receipt가 archive와 내부 manifest SHA를 연결하고 자기 자신을 해시하는 문서 의존성을 만들지 않습니다.

Task40은 동일한 Fsource/Fpackage의 전체 Chromium/WebKit·경제 계약과 필수 Node 검사 결과를 기록합니다. Task41은 portable package·최종 source archive, Task42는 실제 소유 서버 주소·HTTP index SHA·원화/장착 sheet·AV/청취 페이지·source/package 링크를 제공합니다. 최종41/42의 receipt는 검사 실행에 실제 파일로 전달해야 하며 빠졌거나 release가 다르면 통과할 수 없습니다. source/test/doc generator는40 이전에 준비하고 그 뒤 변경되면40·41을 다시 결속합니다.

| 확인 대상 | 증거의 범위 |
| --- | --- |
| 이미지 | BASE125,47faces,103pairs/107placements,175required+10optional export와 같은 SHA의 생성·master·검수·실제 합성 |
| 오디오 | BGM4+SFX24,28WAV/32runtime variants의 source SHA·실제 decode·loop·native clock·전체 preview |
| 저장/설정 | game namespace, 명시적인 교육 백업 preview/cancel/confirm, 저장 거부 경고·내보내기, 페이지 메모리 복구 코드 |
| 패키지 | syntheticFixture=false, 소스 입력과 releaseId, HTML/SW/manifest/모든 runtime SHA 및 실제 HTTP |
| 보존 | 교육 파일·키·cache와 별도 origin 또는 실제 disjoint path/scope 증거 |

<a id="limits"></a>
## 확인하지 않은 범위

주관적 음악 청취·physical iOS/헤드폰·실제 OS 설치·실제 OS200% 확대·native select의 물리 키보드 option 선택·배포 CWV는 해당 실제 증거가 없으면 미확인입니다. native audio clock과 파형·decode는 청취 증명이 아닙니다. partial offline은 critical과 이미 캐시된 optional 파일만 포함하며, 새 음원이 없으면 무음으로 이어집니다. 전체 파일 offline을 보장하지 않습니다. root 교육 SW와 game scope가 겹치는 같은 origin 배치는 지원하지 않습니다. 교육용 문서의 T22/T23나 다른 release의 결과로 이 한계를 지우지 않습니다.

[게임 실행·유지보수](../game-maintenance.md) · [게임 시작 안내](../../README.md)

<!-- sgg-release-contract:v1 -->
```json
{
  "schemaVersion": 1,
  "edition": "game",
  "status": "review-pending",
  "finalComplete": false,
  "archiveBinding": "external-receipt",
  "preview": null,
  "historical": {
    "task": 32,
    "archiveSHA": "cf433ed0d72009e1bf1e281e98badae1f03c5d81fbc4000ce22d1394bc108878",
    "sourceManifestSHA": "e71220b1db916739aeab0f5983b0ea5bed1771cfc7a217f0dd63552e5fe8979a",
    "releaseId": "7983de6df4c36af9a8d4adbc27d439e40637e8245cdffef0c6dadee72e2fdb1b",
    "scope": "portable-production-only"
  },
  "pending": [
    "task37-independent",
    "task38-independent",
    "task39-runtime",
    "task40-frozen-suite",
    "task41-final-archive-package",
    "task42-live-preview",
    "F1",
    "F2",
    "F3",
    "F4",
    "user-final-acceptance"
  ]
}
```
