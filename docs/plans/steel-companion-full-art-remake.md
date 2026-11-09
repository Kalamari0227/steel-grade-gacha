# steel-companion-full-art-remake - Work Plan

## TL;DR (For humans)
**Who this is for and what changes for them:** 수집 게임을 즐기는 동료와 일반 플레이어에게, 모든 캐릭터와 장착 모습이 같은 세계의 갖고 싶은 금속 피규어로 보이는 게임을 만듭니다. 소유자는 정확한 그림 버전과 실제 플레이를 직접 확인하고 승인합니다.

**What you'll get:** 캐릭터·장비·부품·차량·배경·프레임·아이콘의 전량 새 원화와 모든 유효 장착 모습, 선택해서 읽는 일본어 대사를 준비합니다. 아트 승인 뒤에는 출하와 도감 감상이 연결된 체험을 검증하고 전체 게임과 오프라인 패키지까지 완성합니다.

**Why this approach:** 그림이 먼저 만족스러워야 수집하고 싶은 게임이 됩니다. 대표 그림, 전체 그림, 실제 체험을 순서대로 직접 승인하고, 체험이 검증된 뒤에 전체 화면과 기술 계약을 확정합니다.

**What it will NOT do:** 미승인 그림으로 개발을 앞당기거나 옛 승인 기록을 새 승인으로 바꾸지 않습니다. 교육판·기존 저장·확률을 바꾸지 않으며, 전투 수치·유료 재화·전면 일본어화·음성을 추가하지 않습니다. 별도 요청 없이 공개 배포하거나 비용이 드는 외부 제작으로 전환하지 않습니다.

**Effort:** XL
**Risk:** High — 전량 원화의 품질·인물 일관성·자연스러운 복수 장착과 실제 체험을 모두 만족해야 합니다.
**Decisions to sanity-check:** 제공한 별도 SSR 이미지를 스타일 기준으로 사용하며, 모든 그림과 장착 모습을 직접 승인합니다. 한국어는 기본으로 유지하고 일본어 대사는 카드 상세에서 선택해 펼칩니다.

Your next move: 계획을 실행하는 별도 작업을 시작하거나, 먼저 고정밀 계획 검토를 선택합니다. 이 문서 작성은 제작·개발 시작 승인이 아닙니다. Full execution detail follows below.

---

> TL;DR (machine): XL / High; 8 waves, 38 todos + F1–F4; 47 base faces + 254 equipped appearances + every art use, 47 Korean/Japanese dialogue keys, G-REP→G-ART→isolated prototype→G-EXPERIENCE→official integration; no execution/commit/deploy authorization implied.

## Scope
### Affected user and ideal state
**Affected user:** 회사 동료와 일반 수집 게임 플레이어는 원화·출하·도감·제작을 즐긴다. 제품 소유자는 원화와 체험의 품질을 직접 판정한다. 제작자·구현자·검증자는 같은 ID·버전·승인 근거로 인계한다. 현재의 구 시안·기술 approved 기록에서, 전량 새 아트의 직접 승인과 실제 플레이 검증이 연결된 상태로 옮긴다.

| Row | Statement | Reason |
| --- | --- | --- |
| IS-1 | 지정 SSR 수준으로 모든 일러스트가 단독으로 갖고 싶고 낮은 별도 매력적이다. | 원화가 게임의 핵심이다. |
| GAP-1 | 별도 SSR 원본은 확보됐지만 제작 명세·새 전량 아트는 없다. | 과거 125점·175개 approved를 새 품질로 승계할 수 없다. |
| IS-2 | 여섯 계열·47면·모든 장착 외형이 정체성과 자연스러운 접점을 유지한다. | 수집·열처리·장착의 차이가 그림에서 읽혀야 한다. |
| GAP-2 | 구 107배치는 복수 장착 147외형까지 검토하지 않았다. | 단일 장비 승인으로 모든 조합을 승인할 수 없다. |
| IS-3 | 모든 새 그림의 정확한 버전과 직접 사용자 판단을 추적하고 미승인 상태에서 개발하지 않는다. | 제작 편의로 품질 관문이 무너지지 않아야 한다. |
| GAP-3 | 새 버전·조합별 사용자 승인대장과 전량 게이트가 없다. | 기술 통과·무응답은 사용자 승인이 아니다. |
| IS-4 | 공방→출하→결과→도감 재열기가 등급별 기대감과 감상 욕구를 이어 준다. | 반복 수집의 즐거움이 핵심 경험이다. |
| GAP-4 | 기존 1.45초·standard/special 표현은 새 등급별 경험과 다르다. | 체험 승인 전 공식 계약을 고정하면 검증이 경험을 제한한다. |
| IS-5 | 제작·연구·장착·차고·모든 그림 사용처가 같은 세계로 완성된다. | 일부 화면만 바꾸면 수집 게임의 몰입이 끊긴다. |
| GAP-5 | 구 고정 수량·배치·화면 계약은 새 아트 구조와 충돌한다. | 체험 후 공식 계약·빌드·패키지를 함께 정리해야 한다. |
| IS-6 | 경제·저장·원래 정보·접근성은 유지되고 검증 부산물이 과도하게 쌓이지 않는다. | 멋진 표시가 재추첨·중복 지급·데이터 손실을 일으켜서는 안 된다. |
| GAP-6 | 안전 검사는 존재하지만 구 시간 조건과 trace:on이 섞여 있다. | 필요한 회귀와 실패 증거를 보존하며 검증 비용을 제한한다. |
| IS-7 | 한국어 원문과 47면 각각의 자연스러운 일본어 대사를 선택적으로 읽는다. | 열처리 전후의 서로 다른 대사도 누락하면 안 된다. |
| GAP-7 | 기본45개의 line과 두 alt.line에 대응하는 일본어·면 키·표시 검증이 없다. | 원문·실제 명칭을 보존하면서 대사 요청을 완결해야 한다. |

### Must have
- 기준 파일: `.omo/drafts/steel-companion-full-art-remake-support/ssr-style-reference.png`, 1024×1536, SHA-256 `c16d8c26291d5d8c6bd511a59b51a7e9c3f85bc0fcc9fbf5fc100ca31d4ccdd3`. 원 첨부 경로는 `/var/folders/h8/0gmz_l9n0l3bdjb3tkk5k8sh0000gn/T/codex-clipboard-cae0a0d1-d082-4b23-887b-950ad29e2da6.png`이며 실행 시 이 임시 경로에 의존하지 않는다.
- 45 ID/47면(PO9·CR13·GA14·WR9·EG1·QP1), 보증 장비14, 부품35(바디10·프레임10·섀시/구동15), 차량8 및 그림 사용처 전량. 원본의 ITEMS.fit와 모든 부분집합을 기준으로 장착254(단일107+복수147), 무장착47까지 총301 외형을 검토한다. 파일 수와 승인 단위 수는 다르다.
- 모든 배경·무대·받침·프레임·코일·봉인·아이콘·실루엣·게임 화면의 서사 그림·파생 이미지를 목록에 추가한다. 기존 125/175는 역사적 수량이지 새 상한이 아니다.
- 약2.5등신·친근한 검은 타원 눈과 짧은 입·PBR 금속·낮은3/4·우상단 역광/금빛 림라이트를 공유하되 여섯 계열의 투구·얼굴 패널·재료·엠블럼·체형은 구별한다. ★2 연질도 단독 매력을 갖춘다.
- 레이어 제작을 우선 시험하되 손·팔·장갑 접점·장비 크기·가림·지지·그림자 문제가 있으면 해당 모습 자체를 재작화한다. 최종 정적 모습301개 모두 직접 사용자 승인 대상이다.
- 새 staging은 `.omo/artwork/steel-companion-full-art-remake/{references,identity,masters,appearances,review,approvals,manifest,derived}`. 과거 원본·receipt와 새 기록은 경로·의미를 분리한다.
- 대표 사용자 승인 G-REP → 전량 제작 → **전체 그림 사용자 승인 G-ART** → 격리 체험판 → **체험 사용자 승인 G-EXPERIENCE** → 공식 계약·본 개발 순서를 지킨다. 대표 실패는 품질을 맞출 때까지 아트 단계에서 수정하며 전체 범위를 줄이지 않는다.
- 한국어 기본, 카드 상세의 선택형 일본어 대사. `cardId+side` 47키, 한국어 원문 보존, 자연스러운 번역·용어집·열처리 전후 구분. 예시 `小さな存在が、大きな未来をつくる。`는 별도 선택 문구로 기록하고 원본47대사를 대체하지 않는다.
- 원래 강종·확률·RARE·스크랩·10연 보장·픽업·QP·재고·장비·제작·차량 조건·저장/백업 안전·키보드·감소모션·스킵을 유지한다. 기존 오디오 자산·cue를 유지하고 승인된 타임라인에 동기화하며 새 음악 제작은 요구하지 않는다.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- 이 계획 작성 자체로 아트 제작·코드 수정·테스트 실행·커밋·푸시·PR·배포·유료 호출·외부 의뢰를 시작하지 않는다. 실행 시작은 별도 worker 세션의 명시적 요청으로 받는다.
- G-ART 전 게임 코드·런타임 schema·UI·애니메이션·인터랙티브 검토 도구·체험판 브랜치·worktree 착수 금지. 새 helper 프로그램을 요구하지 않는다. 기존 검사 함수와 아래 inline 읽기 전용 명령, FFmpeg 정적 파생만 사용한다.
- G-ART 이후에도 G-EXPERIENCE 전 공식 manifest/schema/contract·기존 테스트 조건을 새 경험으로 개정하지 않는다. 체험판의 격리 adapter·최소 검증만 허용한다.
- SSR/LV.5/ATK·DEF·SPD·INT·LUCK를 게임 데이터로 가져오거나 이름·별·물성·버튼·대사를 원화에 굽지 않는다. 실제 TS·EL/RA와 기존 이름을 쓴다. 전면 UI 현지화·음성·유료 번역은 추가하지 않는다.
- 구 그림 리사이즈·좌표만 바꾼 합성을 새 리메이크로 보고하거나 구 approved·에이전트 통과·사용자 무응답을 새 승인으로 기록하지 않는다. 자동 approved receipt 생성 금지.
- `repo/` 교육판, 기존 저장 데이터, 실행 중인 사용자 서버, 구 승인 기록, 사용자 미추적 `game-edition/docs/design/game-replan-2026-10-31.md`를 덮어쓰거나 정리하지 않는다. 기존 export.mjs는 src와 receipt를 덮으므로 호출하지 않는다.
- 전투·유료 재화·새 계정/서버·새 프레임워크·원본 서사 재집필·확률 변경·저장 schema 변경·승인 없는 대규모 삭제를 추가하지 않는다. 모델 기본값·내부 DB·세션 파일을 변경하지 않는다.

## Verification strategy
> 기술 검증은 전부 에이전트가 실행한다. 사용자 직접 미적 판단·전량 아트 승인·체험 승인은 제품 요구이므로 agent-only QA와 별개인 필수 정지 관문이다. 기술 검사로 승인 결정을 만들어 내지 않는다.
- Test decision: 아트 단계는 새 테스트/도구 구현 없이 기존 파일 검사와 정적 이미지 QA; 코드 단계는 **tests-after**, 기존 Node/Playwright 및 실제 Chromium/WebKit 조작. 실패 경로도 같은 작업에서 검증한다.
- Evidence: ulw-loop이면 status의 currentAttemptDir를 쓰고, 그 밖에는 새 소유 폴더 `.omo/evidence/steel-companion-full-art-remake/<UTC-and-uuid>/`를 쓴다. 아래 `SGG_EVIDENCE`는 이 절대 경로다. 모든 결과는 `task-N/`에 기록하며 원본 명령·exit code·입력 SHA·실제 관찰·스크린샷/비교판을 묶는다.
- 대표/전량/체험 사용자 판단은 `approvals/user-decisions.jsonl`에 원문 인용·대상 버전 목록·시각·원 chat/message 식별 또는 저장한 대화 근거를 남긴다. 단순 에이전트 로그는 미적 통과 근거가 아니다. `pending`/`changes-requested`는 stop이다.
- 작업1–24는 내장 `image_gen.imagegen`만 이미지 제작 수단으로 사용한다. 호출 전 imagegen SKILL을 읽고 기존 이미지는 먼저 직접 열람한다. 유료 API/CLI/외주 자동 fallback 금지. 도구 불가·일관성 실패는 사용자에게 실제 한계를 보고하고 관문을 유지한다.
- 결과물이 실제로 보이는지 전신·72px·프레임 없는 비교·같은 인물3자세·동일 세계 합성을 직접 이미지 열람으로 판정한다. grep·JSON PASS·worker 보고만으로 시각 품질을 완료 처리하지 않는다.

### 공통 경로와 데이터 계약
아래 명령은 **미래 실행 레시피**이며 계획 작성 중 실행하지 않는다. 모든 셸 레시피는 프로젝트 루트에서 시작한다. `SGG_GAME`은 G-ART 전 원본 `game-edition`, 이후 작업25에서 만든 격리 worktree다. 변수는 현재 셸에만 두며 HOME/CODEX_HOME를 재정의하지 않는다.

```sh
export SGG_PROJECT='/Users/ethanlee/Desktop/steel-grade-gatcha'
export SGG_ART="$SGG_PROJECT/.omo/artwork/steel-companion-full-art-remake"
export SGG_GAME="$SGG_PROJECT/game-edition"
export SGG_ORIGINAL_GAME="$SGG_PROJECT/game-edition"
export SGG_BASELINES_ROOT="$SGG_PROJECT/.omo/evidence/game-edition/game-20261025-01a16bac/baselines"
export SGG_EVIDENCE="$SGG_PROJECT/.omo/evidence/steel-companion-full-art-remake/$(date -u +%Y%m%dT%H%M%SZ)-$(python3 -c 'import uuid; print(uuid.uuid4().hex[:8])')"
mkdir -p "$SGG_EVIDENCE"
mkdir -p "$SGG_EVIDENCE"/task-{1..38} "$SGG_EVIDENCE"/final/{F1,F2,F3,F4}
```

작업3이 문서·JSON으로 고정하는 staging 계약(앱 schema와 무관):
- `manifest/scope.json`: schemaVersion1, 입력 `sourceHashes`(프로젝트 상대 경로→SHA), `faces`, `appearanceKeys`, `expectedTargets`(targetKey/kind/batch/identityRefs/usageIds), `batches`(batch→정렬된 targetKey 배열), `uses`(sourcePath/line/excerptSha256/targetKeys/disposition/reason). 모든 사용처는 mapped 또는 명시된 non-art 근거를 갖는다. 새 무대·파생물도 expectedTargets에 먼저 추가한다.
- `manifest/art-inventory.json`: schemaVersion1, referenceSHA, `targets`. 각 행은 `targetKey`, `kind`, `batch`, `cardId`/`side`/정렬된`equipmentKeys`(해당 시), `version`, `outputPath`, `outputSHA`, `mime`, `width`, `height`, `alphaRequired`, `files`(구성 파일 path/SHA), `reviewFiles`(full/72/identity3 등 role/path/SHA), `identityRefs`, `usageIds`, `renderSpec`(단일 raster 또는 정렬된 layer·transform·mask·각SHA), `referenceSHA`를 가진다. 경로는 staging 상대 경로이며 `..`·외부 파일을 허용하지 않는다.
- targetKey 외형 표기: `appearance:<cardId>:<front|alt>:<sorted-equipment-keys joined by + 또는 none>`. 장비·부품·차량은 `item:<key>`, `part:<key>`, `car:<key>`; 나머지는 사용처별 안정 ID. 301개의 외형은 모두 독립 승인 단위다. 레이어일 때도 승인 outputSHA는 최종 정적 합성 PNG의 SHA이며 구성 SHA 또는 renderSpec 변경 시 새 version/재승인이 필요하다.
- `approvals/user-decisions.jsonl`: 각 직접 사용자 판단은 decisionId/decisionSource=`user`/decision=`approved|changes-requested|pending`/date/quote/evidencePath와 `targets` 배열을 갖는다. targets는 targetKey/cardId/side/sortedEquipmentKeys/version/outputSHA/referenceSHA/reviewedSizes를 모두 바인딩한다. 일괄 승인은 사용자가 확인한 정확한 목록만 전개한다. 과거 결정은 append 보존하며 최신 파일과 일치하는 명시적 승인만 인정한다.
- `approvals/gates.json`: G-REP/G-ART/G-EXPERIENCE별 status=`pending|approved`, decisionIds, inventorySHA, scopeSHA, issuedAt. G-ART는 활성 expectedTargets 전체 및301외형의 일치 승인, G-REP는 대표 목록만, G-EXPERIENCE는 체험 buildSHA·art gateSHA·시나리오·사용자 결정을 연결한다. 템플릿 초기값은 모두 pending이다.
- 원화 master는 실제 생성 결과 원본 PNG를 보존한다. 이 계획의 새 제작/파생 규격은 캐릭터 기준 master1024×1536, 투명 export960×1440(내부864×1296+48/72 pad), thumb144×216·72×108 proof다. 원본 생성 크기가 다르면 비율을 지키고 crop 없이 이 규격으로 파생하며 원래 크기를 provenance에 기록한다. 장비768²·부품960×640·차량1200×800, 배경/장면1536×1024의 배포용 export를 쓰고 master는 실제 원본 그대로 보존한다. 무대/새등급프레임은960×1440·투명 중심, PWA192/512/180은 실제 표시 규격이다. 새 프레임 개수와 부품 export 규격은 이 계획이 정한 제작 명세이며 과거 강제 계약을 주장하지 않는다. 추가 규격은 inventory에 사용처와 함께 명시하고 이미지 왜곡 금지.

