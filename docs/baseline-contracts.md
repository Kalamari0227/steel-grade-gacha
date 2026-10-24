# 기준 동작과 회귀 실행

기준은 `6784048524c722b7d1057cb28e372b6cce5dc6cf`의 읽기 전용 `.omo/baseline/site`이다. 원본 index는 7,989,588 bytes, SHA256 `1207e159c272c25fe93033ac35f80b6a8a8337dec8d5ed42cf3ec298fcfc7d5b`이다. 제품 변경은 초기화 객체에서 빠진 `stock`, `parts`, `cars`, `pullUsed`, `qpSeen`, `noticeSeen` 여섯 필드 추가뿐이다.

Node 22 이상에서 `npm ci`와 `npx playwright install chromium webkit`를 실행한다. 개발 의존성은 `@playwright/test` 1.61.1로 고정했다. 테스트 코드는 배포 HTML에 포함되지 않는다.

## 실행과 증거

```sh
npm run baseline:capture
npm run test:contracts
npm test -- --project=chromium --grep '@reset-baseline-repro'
npm test -- --project=chromium --grep '@reset-happy|@reset-negative'
npm test -- --project=chromium --grep '@contract-negative'
npm run verify:assets -- --group all --check-built
node tests/helpers/negative-assets.mjs
node tests/helpers/mutations.mjs
npm test -- --project=chromium --grep '@art-pilot|@art-po|@art-cr|@art-ga|@art-wire-special'
```

`node tests/helpers/run.mjs <증거이름> npm run test:contracts` 형태로 실행하면 명령, 종료 코드, 시작/종료 해시, 로그, JSON 리포트의 영수증을 남긴다. `SGG_EVIDENCE_ROOT`는 실행 attempt 디렉터리이며 기본 `task-2`를 추가한다. 후속 작업은 `SGG_TASK_ID=4` 등으로 바꾸거나 `SGG_EVIDENCE_DIR`에 정확한 디렉터리를 지정한다. 각 테스트의 JSON 관찰값·trace·실패 스크린샷은 고유 runs 디렉터리에 저장된다. 0 tests는 성공으로 취급하지 않는다.

기본 앱 포트는 4273, 원본은 4274이다. 4173에 다른 서비스가 있었으므로 보존했다. `SGG_APP_PORT`, `SGG_BASELINE_PORT`로 변경 가능하며 기존 서버는 재사용하거나 종료하지 않는다. `baseline:capture`는 자체 서버를 시작하고 startup 이벤트와 HTTP 응답을 확인한 후 실행하고 소유 서버·브라우저를 닫는다. 기준 fixture와 카탈로그가 이미 존재하면 바이트가 같아야 하며 덮어쓰지 않는다.

브라우저는 390×844, Asia/Seoul, `2026-11-01T00:00:00+09:00`, 기본 RNG=0이다. 각 test는 fresh context다. 프로모션·24시간·5초 타이머는 Playwright clock으로 다룬다. HTML 응답 해시는 현재 디스크 파일과 매번 대조한다. 계약 실행은 service worker를 차단한다. T19 업데이트 시험은 해당 describe/test에서 `test.use({ serviceWorkers: 'allow' })`와 전용 staging origin을 사용해야 한다.

## 보존 계약과 케이스

