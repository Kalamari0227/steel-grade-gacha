import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {startStatic} from './game-qa/server.mjs';
import {runPlaywright} from './game-qa/child.mjs';
import {inputHashes} from './game-qa/inputs.mjs';
import {packageBinding,absoluteInput} from './delivery-files.mjs';
const root=path.resolve(import.meta.dirname,'..');
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
export async function caseRegistry(){
  const registry=new Map();
  for(const file of (await fs.readdir(path.join(root,'tests/game/cases'))).filter(f=>f.endsWith('.mjs')).sort()){
    const {default:entry}=await import(pathToFileURL(path.join(root,'tests/game/cases',file)));
    if(!entry||!/^[a-z0-9-]+$/.test(entry.name)||registry.has(entry.name)||!(entry.kind==='orchestrator'||typeof entry.testMatch==='string'&&entry.testMatch))throw Error('Invalid case registry');
    if(entry.phase&&!['product','live'].includes(entry.phase))throw Error('Invalid case phase');
    registry.set(entry.name,entry);
  }return registry;
}
export async function runCase({selected,engines,evidence,config,environment={}}){
  const packageOnly=selected.name==='packaged-smoke',live=selected.phase==='live';
  const baselines=process.env.SGG_BASELINES_ROOT||path.resolve(root,'../.omo/evidence/game-edition/game-20261025-01a16bac/baselines');
  const baseline=process.env.SGG_BASELINE_ROOT||path.join(baselines,'original'),education=process.env.SGG_EDUCATION_ROOT||path.join(baselines,'education');
  let provenance=null;
  if(!packageOnly&&!live){
    provenance={original:await hash(path.join(baseline,'index.html')),education:await hash(path.join(education,'index.html'))};
    if(provenance.original!=='1207e159c272c25fe93033ac35f80b6a8a8337dec8d5ed42cf3ec298fcfc7d5b'||provenance.education!=='99537b579bddbb93994b7e19fad2348c736c8cb95e1bfa1a4d5dbdeedafa7126')throw Error('Wrong immutable baseline');
  }
  const packageRoot=packageOnly?await absoluteInput(process.env.SGG_PACKAGE_ROOT,'SGG_PACKAGE_ROOT'):null;
  const packageStart=packageOnly?await packageBinding(packageRoot,root):null;
  const runId=`${selected.name}-${randomUUID()}`,directory=path.join(evidence,runId),tmp=path.join(directory,'tmp');
  await fs.mkdir(directory,{recursive:true});
  const resource={runId,pid:process.pid,startedAt:new Date().toISOString(),status:'planned',tmp,ports:[],servers:[],baselines:live||packageOnly?null:{original:baseline,education},provenance};
  const save=()=>fs.writeFile(path.join(directory,'resources.json'),JSON.stringify(resource,null,2));await save();await fs.mkdir(tmp);
  const servers=[];let outcome,cancelled=false;const stop=()=>{cancelled=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    let current,original;
    if(!live){
      const servedRoot=packageOnly?packageRoot:root;
      resource.servers.push({root:servedRoot,status:'planned',port:0});await save();
      current=await startStatic(servedRoot);servers.push(current);Object.assign(resource.servers[0],{status:'running',port:current.port});resource.ports.push(current.port);await save();
      if(!packageOnly){resource.servers.push({root:baseline,status:'planned',port:0});await save();original=await startStatic(baseline);servers.push(original);Object.assign(resource.servers[1],{status:'running',port:original.port});resource.ports.push(original.port);}
    }
    resource.status='running';await save();const before=await inputHashes(root);
    await fs.writeFile(path.join(directory,'inputs.json'),JSON.stringify(before,null,2));
    const env={...environment,SGG_APP_ROOT:root,SGG_EDITION:'game',SGG_BASELINE_ROOT:baseline,SGG_EDUCATION_ROOT:education,SGG_EDUCATION_REVIEW_ROOT:process.env.SGG_EDUCATION_REVIEW_ROOT||path.resolve(root,'..'),SGG_EXTERNAL_SERVERS:'1',SGG_EVIDENCE_DIR:directory,TMPDIR:tmp,NODE_COMPILE_CACHE:path.join(tmp,'node-cache'),BUN_RUNTIME_TRANSPILER_CACHE_PATH:path.join(tmp,'bun-cache')};
    if(current)env.SGG_APP_PORT=String(current.port);if(original)env.SGG_BASELINE_PORT=String(original.port);
    if(cancelled)throw Error('Run cancelled');
    const result=await runPlaywright({root,directory,runId,engines,testMatch:selected.testMatch,config,env});
    if(cancelled)throw Error('Run cancelled');
    if(JSON.stringify(before)!==JSON.stringify(await inputHashes(root)))throw Error('Stale inputs changed during run');
    if(packageOnly&&JSON.stringify(packageStart)!==JSON.stringify(await packageBinding(packageRoot,root)))throw Error('Package changed during run');
    outcome={status:'PASS',case:selected.name,phase:selected.phase||'product',runId,directory,...result,aggregateRunId:environment.SGG_FINAL_RUN_ID||null,inputsFile:path.join(directory,'inputs.json'),runtimeSHA:{index:before['index.html'],source:before['src/app_tpl.html']},baseline:provenance,ports:resource.ports,packageBinding:packageStart};
  }finally{
    process.off('SIGINT',stop);process.off('SIGTERM',stop);
    const closed=await Promise.allSettled(servers.map(server=>server.close()));
    await fs.rm(tmp,{recursive:true,force:true});resource.status='closed';resource.serversClosed=closed.every(r=>r.status==='fulfilled');resource.tmpRemoved=true;await save();
    if(!resource.serversClosed)throw new AggregateError(closed.filter(r=>r.status==='rejected').map(r=>r.reason),'Server cleanup failed');
  }
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify(outcome,null,2));return outcome;
}
async function main(){
  const registry=await caseRegistry(),args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--list'){console.log(JSON.stringify({cases:[...registry.keys()]}));return;}
  const options={};for(let i=0;i<args.length;i+=2){if(!['--case','--engines','--evidence'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Invalid arguments');options[args[i]]=args[i+1];}
  const installed=JSON.parse(await fs.readFile(path.join(root,'node_modules/@playwright/test/package.json'),'utf8')),lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
  if(installed.version!=='1.61.1'||lock.packages['node_modules/@playwright/test'].version!==installed.version)throw Error('Locked Playwright version mismatch');
  const selected=registry.get(options['--case']);if(!selected)throw Error('Unknown case');
  const engines=(options['--engines']||'').split(',');if(!engines.length||new Set(engines).size!==engines.length||engines.some(e=>!['chromium','webkit'].includes(e)))throw Error('Unknown or duplicate engine');
  const evidence=options['--evidence'];if(!evidence||!path.isAbsolute(evidence))throw Error('Absolute owned evidence path required');
  const outcome=selected.kind==='orchestrator'?await (await import('./final-suite.mjs')).runFinalSuite({root,evidence,engines,registry}):await runCase({selected,engines,evidence});
  console.log(JSON.stringify(outcome));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
