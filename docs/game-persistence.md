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

본 개발 코드(`game/`, 2026-11-21 이전 경로 `.omo/prototypes/steel-companion-full-art-remake/`)가 이 문서의 localStorage 진행 키 `sgg_game_save_v1`을 쓰기 시작했다. 범위는 localStorage 진행 저장과 불러올 때의 정규화까지다. IndexedDB 사본·진단 임시값·SGG1 백업·복원·초기화·설치·웹툰 키는 아직 쓰지 않는다(7단계 이후). *(2026-11-20 주: 웹툰 키는 6단계, 사본·진단·백업·복원·초기화는 7단계에서 쓰기 시작했다. 아래 7단계 절.)*

- 이전 게임 공개본(`kalamari0227.github.io/steel-grade-gacha-game/`)과 본 개발 체험판(`kalamari0227.github.io/steel-grade-gacha/`)은 같은 출처라 이 키와 IndexedDB `sgg_game`을 실제로 공유한다.
- 정상 JSON은 원본 `applySaved()`로 정규화한다(위 "시작·복구·실패"와 같다). 정규화 뒤에도 형식이 틀리면(음수·없는 ID·숫자가 아닌 자원·객체가 아닌 값) 덮어쓰지 않고 보류한다. 읽기 거부·잘못된 JSON·다른 탭 변경·쓰기 거부의 기존 보호를 유지한다.
- 원본에 없는 `results`·`featured`를 선택 항목으로 더 저장한다. 원본 코어는 불러올 때 이를 무시하고 다시 쓸 때 뺀다.
- 체험판 시절 키 `steel_companion_prototype_20261109_v1`은 읽지도 지우지도 않는다.
- IndexedDB를 읽지 않으므로 "빈 local의 유효한 게임 IDB 복구"는 아직 없다. localStorage만 비고 IDB 사본이 있는 사용자가 본 개발 화면에서 먼저 출하하면 원본 복구 조건이 사라진다. 7단계에서 다룬다(2026-11-20 구현: 아래 7단계 절의 "빈 local의 복구"). 자세한 내용은 체험판 `DESIGN.md`의 "0b 제품 전환" 절.

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
- `orderDay`·`orderKey`·`orderDone`: 원본 `todaysOrder()`가 날짜가 바뀌면 고치는 기록. 조회(`order`)는 쓰지 않지만, 연구 탭이 요구를 보여 줄 때 `pinOrder` 명령이 그 요구를 **한 번 저장해 굳힌다**(원본이 요구를 본 순간 저장하는 것과 같다). 그래서 같은 날 보유가 바뀌어도 본 요구가 그대로 남는다. 들어온 요구가 없으면(새 프로필 등) 쓰지 않고, 저장된 기록과 같으면 다시 쓰지 않는다. 다른 명령과 같은 보호(저장 잠금·다른 탭·손상 저장)를 거친다. 처음에는 "열기만 해서는 쓰지 않는다"로 정했으나, 통합 검토에서 굳히지 않으면 같은 날 요구가 바뀔 수 있음이 확인돼 2026-11-15에 사용자 확정으로 바꿨다.
- 불러올 때 검사(`validOrders`): `items`의 키는 원본 `ITEMS` 14종 중 하나, 값은 `1`이거나 지금 `owned`인 동료 가운데 원본 `fitOwned(key)`가 돌려주는 카드 ID여야 한다. 그래서 장착 조합은 늘 승인 외형 안에 있다. 모르는 키·모르는 카드·비호환·미보유·`1`이 아닌 숫자는 보류한다. `orderKey`는 빈 값이거나 `ORDERS` 항목, `orderDone`은 0 이상 정수, `orderDay`는 문자열이어야 한다. 장착한 동료의 재고가 0이어도(발견 기록은 남음) 유효하다.
- 차량 확정(2단계)은 `items`와 주문 기록을 바꾸지 않는다.
- 회신 명령(`reply`): 원본 `judge()`를 그대로 쓴다. 정답이면 `items[key]=1`·`orderDone+1`을 한 번 쓰고, 오답·거절(날짜가 바뀜·요구가 바뀜·이미 얻음·오늘 몫을 다 씀·같은 답 두 번)은 아무것도 쓰지 않는다. 화면이 보여 준 요구와 날짜를 함께 넘기고, 그 사이 바뀌었으면 거절한다.
- 장착 명령(`equip`): 획득했고 아직 걸지 않은 보증을, 호환되는 보유 동료 한 명에게 건다(`items[key]=cardId`). `stock`·`owned`는 바뀌지 않는다. 이미 장착된 보증·미획득·비호환·미보유는 거절하며 해제·재배치 명령은 없다.
- 두 명령 모두 출하와 같은 보호를 거친다: 저장 잠금(`commandSafely`), 다른 탭 변경 검사, 손상 저장 보류, `commandBusy`, 저장을 먼저 시도한 뒤 결과 반환, 쓰기 실패 시 메모리 결과·경고·백업.
- 읽기 전용 조회(`order`, `warranties`, `cardItems`, `equippedKeys`)는 저장을 쓰지 않는다. 연구 탭을 열어도 요구가 없는 새 프로필의 저장은 `null` 그대로다.
- 장착 외형: 화면은 늘 승인된 조합만 보여 준다. 동료 카드(검사증명서)는 장착한 보증을 기본으로 보이고, 획득했지만 걸지 않은 보증만 눌러 미리 본다(저장하지 않음). 로비 대표만 장착 외형(앞면)으로 서고, 도감 칸 썸네일과 출하 결과 카드는 기본 외형 그대로다.