### 명령 레시피 Q-REF / Q-SCOPE / Q-FILES / Q-APPROVAL
각 작업의 QA는 아래 정확한 레시피를 인자와 함께 호출한다. 셸 함수는 현재 세션에 inline으로 정의하며 새 helper 파일을 만들지 않는다. 출력은 해당 task 디렉터리에 redirect하고 exit code를 기록한다. 실패 probe는 메모리 사본만 수정하고 실제 아트·대장에는 쓰지 않는다.

**Q-REF** (`q_ref`): 고정 기준 파일을 확인한다. 실패 시 작업을 진행하지 않는다.
```sh
q_ref() {
  python3 - "$SGG_PROJECT/.omo/drafts/steel-companion-full-art-remake-support/ssr-style-reference.png" <<'PY'
import hashlib,sys,subprocess,json
p=sys.argv[1]
assert hashlib.sha256(open(p,'rb').read()).hexdigest()=='c16d8c26291d5d8c6bd511a59b51a7e9c3f85bc0fcc9fbf5fc100ca31d4ccdd3'
m=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height','-of','json',p]))
assert (m['streams'][0]['width'],m['streams'][0]['height'])==(1024,1536)
print('PASS reference SHA/dimensions')
PY
}
```

**Q-SCOPE** (`q_scope`): 현재 실제 호환쌍·47면으로 모든 조합을 독립 계산한다. 기본 결과301행과 staging scope를 정확히 비교한다. `negative`는 일부 복수 조합 누락을 반드시 거부한다.
```sh
q_scope() {
  python3 - "$SGG_ORIGINAL_GAME" "$SGG_ART" "${1:-happy}" <<'PY'
import pathlib,sys,json,itertools,hashlib
g,a=map(pathlib.Path,sys.argv[1:3]); mode=sys.argv[3]
c=json.loads((g/'tools/game-assets/contract.json').read_text()); m=json.loads((g/'docs/design/game-asset-manifest.json').read_text()); s=json.loads((a/'manifest/scope.json').read_text())
expected=[]; singles=multi=0
for f in m['faces']:
 k=sorted({r['itemKey'] for r in c['compatiblePairs'] if r['cardId']==f['cardId']})
 for n in range(len(k)+1):
  for v in itertools.combinations(k,n):
   expected.append('appearance:'+f['cardId']+':'+f['side']+':'+('+'.join(v) or 'none')); singles+=n==1; multi+=n>1
assert (len({f['cardId'] for f in m['faces']}),len(m['faces']),singles,multi,len(expected))==(45,47,107,147,301)
actual=list(s['appearanceKeys'])
if mode=='negative':
 actual.remove(next(k for k in actual if '+' in k))
 assert sorted(actual)!=sorted(expected); print('PASS rejected omitted multi-equipment appearance'); sys.exit(0)
assert sorted(actual)==sorted(expected) and len(actual)==len(set(actual))
for p,h in s['sourceHashes'].items(): assert hashlib.sha256((g/p).read_bytes()).hexdigest()==h,p
assert len(s['expectedTargets'])==len({r['targetKey'] for r in s['expectedTargets']})
assert set(expected)<={r['targetKey'] for r in s['expectedTargets']}
print(json.dumps({'status':'PASS','faces':47,'single':107,'multi':147,'appearances':301,'allTargets':len(s['expectedTargets'])}))
PY
}
```

**Q-FILES** (`q_files <batch|all> [negative]`): 지정 batch 전체 target의 파일·구성·proof 해시, MIME·decode·크기·알파를 기존 `decode`로 확인한다. 실제 열람은 별도이며 이 출력이 미적 승인은 아니다.
```sh
q_files() {
  node --input-type=module - "$SGG_GAME" "$SGG_ART" "$1" "${2:-happy}" <<'JS'
import fs from 'node:fs'; import path from 'node:path'; import {createHash} from 'node:crypto'; import {pathToFileURL} from 'node:url';
const [g,a,batch,mode]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
const {decode,imageMime}=await import(pathToFileURL(path.join(g,'tools/game-assets/images.mjs')));
const s=JSON.parse(fs.readFileSync(path.join(a,'manifest/scope.json'))),i=JSON.parse(fs.readFileSync(path.join(a,'manifest/art-inventory.json')));
if(i.referenceSHA!=='c16d8c26291d5d8c6bd511a59b51a7e9c3f85bc0fcc9fbf5fc100ca31d4ccdd3')throw Error('wrong reference');
const keys=batch==='all'?s.expectedTargets.map(r=>r.targetKey):s.batches[batch]; if(!keys?.length)throw Error('unknown/empty batch');
const rows=keys.map(k=>{const rs=i.targets.filter(r=>r.targetKey===k);if(rs.length!==1)throw Error('missing/duplicate '+k);return rs[0];});
const read=p=>{const q=path.resolve(a,p);if(!q.startsWith(path.resolve(a)+path.sep))throw Error('outside staging');return fs.readFileSync(q);};
function check(r){const out=read(r.outputPath);if(sha(out)!==r.outputSHA||r.referenceSHA!==i.referenceSHA)throw Error('hash/reference');const d=decode(out);if(imageMime(out)!==r.mime||d.width!==r.width||d.height!==r.height||!d.visible||r.alphaRequired&&!d.transparent)throw Error('raster');if(r.kind==='frame'&&d.centerTransparent!==d.centerTotal)throw Error('frame center alpha');if(!r.files.length||!r.reviewFiles.length)throw Error('missing proof/components');for(const f of [...r.files,...r.reviewFiles]){const v=read(f.path);if(sha(v)!==f.sha256)throw Error('component/proof SHA');decode(v);}if(!r.version||!r.identityRefs.length||!r.usageIds.length)throw Error('identity/usage/version');}
if(mode==='negative'){const r=structuredClone(rows[0]);r.outputSHA='0'.repeat(64);let rejected=false;try{check(r);}catch{rejected=true;}if(!rejected)throw Error('accepted corrupted SHA');console.log('PASS rejected wrong output SHA');}else{for(const r of rows)check(r);console.log(JSON.stringify({status:'PASS',batch,targets:rows.length}));}
JS
}
```

**Q-APPROVAL** (`q_approval <batch|all> [negative]`): 해시 일치하는 직접 사용자 결정만 인정한다. 반려·미응답·다른 버전의 기록을 자동 승인하지 않는다. negative는 대기·오래된SHA·누락·에이전트 결정을 각각 거부해야 한다.
```sh
q_approval() {
  python3 - "$SGG_ART" "$1" "${2:-happy}" <<'PY'
import pathlib,json,sys,copy,hashlib
a=pathlib.Path(sys.argv[1]); batch,mode=sys.argv[2:4]
s=json.loads((a/'manifest/scope.json').read_text()); inv=json.loads((a/'manifest/art-inventory.json').read_text()); decisions=[json.loads(x) for x in (a/'approvals/user-decisions.jsonl').read_text().splitlines() if x.strip()]
keys=[r['targetKey'] for r in s['expectedTargets']] if batch=='all' else s['batches'][batch]
rows={r['targetKey']:r for r in inv['targets']}
def valid(ds,ks):
 for k in ks:
  r=rows[k]; matches=[(d,t) for d in ds for t in d['targets'] if t['targetKey']==k and t['version']==r['version'] and t['outputSHA']==r['outputSHA'] and t['referenceSHA']==r['referenceSHA']]
  if not matches:return False
  d,t=matches[-1]
  if d['decisionSource']!='user' or d['decision']!='approved' or not d['quote'] or not d['date'] or not (a/d['evidencePath']).is_file():return False
  if sorted(t['sortedEquipmentKeys'])!=sorted(r.get('equipmentKeys',[])) or t.get('cardId')!=r.get('cardId') or t.get('side')!=r.get('side'):return False
  if not {'full','72'}.issubset(set(t['reviewedSizes'])):return False
 return True
if mode=='negative':
 k=keys[0]; r=rows[k]; t={'targetKey':k,'version':r['version'],'outputSHA':r['outputSHA'],'referenceSHA':r['referenceSHA'],'sortedEquipmentKeys':r.get('equipmentKeys',[]),'cardId':r.get('cardId'),'side':r.get('side'),'reviewedSizes':['full','72']}
 base={'decisionSource':'user','decision':'approved','quote':'NEGATIVE FIXTURE ONLY','date':'2000-01-01','evidencePath':'manifest/scope.json','targets':[t]}
 cases=[[],[dict(base,decision='pending')],[dict(base,decision='changes-requested')],[dict(base,decisionSource='agent')]]
 old=copy.deepcopy(base);old['targets'][0]['outputSHA']='0'*64;cases.append([old])
 for c in cases:assert not valid(c,[k])
 print('PASS rejected missing/pending/rejected/agent/stale-hash decisions; fixtures never written')
else:
 assert valid(decisions,keys),'STOP: explicit matching user approval incomplete'
 print(json.dumps({'status':'PASS','approvedTargets':len(keys),'batch':batch}))
PY
}
```

### 정적 파생·사용처·문안 레시피
- **Q-DERIVE**: 캐릭터target별 master와 staging 새 출력 경로를 인자로 주어 `ffmpeg -v error -n -i "$SGG_MASTER" -vf 'scale=864:1296:flags=lanczos:force_original_aspect_ratio=decrease,pad=960:1440:(ow-iw)/2:(oh-ih)/2:color=black@0' -frames:v 1 "$SGG_EXPORT"`; `ffmpeg -v error -n -i "$SGG_EXPORT" -vf 'scale=72:108:flags=lanczos' -frames:v 1 "$SGG_PROOF72"`. 일반 비교는 `ffmpeg -v error -n -i "$SGG_LEFT" -i "$SGG_RIGHT" -filter_complex '[0:v]scale=360:540:force_original_aspect_ratio=decrease,pad=360:540:(ow-iw)/2:(oh-ih)/2:black[a];[1:v]scale=360:540:force_original_aspect_ratio=decrease,pad=360:540:(ow-iw)/2:(oh-ih)/2:black[b];[a][b]hstack' -frames:v 1 "$SGG_COMPARE"`. 비캐릭터파생은해당kind규격으로비율보존scale/pad하며원명령과원크기를기록한다. 모두 새 version 경로에만 출력한다. 프레임/마스크/텍스트 오버레이는 정적 검토에 한정하고 레시피·입력SHA를 provenance에 남긴다.
- **Q-USAGE**: `rg -n --glob '*.{html,js,css,mjs,json,webmanifest,txt}' 'IMG(_ALT|_ITEM|_PART|_CAR)?|src/(game/art|uiimg|toon)|url\(|scene:|background:|frame:|stage:|draw:|icon:' "$SGG_GAME/src" "$SGG_GAME/manifest.webmanifest" "$SGG_GAME/docs/design/game-screen-inventory.json" > "$SGG_EVIDENCE/task-2/usage-hits.txt"`. 작업2의 `scope.uses`는 이 각 hit의 상대 sourcePath/line/excerptSHA를 담고 source symbol에서 asset/새target까지 추적한다. 사용처별 mapped target 또는 실제 non-art 이유를 모두 적고 파일별 hit수·사용처수·추가 수동 발견 항목을 대조한 JSON을 남긴다. 실패 QA는 복제한 uses에서 frame·seal·icon 각각1행을 빼고 hit-key 집합 불일치를 확인한다.
- **Q-TEXT** (`q_text [negative]`): 아래 선언만 빈 VM에서 읽어 45기본+2alt의 원ko/자연스러운ja문안 구조를 검사한다. 전체 앱 실행/브라우저 import는 하지 않는다. `identity/dialogue-ja.json`은 `{schemaVersion:1,rows:[{cardId,side,ko,ja,translationNotes}],optionalMotto:{ko,ja}}` 형식이다. 의미·말투·용어집 대조는 직접 문안 검토표로 보완한다.
```sh
q_text() {
  node --input-type=module - "$SGG_ORIGINAL_GAME" "$SGG_ART" "${1:-happy}" <<'JS'
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';
const [g,a,mode]=process.argv.slice(2),source=fs.readFileSync(path.join(g,'src/app_tpl.html'),'utf8');
const match=source.match(/var FAMS = (\[[\s\S]*?\n\]);/);assert(match,'FAMS declaration');
const families=vm.runInNewContext('('+match[1]+')',Object.create(null),{timeout:1000}),expected=[];
for(const f of families)for(const c of f.list){expected.push({cardId:c.id,side:'front',ko:c.line});if(c.alt)expected.push({cardId:c.id,side:'alt',ko:c.alt.line});}
assert.equal(expected.length,47);const data=JSON.parse(fs.readFileSync(path.join(a,'identity/dialogue-ja.json'),'utf8'));
const key=r=>r.cardId+':'+r.side;
function valid(rows){assert.equal(rows.length,47);assert.equal(new Set(rows.map(key)).size,47);for(const e of expected){const r=rows.find(x=>key(x)===key(e));assert(r);assert.equal(r.ko,e.ko);assert.equal(typeof r.ja,'string');assert(r.ja.trim());assert.equal(r.ja,r.ja.normalize('NFC'));assert(!/[\u0000-\u001f\u007f\ufffd]/u.test(r.ja));assert(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(r.ja));}}
if(mode==='negative'){const cases=[];let r=structuredClone(data.rows);r.splice(r.findIndex(x=>x.side==='alt'),1);cases.push(r);for(const field of ['ko','emptyJa','replacement']){r=structuredClone(data.rows);if(field==='ko')r[0].ko+='changed';if(field==='emptyJa')r[0].ja='';if(field==='replacement')r[0].ja='\ufffd';cases.push(r);}for(const r of cases)assert.throws(()=>valid(r));console.log(JSON.stringify({status:'PASS',rejected:['missing-alt','changed-ko','empty-ja','replacement-character']}));}else{valid(data.rows);console.log(JSON.stringify({status:'PASS',base:45,alt:2,total:47}));}
JS
}
```

### G-ART 이후 코드 QA 레시피
다음 **Q-META**와 **Q-GATE**도프로그램파일을만들지않는inline검사다. 사전아트단계에는metadata만검사하며앱을import/실행하지않는다. failure는항상메모리사본에서만수행한다.
```sh
q_meta() {
  python3 - "$SGG_ART" "$1" "${2:-happy}" <<'PY'
import pathlib,sys,json,copy,hashlib,subprocess
a=pathlib.Path(sys.argv[1]);kind,mode=sys.argv[2:4]
def load(p):return json.loads((a/p).read_text())
if kind=='ledger':
 data=load('approvals/gates.json')
 def valid(x):assert all(x[k]['status']=='pending' for k in ['G-REP','G-ART','G-EXPERIENCE'])
 bad=copy.deepcopy(data);bad['G-ART']['status']='approved'
elif kind=='identity':
 data=load('identity/family-style.json')
 def valid(x):
  assert set(x)=={'poo','ssial','ga','tarae','eg','qp'}
  tags={'poo':'flame-helmet','ssial':'flowing-crest','ga':'hornless-dome','tarae':'ring-coil','eg':'one-sided-coating','qp':'asymmetric-sheet-hood'}
  for k,r in x.items():
   assert {'helmet','face','emblem','body','material','color','light','softVsStrong','negativeConstraints','identityTags'}<=set(r)
   assert tags[k] in r['identityTags']
 bad=copy.deepcopy(data);bad['tarae']['identityTags']=['hornless-dome']
elif kind=='usage':
 import os
 g=pathlib.Path(os.environ['SGG_ORIGINAL_GAME']);scope=load('manifest/scope.json');data=scope['uses'];targets={r['targetKey'] for r in scope['expectedTargets']}
 hits=subprocess.check_output(['rg','-n','--glob','*.{html,js,css,mjs,json,webmanifest,txt}',r'IMG(_ALT|_ITEM|_PART|_CAR)?|src/(game/art|uiimg|toon)|url\(|scene:|background:|frame:|stage:|draw:|icon:',str(g/'src'),str(g/'manifest.webmanifest'),str(g/'docs/design/game-screen-inventory.json')],text=True).splitlines()
 expected={(str(pathlib.Path(p).relative_to(g)),int(n),hashlib.sha256(t.encode()).hexdigest()) for p,n,t in (h.split(':',2) for h in hits)}
 def valid(x):
  assert expected<={(r['sourcePath'],r['line'],r['excerptSha256']) for r in x}
  for r in x:
   assert r['disposition'] in ['mapped','non-art']
   assert r['targetKeys'] and set(r['targetKeys'])<=targets if r['disposition']=='mapped' else bool(r['reason'])
 bad=[r for r in data if (r['sourcePath'],r['line'],r['excerptSha256'])!=next(iter(expected))]
else:raise AssertionError('unknown metadata recipe')
if mode=='negative':
 try:valid(bad)
 except (AssertionError,KeyError):print('PASS rejected invalid',kind)
 else:raise AssertionError('invalid metadata accepted')
else:valid(data);print('PASS',kind)
PY
}
q_gate() {
  sgg_gate_batch=all
  if [ "$1" = G-REP ]; then sgg_gate_batch=representatives; fi
  q_scope || return 1
  q_files "$sgg_gate_batch" || return 1
  q_approval "$sgg_gate_batch" || return 1
  python3 - "$SGG_ART" "$1" "${2:-happy}" <<'PY'
import pathlib,sys,json,hashlib,copy
a=pathlib.Path(sys.argv[1]);name,mode=sys.argv[2:4]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
g=json.loads((a/'approvals/gates.json').read_text());d=[json.loads(x) for x in (a/'approvals/user-decisions.jsonl').read_text().splitlines() if x.strip()]
def valid(r):
 assert r['status']=='approved' and r['inventorySHA']==sha(a/'manifest/art-inventory.json') and r['scopeSHA']==sha(a/'manifest/scope.json')
 assert r['decisionIds'] and set(r['decisionIds'])<={x['decisionId'] for x in d if x['decisionSource']=='user' and x['decision']=='approved'}
 if name=='G-EXPERIENCE':
  assert g['G-ART']['status']=='approved' and r['artGateSHA']==hashlib.sha256(json.dumps(g['G-ART'],sort_keys=True,separators=(',',':')).encode()).hexdigest()
  assert r['buildSHA']==sha(pathlib.Path(r['buildManifestPath'])) and r['scenarios']
if mode=='negative':
 for field,value in [('status','pending'),('inventorySHA','0'*64),('decisionIds',[])]:
  r=copy.deepcopy(g[name]);r[field]=value
  try:valid(r)
  except (AssertionError,KeyError):pass
  else:raise AssertionError('invalid gate accepted')
 print('PASS rejected pending/stale/missing-decision gate')
else:valid(g[name]);print('PASS',name)
PY
}
```
- 작업3 negative의정확한호출은 `q_meta ledger negative`, 작업4는 `q_meta identity negative`, 작업2/20의사용처누락은 `q_meta usage negative`다. happy는같은명령의negative인자를생략한다. 이함수의family-style최상위는계열키object이며필수identityTags를task4명세에포함한다.
- 작업10/24/30의gate완결성은각각 `q_gate G-REP`, `q_gate G-ART`, `q_gate G-EXPERIENCE`로검사한다. 각실패는같은명령에 `negative`를추가한다. 경험gate의 `buildManifestPath`는task26prepare가만드는절대경로 `$SGG_PROTO/public/prototype-build.json`이며모든prototype배포파일의정렬된path/SHA를담는다. artifact변조검사는prepare/adaptercase가담당한다. 경험직접판단도고유decisionId로같은원문대장에보존한다.
- gate범위에영향없는단순문안기록수정으로대표기록을지우지않는다. G-REP 당시inventorySHA는그시점스냅샷으로보존하고이후gate검사는현재G-ART/경험gate만수행한다. 미래파일로옛대표승인을승계하지않는다.

