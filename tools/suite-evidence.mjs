import path from 'node:path';
import {hash,fingerprint} from './delivery-files.mjs';
import {validateReferenceBindings,readReferenceBindings} from './final-evidence.mjs';
export const projects=['chromium','webkit'];
export function reportCases(report){
 const found=[];
 function visit(suites,ancestry=[]){
  for(const suite of suites||[]){
   const suitePath=[...ancestry,suite.title];
   for(const spec of suite.specs||[])for(const test of spec.tests||[]){
    const identity={specId:spec.id,file:path.resolve(report.config.rootDir,spec.file||suite.file),suitePath,title:spec.title,project:test.projectName,projectId:test.projectId};
    const annotations=[...(test.annotations||[]),...(test.results?.[0]?.annotations||[])];
    found.push({identity,expected:test.expectedStatus,annotations:annotations.filter((row,i)=>annotations.findIndex(other=>other.type===row.type&&other.description===row.description)===i),results:test.results||[]});
   }visit(suite.suites,suitePath);
  }
 }visit(report.suites);return found;
}
export const identityKey=identity=>JSON.stringify(identity&&[identity.specId,identity.file,identity.suitePath,identity.title,identity.project,identity.projectId]);
export function cleanCase(row){
 return row.expected==='passed'&&row.results.length===1&&row.results[0].status==='passed'&&row.results[0].retry===0&&Array.isArray(row.results[0].errors)&&row.results[0].errors.length===0&&row.results[0].error===undefined;
}
export function validateFinalSuite({report,inventory,run,files,reportBytes,inventoryBytes}){
 if(run.schema!==1||run.status!=='passed'||!run.runId||run.start?.runId!==run.runId||run.exitCode!==0)throw Error('Final run incomplete');
 if(run.reportSHA256!==hash(reportBytes)||run.inventorySHA256!==hash(inventoryBytes))throw Error('Final report/inventory digest mismatch');
 const finalFingerprint=fingerprint(files);
 if(run.start.fingerprintSHA256!==finalFingerprint||run.end.fingerprintSHA256!==finalFingerprint||
    fingerprint(run.start.files)!==finalFingerprint||fingerprint(run.end.files)!==finalFingerprint)throw Error('Run start/end inputs differ from delivered files');
 if(!Number.isFinite(Date.parse(run.start.at))||!Number.isFinite(Date.parse(run.end.at))||Date.parse(run.end.at)<Date.parse(run.start.at))throw Error('Invalid run interval');
 const expected=reportCases(inventory),actual=reportCases(report);
 const inventoryKeys=expected.map(row=>identityKey(row.identity)).sort(),actualKeys=actual.map(row=>identityKey(row.identity)).sort();
 if(!actual.length||new Set(actualKeys).size!==actual.length||JSON.stringify(inventoryKeys)!==JSON.stringify(actualKeys))throw Error('Incomplete/duplicate final case inventory');
 for(const project of projects){
  if(!expected.some(row=>row.identity.project===project)||!actual.some(row=>row.identity.project===project))throw Error('Both browser inventories required');
 }
 if(actual.some(row=>!projects.includes(row.identity.project)||!cleanCase(row)))throw Error('Final case failed/skipped/retried or unknown project');
 const stats=report.stats;
 if(!stats||stats.expected!==actual.length||stats.unexpected!==0||stats.skipped!==0||stats.flaky!==0||!Array.isArray(report.errors)||report.errors.length)throw Error('Final suite is not clean and complete');
 return {runId:run.runId,fingerprintSHA256:finalFingerprint,cases:actual,projects,counts:Object.fromEntries(projects.map(p=>[p,actual.filter(row=>row.identity.project===p).length]))};
}

