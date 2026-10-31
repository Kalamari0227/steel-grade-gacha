import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('decoder terminates a SIGTERM-ignoring child at the unchanged 15 second limit',async()=>{
  const evidence=path.resolve(process.env.DECODER_TEST_EVIDENCE||'.omo/evidence/decoder-timeout');
  const temporary=path.join(os.tmpdir(),'decoder-timeout-'+randomUUID());
  await fs.mkdir(evidence,{recursive:true});
  const record={temporary,command:[],pid:null,stubPid:null,watchdogTriggered:false,ports:[],status:'registered-before-creation'};
  const write=()=>fs.writeFile(path.join(evidence,'regression.json'),JSON.stringify(record,null,2)+'\n');
  await write();
  let child,timer;
  const terminate=()=>{try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}};
  const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
  try {
    await fs.mkdir(temporary);
    const pidFile=path.join(temporary,'stub.pid');
    const stub=`#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.on('SIGTERM',()=>{});process.stdin.resume();setInterval(()=>{},1000);\n`;
    await fs.writeFile(path.join(temporary,'ffprobe'),stub,{mode:0o755});
    const moduleUrl=new URL('../../tools/game-assets/images.mjs',import.meta.url).href;
    const root=fileURLToPath(new URL('../../',import.meta.url));
    const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-asset-manifest.json')));
    const input=path.join(root,manifest.assets.find(row=>row.status==='approved').path);
    const script=`import fs from 'node:fs';import {decode} from ${JSON.stringify(moduleUrl)};try{decode(fs.readFileSync(${JSON.stringify(input)}));process.exitCode=2;}catch(error){console.log(JSON.stringify({code:error.code,message:error.message}));process.exitCode=1;}`;
    record.command=[process.execPath,'--input-type=module','-e',script];
    const started=performance.now();
    child=spawn(record.command[0],record.command.slice(1),{detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:temporary+path.delimiter+process.env.PATH}});
    record.pid=child.pid;await write();
    let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
    timer=setTimeout(()=>{record.watchdogTriggered=true;terminate();},19000);
    const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(exit,signal)=>resolve({exit,signal}));});
    clearTimeout(timer);
    Object.assign(record,result,{durationMs:performance.now()-started,stdout,stderr,stubPid:Number(await fs.readFile(pidFile,'utf8'))});
    record.stubAlive=alive(record.stubPid);record.parentAlive=alive(record.pid);
    await write();
    assert.equal(record.watchdogTriggered,false,'decoder exceeded 15 seconds; outer watchdog had to kill its process group');
    assert.equal(result.exit,1);
    assert.equal(JSON.parse(stdout).code,'image-decode');
    assert.match(JSON.parse(stdout).message,/ETIMEDOUT/);
    assert.ok(record.durationMs>=14500&&record.durationMs<18000,`unexpected boundary ${record.durationMs}ms`);
    assert.equal(record.stubAlive,false);
    assert.equal(record.parentAlive,false);
  } finally {
    clearTimeout(timer);
    if(child)terminate();
    await fs.rm(temporary,{recursive:true,force:true});
    record.temporaryExistsAfter=await fs.access(temporary).then(()=>true,()=>false);
    record.status='cleaned';await write();
  }
});
