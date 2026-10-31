import fs from 'node:fs';
import path from 'node:path';
import {setImmediate as checkpoint} from 'node:timers/promises';
import {check,sha} from './io.mjs';
import {acquire,checked,durable} from './publication-lease.mjs';
const active=new Set();
const shell=new Set(['index.html','game-release.json','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png']);
function bytes(file){
  checked(file);if(!fs.existsSync(file))return null;
  const stat=fs.statSync(file);check(stat.isFile()&&stat.size<=64*1024*1024,'invalid publication file');return fs.readFileSync(file);
}
const digest=body=>body===null?null:sha(body);
function allowed(name){return shell.has(name)||/^webtoon\/[\w-]+\.webp$/.test(name);}
function rollback(lease){
  lease.assertOwned();const body=bytes(lease.directory+'/journal.json');if(body===null)return;
  const journal=JSON.parse(body.toString());
  check(Object.keys(journal).sort().join(',')==='rows,target,token,version'&&journal.version===1&&journal.target===lease.target&&lease.knownTokens().includes(journal.token)&&Array.isArray(journal.rows)&&journal.rows.length<=25,'invalid publication journal');
  const seen=new Set(),restore=[];
  // Validate the complete recovery set before touching any destination, including user edits.
  for(const [index,row] of journal.rows.entries()){
    check(Object.keys(row).sort().join(',')==='after,before,name'&&allowed(row.name)&&!seen.has(row.name)&&/^[a-f0-9]{64}$/.test(row.after)&&(row.before===null||/^[a-f0-9]{64}$/.test(row.before)),'invalid publication row');seen.add(row.name);
    const backup=bytes(lease.directory+'/before/'+index),current=digest(bytes(path.join(lease.target,row.name)));
    check(digest(backup)===row.before,'publication backup SHA mismatch');
    check(current===row.before||current===row.after,'publication conflict: '+row.name);
    restore.push({row,backup,current});
  }
  fs.mkdirSync(checked(lease.directory+'/restore'),{recursive:true});
  for(const [index,{row,backup,current}] of restore.entries()){
    if(current===row.before)continue;
    const target=checked(path.join(lease.target,row.name));
    if(backup===null)fs.unlinkSync(target);
    else{
      const temporary=checked(lease.directory+'/restore/'+index);fs.writeFileSync(temporary,backup,{mode:0o600});fs.chmodSync(temporary,fs.statSync(lease.directory+'/before/'+index).mode&0o777);fs.renameSync(temporary,target);
    }
  }
  fs.unlinkSync(lease.directory+'/journal.json');
}
function stop(signal){
  let failed=false;
  for(const transaction of [...active])try{transaction.close();}catch(error){failed=true;process.stderr.write(JSON.stringify({status:'FAIL',error:error.message,recoveryRequired:true})+'\n');}
  process.stderr.write(JSON.stringify({status:'FAIL',error:'build cancelled',signal,recoveryRequired:failed})+'\n');
  process.exit(signal==='SIGINT'?130:143);
}
const interrupt=()=>stop('SIGINT'),terminate=()=>stop('SIGTERM');
export function openPublication(target){
  const lease=acquire(target),stage=lease.directory+'/stage';let initial;
  const transaction={stage,close(){
    rollback(lease);lease.remove();active.delete(transaction);
    if(!active.size){process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);}
  },async publish(release){
    lease.assertOwned();
    for(const [name,expected] of Object.entries(initial))check(digest(bytes(path.join(target,name)))===expected,'output changed during build: '+name);
    const prefix=`assets/game/${release.releaseId}`,destination=checked(path.join(target,prefix));
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    if(fs.existsSync(destination)){
      for(const name of fs.readdirSync(stage+'/'+prefix))check(digest(bytes(destination+'/'+name))===digest(bytes(stage+'/'+prefix+'/'+name)),'immutable release collision');
    }else fs.renameSync(stage+'/'+prefix,destination);
    const stable=release.files.filter(r=>!r.path.startsWith('assets/')&&r.path!=='index.html').map(r=>r.path).concat(['game-release.json','index.html']);
    check(stable.every(allowed)&&new Set(stable).size===stable.length,'invalid publication entries');
    const rows=[],expected=[];fs.mkdirSync(checked(lease.directory+'/before'),{recursive:true});
    for(const name of stable){
      const old=bytes(path.join(target,name)),next=bytes(stage+'/'+name);check(next!==null,'publication stage missing');
      expected.push({name,sha256:sha(next)});if(digest(old)===sha(next))continue;
      const row={name,before:digest(old),after:sha(next)};if(old!==null){const backup=lease.directory+'/before/'+rows.length;durable(backup,old);fs.chmodSync(backup,fs.statSync(path.join(target,name)).mode&0o777);}rows.push(row);
    }
    durable(lease.directory+'/journal.tmp',JSON.stringify({version:1,target,token:lease.token,rows}));
    fs.renameSync(lease.directory+'/journal.tmp',lease.directory+'/journal.json');
    for(const row of rows){
      lease.assertOwned();const output=checked(path.join(target,row.name));
      check(digest(bytes(output))===row.before,'publication conflict: '+row.name);
      fs.mkdirSync(path.dirname(output),{recursive:true});fs.renameSync(checked(stage+'/'+row.name),output);
      // There is no pending filesystem mutation when a termination signal can run.
      await checkpoint();
    }
    for(const row of expected)check(digest(bytes(path.join(target,row.name)))===row.sha256,'publication conflict: '+row.name);
    fs.unlinkSync(lease.directory+'/journal.json');
  }};
  if(!active.size){process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);}active.add(transaction);
  try{
    rollback(lease);
    const mutable=[...shell,...Object.keys(JSON.parse(fs.readFileSync(new URL('./comics.json',import.meta.url),'utf8')))];
    initial=Object.fromEntries(mutable.map(name=>[name,digest(bytes(path.join(target,name)))]));
    for(const name of ['before','stage','restore','journal.tmp'])fs.rmSync(checked(lease.directory+'/'+name),{recursive:true,force:true});
    fs.mkdirSync(stage);return transaction;
  }catch(error){active.delete(transaction);if(!active.size){process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);}throw error;}
}
