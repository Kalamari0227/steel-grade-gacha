# 게임판 실행과 유지보수

이 문서는 Task39 문서와 Task40 검증 도구의 통합 상태를 설명합니다. 아래 수량은 데이터·제작 계약 또는 명시한 과거 receipt의 범위이며 최종40/41/42의 승인·실측 결과가 아닙니다. Task37의 개별 승인은 최종 전체 회귀 승인을 대신하지 않습니다. 최종 경로·수량·해시는 실제 통합·검증 후 외부 receipt로 확인합니다.

<a id="identity"></a>
## 작업 디렉터리와 출처

교육용 보존 문서와 과거 E receipt 링크는 전체 checkout의 역사 참조입니다. portable production archive의 실행 의존성이 아닙니다.

게임 작업 디렉터리는 교육용 checkout과 분리한 `game-edition/`, 승인된 literal branch는 `게임용`입니다. Task1의 당시 worktree receipt가 이를 기록합니다. 현재 HEAD·branch·dirty 여부는 전달 시점에 다시 확인하며 이 문서는 현재 Git 상태를 단정하지 않습니다. 교육용 `repo/`와 `education-v1` 태그의 보존 HEAD는 `d3f52b6f3c79d6ccb579d362953242631b832a74`입니다. 경제 규칙 대조는 원본 `6784048524c722b7d1057cb28e372b6cce5dc6cf`를 사용합니다. 커밋·push·PR·merge·배포는 이 절차에 포함되지 않습니다.

원본 baseline은137개 추적 파일과 index SHA `1207e159c272c25fe93033ac35f80b6a8a8337dec8d5ed42cf3ec298fcfc7d5b`입니다. 교육용 timing/reference baseline은219개와 index SHA `99537b579bddbb93994b7e19fad2348c736c8cb95e1bfa1a4d5dbdeedafa7126`, education.tar SHA `3b83bf67195ff0681a57ab286ec5626829295c765d63c0947b3c3ca26d210671`입니다. 원본에 보충된 catalog fixture는 교육 보관본에서 온 대조 자료이며 원본137개에 있었다고 간주하지 않습니다. [보존 기록](releases/education-v1.md)과 [게임 전달 기록](releases/game-edition.md)을 구분합니다.

<a id="build"></a>
## 빌드와 독립 패키지

Node22 이상과 실제 FFmpeg/FFprobe가 필요합니다. 전체 checkout의 GUI QA는 package-lock의 Playwright1.61.1과 브라우저·외부 고정 baseline이 추가로 필요합니다. portable production archive는 전체 GUI QA 환경을 포함하지 않습니다. 생성된 index.html·sw.js를 직접 편집하지 않습니다. 실제 앱은 src/app_tpl.html과 src/game/ 모듈, PWA 조각, art/audio manifest를 수정한 뒤 다시 빌드합니다.

아래 `$NAME`은 실행 전에 소유한 실제 절대 경로로 지정하는 인자입니다. GAME은 이 checkout, BUILD/SITE는 서로 겹치지 않는 출력, REPORTS는 입력·출력 밖의 새 보고서 디렉터리입니다. 기존 임의 폴더는 출력 대상으로 쓰지 않습니다. TMPDIR·NODE_COMPILE_CACHE·BUN_RUNTIME_TRANSPILER_CACHE_PATH도 소유 임시 폴더 아래로 지정합니다. 프로세스·포트·프로필·출력은 실행 전에 resources.json에 등록하고 종료 후 실제 부재를 확인합니다.

실행 cwd=GAME:

```sh
node tools/build-game.mjs --help
node tools/package-game.mjs --help
node tools/game-qa.mjs --list
node tools/build-game.mjs --out "$BUILD" --report "$REPORTS/build.json"
node tools/package-game.mjs --root "$BUILD" --out "$SITE" --verify --report "$REPORTS/package.json"
```

