import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {snapshot,hash} from './delivery-files.mjs';
import {validateFinalSuite} from './suite-evidence.mjs';
const [rootArg,outArg]=process.argv.slice(2);
if(!rootArg||!outArg)throw Error('Usage: node tools/final-suite.mjs APP E/final-run-new-directory');
const root=path.resolve(rootArg),out=path.resolve(outArg);
if(out===root||out.startsWith(root+path.sep))throw Error('Run evidence must be outside APP');
await fs.mkdir(out,{recursive:false});
const runId=crypto.randomUUID(),reportPath=path.join(out,'report.json'),inventoryPath=path.join(out,'inventory.json'),startPath=path.join(out,'start.json');
const initial=await snapshot(root),start={schema:1,runId,at:new Date().toISOString(),...initial};
await fs.writeFile(startPath,JSON.stringify(start,null,2));
const env={...process.env,SGG_FINAL_START:startPath,SGG_RUN_ID:runId,SGG_EVIDENCE_DIR:out,SGG_REPORT:reportPath};
async function execute(args,stdoutFile,stderrFile){
 const stdout=await fs.open(stdoutFile,'w'),stderr=await fs.open(stderrFile,'w');
 try{return await new Promise((resolve,reject)=>{
  const child=spawn('npm',['--silent','test','--',...args],{cwd:root,env,stdio:['ignore',stdout.fd,stderr.fd]});
  child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));
 });}finally{await stdout.close();await stderr.close();}
}
let exitCode=-1;
try{
 const listed=await execute(['--project=chromium','--project=webkit','--list','--reporter=json'],inventoryPath,path.join(out,'list.stderr.log'));
 if(listed.code!==0)throw Error('Final inventory listing failed');
 const result=await execute(['--project=chromium','--project=webkit'],path.join(out,'run.stdout.log'),path.join(out,'run.stderr.log'));
 exitCode=result.code??-1;
 const end={at:new Date().toISOString(),...await snapshot(root)};
 const reportBytes=await fs.readFile(reportPath),inventoryBytes=await fs.readFile(inventoryPath);
 const run={schema:1,runId,root,status:exitCode===0?'passed':'failed',exitCode,start,end,reportPath,inventoryPath,
  reportSHA256:hash(reportBytes),inventorySHA256:hash(inventoryBytes),command:['npm','test','--','--project=chromium','--project=webkit']};
 await fs.writeFile(path.join(out,'run.json'),JSON.stringify(run,null,2));
 validateFinalSuite({report:JSON.parse(reportBytes),inventory:JSON.parse(inventoryBytes),run,files:end.files,reportBytes,inventoryBytes});
}catch(error){
 await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({runId,exitCode,message:error.message,at:new Date().toISOString()},null,2));
 process.exitCode=1;throw error;
}
