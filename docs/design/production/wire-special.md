# T10 선재·EG·QP 원화 제작 기록

상태: 선재9·EG1·QP1의 새 원화, JPEG/72px 검토, 통합 빌드와 실제 브라우저 검토 완료.

기본 제공 image_gen을 자산별11회 사용하고 SUJ의 잘못된 동심원 문양을 연속 나선으로1회 수정했다. 모든 개별 원본과 승인된 공방/CR 스타일을 직접 열어 확인했다. 큰 고리 안의 얼굴, 코일·꼬임선·스프링·볼·나사 몸체 등 기존 체형을 보존했다. EG의 청록 도금/은색 비도금 분할과 머리 부품·탱크 몸체, QP의 접힌 청남색 후드·세로 결정·은색 띠를 유지했다. 선재 RA를 EL로 바꾸는 표현과 QP 일반 출하 암시는 추가하지 않았다.

원본 작업물은 프로젝트 `.omo/artwork/staging/task-10/`의 masters/prompts/provenance.json/rejected/optimized에 보관했다. export.py는 RGB→Lanczos480×720→JPEG quality72/optimize/progressive/subsampling2 규격이다. 11장 합679724B, 평균61793B(60.34KiB). 세밀한 선재·케이블을 포함한 집합으로 실제480px 및72px에서 얼굴·고리·나선·도금 경계를 직접 확인했다.

증거: 프로젝트 `.omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-10/`의 report.md, export.json, identity-review.md, rejected-and-fixed.md. 파일별 최종 SHA는 export.json에 기록한다.

독점 통합 구간에서 지정 JPEG11개와 manifest 해당11행만 갱신하고 src/build.sh로 빌드했다. 전체 originalSha25647개와 다른 manifest36행 보존을 manifest-preservation.json에 기록했다. 자산 검사104매핑/47카드/18웹툰/선택11 통과, @art-wire-special1개 및 전체 계약50개 통과(실패·skip0). 실제11개 카드와 같은 앱 이미지의 contact/72px를 직접 검토했다. POOL44/QP제외 및 선재9 RA는 identity-pool.json에서 확인한다.

최종 index/served SHA-256: `1c359736094c10d504583c52256ff4d384cbffd121f391318081f8dcd62c1e67` (8722084B). 현재 UI 소스592a99dd78bef51c34617718e32885393909d8f5e20502b8101a8d187f77b01e와 모든 비담당 빌드 입력이 유지됐다. 브라우저·4273/4274서버·작업 임시 캐시 정리 완료. 전체47장 합산 용량/성능 최종 검토는 T21 범위다.

## T21 export addendum

Preserved masters re-exported at RGB480×720 Lanczos / progressive optimized JPEG subsampling2. Root reviewed the exact compression comparisons and all47 contact faces; final browser acceptance is recorded in workspace `.omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-21/identity-review.md` and `all47-review.md`. Earlier export records remain historical.

| File | Quality | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| wr_cord.jpg | 69 | 64365 | ece7c6a8bc363ba12c7e6e37b819981adab52056e59606d42f7bef14bd558647 |
