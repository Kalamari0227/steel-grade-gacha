# 화면·상태 계약

이 문서는 원본 함수를 연결할 화면의 요구사항이다. T3는 문서 완결성을 확인하며 실제 동작 증거는 표의 후속 태그에서 기록한다. 시작 상태는 `tests/fixtures` 계약의 이름이며 필요한 변형은 각 괄호로 명시한다. fixture는 실제 사용자 데이터와 분리한다. 공통 동작·색·치수는 [system.md](system.md), 모든 원본 행동 연결은 [feature-map.md](../feature-map.md)다.

## 공방·출하

| 시작 fixture / 상태 | 표시·가능 행동 | 변화와 실패 시 보존 | 태그 |
|---|---|---|---|
| new / 빈 수집 | 일반0/44·QP 별도, 현재 출하와 학습 안내 | 출하 전 임의 보상 없음 | @home-happy |
| mid-progress / 진행 중 | 기본/추가/스크랩·부품/차고·추천을 함수에서 계산 | 시안1/2/24·12/35·1/8·22/44 하드코딩 없음 | @home-happy |
| crafting-ready / 제작 가능 | 첫 미완성 partReady 부품·필요 재고·상세 CTA | 진입은 소비 전, 실제 craft만 소비 | @home-happy |
| crafting-short / 제작 가능0 | 부족 소재와 도감·출하 연결 | 없는 소재 지급·먼저 일부 소비 없음 | @home-negative |
| mid-progress / 기본 소진·추가 있음 | 기본 대기 시각과 추가 횟수 분리 | 기본이 가능하면 우선 사용, 아니면 extra만 사용 | @draw-happy |
| mid-progress / 모두 소진·scrap19 | 단일 대기, 10연 부족1 표시 | 비용 차감 없음 | @home-negative @draw-negative |
| promo-boundaries / 시작·끝·예고 | 기존 한도·픽업·행사 공지 통합 띠 | 시간 경계 정상화 외 변경 없음 | @home-happy @home-negative |
| all-parts / 35완료 | 기존 자동차 선택 진입 | 선택 전 부품 유지 | @home-happy @garage-happy |
| all-cars / 8종완료 | 전체 수집 완료와 유지 가능한 활동 | 새 차종·보상 추가 없음 | @home-happy @garage-negative |
| new / 첫 획득 | NEW·소재 용도·입고+1·사업LV | 결과를 연출 전 저장 | @draw-happy |
| mid-progress / 중복 획득 | NEW 대신 재고 증가·현재 재고 | 자동 스크랩·승급 없음 | @draw-happy |
| mid-progress / 재고2와1 | 재고2 이상만 1장 스크랩 | stock-1/scrap+1, 마지막 재고 보존 | @draw-negative |
| completed-lv3 / completed-lv4 | 전부 발견해도 비용 충분하면 확정교환 가능 | LV3/4 비용5/10, 미발견 없으면 같은LV 전체 후보에서 재고+1 | @draw-happy |
| mid-progress / 비용 부족 또는 격리 empty pool | 원인과 비활성 표시 | 후보·비용 부족 차감 없음 | @draw-negative |
| mid-progress / 10연 | 전체결과 즉시 보기·사용자 상세 선택 | scrap20 소비·10장·LV3+최소1, 기본/extra 불변 | @draw-happy |
| 결과 저장 직후 / skip·닫기·탭이동·reload·연속클릭 | 이미 확정된 결과를 읽거나 종료 | 재추첨·이중 지급 없음 | @draw-negative |

## 도감·카드

| 시작 fixture / 상태 | 표시·가능 행동 | 보존 계약 | 태그 |
|---|---|---|---|
| new / 미발견 | 원본 공개 범위·잠금, 필터·clear | 획득 카드처럼 상세 공개하지 않음 | @cards-negative |
| discovered-zero-stock / 발견·재고0 | 이름·재고0·물성·대사·사용처·보증·전후 접근 | owned와 stock 분리, 재고0을 미발견으로 되돌리지 않음 | @cards-negative |
| mid-progress / 일반카드 | 계열 약어·LVNAME·TS/EL·적용부품 | 대표값 주의·기존 USE와 GSPEC | @cards-happy |
| mid-progress / 선재 | TS와 단면수축률 RA, % | RA를 EL로 이름만 바꾸지 않음 | @cards-happy @education-data |
| mid-progress / PHS 전후 | 전 TS500~700/EL20내외, 후 TS1500이상/EL5~7 | 같은 poo-PHS, IMG/IMG_ALT·대사·상태 동시 전환, 재고 불변 | @cards-happy |
| mid-progress / HPF 전후 | 가열 전 Al-Si·프레스 후 비교 | 같은 ga-1470H, 앞뒤·도금층 보존 | @cards-happy |
| mid-progress / alt 없음·빠른 flip | alt 없는 카드의 flip 없음, 빠른 입력도 같은 side와 수치 | 비용·재고 불변 | @cards-negative |
| mid-progress / S-EDDQ와1180Y | 둘 다 LV3이며 성형성과 강도를 각각 설명 | LV를 성능 점수로 해석하지 않음 | @cards-happy @education-data |
| mid-progress / 필터 결과0 | 결과없음·조건 해제 버튼 | 원본 목록·저장 유지 | @cards-negative |
| qp-ready / qp-owned | 공개 조건 후 별도 QP 칸·개발 입구 | 일반44 분모·POOL에 QP를 추가하지 않음 | @qp-happy @cards-happy |

