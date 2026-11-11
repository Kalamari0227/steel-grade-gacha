# 스틸 컴패니언 · 게임용

**현재 진행하는 제품은 게임판입니다.** 교육용은 임시 보관·기능 대조 자료입니다. 새 일러스트를 다시 그려 최종 승인한 게임용 기준으로 진행합니다.

- **[최신 승인 캐릭터 보기 · 여기서 시작](current/index.html)** — 기본 47면과 승인 산출물 477개.
- [현재 게임 체험판 소스·실행 안내](.omo/prototypes/steel-companion-full-art-remake/README.md) — 최신 승인본을 적용한 공방·출하·수집·장착 감상.
- [프로젝트 지도](docs/project-map.md) — 실제 작업 위치, 교육용 보관본, 옛 시안 구분.
- [최신 원화 파일·SHA 목록](current/artwork.json) · [원화 선택·보관 기준](current/README.md).
- [피클송 수정 레퍼런스·재제작 계획](docs/music-video/pickle-song-2026-11-11/README.md).

게임용 작업 디렉터리는 `game-edition/`, 브랜치는 `게임용`입니다. 최신 체험판은 이 저장소의 `.omo/prototypes/steel-companion-full-art-remake/`에 이미 추적돼 있습니다. 숨김 폴더라는 이유로 임시 파일로 취급하지 않습니다.

아트 477개, 문안 47쌍, 장착 문안 배치 254개의 사용자 승인을 확인했습니다. 체험판 품질 검토는 진행 중이며, 아트 승인을 본 개발·게임 전체 인수 완료로 확대하지 않습니다.

## 실행·검증

현재 체험판 폴더에서 `node server.mjs`를 실행합니다. `http://127.0.0.1:8779/`에서 체험판을 제공합니다.

저장소 루트의 `python3 tools/verify-current-art.py`는 승인본 477개와 실제 체험판의 이미지·문안 결속을 읽기 전용으로 확인합니다.

## 이전 자료

루트 `index.html`, `src/`, `assets/game/`는 2026-10-31 재계획 이전 게임과 재사용 경제·저장 계약입니다. 최신 그림을 판단할 때는 위의 승인 목록을 사용합니다. `docs/design/game-prototype/`, `game-reference/`, `game-reviews/`와 타래 초기 시안도 제작 역사로 보존합니다.

[정리 전 README 원문](docs/history/README-before-2026-11-11.md) · [게임판 재계획](docs/design/game-replan-2026-10-31.md) · [기존 게임 유지보수 계약](docs/game-maintenance.md) · [기존 제작·복원 기록](docs/design/game-production.md).