- **Q-PROTOTYPE** (`q_proto <scenario>`): 작업25의 새 격리 QA config로 `npm exec playwright test -- --config "$SGG_PROTO/qa/playwright.config.mjs" --project chromium --project webkit --grep "$1"`. 작업26–30은 여기의 정확한 scenario 이름을 사용한다. config는 workers1/retries0·실패 trace 보존·실패 screenshot, 결과 JSON은 `SGG_EVIDENCE/task-N/prototype-report.json`; 라이브 사용자 저장과 분리한 새 browser context와 새 origin을 쓴다.
- **Q-GAME** (`q_game <case> <task-N>`): `cd "$SGG_GAME"` 후 `node tools/game-qa.mjs --case "$1" --engines chromium,webkit --evidence "$SGG_EVIDENCE/$2"`. 예: `q_game game-draw task-28`가 아니라 체험 단계는 Q-PROTOTYPE만 사용하고, 공식 개정 후 `q_game game-draw task-36`을 사용한다. `npm test`는 games를 제외하므로 게임 통과 대체물이 아니다.
- **Q-BUILD** (`q_build <task-N>`): G-EXPERIENCE후에만격리worktree루트로정식빌드해실제로QA가serve하는index를갱신하고,동일release를증거폴더build로복사한다. 원본game-edition루트는빌드대상이아니다. 작업31/32/33/34/35/36/37은각자source변경publish후해당task인자로한번실행하고QA동안source를동결한다. 재실행은새attempt또는새task증거경로를사용한다. **Q-PACKAGE**는 `node "$SGG_GAME/tools/package-game.mjs" --root "$SGG_EVIDENCE/task-37/build" --out "$SGG_EVIDENCE/task-37/package" --verify --report "$SGG_EVIDENCE/task-37/package-report.json"`; `SGG_PACKAGE_ROOT="$SGG_EVIDENCE/task-37/package" q_game packaged-smoke task-37`; `q_game game-pwa-unit task-37`이다.
- **Q-NEGATIVE-PACKAGE** (`q_negative_package`): 각negative target은먼저정상package를새경로에복제해검증한다. 빈out에곧장negative를실행하지않는다. 아래CLI의정상negative는 **exit1, EXPECTED_REJECTION, reached=true, callerPreserved=true**다(`tools/game-build/cli.mjs:14`, `package.mjs:68`). 정상package/source불변과residue도검사한다.
```sh
q_build() {
  test "$SGG_GAME" != "$SGG_ORIGINAL_GAME" || return 1
  q_gate G-EXPERIENCE || return 1
  node "$SGG_GAME/tools/build-game.mjs" --root "$SGG_GAME" --out "$SGG_GAME" --report "$SGG_EVIDENCE/$1/worktree-build-report.json" || return 1
  node "$SGG_GAME/tools/package-game.mjs" --root "$SGG_GAME" --out "$SGG_EVIDENCE/$1/build" --verify --report "$SGG_EVIDENCE/$1/build-report.json" || return 1
  node --input-type=module - "$SGG_GAME" "$SGG_EVIDENCE/$1/build" <<'JS'
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [g,b]=process.argv.slice(2),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');for(const p of ['index.html','game-release.json'])assert.equal(sha(path.join(g,p)),sha(path.join(b,p)));
const r=JSON.parse(fs.readFileSync(path.join(g,'game-release.json')));assert.equal(r.syntheticFixture,false);fs.mkdirSync(path.join(g,'.omo'),{recursive:true});fs.writeFileSync(path.join(g,'.omo/full-art-remake-active-release.json'),JSON.stringify({releaseId:r.releaseId,indexSHA:sha(path.join(g,'index.html')),releaseSHA:sha(path.join(g,'game-release.json'))}));
JS
}
q_game() (
  cd "$SGG_GAME" || exit 1
  test "$SGG_GAME" != "$SGG_ORIGINAL_GAME" || exit 1
  node --input-type=module - "$SGG_GAME" <<'JS'
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const g=process.argv[2],read=p=>fs.readFileSync(path.join(g,p)),sha=b=>createHash('sha256').update(b).digest('hex'),r=JSON.parse(read('game-release.json')),b=JSON.parse(read('.omo/full-art-remake-active-release.json'));
assert.equal(r.syntheticFixture,false);assert.equal(r.releaseId,b.releaseId);assert.equal(sha(read('index.html')),b.indexSHA);assert.equal(sha(read('game-release.json')),b.releaseSHA);assert.equal(r.files.find(x=>x.path==='index.html').sha256,b.indexSHA);const {assertFresh}=await import(pathToFileURL(path.join(g,'tools/game-build/inputs.mjs')));await assertFresh({inputs:r.inputs},g);
JS
  test $? -eq 0 || exit 1
  node tools/game-qa.mjs --case "$1" --engines chromium,webkit --evidence "$SGG_EVIDENCE/$2"
)
q_proto() (
  cd "$SGG_GAME" || exit 1
  sgg_proto_task="${2:-}"
  if [ -z "$sgg_proto_task" ]; then
    case "$1" in
      adapter-*) sgg_proto_task=task-26 ;;
      prototype-compositor-*|prototype-missing-image-and-ja) sgg_proto_task=task-27 ;;
      prototype-draw-*) sgg_proto_task=task-28 ;;
      prototype-core-loop|prototype-loop-*) sgg_proto_task=task-29 ;;
      *) return 2 ;;
    esac
  fi
  sgg_proto_run="$SGG_EVIDENCE/$sgg_proto_task/prototype-$(python3 -c 'import uuid;print(uuid.uuid4().hex[:8])')"
  mkdir -p "$sgg_proto_run"
  SGG_PROTO_REPORT="$sgg_proto_run/prototype-report.json" SGG_PROTO_OUTPUT="$sgg_proto_run/artifacts" npm exec playwright test -- --config "$SGG_PROTO/qa/playwright.config.mjs" --project chromium --project webkit --grep "$1"
)
q_negative_package() {
  for sgg_negative_case in hash-mismatch missing-release-entry temp-failure; do
    sgg_negative_out="$SGG_EVIDENCE/task-37/negative-$sgg_negative_case"
    sgg_negative_seed="$SGG_EVIDENCE/task-37/seed-$sgg_negative_case.json"
    sgg_negative_report="$SGG_EVIDENCE/task-37/negative-$sgg_negative_case.json"
    node "$SGG_GAME/tools/package-game.mjs" --root "$SGG_EVIDENCE/task-37/package" --out "$sgg_negative_out" --verify --report "$sgg_negative_seed" || return 1
    if node "$SGG_GAME/tools/package-game.mjs" --root "$SGG_EVIDENCE/task-37/build" --out "$sgg_negative_out" --case "$sgg_negative_case" --report "$sgg_negative_report"; then return 1; else sgg_negative_code=$?; fi
    python3 - "$sgg_negative_report" "$sgg_negative_case" "$sgg_negative_code" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]));assert sys.argv[3]=='1';assert r['status']=='EXPECTED_REJECTION' and r['case']==sys.argv[2] and r['reached'] is True and r['callerPreserved'] is True
assert r['previous']==r['after'];print('PASS expected rejection and target preserved',sys.argv[2])
PY
  done
}
```
- Q-PROTOTYPE config는위SGG_PROTO_REPORT/OUTPUT환경변수만소유하고report에는실행수>0·두엔진·시나리오이름을남긴다. task30재검증은예를들어 `q_proto prototype-core-loop task-30`처럼두번째인자로증거폴더를명시한다. 공식test조건수정과는분리한다.
- 각 task의 named happy/failure scenario는 해당 작업이 만드는 QA에 실제 assertion으로 존재해야 한다. 없는 scenario를 grep0건 통과로 처리하지 않는다. Playwright 결과의 executed>0, 실패0, 입력SHA·두 엔진·시나리오명을 증거로 검증한다. agent 브라우저 실제 조작과 화면 캡처는 자동 assertion을 보완한다.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

| Wave | 작업 | 산출·경계 |
| --- | --- | --- |
| W1 | 1–5 | 레퍼런스·전체 목록·staging 계약·정체성·47문안. 1→2→3, 4/5는 읽기 전용 근거 확보 후 분리 작성. |
| W2 | 6–10 | 전 계열·장착·비캐릭터 대표 및 사용자 G-REP. 6–9는 각 소유 폴더만 쓰며 10은 전부 완료 후. |
| W3 | 11–15 | 기본47면·장비14 전량. G-REP 후 서로 다른 소유 폴더로 병렬. |
| W4 | 16–20 | 부품35·차량8·모든 환경/프레임/기타. 각 batch 분리; 개념 방향은 G-REP 기준. |
| W5 | 21–24 | 장착254·파생/비교·완결성 검사·전량 G-ART. 24에서 명시적 승인 전 정지. |
| W6 | 25–30 | G-ART 후 격리·adapter·합성/대사·출하·공방/도감 체험 및 G-EXPERIENCE. |
| W7 | 31–35 | 체험 승인 후 공식 계약/빌드와 제작·연구·차고·접근성 전체 통합. |
| W8 | 36–38 | 경제/저장 집중 회귀·패키지/offline·문서 인계. 이후 F1–F4. |

병렬 작업자는 `manifest/batches/<batch>.json`과 자기 master/appearance/review 폴더만 소유한다. 공용 `scope.json`, 활성 inventory, 승인대장은 작업3 소유의 단일 조정자가 batch 종료 때만 병합한다. 다른 작업자의 파일·사용자 작업을 되돌리지 않는다. 관문 사이에서는 승인 이후 작업을 미리 시작하지 않는다. 아트 새 버전이 G-ART를 무효화하면 후속 개발을 멈추고 그 버전의 전량 상태를 복구한다.

작업32–34는독립module/CSS/spec작성만병렬가능하다. 공용app_tpl.html구간변경은각자가 `SGG_EVIDENCE/task-N/template.patch`와 `styles.patch`로인계하고조정자1명이순서대로적용한다. source가바뀌는동안QA를돌리지않는다. 각batch의공용변경publish→입력SHA동결→해당Q-GAME검증을직렬화한후다음patch를적용한다. 검증중다른작업자의publish도금지한다.

모델: 일반 작성·제작/구현·일상 검증은 **Sol High**. 작업36의 저장·아이템 정합성 및 F4 최종 통합은 **Astra High**를 실제 확인한다. 가용하지 않으면 완료로 표시하지 않고 실행 증거·남은 검토·다음 명령을 인계한다. Ultra/전역 모델 변경/goal 재시작은 하지 않는다.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | 없음 | 2,4,5 | 없음 |
| 2 | 1 | 3–5 | 없음 |
| 3 | 2 | 6–9 | 4,5 |
| 4 | 1,2 | 6–9 | 3,5 |
| 5 | 1,2 | 22,27 | 3,4,6–20(문안 소유만) |
| 6 | 3,4 | 10 | 7–9 |
| 7 | 3,4 | 10 | 6,8,9 |
| 8 | 3,4 | 10 | 6,7,9 |
| 9 | 3,4 | 10 | 6–8 |
| 10 | 6–9 | 11–20 | 없음(사용자 정지) |
| 11 | 10 | 21,22 | 12–20 |
| 12 | 10 | 21,22 | 11,13–20 |
| 13 | 10 | 21,22 | 11,12,14–20 |
| 14 | 10 | 21,22 | 11–13,15–20 |
| 15 | 10 | 21,22 | 11–14,16–20 |
| 16 | 10 | 22 | 11–15,17–20 |
| 17 | 10 | 22 | 11–16,18–20 |
| 18 | 10 | 22 | 11–17,19,20 |
| 19 | 10 | 22 | 11–18,20 |
| 20 | 10 | 22 | 11–19 |
| 21 | 11–15 | 22 | 16–20 |
| 22 | 5,11–21 | 23 | 없음 |
| 23 | 22 | 24 | 없음 |
| 24 | 23 | 25 | 없음(사용자 정지) |
| 25 | 24 | 26 | 없음 |
| 26 | 25 | 27–29 | 없음 |
| 27 | 5,26 | 28,29 | 없음 |
| 28 | 27 | 29,30 | 없음 |
| 29 | 28 | 30 | 없음 |
| 30 | 27–29 | 31 | 없음(사용자 정지) |
| 31 | 30 | 32–35 | 없음 |
| 32 | 31 | 35,36 | 33,34 |
| 33 | 31 | 35,36 | 32,34 |
| 34 | 31 | 35,36 | 32,33 |
| 35 | 31–34 | 36 | 없음 |
| 36 | 35 | 37 | 없음 |
| 37 | 36 | 38 | 없음 |
| 38 | 37 | F1–F4 | 없음 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. 지정 SSR 원본·출처·승인 경계를 잠근다
  Recommended task executor category: quick — 단일 참조 등록이며 Sol High를 사용한다.
  What to do / Must NOT do: 보존된 정확한 첨부를 직접 열고 staging references로 바이트 복사한다. 스타일 역할과 원본 정체성 자료 역할을 구분하고 SSR/LV/가상 수치 제외를 기록한다. 기존 cards.png를 새 기준으로 대체하지 않는다.
  Closes: GAP-1, GAP-3.
  Parallelization: Wave1 | Blocked by: 없음 | Blocks: 2,4,5.
  References: `AGENTS.md:12`; `game-edition/docs/design/game-replan-2026-10-31.md:65`; `.omo/drafts/steel-companion-full-art-remake-support/ssr-style-reference.png`(보존 입력); `game-edition/docs/design/game-reference/provenance.json:5`(역사 자료).
  Ownership / outputs: 새 `references/ssr-style-reference.png`, `references/provenance.json`; task1만 이 경로를 쓴다. image 생성은 아직 하지 않는다.
  Acceptance criteria: `q_ref`; 복사본 SHA도 같은 상수이며 provenance에1024×1536·원 첨부·style-only·referenceSHA가 존재한다.
  QA happy — reference-locked: `q_ref > "$SGG_EVIDENCE/task-1/reference.txt"`; `view_image`로 보존 원본 직접 열람 후 관찰을 `task-1/visual-observation.md`에 남긴다.
  QA failure — wrong-reference-rejected: `python3 -c 'import hashlib,os; p=os.environ["SGG_PROJECT"]+"/game-edition/docs/design/game-reference/cards.png"; assert hashlib.sha256(open(p,"rb").read()).hexdigest()!="c16d8c26291d5d8c6bd511a59b51a7e9c3f85bc0fcc9fbf5fc100ca31d4ccdd3"; print("PASS old cards rejected")' > "$SGG_EVIDENCE/task-1/negative.txt"`.
  Evidence: `SGG_EVIDENCE/task-1/{reference.txt,visual-observation.md,negative.txt,provenance-sha.json}`.
  Commit: N — 로컬 계획 실행 산출물만; 커밋·푸시 승인은 별도다.

