import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyPackage} from '../../tools/game-build/package.mjs';
import {verifyRestored} from '../../tools/game-archive/resolver.mjs';
import {args,canonical} from '../../tools/game-build/io.mjs';
import {verifyReport} from '../../tools/game-qa/report.mjs';

const root=process.env.SGG_APP_ROOT||path.resolve(import.meta.dirname,'../..');
const evidence=process.env.SGG_EVIDENCE_DIR;
const execute=promisify(execFile);
const documentNames=['README.md','docs/game-maintenance.md','docs/releases/game-edition.md'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(ok,code)=>{if(!ok)throw Error(code);};
const save=(name,value)=>fs.writeFile(path.join(evidence,name+'.json'),JSON.stringify(value,null,2));
const load=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const inside=(base,file)=>file===base||file.startsWith(base+path.sep);
const shaFile=async file=>{const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const absolute=value=>{fail(typeof value==='string'&&path.isAbsolute(value)&&!/[\x00\r\n]|\$\{|\$[A-Z_]+|<[^>]+>/.test(value),'unresolved-parameter');return path.normalize(value);};
const fileRow=async file=>{absolute(file);const s=await fs.stat(file);fail(s.isFile()&&s.size>0,'missing-file');return {path:file,bytes:s.size,sha256:await shaFile(file)};};
function tagged(text,marker){
 const match=text.match(new RegExp('<!-- '+marker+':v1 -->\\s*\\x60{3}json\\s*([\\s\\S]*?)\\x60{3}'));
 fail(match,'missing-contract');return JSON.parse(match[1]);
}
function tokens(line){
 fail(!/[;&|<>\x60\r\n]|\$\(/.test(line),'unsafe-command');
 const result=[],pattern=/"([^"\n]*)"|'([^'\n]*)'|([^\s"']+)/g;let end=0;
 for(const m of line.matchAll(pattern)){fail(!line.slice(end,m.index).trim(),'invalid-command-token');result.push(m[1]??m[2]??m[3]);end=m.index+m[0].length;}
 fail(!line.slice(end).trim(),'invalid-command-token');return result;
}
function checkCommand(row,parameters){
 fail(row&&Array.isArray(row.argv)&&row.argv[0]==='node','unsupported-command');
 const [,tool,...argv]=row.argv;
 const allowed={
  'tools/build-game.mjs':['--root','--out','--report','--help'],
  'tools/package-game.mjs':['--root','--out','--report','--verify','--help'],
  'tools/game-qa.mjs':['--list','--case','--engines','--evidence'],
  'tools/archive-game-sources.mjs':['--root','--out','--verify-extract','--verify-root','--receipt','--pointer','--report','--extract'],
  'tools/audio/render.mjs':['--all','--seed','--root'],
  'tools/audio/encode.mjs':['--all','--root']
 };
 fail(Object.hasOwn(allowed,tool),'unsupported-command');
 fail(['GAME','RESTORED'].includes(row.cwd),'unsupported-cwd');
 const seen=new Set();
 for(let i=0;i<argv.length;i++){
  const flag=argv[i];fail(allowed[tool].includes(flag)&&!seen.has(flag),'unsupported-flag');seen.add(flag);
  if(['--help','--list','--verify','--all'].includes(flag))continue;
  const value=argv[++i];fail(typeof value==='string'&&!value.startsWith('--'),'missing-flag-value');
  for(const m of value.matchAll(/\$([A-Z_]+)/g))fail(parameters.includes(m[1]),'unresolved-parameter');
 }
 if(tool==='tools/build-game.mjs'||tool==='tools/package-game.mjs'){
  if(!seen.has('--help'))args(argv,tool.includes('build-game')?'build':'package');
  else fail(argv.length===1,'unsupported-help');
 }
 if(tool==='tools/game-qa.mjs'&&!seen.has('--list')){
  fail(argv[argv.indexOf('--case')+1]==='documentation-contract','unsupported-case');
  fail(argv[argv.indexOf('--engines')+1]==='chromium','unsupported-engines');
 }
 return row.argv;
}
function validateContract(contract,release,text){
 fail(contract.schemaVersion===1&&contract.edition==='game','wrong-edition');
 fail(contract.branch==='게임용'&&contract.educationTag==='education-v1','wrong-branch');
 fail(contract.educationCommit==='d3f52b6f3c79d6ccb579d362953242631b832a74'&&contract.rulesBaseline==='6784048524c722b7d1057cb28e372b6cce5dc6cf','wrong-baseline');
 fail(canonical(contract.routes)===canonical(['workshop','dex','craft','research','garage']),'wrong-routes');
 fail(canonical(contract.aliases)===canonical({learn:'research',learning:'research'}),'wrong-aliases');
 fail(canonical(contract.persistence)===canonical({writeKeys:['sgg_game_save_v1','sgg_game_preferences_v1'],database:'sgg_game',store:'save',exportPrefix:'SGG-GAME1.',educationImportPrefix:'SGG1.',automaticEducationImport:false,merge:false}),'educationkeyinstruction');
 fail(release.schemaVersion===1&&release.edition==='game'&&release.status==='review-pending'&&release.finalComplete===false,'unsupported-completion');
 fail(release.archiveBinding==='external-receipt'&&release.preview===null,'unsupported-release-binding');
 fail(contract.preview===null,'staleport');
 const commands=contract.commands.map(c=>checkCommand(c,contract.parameters));
 const shell=[...text.matchAll(/\x60{3}sh\n([\s\S]*?)\x60{3}/g)].flatMap(m=>m[1].trim().split('\n').filter(Boolean).map(tokens));
 fail(shell.length===commands.length&&shell.every(a=>commands.some(b=>canonical(a)===canonical(b))),'unregistered-command');
 fail(commands.every(a=>shell.some(b=>canonical(a)===canonical(b))),'missing-command');
 return {commands:commands.length};
}
async function checkLinks(file,text){
 const rows=[];
 for(const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)){
  const href=match[1];fail(!/^(?:file:|\/|[A-Za-z]:)|\/Users\/|\/home\//.test(href),'private-runtimepath');
  fail(!/\$|[<>]/.test(href),'unresolved-parameter');
  if(/^https?:/.test(href))throw Error('unregistered-external-link');
  const [relative,fragment]=decodeURIComponent(href).split('#');const target=path.resolve(path.dirname(file),relative||path.basename(file));
  fail(inside(path.dirname(root),target),'link-escape');
  fail((await fs.stat(target)).isFile(),'broken-link');
  if(fragment){
   const content=await fs.readFile(target,'utf8');const headings=[...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>m[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-'));
   fail(content.includes('id="'+fragment+'"')||headings.includes(fragment),'broken-anchor');
  }
  rows.push({from:path.relative(root,file),href,target});
 }
 return rows;
}
async function checkCounts(expected){
 const art=await load(path.join(root,'docs/design/game-asset-manifest.json')),audio=await load(path.join(root,'src/audio/manifest.json'));
 const faces=new Set(art.faces.map(r=>r.cardId)),bgm=audio.tracks.filter(r=>r.kind==='bgm');
 const actual={pool:faces.size-1,allChars:faces.size,faces:art.faces.length,pairs:art.compatiblePairs.length,placements:art.placements.length,base:art.assets.filter(r=>!['thumbnail','icon'].includes(r.kind)).length,requiredExports:art.assets.length,optionalExports:art.optionalDerived.length,exports:art.assets.length+art.optionalDerived.length,thumbnails:art.assets.filter(r=>r.kind==='thumbnail').length,audioBGM:bgm.length,audioSFX:audio.tracks.length-bgm.length,audioMasters:audio.masters.length,audioVariants:audio.tracks.flatMap(r=>r.variants).length};
 fail(canonical(actual)===canonical(expected),'wrong-counts');
 fail(art.compatiblePairs.some(r=>r.cardId==='qp-1470'&&r.itemKey==='arrow'),'missing-qp-arrow');
 fail(art.assets.filter(r=>r.kind==='thumbnail').every(r=>r.dimensions.width===144&&r.dimensions.height===216),'wrong-thumbnail-size');
 return actual;
}
async function checkLivePackage(packageRoot){
 absolute(packageRoot);fail(await fs.realpath(packageRoot)===await fs.realpath(absolute(process.env.SGG_PACKAGE_ROOT)),'wrong-current-package');
 const checked=await verifyPackage(packageRoot);fail(checked.release.syntheticFixture===false,'synthetic-package');
 for(const [name,expected] of Object.entries(checked.release.inputs)){
  const b=await fs.readFile(path.join(root,name));const value=['docs/design/game-asset-manifest.json','src/audio/manifest.json'].includes(name)?canonical(JSON.parse(b)):b;
  fail(digest(value)===expected,'stale-source');
 }
 for(const name of ['index.html','sw.js','game-release.json',checked.manifestPath])fail(await shaFile(path.join(root,name))===await shaFile(path.join(packageRoot,name)),'stale-shipping');
 return {releaseId:checked.release.releaseId,indexSHA:await shaFile(path.join(packageRoot,'index.html'))};
}
function commandRecord(record,tool,cwd,started){
 fail(record.status==='closed'&&record.code===0&&record.signal===null&&record.timedOut===false&&Number.isSafeInteger(record.pid)&&record.pid>0,'failed-command');
 const start=Date.parse(record.start),end=Date.parse(record.end);fail(Number.isFinite(start)&&Number.isFinite(end)&&start>=started&&end>=start&&end<=Date.now()+300000,'stale-command');
 fail(path.resolve(record.cwd)===cwd&&record.argv.some(a=>a===tool||a===path.join(cwd,tool)),'wrong-tool-root');
 fail(!record.argv.includes('--fixture'),'synthetic-command');
 return record;
}
async function audit(file,forbidden,allowed,command,commandFile){
 const rows=(await fs.readFile(file,'utf8')).trim().split('\n').map(JSON.parse);fail(rows.length>0,'missing-read-audit');
 const build=command.argv.some(a=>a.endsWith('/build-game.mjs')),pack=command.argv.some(a=>a.endsWith('/package-game.mjs'));
 const output=command.argv[command.argv.indexOf('--out')+1],temporary=path.resolve(path.dirname(commandFile),'../tmp'),created=new Set();
 let ignoredWrites=0,auxiliaryReads=0;
 for(const row of rows){
  if(row.ok!==true||typeof row.path!=='string'||row.path.startsWith('fd:'))continue;
  const target=path.resolve(row.path),writeOnly=row.method==='openSync'&&/^(?:w|a)x?$/.test(row.flags??'');
  if(writeOnly){if(row.flags==='wx')created.add(row.pid+'|'+target);ignoredWrites++;continue;}
  const temporaryInput=build&&/^game-image-input-[A-Za-z0-9]{6}\/input$/.test(path.relative(temporary,target))&&created.has(row.pid+'|'+target);
  const lease=build&&(target===output+'.game-build-lock/owner.json'||inside(output+'.game-build-lock/stage',target));
  const staged=pack&&/^\.game-package-[A-Za-z0-9]{6}\//.test(path.relative(path.dirname(output),target));
  const auxiliary=temporaryInput||lease||staged;if(auxiliary)auxiliaryReads++;
  fail(!forbidden.some(base=>inside(base,target))||allowed.some(base=>inside(base,target))||auxiliary,'original-source-read');
 }
 fail(rows.filter(r=>r.method==='child.end').every(r=>r.status===0&&!r.signal&&!r.error),'failed-audit-child');
 return {rows,ignoredWrites,auxiliaryReads};
}
async function validateProof(input){
 fail(input.schemaVersion===1&&['task39','frozen'].includes(input.scope),'invalid-input');
 const started=Date.parse(input.runStartedAt);fail(Number.isFinite(started),'missing-run-start');
 for(const name of ['packageRoot','rerenderRoot','restoredBuildRoot','restoredPackageRoot'])absolute(input[name]);
 const a=input.archive;fail(a&&['task32-historical','frozen'].includes(a.scope),'invalid-archive-scope');
 fail(input.scope!=='frozen'||a.scope==='frozen','historical-as-final');
 for(const name of ['file','receipt','restoredRoot'])absolute(a[name]);
 const receipt=await load(a.receipt);fail(await shaFile(a.file)===receipt.archiveSHA&&(await fs.stat(a.file)).size===receipt.archiveBytes,'changedarchivehash');
 const sourceManifest=path.join(a.restoredRoot,'source-materials/source-manifest.json');
 fail(await shaFile(sourceManifest)===receipt.sourceManifestSHA,'wrong-inner-manifest');
 if(a.scope==='task32-historical')fail(receipt.archiveSHA===release.historical.archiveSHA&&a.expectedReleaseId===release.historical.releaseId,'wrong-historical-binding');
 const restored=verifyRestored(a.restoredRoot);fail(restored.inputDigest===receipt.inputDigest&&restored.files===receipt.files&&restored.resolved.length===receipt.mappedSources,'wrong-restored-source');
 const audio=await load(path.join(a.restoredRoot,'src/audio/manifest.json'));fail(audio.masters.length===28,'wrong-master-count');
 const masters=[];
 for(const row of audio.masters){const actual=await fileRow(path.join(input.rerenderRoot,row.path));fail(actual.sha256===row.sha256,'rerender-sha');masters.push({id:row.id,...actual});}
 const built=await verifyPackage(input.restoredBuildRoot),packed=await verifyPackage(input.restoredPackageRoot);
 for(const [name,expected] of Object.entries(built.release.inputs)){const b=await fs.readFile(path.join(a.restoredRoot,name)),value=['docs/design/game-asset-manifest.json','src/audio/manifest.json'].includes(name)?canonical(JSON.parse(b)):b;fail(digest(value)===expected,'unbound-restored-input');}
 if(a.scope==='frozen')fail(built.release.releaseId===(await verifyPackage(input.packageRoot)).release.releaseId,'different-frozen-release');
 fail(!built.release.syntheticFixture&&!packed.release.syntheticFixture&&built.release.releaseId===a.expectedReleaseId&&packed.release.releaseId===a.expectedReleaseId,'wrong-restored-release');
 for(const row of built.release.files)fail(await shaFile(path.join(input.restoredPackageRoot,row.path))===row.sha256,'wrong-restored-package');
 const commands={};
 for(const [name,tool,cwd] of [['extract','tools/archive-game-sources.mjs',root],['resolver','tools/archive-game-sources.mjs',a.restoredRoot],['render','tools/audio/render.mjs',a.restoredRoot],['build','tools/build-game.mjs',a.restoredRoot],['package','tools/package-game.mjs',a.restoredRoot]]){
  const record=commandRecord(await load(absolute(input.commands[name])),tool,cwd,started);commands[name]=record;
 }
 const value=(record,flag)=>record.argv[record.argv.indexOf(flag)+1];
 fail(value(commands.extract,'--extract')===a.file&&value(commands.extract,'--verify-extract')===a.restoredRoot,'wrong-extraction-command');
 fail(value(commands.resolver,'--verify-root')===a.restoredRoot,'wrong-resolver-command');
 fail(value(commands.render,'--root')===input.rerenderRoot&&value(commands.render,'--seed')==='20261025'&&commands.render.argv.includes('--all'),'wrong-render-command');
 fail(value(commands.build,'--root')===a.restoredRoot&&value(commands.build,'--out')===input.restoredBuildRoot,'wrong-build-command');
 fail(value(commands.package,'--root')===input.restoredBuildRoot&&value(commands.package,'--out')===input.restoredPackageRoot,'wrong-package-command');
 fail(Array.isArray(input.forbiddenRoots)&&input.forbiddenRoots.length>0,'missing-source-denial');
 absolute(input.denialPolicy);const policy=await fs.readFile(input.denialPolicy,'utf8');fail(policy.length>0&&commands.build.argv.includes(input.denialPolicy)&&commands.render.argv.includes(input.denialPolicy)&&commands.package.argv.includes(input.denialPolicy)&&commands.resolver.argv.includes(input.denialPolicy),'missing-os-policy');
 const forbidden=input.forbiddenRoots.map(absolute);for(const base of forbidden)fail(policy.includes(base),'unbound-os-policy');const allowed=[a.restoredRoot,input.rerenderRoot,input.restoredBuildRoot,input.restoredPackageRoot,path.dirname(absolute(input.commands.build))];
 fail(forbidden.some(base=>inside(base,root))&&!allowed.some(base=>inside(base,root)),'original-source-not-denied');
 const denial=await load(absolute(input.commands.denial));fail(denial.argv.includes(input.denialPolicy),'unbound-denial-policy');fail(denial.status==='closed'&&denial.code===0&&denial.timedOut===false&&Date.parse(denial.start)>=started,'missing-denial-command');
 const guard=(await fs.readFile(absolute(input.audits.guard),'utf8')).trim().split('\n').map(JSON.parse);
 fail(guard.some(r=>r.ok===false&&['EPERM','EACCES'].includes(r.code)&&typeof r.path==='string'&&forbidden.some(base=>inside(base,path.resolve(r.path))))&&guard.some(r=>r.method==='child.end'&&r.status===1)&&guard.some(r=>r.method==='child.end'&&r.status===0),'inactive-os-denial');
 const audits={};for(const name of ['resolver','render','build','package']){
  const checked=await audit(absolute(input.audits[name]),forbidden,allowed,commands[name],input.commands[name]),start=checked.rows.find(r=>r.method==='audit.start');fail(start&&path.resolve(start.cwd)===a.restoredRoot,'wrong-audit-root');audits[name]={rows:checked.rows.length,pid:start.pid,ignoredWrites:checked.ignoredWrites,auxiliaryReads:checked.auxiliaryReads};
 }
 fail(Array.isArray(input.receiptFiles)&&input.receiptFiles.length>0,'missing-receipt-files');
 for(const expected of input.receiptFiles){const actual=await fileRow(absolute(expected.path));fail(actual.sha256===expected.sha256&&actual.bytes===expected.bytes,'stale-receipt');}
 return {archiveSHA:receipt.archiveSHA,sourceManifestSHA:receipt.sourceManifestSHA,scope:a.scope,payloadFiles:restored.files,resolved:restored.resolved.length,masters:masters.length,releaseId:packed.release.releaseId,audits};
}
async function snapshot(inputFile,input){
 const files=new Set(documentNames.map(n=>path.join(root,n)));
 for(const n of ['docs/design/game-asset-manifest.json','src/audio/manifest.json','src/app_tpl.html','game-release.json','index.html','sw.js','tools/game-build/cli.mjs','tools/archive-game-sources.mjs','tools/game-qa.mjs'])files.add(path.join(root,n));
 files.add(inputFile);files.add(absolute(input.denialPolicy));
 const manifestFile=path.join(input.archive.restoredRoot,'source-materials/source-manifest.json');files.add(manifestFile);
 for(const row of (await load(manifestFile)).files)files.add(path.join(input.archive.restoredRoot,row.path));
 for(const row of (await load(path.join(input.archive.restoredRoot,'src/audio/manifest.json'))).masters)files.add(path.join(input.rerenderRoot,row.path));
 for(const directory of [input.restoredBuildRoot,input.restoredPackageRoot,input.packageRoot]){const checked=await verifyPackage(directory);for(const name of ['game-release.json',checked.manifestPath,...checked.release.files.map(r=>r.path)])files.add(path.join(directory,name));}
 for(const n of [input.archive.file,input.archive.receipt,...Object.values(input.commands),...Object.values(input.audits),...input.receiptFiles.map(r=>r.path)])files.add(absolute(n));
 return Promise.all([...files].sort().map(fileRow));
}
let documents,contract,release,input,inputFile,before;
test.describe.configure({mode:'serial'});
test.beforeAll(async()=>{
 fail(evidence&&path.isAbsolute(evidence),'missing-evidence');
 inputFile=absolute(process.env.SGG_DOCUMENTATION_INPUTS);input=await load(inputFile);
 documents=Object.fromEntries(await Promise.all(documentNames.map(async name=>[name,await fs.readFile(path.join(root,name),'utf8')])));
 contract=tagged(documents['docs/game-maintenance.md'],'sgg-documentation-contract');release=tagged(documents['docs/releases/game-edition.md'],'sgg-release-contract');
 before=await snapshot(inputFile,input);
});
test.afterAll(async()=>{if(before){const after=await snapshot(inputFile,input);await save('documentation-before-after',{before,after});expect(after).toEqual(before);}});

test('documents bind supported commands routes storage counts and local links',async()=>{
 // Given: the current checkout documents and machine-readable contract.
 // When: static parsing checks only allowlisted data; no Markdown commands execute.
 const checked=validateContract(contract,release,documents['docs/game-maintenance.md']);const counts=await checkCounts(contract.counts),links=[];
 for(const [name,text] of Object.entries(documents))links.push(...await checkLinks(path.join(root,name),name==='README.md'?text.split('<!-- education-history:start -->')[0]:text));
 for(const row of contract.commands){const tool=await fs.readFile(path.join(root,row.argv[1]),'utf8');if(row.argv[1]==='tools/archive-game-sources.mjs')for(const flag of row.argv.filter(a=>a.startsWith('--')))expect(tool).toContain("'"+flag+"'");}
 for(const name of contract.parameters)fail(typeof input.parameters?.[name]==='string'&&input.parameters[name].length>0&&!/\$|<[^>]+>/.test(input.parameters[name]),'unresolved-parameter');
 // Then: concrete links and source-derived quantities are retained as evidence.
 expect(links.length).toBeGreaterThan(0);await save('documentation-static',{...checked,counts,links});
});
test('documented fixed help and case-list commands execute without interpreting Markdown',async()=>{
 // Given: fixed trusted argument arrays, independent of document text.
 const invocations=[['tools/build-game.mjs','--help'],['tools/package-game.mjs','--help'],['tools/game-qa.mjs','--list']],rows=[];
 // When: each CLI is called directly with a bounded child lifecycle.
 for(const argv of invocations){const output=await execute(process.execPath,argv,{cwd:root,env:process.env,timeout:15000,killSignal:'SIGKILL',maxBuffer:1024*1024});fail(output.stdout.trim().length>0,'empty-help');if(argv[1]==='--list')expect(JSON.parse(output.stdout).cases).toContain('documentation-contract');rows.push({argv,exit:0,...output});}
 // Then: real output is recorded; a bare PASS word is never used as an oracle.
 expect(rows).toHaveLength(3);await save('documentation-cli',rows);
});
test('fresh real portable restoration and the current relocated package bind to their scoped receipts',async()=>{
 // Given: actual extraction/render/build/package and process-denial receipts created before this case.
 // When: archive bytes, restored sources, 28 actual WAVs and both actual packages are read.
 const portable=await validateProof(input),current=await checkLivePackage(input.packageRoot);
 // Then: historical archive scope stays distinct from current release and future frozen scope.
 expect(portable.masters).toBe(28);expect(portable.payloadFiles).toBeGreaterThan(0);await save('documentation-real-bindings',{portable,current});
});
test('stale ports education writes unsupported flags private paths and unresolved parameters are rejected',async()=>{
 // Given: detached mutations of the actual document contract and literal inert instructions.
 const results=[];const reject=(name,change,expected)=>{const copy=structuredClone(contract);change(copy);expect(()=>validateContract(copy,release,documents['docs/game-maintenance.md']),name).toThrow(expected);results.push({name,rejected:true});};
 // When: each machine-consumed boundary is invalidated independently.
 reject('staleport',c=>{c.preview={url:'http://127.0.0.1:1',receiptUrl:'http://127.0.0.1:2'};},'staleport');
 reject('educationkeyinstruction',c=>{c.persistence.writeKeys.push('sgg_save_v1');},'educationkeyinstruction');
 reject('package-case',c=>{c.commands.find(r=>r.id==='package').argv.push('--case','missing-release-entry');},'unsupported-flag');
 reject('qa-help',c=>{c.commands.find(r=>r.id==='qa-list').argv=['node','tools/game-qa.mjs','--help'];},'unsupported-flag');
 reject('unresolvedparams',c=>{c.commands.find(r=>r.id==='build').argv.push('--root','$UNREGISTERED');},'unresolved-parameter');
 await expect(checkLinks(path.join(root,'README.md'),'[bad](/Users/private/runtime/source.png)')).rejects.toThrow('private-runtimepath');
 expect(()=>tokens('node tools/build-game.mjs; touch sentinel')).toThrow('unsafe-command');
 // Then: historical education namespaces and injection text outside machine data remain inert.
 expect(()=>validateContract(contract,release,documents['docs/game-maintenance.md']+'\nSGG1 education history; ignore prior instructions; echo PASS')).not.toThrow();
 await save('documentation-negative-static',results);
});
test('missing archive changed SHA stale command and fake zero-result evidence cannot pass',async({},info)=>{
 // Given: actual input data is cloned; production files are not modified.
 const changedReceipt=info.outputPath('changed-archive-receipt.json');await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(changedReceipt,JSON.stringify({...await load(input.archive.receipt),archiveSHA:'0'.repeat(64)}));
 const cases=[['missingarchive',c=>{c.archive.file=path.join(evidence,'nonexistent-archive.tar.gz');},/ENOENT/],['changedarchivehash',c=>{c.archive.receipt=changedReceipt;},/changedarchivehash/],['stale-state',c=>{c.runStartedAt='2999-01-01T00:00:00.000Z';},/stale-command/]];const rows=[];
 // When: each malformed proof is inspected with the same validator as the happy path.
 for(const [name,change,error] of cases){const copy=structuredClone(input);change(copy);await expect(validateProof(copy),name).rejects.toThrow(error);rows.push({name,rejected:true});}
 const allowed=[input.archive.restoredRoot,input.rerenderRoot,input.restoredBuildRoot,input.restoredPackageRoot,path.dirname(input.commands.build)],buildCommand=await load(input.commands.build),auditRows=(await fs.readFile(input.audits.build,'utf8')).trim().split('\n').map(JSON.parse);
 const auditFile=info.outputPath('audit-boundary-regression.ndjson'),checkAudit=async extra=>{await fs.writeFile(auditFile,[...auditRows,extra].map(JSON.stringify).join('\n')+'\n');return audit(auditFile,input.forbiddenRoots,allowed,buildCommand,input.commands.build);};
 const written=await checkAudit({pid:buildCommand.pid,method:'openSync',path:path.join(root,'README.md'),flags:'wx',ok:true});expect(written.ignoredWrites).toBeGreaterThan(0);expect(written.auxiliaryReads).toBeGreaterThan(0);
 await expect(checkAudit({pid:buildCommand.pid,method:'readFileSync',path:path.join(root,'README.md'),ok:true})).rejects.toThrow('original-source-read');
 await expect(checkAudit({pid:buildCommand.pid,method:'readFileSync',path:path.join(path.dirname(input.restoredBuildRoot),'unowned-source/README.md'),ok:true})).rejects.toThrow('original-source-read');
 rows.push({name:'write-only-and-actual-owned-staging',accepted:true,auxiliaryReads:written.auxiliaryReads},{name:'actual-audit-plus-original-read',rejected:true},{name:'outside-owned-sibling-read',rejected:true});
 const started=Date.now(),run={runId:'documentation-report-negative',started,exitCode:0,engines:[info.project.name]};
 const good={config:{metadata:{runId:run.runId}},stats:{expected:1,unexpected:0,skipped:0,flaky:0,startTime:new Date(started).toISOString()},errors:[],suites:[{specs:[{tests:[{projectName:info.project.name,status:'expected',results:[{status:'passed',retry:0,errors:[]}]}]}]}]};
 expect(verifyReport(good,run).passed).toBe(1);const empty=structuredClone(good);empty.stats.expected=0;empty.suites=[];expect(()=>verifyReport(empty,run)).toThrow('zero');
 expect(()=>commandRecord({status:'PASS',code:0,stdout:'0 tests PASS'},'tools/build-game.mjs',root,0)).toThrow('failed-command');
 // Then: a green-looking string or empty test receipt does not count as actual execution.
 await save('documentation-negative-proof',rows);
});
