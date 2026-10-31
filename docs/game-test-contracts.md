# 게임판 테스트 계약 이관

작업 2의 경계 문서다. 기존 동작 주장을 지우거나 완화하지 않는다. 아래 후속 작업 번호는 `.omo/plans/steel-companion-game-edition.md`의 작업 ID이며, 아직 제작하지 않은 게임 자산·화면의 검증 통과를 뜻하지 않는다.

## 원본과 판 구분

| 대상 | 명시 입력 | 계약 |
| --- | --- | --- |
| 최초 규칙 | `SGG_BASELINE_ROOT=$E/baselines/original` | commit `6784048524c722b7d1057cb28e372b6cce5dc6cf`의 실행 결과와 데이터 |
| 보존 교육판 | `SGG_EDUCATION_ROOT=$E/baselines/education` | education-v1 `d3f52b6f3c79d6ccb579d362953242631b832a74`의 교육 전용 그림·번들 |
| 교육 검수 영수증 | `SGG_EDUCATION_REVIEW_ROOT=$ROOT` | `.omo/evidence/...` 및 `../.omo/evidence/...`를 원래 작업공간의 `.omo`로 해석; 게임 검수에 재사용 금지 |
| 현재 실행 대상 | `SGG_APP_ROOT=$GAME` | 작업 5 전에는 교육 edition 그대로이며 이후에만 game 저장 키 계약 적용 |
| 게임 원화 | `$GAME/docs/design/game-asset-manifest.json`, `$GAME/src/game/art/` | schemaVersion 2, edition game; 작업 4 이후 별도 검증기 사용 |
| 게임 검수·배포 | `docs/design/game-reviews/`, `assets/game/<releaseId>/`, `game-release.json` | 새 ID/경로/SHA 영수증, content hash와 실제 decode 검사; 작업 4·7·23·37 |

`tests/helpers/assets.mjs`의 API는 `await mappings({edition:'education',source:absoluteRoot})` 또는 `await mappings({edition:'game',source:absoluteRoot})`다. 문자열만 넘기거나 edition/source 생략, 상대 source, 알 수 없는 edition, 추가 context 키는 실패한다. education은 실제 교육 `src/build.sh`의 inline pair를 읽으며 게임 build 위임은 거부한다. game은 게임 manifest의 `assets[]` 공통 assetId/path/mime만 읽는다. 누락·잘못된 manifest는 실패한다. 이 헬퍼는 게임 원화 개수·해상도·alpha·검수·예산 인증기가 아니다.

교육 검증기의 명시 호출 예:

```sh
node tools/verify-assets.mjs --edition education \
  --root "$E/baselines/education" --baseline-root "$E/baselines/original" \
  --review-root "$ROOT" --group all --require-redraw --check-built \
  --report "$E/task-2/education-reference-assets.json"
```

`npm run verify:assets -- <위 인자>`도 같은 진입점이다. 기본 edition/source 추측은 없다. 게임을 `--edition game`으로 이 도구에 넘기면 실패한다. 작업 4의 `tools/verify-game-assets.mjs`가 새 자산 계약을 맡는다. `tests/assets-performance.spec.mjs`의 `@assets-*`는 `educationRoot`와 `educationReviewRoot`를 필수로 받아 보존 교육판을 검사한다. 음수 fixture는 그 복사본만 변경하며 원본 SHA를 비교한다.

## 기존 검사별 이관 표

파일은 모두 실제 `tests/` 아래 기존 계약이다. 각 행은 해당 파일의 반복/파라미터 사례 전체를 포함한다. 공통 비즈니스 필드는 보존하고 selector·route·저장 namespace·승인된 backup envelope만 판별로 명시한다. 혼합 파일의 교육 아트 주장을 게임 행동 검증에서 제외하는 것은 후속 분리 작업이며, 무조건 skip이나 삭제로 대체하지 않는다.