`--fixture`는 합성 테스트 전용이므로 production 빌드에 쓰지 않습니다. package는 `--verify`와 무관하게 검증합니다. package의 `--case missing-release-entry|hash-mismatch|temp-failure`는 소유된 복사본을 사용하는 검증 전용 실패 주입입니다. 정상 배포 명령에 넣지 않으며, EXPECTED_REJECTION과 종료 코드1이 예상됩니다. 이 API의 실제 검증 결과는 실행 receipt로 확인합니다. game-qa와 archive는 현재 `--help`를 지원하지 않습니다. package는 소스·WAV master·개인 경로를 제공하지 않는 정적 산출물입니다. HTTP 서버의 root를 SITE로 지정하고 실제 주소와 응답 index SHA를 receipt에 기록합니다. 고정 미리보기 포트나 존재하지 않는 live URL을 안내하지 않습니다.

<a id="restore"></a>
## 실제 보관본 추출과 재현

[제작 원본 가이드](design/game-production.md)에 안전한 tar entry 검사, immutable publication, provenance-map과 역사 producer 코드의 경계가 있습니다. ARCHIVE는 외부 receipt의 archiveSHA·archiveBytes가 실제 파일과 같은 쌍이어야 합니다. RESTORED는 빈 소유 폴더입니다. 새 보관본 생성과 기존 보관본 추출은 서로 다른 실행입니다. 아래 두 줄 중 목적에 맞는 한 줄만 실행합니다.

실행 cwd=GAME:

```sh
node tools/archive-game-sources.mjs --out "$ARCHIVE" --verify-extract "$RESTORED"
node tools/archive-game-sources.mjs --extract "$ARCHIVE" --verify-extract "$RESTORED"
```

archive와 receipt를 전달할 때 링크를 따라 각각 복사하고 다시 SHA를 검사합니다. 원본 receipt의 절대 경로·prompt·명령은 역사 자료입니다. 복원 resolver는 상대 경로와 SHA mapping으로 파일을 찾고 원래 개인 디렉터리로 돌아가지 않습니다. RECEIPT와 POINTER는 provenance-map.json의 실제 receiptPath/jsonPointer 한 쌍입니다.

실행 cwd=RESTORED, 추출된 도구 사용:

```sh
node tools/archive-game-sources.mjs --verify-root "$RESTORED" --report "$REPORTS/resolved.json"
node tools/archive-game-sources.mjs --verify-root "$RESTORED" --receipt "$RECEIPT" --pointer "$POINTER"
node tools/build-game.mjs --root "$RESTORED" --out "$BUILD" --report "$REPORTS/restored-build.json"
```

전체 resolver는 source-manifest의 파일 SHA·inputDigest·필수 pointer 집합을 검증합니다. tar traversal·절대 경로·링크·중복 entry는 추출 전에 거부합니다. 원래 checkout 도구에 `--root`만 바꾸면 도구 독립성의 증명이 아닙니다. 추출된 tools를 사용해 빌드하고 그 출력으로 package 명령을 실행합니다. syntheticFixture=false와 release/index/SW·모든 출력 SHA를 보관본의 버전별 근거에 대조합니다. 최종 전달은 고정 소스와 같은 release의 archive 및 실제 복원 근거를 사용합니다. Task39에서 새 archive와 복원·렌더·빌드·package를 검증한 뒤 Task41까지 입력이 같으면 그 근거를 유지하고 최종 package 위치에 결속합니다. Task32 역사 snapshot으로 실행한 근거는 해당 역사 범위를 명시합니다.

원본 접근 차단은 단순 경로 검색으로 대체하지 않습니다. 소유 실행에만 적용되는 OS 정책으로 원본 checkout·생성 cache·Downloads 읽기를 막고 허용·거부 sentinel을 Node와 외부 child에서 실제 확인합니다. extracted render/build/package의 읽기 audit과 모든 child 종료 기록을 함께 보관합니다. 소유 temp를 허용하되 다른 사용자 폴더의 권한이나 이름을 바꾸지 않습니다. 해시가 맞아도 서명이나 주관적 품질 보증은 아닙니다.

<a id="production"></a>
## 자산과 음원 수정

원본 자산 관계는 docs/design/game-asset-manifest.json입니다. 일반 POOL44종과 QP를 포함한 allChars45 ID를 구분합니다. 신규 raster BASE125 = 캐릭터47 + 환경21 + 아이템14 + 부품35 + 자동차8. EXPORT185 = BASE125 + 카드 thumbnail47 + PWA icon3 + draw crop2 + 자동차 thumbnail8이며 required175 + optional10입니다. thumbnail은 실제144×216, 화면72×108입니다. 185개나175개를 원화 수로 보고하지 않습니다.

