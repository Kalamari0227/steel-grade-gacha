# 기존 기능 지도

기준: `6784048524c722b7d1057cb28e372b6cce5dc6cf`. 모든 줄 번호는 이 SHA의 `src/app_tpl.html`이다. T3에서 원본 버튼·동적 핸들러를 직접 대조했다. 목적지는 승인 설계이며 태그는 후속 구현의 검증 계약이다. 태그가 적혀 있다는 사실은 테스트 통과를 뜻하지 않는다. fixture의 괄호는 격리된 로컬 상태의 필요한 변형이다. 기본 시각은 행사 밖 2026-11-01T00:00:00+09:00이며 날짜 경계는 별도다.

## 주 화면과 동적 조작

| 기존 화면 / 진입 | 버튼·핸들러와 위치 | 조건·보조 경로 | 예정 목적지 | 시작 fixture | 행동 | 기대 저장 변화 | 검증 태그 |
|---|---|---|---|---|---|---|---|
| FM001 · 홈 상태 | `stChars/stItems/stParts/stCars`, `refresh` 4170 | 발견·보증·부품·차고 진행 | 공방 | mid-progress | 공방 열기 | 진행·자원 표시, S 경제값 불변 | @home-happy |
| FM002 · 단일 출하 | `btnPull` 946/4307, `showPull` 4276 | 기본/추가 횟수, 개인 24시간·행사 한도, 결과 저장 후 연출 | 공방 | new / mid-progress | 단일 출하 클릭 | 기본 우선 pullUsed+1 또는 extra-1, owned/stock+1 저장 후 공개 | @draw-happy @draw-negative |
| FM003 · 중복 스크랩 | `btnScrap` 4293/4297 | 결과에 재고 2장 이상일 때만 표시; 1장 소모 | 공방 | mid-progress(동일 카드 재고2/1) | 결과의 스크랩 클릭 | 2이상일 때 stock-1/scrap+1, 마지막1장 보존 | @draw-happy @draw-negative |
| FM004 · LV3 확정 교환 | `btnScrap3` 948/4398, `scrapPull` 4386 | 스크랩 5개, 미발견 우선 | 공방 | completed-lv3 / mid-progress | LV3 교환 클릭 | 비용5 차감·LV3 재고+1, 미발견 우선·없으면 전체LV3, 부족 불변 | @draw-happy @draw-negative |
| FM005 · LV4 확정 교환 | `btnScrap4` 949/4401 | 스크랩 10개, 미발견 우선 | 공방 | completed-lv4 / mid-progress | LV4 교환 클릭 | 비용10 차감·LV4 재고+1, 미발견 우선·없으면 전체LV4, 부족 불변 | @draw-happy @draw-negative |
| FM006 · 10연 출하 | `btnTen` 951/4404, `tenPull` 4331 | 스크랩 20개, LV3+ 최소 1장 | 공방 | mid-progress(scrap20/19) | 10연 출하 클릭 | scrap-20·10장 저장·LV3+1장 이상, 기본/extra 불변 | @draw-happy @draw-negative |
| FM007 · 10연 결과 상세 | `.tc[data-id]` 4364/4381 | 결과 각각 `openCard` | 공방 → 도감 | mid-progress(10연 직후) | 결과 카드 클릭 | 동일ID 상세, 재추첨·재고 변화 없음 | @draw-happy |
| FM008 · 도감 계열·카드 | `dex`, `renderDex` 4206, `.cell.have` 4239 | 미발견 잠김, 발견/재고 분리, 재고 0 표시 | 도감 | new / discovered-zero-stock | 도감 열기·발견 카드 클릭 | 미발견 잠금·발견재고0 상세 가능, S 불변 | @cards-happy @cards-negative |
| FM009 · 카드 상세 | `openCard` 4527, `cardModal/cardBox` 1006 | LV·물성·적용 부품·장착 보증·대표값 주의 | 도감 | mid-progress / equipped-items | 카드 열기 | ID·계열·LV·재고·물성·사용처·보증 표시, S 불변 | @cards-happy |
| FM010 · 열처리 앞뒤 | `cardFlip` 4545/4570 | `alt`와 `IMG_ALT`가 있는 카드; 클릭/Enter/Space | 도감 | mid-progress(PHS/HPF 발견) | 클릭·Enter·Space로 앞뒤 전환 | 그림/상태/대사/수치 동시 갱신, S 불변 | @cards-happy @cards-negative |
| FM011 · QP 선행개발 입구 | `.qpdev` 4218/4225 | 발견 조건 충족 때 공개, `openDevelop` 3990 | 도감 → 공방 | qp-ready / new | 도감 QP 개발 진입 | 3선행 발견 시만 공개, 진입만으로 개발/차감 없음 | @qp-happy @qp-negative |
| FM012 · QP 후보 선택 | `.cd[data-slot][data-id]` 4016/4037 | `picks` 선택·재료/스크랩 부족 표시 | 공방 | qp-ready | 개발 재료 후보 선택 | picks 미리보기 변경만, S 불변 | @qp-happy |
| FM013 · QP 개발 실행 | `devBtn` 4026/4044 | 선행개발 1회, 해당 부품 슬롯 대체 | 공방 | qp-ready / qp-owned | 개발 클릭 | CR1470M+CR/GA1180Y와scrap10 소비·QP1회 획득, 재개발 불변 | @qp-happy @qp-negative |
| FM014 · 고객 요구 | `order`, `renderOrder` 3500 | 보유 소재와 호환·미획득 항목 기준 일일 요구 | 학습 | mid-progress / new | 학습 고객 요구 열기 | todaysOrder의 날짜/key 정상화만, 호환 후보·일일 한도에 맞는 요구 | @orders-items-happy @orders-items-negative |
| FM015 · 요구 회신 | `btnOrder` 3530/3533 → `openPick` 4074 | `.tg` 보증 선택, `judge` 4094 | 학습 | mid-progress(미획득 보증과 호환 소재) | 회신·보증 보기 선택 | 정답 items[key]=1/orderDone+1 저장, 오답 지급 없음 | @orders-items-happy @orders-items-negative |
| FM016 · 정답 후 장착/나중에 | `pkEquip/pkDone` 4105/4107 | `openPickTarget` 또는 닫기 | 학습 | mid-progress(요구 정답 직후) | 장착 또는 나중에 | 장착은 후보 UI로, 나중에는 보증 획득 유지·재고 불변 | @orders-items-happy |
| FM017 · 장착 소재 선택 | `.pk[data-id]` 4138/4150 | 호환 보유 소재만 선택; `pkDone2` 4157 | 학습 | equipped-items / discovered-zero-stock | 호환 소재 선택·확인 | items[key]=cardId 저장, 재고 소비 없음, 비호환 선택 불가 | @orders-items-happy @orders-items-negative |
| FM018 · 보증 항목 목록 | `items`, `renderItems` 3536 | 획득 전 잠김, 획득 후 `.icell` 버튼 3551 | 학습 | equipped-items / new | 학습 보증 목록 열기 | 14항목·미획득 잠금·장착 상태, S 불변 | @orders-items-happy |
| FM019 · 보증 상세 | `openCard(cid)` / `openPickTarget(key)` 3551 | 장착됨: 카드 상세; 미장착: 호환 소재 선택 | 학습 → 도감 / 학습 | equipped-items | 보증 항목 클릭 | 장착됨은 카드 상세·미장착은 호환 선택, 진입 S 불변 | @orders-items-happy |
| FM020 · 자동차 부품 35개 | `parts`, `renderParts` 3690, `.pcell` 3714 | 바디/프레임/섀시·구동, 완성/가능/부족 | 공방 | crafting-ready / crafting-short | 부품 목록·항목 클릭 | 35부품 완료/가능/부족 표시, S 불변 | @craft-happy @craft-negative |
| FM021 · 부품 상세 | `openPart` 3891, `partModal` 1010 | 후보별 재고, 소모 설명 | 공방 | crafting-ready | 부품 상세 열기 | partPlan 후보·소비·남는 재고 표시, S 불변 | @craft-happy |
| FM022 · 부품 소재 선택 | `.cd[data-slot][data-id]` 3932/3939/3957 | 기존 `picks`, QP 대체와 일반 소재 선택 | 공방 | crafting-ready / qp-owned | 슬롯 후보 변경 | picks만 변경, 허용 후보·QP 무소모 범위 유지 | @craft-happy @qp-happy |
| FM023 · 제작 실행 | `mkBtn` 3945/3965 → `craft` | 부족/완성 시 비활성, 도감 유지·재고 소모 | 공방 | crafting-ready / crafting-short | 제작 실행 | 계획된 stock 소비·parts[key] 완료, owned 보존, 부족/완료/중복 불변 | @craft-happy @craft-negative |
| FM024 · 자동차 진행 | `carBox`, `renderCar` 3724 | 남은 부품·제작 가능 수·창고 카드 | 차고 (공방 요약에서 연결) | mid-progress / all-parts | 차고 조립 진행 열기 | 35부품과 준비 수 계산, S 불변 | @garage-happy |
| FM025 · 자동차 선택 | `.carop[data-k]` 3759/3773 | 35부품 완성 후 미보유 차량 선택; 선택만으로 소모 없음 | 공방 → 차고 | all-parts / seven-cars | 미보유 자동차 선택·취소 | 선택만으로 parts/cars 불변 | @garage-happy @garage-negative |
| FM026 · 자동차 확정 | `takeCar` 3781/3784 | 차량 획득 후 부품 초기화 | 차고 | all-parts / seven-cars | 선택 자동차 확정 | cars 추가·parts 초기화, owned/stock 보존, 중복확정 방지 | @garage-happy @garage-negative |
| FM027 · 차고 8종 | `garage`, `renderGarage` 3810 | 미보유 잠김, 보유 `.gcell` 3822 → `openCar` 3835 | 차고 | seven-cars / all-cars | 차고 열기·보유차 클릭 | 8종 소유/잠김·전체완료 표시, S 불변 | @garage-happy |
| FM028 · 완성차 상세 | `openCar`, `partModal` 3835 | 그림·제조사·설명·획득일; 8종 완료 별도 메시지 | 차고 | seven-cars / all-cars | 완성차 상세 열기·닫기 | 제조사·설명·획득일 표시, S 불변 | @garage-happy |
| FM029 · 철강 퀴즈 시작 | `btnQuiz` 952/4432 → `openQuiz` 4440 | 일일 기본/행사 한도; 5문제 | 학습 | new / mid-progress | 퀴즈 시작 | 기존 일일/행사 한도 판정과 시작 시 카운트 유지 | @learning-happy @learning-negative |
| FM030 · 퀴즈 보기 | `opts` 4485/4491 | 정오답 고정 후 `showExp` 4504, 중복 제출 방지 | 학습 | mid-progress(퀴즈 진행) | 보기 선택 | 정오답 고정·해설, 중복 채점/지급 없음 | @learning-happy @learning-negative |
| FM031 · 퀴즈 다음 | `qNext` 4512/4516 | 다음 문제/결과, 전부 정답 보상 | 학습 | mid-progress(퀴즈 진행) | 다음 문제·결과 | 5문제 전부정답 때 extra=min(extra+1,quizMax()),1회만 | @learning-happy @learning-negative |
| FM032 · 퀴즈 재도전·확인 | `qRetry/qDone` 4471/4474 | 남은 횟수가 있을 때 재도전 | 학습 | mid-progress(퀴즈 결과) | 재도전 또는 확인 | 남은 한도에서만 재시작, 확인 추가 지급 없음 | @learning-happy @learning-negative |

