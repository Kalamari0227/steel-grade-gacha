# 게임용 프로젝트 지도 · 2026-11-11 (브랜치 정리 반영)

**진행 방향은 새 일러스트를 전량 리메이크한 독립 수집 게임이다.** 교육용은 임시 보관·경제 규칙 대조 자료이며 게임용 아트 선택 기준이 아니다.

| 구분 | 위치 | 상태와 사용 기준 |
| --- | --- | --- |
| 최신 승인본 진입점 | `current/index.html`, `current/artwork.json` | 기본 47면·장착 254개·기타 176개, SHA로 고정 |
| 현재 게임 체험판 = **제품 기반** | `.omo/prototypes/steel-companion-full-art-remake/` | 추적된 실제 소스·실행 자산·QA. 2026-11-11 결정으로 본 개발도 이 코드에서 이어간다 |
| 게임용 작업·푸시 브랜치 | `game-edition/`, `게임용` | 이 문서가 속한 작업 디렉터리와 브랜치 |
| 원화·승인·생성 원본 보관소 | 프로젝트 루트 `.omo/artwork/steel-companion-full-art-remake/` | 원래 경로와 이력 보존. 최신 선택은 `current/artwork.json`으로 찾음 |
| 피클송 최신 제작 입력 | `docs/music-video/pickle-song-2026-11-11/` | 최신 캐릭터로 수정한 레퍼런스·프롬프트·재제작 범위 |
| 이전 게임 구현 | 루트 `index.html`, `src/`, `assets/game/` | 경제·저장·장착 계약 재사용 및 역사 자료. 최신 시각 기준과 구분 |
| 옛 게임 UI·아트 시안 | `docs/design/game-prototype/`, `game-reference/`, `game-reviews/`, `tarae-concepts-*` | 제작 역사 보존. 신규 그림 선택에 사용하지 않음 |
| 공유 Git 저장소 폴더 | 프로젝트 루트 `repo/` (`main` 체크아웃) | `game-edition` worktree의 git 저장소를 겸한다. 폴더를 지우지 않는다. 교육판은 2026-11-11 폐기 |
| 연출 개편 브랜치 | `feature/draw-fx-src`, `feature/draw-fx` (원격) | 교육판 소스 기준 LV5 히어로 연출. 체험판으로 이식 후 삭제 예정. 미승인 이미지 2장 포함 |
| 현재 작업 브랜치 | `feature/experience-r2` | 카드 KO/JA 글귀 레이어, LV5 연출 이식. 체험 승인 후 `게임용`에 합침 |

## 다시 혼동하지 않기 위한 순서

1. 이 저장소의 README에서 최신 승인 갤러리와 체험판을 연다.
2. 캐릭터·장비·차량·무대는 `current/artwork.json`의 target ID와 SHA로 선택한다.
3. 새 제작물에는 사용한 target ID·SHA를 기록한다. 파일명·날짜가 늦다는 이유로 교체하지 않는다.
4. 새 승인이 생기면 현재 목록·체험판 결속·검증을 함께 갱신한다. 옛 시안은 원래 승인·반려 이력으로 보존한다.

원화 승인은 완료됐으며 현재 체험 품질 검토는 진행 중이다. 이전 게임이나 교육판의 테스트·인수를 이번 체험판의 사용자 승인으로 대체하지 않는다. 실제 배포는 커밋·푸시와 별도 행동이다.

프로젝트 루트 자체는 Git 저장소가 아니다. 이 파일과 최신 승인 목록은 `게임용` 브랜치로 보존하며, 루트 안내는 로컬에서 이 경로를 가리킨다. Git worktree·세이브·백업·원화를 정리 대상으로 삭제하지 않는다.

## 2026-11-11 브랜치 정리

사용자 결정으로 교육판과 9월 실험을 폐기했다. 원격·로컬에서 `maintenance/trace-retention-2026-11-10`, `deploy/education-pages`, `snapshot/education-2026-10-25`, `modify`, `assets-staging`, `claude/steel-grade-gacha-updates-0saqka` 브랜치와 `education-v1` 태그를 삭제했고 GitHub Pages를 껐다. 작업 사본 `.omo/worktrees/pages-preview-2026-11-10/`, `.omo/worktrees/steel-companion-full-art-remake/`도 제거했다. 후자는 이 문서에서 보존 대상이었으나, 내용이 `게임용`에 추적돼 있고 유일한 미추적 파일은 `docs/design/game-replan-2026-10-31.md`와 동일함을 확인한 뒤 지웠다. 정리 후 `tools/verify-current-art.py`는 PASS(승인 477·대사 47쌍)다.

남은 브랜치: `main`, `게임용`, `feature/draw-fx`, `feature/draw-fx-src`, 작업용 `feature/experience-r2`.
