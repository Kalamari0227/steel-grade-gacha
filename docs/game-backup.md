# 게임판 백업·선택 가져오기

작업 6의 실제 동작과 유지보수 기준이다. 구현은 [backup.js](../src/game/backup.js)의 코덱·검증과 [app_tpl.html](../src/app_tpl.html)의 `makePack()`, `applyCode()`, `openBackup()`이다. 저장소 구분은 [game-persistence.md](game-persistence.md)를 따른다. 그 문서의 “작업 6 전 SGG1” 설명은 작업 5 당시 기록이며, 현재 게임판 출력은 아래 형식이다.

## 코드 형식과 검증

- 게임판: `SGG-GAME1.` + **UTF-8 JSON의 패딩 없는 base64url**. JSON은 `{version:1, edition:"game", progress:<v1 compact pack>}` 세 필드만 허용한다.
- 교육판: `SGG1.` + 기존 compact pack. **교육용 백업 가져오기**로만 받는다. **게임용 백업 미리보기**에 교육 코드를 넣으면 거절하며, 반대 경로도 거절한다. 교육 저장소를 자동으로 읽거나 쓰지 않는다.
- 입력 원문의 UTF-8 크기는 공백 제거 **전** 최대 256KiB(262,144바이트)다. 이후 공백을 제거하고 prefix, canonical base64url, UTF-8, JSON, 일반 객체, 버전을 검사한다. 임의 JSON·코드 실행 기능이 아니다.
- 허용 필드 이외의 키, 잘못된 타입, 음수·소수·문자열 숫자·무한대·안전 정수 범위를 벗어난 값은 필드별 오류로 거절한다. 시각은 0 이상 8,640,000,000,000,000 이하의 안전 정수다. 주문 날짜는 존재하는 날짜, 주문 키는 알려진 키여야 한다.
- 현재 카탈로그 전체 **소재 45개 / 호환 장착 관계 103개**를 기준으로 검증한다. 추첨 POOL만으로 허용 목록을 만들지 않는다. 발견한 `qp-1470`의 `arrow` 장착도 유효하다. 소재·부품·자동차 중복, 축약/원래 ID가 중복된 재고, 미발견 재고, 미발견·비호환 장착은 거절한다. 아이템 값 `1`은 보유하되 미장착이라는 기존 표현이다.

`makePack()`의 출력 필드는 `v,o,i,s,x,p,q,u,pu,od,ok,on,pt,st,cr`이다. `o`는 발견, `i`는 아이템/장착, `s/x`는 스크랩/추가 출하, `p/q/u/pu`는 출하·퀴즈 시각/사용량, `od/ok/on`은 주문, `pt`는 부품, `st`는 재고, `cr`은 `[자동차 키, 시각]` 목록이다. 소재 ID의 `poo-/ssial-/ga-`는 `P/C/G`, 나머지는 앞의 `-`로 축약한다.

| 생략된 구형 필드 | 적용값 |
| --- | --- |
| `st` | 발견한 소재마다 재고 1장. `st`가 있으면 명시된 **0장도 보존**하며 없는 항목을 1장으로 채우지 않는다. |
| `cr` | `cs`가 있으면 `{k:cs, at:ca 또는 0}` 한 대로 변환. `cr`이 있으면 그것을 사용한다. |
| `pu` | `p`가 0이 아니면 1, 아니면 0. 명시된 `pu:0`은 보존한다. |
| `i`, `pt`, 자동차 정보 | 빈 아이템·부품·자동차. 부품은 `{at:0,use:[]}`로 복원한다. |
| `s,x,p,q,u,on`, `od,ok` | 각각 0 또는 빈 문자열. `v:1`과 발견 목록 `o`는 필수다. |

검증 결과는 별도 객체로 만든다. 확정 때 기존 `refresh()`의 날짜·주문 갱신과 출하/퀴즈 제한 계산을 그대로 거치므로 오래된 주문 날짜는 기존 규칙에 따라 정규화된다. 미리보기 요약은 가져온 값의 요약이며 날짜 갱신 후 주문 상태를 예측하는 기능은 아니다.