export function validateFreeze(a,b){
 if(!a||!b||!a.files?.length||a.fingerprintSHA256!==fingerprint(a.files)||b.fingerprintSHA256!==fingerprint(b.files)||a.fingerprintSHA256!==b.fingerprintSHA256)throw Error('Edited final source');
}
export function validateShard(shard){
 if(shard.status!=='PASS'||shard.exitCode!==0||!Number.isSafeInteger(shard.passed)||shard.passed<=0||shard.identities?.length!==shard.passed||new Set(shard.identities).size!==shard.passed)throw Error('Failed/zero/duplicate shard');
 if(!shard.engines||Object.values(shard.engines).reduce((n,c)=>n+c,0)!==shard.passed)throw Error('Wrong shard engine count');
}
const pointer=(value,p)=>{if(p==='')return value;if(typeof p!=='string'||!p.startsWith('/'))throw Error('Invalid evidence pointer');return p.slice(1).split('/').reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],value);};
export function validateRunWindow(command,receipt){
 const start=Date.parse(receipt.start.at),end=Date.parse(receipt.end.at);
 if(!Number.isFinite(command.started)||!Number.isFinite(command.ended)||command.started<start||command.ended<command.started||command.ended>end)throw Error('Command outside aggregate interval');
}
export function validateCommandBinding(child,{command,receipt}){
 validateRunWindow(command,receipt);
 if(command.status!=='closed'||command.code!==0||command.signal||command.cancelled||command.timedOut||command.started!==child.started||command.ended!==child.ended||JSON.stringify(command.argv)!==JSON.stringify(child.argv)||!Array.isArray(command.remainingOwned)||command.remainingOwned.length)throw Error('Failed/stale child command');
}
export function validateAggregate(receipt){
 if(receipt.schemaVersion!==2||receipt.status!=='PASS'||!receipt.runId||!Array.isArray(receipt.shards)||!receipt.shards.length)throw Error('Incomplete final aggregate');
 const a=receipt.start,b=receipt.end;
 validateFreeze(a,b);
 validateReferenceBindings(a.references,b.references);
 if(!Number.isFinite(Date.parse(a.at))||!Number.isFinite(Date.parse(b.at))||Date.parse(b.at)<Date.parse(a.at))throw Error('Invalid aggregate interval');
 if(!receipt.inventory?.shards?.length||JSON.stringify(receipt.inventory.shards.map(r=>r.file).sort())!==JSON.stringify(receipt.shards.map(r=>r.spec).sort()))throw Error('Omitted product spec');
 if(!path.isAbsolute(receipt.directory||'')||path.basename(receipt.directory)!==receipt.runId)throw Error('Wrong aggregate directory');
 if(!receipt.qaInputs||!Object.keys(receipt.qaInputs).length||Object.entries(receipt.qaInputs).some(([name,sha])=>!a.files.some(f=>f.path===name&&f.sha256===sha)))throw Error('QA inputs differ from F');
 const inputsSHA=hash(JSON.stringify(receipt.qaInputs,null,2));
 const identities=[];
 for(const shard of receipt.shards){
  validateShard(shard);
  if(shard.aggregateRunId!==receipt.runId||!shard.runId||path.basename(shard.runId)!==shard.runId||shard.directory!==path.join(receipt.directory,shard.runId))throw Error('Foreign aggregate shard');
  if(shard.inputs?.path!==path.join(shard.directory,'inputs.json')||shard.inputsFile!==shard.inputs.path||shard.inputs.sha256!==inputsSHA)throw Error('Shard inputs differ from F');
  validateRunWindow(shard,receipt);validateRunWindow({started:shard.listingStarted,ended:shard.listingEnded},receipt);
  if(shard.listingEnded>shard.started)throw Error('Listing follows shard');
  if(!projects.every(p=>shard.engines[p]>0))throw Error('Missing shard engine');
  identities.push(...shard.identities);
 }
 if(new Set(identities).size!==identities.length)throw Error('Duplicate aggregate identity');
 if(JSON.stringify([...identities].sort())!==JSON.stringify(receipt.identities)||receipt.passed!==identities.length)throw Error('Omitted aggregate identity');
 if(JSON.stringify(receipt.caseRoles)!==JSON.stringify(sumCaseRoles(receipt.shards)))throw Error('Wrong aggregate case roles');
 const names=['publication','publication-preflight','placement-publication','decoder-input','decoder-timeout','archive'];
 if(JSON.stringify(receipt.node?.map(r=>r.name).sort())!==JSON.stringify(names.sort()))throw Error('Missing Node category');
 for(const row of receipt.node){validateRunWindow(row,receipt);if(row.code!==0||row.signal||row.timedOut||row.cancelled||!Number.isSafeInteger(row.passed)||row.passed<=0)throw Error('Failed/zero Node category');}
 validateRunWindow(receipt.contracts||{},receipt);
 if(receipt.contracts?.code!==0||!(receipt.contracts.passed>0)||receipt.contracts.signal||receipt.contracts.timedOut||receipt.contracts.cancelled)throw Error('Missing separate contracts');
 return {passed:identities.length,nodePassed:receipt.node.reduce((n,r)=>n+r.passed,0),contractsPassed:receipt.contracts.passed};
}
const roleNames=['current','originalBaseline','educationReference','unattested'];
export function sumCaseRoles(shards){
 const counts=Object.fromEntries(roleNames.map(name=>[name,0]));
 for(const shard of shards){const roles=shard.servedProofs?.caseRoles;if(!roles||JSON.stringify(Object.keys(roles).sort())!==JSON.stringify([...roleNames].sort())||roleNames.some(name=>!Number.isSafeInteger(roles[name])||roles[name]<0)||roleNames.reduce((n,name)=>n+roles[name],0)!==shard.passed)throw Error('Invalid shard case roles');for(const name of roleNames)counts[name]+=roles[name];}
 return counts;
}
export function validateServedSummary(sealed,actual){
 const keys=['caseRoles','count','frozenFingerprintReferenceSHA256','measurementScope'];
 if(!sealed||JSON.stringify(Object.keys(sealed).sort())!==JSON.stringify(keys)||!Number.isSafeInteger(sealed.count)||sealed.count<0||sealed.count!==actual.count||sealed.measurementScope!==actual.measurementScope||sealed.frozenFingerprintReferenceSHA256!==actual.frozenFingerprintReferenceSHA256||JSON.stringify(sealed.caseRoles)!==JSON.stringify(actual.caseRoles))throw Error('Forged served proof summary');
}
export function parseTap(text){
 const value=name=>{const matches=[...text.matchAll(new RegExp('^# '+name+' (\\d+)$','gm'))];if(matches.length!==1)throw Error('Missing/ambiguous TAP '+name);return Number(matches[0][1]);};
 const tests=value('tests'),pass=value('pass');
 if(tests<=0||pass!==tests||['fail','cancelled','skipped','todo'].some(k=>value(k)!==0)||/^not ok /m.test(text))throw Error('Failed/empty TAP');
 return pass;
}
// These raw claim sets preserve original + repair scope; they contain no approval verdict.
const compoundClaims={
 2:["ce5305d693c4c7bd2e39b20d12d6c33580e91c33c692626d5283e677bd0b2afa","8a717aa4672c78b493b58f4a4b544d5bd56f3bd8a2e64edb46ebaf23182e090b","28d2dc9d0f455974fb1366c345119e0c895703b3e9c69ee7c89c0ba96f9aa566"],
 3:["f66b44f8d97b7b477123f5fdab1c3e3dc3fcc98653bfecb8287cbb2c6505b9a0","ab8cbc60a73acf96c49b8cb156c850495ca507f00e239168c7d8d0b2453da18e","a7d28a3a9fed0b4889a16d9cb0072829fdd5e0d49a022e9494e64fbc4e6432e9","201df43f485f48aca519ed2bf8e3e0d28312d3c972099c9f95bb9f6dad42bf00"],
 6:["c276097306dc106d97015832487d458a1c822b12ca313b77b55e192c8215a170","135733c2595ed498bccffde87b1f0f99da3df0fa65f7848f83c937c325b0094d","01dc77ef868ff11f4db3cba71b4622a4852d8ed6e6b06ba12225cf3d21a05b1d"],
 12:["6806420b2c4fff173124d9da3ee16941d736dd1ff0c4d2fcad6eb3fb4f31b2b6","0e4afc675687129a43cd8e476093f416822f78bec3516314f9b1bf5d835654c2","7f700ba2928126b3e1052bf10709fab26cb8029757c88c2b4578078f982d40c0"],
 20:["6e3dcf39953ed1b9738c71dfbd9ee6b97f322a39555575fe31584632f715b2ab","dbc0763f3e232a2eea675b7bbf577952653dd2d04cf2c059365637dc40bc3e42"],
 21:["79bd75e32d27373d9de83894553fa5d8f0ac01215b745c65cd7c8bff544ec494","dbc0763f3e232a2eea675b7bbf577952653dd2d04cf2c059365637dc40bc3e42"],
};
const identitylessProofs={5:'c537f160cb25774a6c24452e874c6e19044a8d12e6342a1d5695ef6b06020807',12:'ffb72068036516da7c254ae14be5ac74adff010b43e9d3a365320bb3deb8f8ac',36:'e6dc31da8f7992736ec1cf51ec1f98503d1ce0186536b563c444c9b7f8c90aad'};
const sameSet=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const confirmed=v=>v?.verdict==='confirmed'&&(v.failure_class===undefined||v.failure_class==='none');
/** Typed original evidence only. Current-F semantic coverage still requires independent F1 review. */
export function validateTaskProofs({task,claims,proofs,claimArtifacts,proofArtifacts,closure}){
 if(!Number.isSafeInteger(task)||task<1||task>46||!Array.isArray(claims)||!claims.length||!Array.isArray(proofs)||proofs.length!==(task===2?2:1))throw Error('Missing task proof set');
 if(claims.some(c=>c.complete===false||c.DoneClaim?.complete===false))throw Error('Explicit incomplete task claim');
 const claimIds=claims.map(c=>(c.DoneClaim??c).task),exceptions={2:['2.runner','2.runner','task-2/assets-helper'],3:['Task3.spec repair-r1','Task3.spec','3.mock repair-r1','3.mock'],6:['6.runtime','6.docs/repair-r1','6.docs'],9:['9 pilot11 production and integration'],12:[12,12,'12/rooms'],20:[20,'20/21 shared single harness repair'],21:[21,'20/21 shared single harness repair']};
 if(!sameSet(claimIds,exceptions[task]??[task]))throw Error('Wrong/incomplete task claims');
 if(compoundClaims[task]&&!sameSet(claimArtifacts.map(a=>a.sha256),compoundClaims[task]))throw Error('Incomplete original and repair scope');
 for(const [index,raw] of proofs.entries()){
  const av=raw.AdversarialVerify,proof=av??raw;
  if(task===2){if(!['2.runner','task-2/assets-helper'].includes(raw.task)||!confirmed(raw)||(av&&!confirmed(av)))throw Error('Wrong compound task verification');}
  else if(task===3){if(av?.task!=='Task3'||!confirmed(av)||!['3.spec','3.mock'].every(k=>confirmed(raw.components?.[k]?.AdversarialVerify)))throw Error('Missing compound child verification');}
  else if(task===6){if(raw.task!=='6'||!confirmed(raw)||!confirmed(av)||!['6.runtime','6.docs'].every(k=>confirmed(raw.lanes?.[k])))throw Error('Missing compound child verification');}
  else if(task===5||task===12){
   const scope=task===5?'Approved Task5 game-only persistence and PWA identity':'Task12 actual static environment assets only:21base+3icons+2optionalderived,16crops. No in-app UI readiness or full game art completeness claim.';
   if(raw.task!==undefined||av?.task!==undefined||av?.scope!==scope||!confirmed(av))throw Error('Wrong identityless task scope/verdict');
   if(task===12&&!['roomsClaim','foundationsClaim','combinedClaim'].every(k=>confirmed(av[k])))throw Error('Missing compound child verification');
  }else if(task===36){
   if(!confirmed(raw)||closure?.task!=='36'||closure.verdict!=='FullyDone'||closure.independentVerification!==proofArtifacts[index].path||closure.verificationSHA256!==proofArtifacts[index].sha256)throw Error('Wrong task closure join');
  }else if(task===37){
   const refs=raw.manualQa?.artifactRefs?.filter(a=>a.id==='claim');
   if(claims[0].status!=='READY_FOR_INDEPENDENT_VERIFICATION'||refs?.length!==1||refs[0].path!==claimArtifacts[0].path||refs[0].sha256!==claimArtifacts[0].sha256)throw Error('Wrong Task37 independently reviewed claim');
   if(raw.task!=='Task37 independent AdversarialVerify'||raw.status!=='CONFIRMED'||raw.verdict!=='APPROVE'||raw.cleanup!=='CLEAN'||raw.failures?.length!==0||!/^[a-f0-9]{64}$/.test(raw.release))throw Error('Missing final Task37 verification');
  }else if(task===28){if(raw.task!==28||raw.status!=='confirmed'||raw.verdict!==undefined)throw Error('Wrong status task verification');}
  else{
   if((raw.task??av?.task)!==task||(av?.task!==undefined&&av.task!==task)||!confirmed(proof))throw Error('Wrong task identity/verdict');
   if(raw.verdict!==undefined&&!['confirmed',...(task===9?['APPROVE']:[]),...([15,16].includes(task)?['PASS']:[])].includes(raw.verdict))throw Error('Contradictory root verdict');
  }
  const linked=task===3?['A018','A019'].map(id=>raw.manualQa?.artifactRefs?.find(a=>a.id===id)):task===4?[raw.manualQa?.artifactRefs?.find(a=>a.id==='producer-current-claim')]:task===8?[av?.manualQa?.artifactRefs?.find(a=>a.id==='claim')]:task===12?['roomsClaim','foundationsClaim','combinedClaim'].map(k=>av?.[k]):task===35?[raw.producerDoneClaim]:task===37?[raw.manualQa?.artifactRefs?.find(a=>a.id==='claim')]:[];
  if(linked.some(ref=>!ref||!claimArtifacts.some(a=>a.path===ref.path&&a.sha256===ref.sha256&&(ref.bytes===undefined||ref.bytes===a.bytes))))throw Error('Independent proof claim binding mismatch');
  if(identitylessProofs[task]&&proofArtifacts[index].sha256!==identitylessProofs[task])throw Error('Unreviewed identityless original');
 }
 if(task===2&&!sameSet(proofs.map(p=>p.task),['2.runner','task-2/assets-helper']))throw Error('Missing compound child verification');
 return {task,claims:claims.length,proofs:proofs.length,semanticApproval:false};
}
export async function auditTaskProofs(row){
 const fs=await import('node:fs/promises'),{boundArtifact}=await import('./delivery-files.mjs');
 if(!Array.isArray(row.claims)||!Array.isArray(row.verifications))throw Error('Missing raw task artifact sets');
 const read=async artifact=>{await boundArtifact(artifact);return JSON.parse(await fs.readFile(artifact.path,'utf8'));};
 const claims=await Promise.all(row.claims.map(read)),proofs=await Promise.all(row.verifications.map(read)),closure=row.parentClosure?await read(row.parentClosure):undefined;
 const checked=validateTaskProofs({task:row.task,claims,proofs,closure,claimArtifacts:row.claims,proofArtifacts:row.verifications});
 return {checked,proofs};
}

