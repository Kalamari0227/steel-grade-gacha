# 게임 화면·상태 명세

이 문서는 현재 게임 소스의 조작·상태 계약이다. 소스 연결 자체는 전체 통합 검사 완료나 경제 테스트 통과를 뜻하지 않는다. [전체 기계 목록](game-screen-inventory.json)의 FM001–FM060은 기존 기능, GAME001–GAME014는 현재 소스에 연결된 게임 표시·설정 추가다. 기존 feature-map의 교육판 목적지는 이 문서의 게임 목적지로 재매핑한다. 모든 항목의 success/empty/loading/error/disabled는 JSON에 명시한다.

## 화면 간 복귀 계약

공방 → 출하 결과 → 도감 카드 → 연구 보증/장착 → 제작 검토 → 차고를 연결한다. 카드/보증/QP의 별도 진입도 caller route·선택 ID·스크롤·초점을 기억한다. QP는 연구에만 있으며 도감·제작에서 진입하면 `제작대로 돌아가기` 또는 `도감으로 돌아가기`로 원래 패널을 복원한다. 웹툰 → 도감 → 웹툰은 회차·스크롤을 보존한다. 설정은 모든 탭 위의 대화상자이며 닫으면 그 탭의 설정 버튼에 초점을 반환한다. #learn/#learning은 #research로 replaceState한다. Back/Forward는 결과를 재실행하지 않는다.

## 화면별 구체 상태

각 프로필의 다섯 상태는 아래 기능 행에 적용한다. 예: FM023 제작 실패는 일부 슬롯을 먼저 소비하지 않으며, FM040 복원 실패는 진행을 교체하지 않는다.

### status

- **성공**: 실제 발견/재고/기본·추가 출하/스크랩·부품·차량 수 표시.
- **빈 상태**: 신규는 0과 첫 출하 안내; 무료 카드·차량 없음.
- **로딩**: 저장 복원 중 숫자 자리 유지, 결과 조작 대기.
- **오류**: 저장 실패는 경고와 백업 연결, 메모리 결과 유지.
- **비활성**: 한도·시간은 실제 함수로 계산, 불가 행동에 이유.

### draw

- **성공**: 소비·지급·저장 시도 후 공개; 신규/중복 및 10장 전체 결과.
- **빈 상태**: 획득0이면 첫 출하 안내, 후보없음이면 차감0.
- **로딩**: 개봉 중 바로 결과 보기/닫기 가능; 재실행 잠금.
- **오류**: 아트/음향 실패도 확정 결과 텍스트 제공, 재추첨 없음.
- **비활성**: 1회 잔여0·10연 scrap<20·진행중은 이유와 대안.

### scrap

- **성공**: 재고2 이상에서 stock-1/scrap+1.
- **빈 상태**: 재고0 결과 행동 없음.
- **로딩**: 처리중 재클릭 잠금.
- **오류**: 현재 재고 재검증 실패는 차감0.
- **비활성**: 마지막 1장은 스크랩 불가.

### exchange

- **성공**: LV3=5/LV4=10; 미발견 우선, 전부 발견이면 동일LV 전체 후보.
- **빈 상태**: 후보없음은 교환불가·소비0.
- **로딩**: 확정 결과 공개 중 이중교환 차단.
- **오류**: 저장 실패 경고와 결과 유지.
- **비활성**: 비용 부족이면 현재/필요 스크랩 표시.

### card

- **성공**: 발견 카드의 ID/LV/TS·EL 또는 RA/사용처/보증/재고 표시.
- **빈 상태**: 미발견 잠금; 발견 재고0은 상세 유지; 필터0은 해제.
- **로딩**: 개별 아트 자리 유지와 상태 안내.
- **오류**: 그림 실패 시 이름·문양/계열·물성+재시도.
- **비활성**: 미발견 대표 선택 불가, alt 없는 뒤집기 숨김.

### flip

- **성공**: PHS/HPF 동일 ID의 그림·상태·물성·대사 함께 전환.
- **빈 상태**: alt 없는 카드는 단면으로 표시.
- **로딩**: 뒤집기 중 최신 선택 면 일치; 감소모션 즉시.
- **오류**: alt 이미지 실패에도 면 설명·재시도 제공.
- **비활성**: alt 없는 전환 불가; 재고/물성 원본값 불변.

### qp

