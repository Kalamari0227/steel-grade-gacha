import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {snapshot,fileRecord,packageBinding,absoluteInput,editionLineage} from './delivery-files.mjs';
import {validateAggregate,parseTap,validateServedAttachments,sumCaseRoles} from './suite-evidence.mjs';
import {runCase,caseRegistry} from './game-qa.mjs';
import {runCommand} from './game-qa/child.mjs';
import {startStatic} from './game-qa/server.mjs';
import {verifyReport} from './game-qa/report.mjs';
import {inputHashes} from './game-qa/inputs.mjs';
import {readReferenceBindings,validateReferenceBindings} from './final-evidence.mjs';
const liveSpecs=new Set(['delivery-links.spec.mjs','receipt-audit.spec.mjs']);
const match=(pattern,name)=>new RegExp('^'+pattern.split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(name);
export async function suiteInventory(root,registry){
 const names=async relative=>(await fs.readdir(path.join(root,relative))).filter(n=>n.endsWith('.spec.mjs')).sort();
 const game=await names('tests/game'),legacy=await names('tests'),shards=[];
 for(const file of game){
  const owners=[...registry.values()].filter(r=>r.testMatch&&match(r.testMatch,file));
  if(liveSpecs.has(file)){if(owners.length!==1||owners[0].phase!=='live')throw Error('Invalid live inventory');continue;}
  if(file!=='final-validation.spec.mjs'&&!owners.length)throw Error('Unregistered game product spec: '+file);
  if(owners.some(r=>r.phase==='live'))throw Error('Product excluded as live');
  const exact=owners.find(r=>r.testMatch===file)||owners[0];
  shards.push({scope:'game',file:'tests/game/'+file,name:exact?.name||'final-validation',testMatch:file,registryOwners:owners.map(r=>r.name)});
 }
 for(const file of legacy)shards.push({scope:'legacy',file:'tests/'+file,name:'legacy-'+file.replace('.spec.mjs',''),testMatch:file,registryOwners:[]});
 if(!game.length||!legacy.length||!game.includes('documentation-contract.spec.mjs')||!game.includes('packaged-smoke.spec.mjs')||!game.includes('final-validation.spec.mjs'))throw Error('Incomplete final product inventory');
 for(const entry of registry.values())if(entry.kind!=='orchestrator'&&!game.some(f=>match(entry.testMatch,f)))throw Error('Registry selects zero spec files: '+entry.name);
 return {shards,live:[...liveSpecs].sort(),node:['publication','publication-preflight','placement-publication','decoder-input','decoder-timeout','archive'],separateContracts:'npm run test:contracts'};
}
async function attachments(report){const rows=[];function visit(suites){for(const suite of suites||[]){for(const spec of suite.specs||[])for(const t of spec.tests||[])for(const result of t.results||[])for(const a of result.attachments||[])if(a.path)rows.push(a.path);visit(suite.suites);}}visit(report.suites);return Promise.all([...new Set(rows)].sort().map(artifact));}
const artifact=async file=>({path:file,...await fileRecord(file)});
export async function runFinalSuite({root,evidence,engines,registry}){
 if(root!==path.resolve(import.meta.dirname,'..'))throw Error('Final suite executable/root mismatch');
 if(JSON.stringify([...engines].sort())!==JSON.stringify(['chromium','webkit']))throw Error('Final suite requires both engines');
 for(const name of ['SGG_PACKAGE_ROOT','SGG_BASELINE_ROOT','SGG_EDUCATION_ROOT','SGG_EDITION_EVIDENCE_ROOT','SGG_DOCUMENTATION_INPUTS','SGG_TASK_RECEIPT_INPUTS'])await absoluteInput(process.env[name],name);
 if(path.resolve(evidence)===root||path.resolve(evidence).startsWith(root+path.sep))throw Error('Final evidence must be outside source');
 const runId='final-suite-'+randomUUID(),out=path.join(evidence,runId),tmp=path.join(out,'tmp');await fs.mkdir(out,{recursive:true});
 const resources={status:'planned',runId,tmp,children:[],ports:[],protectedPorts:[4173,4273,4274]};
 const saveResources=()=>fs.writeFile(path.join(out,'resources.json'),JSON.stringify(resources,null,2));await saveResources();await fs.mkdir(tmp);
 const env={SGG_APP_ROOT:root,SGG_EDITION:'game',TMPDIR:tmp,NODE_COMPILE_CACHE:path.join(tmp,'node-cache'),BUN_RUNTIME_TRANSPILER_CACHE_PATH:path.join(tmp,'bun-cache')};
 const start={schema:1,runId,at:new Date().toISOString(),references:await readReferenceBindings(),...await snapshot(root)},startFile=path.join(out,'start.json');
 const packageStart=await packageBinding(process.env.SGG_PACKAGE_ROOT,root),qaInputs=await inputHashes(root);
 const edition=await editionLineage({root,evidenceRoot:process.env.SGG_EDITION_EVIDENCE_ROOT,packageRoot:process.env.SGG_PACKAGE_ROOT});
 await fs.writeFile(startFile,JSON.stringify(start,null,2));
 const taskProofInputs=await artifact(process.env.SGG_TASK_RECEIPT_INPUTS);
 const inventory=await suiteInventory(root,registry);await fs.writeFile(path.join(out,'suite-inventory.json'),JSON.stringify(inventory,null,2));
 const shards=[],node=[],runtimeTools=[];let receipt,cancelled=false;const stop=()=>{cancelled=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 async function command(name,argv,timeout,extra={}){
  if(cancelled)throw Error('Final suite cancelled');
  const directory=path.join(out,name);resources.children.push({name,directory,argv,timeout,status:'planned'});await saveResources();await fs.mkdir(directory);
  const result=await runCommand({root,directory,id:name,argv,timeout,env:{...env,...extra}});
  Object.assign(resources.children.find(r=>r.name===name),{status:result.status,code:result.code,signal:result.signal});await saveResources();
  if(result.code!==0||result.signal||result.timedOut||result.cancelled)throw Error('Final child failed: '+name);
  return {...result,name,directory,commandRecord:await artifact(path.join(directory,name+'.command.json')),stdout:await artifact(path.join(directory,name+'.stdout.log')),stderr:await artifact(path.join(directory,name+'.stderr.log'))};
 }
 try{
  resources.status='running';await saveResources();
  for(const tool of ['ffmpeg','ffprobe'])runtimeTools.push(await command(tool+'-version',[tool,'-version'],15000));
  for(const shard of inventory.shards){
   if(cancelled)throw Error('Final suite cancelled');
   if((await snapshot(root)).fingerprintSHA256!==start.fingerprintSHA256)throw Error('Source changed before shard');
   const result=await runCase({selected:{name:shard.name,testMatch:shard.testMatch},engines,evidence:out,config:shard.scope==='legacy'?path.join(root,'playwright.config.mjs'):undefined,environment:{...env,SGG_FINAL_START:startFile,SGG_FINAL_RUN_ID:runId}});
   const sealed={...result,inputs:await artifact(result.inputsFile),childRecord:await artifact(result.childRecordPath),listingRecord:await artifact(result.listingRecordPath),attachments:await attachments(JSON.parse(await fs.readFile(result.reportPath,'utf8'))),scope:shard.scope,spec:shard.file,report:await artifact(result.reportPath),inventory:await artifact(result.inventoryPath),summary:await artifact(path.join(result.directory,'summary.json'))};
   sealed.servedProofs=await validateServedAttachments({report:JSON.parse(await fs.readFile(result.reportPath,'utf8')),start,root,ended:result.ended,artifacts:sealed.attachments,manifestPath:packageStart.manifestPath,baselineSHA:result.baseline?.original,educationSHA:result.baseline?.education});
   shards.push(sealed);
  }
  const pub=path.join(out,'publication-data'),fixture=path.join(tmp,'publication-fixture'),archive=path.join(out,'archive-data');
  resources.fixture={pub,fixture,archive,status:'planned'};await saveResources();await fs.mkdir(path.join(pub,'work'),{recursive:true});await fs.mkdir(path.join(archive,'work'),{recursive:true});
  const nodeEnv={SGG_PUBLICATION_EVIDENCE:pub,SGG_PUBLICATION_FIXTURE:fixture,SGG_ARCHIVE_EVIDENCE:archive};
  await command('publication-fixture',[process.execPath,'--input-type=module','-e',`import {fixture} from './tests/game/build-fixture.mjs';await fixture(process.env.SGG_APP_ROOT,process.env.SGG_PUBLICATION_FIXTURE);`],190000,nodeEnv);
  await command('publication-baseline',[process.execPath,'tools/build-game.mjs','--fixture','--root',fixture,'--out',path.join(pub,'baseline-site'),'--report',path.join(out,'publication-baseline-build.json')],190000,nodeEnv);
  const groups=[['publication','tests/game/publication.node.mjs',1980000],['publication-preflight','tests/game/publication-preflight.node.mjs',190000],['placement-publication','tests/game/placement-publication.node.mjs',280000],['decoder-input','tests/game-assets/decoder-input.node.mjs',610000],['decoder-timeout','tests/game-assets/decoder-timeout.node.mjs',30000],['archive','tests/game/archive.node.mjs',190000]];
  for(const [name,file,cap] of groups){
   const destination=path.join(out,name),placement=name==='placement-publication';
   const args=placement?[process.execPath,file,destination]:[process.execPath,'--test','--test-concurrency=1','--test-reporter=tap',file];
   const result=await command(name,args,cap,{...nodeEnv,DECODER_TEST_EVIDENCE:destination});
   if(placement){
    const summary=JSON.parse(await fs.readFile(path.join(destination,'publication-negative-summary.json'),'utf8'));
    if(!summary.count||summary.count!==summary.tests.length||new Set(summary.tests.map(r=>r.name)).size!==summary.count||summary.tests.some(r=>r.exit!==1||!r.manifestUnchanged))throw Error('Incomplete placement assertions');
    node.push({...result,format:'placement',passed:summary.count,assertions:await artifact(path.join(destination,'publication-negative-summary.json'))});
   }else node.push({...result,format:'tap',passed:parseTap(await fs.readFile(result.stdout.path,'utf8'))});
  }
  // This explicit invocation remains separately scoped; its repeated contract identities do not inflate product counts.
  const report=path.join(out,'economic-contracts-report.json'),contractsId=runId+'-contracts';
  resources.contractServers={status:'planned',roots:[root,process.env.SGG_BASELINE_ROOT],ports:[]};await saveResources();
  const contractServers=[];let contracts;
  try{
   contractServers.push(await startStatic(root));contractServers.push(await startStatic(process.env.SGG_BASELINE_ROOT));
   resources.contractServers.status='running';resources.contractServers.ports=contractServers.map(s=>s.port);await saveResources();
   contracts=await command('economic-contracts',['npm','run','test:contracts'],190000,{SGG_RUN_ID:contractsId,SGG_REPORT:report,PLAYWRIGHT_JSON_OUTPUT_FILE:report,SGG_EVIDENCE_DIR:path.join(out,'economic-contracts'),SGG_CASE_MATCH:'contracts.spec.mjs',SGG_EXTERNAL_SERVERS:'1',SGG_FINAL_START:startFile,SGG_APP_PORT:String(contractServers[0].port),SGG_BASELINE_PORT:String(contractServers[1].port)});
  }finally{for(const server of contractServers)await server.close();resources.contractServers.status='closed';await saveResources();}
  const contractsReport=JSON.parse(await fs.readFile(report,'utf8'));Object.assign(contracts,verifyReport(contractsReport,{exitCode:contracts.code,started:contracts.started,runId:contractsId,engines:['chromium']}),{report:await artifact(report)});
  const end={at:new Date().toISOString(),references:await readReferenceBindings(),...await snapshot(root)},packageEnd=await packageBinding(process.env.SGG_PACKAGE_ROOT,root);validateReferenceBindings(start.references,end.references);
  if(JSON.stringify(packageStart)!==JSON.stringify(packageEnd))throw Error('Changed final package');
  if(JSON.stringify(edition)!==JSON.stringify(await editionLineage({root,evidenceRoot:process.env.SGG_EDITION_EVIDENCE_ROOT,packageRoot:process.env.SGG_PACKAGE_ROOT})))throw Error('Changed edition lineage');
  if(JSON.stringify(taskProofInputs)!==JSON.stringify(await artifact(process.env.SGG_TASK_RECEIPT_INPUTS)))throw Error('Changed original proof inputs');
  receipt={taskProofInputs,schemaVersion:2,status:'PASS',runId,root,directory:out,qaInputs,edition,runtime:{node:process.version,versions:process.versions,tools:runtimeTools},start,end,inventory,shards,node,contracts,packageBinding:packageEnd,identities:shards.flatMap(s=>s.identities).sort(),passed:shards.reduce((n,s)=>n+s.passed,0),pendingLive:inventory.live};
  if(cancelled)throw Error('Final suite cancelled');
  receipt.caseRoles=sumCaseRoles(shards);validateAggregate(receipt);
 }catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({status:'FAIL',runId,message:error.message,completedShards:shards.length,completedNode:node.length},null,2));throw error;}
 finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);for(const name of ['baseline-site','current-site'])await fs.rm(path.join(out,'publication-data',name),{recursive:true,force:true});await fs.rm(tmp,{recursive:true,force:true});resources.status='closed';resources.tmpRemoved=true;await saveResources();}
 await fs.writeFile(path.join(out,'run.json'),JSON.stringify(receipt,null,2));
 return {status:'PASS',runId,directory:out,passed:receipt.passed,nodePassed:node.reduce((n,r)=>n+r.passed,0),contractsPassed:receipt.contracts.passed,fingerprintSHA256:receipt.end.fingerprintSHA256,receipt:await artifact(path.join(out,'run.json')),pendingLive:inventory.live};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const [root,out]=process.argv.slice(2);if(!root||!out)throw Error('Usage: final-suite.mjs APP E');
 await runFinalSuite({root:path.resolve(root),evidence:path.resolve(out),engines:['chromium','webkit'],registry:await caseRegistry()});
}