## 본 개발 4단계: 철강 퀴즈의 저장 (2026-11-15)

새 키는 없다. `sgg_game_save_v1`의 `extra`·`quizAt`·`quizUsed`를 쓰기 시작한다(필드는 0b단계 정규화에 이미 있었다). 원본 추출·시간 경계 판정·엔진 명령까지의 계약이다.

- `quizAt`: 24시간 보상 창이 열린 시각(ms). `quizUsed`: 그 창에서 받은 보상 수. 창은 `quizAt`+24시간까지 열려 있고, 창이 닫혀 있으면 남은 보상은 한도(`quizMax()`)다. 보상을 받는 순간 창이 닫혀 있으면 `quizAt=지금`·`quizUsed=0`으로 새 창이 열린다. `extra`는 보상으로 1 늘며 한도(`quizMax()`)를 넘지 않는다. 한도는 평소 3이고 행사 "품질 교육 주간"에는 5다(원본 `PROMO.quizMax`). 값은 모두 원본 `renderQ`의 보상 문장을 그대로 실행한다(`settleQuiz`, `qa/quiz-economy.test.mjs`·`qa/quiz-window.test.mjs`가 원본 직접 실행과 대조).
- `quizDay`: 원본이 만들고 이어받기만 하고 읽지 않는 필드다. 검사하지 않고 그대로 둔다.
- 불러올 때 검사(`validState`): `quizAt`·`quizUsed`는 `pullAt`·`pullUsed`와 같게 0 이상의 안전 정수여야 한다. 음수·소수·문자열·`Infinity`는 원본이 한도를 넘기거나 창을 영원히 열어 두므로 보류한다. 원본 `||0`이 0으로 바꾸는 `null`·빈 문자열·`false`·빠진 값은 정상이다. **미래의 `quizAt`(기기 시계를 되돌림)**과 한도를 넘은 `quizUsed`는 원본처럼 받아들이고 값을 바꾸지 않는다: 창이 `quizAt`+24시간까지 열려 있어 남은 보상은 0이다. 행사 뒤 3을 넘은 `extra`도 받아들인다(원본 그대로의 한 가지 이상 동작: 이 상태에서 다음 보상을 받으면 `extra`가 `quizMax()`로 줄어든다. 결과 문구는 원본 그대로).
- 퀴즈 세션(뽑은 5문제·고른 답·진행)은 **엔진 메모리에만** 있고 저장하지 않는다. 새로고침·탭 닫기·화면 닫기는 그 퀴즈를 버리고 보상도 저장도 없다. 정답 채점도 엔진이 한다(화면은 고른 보기 번호만 보내고, 정답 번호와 해설은 답한 뒤에만 돌려받는다). 같은 문제에 두 번 답해도 한 번만 센다.
- 문항 413개는 용량 때문에 별도 모듈(`quiz.mjs`)이고 처음 퀴즈를 시작할 때 한 번 불러온다. 첫 화면 용량은 그대로다.
- **저장을 쓰는 곳은 한 군데**다: 5문제를 모두 맞혀 보상을 처리한 순간(결과 진입, `quizNext` 마지막 문제)에 한 번. 시작·답하기·다음 문제·닫기·4개 이하 정답·보상 횟수 소진 결과는 저장을 쓰지 않는다. 원본은 결과 화면 진입마다 `save()`를 부르지만 그때 바뀐 값이 없어 같은 결과다(원본과 다른 점으로 기록).
- 결과 처리는 다른 명령과 같은 보호를 거친다: 저장 잠금(`commandSafely`), 다른 탭 변경 검사, 손상 저장 보류(시작도 거절), `commandBusy`, 저장 먼저 시도 뒤 결과 반환, 쓰기 실패 시 메모리 결과·경고·백업. 다른 탭이 저장을 바꿨으면 결과 처리를 거절하고 메모리에도 보상하지 않는다. 퀴즈를 푸는 도중 시간 경계(행사 끝 등)로 보상이 막히면 결과가 "보상 잔여 횟수를 모두 사용했어요"가 되고 저장하지 않는다.
- 퀴즈는 `items`·`stock`·`owned`·`scrap`·`pullAt`·`pullUsed`·`results`를 만지지 않는다. (요구 기록 `orderDay`·`orderDone`은 연구 탭을 연 것만으로 오늘 날짜로 넘어가 어떤 저장에든 같이 쓰인다. 원본 `todaysOrder`와 같다.) 퀴즈로 얻은 추가 출하는 출하 때 `extra`부터 쓰인다(`single()`).
- 읽기 전용 조회 `quiz()`는 저장을 쓰지 않는다(보유 추가 출하·보상 잔여·한도·갱신 시각 `fmtWhen` 표기·시작 가능 여부).

