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

## 본 개발 0b단계: 체험판 기반 게임의 진행 저장 (2026-11-15)

본 개발 코드(`.omo/prototypes/steel-companion-full-art-remake/`)가 이 문서의 localStorage 진행 키 `sgg_game_save_v1`을 쓰기 시작했다. 범위는 localStorage 진행 저장과 불러올 때의 정규화까지다. IndexedDB 사본·진단 임시값·SGG1 백업·복원·초기화·설치·웹툰 키는 아직 쓰지 않는다(7단계 이후).

- 이전 게임 공개본(`kalamari0227.github.io/steel-grade-gacha-game/`)과 본 개발 체험판(`kalamari0227.github.io/steel-grade-gacha/`)은 같은 출처라 이 키와 IndexedDB `sgg_game`을 실제로 공유한다.
- 정상 JSON은 원본 `applySaved()`로 정규화한다(위 "시작·복구·실패"와 같다). 정규화 뒤에도 형식이 틀리면(음수·없는 ID·숫자가 아닌 자원·객체가 아닌 값) 덮어쓰지 않고 보류한다. 읽기 거부·잘못된 JSON·다른 탭 변경·쓰기 거부의 기존 보호를 유지한다.
- 원본에 없는 `results`·`featured`를 선택 항목으로 더 저장한다. 원본 코어는 불러올 때 이를 무시하고 다시 쓸 때 뺀다.
- 체험판 시절 키 `steel_companion_prototype_20261109_v1`은 읽지도 지우지도 않는다.
- IndexedDB를 읽지 않으므로 "빈 local의 유효한 게임 IDB 복구"는 아직 없다. localStorage만 비고 IDB 사본이 있는 사용자가 본 개발 화면에서 먼저 출하하면 원본 복구 조건이 사라진다. 7단계에서 다룬다. 자세한 내용은 체험판 `DESIGN.md`의 "0b 제품 전환" 절.

## 본 개발 1단계: 스크랩·교환·제작의 저장 (2026-11-15)

새 키는 없다. `sgg_game_save_v1`의 기존 항목이 바뀐다.

- `scrap`: 중복 스크랩 +1, 확정 교환 −5(LV3)·−10(LV4)로 바뀐다. 옛 저장본의 `pending`은 원본 `sweepPending()`처럼 교환 때 스크랩 1로 치고 비운다.
- `stock`·`owned`: 교환은 1장을 더하고 발견을 기록한다. 중복 스크랩은 `stock`만 1 줄이며 마지막 1장은 남긴다. 제작은 계획된 `stock`만 줄이고 도감 `owned`는 지우지 않는다. QP는 소모하지 않는다.
- `parts[key] = {at, use}`: 제작 완료 기록. `use`는 칸마다 쓴 소재(또는 QP)의 ID 목록이다.
- `results.exchange`: 확정 교환 결과에만 `3` 또는 `4`가 붙는다(`mode`는 `single`).
- 불러올 때 검사(`validState`): `parts`의 키는 부품 35개 중 하나여야 한다. 값은 양의 숫자(원본 `partAt()`이 받는 옛 형식)이거나 객체이며, 객체의 `at`이 있으면 0 이상 정수, `use`가 있으면 그 부품 칸의 후보 또는 QP ID 배열이어야 한다. 원본 `craft()`는 항상 `{at, use}`를 쓰지만 원본 읽기 코드는 숫자·`use` 없는 객체도 받으므로 그만큼은 보류하지 않는다. 그 밖(알 수 없는 키, 문자열·`null`, 음수 `at`, 후보 밖 `use`)은 다른 손상과 같이 덮어쓰지 않고 보류한다. `results.exchange`는 `mode:'single'`에서 3 또는 4만 허용한다.
- 세 명령 모두 한 번만 쓰고 결과를 반환한다. 다른 탭 변경·손상 저장·쓰기 실패에서 출하와 같은 보호가 동작한다.


## 본 개발 2단계: 차고의 저장 (2026-11-15)

새 키는 없다. `sgg_game_save_v1`의 `cars`와 `parts`가 바뀐다.

