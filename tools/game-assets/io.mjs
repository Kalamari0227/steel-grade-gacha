import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export class AssetError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.name='AssetError'; this.code=code; }
}
export function requireValue(condition, code, detail) { if (!condition) throw new AssetError(code, detail); }
export function relativePath(value) {
  requireValue(typeof value==='string' && /^[A-Za-z0-9_./:-]+$/.test(value) && !value.includes(':') && !value.startsWith('/') && value.split('/').every(x=>x && x!=='.' && x!=='..'), 'unsafe-path', String(value));
  return value;
}
export async function safePath(root, relative) {
  relativePath(relative);
  let current=path.resolve(root);
  const rootStat=await fs.lstat(current);
  requireValue(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'unsafe-path', current);
  for(const part of relative.split('/')) {
    current=path.join(current,part);
    try { const stat=await fs.lstat(current); requireValue(!stat.isSymbolicLink(), 'unsafe-symlink', relative); }
    catch(error) { if(error.code!=='ENOENT') throw error; }
  }
  return current;
}
export async function readJson(file) {
  const data=await fs.readFile(file);
  requireValue(data.length>0 && data.length<=8*1024*1024,'json-size',file);
  return JSON.parse(data.toString('utf8'));
}
export function exactKeys(value, keys, label) {
  requireValue(value && typeof value==='object' && !Array.isArray(value),'object',label);
  requireValue(JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort()),'fields',label);
}
export async function atomicJson(file, value) {
  const temp=`${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'}); await fs.rename(temp,file); }
  finally { await fs.rm(temp,{force:true}); }
}
export function parseArgs(argv, mode) {
  const flags=new Set(mode==='verify'?['--schema-only','--canonical']:[]);
  const values=new Set(['--root','--manifest','--review-root','--group','--report',...(mode==='verify'?['--case']:[])]);
  const options={};
  for(let i=0;i<argv.length;i++) {
    const key=argv[i]; requireValue((flags.has(key)||values.has(key)) && !(key in options),'option',key);
    if(flags.has(key)){options[key]=true;continue;}
    const value=argv[++i]; requireValue(typeof value==='string' && value.trim() && !value.startsWith('--'),'option-value',key);options[key]=value;
  }
  requireValue(options['--report'],'report-required','--report <path>');
  if(mode==='merge') requireValue(options['--group'],'group-required','--group <group>');
  if(options['--case']) {
    const family=options['--case']==='family-negative';
    const item=options['--case']==='item-negative';
    const part=options['--case']==='part-negative';
    const car=options['--case']==='car-negative';
    const validCase=car?options['--group']==='cars':part?['parts-body','parts-frame','parts-chassis'].includes(options['--group']):family?['poo','ssial','ga','wire-special'].includes(options['--group']):item?['items-portable','items-process'].includes(options['--group']):['schema-negative','identity-pilot-negative','environment-negative'].includes(options['--case'])&&!options['--group'];
    requireValue(validCase&&!options['--schema-only'],'case','car-negative requires cars; part-negative requires parts-body, parts-frame or parts-chassis; family-negative requires a character family; item-negative requires items-portable or items-process; other implemented negative cases are standalone');
  }
  if(options['--canonical']) requireValue(options['--group'] && !options['--schema-only'] && !options['--case'],'option-combination','canonical requires a group and full file/receipt validation');
  requireValue(!(options['--schema-only'] && options['--group']),'option-combination','schema-only does not finalize a group');
  return options;
}