## 공통 설정·공지·저장·웹툰

| 기존 진입 | 버튼·핸들러와 위치 | 보조 경로·조건 | 예정 목적지 | 시작 fixture | 행동 | 기대 저장 변화 | 검증 태그 |
|---|---|---|---|---|---|---|---|
| FM033 · 공지 띠 | `noticeGo` 3152/3160 → `openNotice` 3174 | 신규 공지 자동 팝업, 행사 병합 띠, `noticeX/noticeOk` 3194 | 공방 / 설정 | mid-progress / promo-boundaries | 공지 열기·확인/닫기 | 기존 noticeSeen 갱신, 경제값 불변 | @home-happy @navigation-happy |
| FM034 · 기간 한정 행사 | `renderPromo` 3035, `openPromo` 3247 | 예고/진행/종료, 자동 안내, `promoGo` 3262 / `promoX` 4934 | 공방 / 설정 | promo-boundaries | 행사 자동안내·확인/닫기 | 기간·기존 promoSeen/promoDone 보존, 같은 공지띠 병합 | @home-happy @home-negative |
| FM035 · 뽑기 알림 | `btnBell` 953/4616, `renderBell` 2850 | 지원·권한·ON/OFF; 명시 클릭 시 권한 요청 | 설정 | mid-progress(허용/거부/미지원) | 알림 클릭 ON/OFF | 명시 동작 후만 권한 요청, bell/belledAt 기존값 규칙·거부 시 가짜ON 없음 | @storage-happy @storage-negative |
| FM036 · 알림 토스트 | `toast/toastX` 1001/4612 | `showToast` 2880, 갱신/행사·저장 안내 | 공통 | mid-progress | 토스트 닫기 | 토스트 표시만 닫음, S 불변 | @navigation-happy |
| FM037 · 저장 경고 | `storeWarn`, `renderStoreWarn` 2933 | localStorage/IDB 실패, `warnGo` 2948 → 백업 | 설정 | mid-progress(저장 거부) | 저장 경고의 백업 열기 | 실패 명시·SGG1 접근, 진행 초기화 없음 | @storage-negative |
| FM038 · 백업·복원 | `btnBackup` 993/4764 → `openBackup` 4671 | `backupModal` 1031, SGG1 출력, `bkWhen` 최근 백업 표시 | 설정 | mid-progress / legacy-save | 백업 열기 | makeCode와 진단 표시, 열기만으로 경제값 불변 | @storage-happy |
| FM039 · 백업 코드 복사 | `bkOut/bkCopy` 4681/4718 | Clipboard API와 복사 fallback, 저장 시각 | 설정 | mid-progress | 코드 복사 | 성공 시 backupAt만 기록, 실패 시 수동복사 안내 | @storage-happy @storage-negative |
| FM040 · 백업 코드 복원 | `bkIn/bkLoad` 4692/4743 | 읽기/형식 검증, 복원 버튼에서 즉시 적용(별도 확인창 없음), `bkRes` 결과 | 설정 | legacy-save / corrupt-code | 코드 입력·복원 클릭 | 유효 코드 applyCode/refresh, 손상 입력은 상태 불변·오류 | @storage-happy @storage-negative |
| FM041 · 저장 진단 | `bkDiag`, `storeDiag` 4699 | 실행 방식·localStorage·IndexedDB·영구 저장·주소 | 설정 | mid-progress(정상/거부 저장) | 백업의 진단 읽기 | 실행/LS/IDB/persist/주소 상태 표시, 진행 불변 | @storage-happy @storage-negative |
| FM042 · 진행 초기화 | `btnReset` 996/4768 | 기존 5초 내 두 번 확인. 원본 누락 필드 결함은 T2에서 별도 재현·수정 | 설정 | reset-ready | 첫 클릭·5초 만료·두 번째 확인 | 기존 확인 유지,6누락필드 정상화·bell/promoSeen/promoDone와웹툰읽음 유지 | @reset-happy @reset-negative |
| FM043 · 웹툰 목록 | `btnToon` 932/4909 → `openToon` 4844 | `toonModal` 1038, NEW·별도 읽음 키 | 학습 | new / mid-progress | 학습 웹툰 목록 열기 | 3항목·NEW 표시, 목록만으로 읽음 변경 없음 | @webtoon-happy |
| FM044 · 웹툰 에피소드 | `.ep[data-i]` 4850/4912 → `openToonView` 4869 | 연재 안내/1화/2화, 페이지 15장 + 썸네일 3장 = WebP 18개 | 학습 | mid-progress | 각 회차 열기 | 기존 TOON_SEEN 증가 규칙·15페이지와3썸네일 decode, S 경제값 불변 | @webtoon-happy @webtoon-negative |
| FM045 · 웹툰 목록 복귀 | `toonBack` 1047/4923, `[data-go=list]` 4883/4916 | 뷰어에서 목록 재개 | 학습 | mid-progress(웹툰 뷰어) | 목록 복귀 | 회차목록·초점 복귀, 읽음 되돌림 없음 | @webtoon-happy |
| FM046 · 웹툰 앞뒤 회차 | `[data-go]` 4882/4916 | 첫/마지막에서 비활성 | 학습 | mid-progress(첫/중간/끝 회차) | 이전/다음 클릭 | 경계 비활성·기존 읽음 증가 규칙, S 불변 | @webtoon-happy |
| FM047 · 웹툰 닫기 | `toonX` 4910, `toonViewX` 4924 | 목록/뷰어 각각 닫기, Escape 지원 | 학습 | mid-progress(웹툰 열림) | 닫기·Escape | 본문스크롤 잠금 해제·원래초점, 읽음 유지 | @webtoon-happy @keyboard-happy |
| FM048 · 모달 닫기 공통 | `cardX/pickX/partX/quizX/backupX/noticeX/promoX` | 각 close 함수, 배경 클릭 4585–4597/4791/4911/4929/4933, Escape 4599, 원래 초점 복귀 | 공통 | mid-progress(각 모달 열림) | X·배경·Escape·뒤로가기 | 해당 close·초점 복귀·잠금 해제, 표시 이외 상태 불변 | @navigation-happy @navigation-negative @keyboard-happy |
| FM049 · 설치 안내 | `btnInstall` → `src/pwa_body.txt:190` | 설치 banner, 앱내 브라우저·iOS·Android·PC 안내 | 설정 | new | 설치 안내 열기 | 브라우저/플랫폼 맞춤 안내, S 불변 | @storage-happy |
| FM050 · 설치 / 방법 보기 / 접기 | `installGo`, `pwa_body.txt:174` | beforeinstallprompt 있으면 설치, 없으면 안내 펼침 | 설정 | new(설치prompt 있음/없음) | 설치 또는 방법 펼치기·접기 | 지원되면 명시 사용자 prompt, 없으면 안내, S 불변 | @storage-happy @pwa-negative |
| FM051 · 설치 플랫폼 탭 | `[data-t=ios/android/pc]`, `pwa_body.txt:131/137` | 안내 내용 전환 | 설정 | new | ios/android/pc 탭 | 안내만 전환, S 불변 | @storage-happy |
| FM052 · 설치 안내 닫기 | `installX`, `pwa_body.txt:168` | dismiss 저장, footer로 다시 열기 | 설정 | new(설치 안내 열림) | 닫고 footer로 재진입 | 기존 dismiss 저장만, S 불변 | @storage-happy |

