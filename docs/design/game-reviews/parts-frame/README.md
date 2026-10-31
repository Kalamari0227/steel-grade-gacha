# 프레임 부품 10종

`sill`, `bumper`, `apillar`, `bpillar`, `crossm`, `impact`, `seat`, `reinf`, `roofx`, `sidemem`은 각각 별도의 내장 ImageGen 호출로 만든 새 금속 미니어처다. 전체 프롬프트·생성 경로·SHA·원형/승인 참조 SHA는 `generation/{key}.json`에 있다. 생성 PNG는 `../masters/part/{key}.png`에 원본 바이트로 보관한다. 런타임 `src/game/art/parts/{key}.webp`는 원본 전체를 648×648로 축소하여 768×768 투명 캔버스 (60,60)에 놓은 lossless WebP다. 결정적 크기 변환·인코딩 외 덧칠·재색칠·배경 제거는 하지 않았다.

위쪽 왼편의 옅은 샴페인 광원과 오른편의 차가운 반사광, 은색 강재 표면, 부드러운 미니어처 모서리를 통일했다. A필러의 기울어진 채널과 B필러의 직립 허리·벨트 보스, 깊은 바닥 크로스멤버와 얕은 루프 횡보, 가는 도어 임팩트빔과 이중 리브 씰·구멍 난 사이드 멤버를 원형과 직접 대조했다. 각 부품은 보기 좋은 공통 상품 축척이며 물리적인 부품 간 크기비는 아니다. 조명과 표면 표현은 강종 보증이나 새 게임 능력치를 뜻하지 않는다.

`happy/{key}-original-runtime.png`는 기존 원형과 실제768px 출력 비교다. `72/{key}.png`는 실제72px 축소이며 `happy/all10-at72{,-light}.png`에서 어둡고 밝은 배경을 함께 검수했다. `receipts/{key}.json`은 현재 master/runtime/reference/검수 이미지 SHA에 결박한 자체 시각 검수다. 최종 인수는 독립 검토를 거친다.

## 레시피와 조립 위치

`recipe-mapping.json`은 원래 catalog의 정확한10개 key, C11–C16/C20/C30–C32 매핑, 재료 슬롯과 허용 ID를 그대로 보존한다. C33이나 새 부품은 없다. 앱·catalog·제작 규칙은 수정하지 않았다.

`assembly-metadata.json`은 후속 제작 화면에서 읽을 그룹 전용 파일이며 고정 asset-manifest schema에 임의 필드를 추가하지 않는다. `vehicle-side-normalized-v1`: 자동차 왼쪽 측면에서 x=0 앞, x=1 뒤, y=0 지붕 위, y=1 지면이다. 모든 anchor와 bounds는0–1이며 anchor는 bounds 안에 있다. layer는0–100, recipe SHA는 원래 catalog.parts 한 행의 JSON.stringify SHA256이다. `assembly-review.png`의 선 도식은 의미상 위치 검토를 위한 기술 주석이며 런타임 원화나 실제 CAD/체결점이 아니다. 횡보는 차 폭 방향 구조를 측면에서 위치만 표시한다. 보강재는 여러 실제 사용처 중 하부 캐빈 접합부의 대표 위치다.

## 검증

병합 전: `node tools/verify-game-assets.mjs --group parts-frame --review-root docs/design/game-reviews --report <evidence>/assets.json`.
병합 후: 같은 명령에 `--canonical` 추가. 정확히10개의 소유 행만 병합하며 기존 fragment는 이후 stale이다.
`--case part-negative --group parts-frame`는 실제 생산 파일을 격리 복사해 잘못된 필러 receipt 교환, 실패한 원형상 검토, 누락·중복·SHA·레시피·조립 좌표 오류를 실제 CLI에서 거부한다. 이는 근거와 데이터 결박 검사이며 그림만 보고 A/B필러를 자동 인식하는 검증이라고 주장하지 않는다. 실제 형태 판단은 직접 시각 검수와 독립 검토가 맡는다.