## 본 개발 5단계: 공지·기간 행사·출하 알림의 저장 (2026-11-18)

새 키는 없다. `sgg_game_save_v1`의 `noticeSeen`·`promoSeen`·`promoDone`·`bell`·`belledAt`을 쓰기 시작한다(필드는 0b단계 정규화에 이미 있었다). 이 단계의 명령은 이 다섯 값만 바꾸고 경제값(`owned`·`stock`·`scrap`·`extra`·`pullAt`·`pullUsed`·`quizAt`·`quizUsed`·`items`·`parts`·`cars`·요구 기록)은 하나도 바꾸지 않는다(`qa/stage5.test.mjs`가 명령 전후의 나머지 저장을 통째로 비교한다).

- `noticeSeen`: 확인한 공지의 키(`NOTICES[].key`). 공지를 확인하면 **그 시점에 행사도 진행 중이면 `promoSeen`도 함께** 쓴다(원본 `checkNotice`의 문장 그대로: 공지 안에 증산 안내가 들어 있어 창을 두 개 띄우지 않는다).
- `promoSeen`: 확인한 행사의 키(`PROMOS[].key`). `promoDone`: 종료 안내를 낸 행사의 키. 종료 안내는 "그 행사를 확인했던 사람에게만 한 번"이다. 원본 `curPromo()`는 아직 끝나지 않은 첫 행사를 돌려주므로 뒤에 다른 행사가 있으면 앞 행사가 끝나는 순간 `PROMO`가 다음 행사로 넘어가고, 종료 안내(`promoDone`)는 **마지막 행사가 끝난 뒤에만** 뜬다(원본 그대로).
- `bell`: 출하 알림 켜짐. 브라우저 권한이 허용일 때만 켠다(엔진 `enableBell`이 권한을 다시 확인한다). 권한이 철회돼 있으면 저장은 켜짐이어도 화면은 꺼짐으로 보이고, 끄기로 정리한다. `belledAt`: 마지막으로 알린 출하 주기(그때의 `pullAt`). `belledAt === pullAt`이면 그 주기는 다시 알리지 않는다. 알림을 켜는 순간 이미 열려 있던 주기는 알리지 않는다(`belledAt = pullAt`).
- **기록 시점(원본과 다른 점)**: 원본은 안내가 열리는 순간 `noticeSeen`·`promoSeen`을 쓴다. 이 판은 사용자가 확인·닫기(Esc 포함)를 눌렀을 때만 쓴다(`ackNotice`·`ackPromo`). 열기만으로는 저장하지 않으므로 닫기 전에 새로고침하면 같은 안내가 다시 뜬다. 종료 안내(`promoDone`)와 갱신 알림(`belledAt`)은 확인 동작이 없어 원본처럼 낸 순간 쓴다. 모든 기록은 같은 곳에서 같은 값이 이미 있으면 쓰지 않는다(같은 확인을 두 번 해도 한 번).
- 조회 `ops()`는 저장을 쓰지 않는다. "지금 한 번 안내해야 할 것"(`pending`)은 원본 기록 함수를 한 번 돌려 보고 값을 되돌려서 알아낸다(판정 문장을 따로 복제하지 않는다). 저장이 보류·잠긴 상태에서는 아무것도 `pending`이 아니다.
- 불러올 때 검사(`validState`)는 이 다섯 값에 **새 항목을 넣지 않는다**. 원본 정규화가 `bell=!!p.bell`, `belledAt`은 숫자가 아니면 −1, 나머지 셋은 `p||""`로 고치고, 이 값들은 `===` 비교에만 쓰여 어떤 값이어도 오동작하지 않기 때문이다(이상한 값은 한 번 확인하면 정상 값으로 덮어써진다: `qa/stage5.test.mjs`). 이전 게임 저장의 값은 그대로 이어받아, 이미 확인한 공지·행사는 다시 뜨지 않는다.
- 저장을 쓰는 명령(`ackNotice`·`ackPromo`·`ackPromoEnd`·`enableBell`·`disableBell`·`fireBell`)은 다른 명령과 같은 보호를 거친다: 저장 잠금(`commandSafely`), 다른 탭 변경 검사, 손상 저장 보류, `commandBusy`, 메모리 기록 뒤 저장을 먼저 시도하고 결과 반환(쓰기 실패 시 메모리 기록은 남기고 경고). `readyEdge()`(출하 갱신 전이 판정)는 메모리만 바꾸고 저장하지 않는다.
- 시스템 알림은 서비스 워커 없이 `new Notification`만 쓴다(페이지가 열려 있을 때만 울림, 8단계 전까지). 알림 아이콘은 승인 목록에 없어 쓰지 않는다.

