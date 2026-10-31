import fs from 'node:fs';
import path from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip,createGunzip} from 'node:zlib';
import {check,read,sha,member,within,checked,LIMITS} from './paths.mjs';
const BLOCK=512;
export function header(name,size,type='0'){
  member(name);const h=Buffer.alloc(BLOCK);let prefix='',tail=name;
  while(Buffer.byteLength(tail)>100){const i=tail.indexOf('/');check(i>=0,'tar name too long');prefix+=(prefix?'/':'')+tail.slice(0,i);tail=tail.slice(i+1);}
  check(Buffer.byteLength(prefix)<=155,'tar prefix too long');h.write(tail,0,100);h.write('0000600\0',100);h.write('0000000\0',108);h.write('0000000\0',116);h.write(size.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h.write(type,156);h.write('ustar\0',257);h.write('00',263);h.write(prefix,345,155);h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);return h;
}
export async function createTar(inventory,target){
  async function* blocks(){for(const row of [...inventory.files,{path:'source-materials/source-manifest.json',body:inventory.manifest}]){const body=row.body||read(row.source);if(row.sha256)check(sha(body)===row.sha256,'stale input: '+row.path);yield header(row.path,body.length);yield body;const pad=(BLOCK-body.length%BLOCK)%BLOCK;if(pad)yield Buffer.alloc(pad);}yield Buffer.alloc(BLOCK*2);}
  await pipeline(Readable.from(blocks()),createGzip({level:1}),fs.createWriteStream(checked(target),{flags:'wx',mode:0o600}));
}
export async function expandTar(archive,raw){
  let total=0;const bound=new Transform({transform(chunk,encoding,callback){total+=chunk.length;if(total>LIMITS.total)callback(new Error('archive expanded size limit'));else callback(null,chunk);}});
  await pipeline(fs.createReadStream(checked(archive)),createGunzip(),bound,fs.createWriteStream(checked(raw),{flags:'wx',mode:0o600}));
}
const field=(h,start,size)=>{const b=h.subarray(start,start+size),zero=b.indexOf(0);if(zero>=0)check(b.subarray(zero).every(v=>v===0),'invalid tar string padding');const v=b.subarray(0,zero<0?b.length:zero);check(Buffer.from(v.toString()).equals(v),'invalid tar UTF8');return v.toString();};
const octal=(h,start,size)=>{const value=h.toString('ascii',start,start+size).replace(/[\0 ]+$/,'').trim();check(/^[0-7]+$/.test(value),'invalid tar number');const n=parseInt(value,8);check(Number.isSafeInteger(n),'invalid tar integer');return n;};
export function inspectTar(raw){
  const fd=fs.openSync(checked(raw),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW),rows=[],names=new Set();let offset=0,ended=false;
  try{
    const size=fs.fstatSync(fd).size;check(size<=LIMITS.total&&size%BLOCK===0,'invalid tar size');
    while(offset<size){const h=Buffer.alloc(BLOCK);check(fs.readSync(fd,h,0,BLOCK,offset)===BLOCK,'truncated header');
      if(h.every(v=>v===0)){check(size-offset>=BLOCK*2,'missing tar terminator');const rest=Buffer.alloc(65536);for(let at=offset;at<size;at+=rest.length){const n=fs.readSync(fd,rest,0,Math.min(rest.length,size-at),at);check(rest.subarray(0,n).every(v=>v===0),'data after tar terminator');}ended=true;break;}
      const expected=octal(h,148,8),copy=Buffer.from(h);copy.fill(32,148,156);check([...copy].reduce((a,b)=>a+b,0)===expected,'tar checksum mismatch');
      check(h.toString('ascii',257,263)==='ustar\0'&&h.toString('ascii',263,265)==='00','unsupported tar format');
      check(h[156]===48&&field(h,157,100)===''&&octal(h,100,8)===0o600,'links/devices/nonregular tar entry');
      const prefix=field(h,345,155),name=member((prefix?prefix+'/':'')+field(h,0,100)),fold=name.normalize('NFC').toLowerCase();check(!names.has(fold),'duplicate/case-collision tar entry: '+name);names.add(fold);
      const bytes=octal(h,124,12);check(bytes<=LIMITS.file&&rows.length<LIMITS.entries,'tar file/count limit');check(offset+BLOCK+Math.ceil(bytes/BLOCK)*BLOCK<=size,'truncated tar file');
      rows.push({path:name,offset:offset+BLOCK,bytes});offset+=BLOCK+Math.ceil(bytes/BLOCK)*BLOCK;
    }
    check(ended&&rows.length>0,'empty/unterminated tar');for(const row of rows){const segments=row.path.normalize('NFC').toLowerCase().split('/');for(let i=1;i<segments.length;i++)check(!names.has(segments.slice(0,i).join('/')),'tar file/directory collision');}return rows;
  }finally{fs.closeSync(fd);}
}
export function extractTar(raw,target){
  checked(target);check(!fs.existsSync(target)||fs.readdirSync(target).length===0,'restore target must be empty');
  const rows=inspectTar(raw); // No destination writes until every member has passed.
  for(const row of rows){const output=within(target,row.path);check(!fs.existsSync(output),'restore destination exists');}
  const fd=fs.openSync(checked(raw),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{fs.mkdirSync(target,{recursive:true});for(const row of rows){const output=within(target,row.path);fs.mkdirSync(path.dirname(output),{recursive:true});checked(output);const body=Buffer.alloc(row.bytes);check(fs.readSync(fd,body,0,row.bytes,row.offset)===row.bytes,'truncated payload');fs.writeFileSync(output,body,{flag:'wx',mode:0o600});}}finally{fs.closeSync(fd);}
  return rows;
}