- [x] 2. 모든 그림 사용처와 301외형 제작 범위를 고정한다
  Recommended task executor category: unspecified-high — 데이터·사용처 교차 목록을 작성한다.
  What to do / Must NOT do: ITEMS.fit/FAMS/PARTS/CARS 선언과 기존 contract를 읽기 전용으로 대조한다. 얼굴47,14장비,35부품,8차량,모든 유효 부분집합 및 게임 화면·CSS·PWA·서사 그림까지 scope.expectedTargets를 만든다. 125/175로 완료 수량을 제한하지 않는다.
  Closes: GAP-1, GAP-2, GAP-3, GAP-5.
  Parallelization: Wave1 | Blocked by: 1 | Blocks: 3–5.
  References: `game-edition/src/app_tpl.html:1656`, `:1810`, `:1969`, `:2128`; `game-edition/tools/game-assets/contract.json:3846`; `game-edition/docs/design/game-asset-manifest.json:10`; `game-edition/docs/design/game-screen-inventory.json:1`; `game-edition/docs/design/game-replan-2026-10-31.md:99`.
  Ownership / outputs: 새 `manifest/scope.json`, `identity/source-data.json`, `review/usage-map.md`; sourceHashes는 sourceHTML/contract/구manifest/화면inventory를 포함한다. 원본/교육판 쓰기 금지.
  Acceptance criteria: `q_scope`가45ID/47면/107단일/147복수/301전체를 출력한다. family 합9+13+14+9+1+1=47, 부품 그룹10+10+15=35가 실제 키와 일치한다. Q-USAGE의 모든 hit와 수동 발견 그림이 mapped/non-art로 연결된다.
  QA happy — complete-scope: `q_scope > "$SGG_EVIDENCE/task-2/scope.json"`; Q-USAGE 정확 명령을 실행해 hit→target 대조와 독립 ITEMS.fit 결과를 `task-2/coverage.json`에 남긴다.
  QA failure — missing-combination: `q_scope negative > "$SGG_EVIDENCE/task-2/negative.txt"`; 사용처 복제본에서 frame/seal/icon 한 행씩 제거해 hit 집합 불일치도 기록한다.
  Evidence: `SGG_EVIDENCE/task-2/{scope.json,usage-hits.txt,coverage.json,negative.txt}` 및 독립 계산 원문.
  Commit: N — 범위 고정은 runtime 계약 개정이나 커밋 승인이 아니다.

- [x] 3. 앱과 분리된 staging 목록·버전·사용자 승인 형식을 만든다
  Recommended task executor category: writing — JSON과 인계 규칙만 작성한다.
  What to do / Must NOT do: 공통 데이터 계약을 README와 빈 inventory/append-only 승인대장/pending gates에 고정한다. batch 전용 소유권·중앙 병합·수정 시 재승인·일괄 승인 대상 목록을 명시한다. preGART validator/helper 프로그램·runtime schema는 만들지 않는다.
  Closes: GAP-3, GAP-6.
  Parallelization: Wave1 | Blocked by: 2 | Blocks: 6–9.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:141`, `:154`; `game-edition/tools/game-assets/images.mjs:29`; `game-edition/tools/game-assets/reviews.mjs:13`; `game-edition/tools/game-assets/schema.mjs:54`(이 시점 개정 금지).
  Ownership / outputs: 새 `manifest/README.md`, `manifest/art-inventory.json`, `manifest/batches/`, `approvals/user-decisions.jsonl`, `approvals/gates.json`; task3 조정자가 이후 공용 파일의 유일한 병합 담당자다.
  Acceptance criteria: `python3 -m json.tool "$SGG_ART/manifest/art-inventory.json"`; `python3 -m json.tool "$SGG_ART/approvals/gates.json"`; 세 gate 모두 pending이고 사용자 승인행은0개. schemaVersion1·referenceSHA·target key 규칙이 명시된다.
  QA happy — empty-ledger-safe: 위 JSON 명령과 `q_scope` 실행. 승인 이력0·gates pending을 inline JSON assertion으로 `task-3/structure.json`에 기록한다.
  QA failure — no-autoapproval: 메모리 대장에 agent/pending/다른SHA를 넣으면 Q-APPROVAL의 valid 조건을 만족하지 않음을 확인한다. 실제 파일에 fixture·approved를 쓰지 않는다.
  Evidence: `SGG_EVIDENCE/task-3/{structure.json,negative.txt,inline-commands.txt}`.
  Commit: N — 로컬 제작대장만 작성한다.

- [x] 4. 여섯 계열 정체성과 새 금속 스타일 제작 명세를 확정한다
  Recommended task executor category: writing — 원본 정체성·새 스타일을 제작자가 재현할 명세로 만든다.
  What to do / Must NOT do: PO불꽃/가로패널·CR흐르는볏/세로패널·GA돔/보호층·WR고리/코일·EG편면대비·QP판금후드/비대칭을 따로 지정한다. 2.5등신·눈/입·빛·재질·72px·연질/고장력·열처리 같은인물·장착 접점 기준과 프롬프트 금지항목을 고정한다.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave1 | Blocked by: 1,2 | Blocks: 6–9.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:68`, `:83`, `:92`, `:131`; `game-edition/docs/design/game-art-bible.md:1`(충돌하지 않는 정체성 참고); `game-edition/src/app_tpl.html:1810`.
  Ownership / outputs: 새 `identity/family-style.json`, `identity/material-and-pose.md`, `identity/prompt-contract.md`; 기존 공식 art-bible 수정 금지.
  Acceptance criteria: family-style의 키가 정확히 poo/ssial/ga/tarae/eg/qp이고 각 행에 helmet/face/emblem/body/material/color/light/softVsStrong/negativeConstraints가 있다. 같은인물3자세 proof 대상과 열처리 쌍을 scope에 등록한다.
  QA happy — six-distinct-identities: `python3 -m json.tool "$SGG_ART/identity/family-style.json"`와 `q_scope` 실행; 각 항목을 재계획 표와1:1 비교한 `task-4/identity-matrix.json`을 기록한다.
  QA failure — collapsed-family-detected: matrix 사본에서 WR코일·EG편면·QP후드를 GA돔으로 바꾸어 해당 정체성 assertion3개가 실패함을 inline Python으로 확인한다.
  Evidence: `SGG_EVIDENCE/task-4/{identity-matrix.json,negative.txt,inline-commands.txt}`.
  Commit: N — staging 명세만 작성한다.

- [x] 5. 한국어 원문과 일본어 대사 47면 문안을 준비한다
  Recommended task executor category: writing — 선택 대사 번역과 면별 대조 작업이다.
  What to do / Must NOT do: FAMS45개의 line과 PHS·1470H alt.line 두 개를 source 그대로 추출한다. cardId+side47키별 자연스러운 일본어·뜻/말투·철강 용어집을 작성하고 실제 이름·강종 코드는 보존한다. 승인된 로마자 읽기 보조만 허용하며 UI 전면 번역·음성은 추가하지 않는다.
  Closes: GAP-7.
  Parallelization: Wave1 | Blocked by: 1,2 | Blocks: 22,27.
  References: `game-edition/src/app_tpl.html:1812`, `:1819`, `:1852`, `:1876`, `:5014`, `:5412`; 사용자 추가 요청은 `.omo/drafts/steel-companion-full-art-remake.md`의 2026-10-31 답변 기록.
  Ownership / outputs: 새 `identity/dialogue-ja.json`, `identity/ja-glossary.json`, `review/dialogue-static-proof.png`; 예시 motto는 별도 optionalMotto 필드다. 그림에 대사를 굽지 않고 정적 검토용 텍스트층만 둔다.
  Acceptance criteria: Q-TEXT가47키·원ko불변·두alt별도·NFC/정상Unicode/ja비어있지않음을 증명한다. 번역1:1 검토표가 캐릭터 말투·열처리 전후 의미와 실제 명칭 보존을 확인한다.
  QA happy — ja47-source-matched: Q-TEXT를 실행해 `task-5/text-check.json`; 전신/72px와 분리된 정적 대사 proof를 직접 열어 한국어 기본·일본어 별도 표시를 확인한다.
  QA failure — ja47-invalid-rejected: Q-TEXT의 alt누락·ko변조·빈ja·U+FFFD 네 in-memory probe가 모두 거부된다. 사용자에게 문안 수정 요청을 받으면 미승인 문안을 최종으로 표시하지 않는다.
  Evidence: `SGG_EVIDENCE/task-5/{text-check.json,text-check-command.txt,translation-review.md,negative.json}`.
  Commit: N — 문안·정적 proof만 준비한다.

- [x] 6. PO·CR·GA 대표와 ★2 연질·열처리 쌍을 새로 제작한다
  Recommended task executor category: unspecified-high — 명세를 반영한 대표 원화 제작/정적 검토다.
  What to do / Must NOT do: PO270C/PHS전후, CR270C/1470M, GA270C/1470H전후를 포함한다. 같은 캐릭터3자세 증거를 PO·CR·GA 대표 각각 남긴다. 텍스트·프레임 없는 전신과 SSR 나란히 비교, 연질 체형·열처리 같은인물 대비를 제작한다.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave2 | Blocked by: 3,4 | Blocks: 10.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:83`, `:92`, `:131`; `identity/family-style.json`(task4 신규); 고정 SSR 원본(task1).
  Ownership / outputs: 새 `masters/pilot-po-cr-ga/`, `review/pilot-po-cr-ga/`, `manifest/batches/pilot-po-cr-ga.json`; scope의 batch=`pilot-po-cr-ga` 모든 target. 생성 원본·프롬프트·참조SHA·version 보존.
  Acceptance criteria: 내장 image_gen 사용 provenance가 존재하고 `q_files pilot-po-cr-ga` 통과. 전신/72/3자세/열처리비교 모두 직접 이미지 열람했고 미달 항목은 수정대기로 기록한다.
  QA happy — pilot-primary-full-and72: `q_files pilot-po-cr-ga > "$SGG_EVIDENCE/task-6/files.json"`; 해당 reviewFiles 전부 `view_image`로 열어 항목별 관찰을 남긴다.
  QA failure — pilot-hash-rejected: `q_files pilot-po-cr-ga negative > "$SGG_EVIDENCE/task-6/negative.txt"`; 열처리 얼굴/엠블럼 불일치 또는 낮은별 매력 미달은 이미지 재작화하며 기술PASS로 면제하지 않는다.
  Evidence: `SGG_EVIDENCE/task-6/{files.json,visual-review.md,negative.txt}`와 staging 비교판.
  Commit: N — 사용자 승인 전 대표 산출물이다.

- [x] 7. WR·EG·QP 대표와 정체성3자세를 제작한다
  Recommended task executor category: unspecified-high — 다른 형태의 세 계열이 같은 세계에 속하는지 검토한다.
  What to do / Must NOT do: WR-SWRM/WR-SPR, EG-SECC, QP-1470 대표를 만든다. WR고리·가는코일·구슬손/고리발, EG외도금/내비도금, QP판금후드·은색얼굴·고유미소·비대칭을 보존한다. 각 계열 대표 같은인물3자세와72px를 준비한다.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave2 | Blocked by: 3,4 | Blocks: 10.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:83`, `:131`; `game-edition/src/app_tpl.html:1857`, `:1861`, `:1871`; task4 명세.
  Ownership / outputs: 새 `masters/pilot-wr-eg-qp/`, `review/pilot-wr-eg-qp/`, `manifest/batches/pilot-wr-eg-qp.json`; 다른 pilot 폴더를 수정하지 않는다.
  Acceptance criteria: `q_files pilot-wr-eg-qp` 통과, 전신/72/3자세 proof가 모두 보이고 여섯 계열 비교에서 GA복제 체형으로 수렴하지 않는다.
  QA happy — pilot-six-family-world: `q_files pilot-wr-eg-qp > "$SGG_EVIDENCE/task-7/files.json"`; proof 직접 열람 후 WR선재·EG편면·QP비대칭을 각각 확인한다.
  QA failure — pilot-secondary-corrupt: `q_files pilot-wr-eg-qp negative > "$SGG_EVIDENCE/task-7/negative.txt"`; 식별요소가 사라진 시안은 사용자 제출 전에 반려목록으로 남기고 재작화한다.
  Evidence: `SGG_EVIDENCE/task-7/{files.json,visual-review.md,negative.txt}`.
  Commit: N — 다른 계열 승인으로 이 세 계열 승인을 대신하지 않는다.

- [x] 8. 휴대·설비·복수 장착의 복잡한 완성 외형을 시험한다
  Recommended task executor category: unspecified-high — 레이어/재작화 제작 구조를 정적 그림으로 판정한다.
  What to do / Must NOT do: 호환키의 사전식 첫 단일휴대·첫설비·최대4장비 대상과 PHS/1470H 양면의 유효 조합을 scope에서 골라 명시한다. 손·팔·장갑·받침·가림·광원·그림자를 새로 그리며 레이어로 불가능한 자세는 해당 외형을 재작화한다.
  Closes: GAP-2, GAP-3.
  Parallelization: Wave2 | Blocked by: 3,4 | Blocks: 10.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:117`; `game-edition/tools/game-assets/contract.json:3846`; `game-edition/src/game/presentation.js:20`; `game-edition/docs/design/game-asset-manifest.json:10`.
  Ownership / outputs: 새 `masters/pilot-equipped/`, `appearances/pilot-equipped/`, `review/pilot-equipped/`, `manifest/batches/pilot-equipped.json`, `identity/equipped-production-decision.json`(채택 renderSpec·필수재작화유형).
  Acceptance criteria: `q_files pilot-equipped`; 선택 target 목록에 단일/설비/복수/열처리 양면이 있고 각 최종 raster와 모든 구성SHA가 바인딩된다. 합성 좌표만 바꾼 구 그림은0개다.
  QA happy — equipped-contact-pilot: `q_files pilot-equipped > "$SGG_EVIDENCE/task-8/files.json"`; 최종 전신·72·단품비교를 열어 접점/가림/얼굴 안전영역을 모두 기록한다.
  QA failure — equipment-layer-mismatch: `q_files pilot-equipped negative > "$SGG_EVIDENCE/task-8/negative.txt"`; 손관통·접점부재·불가능한 지지·빛불일치는 레이어 방식 채택 거부 사유로 남기고 재작화 후 재검토한다.
  Evidence: `SGG_EVIDENCE/task-8/{files.json,contact-review.md,negative.txt,production-decision.json}`.
  Commit: N — 제작 구조 결정은 모든254외형의 승인 의무를 줄이지 않는다.

- [x] 9. 장비·부품·차량·무대·프레임 대표를 같은 세계로 제작한다
  Recommended task executor category: unspecified-high — 캐릭터 외의 전량 제작 방향을 검증한다.
  What to do / Must NOT do: 휴대/설비 장비 각1, 바디/프레임/섀시 부품 각1, 차량1, 공방/★5하늘 무대, 등급프레임2종·봉인·아이콘 대표를 scope에서 고정한다. 정확한 용도/형태, 차급 정체성·회사/차명 비노출을 유지한다.
  Closes: GAP-1, GAP-5.
  Parallelization: Wave2 | Blocked by: 3,4 | Blocks: 10.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:99`, `:137`; `game-edition/src/app_tpl.html:1969`, `:2128`; `game-edition/docs/design/game-screen-inventory.json:1`.
  Ownership / outputs: 새 `masters/pilot-world/`, `review/pilot-world/`, `manifest/batches/pilot-world.json`; 캐릭터와 함께 놓은 정적 composite만 만든다. 인터랙티브 preview 금지.
  Acceptance criteria: `q_files pilot-world`; 단품·72·한세계 composite·프레임 빈중심·배경 crop proof가 존재하고 실제 생성 master를 추적한다.
  QA happy — world-assets-pilot: `q_files pilot-world > "$SGG_EVIDENCE/task-9/files.json"`; 모든 대표와 동일세계 비교판을 직접 연다.
  QA failure — world-export-mismatch: `q_files pilot-world negative > "$SGG_EVIDENCE/task-9/negative.txt"`; 로고/차명·잘못된 부품 형태·프레임 중앙불투명·장면 가림을 발견하면 수정대기로 분류한다.
  Evidence: `SGG_EVIDENCE/task-9/{files.json,world-review.md,negative.txt}`.
  Commit: N — 대표 비캐릭터 그림만 제작한다.

