# 리디자인 유지보수

> T22 유지보수 안내. 승인된 T19 저장·캐시 사실을 반영했다. T20 수동 확인 방식과 T21 자산·로컬 성능 결과를 반영했다. T23 최종 고정 산출물의 경로·버전·바이트는 다시 확인한다. 아래 절차를 이번 문서 갱신에서 실행했다는 보고서가 아니다.

## 소스와 데이터 계약

src/app_tpl.html이 데이터와 화면의 편집 원본이다. src/pwa_head.txt/body.txt와 자산을 src/build.sh로 조합하여 index.html을 만든다. 생성물 index.html을 직접 수정하지 않는다.

고정 계약은 일반44/QP별도, 카드45 ID/47상태, 부품35, 보증14, 차량8과 원본 퀴즈/요구/확률/제작/백업 데이터다. 표현 수정으로 ID·수치·단위·조건을 바꾸지 않는다. specOf·ductRow·itemsOf·partPlan을 별도 계산으로 복제하지 않고 실제값과 연결한다.

공유 app_tpl.html 작업은 소유 함수·마크업/CSS 블록을 정하고 현재 소스를 읽은 뒤 좁은 패치를 적용한다. 다른 작업의 전체 템플릿을 복사하면 이후 통합을 잃는다. live 잠금 동안 입력/index를 고정하고 테스트·화면 SHA를 맞춘다.

## 디자인·아트

- 기준: docs/design/system.md, art-bible.md, reference/와 screen-states.md.
- 매핑: docs/design/asset-manifest.json. originalSha256는 불변, finalSha256와 reviewStatus/reviewEvidence는 실제 파일·검수 근거와 일치해야 한다.
- 제작 기록: docs/design/production/{pilot,po,cr,ga,wire-special}.md.
- 원본 편집 master·전체 prompt·참조 경로·거절본·provenance는 ROOT/.omo/artwork/staging/task-{4,7,8,9,10}에 보존되어 있다. 저장소 배포물만으로 원화를 재현할 수 있다고 가정하지 말고 실제 production 문서의 경로 존재를 확인한다.
-47JPEG은480×720이고 파일명/앞뒤 매핑을 유지한다. 원화는 가족색·얼굴·문양·정체성을 유지하며 텍스트/숫자/배지는 HTML로 분리한다.
- T4의 품질72 progressive optimize 4:2:0 Lanczos는 초기 승인 export recipe다. T21은 승인 master에서 wr_cord 품질69, c_980/c_1180 품질68로 세 장만 재출력했다. 480×720 RGB·progressive·4:2:0과 정체성을 유지했고 나머지 승인 자산은 그대로다. JPEG12,238B/내장HTML16,316B를 줄였으며 해당 새 검수·export 기록을 따른다.
- 원본 부품35/아이템14/차량8/웹툰18의 내용은 별도 요청 없이 바꾸지 않는다.

## 빌드·검증

실제 승인된 작업에서만 실행한다.

```sh
bash src/build.sh
npm run verify:assets -- --group all --require-redraw --check-built
npm run test:contracts
npm test -- --project=chromium --grep '@education-data'
```

`verify:assets --require-redraw` 검증 자료를 함께 보존한다.

- 불변 원본은 commit `6784048524c722b7d1057cb28e372b6cce5dc6cf`의 baseline이다. `tests/helpers/paths.mjs`의 기본 `repo/.omo/baseline/site` 또는 명시한 `SGG_BASELINE_ROOT`에서 원본 템플릿과 카드·부품·보증·차량·웹툰 파일을 읽는다. 원본 해시·ID/앞뒤 매핑·보존 이미지 비교에 필요하다.
- manifest의 `reviewEvidence`가 가리키는 작업공간 `.omo/evidence/.../task-{4,7,8,9,10,21}/identity-review.md`와 같은 폴더의 `export.json`을 보존한다. 최종 T21 검증 계약은 비어 있지 않은 검수 문서와 현재 파일명·finalSha256에 정확히 맞는 export 행을 요구한다. 현재 제작 기록과 실제 경로를 대조한다.
- T21에서 통합한 `--review-root`는 해당 작업공간을 지정하며 기본값은 APP의 부모다. `.omo/...`는 작업공간 기준, 기존 `../.omo/...`는 APP 기준으로 같은 위치에 해석한다. 자산 복제본의 `--root`와 검수 증거 루트를 혼동하지 않는다. 검수 자료의 실제 경로와 현재 파일 해시를 확인한다.
- 재압축으로 최종 바이트가 바뀌면 그 바이트에 대한 새 검수·export 증거와 manifest 연결을 만든다. 기존 검수 기록을 다른 바이트의 증거로 소급 사용하지 않는다. 공방 그림은 T4 검수와 `production/pilot.md`의 경로·해시·크기 기록을 따른다.