- **성공**: CR1470M+CR/GA1180Y+scrap10 소비; QP1회, 허용 슬롯 무소모 대체.
- **빈 상태**: 선행 3발견 부족은 공개조건 안내.
- **로딩**: 검토는 소비0; 확정후 개발 결과만 표시.
- **오류**: 후보/재고 변경 시 다시 계산·부분소비0.
- **비활성**: 이미 개발·scrap9·필수재고0은 개발불가.

### order

- **성공**: 당일 실제 요구14종 중 선택; 정답 보증+orderDone1.
- **빈 상태**: 호환 보유 소재/미획득 보증 없으면 이유·도감 연결.
- **로딩**: 답 처리중 재답변 차단.
- **오류**: 오답 해설·지급0; 재진입으로 중복 지급 없음.
- **비활성**: 한도완료/동일답 중복 제출 차단.

### equip

- **성공**: 획득 보증 유지; 호환 발견 소재에 items[key]=cardId, stock 불변.
- **빈 상태**: 미획득 잠금/호환후보0 안내.
- **로딩**: 미리보기는 저장0, 장착확정 때 현재 호환/소유 재검증.
- **오류**: 미호환·이미사용·변경된 보증은 확정0, 기존 장착 유지.
- **비활성**: 장착해제/재배치/슬롯상한 없음; 이미 장착된 보증 재사용 불가.

### craft

- **성공**: 35부품 원본 partPlan picks대로 stock소비/parts기록, owned유지.
- **빈 상태**: 제작가능0: 부족 슬롯·도감/출하 링크.
- **로딩**: 검토는 소비0; 작업 연출 전 결과 저장시도.
- **오류**: 한 슬롯 부족/중복 실행/변경 재고면 부분소비0.
- **비활성**: 완료·부족이면 확정불가, QP는 허용 슬롯만 무소모.

### garage

- **성공**: 35부품 후 미보유8차종 중1확정; cars추가·parts초기화.
- **빈 상태**: 차량0은 덮개/도구와 제작 연결, 거짓 완성차 없음.
- **로딩**: 조립전 선택/취소 소비0; 확정후 연출 스킵 가능.
- **오류**: 34부품/보유차/재확정은 소비0·이유 표시.
- **비활성**: 8종완료는 완료 문구, 새 차/보상 없음.

### quiz

- **성공**: 413문항 중 기존5문제, 정오답·해설; 5정답 extra=min(extra+1,quizMax()) 1회.
- **빈 상태**: 남은기회0은 회복시각/연구 다른활동.
- **로딩**: 답변 후 해설/다음만, 중복 채점 금지.
- **오류**: 오답 설명과 관련 소재, 추가출하 지급0.
- **비활성**: 제출 완료한 보기·한도없는 재도전 비활성.

### notice

- **성공**: 공지/행사/출하알림 실제 상태와 닫기; 원본 읽음/한도 규칙.
- **빈 상태**: 공지/행사없음은 없음 표시.
- **로딩**: 권한 요청/정보갱신 중 중복 요청 금지.
- **오류**: 거부·미지원·저장경고를 사실대로 표시.
- **비활성**: 권한 요청은 명시 클릭만, 가짜 ON 금지.

### backup

- **성공**: 게임용 SGG-GAME1. 백업·요약·회복코드·명시 교체; export는 진행만.
- **빈 상태**: 백업 미생성은 없음; 입력빈값 오류.
- **로딩**: 진단/검증 중 교체 잠금; 적용전 취소는 진행불변.
- **오류**: 형식/버전/ID/호환/수량/256KiB 초과 거부; 복사실패 수동복사.
- **비활성**: 교육 SGG1.은 전용 가져오기만; 자동이전/병합 없음.

### reset

- **성공**: 5초 내 두번째 명시확정만 게임진행 초기화.
- **빈 상태**: 신규 진행이면 초기화할 내역없음.
- **로딩**: 첫 확인 대기시간 표시, 취소/만료는 불변.
- **오류**: 저장 실패 경고와 백업 접근, 조용한 초기화 금지.
- **비활성**: 만료 뒤 클릭은 다시 첫확인; 교육 저장 접근 금지.

### toon

- **성공**: 3항목/15페이지+3썸네일=18WebP; 기존 읽음 규칙.
- **빈 상태**: 연재안내도 실제 항목, 새회차 없음.
- **로딩**: 페이지별 로딩 텍스트, 목록·닫기 유지.
- **오류**: 이미지 실패/미캐시 오프라인은 재시도; 거짓 읽음 완료 없음.
- **비활성**: 첫/마지막 회차 이전/다음 비활성.