/** Live external release-set v1: all artifact references are absolute, raw byte SHA-bound. */
export async function validateServedAttachments({report,start,root,ended,artifacts,manifestPath,baselineSHA,educationSHA}){
 const fs=await import('node:fs/promises'),{boundArtifact}=await import('./delivery-files.mjs'),{validateServedRecord}=await import('./case-evidence.mjs');
 const run={root,runId:start.runId,start,end:{at:new Date(ended).toISOString()}},byPath=new Map(start.files.map(r=>[r.path,r])),seen=new Set(),caseRoles={current:0,originalBaseline:0,educationReference:0,unattested:0};let count=0;
 if(start.references){validateReferenceBindings(start.references);if((baselineSHA!==undefined&&baselineSHA!==start.references.original.index.sha256)||(educationSHA!==undefined&&educationSHA!==start.references.education.index.sha256))throw Error('Shard reference digests differ from aggregate bindings');}
 for(const row of reportCases(report)){
  const attached=row.results.flatMap(r=>r.attachments||[]).filter(a=>['final-freeze-served','baseline-freeze-served','education-reference-freeze-served'].includes(a.name));
  if(row.annotations.some(a=>a.type==='final-runtime-id')&&!attached.length)throw Error('Missing annotated served proof');
  if(!attached.length){caseRoles.unattested++;continue;}if(!cleanCase(row))throw Error('Served proof belongs to unclean case');
  if(attached.some(a=>a.name==='baseline-freeze-served')&&baselineSHA===undefined||attached.some(a=>a.name==='education-reference-freeze-served')&&educationSHA===undefined)throw Error('Missing shard reference provenance');
  caseRoles[attached.some(a=>a.name==='final-freeze-served')?'current':attached.some(a=>a.name==='education-reference-freeze-served')?'educationReference':'originalBaseline']++;
  const testPath=path.relative(root,row.identity.file).split(path.sep).join('/'),names=['index.html','src/app_tpl.html','src/pwa_body.txt','sw.js',testPath];
  if(byPath.has('game-release.json')){if(typeof manifestPath!=='string'||!/^assets\/game\/[a-f0-9]{64}\/manifest\.[a-f0-9]{64}\.json$/.test(manifestPath))throw Error('Missing trusted runtime manifest path');names.push('game-release.json','manifest.webmanifest',manifestPath);}
  const frontier=[...new Set(names)].sort().map(name=>{const file=byPath.get(name);if(!file)throw Error('Missing frozen frontier row: '+name);return file;});
  for(const attachment of attached){
   if(attachment.contentType!=='application/json'||seen.has(attachment.path))throw Error('Duplicate/non-JSON served attachment');seen.add(attachment.path);
   const project=report.config?.projects?.find(p=>p.name===row.identity.project&&p.id===row.identity.projectId),relative=project?.outputDir&&path.relative(project.outputDir,attachment.path);
   if(!path.isAbsolute(attachment.path||'')||!project?.outputDir||relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).length<2)throw Error('Served attachment outside owning report output');
   const bound=artifacts.filter(a=>a.path===attachment.path);if(bound.length!==1)throw Error('Unbound served attachment');await boundArtifact(bound[0]);
   const served=JSON.parse(await fs.readFile(attachment.path,'utf8'));
   const expectedName=served.kind==='baseline'?'baseline-freeze-served':served.kind==='education-reference'?'education-reference-freeze-served':'final-freeze-served';if(attachment.name!==expectedName)throw Error('Wrong served attachment role');
   validateServedRecord(served,{identity:row.identity,annotations:row.annotations,run,frontier,files:start.files,baselineSHA,educationSHA});count++;
  }
 }
 return {count,caseRoles,measurementScope:'response-and-file-frontier',frozenFingerprintReferenceSHA256:start.fingerprintSHA256};
}
export async function auditReleaseSet(setFile,phase='receipt'){
 if(!['delivery','receipt'].includes(phase))throw Error('Unknown live audit phase');
 const fs=await import('node:fs/promises');const {boundArtifact,absoluteInput,packageBinding,snapshot}=await import('./delivery-files.mjs');
 await absoluteInput(setFile,'SGG_RELEASE_SET');const set=JSON.parse(await fs.readFile(setFile,'utf8'));
 if(set.schemaVersion!==1||set.edition!=='game'||!/^[a-f0-9]{64}$/.test(set.releaseId)||!set.sourceRoot)throw Error('Invalid release-set');
 await absoluteInput(set.sourceRoot,'sourceRoot');if(set.sourceRoot!==path.resolve(import.meta.dirname,'..'))throw Error('Auditor executable differs from frozen source root');
 for(const name of ['freeze','final40','archive','innerManifest','restoreReceipt','documentationInputs'])await boundArtifact(set[name]);
 const freeze=JSON.parse(await fs.readFile(set.freeze.path,'utf8')),receipt=JSON.parse(await fs.readFile(set.final40.path,'utf8'));
 validateAggregate(receipt);await boundArtifact(receipt.taskProofInputs);
 validateReferenceBindings(receipt.start.references,await readReferenceBindings({originalRoot:receipt.start.references.original.root,educationRoot:receipt.start.references.education.root}));
 if(freeze.fingerprintSHA256!==set.fingerprintSHA256||fingerprint(freeze.files)!==set.fingerprintSHA256||receipt.start.fingerprintSHA256!==set.fingerprintSHA256)throw Error('Stale freeze binding');
 const current=await snapshot(set.sourceRoot);if(current.fingerprintSHA256!==set.fingerprintSHA256)throw Error('Edited frozen source');
 const {inputHashes}=await import('./game-qa/inputs.mjs');
 if(JSON.stringify(await inputHashes(set.sourceRoot))!==JSON.stringify(receipt.qaInputs))throw Error('Incomplete frozen QA inputs');
 const {suiteInventory}=await import('./final-suite.mjs'),{caseRegistry}=await import('./game-qa.mjs');
 if(JSON.stringify(await suiteInventory(set.sourceRoot,await caseRegistry()))!==JSON.stringify(receipt.inventory))throw Error('Incomplete live source inventory');
 const binding=await packageBinding(set.package.root,set.sourceRoot);
 const {editionLineage}=await import('./delivery-files.mjs');
 if(JSON.stringify(await editionLineage({root:set.sourceRoot,evidenceRoot:path.dirname(receipt.edition.input.path),packageRoot:receipt.edition.packages[0].root}))!==JSON.stringify(receipt.edition))throw Error('Stale edition lineage');
 if(binding.releaseId!==set.releaseId||binding.fingerprintSHA256!==set.package.fingerprintSHA256||JSON.stringify(binding.files)!==JSON.stringify(set.package.files)||receipt.packageBinding.fingerprintSHA256!==binding.fingerprintSHA256)throw Error('Different final package');
 for(const shard of receipt.shards){
  await boundArtifact(shard.inputs);await boundArtifact(shard.childRecord);await boundArtifact(shard.listingRecord);
  const inputs=JSON.parse(await fs.readFile(shard.inputs.path,'utf8'));
  if(JSON.stringify(inputs)!==JSON.stringify(receipt.qaInputs))throw Error('Stale shard inputs');
  const child=JSON.parse(await fs.readFile(shard.childRecord.path,'utf8')),listing=JSON.parse(await fs.readFile(shard.listingRecord.path,'utf8'));
  for(const command of [child,listing])if(command.status!=='closed'||command.code!==0||command.signal||command.cancelled||command.timedOut||!Array.isArray(command.remainingOwned)||command.remainingOwned.length)throw Error('Failed browser child');
  validateRunWindow(child,receipt);validateRunWindow(listing,receipt);
  if(listing.started!==shard.listingStarted||listing.ended!==shard.listingEnded||listing.ended>child.started)throw Error('Stale browser listing');
  if(child.started!==shard.started||child.ended!==shard.ended||JSON.stringify(child.argv)!==JSON.stringify(shard.command))throw Error('Stale browser command');
  await boundArtifact(shard.report);await boundArtifact(shard.inventory);await boundArtifact(shard.summary);
  const summary=JSON.parse(await fs.readFile(shard.summary.path,'utf8'));if(summary.runId!==shard.runId||summary.aggregateRunId!==receipt.runId||summary.directory!==shard.directory||summary.inputsFile!==shard.inputs.path||summary.passed!==shard.passed||JSON.stringify(summary.identities)!==JSON.stringify(shard.identities)||JSON.stringify(summary.baseline)!==JSON.stringify(shard.baseline))throw Error('Stale shard summary');
  for(const attachment of shard.attachments||[])await boundArtifact(attachment);
  const report=JSON.parse(await fs.readFile(shard.report.path,'utf8')),inventory=JSON.parse(await fs.readFile(shard.inventory.path,'utf8'));
  const {verifyReport}=await import('./game-qa/report.mjs');verifyReport(report,{runId:shard.runId,started:shard.started,exitCode:shard.exitCode,engines:projects});
  const attached=reportCases(report).flatMap(r=>r.results.flatMap(t=>(t.attachments||[]).filter(a=>a.path).map(a=>a.path)));
  if(JSON.stringify([...new Set(attached)].sort())!==JSON.stringify((shard.attachments||[]).map(a=>a.path).sort()))throw Error('Omitted report attachment');
  const served=await validateServedAttachments({report,start:receipt.start,root:set.sourceRoot,ended:shard.ended,artifacts:shard.attachments,manifestPath:receipt.packageBinding.manifestPath,baselineSHA:shard.baseline?.original,educationSHA:shard.baseline?.education});validateServedSummary(shard.servedProofs,served);
  const actual=reportCases(report).map(r=>identityKey(r.identity)).sort(),expected=reportCases(inventory).map(r=>identityKey(r.identity)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected)||JSON.stringify(actual)!==JSON.stringify(shard.identities))throw Error('Stale shard inventory');
 }
 for(const child of [...receipt.node,receipt.contracts]){
  await boundArtifact(child.commandRecord);await boundArtifact(child.stdout);await boundArtifact(child.stderr);
  const command=JSON.parse(await fs.readFile(child.commandRecord.path,'utf8'));
  validateCommandBinding(child,{command,receipt});
  if(child.format==='placement'){await boundArtifact(child.assertions);const assertions=JSON.parse(await fs.readFile(child.assertions.path,'utf8'));if(assertions.count!==child.passed||assertions.tests.length!==child.passed||assertions.tests.some(r=>r.exit!==1||!r.manifestUnchanged))throw Error('Bad placement evidence');}
  if(child.format==='tap'&&parseTap(await fs.readFile(child.stdout.path,'utf8'))!==child.passed)throw Error('Wrong TAP count');
 }
 await boundArtifact(receipt.contracts.report);const contractReport=JSON.parse(await fs.readFile(receipt.contracts.report.path,'utf8'));
 (await import('./game-qa/report.mjs')).verifyReport(contractReport,{runId:receipt.runId+'-contracts',started:receipt.contracts.started,exitCode:receipt.contracts.code,engines:['chromium']});
 await boundArtifact(set.packaged41.summary);await boundArtifact(set.packaged41.report);const packaged41=JSON.parse(await fs.readFile(set.packaged41.summary.path,'utf8'));
 if(packaged41.case!=='packaged-smoke'||packaged41.status!=='PASS'||packaged41.packageBinding?.root!==binding.root||packaged41.packageBinding.fingerprintSHA256!==binding.fingerprintSHA256)throw Error('Missing actual final-location smoke');
 (await import('./game-qa/report.mjs')).verifyReport(JSON.parse(await fs.readFile(set.packaged41.report.path,'utf8')),{runId:packaged41.runId,started:packaged41.started,exitCode:packaged41.exitCode,engines:projects});
 if(!Array.isArray(set.packaged41.attachments)||!set.packaged41.attachments.length)throw Error('Missing final-location artifacts');for(const artifact of set.packaged41.attachments)await boundArtifact(artifact);
 const archiveReceipt=JSON.parse(await fs.readFile(set.restoreReceipt.path,'utf8')),manifest=JSON.parse(await fs.readFile(set.innerManifest.path,'utf8'));
 if(archiveReceipt.archiveSHA!==set.archive.sha256||archiveReceipt.archiveBytes!==set.archive.bytes||archiveReceipt.sourceManifestSHA!==set.innerManifest.sha256||archiveReceipt.inputDigest!==manifest.inputDigest)throw Error('Stale archive receipt');
 if(set.innerManifest.path!==path.join(set.restoredRoot,'source-materials/source-manifest.json'))throw Error('Wrong extracted inner manifest path');
 const {collectInventory}=await import('./game-archive/inventory.mjs');
 const expectedArchive=collectInventory(set.sourceRoot);
 if(hash(expectedArchive.manifest)!==set.innerManifest.sha256)throw Error('Incomplete current archive inventory');
 const {verifyRestored}=await import('./game-archive/resolver.mjs');const restored=verifyRestored(set.restoredRoot);
 if(restored.inputDigest!==manifest.inputDigest||restored.files!==manifest.files.length)throw Error('Wrong restored payload');
 for(const row of manifest.files){const source=freeze.files.find(r=>r.path===row.path);if(source&&(source.sha256!==row.sha256||source.bytes!==row.bytes))throw Error('Archived source differs from F: '+row.path);}
 for(const name of ['README.md','docs/game-maintenance.md','docs/releases/game-edition.md']){
  const row=manifest.files.find(r=>r.path===name),source=freeze.files.find(r=>r.path===name);
  if(!row||!source||row.sha256!==source.sha256||row.bytes!==source.bytes)throw Error('Missing/stale archived production document');
 }
 const doc=JSON.parse(await fs.readFile(set.documentationInputs.path,'utf8'));
 if(doc.scope!=='frozen'||doc.archive?.scope!=='frozen'||doc.archive.file!==set.archive.path||doc.archive.restoredRoot!==set.restoredRoot||doc.packageRoot!==binding.root)throw Error('Historical documentation proof used as final');
 await boundArtifact(set.documentationRun);const documentation=JSON.parse(await fs.readFile(set.documentationRun.path,'utf8'));
 if(documentation.case!=='documentation-contract'||documentation.status!=='PASS'||documentation.exitCode!==0)throw Error('Missing frozen documentation run');
 await boundArtifact(set.documentationReport);const documentReport=JSON.parse(await fs.readFile(set.documentationReport.path,'utf8'));
 (await import('./game-qa/report.mjs')).verifyReport(documentReport,{runId:documentation.runId,started:documentation.started,exitCode:documentation.exitCode,engines:Object.keys(documentation.engines)});
 await boundArtifact(set.documentationBindings);const documented=JSON.parse(await fs.readFile(set.documentationBindings.path,'utf8'));
 if(set.documentationBindings.path!==path.join(documentation.directory,'documentation-real-bindings.json')||documented.portable?.scope!=='frozen'||documented.portable.archiveSHA!==set.archive.sha256||documented.portable.sourceManifestSHA!==set.innerManifest.sha256||documented.current?.releaseId!==set.releaseId)throw Error('Unbound frozen documentation result');
 if(phase==='receipt'){
 if(!Array.isArray(set.tasks)||JSON.stringify(set.tasks.map(r=>r.task).sort((a,b)=>a-b))!==JSON.stringify(Array.from({length:46},(_,i)=>i+1)))throw Error('Missing/duplicate task receipts');
 for(const row of set.tasks){
  const {proofs}=await auditTaskProofs(row);const original=proofs[0];
  if(!Array.isArray(row.evidence)||!row.evidence.length||row.fingerprintSHA256!==set.fingerprintSHA256||row.releaseId!==set.releaseId||!['direct','unchanged-scope','revalidated'].includes(row.binding))throw Error('Unbound task evidence');
  for(const artifact of row.evidence)await boundArtifact(artifact);
  if(!Array.isArray(row.currentCases)||!row.currentCases.length||row.currentCases.some(id=>!receipt.identities.includes(id)))throw Error('Missing current F regression coverage');
  if(row.binding==='direct'&&pointer(original,row.releasePointer)!==set.releaseId)throw Error('Wrong final-task release');
  if(row.binding==='unchanged-scope'){
   if(!Array.isArray(row.inputs)||!row.inputs.length)throw Error('Missing scoped source projection');
   for(const input of row.inputs)if(!freeze.files.some(r=>r.path===input.path&&r.sha256===input.sha256)||pointer(proofs[input.proofIndex??0],input.pointer)!==input.sha256)throw Error('Changed historical task scope');
  }else if(row.binding==='revalidated'){
   if(!Array.isArray(row.sourcePaths)||!row.sourcePaths.length||row.sourcePaths.some(name=>!freeze.files.some(r=>r.path===name)))throw Error('Missing revalidated F source scope');
  }
 }
 if(!Array.isArray(set.coverage)||JSON.stringify(set.coverage.map(r=>r.id).sort())!==JSON.stringify(['IS','GAP'].flatMap(k=>Array.from({length:11},(_,i)=>k+'-'+String(i+1).padStart(2,'0'))).sort()))throw Error('Missing ideal-state/gap coverage');
 for(const row of set.coverage){if(!row.tasks?.length||row.tasks.some(n=>!set.tasks.some(t=>t.task===n)))throw Error('Unbound coverage');for(const artifact of row.evidence||[])await boundArtifact(artifact);if(!row.evidence?.length)throw Error('Empty coverage proof');}
 }
 return {set,binding,receipt,freeze};
}