관련 UI 태그: @navigation, @draw, @cards, @craft-happy/@craft-negative, @qp, @garage, @learning, @orders-items, @webtoon. 실제 테스트 이름은 해당 spec과 실행 결과를 대조한다. T19 저장/PWA는 @storage-happy/@storage-negative/@pwa-upgrade-happy/@pwa-negative; 최종 환경에서 존재하는 태그와 nonzero test count를 확인한다.

검증 실행에는 SGG_EVIDENCE_ROOT, SGG_TASK_ID, 고유 SGG_RUN_ID/SGG_REPORT와 작업 전용 TMPDIR/cache를 사용한다. 기본 테스트 포트4273/4274의 소유권을 확인한다. 다른 서비스4173을 중단하거나 재사용하지 않는다. PWA same-origin staging은 해당 helper의 별도 소유 포트를 따른다.

테스트가 통과해도 실제 화면을 보지 않고 가독성·이미지 품질을 승인하지 않는다. 360/390/768/1280, 키보드, 감소동작, 실제 확대, 성공/실패/복귀 상태를 확인한다. CSS zoom과 native browser zoom을 혼동하지 않는다.

T20는 대화상자를 연 명시적 요소로의 포커스 복귀, 닫힌 details 내부의 포커스 후보 제외,44px 조작 영역, 감소동작의 실제0s 지속시간, 낮은 화면에서 카드 전신 표시, 현재 활성 포커스를 확인하는 즉시 스크롤을 반영했다. 지연 스크롤이 사용자가 이동한 포커스를 다시 화면 밖으로 밀지 않도록 유지한다.

T20 `root-manual-final.md`에서는 실제 IAB에서 계열·LV 기본 선택 메뉴를 Space→Down→Return으로 조작하고 값·결과 수·포커스 유지를 확인했다. 이는 headless 실행기의 기본 팝업 화살표 키 한계와 구분한다. WebKit은 대화상자 밖의 기본 컨트롤 탐색에 Option+Tab 경로를 사용하고, 대화상자 내부 포커스 순환은 일반 Tab으로 확인했다. 확대 증거는 두 엔진의 CSS640×450/DPR2 등가 배치와 전신·하단·닫기 접근 화면이며 실제 OS/native200% 확대 증거는 아니다. 접근성/주문 최종 회귀 근거는 별도로 확인한다. T21 바이트·로컬 측정 결과는 아래에 기록하며 T23 최종 결과와 구분한다.

## 증거 고정

1. 입력 파일·index·SW·manifest SHA256와 파일 크기를 기록한다.
2. 서버 main document 응답 SHA가 현재 index와 같은지 확인한다.
3. JSON test report의 expected/unexpected/skipped/flaky와 실제 테스트 수를 기록한다.
4. 스크린샷/trace/관측 JSON의 절대경로와 해시를 보관한다.
5. 실패한 이전 실행은 최종 통과처럼 인용하지 않고 원인·수정·재실행을 구분한다.
6. 마지막 코드 변경 뒤 관련 시나리오를 다시 실행한다. 이후 다른 소유자가 바꾼 파일을 과거 증거의 입력처럼 사용하지 않는다.
7. 소유 브라우저·서버·tmp/cache를 정리하고 원화·prompt·검증 증거는 보존한다.

## 저장·설치·캐시

SGG1 원래 필드는 v/o/i/s/x/p/q/u/pu/od/ok/on/pt/st/cr이다. 모든 localStorage 키의 복제가 아니며 별도 웹툰 seen이나 알림설정을 임의로 새 필드에 넣지 않는다. localStorage/IDB 복원 우선순위, 기존 reset 보호 필드와5초 확인을 유지한다.

T19 승인 버전은 `steel-grade-gacha-redesign-t19-v1`이다. network-first, skipWaiting, clients.claim을 유지하며 공방 그림을 포함한7개 앱 URL을 precache한다. 같은 origin의 정확한18웹툰 allowlist 중 이미 캐시된 정상 이미지 응답만 이전한다. 이전이 성공한 앱 캐시는 삭제하고, 복사 실패가 발생한 해당 이전 앱 캐시는 보존해 fallback에 사용한다. 관련 없는 캐시는 남긴다. 미열람 회차 전체를 미리 받거나 별도 저장 데이터 형식을 이전하지 않는다. HTML200·잘못된 응답은 웹툰으로 인정하지 않으며 미캐시 오프라인 요청은 HTML 대신 실패한다.

읽음 ID만으로 캐시 존재를 가정하지 않는다. 회귀에서는 실제 페이지 decode/cache 확인→업데이트→교체 controller의 activated 확인→캐시 응답·진행 재검증을 수행한다. Chromium은 context offline을 사용했다. WebKit은 context.setOffline 재로드의 내부 오류 기록을 보존하고, 소유 테스트 origin의 요청 소켓을 응답 전에 끊어 origin 응답0건과 캐시 fallback을 확인했다. 이때 navigator.onLine은 true일 수 있다. 이는 origin 연결 손실 검증이며 기기 전체 오프라인 검증이 아니다. 설치·권한 테스트는 모의 브라우저 이벤트로 앱 동작을 확인했으며 실제 OS 설치나 실제 권한 허용의 증거가 아니다.