자산 추가는 실제 생성 원본·master·export의 SHA, prompt·참고·수정 이력, assetId/path/masterPath/masterSha256/reference/reviewReceipt를 함께 갱신합니다. 얼굴은 cardId/side, 장비는 실제 item.fit(allChars())의103호환 pair와107 placement를 따릅니다. qp-1470/arrow1쌍과 PHS/arrow, Al-Si HPF의 arrow·iron·spark 추가 alt4행을 빠뜨리지 않습니다. background→rear equipment→plinth→character→front equipment→frame→실시간 text의 실제 합성 레이어를 유지합니다. 여섯 계열, 전후 물성, RA/EL/TS와 특수 frame 의미를 보존하고 얼굴·문장 alpha 교차는≤1%로 검수합니다. 이미지를 UI 스크린샷으로 대체하지 않습니다. 상세 크기·검수·provenance는 기존 [제작 원본 가이드](design/game-production.md), [manifest](design/game-asset-manifest.json), [검수 계약](design/game-reviews/README.md)을 재사용합니다.

음악은 src/audio/{score,patches,mix,cues}.json과 seed20261025로 직접 작곡·합성합니다. 원본 BGM4곡 + SFX24종 = logical28/WAV master28, runtime32 = BGM4×2codec + SFX24입니다. 외부 sample·유료 서비스·API key가 필요하지 않습니다. runtime audio 총6,790,887바이트는 Task36에서 확인한 당시 값이며 이후 변경 시 manifest의 실측 합계로 갱신합니다. 원본 waveform·master를 runtime bytes에 합치지 않습니다.

RERENDER는 빈 소유 폴더에 추출된 score/patches/mix/cues 네 JSON만 복사한 곳입니다. AUDIO_COPY는 추출본 src/audio 전체를 복사한 별도 소유 작업 root입니다. render/encode는 파일을 쓰므로 production 소스에 root를 지정하지 않습니다. 실행 cwd=RESTORED:

```sh
node tools/audio/render.mjs --all --seed 20261025 --root "$RERENDER"
node tools/audio/encode.mjs --all --root "$AUDIO_COPY"
```

재현 검사는 생성한28 master를 archived manifest SHA와 전수 대조합니다. encode는 codec 버전과 manifest를 기록하고 실제 decoder·browser buffer 길이로 AAC priming/loop period를 확인합니다. container duration으로 loop를 추정하지 않습니다. [음원 제작 기록](../src/audio/README.md)과 [runtime 계약](../src/game/audio-runtime.md)을 따릅니다. Task36의779 기술 검사·7 negative fixture·411 preview audit·82 native controls는 해당 버전의 역사 검증입니다. 최종40의 결과 수가 아닙니다. 실제 decode·native clock은 주관적 청취나 physical iOS·헤드폰 검증을 뜻하지 않습니다.

<a id="storage"></a>
## 저장·교육용 가져오기와 운영 경계

LS sgg_game_save_v1, IDB sgg_game/save의 같은 키, 별도 sgg_game_preferences_v1을 사용합니다. 웹툰·설치의 game 전용 키도 경제 진행과 분리합니다. 게임 export는 SGG-GAME1.이며 원본 진행 compact pack만 포함합니다. 교육용 SGG1.은 일반 복원에서 받지 않고 명시적인 교육용 가져오기로만 처리합니다. detached 검증→요약 미리보기→취소 또는 이전 진행 복구 코드 보관→게임 진행 교체 확인→한 번 적용 순서입니다. 자동 가져오기·병합·교육용 키 쓰기는 없습니다. QP/arrow를 포함한 known45 ID/103호환 관계와 재고·발견·아이템 정합성을 검사합니다.

출하·제작·차량 지급은 연출·오디오보다 먼저 메모리에서 한 번 처리하고 저장을 시도합니다. durable 저장 거부는 현재 메모리 결과와 경고·내보내기 접근을 유지하며 이미 적용된 결과를 소리 실패로 롤백하지 않습니다. 복구 코드는 현재 페이지 메모리에만 있으며 reload 시 사라집니다. 수동으로 보관하지 않은 코드를 복구할 수 있다고 안내하지 않습니다.

