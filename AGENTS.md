# 게임용 작업 기준

- 이 저장소는 새 일러스트를 전량 리메이크한 게임용이다. 교육용은 임시 보관·기능 대조 자료다. 상위 프로젝트의 보관·모델·승인 지침을 함께 따른다.
- `README.md`와 `docs/project-map.md`에서 시작한다. 최신 승인 원화는 `current/artwork.json`의 target ID·SHA로 선택한다. 파일 날짜·버전 번호·옛 시안으로 대체하지 않는다.
- 현재 게임 체험판은 Git에 추적된 `.omo/prototypes/steel-companion-full-art-remake/`다. 숨김 경로도 현재 소스·승인 자산으로 보존한다. 루트 `index.html`·`src/`는 이전 게임과 재사용 경제·저장 계약이다.
- 기본 47면·장착 254개·기타 176개와 문안 47쌍의 승인은 완료됐다. 체험 품질도 2026-11-14 승인됐다(`current/approval/review/experience-quality-2026-11-14-r1/`). 본 개발은 `docs/plans/game-development-plan-2026-11-14.md`의 단계와 사용자 결정을 따른다. 아트·체험 승인을 게임 전체 인수로 확대하지 않는다.
- 모델·추론 강도와 토큰 절약 읽기 규칙은 상위 프로젝트 `AGENTS.md`의 "Claude Code에서 작업할 때"와 "토큰을 아끼는 읽기 규칙"을 따른다. 요약: 탐색·실행은 Haiku 5.5 low, 확정된 구현은 Sonnet 5.5 medium, 저장·정합성·복합 오류는 Opus 5.5 high, 설계와 통합 검토는 Fable 5.2 high. 두 번 실패했을 때만 한 단계 올린다.
- 아트·체험판 참조를 바꾸면 `python3 tools/verify-current-art.py`로 실제 승인 파일·런타임 결속을 확인한다. 새 승인 반영 시 선택 목록과 근거 SHA도 함께 갱신한다.
- 과거 시안·승인·반려 기록·원본·세이브·백업·Git worktree를 정리 목적으로 삭제하지 않는다. 위치 변경 전에 참조·복원 관계를 확인한다.