- [x] 10. G-REP 대표 아트의 직접 사용자 판단을 받고 정지한다
  Recommended task executor category: writing — 사용자 결정과 버전을 연결하는 관문이다.
  What to do / Must NOT do: 작업6–9 전량 대표 목록/전신/72/3자세/장착/세계 비교를 정적으로 제시한다. 사용자 승인·수정요청을 원문 근거와 정확한 target/version/SHA로 기록한다. 이 승인은 전량 아트 제작만 열며 체험판·개발은 열지 않는다.
  Closes: GAP-1, GAP-2, GAP-3.
  Parallelization: Wave2 | Blocked by: 6–9 | Blocks: 11–20.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:131`, `:146`, `:162`; task3 대장 계약과 task6–9 batch.
  Ownership / outputs: 새 `review/representatives/index.json`, `approvals/representative-decision.md`; 공용 대장은 조정자만 append하고 representatives batch를 네 pilot의 합집합으로 고정한다.
  Acceptance criteria: `q_files representatives`, `q_approval representatives`가 모두 통과하고 G-REP가 일치 목록·scope/inventorySHA를 바인딩한다. 사용자 응답 없거나 수정요청이면 task10 미완료다.
  QA happy — representative-gate-exact: `q_approval representatives > "$SGG_EVIDENCE/task-10/approval.json"`; 에이전트가 원 사용자 근거와 행 목록을 대조하고 승인 이후 가능한 범위를 문서로 확인한다.
  QA failure — representative-not-global: `q_approval representatives negative > "$SGG_EVIDENCE/task-10/negative.txt"`; G-ART/G-EXPERIENCE가 여전히 pending임을 JSON assertion으로 확인한다. 대표 실패 시 해당6–9를 수정하며 품질/전체 범위를 낮추지 않는다.
  Evidence: `SGG_EVIDENCE/task-10/{approval.json,negative.txt,gate-snapshot.json}`; 실제 사용자 근거는 staging approvals에 보존한다.
  Commit: N — 사용자 결정은 커밋/비용/개발 승인으로 확대하지 않는다.

- [x] 11. PO 기본9면을 전량 리메이크한다
  Recommended task executor category: unspecified-high — 한 계열 전량 원화 제작이다.
  What to do / Must NOT do: scope의 PO9면 모두 제작한다.270C/270D/270E의 연질 차이·370W/440W/590Y/780Y의 재료·체형·PHS전후 같은인물을 유지한다. pilot채택 시에도 최종 version/SHA를 명시하고 새파일에 승인을 승계하지 않는다.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave3 | Blocked by: 10 | Blocks: 21,22.
  References: `game-edition/src/app_tpl.html:1810`; `game-edition/docs/design/game-replan-2026-10-31.md:83`, `:92`; task4 PO 명세와 task10 결정.
  Ownership / outputs: 새 `masters/characters/poo/`, `appearances/base/poo/`, `review/poo/`, `manifest/batches/poo.json`; batch poo=9기본면.
  Acceptance criteria: `q_files poo`가 정확히9개의 기본 외형을 검사한다. 각 면은 전신/72/동계열 비교에서 정체성·비율·재질·얼굴 안전영역을 확인했다.
  QA happy — poo-nine: `q_files poo > "$SGG_EVIDENCE/task-11/files.json"`;9전신과72비교판을 직접 열고 PHS두면 일치·차이를 기록한다.
  QA failure — poo-stale-export: `q_files poo negative > "$SGG_EVIDENCE/task-11/negative.txt"`; 어느 면 누락/잘못된SHA든 batch 완료 금지.
  Evidence: `SGG_EVIDENCE/task-11/{files.json,visual-review.md,negative.txt}`.
  Commit: N — staging 원화만 추가한다.

- [x] 12. CR 기본13면을 전량 리메이크한다
  Recommended task executor category: unspecified-high — 한 계열의 얇은 체형과 경면 차이를 제작한다.
  What to do / Must NOT do: scope의 CR13면 모두 새로 만든다. 낮게흐르는볏/세로패널·얇은몸·롤엠블럼·경면을 유지하고 CQ–S-EDDQ의 우아함과1180Y/1470M의 고장력 차이를 드러낸다. 구 검은얼굴/과도한리벳 복제 금지.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave3 | Blocked by: 10 | Blocks: 21,22.
  References: `game-edition/src/app_tpl.html:1822`; `game-edition/docs/design/game-replan-2026-10-31.md:83`; task4 CR 명세와 task10 결정.
  Ownership / outputs: 새 `masters/characters/ssial/`, `appearances/base/ssial/`, `review/ssial/`, `manifest/batches/ssial.json`; batch ssial=13면.
  Acceptance criteria: `q_files ssial` 대상13개; 전신/72·연질/최고등급 비교에서 계열식별·강종별 실루엣이 확인된다.
  QA happy — ssial-thirteen: `q_files ssial > "$SGG_EVIDENCE/task-12/files.json"`;13면 전신/72와 열처리면이 없는 점까지 실제 scope와 대조한다.
  QA failure — ssial-export-rejected: `q_files ssial negative > "$SGG_EVIDENCE/task-12/negative.txt"`; GA돔처럼 변한 CR은 기술통과와 별개로 재작화 목록에 남긴다.
  Evidence: `SGG_EVIDENCE/task-12/{files.json,visual-review.md,negative.txt}`.
  Commit: N — staging 원화만 추가한다.

- [x] 13. GA 기본14면을 전량 리메이크한다
  Recommended task executor category: unspecified-high — 지정 스타일과 도금 재질을 전 계급으로 확장한다.
  What to do / Must NOT do: GA14면을 만든다. 뿔없는돔/아래넓은패널·한겹보호층·육각삼중띠·자주이음선을 유지하고 연질~고장력·1470H가열전/프레스후를 구별한다. SSR입력의 문자·전투수치를 복제하지 않는다.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave3 | Blocked by: 10 | Blocks: 21,22.
  References: `game-edition/src/app_tpl.html:1838`, `:1852`; `game-edition/docs/design/game-replan-2026-10-31.md:68`, `:83`, `:92`; 고정SSR 및 task10 결정.
  Ownership / outputs: 새 `masters/characters/ga/`, `appearances/base/ga/`, `review/ga/`, `manifest/batches/ga.json`; batch ga=14면.
  Acceptance criteria: `q_files ga` 대상14개;1470H두면은 동일 인물이고 실제Al-Si보호층 의미와 재질/자세/빛 대비를 확인한다.
  QA happy — ga-fourteen: `q_files ga > "$SGG_EVIDENCE/task-13/files.json"`; 전신·72·SSR대조·열처리쌍을 직접 열람한다.
  QA failure — ga-newsha-rejected: `q_files ga negative > "$SGG_EVIDENCE/task-13/negative.txt"`; 파일수14여도 얼굴/엠블럼이 바뀐 열처리쌍은 수정한다.
  Evidence: `SGG_EVIDENCE/task-13/{files.json,visual-review.md,negative.txt}`.
  Commit: N — staging 원화만 추가한다.

- [x] 14. WR9·EG1·QP1 기본11면을 전량 리메이크한다
  Recommended task executor category: unspecified-high — 특수 형태 세 계열의 전체 범위를 마무리한다.
  What to do / Must NOT do: WR9의 선재별 도구/표면·유연함/고탄소/베어링/스프링 차이를 새로 그리고 EG편면·QP비대칭을 유지한다. WR은 판재보증 장착이 없는 실제 규칙도 보존한다.
  Closes: GAP-1, GAP-2.
  Parallelization: Wave3 | Blocked by: 10 | Blocks: 21,22.
  References: `game-edition/src/app_tpl.html:1855`, `:1861`, `:1871`; `game-edition/docs/design/game-replan-2026-10-31.md:83`; task7/10 결정.
  Ownership / outputs: 새 `masters/characters/{tarae,eg,qp}/`, `appearances/base/{tarae,eg,qp}/`, `review/wr-eg-qp/`, `manifest/batches/wr-eg-qp.json`; batch wr-eg-qp=11면.
  Acceptance criteria: `q_files wr-eg-qp` 대상11; 여섯 계열 기본면 합47이며 WR9·EG1·QP1의 실제키가 일치한다.
  QA happy — special-eleven: `q_files wr-eg-qp > "$SGG_EVIDENCE/task-14/files.json"`; 전신/72·WR재료군 비교·EG좌우·QP전용성 proof를 연다.
  QA failure — special-identity-failure: `q_files wr-eg-qp negative > "$SGG_EVIDENCE/task-14/negative.txt"`; WR얼굴고리나 EG편면이 사라지면 새 version으로 재작화한다.
  Evidence: `SGG_EVIDENCE/task-14/{files.json,visual-review.md,negative.txt}`.
  Commit: N — staging 원화만 추가한다.

- [x] 15. 보증 장비14종과 장착용 구성 요소를 전량 제작한다
  Recommended task executor category: unspecified-high — 휴대/설비 장비의 실물 의미와 장착 부품을 제작한다.
  What to do / Must NOT do: 실제 ITEMS14키를 전량 제작하고 portable/workbench 구분·도구 형태·보증 의미를 지킨다. task8의 재작화/레이어 결정에 필요한 손접점·지지·그림자 구성도 만든다. 단품승인을 장착승인으로 보지 않는다.
  Closes: GAP-1, GAP-2, GAP-5.
  Parallelization: Wave3 | Blocked by: 10 | Blocks: 21,22.
  References: `game-edition/src/app_tpl.html:1656`; `game-edition/tools/game-assets/contract.json:1760`; `game-edition/docs/design/game-replan-2026-10-31.md:117`; task8 제작구조 결정.
  Ownership / outputs: 새 `masters/items/`, `derived/item-layers/`, `review/items/`, `manifest/batches/items.json`; batch items=14단품과 등록된 구성 파일.
  Acceptance criteria: `q_files items`;14키 정확일치·용도/실루엣·전신/72구분·알파·장비별휴대/설비 접점 명세가 존재한다.
  QA happy — items-fourteen: `q_files items > "$SGG_EVIDENCE/task-15/files.json"`; 단품전체와 task8접점 비교를 직접 연다.
  QA failure — items-component-hash: `q_files items negative > "$SGG_EVIDENCE/task-15/negative.txt"`; 구단품 복사/그림자방향불일치/틀린보증도구는 수정대기다.
  Evidence: `SGG_EVIDENCE/task-15/{files.json,visual-review.md,negative.txt}`.
  Commit: N — 장비 아트 staging만 변경한다.

- [x] 16. 바디 부품10종을 새 수집품으로 제작한다
  Recommended task executor category: unspecified-high — 같은 부품군의 형태·빛을 일관되게 제작한다.
  What to do / Must NOT do: PARTS.grp=바디의 roof/hood/fender/sideo/dooro/trunkin/trunko/whouse/floor/bracket10키를 전량 만든다. 외판/인너의 실제 구조·얇은 판금 곡률과 부품식별을 유지하고 조립용 동일기준 anchor/bounds/layer를 staging metadata로 기록한다.
  Closes: GAP-1, GAP-5.
  Parallelization: Wave4 | Blocked by: 10 | Blocks: 22.
  References: `game-edition/src/app_tpl.html:1969`, `:2088`; `game-edition/docs/design/game-replan-2026-10-31.md:99`; `game-edition/docs/design/game-reviews/parts-body/assembly-metadata.json:1`(역사 참고).
  Ownership / outputs: 새 `masters/parts/body/`, `review/parts-body/`, `manifest/batches/parts-body.json`, `identity/assembly-body.json`; 기존 assembly metadata 수정 금지.
  Acceptance criteria: `q_files parts-body`;10개 실제키·새생성 원본·72/full·조립정적proof·anchor/bounds/layer범위가 유효하다.
  QA happy — body-ten: `q_files parts-body > "$SGG_EVIDENCE/task-16/files.json"`; 같은차급 조립정적판에서 겹침/형태를 직접 확인한다.
  QA failure — body-corrupt-proof: `q_files parts-body negative > "$SGG_EVIDENCE/task-16/negative.txt"`; 부품명만 바꾼 동일그림·역할이 다른 인너/외판은 반려 수정한다.
  Evidence: `SGG_EVIDENCE/task-16/{files.json,assembly-review.md,negative.txt}`.
  Commit: N — staging 부품만 제작한다.

- [x] 17. 프레임 부품10종을 제작한다
  Recommended task executor category: unspecified-high — 구조부품의 용도·굵기·조립관계를 제작한다.
  What to do / Must NOT do: sill/bumper/apillar/bpillar/crossm/impact/seat/reinf/roofx/sidemem10키를 새로 만든다. 고장력 부품의 구조와 필러/멤버/빔의 차이를 보존하고 body와 같은 좌표계의 조립 metadata를 쓴다.
  Closes: GAP-1, GAP-5.
  Parallelization: Wave4 | Blocked by: 10 | Blocks: 22.
  References: `game-edition/src/app_tpl.html:2013`, `:2050`, `:2092`; `game-edition/docs/design/game-replan-2026-10-31.md:99`; `game-edition/docs/design/game-reviews/parts-frame/assembly-metadata.json:1`.
  Ownership / outputs: 새 `masters/parts/frame/`, `review/parts-frame/`, `manifest/batches/parts-frame.json`, `identity/assembly-frame.json`.
  Acceptance criteria: `q_files parts-frame`;10키 정확일치·새master·full/72·조립proof가 있고 body와 좌표/광원이 맞는다.
  QA happy — frame-ten: `q_files parts-frame > "$SGG_EVIDENCE/task-17/files.json"`; 필러/빔/멤버 비교와 조립판을 직접 연다.
  QA failure — frame-missing-file: `q_files parts-frame negative > "$SGG_EVIDENCE/task-17/negative.txt"`; 구조구분 없는 장식막대 표현은 품질 반려로 기록한다.
  Evidence: `SGG_EVIDENCE/task-17/{files.json,assembly-review.md,negative.txt}`.
  Commit: N — staging 부품만 제작한다.

- [x] 18. 섀시·구동 부품15종을 제작한다
  Recommended task executor category: unspecified-high — 선재/고무/회전체 등 다양한 실제 부품을 제작한다.
  What to do / Must NOT do: tire/rim/disc/tank/bearing/spring/vspring/bolt/tierod/arm/clutch/stabil/brake/crank/conrod15키를 전량 만든다. 선재코드·베어링·스프링·크랭크 등의 실제 형태를 유지하고 조립 metadata를 맞춘다.
  Closes: GAP-1, GAP-5.
  Parallelization: Wave4 | Blocked by: 10 | Blocks: 22.
  References: `game-edition/src/app_tpl.html:1991`, `:2038`, `:2055`, `:2104`; `game-edition/docs/design/game-replan-2026-10-31.md:99`; `game-edition/docs/design/game-reviews/parts-chassis/assembly-metadata.json:1`.
  Ownership / outputs: 새 `masters/parts/chassis/`, `review/parts-chassis/`, `manifest/batches/parts-chassis.json`, `identity/assembly-chassis.json`.
  Acceptance criteria: `q_files parts-chassis`;15키·35부품 전체키 정확일치·새master/full/72/조립proof가 존재한다.
  QA happy — chassis-fifteen: `q_files parts-chassis > "$SGG_EVIDENCE/task-18/files.json"`; 물성·용도와 그림형태를1:1 직접 대조한다.
  QA failure — chassis-duplicate-or-corrupt: `q_files parts-chassis negative > "$SGG_EVIDENCE/task-18/negative.txt"`; 서로 다른 부품의 동일외형이나 누락은 완료 금지다.
  Evidence: `SGG_EVIDENCE/task-18/{files.json,assembly-review.md,negative.txt}`.
  Commit: N — staging 부품만 제작한다.

- [x] 19. 차급 정체성을 보존한 차량8종을 제작한다
  Recommended task executor category: unspecified-high — 미니어처 차량과 전시용 파생구도를 제작한다.
  What to do / Must NOT do: CARS8키를 같은 재질·조명·받침 세계관으로 새로 그린다. 미니밴/세단/소형/대형SUV/경차/로드스터 등 기존 힌트와 차급 차이는 유지하며 회사로고·실제차명은 드러내지 않는다.
  Closes: GAP-1, GAP-5.
  Parallelization: Wave4 | Blocked by: 10 | Blocks: 22.
  References: `game-edition/src/app_tpl.html:2128`; `game-edition/docs/design/game-replan-2026-10-31.md:99`; `game-edition/src/game/garage.js:1`(사용처 읽기 전용).
  Ownership / outputs: 새 `masters/cars/`, `review/cars/`, `manifest/batches/cars.json`; batch cars=8차량 및 scope에 등록한 전시구도.
  Acceptance criteria: `q_files cars`;8키·차급/비노출표·full/72·같은세계 전시판이 있고 미니어처비율/금속광원을 직접 확인한다.
  QA happy — cars-eight: `q_files cars > "$SGG_EVIDENCE/task-19/files.json"`;8대 비교판·전신·썸네일 proof를 연다.
  QA failure — cars-wrongsha: `q_files cars negative > "$SGG_EVIDENCE/task-19/negative.txt"`; 로고/명칭/차급붕괴/동일차체복제는 수정대기다.
  Evidence: `SGG_EVIDENCE/task-19/{files.json,vehicle-identity-review.md,negative.txt}`.
  Commit: N — staging 차량만 제작한다.

- [x] 20. 모든 장면·무대·받침·프레임·출하·아이콘 그림을 제작한다
  Recommended task executor category: unspecified-high — 누락되기 쉬운 모든 비캐릭터 시각물을 완결한다.
  What to do / Must NOT do: scope의 환경/기타 전량을 만든다. 계열배경6·기존장면10은 최소 출발점이며 공방/도감/제작/연구/차고·★2공방/★3제철소/★4노을/★5및열처리후하늘·슬래브·헤일로·받침·★2–5프레임/QP표시/RARE각인/코일·봉인/실루엣·그림아이콘·화면용서사그림도 포함한다.
  Closes: GAP-1, GAP-5.
  Parallelization: Wave4 | Blocked by: 10 | Blocks: 22.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:99`, `:176`; `game-edition/docs/design/game-screen-inventory.json:1`; `game-edition/src/app_tpl.html:1436`; `game-edition/tools/game-build/render.mjs:22`.
  Ownership / outputs: 새 `masters/environments/`, `masters/frames/`, `masters/draw/`, `masters/icons/`, `review/world-full/`, `manifest/batches/world-full.json`; 추가 필요그림은 scope에 먼저 등록한다.
  Acceptance criteria: `q_files world-full`; Q-USAGE 재대조에서 모든 mapped 사용처에 새target이 연결되고 배경crop/프레임투명중심/문자분리/실루엣정보숨김 proof가 있다.
  QA happy — all-world-uses: `q_files world-full > "$SGG_EVIDENCE/task-20/files.json"`; 새장면을 desktop/mobile 정적crop과 전신합성으로 직접 확인한다.
  QA failure — forgotten-seal-frame-icon: `q_files world-full negative > "$SGG_EVIDENCE/task-20/negative.txt"`; frame/seal/icon 사용처누락 probe가 coverage실패를 내며 구그림재사용0을 확인한다.
  Evidence: `SGG_EVIDENCE/task-20/{files.json,usage-reconciliation.json,visual-review.md,negative.txt}`.
  Commit: N — 모든 그림의 전량 제작을 staging에서 완결한다.

