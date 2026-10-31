# Steel Companion · 상세 화면 프로토타입

## 1. 분위기와 참조
승인된 5개 이미지(../game-reference/provenance.json)를 직접 확인했다. 작은 금속 피규어, 따뜻한 작업등, 은색 가공면, 조용한 흑연색 컨트롤을 유지한다. 새 제작·연구·차고·설정의 구성은 승인 이미지에 없으므로 동일 규칙으로 확장한 상세 시안이다. 픽셀 복제 대상이 아니다. 공방·도감 원본은 디자인 참조 갤러리로 구분한다.

## 2. 색
--bg #161B20, --surface #242C33, --ink #F2EEE5, --muted #B4BBC2, --plum #78486E, --gold #DCC194. 상태 성공 #BCD6BF, 오류 #F0ABA7, 중립선 #48515A. 아트만 밝고 풍부하게, 페이지 컨트롤은 낮은 채도. 다크 고정 시안이며 별도 라이트 제품 요구는 없다.

## 3. 글자
한국어 시스템 sans-serif. 본문 15px/1.65, 보조 14px/1.55, 소제목 20px/1.4, 페이지 제목 모바일 28px/1.25·데스크톱 36px/1.25. 한글 keep-all + overflow-wrap:anywhere. 숫자는 tabular-nums. 영어 라벨은 12px 장식 정보이며 조작/필수 설명은 14px 이상.

## 4. 공간
간격 4/8/12/16/20/24/32/40px. 모바일 20px 거터, 데스크톱 최대 1120px. 화면 높이를 고정하지 않고 본문 스크롤. 880px에서 두 열을 한 열로 접는다. 하단 5개 내비게이션은 76px, 본문 하단 112px 여백으로 가리지 않는다.

## 5. 공통 요소
header, page-heading, surface, scene, section-heading, material-option, action-row, primary/secondary/text 버튼, tab-list, dialog를 재사용한다. 버튼 최소 44×44px, 본문 라벨 15px. 중립 1px 선과 채움으로 선택 표시하며 accent 띠/카드 윤곽선은 사용하지 않는다. 대표 선택은 체크+문구로 중복 표현한다. 모든 페이지 상단에 mock 표시, 실제 저장에 쓰지 않는다.

## 6. 상호작용
경로 #workshop/#dex/#craft/#research/#garage. #learn/#learning은 replaceState로 연구 alias. 설정은 모든 경로의 modal로 caller와 초점을 유지. 제작: 부품→재료→검토→취소/확정. QP는 연구로 이동하며 제작 복귀. 연구 4기능은 실제 펼침/선택/닫기. 차고 empty/owned/completion 예시 전환과 대표 선택. 설정 audio opt-in/mute/range, 명시적 교육 import 미리보기/취소, 회복 코드와 reset 5초 보호.

## 7. 접근성과 모션
native dialog, title, labels, button, a, select, range. focus-visible 2px champagne. Escape 닫기/초점 복귀. 오류 role=alert, 결과 role=status. hover는 actionable surface 밝기 변화만. 전환 opacity 140ms, prefers-reduced-motion에서는 즉시. 소리는 실제 재생하지 않으며 opt-in 상태만 시연.

## 8. 한계와 인계
시안은 메모리 내 명시적 예시 데이터만 사용하며 localStorage/IDB/service worker 호출이 없다. 기존 education raster art는 임시 표현이다. 신규 production art와 실제 경제/저장 연결은 후속 작업. 백업 문법은 데모 토큰만 검증하고 실제 코드를 처리하지 않는다. 390×844/1280×900 8개 기본 캡처, 320px 실패/경계·modal keyboard 근거를 함께 전달한다.