지원 배치의 기본은 교육용과 별도 origin입니다. 같은 origin의 실제 분리 경로·SW scope는 Task33이 확인한 조건과 증거 범위에서만 해석합니다. 같은 origin의 루트 교육 SW와 game scope 겹침은 지원하지 않습니다. Task33의 실제 coexistence·업데이트 근거 범위를 확인합니다. partial offline은 critical 파일과 이미 캐시된 optional 파일만 재사용합니다. 미캐시 음원은 무음으로 기능을 이어가며 전곡·전체 자산 offline이나 OS 설치를 보장하지 않습니다. 업데이트는 실제 새 버전 안내와 명시 동작을 따릅니다. 로컬 성능 검사는 배포 CWV가 아닙니다. native select 물리 키보드 선택, 실제 OS200% 확대, physical iOS와 음악 청취는 별도 실제 근거가 없으면 미확인입니다.

<a id="qa"></a>
## 문서 계약과 전체 검증 입력

문서 case는 Markdown 명령을 실행하지 않습니다. 아래 allowlist metadata와 shell 표기를 정적으로 대조하고 고정된 help/list 인자만 별도로 실행합니다. local link/anchor, namespace, 수량, archive/receipt SHA, 실제 새 restore/render/build/package/차단 근거를 검사합니다. 외부 SGG_DOCUMENTATION_INPUTS는 절대 경로의 실제 입력 JSON입니다. 누락·미해결 변수·0tests·바뀐 SHA·과거 실행을 새 실행으로 주장하면 실패합니다. fresh restore 작업은 기본180초 case 밖에서 먼저 실행하며 case가 그 결과를 검증합니다.

전체 checkout에서 SGG_PACKAGE_ROOT는 현재 실제 relocated production package, SGG_BASELINE_ROOT는 원본137 baseline, SGG_EDUCATION_ROOT는 교육219 baseline입니다. education.tar는 교육 baseline의 형제 파일이어야 합니다. SGG_EDITION_EVIDENCE_ROOT는 실제 packages.json을 담은 RUN/edition-inputs이며 ../baselines/education이 RUN/baselines/education으로 해석되어야 합니다. A는 현재 frozen package에 연결하고 B/C도 현재 템플릿 뒤에 각각 정확한 UTF-8 `\n<!-- SGG final edition B -->\n`, `\n<!-- SGG final edition C -->\n`만 덧붙인 소유 복사본에서 새 strict build로 만든 서로 다른 release여야 합니다. 목록은 A/B/C 순서를 지키고 모든 다른 build input은 A와 같아야 합니다. 입력 hash 일치는 빌드 시각의 증거가 아니므로 새 명령의 실제 종료 코드·report·source recipe를 별도로 확인합니다. 과거 Task33/E35/E36, synthetic fixture 또는 임의 release ID로 대체하지 않습니다. QA child는 환경 변수를 상속합니다.

실행 cwd=GAME:

```sh
node tools/game-qa.mjs --case documentation-contract --engines chromium --evidence "$EVIDENCE"
```

SGG_DOCUMENTATION_INPUTS의 schemaVersion은1입니다. 필수: runStartedAt(실제 새 실행 시작 ISO), scope(task39 또는 frozen), packageRoot, archive{scope(task32-historical 또는 frozen),file,receipt,restoredRoot,expectedReleaseId}, rerenderRoot, restoredBuildRoot, restoredPackageRoot, parameters(위 NAME의 실제 값), commands{extract,resolver,render,build,package,denial}(각 실제 *.command.json 절대 경로), audits{guard,resolver,render,build,package}(Task32 read-audit 형식 NDJSON), forbiddenRoots(차단한 원본 root 목록), denialPolicy(실제 OS 정책 파일; 각 audited 명령 argv와 결속), receiptFiles(추가 보관한 실제 파일 path/SHA/bytes 배열). 명령 receipt는 cwd/argv/start/end/code/signal/timedOut/status/pid를 포함합니다. stdout의 PASS 문자열로 대체하지 않습니다. guard audit에는 Node의 EPERM/EACCES 거부와 외부 child exit1 및 허용 child exit0가 있어야 합니다. 실제 실행과 immutable SHA 근거가 갖춰진 후에만 이 입력을 작성합니다. 초기 빈 예제나 가짜 경로는 통과 입력이 아닙니다.

### 최종 통합 뒤의 실행 계약 — 현재 미적용·미실행

