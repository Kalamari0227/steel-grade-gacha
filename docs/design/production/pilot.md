# T4 대표 원화 제작 기록

상태: 6개 원화와 공방1개 제작·검수 완료(2026-10-24). 생성은 기본 제공 image_gen 도구로 자산마다1회씩 총7회 수행했다. 개별 원본과 승인 시안 reference/01-workshop.png,02-card-phs.png,03-crafting.png를 직접 확인하고 정체성/스타일 참조로 전달했다. 모든 master와 정확한 prompt는 프로젝트 루트 .omo/artwork/staging/task-4/에 보존한다.

| 최종 파일 | SHA256 | bytes |
|---|---|---:|
| src/img/poo.jpg |646e8fdcc2b434945635e8ccd9070448043fce85d54569b8ff182f7b276beb92|48440|
| src/img/p_phs_a.jpg |f490ddce0835342038bd0d977def44a407e8880671dbb19b17669634848d7bfc|49462|
| src/img/p_phs_b.jpg |167f358294f5633db1e730737d7dab3fae6b666bd06dfea6c3e836d1112fc2b9|57668|
| src/img/c_seddq.jpg |bb3be49bd23000de4639097f67a8985e7c1bb778657e7d57c8bfa4a7054d0bef|63936|
| src/img/c_1180.jpg |93274350cdfce139ad2eff221dfa7d3265516891aabb3f9e03849f0ade0066a7|66504|
| src/img/dogeum.jpg |1b54aa683a418369e5e617b8b8c7b135d9e6a5458dcc8cae7b5b1f525a57dfe4|45234|
| src/uiimg/workshop.webp |3063e286feb2730eefb2148410cb84c37266db36c88da77c5d4f005cf97cbbe1|102478|

원화는 모두 JPEG480×720. 공방은 WebP1200×480. 따뜻한 작업장 주광, 은색 얼굴, 둥근 금속 피규어 비율을 공유한다. PO CQ의 방울머리/산화면·금속면·물방울 메달, PHS의 중앙 능선 투구/세로 분할 원, CR의 각 원본 롤 문양(초심가공4롤/1180Y6롤), GA의 낮은 캡/육각 가로띠를 유지했다. PHS 전후는 같은 인물의 무광·낮은 자세와 열처리 표면·선 자세로 구별된다. 같은 LV3인 CR2종은 펼쳐진 긴 코트와 두꺼운 리벳 갑옷으로 식별된다. 공방은 CARS key=t의 기존 대형 미니밴 src/carimg/t.png와 기존 PO/CR이 조립하는 장면이다.

생산 파일: PO3의 *-master.png 및 *-prompt.txt는 staging/task-4 직하, CR2는 cr/masters와 cr/prompts, GA/공방은 ga-hero/의 master와 prompt. export.py가 최종 후보 optimized/*.jpg를 만든다. Pillow12.3.0으로 RGB→Lanczos480×720→JPEG quality72/optimize/progressive/subsampling2를 적용했다. 여섯 장 평균55207B(53.9KiB), 합331244B. 복잡한 코트/갑옷은 더 크므로 일괄 파일별 상한을 두지 않는다. 후속 제작은 이 규격을 출발점으로 실제 크기와72px를 직접 검토한다. 도구 기본 Python에는 Pillow가 없으므로 번들 Python /Users/ethanlee/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3을 사용했다.

원본 단순 필터가 아닌 새 렌더이며 글자·숫자·UI·프레임·워터마크는 없다. 480×720 최종6장, 실제 앱 카드6장, 이름 없는 비교와72×108 렌더를 직접 열어 확인했다. 압축 전후 얼굴·문양 구별 유지. 이미지 자체 반려 조건은 발견하지 않았다. 초기 브라우저 캡처의 fade중 촬영은 반려하고, tests/art-preview.spec.mjs에 실제 opacity1과 animation완료 대기를 추가하여 전체6개를 재촬영했다.

검증: bash src/build.sh exit0; npm run verify:assets -- --group pilot --require-redraw --check-built pass(104매핑/47카드/18웹툰/대표6); npm test -- --project=chromium --grep '@art-pilot' 1passed. 최종 index SHA256 3a02565437bd1a3461f37da6b32773227df14779c2ea1f2b1060a317f3e1e794, 8022494B. 소스 app_tpl SHA256 b37696449d48750e52cbdb3eeb30d52c4fb6bb6a9e75b58a0f8bb6623b3f652a. 브라우저 수신 HTML과 디스크 해시 일치. 비대표98개 기존매핑은 원본과 동일하고, baseline은 불변이다.

증거 루트: 프로젝트 .omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-4/. report.md가 시나리오·명령·이진 결과·아티팩트를 연결한다. identity-review.md, negative-art-review.md, contact-sheet.png, thumbnails-72.png, export.json, build-inputs.json, playwright-final.json, preservation.json, cleanup.json을 보존했다. 실제 공방 화면 연결은 T5 범위이며 전체47장/최종번들 예산은 T21에서 확인한다.

## T21 export addendum

Preserved masters re-exported at RGB480×720 Lanczos / progressive optimized JPEG subsampling2. Root reviewed the exact compression comparisons and all47 contact faces; final browser acceptance is recorded in workspace `.omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-21/identity-review.md` and `all47-review.md`. Earlier export records remain historical.

| File | Quality | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| c_1180.jpg | 68 | 62156 | b424af7817655099fc81aed1402ac3d6f19f0c6c9929203b75a5fdb5153dc43f |
