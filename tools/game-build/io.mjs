import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const canonical=value=>JSON.stringify(value && typeof value==='object' ? Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
export function check(ok,message){if(!ok)throw Error(message);}
export function relative(name){check(typeof name==='string'&&/^[\w./-]+$/.test(name)&&!name.startsWith('/')&&name.split('/').every(p=>p&&p!=='.'&&p!=='..'),'unsafe path');return name;}
export async function boundary(target){
  const absolute=path.resolve(target);let current=path.parse(absolute).root;
  for(const part of absolute.slice(current.length).split('/').filter(Boolean)){
    current=path.join(current,part);
    try{const stat=await fs.lstat(current);check(!stat.isSymbolicLink(),'symlink boundary');}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return absolute;
}
export async function read(root,name){
  const file=await boundary(path.join(root,relative(name))),stat=await fs.stat(file);
  check(stat.isFile()&&stat.size>0&&stat.size<=64*1024*1024,`invalid file: ${name}`);return fs.readFile(file);
}
export async function json(root,name){return JSON.parse((await read(root,name)).toString());}
export async function write(root,name,body){
  const file=await boundary(path.join(root,relative(name)));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,body,{flag:'wx'});
}
export async function exists(file){try{await fs.lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
export async function replaceDirectory(stage,target){
  await boundary(target);const backup=target+'.previous-'+randomUUID();let moved=false;
  try{if(await exists(target)){await fs.rename(target,backup);moved=true;}await fs.rename(stage,target);}
  catch(e){if(moved)await fs.rename(backup,target);throw e;}
  if(moved)await fs.rm(backup,{recursive:true});
}
export function args(argv,mode){
  const result={};const flags=mode==='build'?['--fixture']:['--verify'];
  for(let i=0;i<argv.length;i++){
    const key=argv[i];check(!Object.hasOwn(result,key)&&[...flags,'--root','--out','--report',...(mode==='package'?['--case']:[])].includes(key),'unknown/duplicate option');
    result[key]=flags.includes(key)?true:argv[++i];check(result[key]&&!String(result[key]).startsWith('--'),'missing option value');
  }
  if(result['--case'])check(['missing-release-entry','hash-mismatch','temp-failure'].includes(result['--case']),'unknown package negative case');
  return result;
}