통합된 Task40 도구는 `SGG_PACKAGE_ROOT`·`SGG_BASELINE_ROOT`·`SGG_EDUCATION_ROOT`·`SGG_EDITION_EVIDENCE_ROOT`·`SGG_DOCUMENTATION_INPUTS`·`SGG_TASK_RECEIPT_INPUTS`를 실제 절대 입력으로 요구합니다. edition 변수는 packages.json을 담은 디렉터리이며 A는 현재 F package, B/C는 fresh comment-only 실제 production release입니다. 경로·report·receipt가 아직 없으면 가짜 값이나 과거 package로 채우지 않습니다.

통합 적용과 help/list 확인 이후 Task40은 `node tools/game-qa.mjs --case final-suite --engines chromium,webkit --evidence "$E/task-40"`로 실행합니다. orchestrator는 `npm run test:contracts`와 아래 여섯 Node 범주를 별도 실행하고 browser 고유 case 수에 중복 합산하지 않습니다. API 설치만으로 실제 전체 실행 성공을 뜻하지 않습니다.

Task41은 `node tools/package-game.mjs --out "$E/task-41/site" --verify` 뒤 `SGG_PACKAGE_ROOT`를 그 실제 package로 지정하여 packaged-smoke를 Chromium/WebKit에서 실행하고, 최종 archive의 새 복원·WAV·strict build/package proof를 `scope=frozen` 문서 계약에 공급합니다. Task42 delivery-links와 F1 receipt-audit는 `SGG_RELEASE_SET`·`SGG_DELIVERY_HUB`·`SGG_PREVIEW_RECEIPT`의 실제 절대 파일을 요구합니다. 이 외부 입력·case의 실제 후속 실행은 최종 산출물이 준비된 뒤 수행합니다. 최종 증거의 정확한 경로와 live URL은 해당 실행 receipt를 읽어 사용합니다.

case별 시간 제한은 실제 runner/config를 따릅니다. 현재 승인된 예외는 accessibility 540000/550000ms, edition-e2e와 audio-final 각각240000/250000ms, audio-runtime300000/310000ms, art-full-review600000/610000ms이며 나머지는180000/190000ms입니다. 이것은 Playwright global/child 실행 예산이며 decoder15초·제품 성능·음향 품질 기준 변경이 아닙니다. aggregate 전체를 단일 case 한도로 감싸지 않습니다.

Task40 freeze 전에 문서·generator·validator code를 준비합니다. Fsource→40검사/41archive, Fpackage→40/41/42를 외부 receipt로 연결하고 archive 자기 해시를 문서에 박아 넣지 않습니다. 41/42의 미래 파일은 실제 외부 입력으로 제공하며 없으면 관련 최종 검사가 실패해야 합니다. freeze 이후 source/test/doc generator 변경은40 재실행과41 재결속이 필요합니다. Node publication·preflight·placement-publication·archive와 decoder-input/decoder-timeout을 별도로 실행하며 Playwright discovery로 대신하지 않습니다. 사례별 승인 deadline은 현행 runner 설정을 따릅니다. 과거500/50 또는 개별58개 결과를 전체 최종 수로 쓰지 않습니다. E/final은 보존한 부분 이력, E/final-full은 새 F1–F4용입니다. 42개 원계획 +43–47 후속 +F1–F4 =51개이며 독립 검토와 사용자의 명시적인 최종 인수 전 전체 완료를 선언하지 않습니다.