진행 백업은 전체 `S` 덤프가 아니다. 음향·대표전시 등 표현 설정(`sgg_game_preferences_v1`), 웹툰 읽음(`sgg_game_toon_seen`), 설치 플래그는 제외한다. `bell`, `belledAt`, `backupAt`, `promoSeen`, `promoDone`, `noticeSeen`, `qpSeen`도 가져온 값으로 덮어쓰지 않는다. 미완료 `pending`은 빈 문자열로 복원한다.

## 화면 흐름과 실패 처리

1. 설정의 **진행 백업 · 복원**에서 **내 백업 코드**를 보관한다. **코드 복사**는 현재 출력값을 복사한다.
2. 코드를 붙여 넣고 **게임용 백업 미리보기** 또는 **교육용 백업 가져오기**를 선택한다. **진행 교체 미리보기**에 `현재 게임용:`과 `되돌릴 게임용:` 또는 `가져올 교육용:` 요약을 표시한다. 요약은 발견·재고·아이템·부품·자동차·스크랩 수다.
3. **교체 전 게임용 복구 코드**를 먼저 보관한다. 안내 문구는 “합치지 않고 게임용 진행 전체를 교체합니다. 이전 진행 코드를 먼저 보관하세요.”다.
4. **게임용 진행 교체**를 누르면 재검증 후 한 번 적용하고 저장을 시도한다. 미리보기를 먼저 비워 연속 클릭으로 중복 적용하지 않는다. 현재 출력 코드와 요약을 같은 창에서 갱신하고 **이전 게임용 진행 복구 코드**를 보여 준다.

**취소**는 “취소했습니다. 현재 진행을 유지합니다.”를 표시하고 시작 버튼으로 초점을 돌린다. 입력 수정은 미리보기를 폐기한다. Escape로 닫고 다시 열어도 확정되지 않은 미리보기는 남지 않는다. 잘못된 입력·취소·미리보기만으로는 진행 `S`, 게임 저장값, 출력 코드·요약을 바꾸지 않는다. 백업 창의 저장 진단은 별도 임시 probe를 쓰므로 이 보장은 진단 I/O까지 없다는 뜻은 아니다.

확정 직전에 `S` 전체 스냅샷, 날짜, 입력 원문과 저장소 확인 대기 여부를 다시 비교한다. 달라졌으면 “미리보기 후 현재 진행이 바뀌었습니다. 다시 미리보기 해 주세요.”로 중단한다. 현재 진행을 새로 미리보기한 뒤 다시 확정해야 한다. 저장소 확인 중에는 “저장소 사본을 확인 중입니다. 잠시 후 다시 미리보기 해 주세요.”로 차단한다.

저장은 기존 localStorage 쓰기·되읽기와 비동기 IndexedDB 사본의 **최선 노력** 방식이다. 두 저장소에 걸친 영구 원자적 교체나 실패 롤백을 보장하지 않는다. 저장이 거절되거나 조용히 실패하면 적용된 메모리 진행은 유지하고 “진행은 이 창에 적용했지만 기기 저장을 확인하지 못했습니다.”로 시작하는 경고를 표시한다. 현재 진행 코드를 즉시 복사할 수 있고 저장 경고에서도 백업 창을 다시 열 수 있다. 저장 경고가 남아 있으면 복사 성공 후에도 “코드를 복사했습니다.”에 이어 저장 실패 안내를 표시하며, 창을 다시 열 때도 저장 경고를 표시한다. 복사 성공 표시는 클립보드 성공을 뜻하며 영구 저장 성공 보증이 아니다.

이전 복구 코드 `backupRecovery`는 **현재 페이지 메모리에 한 개만** 유지한다. 창을 닫았다 다시 열면 보이지만 다음 교체로 바뀌고, 새로고침·페이지 종료를 넘겨 보존되지 않는다. 복구 코드를 외부에 보관한 뒤 일반 게임용 미리보기→교체 흐름으로 복원한다. 자동 병합·동기화·교육판 역변환은 제공하지 않는다.

## 로컬 검증과 기존 테스트 이관

빌드된 게임 루트에서 실행한다. 저장소에 준비된 원본/교육판 baseline, 설치된 잠금 버전 의존성·브라우저가 필요하다. `E`는 해당 작업의 절대 증거 경로로 지정한다.

