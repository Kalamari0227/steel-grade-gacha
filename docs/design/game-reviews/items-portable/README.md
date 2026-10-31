# 휴대형 보증 소품 7종

`shield`, `dagger`, `potion`, `arrow`, `spark`, `glass`, `loupe`의 새 built-in ImageGen 원본은 `../masters/item/`에 보존한다. 각 `*-generation.json`은 실제 도구 원본 경로/SHA, 프롬프트, 기존 소품 대응, 승인 참조, 결정적768×768 WebP 내보내기를 기록한다. `glass`는 기존 `src/itemimg/hourglass.png`의 모래시계 의미와 키를 유지한다.

각 `*-review.json`은 현재 runtime/master/reference/SHA와 실제72×72 확인 래스터를 결박한다. 비인물 소품이므로 face는 해당 없음이다. 방패의 육각/가로띠와 포션의 물방울은 직접 문양 검수하고, 다른 소품은 인물 문양이 없어 emblem만 이유와 함께 해당 없음으로 남긴다. 전체 실루엣·재질 의미·72px 항목은7종 모두 실제 검토했다.

방패의 육각/자주 테두리는 승인 equipment 시안을 따르며 기존 파란 십자 도안을 대체한다. 단검의 얇은 칼날, 포션의 윤활액, 화살의 균일한 축, 스파크 건의 구리 접점, 모래시계의 모래 흐름, 루페의 검사 렌즈가 각각 기존 보증 의미를 유지한다. 어떤 소품에도 인물 몸/손/얼굴 또는 문구가 붙지 않는다.

작업 증거의7종 비교표와7개 실제 호환 캐릭터 합성은 **원화 피팅 검수용**이다. 생산 UI 및107개 최종 장비 배치를 승인하거나 수정한 자료가 아니다. 전체 카드72px에서는 작은 도구 세부가 단순화되므로 후속 합성 작업이 실제 다중장착 가시성을 다시 검수한다. 경제·호환 목록은 변경하지 않는다.

조각은 승인된7개 행만 병합하며 이미 병합한 조각은 의도적으로 stale이 된다. 현재 파일 검증은 `node tools/verify-game-assets.mjs --canonical --group items-portable --review-root docs/design/game-reviews --report <증거경로>`를 사용한다. `--case item-negative --group items-portable`은 격리된 실제 파일 복사본에서 CLI 실패 계약을 확인하며 화풍/잘못된 도구의 자동 인식을 주장하지 않는다.