<!-- sgg-documentation-contract:v1 -->
```json
{
  "schemaVersion": 1,
  "edition": "game",
  "branch": "게임용",
  "educationTag": "education-v1",
  "educationCommit": "d3f52b6f3c79d6ccb579d362953242631b832a74",
  "rulesBaseline": "6784048524c722b7d1057cb28e372b6cce5dc6cf",
  "routes": [
    "workshop",
    "dex",
    "craft",
    "research",
    "garage"
  ],
  "aliases": {
    "learn": "research",
    "learning": "research"
  },
  "persistence": {
    "writeKeys": [
      "sgg_game_save_v1",
      "sgg_game_preferences_v1"
    ],
    "database": "sgg_game",
    "store": "save",
    "exportPrefix": "SGG-GAME1.",
    "educationImportPrefix": "SGG1.",
    "automaticEducationImport": false,
    "merge": false
  },
  "counts": {
    "pool": 44,
    "allChars": 45,
    "faces": 47,
    "pairs": 103,
    "placements": 107,
    "base": 125,
    "requiredExports": 175,
    "optionalExports": 10,
    "exports": 185,
    "thumbnails": 47,
    "audioBGM": 4,
    "audioSFX": 24,
    "audioMasters": 28,
    "audioVariants": 32
  },
  "parameters": [
    "GAME",
    "BUILD",
    "SITE",
    "REPORTS",
    "ARCHIVE",
    "RESTORED",
    "RERENDER",
    "AUDIO_COPY",
    "EVIDENCE",
    "RECEIPT",
    "POINTER"
  ],
  "commands": [
    {
      "id": "build-help",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/build-game.mjs",
        "--help"
      ]
    },
    {
      "id": "package-help",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/package-game.mjs",
        "--help"
      ]
    },
    {
      "id": "qa-list",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/game-qa.mjs",
        "--list"
      ]
    },
    {
      "id": "build",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/build-game.mjs",
        "--out",
        "$BUILD",
        "--report",
        "$REPORTS/build.json"
      ]
    },
    {
      "id": "package",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/package-game.mjs",
        "--root",
        "$BUILD",
        "--out",
        "$SITE",
        "--verify",
        "--report",
        "$REPORTS/package.json"
      ]
    },
    {
      "id": "archive",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/archive-game-sources.mjs",
        "--out",
        "$ARCHIVE",
        "--verify-extract",
        "$RESTORED"
      ]
    },
    {
      "id": "extract",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/archive-game-sources.mjs",
        "--extract",
        "$ARCHIVE",
        "--verify-extract",
        "$RESTORED"
      ]
    },
    {
      "id": "resolve",
      "cwd": "RESTORED",
      "argv": [
        "node",
        "tools/archive-game-sources.mjs",
        "--verify-root",
        "$RESTORED",
        "--report",
        "$REPORTS/resolved.json"
      ]
    },
    {
      "id": "resolve-one",
      "cwd": "RESTORED",
      "argv": [
        "node",
        "tools/archive-game-sources.mjs",
        "--verify-root",
        "$RESTORED",
        "--receipt",
        "$RECEIPT",
        "--pointer",
        "$POINTER"
      ]
    },
    {
      "id": "render",
      "cwd": "RESTORED",
      "argv": [
        "node",
        "tools/audio/render.mjs",
        "--all",
        "--seed",
        "20261025",
        "--root",
        "$RERENDER"
      ]
    },
    {
      "id": "encode",
      "cwd": "RESTORED",
      "argv": [
        "node",
        "tools/audio/encode.mjs",
        "--all",
        "--root",
        "$AUDIO_COPY"
      ]
    },
    {
      "id": "restored-build",
      "cwd": "RESTORED",
      "argv": [
        "node",
        "tools/build-game.mjs",
        "--root",
        "$RESTORED",
        "--out",
        "$BUILD",
        "--report",
        "$REPORTS/restored-build.json"
      ]
    },
    {
      "id": "contract",
      "cwd": "GAME",
      "argv": [
        "node",
        "tools/game-qa.mjs",
        "--case",
        "documentation-contract",
        "--engines",
        "chromium",
        "--evidence",
        "$EVIDENCE"
      ]
    }
  ],
  "preview": null
}
```

SGG_TASK_RECEIPT_INPUTS는 원본 형식 회귀 검사를 위한 외부 JSON입니다. schemaVersion=1, tasks는 완료된 원본 작업1–38·43–46의 task/claims[]/verifications[]이며 각 참조는 실제 raw file의 path/bytes/sha256입니다. Task36은 부모 closure를 parentClosure로 연결합니다. rejected[]는 task와 실제 과거 거절 artifact를 담습니다. 이 파일은 F 실행 시작·끝에 바이트 결속합니다. 최종 SGG_RELEASE_SET.tasks도 claims[]와 verifications[]를 직접 연결하며, 복합 작업의 원본·수리 claim을 모두 보존합니다. 작업 번호 없는5·12·36은 검토된 원본 SHA와 scope/closure의 제한된 형식으로만 연결합니다. 형식 통과는 최종 F1의 source scope·현재 case·의미 coverage 독립 승인을 대신하지 않습니다.