## 본 개발 6단계: 웹툰(현장 소식지) 읽음 표시의 저장 (2026-11-18)

**진행 저장(`sgg_game_save_v1`)은 바뀌지 않는다.** 새 항목도, 불러올 때 검사의 변화도 없다. 웹툰은 경제값(`owned`·`stock`·`scrap`·`extra`·`pullAt`·`pullUsed`·`quizAt`·`quizUsed`·`items`·`cars`)을 읽지도 쓰지도 않는다.

읽음 기록은 **별개의 키 `sgg_game_toon_seen`**(이전 게임과 같은 키, 원본 `GAME_EDITION.toon`)에 가장 멀리 읽은 회차의 id 하나(`s00`·`ep01`~`ep07`, 2026-11-20부터 3~7화 포함)만 문자열로 둔다. 이전 게임에서 읽은 기록을 그대로 이어받는다.

- **쓰는 때**: 회차를 여는 순간(`engine.toonOpen(i)`), `i`가 지금 읽음 위치보다 뒤일 때만 그 회차의 id를 쓴다(원본 `openToonView`의 문장). 앞 회차를 다시 열어도 되돌리지 않고 쓰지도 않는다. 목록을 여는 것만으로는 쓰지 않는다.
- **읽는 때**: `engine.toon()`이 부를 때마다 저장소에서 다시 읽는다(원본 `toonSeenIdx`). 그래서 다른 탭에서 앞서 읽은 기록이 다음 조회에 보인다. 화면은 `storage` 이벤트로 연구 탭의 점·소식지 줄·열려 있는 목록을 맞춘다.
- **손상 값**(알 수 없는 id·빈 문자열·객체 모양 문자열)은 위치 −1, 곧 모두 NEW다. 다음 회차를 열면 정상 값으로 덮어쓴다(원본과 같다).
- **저장소를 읽거나 쓸 수 없을 때**: 원본처럼 조용히 넘어간다(읽지 못하면 모두 NEW, 쓰지 못하면 NEW가 남는다). 화면은 같은 안내를 매초 다시 띄우지 않고 오류 문구도 내지 않는다. `engine.toonOpen`은 되읽은 값으로 `saved`를 돌려주며 시험이 쓴다.
- **진행 저장과의 독립**: 진행 저장이 손상돼 쓰기가 보류된 상태(`blocked`)에서도 읽음 표시는 따로 동작한다. 읽음 키 쓰기는 진행 저장의 잠금(Web Locks)·다른 탭 변경 검사·`commandBusy`를 거치지 않는다(한 문자열을 덮어쓰는 것이라 동시 쓰기에도 가장 멀리 읽은 쪽이 남는 것은 `i > 위치` 검사로 지켜진다. 두 탭이 동시에 다른 회차를 열면 나중 쓰기가 남을 수 있으나 원본과 같고 다음 열기에서 바로잡힌다).
- **백업**: 진행 백업 코드에는 들어가지 않는다(7단계 결정 2026-11-20: 원본 그대로, 진행 초기화로도 지우지 않는다).
- 그림 파일은 승인 범주 `webtoon`(`current/approval/webtoon/…`)의 64장(2026-11-20 기록, 2026-11-18 기록의 18장 포함)이며 `public/webtoon/`에 복사된다. 이 단계는 서비스 워커나 캐시 버전을 건드리지 않는다.
- **3~7화 추가(2026-11-20)**: 저장 형식은 그대로다. 회차가 뒤에 붙기만 해서 이미 저장된 `s00`·`ep01`·`ep02`의 위치가 같다(2화까지 읽은 사람은 3~7화가 NEW). 원본의 특별편 `sp01`은 승인 전이라 목록에 없고, 읽음 키에 `sp01`이 있으면 모르는 값(손상과 같음, 모두 NEW)으로 본다. 게임판은 특별편을 열 수 없어 이 값을 쓰지 않는다(`qa/toon.test.mjs`의 "알려진 차이").

