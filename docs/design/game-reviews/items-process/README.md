# 설비·시편형 보증 아이템 7종 제작

Task18은 forge, flange, iron, kettle, bath, jominy, section만 제작했다. 원본 src/itemimg, ITEMS의 의미와 fit 조건, 캐릭터, 107개 production placements는 수정하지 않았다. 독립 인수 검토 대기이며 전체 게임 아트 완료나 Task23 배치 승인을 뜻하지 않는다.

내장 image_gen.imagegen으로 7종을 각각 생성했다. 각 generation.json에 실제 프롬프트, 입력 원본과 승인 equipment 참조 SHA, 생성 파일 경로, 보존 master SHA 및 export 절차가 있다. 모든 master는 1254×1254 PNG이며 768×768 lossless WebP로 LANCZOS export했다. 알파를 다시 칠하거나 제거하지 않았다. 72×72 PNG는 실제 runtime에서 파생했다.

| 아이템 | 직접 확인한 실루엣과 보증 의미 |
|---|---|
| forge | 세 다리 화덕·둥근 테두리·각진 숯; BH 도장 소부 후 항복 상승의 기존 보증 |
| flange | 사각 판 위 열린 버링 구멍과 솟은 벽; 기존 HER 보증 |
| iron | 뾰족한 평평한 밑판·열린 아치 손잡이; 기존 초고장력강 평탄도 보증 |
| kettle | 열린 뚜껑·양쪽 손잡이·구형 내용물; CHQ/베어링강 구상화 소둔의 상징 |
| bath | 낮은 직사각 욕조·통과 선재; 경강/타이어코드 패턴팅의 미세 펄라이트·신선성 |
| jominy | 위 어깨가 있는 봉·하단 일단 수류; CHQ 경화능 보증 |
| section | 짧은 원통 단면·밝은 외곽층; 스프링/밸브스프링의 탈탄층 깊이 보증 |

색 외에도 각 물건의 형상으로 구별된다. 인물 얼굴·손·무기 슬롯은 붙이지 않았고, 글자·수치·가짜 과학 눈금도 없다. 물성·확률·인벤토리를 바꾸지 않는다. 비인물 오브젝트의 face/emblem 검사는 근거 있는 N/A다.

조미니 v1은 수류가 하단 경계에 닿아 반려했다. revisions에 원본을 보존하고 내장 ImageGen으로 전체 실루엣과 하단 여백을 수정한 v2만 승인했다.

증거 루트: ../../../../../.omo/evidence/game-edition/game-20261025-01a16bac/task-18/

- seven-item-contact.png: 최종 7종 표.
- original-master-runtime-72.png: 원본/마스터/runtime/실제72 비교.
- fitting-contact.png 및 각 fitting-full.png, fitting-72.png: 실제 호환 CR/PO/WR 캐릭터와 총7개 소품을 사용한 임시 배치. WR-CHQ는 항아리와 조미니봉 동시 표시. WR-SWRH는 욕조, WR-SPR은 탈탄 시편. 얼굴과 문양 보호영역의 아이템 알파 교차는 모두0.
- rejected-wr-face-occlusion.png: 항아리가 WR 얼굴/몸체를 가리는 의도적 반려 사례. production placements에 포함하지 않음.
- assets.json, merge.json, canonical.json: 7개 실제 디코드·알파·receipt 검증과 원자 병합.
- negative.json: 기존 공유 item-negative를 수정 없이 실행한 실제24개 시나리오. 의미가 잘못됐다고 기록된 receipt를 거부하며 자동 OCR/도구 의미 판별기는 아니다.
- merge-scope.json: process7만 변경하고 나머지 매니페스트 행과107배치를 보존.

병합 후 manifest-fragment.json은 의도적으로 사용 완료 상태이므로 다시 적용하면 stale-fragment가 정상이다. fingerprint를 다시 만들지 않는다. canonical 검증에는 --canonical을 사용한다.