- [x] 21. 유효한 장착254외형을 모두 완성하고 검토용 raster를 만든다
  Recommended task executor category: unspecified-high — 제작구조는 확정됐으며 전 조합을 실물 그림으로 마무리한다.
  What to do / Must NOT do: scope의 비어있지않은 모든 equipment부분집합254를 cardId/side별로 제작한다. 107단일·147복수·PHS/1470H양면을 빠짐없이 다룬다. 레이어간 간섭·두손쟁탈·받침가림 등은 pose/contact를 실제 재작화해 해결한다.
  Closes: GAP-2, GAP-3.
  Parallelization: Wave5 | Blocked by: 11–15 | Blocks: 22; 16–20과 폴더가 분리된 경우 병렬 가능.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:117`; `game-edition/tools/game-assets/contract.json:3846`; task2전체조합·task8제작결정·tasks11–15승인대상원화.
  Ownership / outputs: 새 `appearances/equipped/<cardId>/<side>/<equipment-key>/vN/`, `review/equipped/`, `manifest/batches/equipped.json`; batch equipped=정확히254target. 구성파일·mask·renderSpec·최종PNG를 연결한다.
  Acceptance criteria: `q_scope`; `q_files equipped`;254target과 equipment키가 scope와 정확히 같고 모든 전신/72비교를 직접 열람했다. 한 조합이라도 누락·부자연스러움이면 미완료다.
  QA happy — equipped254-full-and72: `q_files equipped > "$SGG_EVIDENCE/task-21/files.json"`; card/side별 정적 비교판을 열어 손·장비·지지·얼굴·엠블럼·광원을 전량 checklist에 남긴다.
  QA failure — equipped254-multi-omission: `q_scope negative`와 `q_files equipped negative`를 `task-21/negative.txt`에 기록한다. 어떤 canonical layerSHA변경도 새version/최종raster재생성/재승인을 요구한다.
  Evidence: `SGG_EVIDENCE/task-21/{files.json,appearance-visual-checklist.json,negative.txt}`;254외형별 proof path목록.
  Commit: N — 조합 파일수와 승인단위수를 혼동하지 않는다.

- [x] 22. 새 원화의 모든 파생물과 전량 정적 비교판을 만든다
  Recommended task executor category: unspecified-high — 전량 아트와 실제 표시 크기를 묶는 파생 작업이다.
  What to do / Must NOT do: 모든thumb·PWA아이콘·차량thumb·draw분할·필요mask·크기별crop을 새master에서 생성한다. full/72·6계열/연질/열처리/301외형·동일세계·한국어/일본어별도층 비교판을 만들고 전량 승인용 정확한 manifest를 동결한다.
  Closes: GAP-1, GAP-2, GAP-3, GAP-5, GAP-7.
  Parallelization: Wave5 | Blocked by: 5,11–21 | Blocks: 23.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:99`, `:135`; `game-edition/docs/design/game-reviews/pilot11/plate/export.mjs:15`(명령 참고만, 실행금지); `game-edition/tools/game-assets/images.mjs:29`; task5문안.
  Ownership / outputs: 새 `derived/`, `review/all-art/index.json`, `review/all-art/plates/`, `manifest/batches/derived.json`; 모든활성target은 scope에 등록한다. 기존 export.mjs와 src쓰기 금지.
  Acceptance criteria: Q-DERIVE를 각 새경로에 실행하고 `q_files all` 통과. 모든 asset/파생/301외형의 reviewedSizes full+72, 필요3자세/crop/PWA별크기와 번역정적proof가 index에서 열리며 부모masterSHA를 가진다.
  QA happy — full-art-review-package: `q_files all > "$SGG_EVIDENCE/task-22/files.json"`; 모든 page를 직접 열어 잘린전신·가짜투명·작은크기식별·대사분리 여부를 확인한다.
  QA failure — stale-derived-hash: `q_files all negative > "$SGG_EVIDENCE/task-22/negative.txt"`; 임의 master변경 후 이전파생을 메모리상 연결하면 componentSHA불일치로 거부한다.
  Evidence: `SGG_EVIDENCE/task-22/{files.json,plate-index.json,visual-review.md,negative.txt}`; 실제전량비교판은 staging보존.
  Commit: N — 파생과 승인용 정적 자료만 만든다.

- [x] 23. 전량 커버리지·파일 건전성·잘못된 승인 거부를 검증한다
  Recommended task executor category: unspecified-high — 아트 전체의 기술 선행조건을 단일 동결목록에 대해 확인한다.
  What to do / Must NOT do: exactscope/301외형/모든사용처/원본재사용0/모든파일/모든proof/문안47/참조SHA를 재대조한다. pending·반려·옛SHA·agent승인·조합누락·해시변조를 읽기전용 negative probe로 거부한다. 기술PASS를 G-ART승인으로 만들지 않는다.
  Closes: GAP-2, GAP-3, GAP-6, GAP-7.
  Parallelization: Wave5 | Blocked by: 22 | Blocks: 24.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:141`, `:146`, `:154`; `game-edition/tools/game-assets/images.mjs:29`; task2scope/task3대장/task22동결목록.
  Ownership / outputs: 새 `review/all-art/technical-report.json`, `review/all-art/coverage-matrix.json`; 조정자가 동결 inventorySHA/scopeSHA와 totalTargets를 기록한다. runtime개정 금지.
  Acceptance criteria: `q_ref`, `q_scope`, `q_files all`, Q-TEXT 모두 실제통과; 총대상수는125고정값이 아닌 동결scope와 일치. gate는 여전히pending이고 사용자결정없음도 정상대기다.
  QA happy — all-art-technical-ready: 명령출력·실제시각검토목록·입력SHA를 `task-23/technical.json`에 묶는다. 301행과 기타모든target의 coverage가100%다.
  QA failure — art-gate-negative-matrix: `q_scope negative`, `q_files all negative`, `q_approval all negative`를 각각 실행해 거부case5종 이상을 `task-23/negative.json`에 기록한다. 승인긍정검사는 이 작업의필수가아니며 결정부재를 조작하지 않는다.
  Evidence: `SGG_EVIDENCE/task-23/{technical.json,coverage-matrix.json,negative.json}`와 실행원문.
  Commit: N — 기술검사를 사용자승인과 분리한다.

- [x] 24. G-ART 전체 아트의 직접 사용자 승인을 받고 정지한다
  Recommended task executor category: writing — 제품 소유자의 전량 판단을 정확한 산출물에 바인딩한다.
  What to do / Must NOT do: 동결된 전체target목록·301외형·모든기타그림·파생의 version/SHA/full/72자료를 제시한다. 사용자 명시승인만 기록하며 일괄승인은 실제확인한 목록을 정확히 적는다. 반려·대기·누락이1개라도 있으면 task24를 열어둔 채 아트만 수정한다.
  Closes: GAP-1, GAP-2, GAP-3, GAP-5.
  Parallelization: Wave5 | Blocked by: 23 | Blocks: 25 및 모든코드/체험판작업.
  References: `AGENTS.md:12`; `game-edition/docs/design/game-replan-2026-10-31.md:4`, `:146`, `:154`, `:165`; task23기술보고와 task3승인규칙.
  Ownership / outputs: 새 `approvals/all-art-decision.md`, 공용 user-decisions append·gates.G-ART갱신. 사용자원문근거를 저장하고 과거receipt는 보존한다.
  Acceptance criteria: `q_scope`, `q_files all`, `q_approval all`이 같은 동결SHA에 대해통과하고 G-ART.status=approved/decisionIds/scopeSHA/inventorySHA가 실제일치한다. 이는 향후체험판착수조건이며 체험승인·배포승인이 아니다.
  QA happy — global-art-gate-bound: `q_approval all > "$SGG_EVIDENCE/task-24/approval.json"`;원 사용자근거와전량목록을 대조하고 SHA256을 저장한다.
  QA failure — global-art-gate-refuses-stale: `q_approval all negative > "$SGG_EVIDENCE/task-24/negative.txt"`;gate 사본의 inventorySHA변조·1targetpending·G-REP만approved일 때 개발불가임을 inline assertion으로 확인한다. 응답부재는정지다.
  Evidence: `SGG_EVIDENCE/task-24/{approval.json,gate-binding.json,negative.txt}` 및 실제사용자결정.
  Commit: N — G-ART 전에는 worktree/코드/서버/빌드도 새로시작하지 않는다.

- [ ] 25. G-ART를 확인한 뒤 격리 사본과 제한된 QA 환경을 만든다
  Recommended task executor category: git — 사용자 원본을 보호하는 로컬 격리이며 실행 시 git-master skill을 먼저 읽는다.
  What to do / Must NOT do: 먼저 task24동결SHA/직접승인을 재확인한다. game-edition의 현재HEAD·dirty목록을 읽고 task소유 새detached worktree를 만든다. 승인된 현재 tracked수정이 있으면 대상파일/삭제목록을 기록한 snapshot을 사본에만 반영하며 원본은 건드리지 않는다. 미추적 재계획문서를 복사하고 SHA를 대조한다. 서버종료·stash·reset·자동commit 금지.
  Closes: GAP-3, GAP-6.
  Parallelization: Wave6 | Blocked by: 24 | Blocks: 26.
  References: `AGENTS.md:28`; `game-edition/docs/design/game-replan-2026-10-31.md:165`; `game-edition/tools/game-qa.mjs:23`; `game-edition/tests/game/playwright.config.mjs:11`; task24gate.
  Ownership / outputs: 새 절대경로 `SGG_WORKTREE=$SGG_PROJECT/.omo/worktrees/steel-companion-full-art-remake/game-edition`; `SGG_GAME=$SGG_WORKTREE`; `SGG_PROTO=$SGG_GAME/.omo/prototypes/steel-companion-full-art-remake`; 새 `$SGG_PROTO/qa/playwright.config.mjs`, `qa/prototype.spec.mjs`, `workspace-binding.json`. root의plan/art/ref는원본절대경로로읽고 필요한승인파일만사본에복사한다.
  Acceptance criteria: `git -C "$SGG_PROJECT/game-edition" worktree add --detach "$SGG_WORKTREE" HEAD`는 새경로에만 실행한다. source/worktree/charter/승인파일 SHA대조·원본dirty불변·원본서버불변이 기록된다. `SGG_BASELINES_ROOT=$SGG_PROJECT/.omo/evidence/game-edition/game-20261025-01a16bac/baselines`를 명시하고 original/education HTML SHA가 각각1207e159c272c25fe93033ac35f80b6a8a8337dec8d5ed42cf3ec298fcfc7d5b/99537b579bddbb93994b7e19fad2348c736c8cb95e1bfa1a4d5dbdeedafa7126이다.
  QA happy — isolated-workspace-bound: `q_approval all`; `npm exec playwright test -- --config "$SGG_PROTO/qa/playwright.config.mjs" --list`로격리config만 읽힘을 확인한다. prototype config는trace retain-on-failure·screenshot only-on-failure·workers1/retries0·새origin·임시profile·실패산출물보존을 쓴다.
  QA failure — workspace-gate-and-baseline-reject: adapter/config의 inline Node검증에서 pendingG-ART·다른inventorySHA·잘못된baselineSHA·원본과겹치는out을 각각 거부한다. 기존공식config의trace조건은 이시점수정하지 않는다.
  Evidence: `SGG_EVIDENCE/task-25/{workspace-binding.json,config-list.txt,negative.json,original-preservation.json}`.
  Commit: N — detached localworktree만 생성한다. branch/PR/push/deploy는별도요청이다.

- [ ] 26. 공식 계약을 바꾸지 않는 체험판 전용 아트 adapter를 만든다
  Recommended task executor category: unspecified-high — 격리된 읽기전용 승인자료를 현재 shell에 연결한다.
  What to do / Must NOT do: `$SGG_PROTO/prepare.mjs`가 승인staging을 읽고 gate/inventory/scope/component SHA를 검증한 후 필요한파일을 `$SGG_PROTO/public/art/`에복사한다. 기존template/source를 사본으로 읽고 prototype가수정하는모듈만 `$SGG_PROTO/src/`에서 대체한다. 공식manifest/schema/contract·기존src/test는변경하지 않는다.
  Closes: GAP-3, GAP-4, GAP-5.
  Parallelization: Wave6 | Blocked by: 25 | Blocks: 27–29.
  References: `game-edition/tools/game-build/render.mjs:1`, `:8`, `:22`, `:27`; `game-edition/src/game/presentation.js:12`; `game-edition/tools/game-assets/schema.mjs:54`; `game-edition/docs/design/game-replan-2026-10-31.md:165`, `:207`.
  Ownership / outputs: 새 `$SGG_PROTO/{prepare.mjs,prototype-assets.json,public/,src/,qa/adapter.spec.mjs}`. adapter는 기존순수 render함수만 사용해 일시적faces/assetMap을 넘기고 `COMPANION_ART` 별도config를 moduleboot전에 주입한다. 공식schema검증/collect/publication/build함수는호출하지 않는다. source의미변경은prototype사본에한정한다.
  Acceptance criteria: `node "$SGG_PROTO/prepare.mjs" --art "$SGG_ART" --out "$SGG_PROTO/public" --evidence "$SGG_EVIDENCE/task-26"`가G-ART바인딩·47face·301lookup·모든필요사용처·같은파일SHA를검증한다. source오염0·old그림fallback0·fakeasset0·공식계약변경0·SGG_GAME의index.html미변경을확인한다. 새별도port를기록한다.
  QA happy — adapter-approved-art-only: `q_proto adapter-approved-art-only`;47base+254equipped가승인된copy만가리키며source/packagedapp과다른origin·storagekey를사용한다.
  QA failure — adapter-stale-or-unapproved: `q_proto adapter-stale-or-unapproved`;잘못된SHA·없는조합·미승인version·없는파일을넣으면build실패/명시적오류이고구그림으로조용히대체하지않는다.
  Evidence: `SGG_EVIDENCE/task-26/{adapter-report.json,source-preservation.json,prototype-report.json,negative/}`.
  Commit: N — 체험adapter는출하용계약이아니다.

- [ ] 27. 체험판 합성·47면 선택형 일본어 대사를 연결한다
  Recommended task executor category: visual-engineering — 승인외형과카드읽기경험을격리UI에연결한다.
  What to do / Must NOT do: prototype presentation복사본이cardId/side/sortedEquipmentKeys로정확한승인renderSpec를선택한다. base/단일/복수/열처리를동일컴포넌트로보이고미발견은정보숨긴계열실루엣을쓴다. 한국어기본·선택펼침일본어·lang=ja·화면읽기/줄바꿈·원문과분리된DOM텍스트를구현한다.
  Closes: GAP-2, GAP-4, GAP-7.
  Parallelization: Wave6 | Blocked by: 5,26 | Blocks: 28,29.
  References: `game-edition/src/game/presentation.js:20`, `:41`, `:80`; `game-edition/src/app_tpl.html:1436`, `:5412`; task5문안·task21renderSpec·`game-edition/docs/design/game-replan-2026-10-31.md:182`.
  Ownership / outputs: 새/수정 `$SGG_PROTO/src/{presentation.js,prototype.css,dialogue.js}`, `$SGG_PROTO/qa/compositor-dialogue.spec.mjs`;기존공식src는수정하지않는다.
  Acceptance criteria:301key를샘플없는전수순회해승인targetSHA/구성순서/72식별을검증한다.47키의ko/ja는source와일치하고기본ja숨김·선택노출·alt대사분리·일본어lang·390/1280폭에서overflow0이다.
  QA happy — prototype-compositor-ja47: `q_proto prototype-compositor-ja47`;전수dataassertion과base/4장비/양열처리화면실제캡처를기록한다.
  QA failure — prototype-missing-image-and-ja: `q_proto prototype-missing-image-and-ja`;이미지실패→접근가능한명시적오류/다시시도,ko유지·없는ja키거부·늦은응답취소·미발견고유정보비노출을확인한다.
  Evidence: `SGG_EVIDENCE/task-27/{prototype-report.json,compositor301.json,dialogue47.json,screenshots/,negative/}`.
  Commit: N — 공식UI·manifest·schema는체험승인뒤에만개정한다.

- [ ] 28. 1회·10연 출하와 결과 감상 체험을 구현한다
  Recommended task executor category: visual-engineering — 새연출을기존경제결과와분리해구현한다.
  What to do / Must NOT do: prototype draw복사본으로★2/3약2.5초·★4약3.5초·★5기본4.5초(체험범위4–5초),탭개봉/빛예고/공개,10연장당0.2초+최고등급컷인·영구결과목록/상세를구현한다. ★2흑피다크→★3은청→★4금빛→★5템퍼홀로/QP표시·RARE작은각인을분리한다.
  Closes: GAP-4, GAP-6.
  Parallelization: Wave6 | Blocked by: 27 | Blocks: 29,30.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:176`, `:185`; `game-edition/src/game/draw.js:141`; `game-edition/src/app_tpl.html:5030`; `game-edition/tests/game/game-draw.spec.mjs:25`(안전요건참고,구시간검사개정금지).
  Ownership / outputs: 새/수정 `$SGG_PROTO/src/{draw.js,prototype.css,audiovisual.js}`, `$SGG_PROTO/qa/draw.spec.mjs`;기존오디오자산·cue를승인될timeline에동기화하며새음악제작은추가하지않는다.
  Acceptance criteria:기존command가비용/RNG/지급을1회확정하고save시도후확정복사본으로연출한다. 스킵·감소모션즉시결과·10연결과유지·상세후복귀·저장실패정직표시·소리/이미지실패격리가작동한다. exact시간은체험값이지공식계약확정이아니다.
  QA happy — prototype-draw-single-ten: `q_proto prototype-draw-single-ten`;두엔진에서각등급1회·최고등급포함10연·탭개봉/결과상세·소리on/off를직접조작하고RNG/소비/지급횟수를대조한다.
  QA failure — prototype-draw-interruption: `q_proto prototype-draw-interruption`;각단계스킵/닫기/재진입·연타·감소모션·소리차단/이미지실패/save실패에서재추첨/중복지급/추가소비0을확인한다.
  Evidence: `SGG_EVIDENCE/task-28/{prototype-report.json,draw-state-counts.json,screenshots/,negative/}`.
  Commit: N — 체험용표현만변경하며원본경제함수의미를바꾸지않는다.

