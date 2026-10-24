# T7 PO 나머지 6종 제작 기록

상태: 기본 제공 image_gen 도구로6종 개별 신규 생성·소품3종 수정, live 반영·PO9종 브라우저 검수 완료(2026-10-24).

각 원본은 src/img/{p_dq,p_ddq,p_370w,ht_2,y590_b,n780_3}.jpg를 개별로 직접 열었고 원본 정체성 참조로 사용했다. 불변 원본은 .omo/baseline/site/src/img 아래에 남는다. 승인 시안 reference/02-card-phs.png와 T4 poo.jpg를 직접 열었고 T4 poo.jpg를 스타일 참조로 각각 전달했다. 정확한 원문 프롬프트는 프로젝트 루트 .omo/artwork/staging/task-7/prompts/*.txt, 기본 도구 출력 복사본은 masters/*.png, 최종 후보는 optimized/*.jpg, 출처·SHA는 provenance.json에 있다. 개별 신규 생성6회와 소품 수정3회, 총9회이며 유료 API/CLI는 사용하지 않았다.

Pillow RGB→Lanczos480×720→JPEG quality72/optimize/progressive/subsampling2로 출력했다. export.py 실행은 번들 Python /Users/ethanlee/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3을 쓴다. 6장 합331386B, 평균55231B(53.9KiB). 480×720개별 파일과 PO9종 이름 없는 비교·72×108축소를 직접 열어 검토했다.

| 파일 | 원본 정체성·새 장면 | 최종 SHA256 | bytes |
|---|---|---|---:|
| p_dq.jpg | 둥근 눈·미소·방울머리·짧은 아이보리 라펠 조끼, 휠 림 성형재 | a182913487196f6c93ab7a635dcb91d564518d647f541994cae1e979b95e4a6e |54260|
| p_ddq.jpg | 둥근 눈·미소·방울머리·겹어깨/긴 라펠 튜닉, 오일 팬 | 3a8081a35d060be468cd4e32f7d57a9638e616cea563baeac295a66b14b77bf6 |52381|
| p_370w.jpg | 은색 분할 능선·작은 미소·다수 리벳/각 어깨, 구조부재 작업대 | de6d1b4fc30211993281c4fa4364dfe9aa26e926c6248327253e372989b5053e |54504|
| ht_2.jpg | 은색 분할 능선·둥근 어깨·큰 리벳·사각 벨트, 로어 암 | d7d003f72656004a8908f9ce335d7e4b872787bdd426f5a81e734882ac1d8765 |54795|
| y590_b.jpg | 은색 투구/다리·은색 노출된 붉은 흉갑/전완 보호대, 휠 디스크 | 3ccc114b04bf97675c0d825825241e940074cef5c71d97817e8d496500333082 |54354|
| n780_3.jpg | 붉은 투구/전신 갑옷·은색 노출 무늬·둥근 눈, 서브프레임/로어 암 | 67b8f6588e7895aca9ec154afe876e5dd47e33c5fdd808de66c0e1b3a8eaef49 |61092|

모든 새 원화는 은색 얼굴, 붉은 PO 계열색, 산화면/금속면 세로 분할 원과 중앙 물방울을 유지한다. DQ/DDQ의 유연한 조끼·자세는 고장력 갑옷과 구별된다. 원래 서로 다른 표정과 투구는 CQ 표정으로 통일하지 않았다. 공방 배경·재질·조명을 통일하되 USE의 적용 맥락만 표현하고 TS/EL/LV에 새 주장을 추가하지 않았다. 글자·UI·프레임·워터마크가 없으며 원본 필터/리사이즈가 아닌 새 장면이다.

증거 루트: 프로젝트 .omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-7. export.json에 원본/master/final SHA와 도구 출처가 있다. po-contact.png·thumbnails-72.png는 최종후보 직접 검토용이며 po-contact-browser.png·thumbnails-72-browser.png는 실제 앱에서 추출한 이미지다. negative-manifest-summary.json은 별도 manifest의 누락 경로·이름 교환이 모두 명시 오류로 거부된 결과다. build exit0, verify:assets --group po --require-redraw --check-built pass(104매핑/47카드/18웹툰/선택9), @art-po 1passed.9개 실제카드 캡처를 모두 직접 검토했다. index SHA dc4d1911d0ab7983878e29a592a97c23b16c2b481092dd96ac39d63417ad8f55,8101824B이며 브라우저 수신해시가 일치한다. report.md가 시나리오/명령/이진결과/증거를 연결하고 cleanup.json에 자체브라우저·서버 종료를 기록한다.