| 계약 | 실행 케이스 제목/태그 | 독립 예상값 |
|---|---|---|
| 전체 ID·물성·정답·후보·14보증 호환 | `@education-data` | POOL44, 카드45, 앞뒤47, 부품35, 차8, 보증14; immutable catalog와 전수 비교 |
| 확률·희소도·픽업 | `RNG exact grade boundaries` | 45/35/15/5, 희소0.5, 픽업비율상한0.95; 경계 양옆 |
| 행사·개인24h | `all promotion boundaries` | 각 from−1/from/to−1/to, 개인 창 만료 전1ms/만료 |
| 단일 출하·중복 스크랩 | `single pull base priority` | 기본 우선, extra 유지/차감, 재고2→1·스크랩+1·도감 유지 |
| 옛 pending·재고0 | `legacy pending compensation` | pending 1회 보정; 발견과 재고 분리 |
| 완료 등급 확정교환 | `completed-lv3`, `completed-lv4` | 비용5/10, 도감 불변, 해당 재고+1 |
| 미발견 우선·비용 부족 | `exchange prefers undiscovered` | 미발견 선택, 부족 상태 불변 |
| 10연 | `ten pull 20 scrap` | 실제 결과10장·강제낮은RNG에서 마지막LV3+·스크랩−20·기본/extra 불변 |
| 저장 시점 | 단일/10연의 reveal entry probe | 기존 showPull/showTen 진입 시 localStorage와 S 일치; test-side wrapper만 사용 |
| 제작 | `craft every part`, `craft preference` | 35개 전수 explicit picks 소비·도감유지, 재고많은후보/동률낮은LV, 중복칸 예약 |
| QP | `QP reveal`, `QP covers` | 세1470발견, M+1180+scrap10, 1회 개발; QP 슬롯 무소모·명시 일반 후보 소비 |
| 차고 | `garage selection cancellation` | 선택/reload 불변, 8번째확정에35부품초기화 |
| 퀴즈 | `quiz five pass=`, `quiz exhausted` | 5정답 +1 누적상한3, 오답0, 답버튼 재제출불가, 소진비활성 |
| 요구·장착 | `all14 orders` | 오답 불변, 정답 item1/요구+1, 14종 각각 호환 소재 장착 |
| 저장 | `legacy normalization` | 옛 stock/car/pullUsed 보정, IDB 복원, SGG1 원래 필드만, 웹툰 별도키 |
| 실패 | `@contract-negative` | scrap19/부족제작/잘못된SGG1에서 상태불변·안내 |
| 사용자 초기화 | `@reset-baseline-repro`, `@reset-happy`, `@reset-negative` | 원본 오류는 별도 재현; 두번확인·5초 만료, 전체필드·LS/IDB/reload·웹툰과3설정 보존 |

정확히 RNG 0.8은 원본 JS 부동소수점 뺄셈 결과 LV3으로 넘어간다. 0.7999999는 LV2이며 이를 테스트가 명시한다. 완성 등급 교환은 미발견 후보가 없으면 해당 LV 전체에서 재고를 받는다. 퀴즈 상한은 `extra=Math.min(extra+1,quizMax())`의 누적 상한이다. 초기화 뒤 refresh는 기존 방식으로 `orderDay`를 오늘 날짜로 정규화한다.

## fixture와 자산

17개 fixture는 신규·중간진행·발견/재고0·옛저장·제작가능/부족·QP준비/보유·전체부품·7/8차·장착·행사·손상코드·완료LV3/4·초기화 준비다. 각 JSON은 출처/의도/state와 기준 브라우저가 생성한 SGG1을 담는다. fixture 준비 이외에는 UI 시나리오의 상태를 직접 바꾸지 않는다. 계약 단위 시험은 기존 전역 함수를 호출하여 규칙을 검증한다.

자산 목록은 기본 검사에서 build.sh의104개 pair와 템플릿을 읽으며 T3 문서에 의존하지 않는다. 원본 CQ3장은560×840, 나머지44장은480×720이다. `--group pilot|po|cr|ga|wire-special|all`, `--require-redraw`, `--check-built`, `--root`, `--report`를 지원한다. 그룹/재제작 검증은 `docs/design/asset-manifest.json`을 읽는다. 새해시 카드는480×720, redraw선택 카드의 원본 동일해시는 실패다. 18웹툰 해시는 그대로여야 한다. MIME·실제브라우저decode·치환·ID/side 매핑과 built URI를 검사한다.

아트 preview는 그룹별 모든 카드를 실제 도감 버튼으로 열고 앞뒤를 전환해 decode와 screenshot을 기록한다. 캡처 성공은 그림 품질 승인이 아니며 아트 담당의 별도 육안 검토가 필요하다. test-only mutation 사본에서 10연 보장 제거·퀴즈 보상 제거·제작 이중 소비를 주입한 뒤 동일 계약이 실패하는지도 기록한다. 모든 임시 사본은 finally에서 제거한다.

Playwright API 출처: https://github.com/microsoft/playwright/blob/v1.61.1/docs/src/clock.md 및 https://github.com/microsoft/playwright/blob/v1.61.1/docs/src/test-webserver-js.md (Context7 확인).