```sh
SGG_EDITION=game node tools/game-qa.mjs --case game-import --engines chromium,webkit --evidence "$E/task-6"
```

실행기는 전용 context와 가상 저장값을 쓰고 게임/원본 서버를 관리한다. `summary.json`, 입력 SHA, 브라우저 보고서·스크린샷·상태/저장값 해시를 확인한다. 실패·0개 실행·건너뜀은 통과로 취급하지 않는다. [import.spec.mjs](../tests/game/import.spec.mjs)와 [import-helpers.mjs](../tests/game/import-helpers.mjs)가 실제 보장을 정의하며, helper는 교육 localStorage/IDB sentinel과 교육 접근 0회, 표현 설정·웹툰 읽음·설치 플래그 보존을 확인한다.

[storage.spec.mjs](../tests/storage.spec.mjs)는 작업 40의 전체 회귀 정리 전까지 교육판 동작의 참조다. `#bkLoad` 한 번으로 복원·`SGG1.` 출력·구형 `readCode()`를 전제로 한 해당 사례를 게임판에 그대로 적용했다고 주장하지 않는다. 새 게임판 대응은 다음과 같다. 아래 목록은 테스트 연결표이며 실행 통과 보고서가 아니다.

| 기존 assertion / 사례 | 새 `game-import` 사례와 보장 |
| --- | --- |
| 한 번의 `#bkLoad`가 복원 | `explicit education current preview cancel and replace retains QP arrow`, `explicit education legacy preview cancel and replace retains QP arrow`: 첫 버튼은 변경 없는 미리보기, 취소 불변, 별도 확정에서 교체한다. |
| `SGG1 exact subset`의 compact 필드·재복원 | `game export envelope excludes preferences and restores compact progress after reload fresh=false`와 `fresh=true`: 진행 중/신규 게임의 envelope 내부 필드 집합·진행·재고·IDB/reload를 비교한다. 교육 current/legacy 사례는 QP/arrow·부품·자동차를, `all 45 IDs and 103 valid item relations validate including stock-zero ownership`은 전체 허용 카탈로그를 검사한다. 기존 네 fixture 사례를 그대로 재실행했다는 뜻은 아니다. |
| warning backup의 `SGG1.` prefix | game export 사례의 `SGG-GAME1.` envelope 검증 + `save throw retains memory warning recovery and immediate copy` / `save silent retains memory warning recovery and immediate copy`: 경고→백업 접근과 현행 게임 코드 복사를 유지한다. |
| `restore refreshes same-dialog code summary and immediate copy` | `successful restore updates same-dialog summary copy backup timestamp and keyboard focus`: 성공 후 다른 출력 코드·요약, 즉시 복사 일치, `backupAt` 증가, `#bkLoad` 초점 복귀를 확인한다. invalid 입력 사례는 기존 코드·요약 불변을 확인한다. |
| `corrupt SGG1 changes neither current nor saved state` | `invalid inputs never mutate live state either store or export output`: 형식/버전/타입/카탈로그/크기 오류에 `S`·localStorage·IDB·출력·요약 해시가 같다. |
| `restore throw/silent storage never reports success` | 위 save throw/silent 두 사례: 실패 경고, 기존 local 값, 메모리 적용, 이전 복구 코드와 현재 코드 복사를 확인한다. |
| `legacy backup missing stock gets one per discovered card` | education legacy 사례 + `legacy defaults and baseline order day quota normalization remain equivalent`: `st/pu/cs/ca` 기본값과 기존 날짜·주문·사용량 정규화, 명시적 0장 재고 보존을 확인한다. |
| 새 확정 경계 | `stale preview and repeated confirmation cannot overwrite a newer game`, `edited input and repeated escape close cancel without writes and retain focus`: 진행 변경·날짜 전환 후 미리보기 거절, 단일 적용, 입력 변경·반복 닫기와 초점 복귀를 확인한다. |

이 범위는 진행 코드와 저장 경계다. 서비스 워커/캐시 공존, 실제 설치, 최종 게임 화면·음향 설정, 전체 배포물 검증은 별도 작업 범위이며 이 문서로 완료를 선언하지 않는다.
