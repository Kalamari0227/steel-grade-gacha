# 게임 제작 원본 보관과 복원

`node tools/archive-game-sources.mjs --out /absolute/owned/game-sources.tar.gz --verify-extract /absolute/owned/restored`로 소스 보관본을 만든다. 출력은 입력 checkout 밖이어야 하고 복원 폴더는 비어 있어야 한다. Node 22 이상과 strict build의 FFmpeg/FFprobe가 필요하다. npm install은 WAV 합성과 빌드에 필요하지 않다.

보관본에는 125 원화 master, 185 배포 이미지, 생성 prompt·raw generation·승인 참고·정체성 참고, 반려 및 수정 이력, 검수·placement receipt, 4 악보와 patch/mix/24 cue 정의, 28 WAV master와 32 배포 오디오, 실행 도구, 현행 게임 코드, 원본 웹툰 18개가 들어간다. 파일별 SHA와 용량은 `source-materials/source-manifest.json`에 있다. 소스 용량과 runtime art/audio 용량은 별도로 기록한다. 소스 master를 배포 예산에 넣지 않는다.

`source-materials/provenance-map.json`은 원문 receipt의 JSON pointer를 상대 파일과 SHA에 연결한다. 원문에 남은 절대 경로와 HTML·prompt·명령 문자열은 역사 자료이며 실행하지 않는다. 추출된 `node tools/archive-game-sources.mjs --verify-root /absolute/owned/restored --report /absolute/owned/paths.json`은 모든 파일과 필수 mapping을 실제 조회한다. 개별 조회는 `--receipt <relative-json> --pointer <json-pointer>`를 추가한다. 매핑이나 파일이 없으면 원래 경로가 존재해도 실패한다.

WAV 재현은 빈 owned 폴더에 추출본의 `src/audio/{score,patches,mix,cues}.json`만 복사하고, **추출된** `tools/audio/render.mjs --all --seed 20261025 --root <owned-rerender>`를 실행한다. 생성한 28 master의 SHA를 보관된 audio manifest와 비교한다. 새 render receipt의 환경 버전 문자열은 역사 receipt와 다를 수 있다.

빌드는 추출 폴더에서 `node tools/build-game.mjs --root <restored> --out <owned-build> --report <outside-new-report.json>`를 실행한다. `--fixture`를 사용하지 않는다. 원래 checkout의 builder에 복원 root만 지정하면 실행 도구 의존성 독립성을 증명하지 못한다. 생성된 game-release.json의 syntheticFixture=false 및 모든 출력 SHA를 원래 frozen release와 비교한다.

외부 `game-sources.receipt.json`이 archive SHA와 내부 manifest SHA를 묶는다. SHA는 서명이 아니다. 두 공개 경로는 `<out>.bundle/current/` 아래 immutable generation의 archive와 receipt를 가리키는 링크다. current 링크 하나를 atomic rename하므로 세대가 함께 전환된다. 두 파일을 별도로 읽는 소비자는 receipt의 archiveSHA도 확인해야 한다. 이전 세대는 복구용으로 남긴다. 복사·전달할 때 링크를 따라 archive와 receipt를 각각 복사하며 둘을 검증한다. tar **내부**에는 링크가 없고, 추출기는 전체 member를 검사한 후 파일을 쓴다. 실패한 stage는 지우며, 강제 종료 후 다음 writer는 PID lease를 확인하고 이전 stage를 정리한다.

선별한 `source-materials/producer-code`는 원래 이미지 export code와 preset이다. 과거 절대 경로·sharp 설치 위치 및 Pillow/시스템 Menlo 글꼴 의존성이 남은 역사 코드이므로 자동 실행하지 않는다. 이것은 이미지 재export의 역사 자료이며 portable WAV/build 실행 계약과 구분한다. 사용자 cache나 글꼴을 복사하지 않는다. 테스트 재현용 전체 Playwright 환경·교육 baseline은 보관하지 않는다. archive 경계 검증은 `SGG_ARCHIVE_EVIDENCE=<owned-evidence> node --test tests/game/archive.node.mjs`로 실행한다.

이 Task32 snapshot은 당시 확정된 소스의 기록이다. Task39/40 이후 Task41에서 최종 소스로 보관본과 외부 receipt를 다시 생성하고 빈 복원·WAV·strict build를 재확인해야 한다. 이 보관본은 이후 코드 변경이나 음악의 주관적 청취를 승인하지 않는다.

검증기는 payload 목록의 inputDigest를 다시 계산하고 requiredMappings와 실제 map의 고유 pointer 집합이 정확히 같은지 확인한다. `declaredCounts`는 당시 collector가 기록한 집계 메타데이터임을 표시한다. 복원 검증의 파일 수·바이트·실제 조회 결과와 구분한다. 독립 확인은 보관된 art/audio/comics manifest에서도 수를 다시 집계한다.

Publication의 commit 지점은 current pointer의 atomic rename이다. 그 이전 실패·중단은 이전 pair를 유지한다. 그 이후 디렉터리 fsync가 실패하면 새 pair가 이미 선택되었음을 `COMMITTED_WITH_DURABILITY_ERROR`와 exit1로 알린다. 이는 성공 보고가 아니며 파일 시스템 crash durability를 보장하지 않는다. 이미 선택된 새 pair의 archive SHA와 receipt를 확인하고 다음 정상 실행으로 재발행할 수 있다. 강제 종료의 전후도 같은 commit 경계로 해석한다.
