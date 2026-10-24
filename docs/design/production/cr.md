# T8 CR 원화 제작 기록

상태: 11종 새 원화 제작·통합 빌드·실제 CR13장과72px 브라우저 검토 완료(2026-10-24).

기본 제공 image_gen으로 자산별 11회 생성하고 440W/590Y/780Y/980Y 소품을 각각1회 수정했다. 개별 원본11장, 승인 공방 시안, T4 CR S-EDDQ/1180Y master와 JPEG를 직접 확인했다. 원본 얼굴·투구·파랑·롤 문양을 지키고 따뜻한 공방 주광으로 새 장면을 제작했다. 네 초기 두꺼운 I형강은 얇은 플랜지 판금 채널로 수정했다.

작업본: 프로젝트 루트 `.omo/artwork/staging/task-8/`의 masters, prompts, rejected, optimized. `provenance.json`은 기본 제공 도구 출력 경로와 참조를 연결한다. `export.py`는 Pillow 번들 런타임으로 RGB→Lanczos480×720→JPEG quality72/optimize/progressive/subsampling2를 적용한다. 11장 합625899B, 평균56900B(55.57KiB). T4 대표2장은 유지했다.

`bash src/build.sh` exit0; `npm run verify:assets -- --group cr --require-redraw --check-built` pass(selected13); `npm test -- --project=chromium --grep '@art-cr'` 1passed. 잘못된 cardId의 임시 manifest는 binding mismatch로 exit1. 실제13카드와72px를 직접 확인했고, index/served SHA256은 ac84c29cd07efeb355048cda2a7cb8adbbf9e17566f949d2086c43ea96ab1886으로 일치했다. T8 이미지11개 외 입력 보존 및 임시 서버·캐시 정리를 확인했다. 최종 파일별 SHA/시나리오/명령/결과는 증거 report.md와 export.json에 기록한다.

상세 식별 검토와 음성 사례는 증거 루트 `.omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-8/`의 `identity-review.md`, `rejected-and-fixed.md`, `cr-contact.png`, `thumbnails-72.png`, `export.json`에 기록했다. 480×720 개별 11장과 72×108 썸네일을 직접 열어 얼굴·실루엣·문양·압축 품질을 확인했다. 같은 LV3 S-EDDQ의 펼친 코트와 1180Y의 두꺼운 갑옷, BH의 날렵한 표면 경계, MART의 각진 형체를 구별한다. 그림은 기존 USE 맥락의 시각적 표현이며 새로운 보증·물성 주장을 추가하지 않는다.

## T21 export addendum

Preserved masters re-exported at RGB480×720 Lanczos / progressive optimized JPEG subsampling2. Root reviewed the exact compression comparisons and all47 contact faces; final browser acceptance is recorded in workspace `.omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-21/identity-review.md` and `all47-review.md`. Earlier export records remain historical.

| File | Quality | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| c_980.jpg | 68 | 62825 | 86231e33a802eeca0ea7a3aad9307a7e76c29dbdb37c8cd42e080db1353868ef |
| c_1180.jpg | 68 | 62156 | b424af7817655099fc81aed1402ac3d6f19f0c6c9929203b75a5fdb5153dc43f |