- [ ] 29. 공방→출하→결과→도감 재열기 체험 루프를 완성한다
  Recommended task executor category: visual-engineering — 소장욕구가다음행동으로이어지는체험루프를완성한다.
  What to do / Must NOT do: 승인공방/무대/받침으로홈과도감사본을묶는다. 새발견·사용가능부품·다음수집목표를기존진행데이터로제시하고결과카드와도감상세를동일표현으로재열게한다. 미발견정보숨김·TS/EL/RA·QP개발전용·키보드초점복귀를유지한다.
  Closes: GAP-4, GAP-5, GAP-6.
  Parallelization: Wave6 | Blocked by: 28 | Blocks: 30.
  References: `game-edition/src/game/home.js:1`; `game-edition/src/game/collection.js:1`; `game-edition/src/app_tpl.html:4817`, `:5014`; `game-edition/docs/design/game-replan-2026-10-31.md:176`.
  Ownership / outputs: 새/수정 `$SGG_PROTO/src/{home.js,collection.js,prototype.css}`, `$SGG_PROTO/qa/loop.spec.mjs`, `$SGG_PROTO/experience-review.json`;제작/연구/차고본개발은시작하지않는다.
  Acceptance criteria:새profile로한사이클끝난뒤도감에서같은면/장착/문안/물성을다시볼수있고10연목록은사용자가닫기전유지된다. 공방에서다음목표가현재조건과일치하며미발견고유정보0노출이다.
  QA happy — prototype-core-loop: `q_proto prototype-core-loop`;390×844·1280×900·키보드/터치에서공방→1회/10연→상세→도감재열기→다음목표를직접완주한다.
  QA failure — prototype-loop-back-and-unknown: `q_proto prototype-loop-back-and-unknown`;상세닫기/브라우저뒤로/재진입/미발견/QP미개발/그림실패에서초점·표시·경제안전을확인한다.
  Evidence: `SGG_EVIDENCE/task-29/{prototype-report.json,experience-review.json,screenshots/,negative/}`.
  Commit: N — 격리체험루프만완성한다.

- [ ] 30. G-EXPERIENCE 직접 사용자 체험 승인을 받고 정지한다
  Recommended task executor category: writing — 실제플레이판단을코드/아트버전에묶는관문이다.
  What to do / Must NOT do:사용자가격리체험에서다시열어보고싶은가·등급별손맛·10연감상·다음수집/제작목적·대사선택을판단하게한다. 실제피드백에맞춰25–29범위만수정하고같은시나리오를재검증한다. 승인없으면공식계약/본개발정지다.
  Closes: GAP-3, GAP-4, GAP-7.
  Parallelization: Wave6 | Blocked by: 27–29 | Blocks: 31.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:166`, `:167`, `:207`; task24G-ART·task27–29체험증거.
  Ownership / outputs: 새 `approvals/experience-decision.md`, `review/experience-contract-candidate.json`, G-EXPERIENCE의명시적판단/buildSHA/artGateSHA/scenario목록. 사용자원문근거를보존한다.
  Acceptance criteria:체험buildSHA가실제재생산출물과같고G-ART는여전히유효하다. 사용자명시승인이확인되면G-EXPERIENCE만approved로기록한다. 최종등급시간·10연/프레임/음향/대사표시결정이구체적값으로candidate에고정된다.
  QA happy — experience-gate-bound: `q_proto prototype-core-loop`; `q_proto prototype-draw-single-ten`의최신결과와사용자확인build가같음을inlineSHA검사하고 `task-30/gate-binding.json`에기록한다.
  QA failure — experience-gate-stale-build:사용자결정사본의buildSHA변조·G-ART변조·pending판단을각각넣어공식계약착수조건이false임을inlineNodeassertion으로검증한다. 사용자무응답은승인이아니다.
  Evidence: `SGG_EVIDENCE/task-30/{gate-binding.json,negative.json,approved-experience-values.json}`와실제사용자근거.
  Commit: N — 체험승인도커밋/푸시/배포승인이아니다.

- [ ] 31. 승인된 체험으로 공식 아트·표현·테스트·빌드 계약을 통합한다
  Recommended task executor category: unspecified-high — 이미검증한표현을공식계약으로옮기는다중파일통합이다.
  What to do / Must NOT do: G-ART/G-EXPERIENCE를재확인한뒤에만정식manifest/contract/schema·art-bible/screen/system/audiovisual/production문서·buildinputs/render를동시에개정한다. staging승인파일을worktree의정식art/review경로로SHA보존복사하고prototypeadapter에의존하지않는productionconfig·compositor/quote/draw/home/collection으로옮긴다.
  Closes: GAP-3, GAP-4, GAP-5, GAP-6, GAP-7.
  Parallelization: Wave7 | Blocked by: 30 | Blocks: 32–35.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:167`, `:207`; `game-edition/tools/game-assets/schema.mjs:54`; `game-edition/tools/game-assets/contract.json:27`; `game-edition/tools/game-build/render.mjs:22`; `game-edition/tests/game/playwright.config.mjs:11`; `game-edition/src/game/presentation.js:12`.
  Ownership / outputs: worktree의 `docs/design/game-asset-manifest.json`, `tools/game-assets/{contract.json,schema.mjs,verify.mjs}`, `tools/game-build/{inputs.mjs,render.mjs}`, `src/game/{presentation.js,draw.js,home.js,collection.js,game.css}`, `src/app_tpl.html`, 관련정식문서·tests/case registry. 수량은동결scope기반,호환규칙불변,301외형승인바인딩·frame/scene/derived확장·정확한사용자결정필수다.
  Acceptance criteria: Q-BUILD가fixture=false정상package를생성하고신규정식config가모든승인파일/조합/대사키를포함한다. 공식tests는시간/프레임조건만승인체험값으로개정하고RNG/save/스킵/취소검사는유지한다. 공식QAconfig는case단위trace retain-on-failure/실패screenshot·임시dir청소·성공JSON/필수caps만보존한다.
  QA happy — production-contract-approved-only: Q-BUILD; `q_game game-build task-31`; `q_game layer-compositor task-31`; `q_game game-collection task-31`; `q_game art-full-review task-31`. 각결과가prototype경로/adapter없이productionbuild·정식sourceSHA를바인딩하는지확인한다.
  QA failure — production-no-prototype-fallback: `q_game layer-compositor-retry task-31`; `q_game runner-negative task-31`;정식manifest에서없는조합/반려버전/다른SHA·잘못된프레임/마스크를읽기전용fixture로거부하고prototype디렉터리참조0을검사한다.
  Evidence: `SGG_EVIDENCE/task-31/{build-report.json,contract-migration.json,qa-runs/,negative/,prototype-independence.json}`.
  Commit: N — 계약/정식코드통합은localworktree에만두며별도승인없이commit하지않는다.

- [ ] 32. 제작대·보증·장착 화면을 새 아트와 전체 조합에 연결한다
  Recommended task executor category: visual-engineering — 공식제작/장착사용처를하나의승인합성기로통합한다.
  What to do / Must NOT do: 제작35부품과보증14장비의선택/상세/완성·조건부족·장착/미리보기 취소/복수 장비 표시를새자산으로표시한다. 실제호환fit·아이템귀속·복수장착·재고소비·QP재고무소모를유지하고어떤표시도추가지급/소비를하지않는다. assemblymetadata는승인부품기준으로정식통합한다.
  Closes: GAP-2, GAP-5, GAP-6.
  Parallelization: Wave7 | Blocked by: 31 | Blocks: 35,36; 33/34와파일소유분리.
  References: `game-edition/src/game/crafting.js:1`; `game-edition/src/game/equipment.js:1`; `game-edition/src/app_tpl.html:4489`, `:4756`; `game-edition/tests/game/game-crafting.spec.mjs:1`; `game-edition/tests/game/game-equipment.spec.mjs:1`.
  Ownership / outputs: worktree `src/game/{crafting.js,equipment.js}`, 관련두spec와장비/제작HTML·기존game.css의정해진구간patch. 공용파일전체덮어쓰기금지; 조정자가구간통합한다.
  Acceptance criteria:35부품·14장비·301외형의현재상태가정식config와일치한다. 단일/4장비/열처리양면·장착 미리보기/미리보기 취소/복수 장비 표시·부품제작결과가원래데이터/재고상태와동일하다.
  QA happy — crafting-equipment-world: `q_game game-crafting task-32`; `q_game game-equipment task-32`;실제제작가능/장착가능profile에서부품완성→새외형→도감재열기를직접조작한다.
  QA failure — crafting-equipment-state-safety:동일cases의재고부족/미소유/비호환/연타/저장실패/취소/재진입assertion을확인하고실행명단을증거에남긴다. 없는failuretest는같은task에서추가한뒤실행한다.
  Evidence: `SGG_EVIDENCE/task-32/{qa-runs/,state-diff.json,screenshots/,negative-cases.json}`.
  Commit: N — 게임상태는격리된테스트profile에서만변경한다.

- [ ] 33. 연구·학습·서사 사용처를 새 세계와 정확한 정보로 통합한다
  Recommended task executor category: visual-engineering — 원래콘텐츠를새아트표시와연결한다.
  What to do / Must NOT do: 연구/학습/QP개발·물성/퀴즈·화면용서사그림을새자산으로교체하고원래명칭·대사·문제의미·개발조건을유지한다. 웹툰원본은보존자료로두며새화면그림은전량승인대상이다. 서사재집필/퀴즈전체일본어번역은추가하지않는다.
  Closes: GAP-5, GAP-6, GAP-7.
  Parallelization: Wave7 | Blocked by: 31 | Blocks: 35,36; 32/34와구간분리.
  References: `game-edition/src/app_tpl.html:1227`, `:1293`, `:5370`; `game-edition/tests/game/game-research.spec.mjs:1`; `game-edition/docs/design/game-replan-2026-10-31.md:110`, `:182`; `game-edition/tools/game-build/comics.json:1`.
  Ownership / outputs: worktree연구/학습/서사HTML·기존game.css의해당구간patch, `tests/game/game-research.spec.mjs`, 필요한사용처mapping. 생산명칭/경제정의소유권은task36검증대상이다.
  Acceptance criteria:원래개발조건·학습정보·퀴즈정답/이벤트/차량힌트가동일하고QP전용정체성·미발견숨김·원ko/optionalja47표시가유지된다. 모든화면그림은task24승인SHA다.
  QA happy — research-story-integrated: `q_game game-research task-33`; `q_game baseline-contracts task-33`;연구완료전후/학습/서사상세를직접열어확인한다.
  QA failure — research-locked-and-repeat:game-research의조건부족/중복개발/잘못된답/미발견/뒤로/이미지실패scenario를실행하고발견전정보노출0·중복지급0을assert한다.
  Evidence: `SGG_EVIDENCE/task-33/{qa-runs/,information-parity.json,screenshots/,negative-cases.json}`.
  Commit: N — 교육판과기존서사원본파일은변경하지않는다.

- [ ] 34. 차고·차량8종·35부품 조립 전시를 통합한다
  Recommended task executor category: visual-engineering — 새부품/차량을실제차고상태로연결한다.
  What to do / Must NOT do: 차량선택/조립확정/미보유/대표전시/다시열기를새아트로만들고35부품소비→차량1대획득·날짜·8종조건·중복보유방지규칙을유지한다. 회사/실제차명비노출·힌트의원래뜻·차급식별을지킨다.
  Closes: GAP-5, GAP-6.
  Parallelization: Wave7 | Blocked by: 31 | Blocks: 35,36; 32/33과파일소유분리.
  References: `game-edition/src/game/garage.js:1`; `game-edition/src/app_tpl.html:4259`, `:4336`, `:4358`; `game-edition/tests/game/game-garage.spec.mjs:1`; task16–19승인자료.
  Ownership / outputs: worktree `src/game/garage.js`, 기존game.css의차고구간patch, 차고HTML구간patch·`tests/game/game-garage.spec.mjs`.
  Acceptance criteria:8차량/35부품정확연결·대표전시재열기·조립소비/지급1회·정보비노출·정적승인구도와동일세계가확인된다. 실제사용자save를읽거나교체하지않는다.
  QA happy — garage-eight-new-art: `q_game game-garage task-34`;테스트profile로35부품준비→차량선택→확정→대표전시→재열기를직접완주한다.
  QA failure — garage-cancel-and-duplicate:같은case의취소/연타/이미보유/부품부족/save실패/재진입을assert하여부품손실·중복차량·거짓저장성공이없음을확인한다.
  Evidence: `SGG_EVIDENCE/task-34/{qa-runs/,assembly-state-diff.json,screenshots/,negative-cases.json}`.
  Commit: N — 차고화면과테스트profile만변경한다.

- [ ] 35. 반응형·접근성·그림 로딩·성능을 전체 화면에서 정리한다
  Recommended task executor category: visual-engineering — 통합후모든사용처의실제표시품질을검증한다.
  What to do / Must NOT do: 공방/출하/도감/장착/제작/연구/차고/설정/백업의390×844·1280×900,OS 색상 선호 밝음/어두움 두 환경(앱의 기존 미술 방향을 유지하며 새 테마 기능은 추가하지 않음),키보드/터치·200%확대·감소모션·대사줄바꿈을다룬다. 이미지실패/늦은응답취소/다시시도·초점복귀·대비·잘림을수정한다.
  Closes: GAP-4, GAP-5, GAP-6, GAP-7.
  Parallelization: Wave7 | Blocked by: 31–34 | Blocks: 36.
  References: `game-edition/tests/game/accessibility.spec.mjs:1`; `game-edition/tests/game/performance.spec.mjs:1`; `game-edition/src/game/presentation.js:41`; `game-edition/tools/game-assets/schema.mjs:57`; `game-edition/docs/design/game-replan-2026-10-31.md:188`.
  Ownership / outputs: worktree `src/game/game.css`, 화면별CSS구간의통합수정·접근성/성능tests·crop/mask사용처보정. 승인원화pixel/renderSpec변경이필요하면G-ART재승인으로되돌린다.
  Acceptance criteria:실제표시72px에서얼굴/장비구분·일본어lang/줄바꿈·미발견비노출·focustrap/복귀가통과한다. 기존budget visual40MiB/index1MiB/initial2MiB를유지하며불가능하면임의상향하지않고근거/사용자결정이남는다.
  QA happy — responsive-accessible-all-flows: `q_game game-accessibility task-35`; `q_game game-performance task-35`; `q_game game-home-navigation task-35`;두엔진/두폭/테마조합의대표화면을직접조작/캡처한다.
  QA failure — retry-reduced-motion-large-text: `q_game layer-compositor-retry task-35`;실패이미지·성공재시도·오래된응답무시·reducedMotion·200%/긴ja/키보드중단scenario를assert한다. 성공rawtrace를반복보존하지않는다.
  Evidence: `SGG_EVIDENCE/task-35/{qa-runs/,viewport-theme-matrix.json,budgets.json,screenshots/,negative/}`.
  Commit: N — 완료근거가나오기전성능/접근성통과를주장하지않는다.

