import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {check} from './io.mjs';
export function checked(file){
  let current=path.parse(file).root;
  for(const part of file.slice(current.length).split('/').filter(Boolean)){
    current=path.join(current,part);
    try{check(!fs.lstatSync(current).isSymbolicLink(),'publication symlink boundary');}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return file;
}
export function durable(file,body){
  const fd=fs.openSync(checked(file),'wx',0o600);
  try{fs.writeFileSync(fd,body);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function owner(file,target){
  const stat=fs.statSync(checked(file));check(stat.isFile()&&stat.size<2048,'invalid publication owner');
  const row=JSON.parse(fs.readFileSync(file,'utf8'));
  check(Object.keys(row).sort().join(',')==='pid,target,token,version'&&row.version===1&&row.target===target&&Number.isSafeInteger(row.pid)&&row.pid>0&&/^[a-f0-9-]{36}$/.test(row.token),'invalid publication owner');return row;
}
function running(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;if(e.code==='EPERM')return true;throw e;}}
export function acquire(target){
  const directory=checked(target+'.game-build-lock'),record={version:1,target,pid:process.pid,token:randomUUID()};
  fs.mkdirSync(path.dirname(directory),{recursive:true});
  try{fs.mkdirSync(directory,{mode:0o700});durable(directory+'/owner.json',JSON.stringify(record));}
  catch(e){if(e.code!=='EEXIST')throw e;}
  function chain(){
    const rows=[owner(directory+'/owner.json',target)];
    while(fs.existsSync(checked(directory+'/claim-'+rows.at(-1).token+'.json'))){
      check(rows.length<1000,'publication owner chain limit');rows.push(owner(directory+'/claim-'+rows.at(-1).token+'.json',target));
    }
    return rows;
  }
  let rows=chain();
  while(rows.at(-1).token!==record.token){
    check(!running(rows.at(-1).pid),'output writer is active');
    try{durable(directory+'/claim-'+rows.at(-1).token+'.json',JSON.stringify(record));}
    catch(e){if(e.code!=='EEXIST')throw e;}
    rows=chain();
  }
  function assertOwned(){check(chain().at(-1).token===record.token,'publication ownership changed');}
  return {target,directory,token:record.token,assertOwned,knownTokens:()=>chain().map(r=>r.token),remove(){
    assertOwned();
    for(const name of fs.readdirSync(checked(directory)))check(['owner.json','journal.json','journal.tmp','before','stage','restore'].includes(name)||/^claim-[a-f0-9-]{36}\.json$/.test(name),'unknown file in publication lock');
    fs.rmSync(directory,{recursive:true});
  }};
}