| 기존 파일 | 유지할 비즈니스·접근성 계약 | 교육 전용 주장/fixture | 게임 주장 목적지·후속 작업 |
| --- | --- | --- | --- |
| `contracts.spec.mjs` | RNG/가중치/프로모션/재고/스크랩/퀴즈/주문/제작/QP/차량/저장 전체 | 원본 catalog의 교육 저장 키 | `game/baseline-contracts.spec.mjs` + 작업 2; 승인된 key/envelope만 분리, 원본 실행 비교 |
| `education-data.spec.mjs` | 45 ID, 47면 물성·단위, 413문항, 35부품, 14아이템, QP | 교육 card DOM 표현 | 작업 32; 게임 카드에서 같은 데이터·단위 확인 |
| `assets-performance.spec.mjs` `@assets-*` | 파일 실패/빈 인코딩/alt 오결합 거부, 원본 불변 | JPEG 480×720, inline104, finalSha256 영수증, 18웹툰, workshop240KiB, index≤8,788,546B | 교육 reference 유지; 게임은 작업 4·7·23·35·37, 125base/47faces와 신규 예산 |
| `assets-performance.spec.mjs` `@performance*` | 실제 HTTP 바이트, native timer, decode readiness, overflow·0전송 reconciliation | 현재4탭 readiness/기준110%+240KiB·125% | 작업 35에 게임 공방 readiness와 신규 예산으로 별도 이관; 현재는 교육 구조까지만 유효 |
| `art-preview.spec.mjs` | 실제 이미지 decode와 ID/side 확인 | 교육 JPEG 미리보기·연락시트 | 작업 9·13–16·23·37; 개별 게임 원화/72px·전체 카드 검수 |
| `cards.spec.mjs` | 발견/재고/필터/잠금/QP/열처리/제작 연결·상태불변 | 교육 card DOM·이미지·tilt 구현 | 작업 25·26·32·34·37; 새 카드/장착 외형과 동일 데이터 |
| `draw.spec.mjs` | 단일/10회/교환 결과·비용·중복·마지막재고·busy·저장 우선·focus | 교육 reveal 단계·표현 | 작업 11·28·34; 스킵/실패/재진입/감소 모션에도 결과 한 번 |
| `home.spec.mjs` | 실제 자원·추천부품·QP·프로모션·쿨다운 | 교육 workshop hero/배치 | 작업 24·34; 공방 대표는 실제 발견 ID, 허위 보유 금지 |
| `navigation.spec.mjs` | deep link/history/unknown route/modal/초점·상태보호 | 교육4탭 selector·layout | 작업 24–31·38; 게임5route, learn/learning→research alias |
| `crafting.spec.mjs` | 35조합·명시 재료·QP 대체·부족·stale·중복 클릭 소비 | 교육 제작 modal 배치 | 작업 29·34; 동일 경제 + 새 제작 화면 |
| `qp.spec.mjs` | 발견조건·선택 재료·10스크랩·한 번 개발·QP free slot | 교육 연구 진입/결과 DOM | 작업 25·29·30·34; 연구 중심과 호출자 복귀 |
| `garage.spec.mjs` | 35부품→미보유8차종·취소·stale·중복 확정 | 교육 차량 그림·garage selector | 작업 22·31·34·37; 새 자동차 원화·조립 연출 |
| `learning.spec.mjs` | 정답 매핑·보상 한 번·쿼터·오답·닫기 불변 | learn 화면 selector | 작업 30·32; 413문항 그대로 연구 경로 |
| `orders-items.spec.mjs` | 14주문·보증 획득/호환성/stock0·stale·중복 방지 | POOL44 기반102관계·교육 아이콘 | 작업 2의 allChars45/103pair/107face-row 보강, 작업 17·18·26·30·34 |
| `webtoon.spec.mjs` | 3편/15page+3thumb·mark-on-open·다시읽기·실패/재시도·focus | 원본18WebP 불변·교육 seen key/진입점 | 작업 5·8·30·32·33; 게임 seen 격리와 동일 웹툰 |
| `storage.spec.mjs` | 정상/실패 진단·백업·복원·legacy stock·IDB 우선·잘못된 입력 불변 | 교육 SGG1/key/설치 안내 | 작업 5·6·38; game key/SGG-GAME1, 명시 교육 가져오기 |
| `settings-controls.spec.mjs` | 알림 권한 실패/미지원·설치 가이드·초점·경제 불변 | 교육 설치 문구/namespace | 작업 5·8·30·38; 게임 설치/설정과 음향 |
| `reset.spec.mjs` | 원본 결함 재현·수정된6필드·5초확인·취소/만료 불변 | 원본 education 재현은 reference 유지 | 작업 5·6·38; game 저장만 초기화 |
| `pwa-update.spec.mjs` | offline first·cache 실패·업데이트 연속성·잘못된 MIME/이미지 | 교육 고정 shell/cache/prefix | 작업 2 fixture 분기; 작업 8·33 game release manifest/critical·optional/live client 보존 |
| `end-to-end.spec.mjs` | 출하→제작→학습→주문→백업→차고·reload/offline | 교육 route·그림·SGG1·기존 cache | 작업 40; 게임 전체 흐름과 분리된 교육 reference 결과 |
| `dialog-focus.spec.mjs` | reader/card/nested keyboard focus·scroll 복귀 | 교육 trigger/selector | 작업 25–31·38; 새 진입/닫기/중첩 흐름 |
| `accessibility-layout.spec.mjs` | 실제 clipping/keyboard/4viewport/200%·reduced motion | 교육 shell와 modal 위치 | 작업 34·38; 게임5route·새 layer에도 조작 가능 |
| `final-coverage.spec.mjs` | toast/modal/back·자정 quota·notice/promo 보상 중복 방지 | 교육 표시·route | 작업 30·34·38·40; 같은 불변과 새 UI |

