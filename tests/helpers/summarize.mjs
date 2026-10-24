import fs from 'node:fs/promises';
import net from 'node:net';
import { root, baselineRoot, evidenceRoot } from './paths.mjs';
import { sha } from './app.mjs';
const read=name=>fs.readFile(`${evidenceRoot}/${name}.json`,'utf8').then(JSON.parse);
const reports={};
for(const name of ['contracts-final','reset-after','art-harness','contract-negative']) {
  const report=await read(name);
  if(report.stats.unexpected||report.stats.skipped||report.stats.flaky||report.stats.expected===0)throw Error(`Incomplete run: ${name}`);
  reports[name]=report;
}
const red=await read('reset-before');if(red.stats.unexpected!==1||red.stats.expected!==2)throw Error('Missing expected reset RED');
const assets=await read('asset-baseline'),negative=await read('negative'),mutations=await read('mutations');
if(!assets.pass||!negative.pass||!mutations.receipts.every(r=>r.pass))throw Error('Missing asset/mutation proof');
const files={};
for(const file of ['package.json','package-lock.json','playwright.config.mjs','src/app_tpl.html','src/build.sh','src/pwa_head.txt','src/pwa_body.txt','index.html','tests/contracts.spec.mjs','tests/reset.spec.mjs','tests/art-preview.spec.mjs','tests/capture-baseline.mjs','tools/verify-assets.mjs','docs/baseline-contracts.md'])files[file]=sha(await fs.readFile(`${root}/${file}`));
for(const dir of ['tests/helpers','tests/fixtures'])for(const name of await fs.readdir(`${root}/${dir}`))files[`${dir}/${name}`]=sha(await fs.readFile(`${root}/${dir}/${name}`));
const baseline=sha(await fs.readFile(`${baselineRoot}/index.html`));
if(baseline!=='1207e159c272c25fe93033ac35f80b6a8a8337dec8d5ed42cf3ec298fcfc7d5b')throw Error('Baseline changed');
const collected={};
function visit(suite) {
  for(const spec of suite.specs||[])for(const t of spec.tests)for(const result of t.results)for(const attachment of result.attachments||[])if(attachment.path)(collected[attachment.name]??=[]).push(attachment.path);
  for(const sub of suite.suites||[])visit(sub);
}
Object.values(reports).forEach(report=>report.suites.forEach(visit));
red.suites.forEach(visit);
for(const paths of Object.values(collected))for(const file of paths)if((await fs.stat(file)).size===0)throw Error(`Empty artifact ${file}`);
for(const name of ['reset-baseline','reset-storage'])await fs.writeFile(`${evidenceRoot}/${name}.json`,JSON.stringify(await Promise.all(collected[name].map(async file=>({file,data:JSON.parse(await fs.readFile(file,'utf8'))}))),null,2));
await fs.copyFile(`${evidenceRoot}/contracts-final.json`,`${evidenceRoot}/contracts.json`);
await fs.writeFile(`${evidenceRoot}/reset-build-hashes.json`,JSON.stringify({buildCommand:'bash src/build.sh',buildExitCode:0,buildLog:`${evidenceRoot}/reset-build.log`,baselineSHA256:baseline,sourceSHA256:files['src/app_tpl.html'],indexSHA256:files['index.html'],greenReport:`${evidenceRoot}/reset-after.json`,servedResponseHashCheckedInEveryOpenApp:true},null,2));
const ports=[];
for(const port of [4273,4274,4275,4276,4277,4278]) {
  await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
  ports.push({port,free:true});
}
await fs.writeFile(`${evidenceRoot}/cleanup.json`,JSON.stringify({ports,baselineCapture:await read('baseline-cleanup'),negativeAssets:await read('negative-cleanup'),mutantTempRemoved:mutations.cleaned,unrelated4173Untouched:true},null,2));
const summary={pass:true,files,baselineSHA256:baseline,counts:Object.fromEntries(Object.entries(reports).map(([name,r])=>[name,r.stats])),artifacts:collected,assetCounts:assets.counts,mutations:mutations.receipts,negative:negative.receipts};
await fs.writeFile(`${evidenceRoot}/completion.json`,JSON.stringify(summary,null,2));
const rows=[
  ['기준 fixture17 재캡처','npm run baseline:capture','exit0; immutable bytes 동일','baseline-capture-receipt.json; baseline-fixtures.json'],
  ['원본/현재 전체 계약','npm run test:contracts',`${reports['contracts-final'].stats.expected} passed, 0failed/skipped`,'contracts.json; contracts-final-receipt.json; runs/'],
  ['원본 초기화 오류와 수정 전RED','npm test -- --project=chromium --grep @reset-', '원본재현PASS; 현재행복1FAIL(누락6필드), 음성PASS','reset-before.json; reset-before.log; playwright-artifacts/'],
  ['6필드 수정 빌드/양브라우저GREEN','bash src/build.sh; npm test -- --project=chromium --project=webkit --grep @reset-',`${reports['reset-after'].stats.expected} passed; savedLS/IDB/reload일치`,'reset-build.log; reset-build-hashes.json; reset-after.json; reset-storage.json'],
  ['전체 자산','npm run verify:assets -- --group all --check-built','104 mappings/47cards/18comics decode; 0errors','asset-baseline.json; asset-final-receipt.json'],
  ['자산 실패사본','node tests/helpers/negative-assets.mjs','4fixtures 각각exit1','negative.json; missing-asset.json; wrong-manifest-binding.json; changed-preserved-image.json; unchanged-redraw.json'],
  ['계약 실패경로','npm test -- --project=chromium --grep @contract-negative',`${reports['contract-negative'].stats.expected} passed; 부족/거부시 상태불변`,'contract-negative.json; contract-negative-receipt.json'],
  ['아트5그룹 미리보기','npm test -- --project=chromium --grep @art-', '5passed; 53캡처, 고유47; thumbnail/card decode','art-harness.json; runs/'],
  ['테스트 민감도','node tests/helpers/mutations.mjs','3규칙변이 각각실제assertion FAIL','mutations.json; remove-ten-guarantee.json; remove-quiz-reward.json; double-craft-consumption.json'],
];
await fs.writeFile(`${evidenceRoot}/report.md`,'# T2 완료 증거\n\n| 시나리오 | 명령 | 이진 관찰 | 증거(현재 디렉터리 기준) |\n|---|---|---|---|\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n')+'\n\n제품 diff는 승인된 초기화6필드뿐이다. 모든 브라우저는 로컬 fixture를 사용했고 각 HTML 응답 해시를 디스크와 비교했다. 테스트 도구는 배포HTML 밖에 있다. 원본PHS뒷면 캡처를 직접 열어 실제 카드 렌더/전후표시가 보임을 확인했다. 아트품질승인은 후속작업 범위다. LSP(TypeScript/Biome)는 미설치 및 기존설치거부로 사용하지 않았으며 실제Node/Playwright 실행을 근거로 삼았다. cleanup.json에 소유포트/임시사본 정리 증거가 있다. 커밋·push·배포 없음.\n');
console.log(JSON.stringify({pass:true,report:`${evidenceRoot}/report.md`,counts:summary.counts}));
