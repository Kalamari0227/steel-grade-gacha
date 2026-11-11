# 게임용 프로젝트 지도 · 2026-11-11

**진행 방향은 새 일러스트를 전량 리메이크한 독립 수집 게임이다.** 교육용은 임시 보관·경제 규칙 대조 자료이며 게임용 아트 선택 기준이 아니다.

| 구분 | 위치 | 상태와 사용 기준 |
| --- | --- | --- |
| 최신 승인본 진입점 | `current/index.html`, `current/artwork.json` | 기본 47면·장착 254개·기타 176개, SHA로 고정 |
| 현재 게임 체험판 | `.omo/prototypes/steel-companion-full-art-remake/` | 추적된 실제 소스·실행 자산·QA. 현재 개발 출발점 |
| 게임용 작업·푸시 브랜치 | `game-edition/`, `게임용` | 이 문서가 속한 작업 디렉터리와 브랜치 |
| 원화·승인·생성 원본 보관소 | 프로젝트 루트 `.omo/artwork/steel-companion-full-art-remake/` | 원래 경로와 이력 보존. 최신 선택은 `current/artwork.json`으로 찾음 |
| 피클송 최신 제작 입력 | `docs/music-video/pickle-song-2026-11-11/` | 최신 캐릭터로 수정한 레퍼런스·프롬프트·재제작 범위 |
| 이전 게임 구현 | 루트 `index.html`, `src/`, `assets/game/` | 경제·저장·장착 계약 재사용 및 역사 자료. 최신 시각 기준과 구분 |
| 옛 게임 UI·아트 시안 | `docs/design/game-prototype/`, `game-reference/`, `game-reviews/`, `tarae-concepts-*` | 제작 역사 보존. 신규 그림 선택에 사용하지 않음 |
| 교육용 임시 보관본 | 프로젝트 루트 `repo/`, `snapshot/education-2026-10-25`, `education-v1` | 교육용 당시 결과·복원·기능 대조. 후속 제품 개발 대상은 게임용 |
| 공개 미리보기용 별도 worktree | 프로젝트 루트 `.omo/worktrees/pages-preview-2026-11-10/`, `deploy/education-pages` | 교육 화면과 `game-preview/`가 함께 있는 배포 보관본. 브랜치 이름으로 제품 방향을 판단하지 않음 |
| 이전 리메이크 작업 worktree | 프로젝트 루트 `.omo/worktrees/steel-companion-full-art-remake/game-edition/` | detached 과거 작업 보존. 현재 작업 위치와 구분 |

## 다시 혼동하지 않기 위한 순서

1. 이 저장소의 README에서 최신 승인 갤러리와 체험판을 연다.
2. 캐릭터·장비·차량·무대는 `current/artwork.json`의 target ID와 SHA로 선택한다.
3. 새 제작물에는 사용한 target ID·SHA를 기록한다. 파일명·날짜가 늦다는 이유로 교체하지 않는다.
4. 새 승인이 생기면 현재 목록·체험판 결속·검증을 함께 갱신한다. 옛 시안은 원래 승인·반려 이력으로 보존한다.

원화 승인은 완료됐으며 현재 체험 품질 검토는 진행 중이다. 이전 게임이나 교육판의 테스트·인수를 이번 체험판의 사용자 승인으로 대체하지 않는다. 실제 배포는 커밋·푸시와 별도 행동이다.

프로젝트 루트 자체는 Git 저장소가 아니다. 이 파일과 최신 승인 목록은 `게임용` 브랜치로 보존하며, 루트 안내는 로컬에서 이 경로를 가리킨다. Git worktree·세이브·백업·원화를 정리 대상으로 삭제하지 않는다.
