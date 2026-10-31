import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {verifyReport} from './report.mjs';
import {reportCases,identityKey} from '../suite-evidence.mjs';
export const caseBudget=(match,engines=[])=>['contracts.spec.mjs','accessibility-layout.spec.mjs'].includes(path.basename(match))&&JSON.stringify([...engines].sort())===JSON.stringify(['chromium','webkit'])?({'contracts.spec.mjs':360000,'accessibility-layout.spec.mjs':300000}[path.basename(match)]):({'art-full-review.spec.mjs':600000,'audio-final.spec.mjs':240000,'accessibility.spec.mjs':540000,'audio-runtime.spec.mjs':300000,'edition-e2e.spec.mjs':240000}[path.basename(match)]||180000);

/** @typedef {{root:string,directory:string,id:string,argv:string[],env:Object,timeout:number}} CommandRun */
export async function runCommand(run){
  const started=Date.now(),record={status:'planned',argv:run.argv,cwd:run.root,started,timeout:run.timeout};
  const save=()=>fs.writeFile(path.join(run.directory,run.id+'.command.json'),JSON.stringify(record,null,2));
  await save();
  const stdout=await fs.open(path.join(run.directory,run.id+'.stdout.log'),'wx'),stderr=await fs.open(path.join(run.directory,run.id+'.stderr.log'),'wx');
  const owned=new Map();let child,timer,forced,cancelled=false,timedOut=false;
  const signal=kind=>{
    if(!child?.pid)return;
    const kill=pid=>{try{process.kill(pid,kind);}catch(error){if(error.code!=='ESRCH')throw error;}};kill(-child.pid);
    const rows=(spawnSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).stdout||'').split('\n').map(line=>line.trim().match(/^(\d+)\s+(.*)$/)).filter(Boolean);
    for(const [,pid,command] of rows)if(owned.get(Number(pid))?.command===command)kill(Number(pid));
  };
  const stop=()=>{cancelled=true;sample();signal('SIGTERM');forced??=setTimeout(()=>signal('SIGKILL'),5000);};
  const sample=()=>{
    if(!child?.pid)return;
    const output=spawnSync('ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).stdout||'';
    const rows=output.split('\n').map(line=>line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(([,pid,ppid,command])=>({pid:Number(pid),ppid:Number(ppid),command}));
    const ids=new Set([child.pid]);let grew=true;
    while(grew){grew=false;for(const row of rows)if(ids.has(row.ppid)&&!ids.has(row.pid)){ids.add(row.pid);grew=true;}}
    for(const row of rows)if(ids.has(row.pid))owned.set(row.pid,row);
  };
  const monitor=setInterval(sample,1000);process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    child=spawn(run.argv[0],run.argv.slice(1),{cwd:run.root,env:{...process.env,...run.env},stdio:['ignore',stdout.fd,stderr.fd],detached:true});
    const result=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
    record.pid=child.pid;record.status='running';sample();await save();
    timer=setTimeout(()=>{timedOut=true;stop();},run.timeout);
    Object.assign(record,await result,{status:'closed',ended:Date.now(),cancelled,timedOut});return record;
  }finally{
    clearInterval(monitor);clearTimeout(timer);clearTimeout(forced);signal('SIGKILL');
    process.off('SIGINT',stop);process.off('SIGTERM',stop);
    await stdout.close();await stderr.close();record.ownedProcesses=[...owned.values()];
    for(let attempt=0;attempt<30;attempt++){
      const inspection=spawnSync('ps',['-axo','pid=,stat=,command='],{encoding:'utf8'});if(inspection.status!==0)throw Error('Process cleanup inspection failed');
      const rows=(inspection.stdout||'').split('\n').map(line=>line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/)).filter(Boolean);
      record.remainingOwned=rows.filter(([,pid,state,command])=>!state.startsWith('Z')&&owned.get(Number(pid))?.command===command).map(([,pid,state,command])=>({pid:Number(pid),state,command}));
      if(!record.remainingOwned.length)break;await new Promise(resolve=>setTimeout(resolve,100));
    }
    await save();if(record.remainingOwned.length)throw Error('Owned child process remained after cleanup');
  }
}
export async function runPlaywright(run){
  const report=path.join(run.directory,'playwright.json'),inventoryFile=path.join(run.directory,'inventory.json');
  await fs.writeFile(path.join(run.directory,'child.log'),'');
  const config=run.config||path.join(run.root,'tests/game/playwright.config.mjs');
  const args=[process.execPath,path.join(run.root,'node_modules/@playwright/test/cli.js'),'test','--config',config,...run.engines.map(e=>`--project=${e}`),'--fail-on-flaky-tests',...(run.grep?['--grep',run.grep]:[])];
  const env={...run.env,SGG_CASE_ENGINES:[...run.engines].sort().join(','),SGG_RUN_ID:run.runId,SGG_CASE_MATCH:run.testMatch,SGG_REPORT:report,PLAYWRIGHT_JSON_OUTPUT_FILE:report,SGG_OUTPUT_DIR:path.join(run.directory,'artifacts')};
  const listing=await runCommand({root:run.root,directory:run.directory,id:'inventory',argv:[...args,'--list','--reporter=json'],env:{...env,SGG_REPORT:inventoryFile,PLAYWRIGHT_JSON_OUTPUT_FILE:inventoryFile},timeout:30000});
  await fs.writeFile(path.join(run.directory,'child.log'),Buffer.concat([await fs.readFile(path.join(run.directory,'inventory.stdout.log')),await fs.readFile(path.join(run.directory,'inventory.stderr.log'))]));
  if(listing.code!==0||listing.signal||listing.timedOut||listing.cancelled)throw Error('Inventory child failed');
  const inventory=JSON.parse(await fs.readFile(inventoryFile,'utf8'));
  const wanted=reportCases(inventory).map(r=>identityKey(r.identity)).sort();
  if(!wanted.length||new Set(wanted).size!==wanted.length)throw Error('Zero or duplicate inventory');
  const child=await runCommand({root:run.root,directory:run.directory,id:'child',argv:args,env,timeout:caseBudget(run.testMatch,run.engines)+10000});
  await fs.writeFile(path.join(run.directory,'child.log'),Buffer.concat([await fs.readFile(path.join(run.directory,'child.stdout.log')),await fs.readFile(path.join(run.directory,'child.stderr.log'))]));
  if(child.signal||child.timedOut||child.cancelled)throw Error('Child cancelled or timed out');
  const parsed=JSON.parse(await fs.readFile(report,'utf8'));
  if(parsed.config?.version!=='1.61.1')throw Error('Locked Playwright version mismatch');
  const result=verifyReport(parsed,{...run,started:child.started,exitCode:child.code});
  const actual=reportCases(parsed).map(r=>identityKey(r.identity)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted))throw Error('Completed inventory differs from listed cases');
  return {exitCode:child.code,runtime:{node:process.version,playwright:parsed.config.version,projects:parsed.config.projects.map(p=>({name:p.name,id:p.id}))},...result,started:child.started,ended:child.ended,listingStarted:listing.started,listingEnded:listing.ended,command:child.argv,reportPath:report,inventoryPath:inventoryFile,childRecordPath:path.join(run.directory,'child.command.json'),listingRecordPath:path.join(run.directory,'inventory.command.json'),identities:actual};
}
