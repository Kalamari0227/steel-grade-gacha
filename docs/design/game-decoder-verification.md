# 아트 디코더 검증 운영

## 2026-10-25 입력 전달 정지 진단과 수정

현재 `command`는 검증된 Buffer를 전용 임시 디렉터리의0600 파일에 기록하고 읽기 전용 fd를 연다. 파일과 디렉터리를 자식 시작 전에 삭제하고 fd만 stdin으로 넘긴 뒤 `finally`에서 닫는다. 자식 실행 중 신호로 부모가 종료되어도 입력 파일 경로가 남지 않는다. 설정 중 오류는 `finally`에서 임시 경로를 정리한다. 출력은 기존 파이프이며15,000ms·SIGKILL·32MiB 상한, MIME·해시·크기·알파 검사는 그대로다. 재시도나 시간 제한 증가는 없다. 오류 문자열에는 실제 입력SHA/바이트수, PID, status/signal, 부분 출력 길이를 남긴다.

근거는 `.omo/evidence/game-edition/game-20261025-01a16bac/decoder-authorized-recovery/producer/`에 있다. 최초 계측 `observed-frame`은 실제 `stale-metadata` 시나리오에서 ffprobe PID76472의 자연 타임아웃을 포착했다. 입력은 `sill.webp`,131460바이트, SHA256 `057987123055d1f824962432068b5b955b26620a9628884581deba87eaea09cd`다. 자식은 libavformat의 `read`에서, 부모는 `SyncProcessRunner → uv_run → kevent`에서 대기했고15.003초 뒤SIGKILL/ETIMEDOUT, stdout/stderr0바이트로 반환했다. 입력 원본·실행 파일SHA·argv·스택은 보존했다.

같은 바이트를 비동기 파일 읽기 후 반복 전달한 최소 실험에서 Buffer stdin은10번째 호출에 실패했다. fd stdin으로만 바꾸면200회 성공했고, Buffer로 되돌리고 `setImmediate`까지 추가해도51번째에 같은 읽기 대기가 발생했다. 실제 `decode` 회귀도 수정 전169회 완료 뒤 ffmpeg PID88884의 동일한 단일 스레드 `read` 대기에서 실패하고, 수정 후200회 완료했다. 이는 이 호스트의 Node 동기 stdin 소켓과 FFmpeg 입력 읽기 사이 정지를 분리한 증거다. 커널/libuv 내부의 정확한 누락 이벤트나 전달된 바이트 수까지 확정하지 않으며, 모든 macOS/Node 버전에 동일한 결함이 있다는 주장은 아니다. 단순 Node 읽기 자식은200회 통과하여 모든 자식 프로세스가 실패하는 현상도 아니다.

```sh
DECODER_TEST_EVIDENCE="$EVIDENCE/input" node --test tests/game-assets/decoder-input.node.mjs
DECODER_TEST_EVIDENCE="$EVIDENCE/timeout" node --test tests/game-assets/decoder-timeout.node.mjs
```

새 회귀는 비동기 읽기 뒤 실제 PNG/WebP 디코더를200회 호출하며 첫 실패에서 종료한다. 성공할 때까지 재시도하지 않는다. 현재 프로젝트의131460바이트 sill 입력을 사용한다. fd 방식은 이번 macOS26.6.2 arm64/Node24.18.0/FFmpeg7.1.1_3에서 확인했다. Windows의 열린 파일 삭제 동작은 별도 검증하지 않았으며 Windows 지원을 새로 주장하지 않는다.

이번 수정의 실제 CLI 검증은 계측용 `NODE_OPTIONS`·`DECODER_TRACE`를 제거한 상태에서 수행했다. `plain-canonical-frame.report.json`은10행 및 조립 메타데이터10개, `plain-canonical-chassis.report.json`은15행 및 조립 메타데이터15개를 확인했다. `plain-negative-frame.report.json`과 `plain-negative-chassis.report.json`은 각각33/33 통과했고 SIGTERM/SIGINT 중단 후 정상 재개도 포함한다. 각 실행은 첫 실패를 보존하고 외부240초 감시기 개입 여부를 별도 invocation JSON으로 남긴다.

`current-corpus.json`은175필수행(125base+47thumbnail+3icons)과10optional derived를 합친185행,310개 고유 runtime/master 경로를 실제 검사했다. `timeout-regression/regression.json`은 SIGTERM을 무시하는 자식을15초 경계에서 강제 종료하고 자식 소멸을 확인했다. `invalid-boundaries-v2.json`은 잘못된MIME·손상PNG·손상WebP의 수정 전후 거부 코드가 같음을 확인한다. 첫 진단 helper의 손상PNG 예상 코드는 잘못되어 실패했으며 그 기록도 보존했다. 실제 올바른 거부는 `image-dimensions`였고 제품 검사를 바꾸지 않았다. `overlap-output-equivalence.json`은 이전 정상 호출과 겹치는20개 입력의40개 메타데이터/RGBA 출력SHA가 동일함을 기록한다. 전체310입력의 수정 전후 픽셀 비교로 확대 해석하지 않는다.

