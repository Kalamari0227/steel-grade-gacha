# T9 GA 13종 제작 기록

상태: 승인된 13종 JPEG live 통합 완료. GA14상태 실제 브라우저·HPF전후·72px 검토와 자산검사 통과. T4 dogeum 및 다른 입력은 보존했다.

기본 제공 image_gen 도구만 사용해 개별 신규13회와 DDQ소품수정1회를 수행했다. 원본13종과 T4 dogeum.jpg를 직접열었고 각원본을 정체성, dogeum을 스타일 참조로 전달했다. HPF후에는 새HPF전master를 추가참조하여 같은얼굴·몸비율·경계선을 유지했다. 유료API/CLI대체 없음. master는 프로젝트루트 .omo/artwork/staging/task-9/masters, 정확한프롬프트는 prompts, JPEG는 optimized, 생성출처/원본/master/final SHA는 provenance.json에있다. 반려DDQmaster는 rejected에보존했다.

Pillow RGB→Lanczos480×720→JPEG quality72/optimize/progressive/subsampling2. 번들Python /Users/ethanlee/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3으로 export.py 실행.13장합708453B,평균53.22KiB. T4 dogeum.jpg는변경하지않았다.

| 파일 | ID:side | 최종후보SHA256 | bytes |
|---|---|---|---:|
| g_dq.jpg | ga-270D:front | f0a8c2d552a9e0365cd15493245e34272889af16ab2be90f941f48fdf7688d09 | 49818 |
| g_ddq.jpg | ga-270E:front | 6bdd205297c56a73cd7aa1c7d31c87f5e0e0607bb1c71748da770b8bd5f3a963 | 53506 |
| g_eddq.jpg | ga-270F:front | 0077e9fea31f694ed13e5a1426b8ce7d277dfc5d775af0be87c3427e29df1f01 | 51605 |
| g_seddq.jpg | ga-SEDDQ:front | 37a4806b64ce406c492cc80b79167ca5bd801aaf8ac7dd8a579bc9be50701060 | 59640 |
| ht_1.jpg | ga-440W:front | 9d5d2c6b01c1df3ee5b204e4859086cbfc21c83878da8972fda80ea537a4f6b9 | 50018 |
| y590_c.jpg | ga-590Y:front | df0ebeb70a957ffe05e68a31fc43b99311d0b77645ca90671812668b0858ad94 | 54813 |
| n780_1.jpg | ga-780Y:front | e48ea0a0a345ee706af17156d3868f6d0dc84fad1a79ab13aa69612dcf9e07a1 | 56362 |
| g_980.jpg | ga-980Y:front | a5852c9500d4ee69eea18505272c1f2f157986011c0100ad135ba451ad2a0f52 | 62149 |
| g_1180.jpg | ga-1180Y:front | 83f272111e6bfac05b7e75e2d6b5ea57a14792459135c9aac0b0f4539749a472 | 65129 |
| g_340w.jpg | ga-340W:front | d2e5fa3e5aa066cf8b51affb3b842dab99019d9b807836d03957beb2842beedc | 52153 |
| g_bh.jpg | ga-340H:front | 5e8b33029c4ec35268b2d7165f52636bd395804f98cdf22d35eb275f50032bc0 | 52281 |
| g_hpf_a.jpg | ga-1470H:front | dc86da03c96de4a0287636d86a88d32de3a73b628c684b00bc9428ae3daf308a | 48576 |
| g_hpf_b.jpg | ga-1470H:alt | 429fa6d05a01f54f38315176b7590ceb00a2d8448766dade322cbdb6ac2b56c0 | 52403 |

각원본의표정·투구·계열색·가슴육각가로띠와옷/갑옷차이를유지했다. 성형용의유연한로브와고장력의분절갑옷이구별되고소부경화강은도장맥락이다. 구조부품은얇은프레스판재의리브·플랜지·체결구멍을보이며두꺼운건축용형강/주물로묘사하지않았다. HPF전후는같은인물·문양·표면경계이며도금층이연속으로남는다. no-text/no-frame조건과480px/72px식별을모두직접검토했다.

검증증거: 프로젝트 .omo/evidence/ulw/01a16bac-755d-7181-a195-d74847a6c74d/G001-implement-the-approved-plan-at-users/a1/task-9. ga-contact.png, thumbnails-72.png, hpf-pair.png, identity-review.md는 원화 검토 기록이다. live `npm run verify:assets -- --group ga --require-redraw --check-built`는 104매핑/47카드/18웹툰/선택14개 PASS, `npm test -- --project=chromium --grep '@art-ga'`는 1 passed(14상태)다. 실제 카드14장을 개별 직접 확인했고 ga-contact-browser.png, thumbnails-72-browser.png로 앱의 정확한 IMG/IMG_ALT를 검토했다. 별도 fixture의 HPF 앞뒤 경로교환은 exit1/binding mismatch로 거부됐다. 명령·결과는 report.md, assets-live.json, art-ga.json, private-verification.json에 있다. 임시 fixture와 자체 서버/브라우저는 정리했다.

빌드·브라우저 동일 index SHA256 `f2f3d4e07d780394187d12e524dba6d8ae0c161b8f68449e14992ef421a56e89`, 8,475,728B. 템플릿 SHA `592a99dd78bef51c34617718e32885393909d8f5e20502b8101a8d187f77b01e` 보존. preservation.json은 정확히13이미지와생성index/manifest 외 입력변경 없음을 기록하며 manifest-preservation.json은13행의 finalSha256/reviewStatus/reviewEvidence만 바뀌고 originalSha256이 전부 보존됐음을 확인한다.