## 제작·QP·차고

| 시작 fixture / 상태 | 표시·가능 행동 | 변화와 실패 시 보존 | 태그 |
|---|---|---|---|
| crafting-ready / B필러2슬롯 | PHS 또는 GA1470H / CR980Y 또는 GA980Y, 현재→제작후 수량 | 기본 재고 많은 후보·동률 낮은LV, picks 반영 | @craft-happy |
| crafting-ready / 35recipe | 같은 슬롯 요소·정확한 부품 설명·소비 합계 | 중복 슬롯은 이미 사용 예정인 수량 추적 | @craft-happy |
| crafting-short / 한 칸 부족·재고0 | 부족한 칸·후보·필요량, 제작 비활성 | 준비된 다른 칸도 소비하지 않음 | @craft-negative |
| crafting-ready / 이미 제작·preview후 재고변경·연속실행 | 완료 또는 최신 부족 상태 | 중복·초과 소비 없음, 실행 시 재검증 | @craft-negative |
| crafting-ready / 완료 후 재고0 | 부품+1·소비내역·도감 유지 | owned 유지, stock와 parts 함께 갱신 | @craft-happy |
| new / QP 공개 부족 | 조건 미충족 범위의 기존 표시 | 개발 진입·무료 지급 없음 | @qp-negative |
| qp-ready / 개발 준비 | CR1470M + CR/GA1180Y + scrap10 전후 수량 | 개발1회, 정확 재료만 소비·QP발견/재고 반영 | @qp-happy |
| qp-ready / scrap9·CR1470M없음 | 부족 이유와 개발 비활성 | 차감·QP 지급 없음 | @qp-negative |
| qp-owned / 대체 가능 슬롯 | QP 선택 시 해당 슬롯 '소모 없음' | 1470/PHS 대체 범위만, 980슬롯은 소비 | @qp-happy |
| qp-owned / 명시 일반 소재 | 일반 후보와 실제 소비 전후 | 선택한 일반 재료 소비, QP가 전체 무료로 만들지 않음 | @qp-happy |
| qp-owned / 재개발·980부족 | 이미 개발 또는 부품 부족 | 중복QP·무료 부품·차감 없음 | @qp-negative |
| all-parts / 선택·취소 | 미보유 자동차 목록·확정 CTA | 선택·취소만으로 parts/cars 불변 | @garage-happy @garage-negative |
| seven-cars / 8번째 확정 | 차 상세·획득일·전체완료 | 차량 추가 후 parts 초기화, 기존 도감/재고 유지 | @garage-happy |
| mid-progress(34부품) / all-cars / 중복확정 | 부족/보유/전체완료 각각 이유 | 차량 추가·부품 차감 없음 | @garage-negative |

## 학습·보증·웹툰