## 본 개발 7단계: 백업 코드·복원·IndexedDB 사본·진단·초기화 (2026-11-20)

새 localStorage 키는 `sgg_game_save_v1_held` 하나다(검토 반영, 아래 "손상·거부 저장"). 이 문서 위쪽 표의 게임판 키(IndexedDB `sgg_game`/`save`/`sgg_game_save_v1`, 진단 임시값 `sgg_game_save_v1_probe`)를 본 개발 코드가 쓰기 시작했다. 규칙은 고정 규칙 템플릿과 백업 모듈 `src/game/backup.js`(SHA `bba6de0b…68c0`)의 원문을 추출해 쓴다.

- **IndexedDB 사본**: 진행을 저장할 때마다(local 쓰기 성공 여부와 관계없이, 원본 `save()`처럼) 같은 JSON을 사본에 쓴다. 다른 탭 변경으로 저장이 멈춘 때는 쓰지 않는다. 시작이 끝나면 한 벌 더 쓴다(원본 부팅의 `mirrorPut`). 본 개발판은 `results`·`featured`도 함께 사본에 들어간다.
- **빈 local의 복구**: 원본과 같은 조건 — 불러오기 실패가 아니고 진행(발견·스크랩·아이템)이 없으면 사본을 읽어, 발견이 하나라도 있는 사본만 받아들인다. 확인하는 동안(최대 2500ms) 아무것도 쓰지 않고 명령은 "저장 사본을 확인 중입니다…"로 거절하며, 제한 뒤 늦게 온 사본은 버린다. 원본과 다른 점: ① 사본도 불러오기와 같은 형식 검사(`validState`·`validOrders`)를 거치고 맞지 않으면 쓰지 않는다. ② 복구하지 않았으면 빈 상태를 local에도 사본에도 미리 쓰지 않는다(첫 명령 때 쓴다). 그래서 제한 시간 뒤 늦게 답한 사본은 이번에는 버려지지만 다음 시작에 다시 되살릴 수 있다(원본은 시작 끝에 빈 상태로 사본을 덮는다. 7단계 검토 지적 3). 이전 게임 공개본과 같은 출처라 local이 빈 사용자는 이전 게임이 남긴 사본(같은 키)이 되살아날 수 있다.
- **백업 코드**: `SGG-GAME1.` 코드만(원본 `makeCode`). 담기는 것은 원본 팩 그대로(발견·재고·아이템·스크랩·추가 출하·출하/퀴즈 시각과 몫·요구 기록·부품·차량). `bell`·공지/행사 확인 기록·`backupAt`·`results`·`featured`·웹툰 읽음은 들어가지 않는다. 체험판 시절 JSON 파일 받기는 없앴다(엔진의 `backup()`은 시험용 원시 값 확인으로만 남는다).
- **복원**: 미리보기(현재·불러올 진행 요약, 교체 전 복구 코드) → 교체. 미리보기 뒤 진행·날짜·입력이 바뀌면 거절한다. 교체는 원본 `applyCode`(팩의 항목만 덮어씀: 알림·행사 확인 기록은 유지)이고, 원본 코드에 없는 `results`는 `null`, `featured`는 지운다. 교육용 `SGG1.` 가져오기는 없다(사용자 결정). 교체 뒤 "이전 게임용 진행 복구 코드"는 새로고침 전까지만 화면에 남는다(저장하지 않는다).
- **초기화**: 5초 안 두 번째 누름에서 원본 새 상태(`bell`·`promoSeen`·`promoDone`은 유지, `belledAt`은 −1, `noticeSeen`은 빈 값)로 바꾸고 `results`는 `null`. 웹툰 읽음·다른 키는 지우지 않는다.
- **손상·거부 저장**: 원본 `loadFailed`처럼 덮어쓰기를 멈춘 상태에서는 백업 복원과 초기화만 저장을 다시 연다(명시한 교체). 다른 탭이 진행을 바꿔 멈춘 경우는 새로고침이 먼저라 둘 다 거절한다. 검토 반영(2026-11-20): ① 덮어쓰기 직전에 손상된 원문을 **`sgg_game_save_v1_held`**에 그대로 옮기고 되읽어 확인한다(가장 최근 것 하나, 사용자 결정). 남기지 못하면 복원·초기화를 멈추고 손상 저장을 그대로 둔다. 원본은 원문을 남기지 않는다. ② 손상 저장 탭이라도 그사이 다른 탭이 저장을 바꿨으면 덮지 않고 다른 탭 변경으로 멈춘다. 읽을 수 없는 저장소는 원본처럼 그대로 진행한다.
- **backupAt**: 코드 복사에 성공했을 때만 기록한다(원본과 같다). 사본 확인 중에는 복사를 거절하고(원본도 이때 실패 문구), 보이는 코드가 지금 진행과 다르면 새로 만든 뒤 다시 누르게 한다. 확인 중에 연 창은 사본에서 되살리면 코드가 새 진행으로 바뀐다. 공방 "진행 보관" 줄에 "마지막 백업 M월 D일"·"아직 백업한 적이 없습니다"(진행이 없으면 표시 없음)로 보인다.
- **진단**: 백업 창을 열 때 원본 `storeDiag`가 local 임시값 쓰기→되읽기→삭제, 사본 임시값 쓰기→되읽기→삭제, 영구 저장 여부를 확인한다. 진행은 바뀌지 않는다.
- 시험: `qa/stage7.test.mjs`(원본 대조 20개, 검토 반영 8개 포함), `qa/stage7.spec.mjs`(Chromium·WebKit 9개).

## 본 개발 8단계: 설치 기록·오프라인 캐시 (2026-11-20)

- **진행 저장은 바뀌지 않는다.** 설치 기록은 위 표의 게임판 키 `sgg_game_installed`(값 "1", 설치를 마치면 쓰고 설치 줄을 감춘다)만 쓴다. 원본의 닫음 기록 `sgg_game_install_dismissed`는 저절로 뜨는 띠가 없어 쓰지 않는다. 둘 다 진행 초기화·백업과 무관하다.
- **Cache Storage**: `steel-companion-shell-<뼈대 SHA>`(설치 때 미리 받은 화면 코드·자료·글꼴·소리·아이콘, 새 판이 활성화되면 이전 판 삭제)와 `steel-companion-art-v1`(본 그림·웹툰, 내용 SHA 확인 뒤 저장). 같은 출처의 이전 게임 캐시(`sgg-game-cache-*`, `steel-grade-gacha-v*`)는 읽지도 지우지도 않는다. 서비스 워커 범위는 배포 폴더(`/steel-grade-gacha/`)라 이전 게임 폴더(`/steel-grade-gacha-game/`)의 요청은 가로채지 않는다.