`tests/capture-baseline.mjs`와 `tests/fixtures/catalog.json`은 원본 교육 fixture 생산/보관 계약이다. 보존 catalog의 POOL44 item-fit102를 allChars45로 덮어쓰지 않는다. 게임용 103쌍은 원본 runtime `allChars()`와 각 `ITEMS.fit(findChar(id))`에서 별도로 산출하며 `qp-1470/arrow`를 포함한다. alt 추가4행은 `poo-PHS/arrow`, `ga-1470H/{arrow,iron,spark}`이고 총107배치다. 저장 fixture들은 `game/fixture-contracts.mjs`와 edition namespace를 통해 실제 key/IDB/seen에 설치한다. `helpers/app.mjs` 경제 비교는 허용한 namespace 외 필드를 제거해서 맞추지 않는다. `helpers/pwa-site.mjs`의 게임 package 파일은 release manifest에서만 선택한다.

## 남은 게임 자산·성능 계약

작업 4에서 schema/negative 검증, 작업 7에서 content-hash build/package·원자적 실패, 작업 9·12–23에서 실제 원화/합성, 작업 35에서 실제 전송·readiness, 작업 37에서 전체 identity/72px 검수를 완성한다. 기본 원화125(캐릭터47/배경6/scene10/plinth1/frame2/item14/part35/car8/draw2), 카드47면, 호환103쌍/107배치는 서로 다른 수다. thumbnail47/PWA3은 파생 export다.

새 예산은 index≤1MiB, audio를 요청하지 않은 공방 초기전송≤2MiB, visual runtime≤40MiB, audio≤8,000,000B다. 각 engine 새 context3회 중앙값 ready≤2000ms 및 ≤교육 중앙값×1.25+500ms를 모두 만족해야 한다. 교육판 8.79MB/480×720 영수증은 이 기준을 대체하지 않는다. 최종 작업 40·42는 교육 reference와 실제 게임 검증 수·입력 SHA를 분리 보고한다.

## 실행기 확장

새 game 사례는 작업 구현 시 `tests/game/cases/<case>.mjs`의 default `{name:'case-name',testMatch:'actual.spec.mjs'}`와 실제 `tests/game/` spec을 함께 추가한다. 중앙 registry를 수정하거나 미래 사례를 빈 테스트로 등록하지 않는다. `node tools/game-qa.mjs --list`는 등록된 실제 사례만 표시한다. 실행기는 선택한 사례의 nonzero 결과 수, exit, runId, 입력 SHA와 별도 임시 자원 소유를 보고한다. 현재 edition은 education이며 작업 5 이후 `SGG_EDITION=game` 경계를 적용한다.