| 시작 fixture / 상태 | 표시·가능 행동 | 변화와 실패 시 보존 | 태그 |
|---|---|---|---|
| mid-progress / 퀴즈5정답 | 섞인 보기·정답·해설·관련 카드·결과 | extra=min(extra+1,quizMax()) 기존 누적상한, 보상1회 | @learning-happy |
| mid-progress / 오답·재제출·한도·재진입 | 오답 해설·한도 안내 | 추가 지급·정답 위치 혼동 없음 | @learning-negative |
| mid-progress / 고객 요구 | 호환 보유 소재와 미획득 보증 기준의 당일 요구·회신 | 기존 날짜/key 정상화, 새 교육 보상 없음 | @orders-items-happy |
| mid-progress / 정답 후 나중에 | 획득 보증·장착/나중에 | items[key]=1 유지, 나중에가 획득을 취소하지 않음 | @orders-items-happy |
| equipped-items / 14보증 | 학습의 목록·호환 소재 선택·장착 후 도감 상세 | items[key]=cardId, stock 소모 없음 | @orders-items-happy |
| new / 비호환·후보없음·요구한도·중복 | 원인·도감 연결·잠금 | 잘못된 장착·보상·재고소비 없음 | @orders-items-negative |
| mid-progress / 웹툰3항목 | 연재안내·1화·2화,18WebP=15페이지+3썸네일 | 회차/콘텐츠 추가 없음, 기존 TOON/TOON_SEEN 규칙 | @webtoon-happy |
| mid-progress / 웹툰 열기·목록·앞뒤·닫기 | NEW/읽음·경계 비활성·도감연결 후 복귀 | 기존 읽음 증가 규칙·별도 저장키, SGG1에 읽음 새 필드 추가 금지 | @webtoon-happy |
| mid-progress / 느린 이미지·미캐시·오프라인 | 로딩/실패 구분·재시도·목록 복귀 | 빈 이미지를 정상 로드로 취급하지 않음, 실패 때문에 읽음 완료를 새로 날조하지 않음 | @webtoon-negative |

## 설정·저장·공통 접근성

| 시작 fixture / 상태 | 표시·가능 행동 | 변화와 실패 시 보존 | 태그 |
|---|---|---|---|
| mid-progress / 백업 | 코드·복사·최근시각·진단·복원입력 | 성공복사만 backupAt 기록, 실패는 수동복사 | @storage-happy @storage-negative |
| legacy-save / 복원 성공 | 원본 readCode/applyCode 결과·갱신 | 버튼 클릭으로 기존 방식 적용, 과거 필드 정상화·SGG1 형식 유지 | @storage-happy |
| corrupt-code / 복원실패 | 입력 근처 오류·코드 수정 가능 | 진행 불변, 가짜 성공 금지 | @storage-negative |
| mid-progress / 저장 거부·손상 mirror | 경고·실제 진단·백업 진입 | 원본 복구 우선순위, 자동 초기화 금지 | @storage-negative |
| reset-ready / 사용자 초기화 | 기존 5초 내 두 번확인·취소/만료 | 첫클릭/만료 불변, 확정 시 stock/parts/cars/pullUsed/qpSeen/noticeSeen 정상화, bell/promoSeen/promoDone/웹툰읽음 유지 | @reset-happy @reset-negative |
| mid-progress / 알림 허용·거부·미지원 | 실제 상태·명시 토글 | 사용자 클릭에서만 권한 요청·기존 bell 규칙 | @storage-happy @storage-negative |
| new / 설치 가능·안내만 가능 | 설치 또는 iOS/Android/PC 방법·접기·재진입 | OS설치 미확인과 안내 동작을 구별, 진행 불변 | @storage-happy @pwa-negative |
| mid-progress / 업데이트 후 오프라인 | 기존 화면·진행·읽은 웹툰 | old→new 같은origin SW update/controllerchange 후 데이터 보존 | @pwa-upgrade-happy |
| new / 첫 방문 오프라인·미캐시 웹툰 | 사용할 수 없는 범위·재연결 안내 | 빈 앱/이미지를 성공으로 기록하지 않음 | @pwa-negative @webtoon-negative |
| 모든 fixture / 4viewport·200% | 읽기 순서·44px조작·비용과오류 노출 | 가로 overflow·가려진 버튼·잘린 단위 없음 | @layout-happy @layout-negative |
| 모든 dialog / 키보드·연속모달 | label·초점순환·Escape·원래초점 | 숨은view 초점 없음·중복 listener 없음·스크롤 잠금 복구 | @keyboard-happy @navigation-negative |
| 결과/flip/제작 / reduced motion | 즉시 상태·결과 표시 | 애니메이션 대기·smooth scroll·tilt 없음, 경제결과 동일 | @reduced-motion |

## 누락 판단

미발견·발견재고0·한 칸 부족·복원실패·오프라인은 필수이며 하나라도 빠지면 상태 계약은 미완료다. PHS/HPF alt 하나라도 누락되면 원화 계약은 미완료다. 고객 요구/보증이 학습에서 빠지거나 QP 개발 진입이 사라지면 탐색 계약은 미완료다. 검증 태그는 구현 시 실제 nonzero 테스트 수와 trace/스크린샷/상태 diff를 남겨야 한다. T3의 문서 검토만으로 후속 기능이 통과했다고 보고하지 않는다.