아래 기록은 이전 종료 경계·스레드 제한 진단의 역사이며 이번 입력 전달 수정의 원인 증거와 구분한다.


현재 검증기는 PNG/WebP 입력을 실제 ffprobe와 ffmpeg로 검사한다. 각 자식 호출은 15,000ms와 32MiB 출력 상한을 유지한다. `tools/game-assets/images.mjs`는 시간 초과 때 `SIGKILL`을 사용한다. `spawnSync`의 기본 `SIGTERM`을 무시하는 실행 파일에서 반환이 계속 지연되는 현상을 소유 fixture로 재현하여 종료 경계를 수정했다. 이후 Task20/21의 공유 검증 수리에서 ffmpeg 입력 디코더·필터·RGBA 출력 인코더의 스레드 설정도 각각 1로 제한했다.

이 수정은 이전 Task12/15/16의 실제 ffmpeg/ffprobe 정지 원인을 해결했다는 주장이 아니다. 네 번의 실제 ETIMEDOUT 당시 정확한 입력 SHA와 자식 PID는 수집되지 않았다. 이후 성공 관측과 당시 다른 음향 작업의 존재만으로 CPU 경합, 입력 결함, 신호 무시 중 어느 것이 원인인지 판정할 수 없다. 음향 ffprobe의 이전 EPIPE도 다른 실패 서명이다.

## 실행 순서

1. manifest, 디코더 도구, 입력 파일과 실행 파일의 SHA를 기록한다. canonical 병합과 도구 편집을 잠시 멈추고 독립적인 소유 TMPDIR·Node/Bun 캐시·보고서 경로를 만든다.
2. 음향 전체 인코딩·검증과 동시에 시작하지 않고, 기본적으로 canonical 그룹 검증을 한 번에 하나씩 실행한다. 사용자의 다른 프로세스는 종료하지 않는다.
3. GAME 루트에서 다음 명령을 순서대로 실행한다. 각 `$EVIDENCE`는 이 실행에 등록한 절대 경로다. 이미 존재하는 보고서 파일에 실패 기록을 덮어쓰지 않는다.

```sh
node tools/verify-game-assets.mjs --canonical --group ga --report "$EVIDENCE/ga.json"
node tools/verify-game-assets.mjs --canonical --group wire-special --report "$EVIDENCE/wire-special.json"
```

4. exit 0과 JSON `status: PASS`, 예상한 양수 `checked`, 고정 입력 SHA를 함께 확인한다. 이번 manifest에서는 GA28, wire-special22다. 이후 콘텐츠 변경 시 현재 계약과 일치하는 개수를 다시 산출한다.
5. 실패하면 첫 stdout/stderr/report를 보존한다. 자동 재시도, 15초 상한 증가, 실패를 성공으로 덮어쓰는 래퍼를 사용하지 않는다. 별도 이름의 진단 실행은 원래 실패와 구분해서 기록한다.

프로세스 관측이 필요하면 Task43에 보존된 `observer.mjs`와 `diagnostics.py`를 참고한다. 관측기는 실제 실행 경로·실행 파일 SHA·입력 SHA·argv·상한·반환 PID·시간·종료 상태를 기록한다. Python 감시기는 자신이 시작한 프로세스 그룹만 감시하고, 전체 명령이 멈추면 별도 상한에서 종료한다. 관측기 자체가 추가하는 오버헤드와 프로세스 샘플링 누락 가능성을 기록해야 한다. 사용자의 PATH 전체나 환경변수를 임의로 공유하지 않는다.

## 종료 경계 회귀 검사

```sh
DECODER_TEST_EVIDENCE="$EVIDENCE/decoder-timeout" node --test tests/game-assets/decoder-timeout.node.mjs
```

이 검사는 소유한 임시 ffprobe만 `SIGTERM`을 무시하게 만든다. 실제 `decode`가 약15초에 `image-decode/ETIMEDOUT`으로 실패하고 자식이 사라져야 통과한다. 별도19초 감시기가 개입하면 검사 실패다. 임시 경로는 생성 전에 등록하며 종료 뒤 삭제·PID 상태를 JSON으로 남긴다. `TMPDIR`와 컴파일 캐시는 호출자가 소유한 실행 폴더로 지정한다.

## 근거와 한계

실행 근거는 저장소 외곽 `.omo/evidence/game-edition/game-20261025-01a16bac/task-43/`의 `done-claim.json`, `measurements.json`, `historical-failures.json`, `source-frozen.json`, `cleanup.json`에 보존한다. 이 문서는 특정 macOS arm64/Node24.18.0/ffmpeg7.1.1_3 환경의 측정에 근거한다. 제한된 두 작업 동시 실행은 해당 입력에서의 관측이며 일반적인 최대 동시 처리량이나 성능 보장이 아니다. 기본 운영 조건은 직렬 검증이다.

Task43 당시 승인된134행(캐릭터47면과 썸네일47, 환경/아이콘/파생26, 아이템14)의 디코드 검사는 그때 pending이었던 부품35·차량8을 포함하지 않았다. 이 진단은 최종 전체 아트의 시각적 인수나 release 검증을 대체하지 않는다. 새로운 정상 입력 정지가 발생하면 원인은 미확정 상태로 다시 조사한다.