## 버튼 이외에 보존할 경로

- 저장: `applySaved/load/save/bootRestore/makeCode/readCode/applyCode` (2474–2813), localStorage/IndexedDB 복구와 기존 필드 정규화.
- 날짜·시간: 개인 출하 주기, 일일 퀴즈·요구 한도, PROMOS 경계, timer/visibilitychange(4972) 갱신.
- PWA: `sw.js` v72, navigation network-first, 이미지 캐시, 설치 등록(`pwa_body.txt:52`), 본 적 있는 웹툰의 오프라인 재열람.
- 행사와 공지가 동시에 있으면 하나의 공지 띠에 행사 내용을 합친다. 행사 띠 자체는 클릭 버튼이 아니다.
- T1 실제 진입 증거는 task-1의 `browser-*.txt`와 `*-screen.png`. T1은 진입 관찰이며 전 경제·저장 회귀는 T2 이후의 책임이다.
- 실제 관찰 포트는 4191. 계획의 4173은 다른 프로젝트의 기존 서버가 점유해 그대로 보존했다. 후속 테스트 예정 포트는 현재 앱 4273, baseline 4274, PWA 4280이다.

## 이벤트 없는 보존 경로와 새 표시 조작

| 기존 요소·함수 / 새 UI | 목적지 | 시작 fixture | 행동 | 기대 저장 변화 | 검증 태그 |
|---|---|---|---|---|---|
| FM053 · applySaved/load/save/bootRestore/makeCode/readCode/applyCode | 공통 / 설정 | legacy-save / mid-progress / corrupt-code | 로드·저장·재로드·복원 | 기존 LS/IDB 우선순위·SGG1·정규화, 유효 진행 유지 | @storage-happy @storage-negative |
| FM054 · timer/visibilitychange, pullRenewed, todaysOrder | 모든 view | promo-boundaries / mid-progress | 숨김→복귀·자정·24h/행사 경계 | 원본 시간/일일 정상화만, 추가 지급 없음 | @home-negative @storage-happy |
| FM055 · sw.js install/activate/fetch + pwa_body 등록 | 공통 | mid-progress / qp-owned / equipped-items | old→new update·offline reload | 같은 origin 진행·웹툰 별도 읽음 보존 | @pwa-upgrade-happy @pwa-negative |
| FM056 · 새 네 목적지 hash + 설정 진입 | 공방/도감/학습/차고/설정 | new / mid-progress | 왕복·새로고침·뒤로·잘못된 hash | 화면 위치만 전환, 경제값 불변 | @navigation-happy @navigation-negative |
| FM057 · 새 추천 부품 CTA | 공방 → 부품 상세 | crafting-ready / crafting-short / all-parts | 추천 열기 | 소비 전 상세로, 불가 시 부족 안내, 완성 시 차 선택 | @home-happy @home-negative |
| FM058 · 새 도감 필터·clear·적용부품 표시·제작 진입 | 도감 / 카드 상세 → 공방 제작 상세 | discovered-zero-stock / mid-progress / crafting-ready / qp-owned | 필터·해제·사용처 확인·소재 후보 부품 선택·기존 제작 상세 | 목록·선택·취소는 S/저장 불변, 기존 제작 확정만 원래 비용 소비, 미발견 공개범위 보존 | @cards-happy @cards-negative @cards-craft |
| FM059 · 새 skip·전체결과·사용자 상세 넘김 | 공방 → 도감 | mid-progress(결과 저장 직후) | skip·닫기·reload·다음 카드 | 기존 저장된 결과만 표시, 재추첨/중복 지급 없음 | @draw-happy @draw-negative @reduced-motion |
| FM060 · 새 학습·웹툰 소재 연결 | 학습 ↔ 도감 | mid-progress | 해설/캐릭터 소개→카드→원래 위치 | S 불변·기존 웹툰 읽음 규칙만 | @learning-happy @webtoon-happy |