- [ ] 36. 경제·저장·백업·아이템 정합성의 전체 회귀를 검증한다
  Recommended task executor category: deep-low — 기존안전불변식을보존하는통합회귀이며 **Astra High**를실제요청/확인한다.
  What to do / Must NOT do:원본과동일seed/profile로확률/RARE가중치/스크랩확정교환/10연보장/픽업/QP/재고/장착귀속/부품/차량/저장·백업·복구·오프라인진행을대조한다. 새표시계층의RNG/추가소비/중복지급0·확정결과불변·save실패정직표시를확인한다. 실제사용자저장·원본baseline은쓰지않는다.
  Closes: GAP-6.
  Parallelization: Wave8 | Blocked by: 35 | Blocks: 37.
  References: `AGENTS.md:22`; `game-edition/docs/design/game-replan-2026-10-31.md:35`, `:185`, `:208`; `game-edition/src/app_tpl.html:5030`; `game-edition/tests/game/game-draw.spec.mjs:25`; `game-edition/tests/game/edition-storage.spec.mjs:1`; `game-edition/tests/game/baseline-contracts.spec.mjs:1`.
  Ownership / outputs: 필요한회귀수정은worktree의기존경제/저장tests와해당원인코드만소유한다. 새재현증거 `task-36/regression-matrix.json`, `model-receipt.json`; 저장schema변경이나대규모refactor는범위에없다.
  Acceptance criteria:baseline두SHA불변·전체deterministic상태차이0(새표시전용상태제외),장비중복귀속0,저장/복구실패가원데이터를보존한다. 구1.45초/구프레임assertion만task30승인값으로개정됐고안전검사는남아있다. 실제AstraHigh확인없으면이검토를완료표시하지않는다.
  QA happy — economy-persistence-parity: `q_game baseline-contracts task-36`; `q_game game-draw task-36`; `q_game edition-storage task-36`; `q_game edition-e2e task-36`; `q_game game-settings task-36`을한번씩실행한다.
  QA failure — interrupted-save-backup-equipment:위cases와 `q_game game-equipment task-36`의save거부/손상backup/이전버전불러오기/중단재개/연타/4장비 동시 표시/열처리면전환/소리·이미지실패를실행명단으로확인한다. 실패한원인관련case만수정후재실행한다.
  Evidence: `SGG_EVIDENCE/task-36/{regression-matrix.json,model-receipt.json,qa-runs/,state-diffs/,negative/}`.
  Commit: N — 결함수정은localworktree에두고별도커밋승인을받는다.

- [ ] 37. 실제 배포형 패키지·offline·브라우저 완주를 검증한다
  Recommended task executor category: unspecified-high — 정식산출물이개발사본과동일하게동작하는지검증한다.
  What to do / Must NOT do:task36최종source로Q-BUILD를새versionout에실행하고그out을Q-PACKAGE입력으로묶는다. hashedasset/releaseid·PWA아이콘·serviceworker·offline업데이트·패키지독립실행·상대경로·모든화면/선택ja를확인한다. 배포·공개·서버교체는하지않는다.
  Closes: GAP-5, GAP-6, GAP-7.
  Parallelization: Wave8 | Blocked by: 36 | Blocks: 38.
  References: `game-edition/tools/game-build/build.mjs:12`; `game-edition/tools/game-build/package.mjs:1`; `game-edition/tools/game-build/cli.mjs:8`; `game-edition/tests/game/packaged-smoke.spec.mjs:1`; `game-edition/tests/game/pwa.spec.mjs:1`.
  Ownership / outputs: 새 `SGG_EVIDENCE/task-37/{build,package,build-report.json,package-report.json}`;필요한localpackage/PWA코드와해당tests만수정한다. 과거package·공개링크·사용자서버는보존한다.
  Acceptance criteria: 최종build와package의releaseSHA가같고fixture=false·missingasset0·절대로컬path0·prototype의존0이다. offline에서공방/도감/주요루프/일본어선택이작동하고업데이트중저장분리/복구가유지된다. 정상package는negative실행전후SHA동일이다.
  QA happy — packaged-two-browser-offline:task37의build/out/report로바꾼Q-BUILD→Q-PACKAGE→ `SGG_PACKAGE_ROOT="$SGG_EVIDENCE/task-37/package" q_game packaged-smoke task-37`→ `q_game game-pwa-unit task-37`;실제두엔진새context에서오프라인전환후카드재열기를직접한다.
  QA failure — package-rejects-corruption:Q-NEGATIVE-PACKAGE3종을task37새경로에서실행하고해시변조/누락/temp실패가정상package를바꾸지않으며source·baselineSHA도불변임을확인한다.
  Evidence: `SGG_EVIDENCE/task-37/{build-report.json,package-report.json,qa-runs/,offline-screenshots/,negative-*/}`.
  Commit: N — 로컬패키지만전달가능상태로만들며배포하지않는다.

- [ ] 38. 새 아트·승인·체험·검증 문서를 인계하고 옛 기록을 보존한다
  Recommended task executor category: writing — 실행완료근거와남은제한을정확히묶는문서인계다.
  What to do / Must NOT do:출처·범위·동결전체수량·301외형·47문안·대표/전량/체험사용자결정·정식계약개정·실제QA/모델영수증·실패보존·패키지실행법·되돌림경로를연결한다. 구approved/125기록은역사문서로표시하고삭제/새승인으로개작하지않는다.
  Closes: GAP-3, GAP-5, GAP-6, GAP-7.
  Parallelization: Wave8 | Blocked by: 37 | Blocks: F1–F4.
  References: `game-edition/docs/design/game-replan-2026-10-31.md:17`, `:207`, `:210`; `game-edition/docs/design/game-reviews/README.md:3`; `game-edition/tools/game-build/README.md:1`; task1–37실제증거.
  Ownership / outputs: worktree새 `docs/design/full-art-remake-handoff.md`,기존production/reviews/buildREADME의관련문단, 새 `SGG_EVIDENCE/task-38/evidence-index.json`, `preservation-report.json`;rootAGENTS/과거goal/Boulder/교육판은수정하지않는다.
  Acceptance criteria:모든문서링크·파일SHA·실행명령·gate근거가존재하고실제검증과미실행항목을구분한다. 교육판/사용자원본/과거records/서버보존근거가있다. prototype산출물은실험으로표시하고production완료근거는task31–37만가리킨다.
  QA happy — handoff-evidence-reachable: `q_game documentation-contract task-38`;inlinePython으로evidence-index의모든상대파일존재/SHA/productionrelease일치를확인한다. 로컬package실행법으로새context한번열어확인한다.
  QA failure — handoff-missing-evidence:index의메모리사본에서승인근거·package-report·Astrareceipt를각각제거하면완료조건이실패함을검증한다. 없음/미실행/모델미확인을완료라고쓰지않는다.
  Evidence: `SGG_EVIDENCE/task-38/{evidence-index.json,preservation-report.json,documentation-run/,negative.json}`.
  Commit: N — 최종검토후에도자동commit/push/deploy하지않는다.

## Final verification wave
> 모든 실행 작업 후 F1–F3을 병렬 검토하고, 그 결과가 모두 확정되면 F4 Astra High 최종 통합 검토를 수행한다. 네 검토 모두 APPROVE여야 하며 결과를 제시하고 사용자의 최종 확인을 기다린다.
- [ ] F1. Plan compliance audit
  Recommended task executor category: unspecified-high — 독립 읽기전용 범위/관문 감사, task38 이후 실행한다.
  What to do / Must NOT do:38개작업의실제산출·7개GAP·전체target/301외형/47문안·세사용자관문·역사보존·prototype/공식계약착수순서·교육판불변을감사한다. 계획/worker보고만보고승인하지않는다.
  References: 이계획의Scope/Todos/Success criteria; `game-edition/docs/design/game-replan-2026-10-31.md:4`, `:154`, `:207`; task38evidence-index.
  Acceptance criteria:산출파일·원사용자결정·실행결과·SHA를직접읽고각범위행이covered이며금지조기개발/자동승인/무단배포0이다. 누락/순서위반은APPROVE불가다.
  QA happy — final-scope-traceability: `q_ref`; `q_scope`; `q_files all`; `q_approval all`; task38inlineindex검사를재사용해표와실제파일을1:1대조한다.
  QA failure — final-scope-negative: `q_scope negative`; `q_approval all negative`;검증사본에서한IS/전량승인근거누락시APPROVE가불가한지확인한다.
  Evidence / outcome: `SGG_EVIDENCE/final/F1/{verdict.json,coverage-matrix.json,negative.txt}`;결론APPROVE또는재현가능한미충족행/수정작업을명시한다.
  Commit: N — 읽기전용검토만한다.

- [ ] F2. Code quality review
  Recommended task executor category: unspecified-high — 최종source/계약/패키지의읽기전용코드검토다.
  What to do / Must NOT do:실제diff·전체변경파일·테스트assertion·builder/adapter분리·ID/side/equipment해석·해시/승인검증·취소/리소스정리·DOM텍스트안전·실패표시를검토한다. 최종production이prototypeadapter를읽거나옛approved를우회근거로쓰는지확인한다.
  References: `game-edition/src/game/presentation.js:12`, `:41`; `game-edition/tools/game-build/render.mjs:1`; `game-edition/tools/game-assets/schema.mjs:54`; task31–37최신source와QA증거.
  Acceptance criteria:유효외형선택/경제분리/저장안전/실패취소에대한구체적위험이없고규격변경과tests가서로일치한다. 단순snapshot/실행0건통과·숨은구그림fallback·하드코딩fake행이없다.
  QA happy — final-production-review: `q_game game-build final/F2`를최근소스가task37과달라진경우에만재실행하고그외에는task37releaseSHA/QA입력SHA를독립대조한다. 코드와실제assertion원문을읽어검토영수증에행근거를남긴다.
  QA failure — final-code-counterexample:각의심사항에기존negativecase나최소격리재현을연결한다. 패키지변조거부는task37negative결과/정상packageSHA를확인하고추가실행은새실패가있을때만한다.
  Evidence / outcome: `SGG_EVIDENCE/final/F2/{verdict.json,review-findings.md,source-binding.json}`;APPROVE또는우선순위·파일:행·실제영향·재현경로를갖는결함목록.
  Commit: N — 검토중제품코드를직접수정하지않고별도해결작업으로반환한다.

- [ ] F3. Real manual QA
  Recommended task executor category: visual-engineering — 에이전트가최종패키지를브라우저에서직접조작한다.
  What to do / Must NOT do:최종패키지만새로시작한자기소유서버/브라우저context에서열고공방→출하1회/10연→결과상세→도감재열기→장착→제작→연구→차고→설정/백업을직접완주한다. 사용자미적승인과구분하며실제사용자save를쓰지않는다.
  References: task37의정식package/report; `game-edition/tests/game/packaged-smoke.spec.mjs:1`; `game-edition/docs/design/game-replan-2026-10-31.md:176`, `:188`; task35viewport/theme matrix.
  Acceptance criteria:Chromium/WebKit·390×844/1280×900·OS 색상 선호 밝음/어두움 두 환경(앱의 기존 미술 방향을 유지하며 새 테마 기능은 추가하지 않음)에서핵심화면이실제로열리고301외형의전수기술검사와대표복잡외형의시각판정이연결된다. 초점/스킵/감소모션·ja선택·성능체감·offline재열기에서막힘0이다.
  QA happy — final-real-package-cycle: `SGG_PACKAGE_ROOT="$SGG_EVIDENCE/task-37/package" q_game packaged-smoke final/F3`의실제실행과함께브라우저도구로위순서를직접클릭/키보드조작한다. 도구명·실제URL·port·viewport·행동/관찰·캡처를기록한다.
  QA failure — final-real-package-failures:브라우저의네트워크offline/그림request차단·소리차단·저장쓰기실패·연출닫기/재진입을각각새profile에서주입하고명시적오류·재시도·결과보존/중복지급0을확인한다. 자기소유서버만종료한다.
  Evidence / outcome: `SGG_EVIDENCE/final/F3/{verdict.json,manual-steps.json,screenshots/,failure-captures/,resources.json}`;각시나리오PASS/FAIL과실제화면증거가있어야APPROVE다.
  Commit: N — 실제브라우저검증만수행한다.

- [ ] F4. Ideal-state fidelity와 Astra High 최종 통합 검토
  Recommended task executor category: unspecified-high — **GPT-6 Astra High**로최종통합검토를실제수행한다.
  What to do / Must NOT do:실제모델/추론수준을확인하고IS-1–7을각각최종패키지·전량승인아트·사용자결정·경제/저장·실제브라우저증거와1:1비교한다. 이전세검토결과의실제근거도읽는다. 모델미가용을완료라고쓰거나프로젝트기본모델변경을주장하지않는다.
  References: `AGENTS.md:22`, `:27`, `:38`; `game-edition/docs/design/game-replan-2026-10-31.md:210`; 이계획Success criteria;task24/30직접승인·task36모델영수증·F1–F3증거.
  Acceptance criteria:7개IS모두실제사용자이상상태에도달하고필수F1–F3APPROVE·미해결결함0·정식releaseSHA동일·직접사용자승인유효다. 미달은새 `- [ ] N.`작업으로반환하고완료주장금지다. 모델확인근거가없으면검토미완료로표시한다.
  QA happy — final-ideal-state-seven: `q_approval all`;task38indexSHA검사·task36경제상태대조·task37정식release·F3실제화면을직접읽고7행별증명경로를작성한다. source변경없으면대용량suite반복실행은하지않는다.
  QA failure — final-missing-owner-or-model:승인근거/IS-7대사47/저장실패근거/AstraHigh확인중하나라도없는검토사본에서APPROVE불가임을확인한다. 모델전환미확인시목표/완료파일/남은오류/다음검증명령을인계한다.
  Evidence / outcome: `SGG_EVIDENCE/final/F4/{verdict.json,model-receipt.json,ideal-state-matrix.json,integration-review.md}`. 4개APPROVE결과를사용자에게제시한뒤명시적최종확인전완료라고선언하지않는다.
  Commit: N — 통합검토는commit/push/deploy권한이아니다.

## Commit strategy
모든task의Commit은N이다. 이계획은local아트/격리체험/통합결과와검증자료를만들도록설계됐으며커밋·push·PR·merge·배포를자동실행하지않는다. 사용자가후속으로명시요청하면그범위만별도적용한다. 작업1–24는normalstaging파일만사용하고G-ART후task25에서격리worktree를만든다.

후속커밋승인이있을경우아트/직접승인근거,공식계약·빌드,각화면통합,검증/문서를의미단위로나누고비밀정보·실제save·대형성공trace·임시profile은포함하지않는다. 사용자미추적재계획문서를임의로stage/commit하지않는다. image원본/승인근거/역사receipt를삭제하지않고새version별보존을유지한다.

## Success criteria
> One row per IS row. The plan is complete only when every IS row has a delivering todo and a proving QA scenario; F4 checks the delivered behavior against these rows 1:1, and a shortfall becomes new `- [ ] N.` rows, never a note.
| IS | Delivering todo(s) | Proving QA scenario | Evidence |
| --- | --- | --- | --- |
| IS-1 | 1–4,6–7,9–20,22–24 | reference-locked, pilot-primary-full-and72, all-world-uses, global-art-gate-bound | task1referenceSHA;task6–22직접열람proof;task24사용자전량승인/동결목록;F4IS-1 |
| IS-2 | 2,4,6–8,11–15,21–24,27,32 | complete-scope, equipped-contact-pilot, equipped254-full-and72, prototype-compositor-ja47, crafting-equipment-world | task2독립301조합;task21외형별정적proof;task24모든조합직접승인;task27/32실제표시;F4IS-2 |
| IS-3 | 1–3,8,10,23–26,30–31,38 | no-autoapproval, representative-not-global, art-gate-negative-matrix, global-art-gate-refuses-stale, experience-gate-stale-build | staging직접판단원문/version/SHA;task10/24/30gatebinding;task25/31착수순서;F1/F4IS-3 |
| IS-4 | 25–31,35 | prototype-draw-single-ten, prototype-core-loop, experience-gate-bound, responsive-accessible-all-flows, final-real-package-cycle | task28/29실제조작;task30직접체험승인;task31정식연출tests;task35/F3최종화면;F4IS-4 |
| IS-5 | 2,9,15–24,26,29–35,37–38 | world-assets-pilot, all-world-uses, production-contract-approved-only, crafting-equipment-world, research-story-integrated, garage-eight-new-art, packaged-two-browser-offline | task20/23모든사용처coverage;task24전체비캐릭터승인;task31–37정식source/packageSHA·화면증거;F4IS-5 |
| IS-6 | 3,23,25,28–29,31–38 | prototype-draw-interruption, crafting-equipment-state-safety, economy-persistence-parity, interrupted-save-backup-equipment, package-rejects-corruption, final-real-package-failures | task25baseline/보존SHA;task35budget·접근성;task36Astra/상태차이0;task37negativepackage·trace정책;F4IS-6 |
| IS-7 | 5,22–24,27,30–31,33,35,37–38 | ja47-source-matched, ja47-invalid-rejected, prototype-compositor-ja47, prototype-missing-image-and-ja, packaged-two-browser-offline | task5ko45+alt2대조/번역47;task27lang/기본숨김/alt/줄바꿈;task31정식문안;task35/37최종패키지;F4IS-7 |

상대적인 `taskN` 증거표기는모두이번 `SGG_EVIDENCE/task-N/`를가리킨다. 완료조건은38개실행task의검증,3개직접사용자관문,4개최종APPROVE,사용자의명시적최종확인이다. 현재이계획을작성했다는사실은어느실행task/아트/체험이완료됐다는뜻도아니다.
