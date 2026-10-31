# GA 전체 원화 제작 — Task 15

기존 파일럿 `ga-270C`, `ga-1470H` front/alt를 보존하고 나머지 11면과 11썸네일을 별도 built-in ImageGen 호출로 제작했다. 원본 정체성 참조와 승인 GA 파일럿 재질 참조를 함께 전달했으며 각 `*-generation.json`에 실제 프롬프트·원본 SHA·생성 파일 SHA를 보관한다. masters의 PNG는 생성 출력과 byte-for-byte 동일하다.

`*-export.json`은 Lanczos 크기 변환, 투명 여백, WebP 인코딩과 실제 알파 측정만 기록한다. 수동 그림·마스크·필터 복제는 사용하지 않았다. `*-72.png`는 144×216 썸네일을 실제 72×108로 디코딩한 검토 출력이다. 얼굴·문양 보호영역은 최종 960×1440 출력에서 직접 확인했다.

DQ/DDQ/EDDQ 원본의 둥글게 솟은 캡, 각 칼라·소매·장식 차이와 S-EDDQ의 보라색 눈·긴 코트를 보존했다. 340W 단순 리벳/340H 길고 분절된 패턴, 440W 매끈한 갑옷/590Y 부분 큰 피복/780Y 전신 큰 피복/980Y 작은 피복과 X보강/1180Y 다층 어깨·허리·무릎 형태를 구분한다. 육각형 가로띠와 자주색 계열은 공통이다. 특별 프레임은 기존 1180Y와1470H 메타데이터만 유지한다.

검토 증거는 실행 루트 `.omo/evidence/game-edition/game-20261025-01a16bac/task-15/`의 개별 `ga-*-comparison.png`(원본/마스터/런타임/실제72px), `fourteen-full-contact.png`, `fourteen-72-contact.png`, `protected-rects.png`와 해시 목록이다. CLI가 시각적 의미를 자동 판정한다는 주장은 하지 않는다. 최종 독립 검수는 별도 수행한다.