원본 DOM의 자동 load/beforeinstallprompt/appinstalled는 설치 행과, visibilitychange는 시간 행과 연결된다. 동적 `.tg`(요구 정답)와 `.pk`(장착 대상)는 다른 행동이다. `partX`는 부품·QP·차 상세에서 재사용하고 모든 close/배경/Escape는 공통 닫기 행에서 함께 검증한다. 공지 읽음·행사 일일 적용·날짜 정상화는 기존 함수가 저장할 수 있으므로 화면 이동 전체를 무조건 S 완전불변으로 단언하지 않는다.

제품 회귀 실행은 T2 및 각 구현 작업 소유다. 이 문서의 직접 검토는 52개 기존 화면/행동 행 + 8개 보존/신규 표시 경로의 대응이며, 누락 검사 증거는 T3 `coverage-review.md`와 `gap-check.md`에 둔다.

## 최종 검증 연결

FM001–FM060은 위 52개 기존 동작과 8개 보존/신규 표시 동작의 고정 ID입니다. 실제 최종 case/project/runtime ID·해시·첨부 연결은 작업공간 외부 증거 `E/task-23/feature-bindings.json`과 `E/delivery-manifest.json`에 기록합니다. 문서의 태그나 ID만으로 실행 통과를 주장하지 않습니다. 전체 검증 실행 전에 이 문서를 고정하며 실제 결과 경로를 채우기 위해 실행 후 이 파일을 바꾸지 않습니다.
