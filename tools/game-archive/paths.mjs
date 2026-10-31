import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const LIMITS={file:128*1024*1024,total:2*1024*1024*1024,entries:20000};
export function check(ok,message){if(!ok)throw new Error(message);}
export const sha=body=>createHash('sha256').update(body).digest('hex');
export const json=body=>JSON.parse(body.toString());
export const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
export function member(name){
  check(typeof name==='string'&&name.length>0&&!/[\\\x00-\x1f:]/.test(name)&&!name.startsWith('/')&&name.split('/').every(p=>p&&p!=='.'&&p!=='..'),'path-escape: '+name);
  check(Buffer.byteLength(name)<=255,'member name too long');return name;
}
export function checked(file){
  const absolute=path.resolve(file);let current=path.parse(absolute).root;
  for(const segment of absolute.slice(current.length).split(path.sep)){
    current=path.join(current,segment);
    try{check(!fs.lstatSync(current).isSymbolicLink(),'symlink path: '+current);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return absolute;
}
export function within(root,name){member(name);const file=checked(path.join(root,name));check(file.startsWith(checked(root)+path.sep),'path-escape: '+name);return file;}
export function read(file){
  checked(file);check(fs.realpathSync(file)===path.resolve(file),'realpath containment failure: '+file);let fd;
  try{fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const stat=fs.fstatSync(fd);check(stat.isFile()&&stat.size<=LIMITS.file,'invalid or oversized regular file: '+file);return fs.readFileSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);}
}
export function digest(file){return sha(read(file));}
export function tree(root,extensions){
  const result=[];
  function visit(relative){for(const entry of fs.readdirSync(within(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative+'/'+entry.name;check(!entry.isSymbolicLink(),'symlink input: '+name);if(entry.isDirectory())visit(name);else{check(entry.isFile()&&extensions.includes(path.extname(name)),'unclassified input: '+name);result.push(name);}}}
  return {visit,result};
}
export function pointer(object,p){check(p.startsWith('/'),'invalid JSON pointer');return p.slice(1).split('/').reduce((value,key)=>value?.[key.replaceAll('~1','/').replaceAll('~0','~')],object);}
export function strings(value,callback,p='',parent=null,key=''){
  if(typeof value==='string')callback(value,p,parent,key);
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))strings(v,callback,p+'/'+k.replaceAll('~','~0').replaceAll('/','~1'),value,k);
}
export function fileHash(file){
  const hash=createHash('sha256'),fd=fs.openSync(file,fs.constants.O_RDONLY),buffer=Buffer.alloc(1024*1024);
  try{const stat=fs.fstatSync(fd);check(stat.isFile()&&stat.size<=LIMITS.total,'invalid archive size');let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));return hash.digest('hex');}finally{fs.closeSync(fd);}
}
export function validateMaster(root,row){const file=within(root,row.masterPath),body=read(file);check(sha(body)===row.masterSha256,'hash-mismatch: '+row.masterPath);return file;}