### navigation

- **성공**: 5route/별칭 정규화·Back/Forward·refresh·focus복귀.
- **빈 상태**: 잘못된 hash는 공방, 빈목록 초점은 제목.
- **로딩**: 전환중 닫기/취소 유지, 숨은화면 초점 제외.
- **오류**: 누락아트에도 실제 링크/텍스트 사용가능.
- **비활성**: 중복 모달열기 차단, 동작중 해서는 안되는 확정 잠금.

### install

- **성공**: 명시 설치 또는 플랫폼별 방법, 닫고 재진입.
- **빈 상태**: prompt없음은 방법 보기.
- **로딩**: 설치 대기에도 닫기 제공.
- **오류**: 미지원/거부는 안내, 설치성공 날조 없음.
- **비활성**: 사용자제스처 없는 권한/설치요청 없음.

### offline

- **성공**: 현재+이전 사용가능 release 유지, 유휴시 업데이트 안내.
- **빈 상태**: 최초 미캐시는 재연결 안내.
- **로딩**: 필수shell 준비 전 기존앱 유지.
- **오류**: 부분 이미지 재시도·오디오 무음, 실패 캐시 정상취급 금지.
- **비활성**: 출하/가져오기 중 강제갱신 금지.

### audio

- **성공**: 사용자 소리켜기 이후 BGM/SFX 독립음량·mute 저장.
- **빈 상태**: 첫 방문 무음/무음으로 계속.
- **로딩**: 재생 준비 중 결과 UI 정상진행.
- **오류**: resume/decode 실패는 탭복구·무음 결과.
- **비활성**: mute/숨김은 소리중단; 놓친 결과 재생 안함.

## 기존 기능의 진입·복귀·소스 대응

프로필은 해당 흐름 전체의 빈 상태/로딩/오류/비활성 계약이며, 각 행의 성공 관찰은 그 조작에만 해당한다. 검토·선택·보기와 소비를 확정하는 행동을 구분한다.

