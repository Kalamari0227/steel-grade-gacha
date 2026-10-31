# 섀시·구동 부품 15종

`tire`, `rim`, `disc`, `tank`, `bearing`, `spring`, `vspring`, `bolt`, `tierod`, `arm`, `clutch`, `stabil`, `brake`, `crank`, `conrod`는 각각 내장 ImageGen을 한 번씩 호출한 신규 미니어처 원화다. 프롬프트·원본 생성 경로·원본/승인 참조 SHA는 `generation/{key}.json`에 있다. PNG 원화는 `../masters/part/{key}.png`에 원본 바이트 그대로 보관한다. 런타임 `src/game/art/parts/{key}.webp`는 전체 캔버스를 648×648로 Lanczos 축소하여 768×768 RGBA의 (60,60)에 놓고 lossless WebP로 저장했다. 재색칠·수동 덧칠·배경 제거·형상 수정은 없다.

위쪽 왼편의 따뜻한 조명과 오른쪽의 차가운 반사광, 절제된 샴페인 색 반사를 기존 body/frame 부품과 맞췄다. 타이어는 무광 검정 고무이며 강선은 내부에 있다. 서스펜션 스프링은 굵고 열린 코일, 밸브 스프링은 조밀한 코일과 리테이너로 구분된다. `disc`는 휠 중심의 성형 원판이며 브레이크 로터가 아니다. `brake`는 마찰재를 붙인 강철 뒤판의 패드 쌍이며 캘리퍼가 아니다. 연료탱크는 접합된 두 셸과 외부 보호 표면·주입구 안쪽의 맨 강철 표현을 구분한다. 숨은 내부 화학 성분이나 강종 성능을 그림으로 인증하지 않는다. 카탈로그와 원형이 부품 정체성의 기준이다.

`happy/all15-comparison.png`와 `happy/{key}-original-runtime.png`는 15개 기존 원형과 신규 실제 출력을 비교한다. `72/{key}.png`는 정확히 72×72이며 `happy/all15-at72.png` 및 `happy/all15-at72-light.png`에 동일 크기로 배치했다. 밝고 어두운 배경의 전체 크기·72px와 저장된 master를 모두 직접 확인했다. 각 부품은 공통 상품 표시 크기로 정규화했으므로 부품 간 실제 치수 비율을 의미하지 않는다. `receipts/{key}.json`은 자체 시각 검수와 원본·런타임·참조·근거 SHA를 결박하며 최종 인수는 독립 검토를 거친다.

## 원래 레시피와 조립 좌표

`recipe-mapping.json`에는 원래 15개 key, 역사적 C6/C17–C19/C21–C28/C34–C36 placeholder, need 배열과 허용 재료 ID·슬롯 수가 그대로 들어 있다. C33이나 새로운 부품을 추가하지 않았다. 앱과 catalog는 수정하지 않았다. 전체 35개 원래 레시피는 실제 `src/app_tpl.html`의 PARTS와 catalog를 읽어 동등성을 확인했다.

`assembly-metadata.json`은 기존 `vehicle-side-normalized-v1` 규약의 그룹 전용 파일이다. x=0 앞, x=1 뒤, y=0 지붕 위, y=1 지면인 왼쪽 측면 도식이다. anchor·bounds는 0–1, layer는 0–100이며 모든 행은 실제 asset SHA와 원래 recipe JSON.stringify SHA256에 결박된다. `assembly-review.png`는 15개 실제 아트와 대표 위치를 직접 검토한 기술 도식이다. 앞바퀴 반복부품은 앞축의 대표 위치, 볼트는 앞 하부 접합부의 대표 위치, 내부 엔진 부품은 엔진 안의 개념적 위치다. 실제 CAD 체결점이나 모든 차종의 기계 설계가 아니다. 고정 canonical manifest schema를 확장하지 않았다.

## 실제 검증과 한계

병합 전 정확 명령은 `node tools/verify-game-assets.mjs --group parts-chassis --review-root docs/design/game-reviews --report <evidence>/assets.json`, 병합 후는 `--canonical`을 추가한다. 소유한 15행만 병합했으며 나머지 행·파일과 107개 장착 배치를 보존했다. 원래 fragment는 병합 전 fingerprint를 의도적으로 보존하므로 재병합하면 stale로 거부된다.

공유 `--case part-negative --group parts-chassis`는 생산 파일을 임시 격리 복사하여 누락·ID/key·해시·receipt·조립 좌표·recipe·중단/재개 오류를 실제 CLI로 검사한다. 그림을 자동 인식하는 검증이라고 주장하지 않는다. 공유 helper의 기존 이름 `wrong-inner-outer-review-receipt`는 이 그룹에서 첫 두 부품의 receipt 교환을 검사한다. C33 전용 검사는 공유 helper에 없어 작업 증거 디렉터리의 `c33-probes.mjs`에서 실제 CLI로 unknown asset와 잘못 추론한 `brake -> __C33__`를 별도로 거부했으며 공유 코드는 수정하지 않았다.
