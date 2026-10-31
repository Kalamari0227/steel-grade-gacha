# 게임판 저장·설치 식별자

작업 5 구현 범위. `src/game/edition.js`는 코어 스크립트 이전에 빌드가 주입하는 불변 namespace 정의다. 상태 `S`를 읽거나 경제 규칙을 복제하지 않는다. 코어는 기존 기본값·정규화·저장·복구·초기화 구현을 사용한다. 교육판 키를 읽거나 자동 가져오는 코드가 없다.

## 영구 쓰기 전체 목록

`src/app_tpl.html`, `src/pwa_body.txt`, `src/pwa_head.txt`, `manifest.webmanifest`, `sw.js`의 쓰기 지점을 조사했다. 코어에 sessionStorage, cookie, Cache API 쓰기는 없다.

| 저장소 | 교육판 식별자 | 게임판 식별자·작성자 | 내용/수명 |
| --- | --- | --- | --- |
| localStorage 진행 | `steelgrade_gacha_v1` | `sgg_game_save_v1`; `save()` | `S` JSON. 출하/퀴즈/제작/보상/장착/설정/복원/초기화/시간 갱신 모두 기존 `save()` 공유 |
| IndexedDB 진행 | DB `steelgrade_gacha`, store `save`, key `steelgrade_gacha_v1` | DB `sgg_game`, version 1, store `save`, key `sgg_game_save_v1`; `mirrorPut()` | save 및 시작 후 사본 저장. `idbOpen()`이 새 DB에 save store 생성 |
| localStorage 진단 임시값 | `steelgrade_gacha_v1_probe` | `sgg_game_save_v1_probe`; `storeDiag()` | 백업 화면 timestamp 쓰기→되읽기→removeItem. 실패 중단 시 임시값이 남을 수 있음 |
| IndexedDB 진단 임시값 | 교육 DB/store의 `steelgrade_gacha_v1_probe` | 게임 DB/store의 `sgg_game_save_v1_probe`; `idbProbe()` | timestamp put→get→delete. 실패 결과를 표시하며 삭제 실패 시 임시값이 남을 수 있음 |
| localStorage 웹툰 읽음 | `sgg_toon_seen` | `sgg_game_toon_seen`; `openToonView()` | 마지막 연 에피소드 ID. 진행 초기화·백업과 분리 |
| localStorage 설치 배너 닫음 | `sgg_install_dismissed` | `sgg_game_install_dismissed`; 설치 닫기 이벤트의 `mark()` | 문자열 `1`. 교육 설치 여부를 읽지 않음 |
| localStorage 설치 완료 | `sgg_installed` | `sgg_game_installed`; `appinstalled`의 `mark()` | 문자열 `1`. 게임 설치 버튼 숨김 |
| localStorage 표현/음향 설정 예약 | 없음 | `sgg_game_preferences_v1`; `GAME_EDITION.preferences` | namespace만 제공. 작업 5에는 읽기/쓰기·새 제어 UI 없음. 작업 11/38이 실제 설정 어댑터 담당. 초기화는 기존 값 보존 |
| 브라우저 storage 지속성 | origin 단위 | `askPersist()`의 `navigator.storage.persist()` | 기존 브라우저 정책 요청. 판별 key 없음. origin 분리 검증은 작업 8 |
| Service Worker 등록 | 상대 `sw.js` | `pwa_body.txt`의 load 이벤트 | 기존 등록 유지. manifest ID가 SW scope·캐시를 분리하지 않음 |
| CacheStorage | `steel-grade-gacha-redesign-t23-v4`, prefix `steel-grade-gacha-` | **작업 8에서 분리 예정; 작업 5 변경 없음** | `sw.js` install addAll, activate 웹툰 target.put 및 이전 prefix cache 삭제, navigation index.html put, fetch resource put |

알림 bell/belledAt, 백업 backupAt, 공지·프로모션·QP 확인 상태도 새 키가 아니라 진행 JSON에 있다. 같은 origin의 교육·게임 SW/캐시 동시 운용이 안전하다는 주장은 하지 않는다. 캐시 분리 전 해당 동시 운용을 출시하면 안 된다.

## 시작·복구·실패

- 정상 local JSON을 기존 `applySaved()`로 정규화한다. 발견/스크랩/아이템 진행이 없을 때만 게임 IDB를 확인하며, 확인 중 `saveHold`가 빈 값 덮어쓰기를 막는다.
- local 읽기 거부나 잘못된 JSON이면 `loadFailed`로 자동 쓰기를 멈춘다. 유효한 IDB가 있어도 기존 우선순위대로 손상 local을 자동 덮어쓰지 않는다.
- 빈 local의 유효한 게임 IDB는 복구하고 local 저장을 되읽는다. 쓰기 거부 때 메모리 복구 경고와 백업 접근을 유지한다. 손상 IDB는 무시한다.
- IDB가 응답하지 않으면 기존 2500ms 제한 뒤 UI를 사용할 수 있다. 제한 이후 복구 callback은 `settled` 검사로 무시한다. 실제 출하 후 늦은 과거 사본이 상태를 덮어쓰던 결함을 양 브라우저에서 재현한 뒤 수정했다.
- 저장 실패 경고는 기존 백업 대화상자로 연결된다. 이 단계의 백업 형식은 기존 `SGG1.`이며 게임 envelope/명시적 교육 가져오기는 작업 6이다.
- 초기화 두 번 클릭과 5초 만료를 유지한다. canonical empty state만 게임 LS/IDB에 저장하며 교육·웹툰·표현/음향 설정·설치 플래그는 지우지 않는다.

## 설치와 빌드 경계

manifest 이름은 `스틸 그레이드 가챠 · 게임`, 짧은 이름과 Apple 설치 이름은 `스틸가챠 게임`, ID는 `./?edition=game`이다. scope/start_url은 `./`, 배경은 `#161B20`, 테마는 `#78486E`다. 아이콘과 SW 수명주기는 작업 8/23의 범위다.

`bash src/build.sh`는 edition 정의를 코어 이전에 주입하여 index.html을 생성한다. 직접 index 편집은 금지한다. 전체 게임 패키징·외부 자산 연결은 작업 7에서 교체한다.

## 검증

```sh
SGG_EDITION=game node tools/game-qa.mjs --case edition-storage --engines chromium,webkit --evidence "$E/task-5"
SGG_EDITION=game node tools/game-qa.mjs --case baseline-contracts --engines chromium,webkit --evidence "$E/task-5/baseline"
```

전용 context의 교육 LS 4키와 실제 교육 IDB에 sentinel을 넣고 새 게임/local/복구/출하/reload/초기화/취소/설치/웹툰/오류를 수행한다. 모든 시나리오에서 교육 raw 값과 IDB entry를 비교하고 앱의 교육 read/write/open 시도가 0인지 기록한다. 읽기/쓰기 거부, 손상 JSON, 응답 없는 IDB, 늦은 native IDB 응답, 잘못된 edition fixture가 포함된다. JSON·스크린샷·trace·입력 SHA·HTTP SHA·nonzero 결과 수를 남긴다. 서비스 워커는 저장 경계 검사에서 차단한다.

기존 storage.spec.mjs의 denied-local 2개 하드코딩은 fixture edition으로 이관했다. 원본 URL은 교육 키, 게임 URL은 게임 키를 검사하며 기존 상태·경고·백업 동등성 주장을 유지한다.