- `cars`: `[{k, at}]`. 차량 확정 때 한 대가 더해진다. `k`는 원본 차종 8개(t·h·n·m·s·z·b·d) 중 하나, `at`은 확정 시각이다.
- `parts`: 확정 때 `{}`로 초기화된다. `owned`·`stock`·`scrap`·`items`는 바뀌지 않는다.
- 불러올 때 검사: `cars`의 모르는 차종·중복·8개 초과·음수나 숫자가 아닌 `at`은 보류한다. 이전 게임의 단일 차 필드(`car`, `carAt`)는 원본 `applySaved()`가 `cars`로 바꾼다.
- 확정은 한 번만 쓰고 결과를 반환하며, 다른 탭 변경·손상 저장·쓰기 실패에서 출하와 같은 보호가 동작한다. 선택은 저장을 바꾸지 않는다.


## 본 개발 3단계: 고객 요구·보증 장비의 저장 (2026-11-15)

새 키는 없다. `sgg_game_save_v1`의 `items`·`orderDay`·`orderKey`·`orderDone`을 쓰기 시작한다. 원본 추출·불러오기 검사·회신·장착 명령까지의 계약이다.

- `items[key]`: `1`이면 획득했고 아직 장착하지 않음, 카드 ID이면 그 동료에 장착됨(원본 `itemsOf`·`available`의 뜻). 정답 회신이 `1`을 넣고 `orderDone`을 1 늘린다. 장착은 `1`을 카드 ID로 바꾸며 `stock`은 바꾸지 않는다. 해제·재배치는 없다(원본 그대로, 2026-11-15 사용자 확정).
- `orderDay`·`orderKey`·`orderDone`: 원본 `todaysOrder()`가 날짜가 바뀌면 고치는 기록. 원본은 요구를 여는 것만으로 이를 고쳐 저장하지만, 본 개발은 **열기만 해서는 쓰지 않는다**. 고친 값은 메모리에만 두고, 다음에 저장하는 명령(회신·장착·출하 등)이 함께 쓴다. 같은 날·같은 보유 상태에서는 원본 판정이 결정적이라(`dayHash`+`orderDone`) 다시 불러와도 같은 요구가 나온다. 보유 상태가 바뀌는 명령은 저장하므로 그때 그날의 요구도 함께 굳는다.
- 불러올 때 검사(`validOrders`): `items`의 키는 원본 `ITEMS` 14종 중 하나, 값은 `1`이거나 지금 `owned`인 동료 가운데 원본 `fitOwned(key)`가 돌려주는 카드 ID여야 한다. 그래서 장착 조합은 늘 승인 외형 안에 있다. 모르는 키·모르는 카드·비호환·미보유·`1`이 아닌 숫자는 보류한다. `orderKey`는 빈 값이거나 `ORDERS` 항목, `orderDone`은 0 이상 정수, `orderDay`는 문자열이어야 한다. 장착한 동료의 재고가 0이어도(발견 기록은 남음) 유효하다.
- 차량 확정(2단계)은 `items`와 주문 기록을 바꾸지 않는다.
- 회신 명령(`reply`): 원본 `judge()`를 그대로 쓴다. 정답이면 `items[key]=1`·`orderDone+1`을 한 번 쓰고, 오답·거절(날짜가 바뀜·요구가 바뀜·이미 얻음·오늘 몫을 다 씀·같은 답 두 번)은 아무것도 쓰지 않는다. 화면이 보여 준 요구와 날짜를 함께 넘기고, 그 사이 바뀌었으면 거절한다.
- 장착 명령(`equip`): 획득했고 아직 걸지 않은 보증을, 호환되는 보유 동료 한 명에게 건다(`items[key]=cardId`). `stock`·`owned`는 바뀌지 않는다. 이미 장착된 보증·미획득·비호환·미보유는 거절하며 해제·재배치 명령은 없다.
- 두 명령 모두 출하와 같은 보호를 거친다: 저장 잠금(`commandSafely`), 다른 탭 변경 검사, 손상 저장 보류, `commandBusy`, 저장을 먼저 시도한 뒤 결과 반환, 쓰기 실패 시 메모리 결과·경고·백업.
- 읽기 전용 조회(`order`, `warranties`, `cardItems`, `equippedKeys`)는 저장을 쓰지 않는다. 연구 탭을 열어도 새 프로필의 저장은 `null` 그대로다.
- 장착 외형: 화면은 늘 승인된 조합만 보여 준다. 동료 카드(검사증명서)는 장착한 보증을 기본으로 보이고, 획득했지만 걸지 않은 보증만 눌러 미리 본다(저장하지 않음). 로비 대표만 장착 외형(앞면)으로 서고, 도감 칸 썸네일과 출하 결과 카드는 기본 외형 그대로다.
