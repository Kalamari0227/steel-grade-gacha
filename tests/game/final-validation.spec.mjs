import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {boundArtifact,deliveryLinks,fileRecord,verifyHttpFile,packageBinding,fingerprint,hash,validateMedia,editionLineage} from '../../tools/delivery-files.mjs';
import {validateAggregate,validateFreeze,auditReleaseSet,parseTap,validateCommandBinding,validateServedSummary,sumCaseRoles} from '../../tools/suite-evidence.mjs';
import {startStatic} from '../../tools/game-qa/server.mjs';
import {runPlaywright,runCommand} from '../../tools/game-qa/child.mjs';
import {inputHashes} from '../../tools/game-qa/inputs.mjs';
import {readReferenceBindings,validateReferenceBindings} from '../../tools/final-evidence.mjs';
import {record} from '../helpers/edition-package-site.mjs';
const root=path.resolve(import.meta.dirname,'../..');
test('actual artifact and HTTP validators accept owned bytes and reject missing stale broken and foreign targets',async({},info)=>{
 const dir=info.outputPath('artifacts'),file=path.join(dir,'index.html'),hub=path.join(dir,'hub.md');await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(file,'<!doctype html><title>Owned validator regression</title><h1 id="proof">Proof</h1>');
 await fs.writeFile(hub,'[proof](index.html#proof)');const artifact={path:file,...await fileRecord(file)};
 expect(await boundArtifact(artifact)).toEqual(artifact);
 const server=await startStatic(dir);
 try{
  const http=await verifyHttpFile(server.url,{...artifact,path:'index.html',mime:'text/html'});
  const links=await deliveryLinks(hub,[{href:'index.html#proof',artifact}]);expect(links).toHaveLength(1);
  await expect(boundArtifact({...artifact,sha256:'0'.repeat(64)})).rejects.toThrow('Stale artifact');
  await expect(boundArtifact({...artifact,path:path.join(dir,'missing')})).rejects.toThrow();
  await expect(verifyHttpFile(server.url,{...artifact,path:'index.html',mime:'audio/wav'})).rejects.toThrow('HTTP SHA/MIME/bytes');
  await expect(verifyHttpFile(server.url,{...artifact,path:'http://foreign.invalid/index.html',mime:'text/html'})).rejects.toThrow('Foreign HTTP');
  await fs.writeFile(hub,'[broken](index.html#missing)');await expect(deliveryLinks(hub,[{href:'index.html#missing',artifact}])).rejects.toThrow('Missing delivery anchor');
  await fs.writeFile(hub,'[audio](missing.wav)');await expect(deliveryLinks(hub,[{href:'missing.wav',artifact:{...artifact,path:path.join(dir,'missing.wav')}}])).rejects.toThrow();
  const beforeFiles=[{path:'index.html',bytes:artifact.bytes,sha256:artifact.sha256}],before={files:beforeFiles,fingerprintSHA256:fingerprint(beforeFiles)};validateFreeze(before,before);
  await fs.writeFile(file,'changed owned bytes');await expect(boundArtifact(artifact)).rejects.toThrow('Stale artifact');
  const afterFiles=[{path:'index.html',...await fileRecord(file)}];expect(()=>validateFreeze(before,{files:afterFiles,fingerprintSHA256:fingerprint(afterFiles)})).toThrow('Edited final source');
  await record(info,'actual-validator-artifacts',{artifact,http,links,negative:['staleSHA','missingfile','wrongMIME','foreignOrigin','brokenAnchor','missingaudio','editedArtifact'],finalReceipt:false});
 }finally{await server.close();}
 const {startPwaSite}=await import('../helpers/pwa-site.mjs'),ownedInfo=name=>({outputDir:info.outputPath(name),outputPath:file=>path.join(info.outputPath(name),file),attach:(label,options)=>info.attach('pwa-boundary-'+name+'-'+label,options)}),rejected=[];
 for(const [name,options,error] of [['game-source',{edition:'education',source:root},'Education asset source is a game build'],['relative-source',{edition:'education',source:'relative'},'explicit absolute directory'],['null-source',{edition:'education',source:null},'explicit absolute directory'],['missing-source',{edition:'education',source:info.outputPath('absent-source')},'ENOENT'],['default-on-game',undefined,'Education asset source is a game build']]){await expect(startPwaSite(ownedInfo(name),options)).rejects.toThrow(error);rejected.push({name,error});}
 const education=await startPwaSite(ownedInfo('explicit-education'),{edition:'education',source:process.env.SGG_EDUCATION_ROOT});let publishedEducation;
 try{publishedEducation=await education.publishCurrent();expect(publishedEducation.indexSHA).toBe(hash(await fs.readFile(path.join(process.env.SGG_EDUCATION_ROOT,'index.html'))));expect(hash(Buffer.from(await(await fetch(education.url)).arrayBuffer()))).toBe(publishedEducation.indexSHA);}finally{await education.close();}
 const packages=JSON.parse(await fs.readFile(path.join(process.env.SGG_EDITION_EVIDENCE_ROOT,'packages.json'))),a=packages.find(p=>p.variant==='A'),gamePackage={root:a.root,files:a.files.map(f=>f.path)},game=await startPwaSite(ownedInfo('current-game'),{edition:'game',baseline:gamePackage,current:gamePackage});let publishedGame;
 try{publishedGame=await game.publishCurrent();expect(publishedGame.indexSHA).toBe(hash(await fs.readFile(path.join(root,'index.html'))));expect(hash(Buffer.from(await(await fetch(game.url)).arrayBuffer()))).toBe(publishedGame.indexSHA);}finally{await game.close();}
 const defaultDir=info.outputPath('default-education'),defaultScript=info.outputPath('default-education.mjs');await fs.mkdir(defaultDir,{recursive:true});
 await fs.writeFile(defaultScript,`import fs from 'node:fs/promises';import {startPwaSite} from ${JSON.stringify(new URL('../helpers/pwa-site.mjs',import.meta.url).href)};const directory=${JSON.stringify(defaultDir)},info={outputDir:directory,outputPath:name=>directory+'/'+name,attach:async()=>{}};const site=await startPwaSite(info);try{const row=await site.publishCurrent();console.log(JSON.stringify(row));}finally{await site.close();}`);
 const defaultCommand=await runCommand({root,directory:defaultDir,id:'default-education',argv:[process.execPath,defaultScript],env:{SGG_APP_ROOT:process.env.SGG_EDUCATION_ROOT},timeout:30000});expect(defaultCommand.code).toBe(0);const defaultPublished=JSON.parse((await fs.readFile(path.join(defaultDir,'default-education.stdout.log'),'utf8')).trim());expect(defaultPublished.indexSHA).toBe(publishedEducation.indexSHA);
 await record(info,'pwa-source-boundary',{regressionOnly:true,rejected,publishedEducation,publishedGame,defaultCommand,defaultPublished});
});
test('real bounded child aggregate rejects transplanted source time inventory and command evidence',async({},info)=>{
 // Regression data only: the one real browser probe and one TAP probe are not the six production Node categories.
 const runId='regression-'+info.project.name,directory=info.outputPath(runId),shardId='bounded-probe',childDir=path.join(directory,shardId);
 await fs.mkdir(childDir,{recursive:true});const at=new Date().toISOString(),qaInputs=await inputHashes(root);
 const files=await Promise.all(Object.keys(qaInputs).map(async name=>({path:name,...await fileRecord(path.join(root,name))})));
 const frozen={files,fingerprintSHA256:fingerprint(files)},inputsFile=path.join(childDir,'inputs.json');await fs.writeFile(inputsFile,JSON.stringify(qaInputs,null,2));
 const result=await runPlaywright({root,directory:childDir,runId:shardId,engines:['chromium','webkit'],testMatch:'runner-negative.spec.mjs',grep:'controlled (education|game) fixture uses actual LS IDB and seen namespaces$',env:{}});
 const shard={...result,status:'PASS',runId:shardId,directory:childDir,aggregateRunId:runId,spec:'tests/game/runner-negative.spec.mjs',inputsFile,inputs:{path:inputsFile,...await fileRecord(inputsFile)}};
 const probe=path.join(directory,'probe.cjs');await fs.writeFile(probe,"require('node:test')('owned TAP probe',()=>require('node:assert/strict').equal(2+2,4));");
 const command=await runCommand({root,directory,id:'tap',argv:[process.execPath,'--test','--test-reporter=tap',probe],env:{},timeout:15000});
 const passed=parseTap(await fs.readFile(path.join(directory,'tap.stdout.log'),'utf8'));
 const namedReferences=await readReferenceBindings();
 shard.servedProofs={count:0,caseRoles:{current:0,originalBaseline:0,educationReference:0,unattested:shard.passed},measurementScope:'response-and-file-frontier',frozenFingerprintReferenceSHA256:frozen.fingerprintSHA256};
 const receipt={schemaVersion:2,status:'PASS',regressionOnly:true,runId,directory,start:{at,references:namedReferences,...frozen},end:{at:new Date().toISOString(),references:structuredClone(namedReferences),...frozen},qaInputs,inventory:{shards:[{file:shard.spec}]},shards:[shard],caseRoles:sumCaseRoles([shard]),identities:[...shard.identities],passed:shard.passed,node:['publication','publication-preflight','placement-publication','decoder-input','decoder-timeout','archive'].map(name=>({...command,name,passed})),contracts:{...command,passed}};
 expect(validateAggregate(receipt).passed).toBe(result.passed);validateCommandBinding(command,{command,receipt});
 const checks=[
  ['missing start references',r=>{delete r.start.references;},'Missing named reference bindings'],
  ['missing end references',r=>{delete r.end.references;},'Changed named reference bindings'],
  ['edited external reference at end',r=>{r.end.references.education.index.sha256='0'.repeat(64);},'Changed named reference bindings'],
  ['forged aggregate reference count',r=>{r.caseRoles.current++;r.caseRoles.unattested--;},'Wrong aggregate case roles'],
  ['historical same-source shard',r=>{r.shards[0].started=Date.parse(at)-2;r.shards[0].ended=Date.parse(at)-1;},'Command outside aggregate interval'],
  ['historical listing',r=>{r.shards[0].listingStarted=Date.parse(at)-2;r.shards[0].listingEnded=Date.parse(at)-1;},'Command outside aggregate interval'],
  ['child after final end',r=>{r.shards[0].ended=Date.parse(r.end.at)+1;},'Command outside aggregate interval'],
  ['nonfinite child clock',r=>{r.shards[0].started=null;},'Command outside aggregate interval'],
  ['mismatched source input',r=>{r.shards[0].inputs.sha256='0'.repeat(64);},'Shard inputs differ from F'],
  ['wrong F projection',r=>{r.qaInputs['index.html']='0'.repeat(64);},'QA inputs differ from F'],
  ['foreign aggregate run',r=>{r.shards[0].aggregateRunId='historical';},'Foreign aggregate shard'],
  ['foreign shard directory',r=>{r.shards[0].directory=path.join(path.dirname(directory),'old',shardId);},'Foreign aggregate shard'],
  ['zero child',r=>{r.shards[0].passed=0;},'Failed/zero/duplicate shard'],
  ['failed child',r=>{r.shards[0].exitCode=1;},'Failed/zero/duplicate shard'],
  ['duplicate child identity',r=>{r.shards[0].identities[1]=r.shards[0].identities[0];},'Failed/zero/duplicate shard'],
  ['omitted aggregate identity',r=>{r.identities.pop();},'Omitted aggregate identity'],
  ['wrong Node category',r=>{r.node[0].name='wrong';},'Missing Node category'],
  ['failed Node command',r=>{r.node[0].code=1;},'Failed/zero Node category']
 ];
 for(const [name,mutate,error] of checks){const changed=structuredClone(receipt);mutate(changed);expect(()=>validateAggregate(changed),name).toThrow(error);}
 const staleCommand={...command,started:Date.parse(at)-2,ended:Date.parse(at)-1};expect(()=>validateCommandBinding(command,{command:staleCommand,receipt})).toThrow('Command outside aggregate interval');
 expect(()=>validateCommandBinding({...command,argv:['wrong-command']},{command,receipt})).toThrow('Failed/stale child command');
 const badInputs=path.join(directory,'mismatched-inputs.json');await fs.writeFile(badInputs,JSON.stringify({...qaInputs,'index.html':'0'.repeat(64)},null,2));
 await expect(boundArtifact({...shard.inputs,path:badInputs})).rejects.toThrow('Stale artifact');
 await record(info,'bounded-aggregate-regressions',{receipt,negative:checks.map(([name])=>name),nodeProbe:{command,passed},finalReceipt:false});
});
test('live receipt boundary fails closed without final artifacts and aggregate cannot accept empty green output',async({},info)=>{
 const file=info.outputPath('invalid-set.json');await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(file,JSON.stringify({schemaVersion:1,edition:'game',releaseId:'0'.repeat(64),sourceRoot:root,freeze:{path:info.outputPath('absent'),bytes:1,sha256:'0'.repeat(64)}}));
 await expect(auditReleaseSet(file)).rejects.toThrow();
 for(const bad of [{},{schemaVersion:2,status:'PASS',runId:'empty',shards:[]}])expect(()=>validateAggregate(bad)).toThrow();
 expect(()=>parseTap('PASS 0 tests')).toThrow();expect(()=>parseTap('# tests 1\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n')).toThrow();
 await expect(packageBinding(root,root)).rejects.toThrow();await record(info,'closed-final-boundary',{invalidFile:file,rejected:true,finalReceipt:false});
});
test('current real edition packages reject reordered and swapped variant lineage',async({},info)=>{
 const evidenceRoot=process.env.SGG_EDITION_EVIDENCE_ROOT,packageRoot=process.env.SGG_PACKAGE_ROOT;
 const accepted=await editionLineage({root,evidenceRoot,packageRoot});
 const original=JSON.parse(await fs.readFile(path.join(evidenceRoot,'packages.json'),'utf8')),owned=info.outputPath('edition-negative');await fs.mkdir(owned,{recursive:true});
 await fs.writeFile(path.join(owned,'packages.json'),JSON.stringify([original[1],original[0],original[2]]));
 await expect(editionLineage({root,evidenceRoot:owned,packageRoot})).rejects.toThrow('Edition packages require ordered unique A B C');
 await fs.writeFile(path.join(owned,'packages.json'),JSON.stringify([original[0],{...original[2],variant:'B'},{...original[1],variant:'C'}]));
 await expect(editionLineage({root,evidenceRoot:owned,packageRoot})).rejects.toThrow('Edition variant differs from current comment-only source');
 await record(info,'real-edition-lineage',{accepted,negative:['reordered A B C','otherwise valid B C packages swapped'],finalReceipt:false});
});
test('media IDs join actual bytes and indexes rather than unrelated self-consistent artifacts',async({},info)=>{
 const directory=info.outputPath('media-regression');await fs.mkdir(path.join(directory,'docs/design'),{recursive:true});await fs.mkdir(path.join(directory,'src/audio'),{recursive:true});
 const write=async(name,body)=>{const file=path.join(directory,name);await fs.writeFile(file,body);return {path:file,...await fileRecord(file)};};
 const asset=await write('art.webp',Buffer.from('owned-art-regression')),sound=await write('sound.ogg',Buffer.from('owned-audio-regression')),foreign=await write('foreign.bin',Buffer.from('unrelated-regression'));
 const art={assets:[{assetId:'character:test:front',kind:'character',path:'art.webp',bytes:asset.bytes,sha256:asset.sha256}],faces:[],placements:[]},audio={tracks:[{id:'test',variants:[{path:'sound.ogg',mime:'audio/ogg',bytes:sound.bytes,sha256:sound.sha256}]}]};
 const manifests=[await write('docs/design/game-asset-manifest.json',JSON.stringify(art)),await write('src/audio/manifest.json',JSON.stringify(audio))];
 let index=await write('index.html','<img src="art.webp"><audio src="sound.ogg"></audio>');
 const freeze={files:[asset,sound,...manifests].map(r=>({...r,path:path.relative(directory,r.path)}))};
 const set={sourceRoot:directory,links:[{artifact:index}],media:[{id:'art:character:test:front',artifact:asset,indexPath:index.path},{id:'audio:test:audio/ogg',artifact:sound,indexPath:index.path}]},receipt={shards:[]};
 expect(await validateMedia({set,freeze,receipt})).toHaveLength(2);
 for(const position of [0,1]){const changed=structuredClone(set);changed.media[position].artifact=foreign;await expect(validateMedia({set:changed,freeze,receipt})).rejects.toThrow('Media differs from manifest artifact');}
 index=await write('index.html','<img src="foreign.bin"><audio src="sound.ogg"></audio>');set.links[0].artifact=index;
 await expect(validateMedia({set,freeze,receipt})).rejects.toThrow('Media absent from delivery index');
 await record(info,'media-binding-regressions',{scope:'actual file boundary regression; byte placeholders are not decoded media or product evidence',asset,sound,foreign,negative:['art ID with unrelated self-hashed bytes','audio ID with unrelated self-hashed bytes','index omits intended artifact'],finalReceipt:false});
});
test('composite media requires the matching final-art attachment face placement and export bytes',async({},info)=>{
 const directory=info.outputPath('composite-regression');await fs.mkdir(path.join(directory,'docs/design'),{recursive:true});await fs.mkdir(path.join(directory,'src/audio'),{recursive:true});
 const write=async(name,body)=>{const file=path.join(directory,name);await fs.writeFile(file,body);return {path:file,...await fileRecord(file)};};
 const full=await write('face.png','owned composite face bytes'),placed=await write('placed.png','owned composite placement bytes');
 const face={cardId:'test',side:'front'},placement={...face,itemKey:'tool'},art={assets:[],faces:[face],placements:[placement]},audio={tracks:[]};
 const manifest=await write('docs/design/game-asset-manifest.json',JSON.stringify(art)),audioManifest=await write('src/audio/manifest.json',JSON.stringify(audio));
 const releaseId='1'.repeat(64),binding={face,faceSha256:hash(JSON.stringify(face)),placements:[{placement,placementSha256:hash(JSON.stringify(placement))}]};
 const proof=await write('current-ui.json',JSON.stringify({boot:{current:{release:releaseId}},manifestSha256:manifest.sha256,rows:[{...face,set:'fullset',receiptBinding:binding,proofs:{full}},{...face,set:'tool',receiptBinding:binding,proofs:{full:placed}}]}));
 const set={sourceRoot:directory,releaseId,links:[{artifact:full},{artifact:placed}],media:[{id:'face:test:front',artifact:full,proof},{id:'placement:test:front:tool',artifact:placed,proof}]};
 const freeze={files:[manifest,audioManifest].map(r=>({...r,path:path.relative(directory,r.path)}))},receipt={shards:[{spec:'tests/game/art-full-review.spec.mjs',attachments:[proof]}]};
 expect(await validateMedia({set,freeze,receipt})).toHaveLength(2);
 const wrongExport=structuredClone(set);wrongExport.media[0].artifact=placed;
 await expect(validateMedia({set:wrongExport,freeze,receipt})).rejects.toThrow('Wrong composite source or export');
 const detached=structuredClone(receipt);detached.shards[0].attachments=[];
 await expect(validateMedia({set,freeze,receipt:detached})).rejects.toThrow('Composite proof is not a final art attachment');
 const stale=structuredClone(set);stale.releaseId='2'.repeat(64);
 await expect(validateMedia({set:stale,freeze,receipt})).rejects.toThrow('Wrong composite release or identity');
 await record(info,'composite-binding-regressions',{scope:'validator input fixture, not a real visual approval or final receipt',proof,negative:['wrong export bytes','detached attachment','wrong release'],finalReceipt:false});
});
test('actual original task proof formats require whole claims children verdicts and bound bytes',async({},info)=>{
 const input=process.env.SGG_TASK_RECEIPT_INPUTS;
 if(!input||!path.isAbsolute(input))throw Error('Explicit SGG_TASK_RECEIPT_INPUTS required');
 const {auditTaskProofs,validateTaskProofs}=await import('../../tools/suite-evidence.mjs'),fixture=JSON.parse(await fs.readFile(input,'utf8'));
 expect(fixture.schemaVersion).toBe(1);expect(fixture.tasks.map(r=>r.task)).toEqual([...Array.from({length:39},(_,i)=>i+1),43,44,45,46]);
 const positives=[];for(const row of fixture.tasks)positives.push((await auditTaskProofs(row)).checked);
 const raw=async task=>{const row=fixture.tasks.find(r=>r.task===task);return {task,claims:await Promise.all(row.claims.map(a=>fs.readFile(a.path,'utf8').then(JSON.parse))),proofs:await Promise.all(row.verifications.map(a=>fs.readFile(a.path,'utf8').then(JSON.parse))),claimArtifacts:row.claims,proofArtifacts:row.verifications};};
 const wrong=await raw(4);wrong.proofs[0].AdversarialVerify.task=7;expect(()=>validateTaskProofs(wrong)).toThrow('Wrong task identity/verdict');
 const falseVerdict=await raw(4);falseVerdict.proofs[0].AdversarialVerify.verdict='needs-fix';expect(()=>validateTaskProofs(falseVerdict)).toThrow('Wrong task identity/verdict');
 const missingChild=await raw(3);delete missingChild.proofs[0].components['3.mock'];expect(()=>validateTaskProofs(missingChild)).toThrow('Missing compound child verification');
 const missingClaim=await raw(2);missingClaim.claims.pop();missingClaim.claimArtifacts=missingClaim.claimArtifacts.slice(0,-1);expect(()=>validateTaskProofs(missingClaim)).toThrow('Wrong/incomplete task claims');
 const wrongClaimBytes=await raw(4);wrongClaimBytes.claimArtifacts=[{...wrongClaimBytes.claimArtifacts[0],bytes:1}];expect(()=>validateTaskProofs(wrongClaimBytes)).toThrow('Independent proof claim binding mismatch');
 const task36=structuredClone(fixture.tasks.find(r=>r.task===36));delete task36.parentClosure;await expect(auditTaskProofs(task36)).rejects.toThrow('Wrong task closure join');
 const original=fixture.tasks.find(r=>r.task===4),stale=info.outputPath('stale-original.json');await fs.mkdir(info.outputDir,{recursive:true});await fs.copyFile(original.verifications[0].path,stale);await fs.appendFile(stale,' ');
 await expect(auditTaskProofs({...original,verifications:[{...original.verifications[0],path:stale}]})).rejects.toThrow('Stale artifact');
 const current37=fixture.tasks.find(r=>r.task===37);
 for(const rejected of fixture.rejected.filter(r=>r.artifact.path.endsWith('/done-claim.json')))await expect(auditTaskProofs({...current37,claims:[rejected.artifact]})).rejects.toThrow('Explicit incomplete task claim');
 const incomplete=await raw(37);incomplete.claims[0].DoneClaim.complete=false;expect(()=>validateTaskProofs(incomplete)).toThrow('Explicit incomplete task claim');
 const missingStatus=await raw(37);delete missingStatus.claims[0].status;expect(()=>validateTaskProofs(missingStatus)).toThrow('Wrong Task37 independently reviewed claim');
 const unboundClaim=await raw(37);unboundClaim.claimArtifacts=[{...unboundClaim.claimArtifacts[0],sha256:'0'.repeat(64)}];expect(()=>validateTaskProofs(unboundClaim)).toThrow('Wrong Task37 independently reviewed claim');
 expect(fixture.rejected).toHaveLength(6);for(const rejected of fixture.rejected){const row=fixture.tasks.find(r=>r.task===rejected.task);await expect(auditTaskProofs({...row,verifications:[rejected.artifact]})).rejects.toThrow();}
 await record(info,'original-task-proof-regressions',{inputs:{path:input,...await fileRecord(input)},positives,negative:['wrong task','false verdict','missing compound child','missing original/repair claim','missing Task36 closure','stale bytes','two actual incomplete claim substitutions with current proof','explicit incomplete','missing Task37 claim status','wrong claim SHA join',...fixture.rejected.map(r=>r.artifact.path)],semanticApproval:false});
});
test('actual HTTP frontier records reject changed files and retain uncached whole-source end detection',async({page},info)=>{
 const {requiredFiles,snapshot}=await import('../../tools/delivery-files.mjs'),{canonical}=await import('../../tools/game-build/io.mjs');
 const {readFrozenFrontier,captureFinalResponse,validateFrontierRecord}=await import('../../tools/final-evidence.mjs');
 const directory=info.outputPath('frontier-source'),testFile=path.join(directory,'tests/game/owned-probe.spec.mjs');
 for(const name of [...requiredFiles,'tests/game/owned-probe.spec.mjs']){const file=path.join(directory,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,name==='index.html'?'<html><title>Owned frontier regression</title><h1>Actual response</h1></html>':'owned fixture '+name);}
 const release={releaseId:'1'.repeat(64)},manifestPath=`assets/game/${release.releaseId}/manifest.${hash(canonical(release))}.json`;
 await fs.writeFile(path.join(directory,'game-release.json'),JSON.stringify(release));await fs.mkdir(path.dirname(path.join(directory,manifestPath)),{recursive:true});await fs.writeFile(path.join(directory,manifestPath),canonical(release));
 const baselineBody='<html><h1>Actual baseline</h1></html>';await fs.writeFile(path.join(directory,'baseline.html'),baselineBody);
 const originalRoot=info.outputPath('original-reference');await fs.mkdir(originalRoot,{recursive:true});await fs.writeFile(path.join(originalRoot,'index.html'),baselineBody);await fs.writeFile(path.join(originalRoot,'sw.js'),'owned original reference worker');
 const namedReferences=await readReferenceBindings({originalRoot,educationRoot:process.env.SGG_EDUCATION_ROOT});
 const testImport=import.meta.resolve('@playwright/test'),helperImport=new URL('../../tools/final-evidence.mjs',import.meta.url).href;
 await fs.writeFile(testFile,`import {test,expect} from ${JSON.stringify(testImport)};import {captureFinalResponse} from ${JSON.stringify(helperImport)};for(const kind of ['current','baseline','education-reference'])test('owned actual '+kind+' response',async({page},info)=>{const response=await page.goto(kind==='education-reference'?process.env.EDUCATION_SITE:process.env.FRONTIER_SITE+(kind==='baseline'?'/baseline.html':'/'));if(kind!=='education-reference')await expect(page.locator('h1')).toHaveText(kind==='baseline'?'Actual baseline':'Actual response');await captureFinalResponse(info,response,{root:${JSON.stringify(directory)},kind});});`);
 const start={runId:'frontier-regression-'+info.project.name,at:new Date().toISOString(),references:namedReferences,...await snapshot(directory)},startFile=info.outputPath('frontier-start.json');await fs.writeFile(startFile,JSON.stringify(start));
 const previous=process.env.SGG_FINAL_START,server=await startStatic(directory),educationServer=await startStatic(process.env.SGG_EDUCATION_ROOT);process.env.SGG_FINAL_START=startFile;
 const ownedInfo={file:testFile,testId:info.testId,project:info.project,titlePath:info.titlePath,annotations:[],outputPath:name=>info.outputPath('frontier-evidence/'+name),attach:(name,options)=>info.attach('regression-only-'+name,options)};
 try{
  const response=await page.goto(server.url),recorded=await captureFinalResponse(ownedInfo,response,{root:directory}),frontier=await readFrozenFrontier({root:directory,start,testFile});
  validateFrontierRecord(recorded,{start,frontier});expect(recorded.fingerprintSHA256).toBeUndefined();expect(frontier).toHaveLength(8);
  const childDirectory=info.outputPath('frontier-child'),config=info.outputPath('frontier-playwright.config.mjs');await fs.mkdir(childDirectory,{recursive:true});
  await fs.writeFile(config,`import {defineConfig} from ${JSON.stringify(testImport)};export default defineConfig({testDir:${JSON.stringify(path.dirname(testFile))},testMatch:'owned-probe.spec.mjs',timeout:15000,globalTimeout:60000,workers:1,retries:0,forbidOnly:true,metadata:{runId:process.env.SGG_RUN_ID},outputDir:process.env.SGG_OUTPUT_DIR,reporter:[['json',{outputFile:process.env.SGG_REPORT}]],use:{trace:'on'},projects:['chromium','webkit'].map(name=>({name,use:{browserName:name}}))});`);
  const child=await runPlaywright({root,directory:childDirectory,runId:'bounded-frontier-'+info.project.name,engines:['chromium','webkit'],testMatch:'owned-probe.spec.mjs',config,env:{SGG_FINAL_START:startFile,FRONTIER_SITE:server.url,EDUCATION_SITE:educationServer.url}}),childReport=JSON.parse(await fs.readFile(child.reportPath,'utf8'));
  const {reportCases,validateServedAttachments}=await import('../../tools/suite-evidence.mjs');
  const references=await Promise.all(reportCases(childReport).flatMap(r=>r.results.flatMap(t=>t.attachments||[])).filter(a=>a.path).map(async a=>({path:a.path,...await fileRecord(a.path)})));
  const boundary={report:childReport,start,root:directory,ended:child.ended,artifacts:references,manifestPath,baselineSHA:hash(baselineBody),educationSHA:namedReferences.education.index.sha256};
  const accepted=await validateServedAttachments(boundary);expect(accepted.count).toBe(6);expect(accepted.caseRoles).toEqual({current:2,originalBaseline:2,educationReference:2,unattested:0});
  validateServedSummary(accepted,await validateServedAttachments(boundary));const forgedRoles=structuredClone(accepted);forgedRoles.caseRoles.current+=2;forgedRoles.caseRoles.educationReference=0;expect(()=>validateServedSummary(forgedRoles,accepted)).toThrow('Forged served proof summary');
  for(const forged of [null,{...accepted,count:'6'},{...accepted,unknown:true},{...accepted,caseRoles:{...accepted.caseRoles,unknown:0}},{...accepted,count:-1}])expect(()=>validateServedSummary(forged,accepted)).toThrow('Forged served proof summary');
  const currentOnly=structuredClone(childReport);function onlyCurrent(suites){for(const suite of suites){suite.specs=(suite.specs||[]).filter(spec=>spec.title==='owned actual current response');onlyCurrent(suite.suites||[]);}}onlyCurrent(currentOnly.suites);currentOnly.stats.expected=2;
  const packageOnly=await validateServedAttachments({...boundary,report:currentOnly,baselineSHA:undefined,educationSHA:undefined});expect(packageOnly.caseRoles).toEqual({current:2,originalBaseline:0,educationReference:0,unattested:0});await expect(validateServedAttachments({...boundary,baselineSHA:undefined,educationSHA:undefined})).rejects.toThrow('Missing shard reference provenance');
  const original=reportCases(childReport).flatMap(r=>r.results.flatMap(t=>t.attachments||[])).find(a=>a.name==='final-freeze-served'),originalBytes=JSON.parse(await fs.readFile(original.path,'utf8')),rejected=[];
  for(const [name,mutate,error] of [
   ['schema1',r=>{r.schema=1;},'Wrong response frontier'],['forged-scope',r=>{r.measurementScope='whole-source';},'Wrong response frontier'],['wrong-frozen-reference',r=>{r.frozenFingerprintReferenceSHA256='0'.repeat(64);},'Wrong response frontier'],['missing-frontier-row',r=>{r.frontier.pop();},'Wrong response frontier'],['wrong-served-bytes',r=>{r.servedSHA256='0'.repeat(64);},'Wrong served evidence'],['wrong-case-id',r=>{r.caseId='foreign';},'Served case/run identity mismatch'],['unknown-role',r=>{r.kind='arbitrary-success';},'Wrong served evidence']
  ]){
   const value=structuredClone(originalBytes);mutate(value);const file=path.join(path.dirname(original.path),'forged-'+name+'.json');await fs.writeFile(file,JSON.stringify(value));
   const changed=structuredClone(childReport);for(const row of reportCases(changed))for(const result of row.results)for(const a of result.attachments||[])if(a.path===original.path)a.path=file;
   const artifacts=references.map(a=>a.path===original.path?{path:file}:a);Object.assign(artifacts.find(a=>a.path===file),await fileRecord(file));
   await expect(validateServedAttachments({...boundary,report:changed,artifacts}),name).rejects.toThrow(error);rejected.push({name,artifact:artifacts.find(a=>a.path===file),error});
  }
  const educationAttachment=reportCases(childReport).flatMap(r=>r.results.flatMap(t=>t.attachments||[])).find(a=>a.name==='education-reference-freeze-served'),educationRecord=JSON.parse(await fs.readFile(educationAttachment.path,'utf8'));
  for(const [name,mutate,error] of [['education-as-original',r=>{r.kind='baseline';},'Wrong served attachment role'],['education-as-current',r=>{r.kind='current';},'Wrong served attachment role'],['original-bytes-as-education',r=>{r.servedSHA256=boundary.baselineSHA;},'Wrong served evidence'],['current-bytes-as-education',r=>{r.servedSHA256=recorded.servedSHA256;},'Wrong served evidence'],['missing-reference',r=>{delete r.reference;},'Wrong education reference binding'],['stale-reference',r=>{r.reference.index.sha256='0'.repeat(64);},'Wrong education reference binding']]){
   const value=structuredClone(educationRecord);mutate(value);const file=path.join(path.dirname(educationAttachment.path),'forged-'+name+'.json');await fs.writeFile(file,JSON.stringify(value));const changed=structuredClone(childReport);for(const row of reportCases(changed))for(const result of row.results)for(const a of result.attachments||[])if(a.path===educationAttachment.path)a.path=file;const artifacts=references.map(a=>a.path===educationAttachment.path?{path:file}:a);Object.assign(artifacts.find(a=>a.path===file),await fileRecord(file));await expect(validateServedAttachments({...boundary,report:changed,artifacts}),name).rejects.toThrow(error);rejected.push({name,artifact:artifacts.find(a=>a.path===file),error});
  }
  const missingReference=structuredClone(start);delete missingReference.references;await expect(validateServedAttachments({...boundary,start:missingReference})).rejects.toThrow('Missing named reference bindings');
  const editedRoot=info.outputPath('edited-reference');await fs.mkdir(editedRoot,{recursive:true});for(const name of ['index.html','sw.js'])await fs.writeFile(path.join(editedRoot,name),await fs.readFile(path.join(process.env.SGG_EDUCATION_ROOT,name)));const referenceBefore=await readReferenceBindings({originalRoot,educationRoot:editedRoot});await fs.appendFile(path.join(editedRoot,'index.html'),'changed owned reference');const referenceAfter=await readReferenceBindings({originalRoot,educationRoot:editedRoot});expect(()=>validateReferenceBindings(referenceBefore,referenceAfter)).toThrow('Changed named reference bindings');
  await record(info,'actual-aggregate-served-boundary',{regressionOnly:true,actualChild:child,acceptedServedProofs:6,caseRoles:accepted.caseRoles,packageOnly,packageOnlyInjectedReferenceRejected:true,forgedEducationCountRejected:true,rejected,missingReferenceRejected:true,actualEditedReferenceRejected:{before:referenceBefore,after:referenceAfter},scope:'Same byte-bound consumer invoked by final-suite collection and live auditReleaseSet; actual preserved education HTTP body has distinct reference role. Mutated artifact hashes are recomputed.'});
  const negative=[];
  for(const row of frontier){const file=path.join(directory,row.path),before=await fs.readFile(file);await fs.appendFile(file,' changed');await expect(readFrozenFrontier({root:directory,start,testFile})).rejects.toThrow('Changed response frontier');await fs.writeFile(file,before);negative.push('changed '+row.path);}
  const wrongResponse={ok:()=>true,url:()=>server.url,status:()=>200,body:async()=>Buffer.from('foreign actual-response bytes')};
  await expect(captureFinalResponse(ownedInfo,wrongResponse,{root:directory})).rejects.toThrow('Actual current response is not frozen index');
  const missing=structuredClone(start);missing.files=missing.files.filter(r=>r.path!=='sw.js');missing.fingerprintSHA256=fingerprint(missing.files);await expect(readFrozenFrontier({root:directory,start:missing,testFile})).rejects.toThrow('Missing frozen frontier row');
  for(const mutate of [r=>{r.measurementScope='whole-source';},r=>{r.frozenFingerprintReferenceSHA256='0'.repeat(64);},r=>{r.frontier.pop();},r=>{r.fingerprintSHA256=start.fingerprintSHA256;}]){const changed=structuredClone(recorded);mutate(changed);expect(()=>validateFrontierRecord(changed,{start,frontier})).toThrow('Wrong response frontier');}
  await fs.writeFile(path.join(directory,'outside-frontier.txt'),'new source input');expect(await readFrozenFrontier({root:directory,start,testFile})).toEqual(frontier);
  const end=await snapshot(directory);expect(()=>validateFreeze(start,end)).toThrow('Edited final source');
  await record(info,'response-frontier-regressions',{regressionOnly:true,scope:'owned HTTP fixture; whole-source mutation detected by actual uncached end snapshot, not claimed by per-response frontier',recorded,negative:[...negative,'wrong served bytes','missing frozen row','forged scope','wrong frozen reference','missing measured row','ambiguous whole fingerprint','outside frontier changed full end'],endFingerprint:end.fingerprintSHA256});
 }finally{if(previous===undefined)delete process.env.SGG_FINAL_START;else process.env.SGG_FINAL_START=previous;await server.close();await educationServer.close();}
});