| ID / 조작 | 단일 목적지 / 진입 | 복귀 | 소스 함수·조작 / 상태 | 성공 관찰 |
|---|---|---|---|---|
| FM001 · `status` | `#workshop` · 공방 열기 | 공방 상태 요약 | renderHomeStatus / pullBaseLeft / homeBase / homeExtra / homeScrap · status | 실제 기본/추가 출하·스크랩·발견·보증·부품·차량 수 표시, 경제값 불변 |
| FM002 · `draw-one` | `#workshop` · 1회 출하 | 공방 출하 버튼 | showPull / pullsLeft / btnPull · draw | 기본 우선 pullUsed+1 또는 extra-1, owned/stock+1 저장 시도 뒤 결과1장 공개 |
| FM003 · `draw-scrap` | `#workshop` · 출하 결과 → 한 장 스크랩으로 | 공방 결과 | stockOf / btnScrap / data-draw-scrap · scrap | 재고2 이상에서 stock-1/scrap+1 |
| FM004 · `exchange-lv3` | `#craft` · 스크랩 교환 → LV3 | 제작 교환 패널 | scrapPull / missingIn / btnScrap3 · exchange | LV3=5/LV4=10; 미발견 우선, 전부 발견이면 동일LV 전체 후보 |
| FM005 · `exchange-lv4` | `#craft` · 스크랩 교환 → LV4 | 제작 교환 패널 | scrapPull / missingIn / btnScrap4 · exchange | LV3=5/LV4=10; 미발견 우선, 전부 발견이면 동일LV 전체 후보 |
| FM006 · `draw-ten` | `#workshop` · 10연 출하 · 스크랩20 | 공방 출하 버튼 | tenPull / tenReady / btnTen · draw | scrap20 소비·10장 재고 지급·LV3 이상 최소1장, 기본/extra 불변 |
| FM007 · `draw-card` | `#dex` · 10연 결과에서 카드 선택 | 공방 결과 선택 카드 | openCard / showTen / data-draw-detail · card | 선택 결과의 동일 ID 상세를 열고 재추첨·추가지급 없음 |
| FM008 · `dex-grid` | `#dex` · 도감 → 계열/발견 카드 | 도감 선택 카드 | renderDex / dex · card | 미발견 잠금과 발견/재고 구분 목록 표시, 발견 재고0도 상세 접근 |
| FM009 · `card-detail` | `#dex` · 소재 상세 보기 | caller의 선택 카드 | openCard / specOf / ductRow / cardCraftToggle / homeHeroOpen / galleryDetail / galleryParts · card | 이름·ID·사업LV·TS/EL 또는 RA·사용처·보증·재고 표시, 경제값 불변 |
| FM010 · `card-flip` | `#dex` · 열처리 전/후 · 앞뒤 보기 | 동일 카드 현재 면 | setCardSide / cardFlip / data-card-side · flip | PHS/HPF 동일 ID의 그림·상태·물성·대사 함께 전환 |
| FM011 · `qp-entry` | `#research` · 도감 QP / 제작 QP 연구로 이동 | caller(dex 또는 craft)의 원래 패널 | qpRevealed / openDevelop / qpBack / researchQPButton / researchQPOwned / galleryDevelop · qp | 공개 조건 충족시 연구 QP 패널을 열고 호출한 도감/제작 복귀점 보존; 소비0 |
| FM012 · `qp-material` | `#research` · QP 개발 → 재료 선택 | 연구 QP 개발 패널 | openDevelop / data-slot / data-qp-material · qp | 선택 후보 picks와 소비 전후 미리보기만 바꾸고 경제값 불변 |
| FM013 · `qp-develop` | `#research` · 개발 검토 → 개발 확정 | 연구 QP 결과 → caller | checkQP / openDevelop / devBtn · qp | CR1470M+CR/GA1180Y+scrap10 소비; QP1회, 허용 슬롯 무소모 대체 |
| FM014 · `order-open` | `#research` · 주문서 보기 | 연구 주문 요약 | renderOrder / todaysOrder / order · order | todaysOrder의 날짜/key 정상화만 반영한 실제 고객 요구 표시 |
| FM015 · `order-answer` | `#research` · 고객 요구 → 보증 답 선택 | 연구 주문 결과 | judge / openPick / btnOrder · order | 정답 items[key]=1·orderDone+1 저장, 오답 추가지급0 |
| FM016 · `order-reward` | `#research` · 정답 보증 → 장착 / 나중에 | 연구 획득 보증 | openPickTarget / pkEquip / pkDone · equip | 장착은 호환 소재 패널 진입, 나중에는 획득 보증 유지; 재고 소비0 |
| FM017 · `equip-confirm` | `#research` · 호환 소재 선택 → 장착 확정 | caller 카드 또는 연구 보증 | fitOwned / openPickTarget / pkDone2 / pickLater / data-guarantee-card · equip | 획득 보증 유지; 호환 발견 소재에 items[key]=cardId, stock 불변 |
| FM018 · `guarantee-list` | `#research` · 보증 안내 → 14종 목록 | 연구 보증 목록 | renderItems / itemCount / items · equip | 14보증의 잠금/획득/장착 상태 표시만, 경제값 불변 |
| FM019 · `guarantee-detail` | `#research` · 보증 선택 → 상세/장착 후보 | caller 보증 또는 도감 카드 | itemsOf / findItem / data-equip-id · equip | 장착됨은 소재 상세, 미장착은 호환 소재 선택; 진입만으로 경제값 불변 |
| FM020 · `parts-list` | `#craft` · 제작 → 35부품 목록 | 제작 목록 선택 부품 | renderParts / PARTS / parts · craft | 35부품의 완료/가능/부족과 분류·남은 수 표시, 소비0 |
| FM021 · `part-detail` | `#craft` · 부품 선택 → 제작 검토 | caller 제작 목록 또는 카드 | openPart / partPlan / craftBack · craft | partPlan 후보·소비 합계·현재→제작후 재고 검토만 표시, 소비0 |
| FM022 · `part-material` | `#craft` · 각 슬롯의 소재 선택 | 동일 제작 검토 패널 | partPlan / qpCovers / data-id / data-craft-material · craft | picks만 변경, QP 또는 일반 후보를 명시 선택; 확정전 소비0 |
| FM023 · `craft-part` | `#craft` · 제작 확정 | 제작 완료 → 목록/차고 | craft / mkBtn · craft | 35부품 원본 partPlan picks대로 stock소비/parts기록, owned유지 |
| FM024 · `car-progress` | `#garage` · 차고 → 조립 진행 | 차고 차량 목록 | renderCar / carDone / carBox · garage | 35부품 진행과 남은/제작가능 수 표시, 경제값 불변 |
| FM025 · `car-select` | `#garage` · 35부품 완료 → 미보유 차량 선택 | 차고 조립 진행 | renderCar / cancelCar / data-k · garage | 미보유 차종 선택·취소는 parts/cars 불변 |
| FM026 · `car-assemble` | `#garage` · 선택 차량 조립 확정 | 차고 획득 차량 | renderCar / takeCar · garage | 35부품 후 미보유8차종 중1확정; cars추가·parts초기화 |
| FM027 · `garage-list` | `#garage` · 차고 → 보유 차량/전체 목록 | 차고 차량 목록 | renderGarage / allCarsDone / garageBrowse / garage · garage | 실제8차종 소유/잠금·전체 완료 표시, 소유권 변화0 |
| FM028 · `car-detail` | `#garage` · 보유 차량 보기 | 차고 선택 차량 | openCar / carAtOf / garageCarBack · garage | 보유차 그림·제조사·설명·획득일 표시, 경제값 불변 |
| FM029 · `quiz-open` | `#research` · 퀴즈 풀기 | 연구 퀴즈 요약 | openQuiz / drawQuiz / btnQuiz · quiz | 기존 한도 판정과 시작 카운트 규칙으로5문제 시작, 보상은 아직0 |
| FM030 · `quiz-answer` | `#research` · 5문제의 보기 선택 | 현재 문제 해설 | renderQ / showExp / opts · quiz | 섞인 보기의 정오답을1회 고정하고 해설 표시, 중복채점0 |
| FM031 · `quiz-next` | `#research` · 해설 → 다음/결과 | 연구 퀴즈 결과 | showExp / qNext · quiz | 다음 문제/결과로 이동; 5문제 정답 때 extra=min(extra+1,quizMax()) 1회 |
| FM032 · `quiz-retry` | `#research` · 결과 → 재도전 / 확인 | 연구 퀴즈 요약 | quizReady / qRetry / qDone · quiz | 남은 한도에서 재시작 또는 연구로 복귀; 확인 버튼 추가지급0 |
| FM033 · `notice` | `#workshop` · 공방 공지 또는 설정 공지 | caller 공방/설정 | openNotice / closeNotice / noticeOk / noticeX / settingsNotice · notice | 공지 내용을 표시하고 기존 noticeSeen 규칙 유지; 닫기 후 caller복귀 |
| FM034 · `promo` | `#workshop` · 공방 행사 또는 설정 행사 | caller 공방/설정 | openPromo / promoOn / promoBar / promoGo / promoX / settingsPromo · notice | 예고/진행/종료를 실제 시간으로 표시, 기존 promoSeen/promoDone 규칙 유지 |
| FM035 · `notification` | `#workshop` · 모든 화면 → 설정 → 출하 알림 | 설정 → caller | bellOK / renderBell / btnBell · notice | 명시 클릭 후 허용/거부/미지원에 맞춰 실제 bell 상태 표시 |
| FM036 · `toast-dismiss` | `#workshop` · 모든 화면의 알림 → 닫기 | 알림 전 caller | showToast / toastX · notice | 표시 중인 토스트만 닫고 경제값 불변 |
| FM037 · `storage-warning` | `#workshop` · 모든 화면 저장 경고 → 백업 | 설정 백업 → caller | renderStoreWarn / warnGo · backup | 실제 저장 실패를 표시하고 백업으로 연결; 메모리 진행 유지 |
| FM038 · `backup-open` | `#workshop` · 모든 화면 → 설정 → 백업/복원 | 설정 → caller | openBackup / btnBackup · backup | 게임 코드·최근 백업시각·저장 진단 표시, 열기만으로 경제값 불변 |
| FM039 · `backup-export` | `#workshop` · 게임 백업 만들기 → 복사 | 설정 백업 패널 | makeCode / bkCopy / bkOut · backup | 진행만 SGG-GAME1. 코드로 생성; 성공 복사만 backupAt 기록 |
| FM040 · `backup-restore` | `#workshop` · 게임용 코드 입력 → 요약 → 교체 확정 | 설정 백업 패널 | readCode / applyCode / bkLoad / bkIn / bkCancel / bkConfirm · backup | 게임 코드 검증·요약·이전 회복코드 후 명시 게임용 진행 교체1회 |
| FM041 · `storage-diagnostics` | `#workshop` · 설정 백업 → 저장 진단 | 설정 백업 패널 | storeDiag / bkDiag · backup | 실제 실행 방식·localStorage·IndexedDB·영구저장 상태 표시, 진행 불변 |
| FM042 · `reset-confirm` | `#workshop` · 설정 → 게임 진행 초기화 → 5초 내 재확인 | 설정 → caller | refresh / btnReset / resetCancel · reset | 5초 내 두번째 명시확정만 게임진행 초기화 |
| FM043 · `webtoon-open` | `#research` · 웹툰 읽기 (공방 바로가기 포함) | caller 연구 또는 공방 | openToon / renderToonList / btnToon / homeToon · toon | 연재 안내/1화/2화 목록과 NEW 표시, 목록 진입만으로 읽음 변경0 |
| FM044 · `webtoon-episode` | `#research` · 목록 → 연재 안내/1화/2화 | 웹툰 목록 선택 항목 | openToonView / data-i / data-retry · toon | 선택 회차와 실제 페이지 표시, 기존 읽음 증가 규칙만 반영 |
| FM045 · `webtoon-list` | `#research` · 뷰어 → 목록 | 웹툰 목록 이전 항목 | backToToonList / toonBack · toon | 목록의 이전 항목과 초점 복원, 읽음을 되돌리지 않음 |
| FM046 · `webtoon-next` | `#research` · 뷰어 → 이전/다음 회차 | 현재 회차 | openToonView / data-go · toon | 이전/다음 회차를 표시하고 기존 읽음 규칙 유지 |
| FM047 · `webtoon-close` | `#research` · 목록/뷰어 → 닫기/Escape | caller 연구 또는 공방의 웹툰 버튼 | closeToon / closeToonView / toonX / toonViewX · toon | 목록/뷰어를 닫고 caller초점·스크롤 잠금 복원, 읽음 유지 |
| FM048 · `dialog-close` | `#workshop` · 모든 대화상자 → 닫기/배경/Escape | 열었던 route+control; 중첩은 직전 대화상자 | showDialog / hideDialog / closeDialogs / cardX / partX / pickX / quizX / backupX / settingsX · navigation | 최상위 대화상자를 닫고 직전 대화상자 또는 caller초점 복원; 경제 재실행0 |
| FM049 · `install-open` | `#workshop` · 모든 화면 → 설정 → 설치 안내 | 설정 → caller | closeInstall / btnInstall · install | 기기별 설치 안내를 열고 caller복귀점 보존; 진행 불변 |
| FM050 · `install-action` | `#workshop` · 설치 / 방법 보기 / 접기 | 설치 안내 | beforeinstallprompt / installGo · install | 지원 prompt는 명시 클릭시 요청, 없으면 방법 펼침/접기; 진행 불변 |
| FM051 · `install-platform` | `#workshop` · 아이폰/안드로이드/컴퓨터 탭 | 설치 안내 선택 탭 | iosGuide / androidGuide / pcGuide / data-t · install | iOS/Android/PC 설명과 선택 상태만 변경 |
| FM052 · `install-close` | `#workshop` · 설치 안내 닫기 → 재진입 | 설정 → caller | closeInstall / installX · install | 게임용 dismiss만 기록하고 안내 닫기; 설정에서 다시 열 수 있음 |
| FM053 · `save-restore` | `#workshop` · 자동 로드/저장/재로드 | 현재 route | applySaved / load / save / bootRestore / storeWarn · backup | 게임전용 LS/IDB 복구 우선순위·정규화 유지, 교육 진행 접근0 |
| FM054 · `time-refresh` | `#workshop` · 모든 화면: 시간/숨김 복귀 | 현재 route | tick / todaysOrder / visibilitychange · status | 개인 출하주기·날짜/행사 경계만 원본 규칙으로 갱신; 임의 지급0 |
| FM055 · `offline-update` | `#workshop` · 모든 화면: 오프라인/업데이트 알림 | 현재 route, 동작 유휴 후 갱신 | register / serviceWorker · offline | 현재+이전 사용가능 release 유지, 유휴시 업데이트 안내 |
| FM056 · `settings-open` | `#workshop` · 5개 탭 공통 설정 열기 | 설정을 연 route+control | routeView / btnSettings / homeSettings · navigation | 현재 route 위에 설정을 열고 닫을 때 동일route 설정 버튼으로 복귀 |
| FM057 · `part-recommendation` | `#craft` · 공방 다음 부품 만들기 → 제작 검토 | 공방 추천 카드 | homeRecommendation / partReady / homeRecommend · craft | 실제 추천 부품의 소비 전 검토를 열고 부족/완료 상태를 안내 |
| FM058 · `dex-filter` | `#dex` · 계열/LV/발견/재고 필터 → 해제; 만들 수 있는 부품 | 도감 기존 필터/선택 카드 | dexMatches / openCardPart / dexFamily / dexLevel / dexDiscovery / dexStock / dexClear / data-card-part-key / dexFiltersToggle · card | 목록만 필터/해제, 적용부품 선택은 소비 전 제작검토; 경제값 불변 |
| FM059 · `draw-skip` | `#workshop` · 바로 결과/전체 결과/닫기 | 공방 이미 확정된 결과 | finishDraw / closeDraw / data-draw-skip / data-draw-close · draw | 연출을 종료하고 이미 확정·저장시도한 결과만 표시; 재추첨/추가지급0 |
| FM060 · `learning-card-link` | `#dex` · 퀴즈 해설/웹툰 소개 → 소재 상세 → 돌아가기 | 퀴즈 문제 또는 웹툰 회차/스크롤 | quizRelated / toonOpenFamily / resumeToon / toonDexResume / data-toon-family / data-learning-target · card | 관련 소재와 원래 퀴즈 문제 또는 웹툰 회차/스크롤 왕복, 경제값 불변 |
| GAME001 · `equip-preview` | `#research` · 도감/연구 → 장비 보기 → 장착 전/미리보기 | caller 카드/보증 | GAME_EQUIPMENT / function preview(key, id) / function confirm(event) / cardEquipmentToggle / galleryEquipment / data-equipment-mode / data-equipment-side / equipCancel / equipConfirm / equipTargets · equip | 실제 호환 장비를 장착 전/미리보기로 합성; 확정 전 items/stock/저장 불변 |
| GAME002 · `craft-qp` | `#research` · 제작 QP 연구로 이동 | 제작대로 돌아가기: 원래 부품·picks | openCraftResearch / restoreCraftCaller / craftQP / craftResearchReturn · qp | 연구 QP 패널 진입 뒤 원래 제작 부품·picks로 복귀; 진입만으로 소비0 |
| GAME003 · `representative-select` | `#dex` · 발견 카드 → 대표로 전시 | 도감 카드; 공방에 선택 반영 | GAME_HOME.select / function saveSelection(kind, value) / cardRepresentative / galleryRepresentative / homeHeroSelect · card | 발견 소재 ID만 환경설정의 대표로 선택, owned/stock/재화 불변 |
| GAME004 · `car-representative` | `#garage` · 보유차 → 대표 전시로 선택 | 차고 선택차 | GAME_HOME.select / function saveSelection(kind, value) / garageRepresentative / homeCarSelect · garage | 보유차 ID만 환경설정의 대표로 선택, parts/cars/재화 불변 |
| GAME005 · `gallery-mode` | `#dex` · 격자/큰 카드 갤러리 → 이전/다음 버튼 | 도감 동일 필터/카드 | GAME_COLLECTION / function move(delta) / dexModeGrid / dexModeGallery / galleryPrev / galleryNext / galleryReset / data-gallery-side · card | 격자/갤러리·이전/다음 표시만 전환, 필터/선택 ID 공유·경제값 불변 |
| GAME006 · `backup-import` | `#workshop` · 설정 → 교육용 백업 가져오기 → 요약 → 게임용 진행 교체 | 설정 → caller | prepare('education' / GAME_BACKUP.read / bkEducation / bkConfirm / bkCancel · backup | 명시 교육 SGG1. 검증·요약·이전 회복코드·게임용 진행 교체 확인 후1회 적용 |
| GAME007 · `backup-recovery` | `#workshop` · 설정 → 백업 교체 미리보기의 이전 복구 코드 → 교체 후 이전 코드 확인 | 설정 → caller | backupRecovery / bkRecoverySaved / bkRecovery / bkRecoveryOut · backup | 교체 전 게임용 복구 코드를 미리보기와 교체 후 백업 화면에 표시, 읽기만으로 진행 교체0 |
| GAME008 · `audio-enable` | `#workshop` · 모든 route → 설정/첫 소리 켜기 또는 무음으로 계속 | caller | GAME_AUDIO / function enable() / data-audio-enable / data-audio-silent · audio | 사용자 소리켜기 동의 후 재생 또는 무음으로 계속, 경제값 불변 |
| GAME009 · `audio-mute` | `#workshop` · 설정 → 전체 음소거 | 설정 → caller | function setMute(value) / data-audio-mute · audio | 전체 mute 환경설정만 변경, 재생 중단/복귀·경제값 불변 |
| GAME010 · `audio-bgm` | `#workshop` · 설정 → 음악 음량 | 설정 → caller | function setGain(category,value) / data-audio-bgm · audio | BGM 음량 환경설정만 변경, SFX 음량/경제값 불변 |
| GAME011 · `audio-sfx` | `#workshop` · 설정 → 효과음 음량 | 설정 → caller | function setGain(category,value) / data-audio-sfx · audio | SFX 음량 환경설정만 변경, BGM 음량/경제값 불변 |
| GAME012 · `audio-recover` | `#workshop` · 재생실패 안내 → 탭하여 다시 켜기 | caller | function resume() / 소리 다시 켜기를 눌러 주세요. / data-audio-enable · audio | 사용자 탭으로 재생 재개 시도, 놓친 결과 재생/경제 재실행0 |
| GAME013 · `asset-retry` | `#workshop` · 각 화면 실패 그림 → 다시 시도 | 동일 route/선택 | retry.addEventListener / 그림 다시 불러오기 · offline | 실패한 그림만 다시 로드, 선택·진행·이미 확정된 결과 유지 |
| GAME014 · `update-notice` | `#workshop` · 업데이트 준비 안내 → 유휴후 적용 | 동일 route/진행 | GAME_CLIENT_STATE / GAME_ACTIVATE / gameUpdateButton · offline | 사용가능 업데이트와 유휴 조건을 알리고 명시 적용, 진행중 강제재로드0 |

## 현재 상태의 수용 시나리오

- 신규: 공방은 도구/비어 있는 받침과 첫 출하 안내, 차고는 덮인 전시대와 제작 CTA. 대표 소재는 처음 발견된 catalog ID, 대표차는 보유차만.
- 재고0: 발견 카드의 설명·보증 접근은 유지한다. 제작은 후보별 현재→사용후 수량을 표시한다. QP로 1470/PHS 슬롯만 대체하며 980 슬롯은 소비한다.
- 진행 중: 취소·스킵·닫기·새로고침·연속클릭·탭이동은 이미 확정된 결과만 읽는다. 저장 실패 시 경고와 현재 메모리 결과·백업 경로를 제공한다.
- 완료: 35부품 → 미보유 차량1종 선택 → 확정에서만 parts 초기화. 8종 완료는 새로운 차·보상을 생성하지 않는다.
- 가져오기: 게임 복원과 교육용 가져오기 버튼을 구분한다. 입력 검증 → 요약 → 이전 게임 회복코드 → 명시 교체 → 1회 적용. 취소/형식오류/호환오류/과대입력은 기존 진행 유지.
- 주변 안내: 출하 알림, 공지, 행사, 저장 경고, 업데이트, 오디오 실패, 설치 실패 각각 독립 원인을 표시하고 공통 닫기/복귀를 제공한다.
- 음향: 첫 방문 무음, BGM/SFX 음량과 전체 mute 분리. 소리 켜기 실패에도 게임 조작·결과 정상. 숨김 중 놓친 효과음은 복귀 때 재생하지 않는다.

## 검증 범위

`node tools/game-qa.mjs --case design-inventory --engines chromium --evidence <절대 증거 경로>`는 실제 소스 조작·원본 런타임 catalog와 이 목록을 대조하고 QP/백업/보증/웹툰 누락을 거부한다. 프로토타입의 [클릭 흐름](game-prototype/index.html)은 별도 시안 QA다. 실제 게임의 화면/모션/저장 동작은 각 작업의 runtime QA가 증명하며, 최종 통합 완료는 별도 최종 실행 영수증으로 확인한다.

소스 검증은 출하 빌더의 `sourceNames`에 포함된 템플릿·PWA 조각과 `src/game/*.js` 모듈을 같은 순서로 읽는다. 기존 FM001–FM060의 경제 기능 목록을 보존하고, 분리된 모듈의 실제 조작도 누락 없이 대조한다.
