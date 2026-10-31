# 바디 부품 10종

`roof`, `hood`, `fender`, `sideo`, `dooro`, `trunkin`, `trunko`, `whouse`, `floor`, `bracket`은 각각 별도의 built-in ImageGen 호출로 만든 새 미니어처다. `../masters/part/{key}.png`는 생성 원본 바이트이며 런타임 `src/game/art/parts/{key}.webp`는 원본 전체를640px로 축소하고64px 투명 여백을 둔768×768 출력이다. 원화에 수작업 덧칠, 배경 제거, 재색칠을 하지 않았다. 생성 프롬프트·원본 경로·SHA·승인 참조·원래 부품 SHA는 각 generation JSON에 남긴다.

통일한 위쪽 왼편 광원, 은색 강재와 어두운 음영, 옅은 샴페인 반사광을 사용했다. 색 장식을 붙여 부품 의미를 흐리지 않았다. 도어와 사이드 아우터의 열린 창/도어 구멍, 인너의 리브와 구멍, 트렁크 아우터의 막힌 외판, 휠하우스의 깊은 반원, 플로어 터널과 브라켓의 꺾임을 원본과 직접 대조했다. 실제72px 이미지는 밝은 배경과 어두운 배경에서 검토했다. 모든 review JSON은 현재 master/runtime/reference/evidence SHA와 묶인다. 자체 시각 검수의 승인 상태이며 별도 독립 검토가 최종 인수를 결정한다.

## 조립 좌표

`assembly-metadata.json`은 후속 제작 화면을 위한 별도 파일이며 고정 asset-manifest schema를 확장하지 않는다. `vehicle-side-normalized-v1`은 자동차 왼쪽을 보는 의미상 도식이다. x=0은 앞, x=1은 뒤, y=0은 지붕 위, y=1은 지면이다. CAD 좌표, 체결점, 실제 치수나 모든 차종의 정확한 형상을 보증하지 않는다. 원화는 보기 쉬운 공통 상품 축척으로 표시하며 실제 부품 간 물리적 크기비를 뜻하지 않는다.

정확한 소유10개 key마다 `assetId`, `assetSha256`, `surface`(outer/inner/assembly/structural/mechanical), `anchor`({x,y}), `bounds`({x,y,width,height}), `layer`(0–100), `recipeSha256`, `review`를 둔다. 모든 좌표는0–1이며 anchor는 bounds 안에 있다. recipe SHA는 원래 catalog.parts 해당 행 전체의 JSON.stringify SHA256이다. 실제 조립 목업 `assembly-review.png`는 원화를 보여주고 단순 도식의 해당 영역·점을 강조한다. 트렁크 아우터는 원래 외판+보강 recipe이므로 surface=assembly, 인너는 inner다. 브라켓 위치는 차체 하부의 대표적인 장착 영역이며 수백 개 실제 위치 중 유일한 위치를 주장하지 않는다.

## 검증

병합 전에는 `node tools/verify-game-assets.mjs --group parts-body --review-root docs/design/game-reviews --report <evidence>/assets.json`을 실행한다. 병합 후에는 `--canonical`을 추가한다. 그룹 fragment는 정확히10개 소유 행만 바꾸며 병합 후에는 stale이 된다.

`--case part-negative --group parts-body`는 실제 생산 파일을 격리 복사한 fixture에서 CLI를 실행한다. ID 교환, 중복·누락, 외판/내판 검토 receipt 교환 또는 실패 상태, SHA 불일치, 조립 좌표 범위 초과, 오래된 recipe/asset 결박을 거부한다. 이는 데이터와 검토 근거의 검증이며 그림만 보고 잘못된 부품을 자동 인식한다는 뜻이 아니다. 실제 형태·재료 의미·조립 위치 판단은 직접 시각 검수와 독립 검토가 맡는다.