Task43 종료 경계 수정 후 첫 실행 측정은 다음과 같다. 각 그룹 검사에는 검수 자료의 디코딩도 포함되어, 승인 자산 행 수보다 자식 호출 수가 많다.

| 시나리오 | 확인 수 | 명령 시간 | 정상 디코더 반환 수 | 가장 느린 정상 호출 |
| --- | ---: | ---: | ---: | ---: |
| 직렬 GA | 28 | 19.287초 | 392 | 82ms |
| 직렬 wire-special | 22 | 15.160초 | 308 | 80ms |
| 두 작업 동시 GA | 28 | 21.402초 | 392 | 186ms |
| 두 작업 동시 wire-special | 22 | 16.949초 | 308 | 191ms |
| 현재 승인 행 전체 | 134 | 30.668초 | 536 | 123ms |
| GA 반례 | 17 | 81.693초 | 1,246 | 88ms |

반례 실행의 고의15초 타임아웃1회와 SIGTERM/SIGINT로 중단한 호출2회는 정상 반환 수에서 제외했다. 수정 후 실제 canonical CLI의 신호 무시 fixture는15.108초에 실패 보고서를 반환했고, 외부19초 감시기는 개입하지 않았다. 측정 전체에서 정상 반환3,882건에 오류가 없었으며 확인한 소유 PID3,926개는 정리 시 모두 존재하지 않았다. 이는 과거 실패를 성공으로 변경한 집계가 아니다. 원래 실패 및 수정 전 회귀 실패는 별도로 보존한다.

## Task20/21 공유 검증 수리: 명시적인 스레드 제한

이후 독립 검증의 프레임 `assembly-anchor-out-of-range`와 섀시 `assembly-missing`에서 다시 실제 ffmpeg ETIMEDOUT가 발생했다. 실패 당시 PID는 각각62719·70357로 확인했지만, 보고서의 `inputAsset`은 첫 fixture 행일 뿐 실제 정지 입력이 아니다. 그 입력 SHA나 스택을 추정하지 않는다. Task43은 종료 경계를 보장했으며 자연 정지의 원인을 해결한 것으로 간주하지 않는다.

[FFmpeg 공식 문서](https://ffmpeg.org/ffmpeg-all.html)에 따르면 코덱 스레드의 기본값은 자동 선택이고 필터 스레드의 기본값은 사용 가능한 CPU 수다. 한 장의 정적 이미지를 검사하는 이 경로에서는 작업당 자원 사용을 제한하도록 다음처럼 설정한다. 입력 앞의 `-threads 1`은 입력 디코더에, 출력 앞의 설정은 rawvideo 인코더에 적용된다. `-filter_threads 1`은 필터 파이프라인의 전역 설정이다.

```sh
ffmpeg -v error -filter_threads 1 -threads 1 -i pipe:0 -frames:v 1 -f rawvideo -pix_fmt rgba -threads 1 pipe:1
```

고정 manifest `d2b7b1ee0f22e6c424c78148df13e8c9b88422cf50a70a6bf870f0daaa6106f0`의185행(필수175+파생10)에 속한310개 고유 runtime/master 입력을 기본·제한 설정으로 한 번씩 비교했다. 620회 실제 ffmpeg 호출의 RGBA SHA와 길이가 쌍별로 모두 같았다. macOS `PROC_PIDTASKINFO`를1ms 간격으로 관측한 최대 스레드는61→5, 입력별 최대치의 중앙값은32→4였다. 프로세스 전체가1개 스레드라는 뜻은 아니다. 샘플링이 최고점을 놓치거나 실행 순서에 영향을 줄 수 있으며, 이 비교는 Python 파이프를 사용하므로 Node 동기 파이프 문제를 배제하지 않는다.

이는 자원 사용을 실제로 줄인 실행 조건 개선이며, 과거 정지가 자동 스레드 생성 때문에 발생했다는 인과 증명이 아니다. 시간 제한·SIGKILL·버퍼 상한·파일/해시/크기/알파 검사를 유지한다. 음향 인코더와 검증용 fixture 생성 명령은 수정하지 않는다.

새 실행 증거는 `.omo/evidence/game-edition/game-20261025-01a16bac/task-20/harness-repair-shared/`에 있다. `comparison.json`은 전체 픽셀 동등성, `current-corpus.invocation.json`은 수정된 실제 `inspectAsset`의185행 검사, `uninstrumented-parts-{frame,chassis}.report.json`은 각33개 실제 CLI 반례를 기록한다. 두 최종 CLI는 `NODE_OPTIONS`와 `DECODER_TRACE`를 제거하고 실행한다. 외부 감시기는 소유 프로세스 수명만 확인하며, 디코더 호출을 감싸거나 재시도하지 않는다. `invalid-report.json`은 손상된 PNG/WebP와 실제 nonzero 종료 거부를, `timeout-regression/regression.json`은 기존15초 강제 종료 경계를 기록한다. 독립 리뷰와 전체 아트의 시각적 인수는 별개다.