유효 복원은 기존 applyCode/refresh 흐름 뒤 같은 창의 `#bkOut`과 `#bkSummary`를 갱신한다. 즉시 복사하는 코드는 복원된 현재 pack과 일치하며 복사 기록인 backupAt만 변경된다. 잘못된 입력은 진행·출력 코드·요약을 유지한다. 저장 거부·무응답·미지원 상태는 진단/오류로 구별한다. 웹툰 seen은 SGG1에 추가하지 않는다.

승인된 T19 입력은 source `2c5aa471cb1a37eae6270edbce83de4171d3e6e1c80561f6bade2f7ec84249f8`, index `3184548b8d4473870d0295f5c47c16702a3c68f27d4014b77bac3f84d2212372`다. 이 값은 T19의 과거 고정 검증 범위를 식별한다. T20·T21 이후의 소스/바이트 또는 최종 T23 통과를 뜻하지 않는다.

T18 retry는 원래 WebP URL을 유지한다. 새 회차 사전 다운로드나 쿼리로 캐시 키를 바꾸면 T19 allowlist 계약을 다시 검토한다. 설치/알림 권한은 사용자의 해당 클릭 경계에서만 요청한다.

## 검증 기록과 최종 외부 증거

### T21에서 확정한 자산·측정 범위

T21 `metrics-r4.json`, `report.md`, `measurement-corrections.md`, `final-receipt.json`을 근거로 한다. index/실제 HTTP SHA는 `8e53ede706b8b53e4cee0d0cb33ce3f0cd208f47bc9e5f1de46095b5175cec57`이며8,773,399B로 한도8,788,546B보다15,147B 작다. 보호 파일186개·baseline136개 보존,104매핑·47새 카드·18웹툰·공방 그림 검증이 통과했다. 실패 조건 9개는 BUILD7개와 VERIFIER2개로 나뉘며 각각 거부와 기존 index 보존을 확인했다. 셸 빌드가 손상 JPEG를 decode해 거부했다고 해석하지 않는다.

동일 기기·Chromium·390×844에서 기준/현재 각3회, 번갈아 새 context를 사용한 로컬 비제한 측정이다. readiness 중앙값은781.4ms→197.9ms, HTTP 응답 전송 중앙값은8,446,693B→8,881,102B였다. 기준49요청 중46개가 폰트이며 현재는3요청이다. 전송량은 모든 완료 HTTP 요청의 Request.sizes로 받은 인코딩 응답 본문+헤더이고 요청 업로드/TLS 비용은 제외한다. ResourceTiming은46폰트를 누락했으므로 참고 정보로만 사용했다.

최종 측정은 Date만 고정하고 native performance/timer를 유지했다. 별도 API 시나리오에서 실제 시간 증가와 resource-buffer overflow를 확인했다. readiness는 DOM·saveHold 해제·사용 가능한 출하 버튼·폰트 준비·현재 보이는 이미지 decode가 충족될 때 브라우저 안에서 기록했다. 각 context는 새로 만들었지만 OS·브라우저 프로세스·DNS·연결 캐시를 초기화하지 않았고 배포 CWV나 완전히 차가운 기기 측정이 아니다. r1/r2/r3은 수정 전 기록으로 보존하며 최종 수치는 r4만 사용한다.

이 기록은 T21 범위이며 root 수동 검토와 소유 자원 정리가 완료됐다. 아래 표는 T22 검토 시점의 기록이다. 이후 최종 두 브라우저 전체 검증·동일 바이트 증명과 캐시 버전·수치는 작업공간 외부 증거의 `E/delivery-manifest.json`과 T23 최종 보고서를 기준으로 확인한다.

| 항목 | 담당 근거 / 현재 상태 |
|---|---|
| index SHA·bytes,104매핑 decode |T21 8,773,399B/104매핑 확인, 위 SHA. T23 최종 재검증 대기 |
| 카드47 export recipe |T21 세 장만 품질69/68/68 재출력, JPEG12,238B 절감;47개 검수 완료 |
| 공방 그림240KiB 및 초기전송/시간 budget |T21 hero102,478B 및 위 로컬 측정 예산 충족; T23 재검증 대기 |
| 최종 CACHE 버전·같은origin 이전 증거 |T19 승인 버전·이전 검증은 위에 기록. T23 최종 버전·바이트 재검증은 대기 |
| 전체 확대/키보드/접근성 결과 |T20 수동 기본 메뉴 조작·등가 배치 확인 방식은 위에 기록. 최종 회귀/T23 결과 대기; 실제 OS200%는 미검증 |
| 최종 웹툰/학습/문구 경로 |T18/T22 직접 화면 확인; 최종 T23 근거는 외부 보고서 |

index 예산 기준은 원본7,989,588bytes의110% 이하이며 초기 총전송/시간 조건도 승인 T21 계획을 따른다. 수치를 채우기 위해 품질·테스트 판정을 완화하지 않는다. commit/push/deploy는 별도 사용자 승인 범위에서만 한다.

