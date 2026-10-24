# src — 앱을 만드는 재료

> T22 검토 시점에 승인된 T19 캐시 버전은 `steel-grade-gacha-redesign-t19-v1`입니다. T21 index는8,773,399B이며 로컬 비교 성능 결과는 유지보수 문서에 기록했습니다. 이후 최종 캐시 버전·산출물 검증 상태는 외부 `E/delivery-manifest.json`과 T23 보고서에서 확인합니다.

index.html은 생성물입니다. 수정은 이 폴더의 소스에서 하고 bash src/build.sh로 다시 만듭니다.

| 입력 | 역할 |
|---|---|
| app_tpl.html | 데이터·기존 규칙·화면과 상호작용 |
| img/ |45 ID/47상태의480×720 JPEG 카드, QP 포함 |
| partimg/ |35부품 PNG |
| itemimg/ |14보증 항목 PNG |
| carimg/ |8차량 PNG |
| uiimg/workshop.webp |별도 생성 공방 일러스트; 내장 카드 매핑과 별개 |
| pwa_head.txt |문서 앞의 meta/link |
| pwa_body.txt |설치 UI·서비스 워커 등록 |
| build.sh |위 입력으로 ../index.html 생성 |
| ../webtoon/ |외부 경로로 읽는18WebP; 본문15·썸네일3 |
| ../docs/design/ |디자인 시스템·art-bible·manifest·계열별 제작 기록 |

빌드 매핑은104개(카드47+부품35+보증14+차량8)입니다. 웹툰18개와 공방 그림은 별도 파일 경로를 유지합니다. 파일 수와 산출물 바이트는 실제 검증 결과로 확인하며 과거의 약4.7MB 같은 추정치를 재사용하지 않습니다.

## 작업 순서

1. 현재 소유권·변경 범위를 확인합니다. 공유 app_tpl.html은 함수/마크업 경계의 좁은 수정으로 통합하고 다른 작업의 전체 템플릿을 덮어쓰지 않습니다.
2. 소스 또는 지정 자산만 수정합니다. ID·규칙 변경은 별도 승인 범위에서 다룹니다.
3. bash src/build.sh를 실행하고 입력 및 index.html SHA256을 기록합니다.
4. 해당 테스트와 verify:assets를 실행합니다. 서버 응답 SHA와 생성물 SHA가 같아야 그 화면 증거가 유효합니다.
5. 캐시 변경은 고유 SW 버전과 T19의 기존 웹툰 캐시 이전 경로를 함께 검증합니다. 검증 전 업데이트 성공을 선언하지 않습니다.
6. 실제 작은 화면·키보드·오류/재시도 상태를 확인하고 소유 서버·임시 파일을 정리합니다.
7. 커밋·push·배포는 사용자 요청으로 허용된 경우에만 수행합니다.

원화 프롬프트·master·거절본·JPEG export recipe·원본/최종 해시는 docs/design/production 및 asset-manifest를 따라 추적합니다. T21은 wr_cord 품질69, c_980/c_1180 품질68로 세 장을 재출력했고 나머지 승인 이미지는 유지했습니다. 실제 검수·export 기록과 T21 예산 결과를 사용하며 T23 최종 바이트는 다시 확인합니다.

자산 검증에는 불변 baseline과 작업공간의 실제 review/export 증거가 필요합니다. baseline 경로·커밋과 `--require-redraw` 증거 경로의 세부 계약은 유지보수 문서에서 확인합니다. 이 검증 자료는 제품 HTML의 실행 의존성으로 추가하지 않습니다.

회귀 명령과 자료 위치는 [유지보수 문서](../docs/redesign-maintenance.md)를 참고하세요.

