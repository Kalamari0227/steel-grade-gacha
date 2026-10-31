import fs from 'node:fs';
import path from 'node:path';
import {setImmediate as checkpoint} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {acquire,durable} from '../game-build/publication-lease.mjs';
import {check,checked,digest,json,read,fileHash} from './paths.mjs';
export const receiptPath=out=>out.replace(/\.tar\.gz$/,'.receipt.json');
export function openBundle(out){
  check(out.endsWith('.tar.gz'),'output must end .tar.gz');checked(path.dirname(out));
  const receipt=receiptPath(out),store=checked(out+'.bundle'),lease=acquire(store);
  const links=[[out,path.basename(store)+'/current/archive.tar.gz'],[receipt,path.basename(store)+'/current/receipt.json']];
  let generation,committed=false;const created=[];
  function validate(){
    for(const [file,target] of links){try{check(fs.lstatSync(file).isSymbolicLink()&&fs.readlinkSync(file)===target,'unrelated bundle output: '+file);}catch(e){if(e.code!=='ENOENT')throw e;}}
    if(fs.existsSync(store+'/current')){
      check(fs.lstatSync(store+'/current').isSymbolicLink(),'invalid bundle pointer');const name=fs.readlinkSync(store+'/current');check(/^generation-[a-f0-9-]{36}$/.test(name),'invalid bundle generation');checked(store+'/'+name);
      const r=json(read(store+'/'+name+'/receipt.json'));check(r.archiveSHA===fileHash(store+'/'+name+'/archive.tar.gz'),'prior archive receipt mismatch');
      check(links.every(([file])=>fs.lstatSync(file).isSymbolicLink()),'incomplete bundle links');
    }
  }
  try{
    for(const token of lease.knownTokens()){
      const pending=store+'/next-'+token;
      if(fs.lstatSync(pending,{throwIfNoEntry:false})){
        check(fs.lstatSync(pending).isSymbolicLink(),'invalid pending generation');const name=fs.readlinkSync(pending);
        check(/^generation-[a-f0-9-]{36}$/.test(name),'invalid pending generation target');
        const current=fs.existsSync(store+'/current')?fs.readlinkSync(store+'/current'):null;
        if(name!==current)fs.rmSync(checked(store+'/'+name),{recursive:true,force:true});fs.unlinkSync(pending);
      }
    }
    validate();fs.rmSync(lease.directory+'/stage',{recursive:true,force:true});fs.mkdirSync(lease.directory+'/stage');fs.mkdirSync(store,{recursive:true});}
  catch(e){lease.remove();throw e;}
  const previous=fs.existsSync(store+'/current')?fs.readlinkSync(store+'/current'):null;
  const transaction={stage:lease.directory+'/stage',store,receipt,close(){
    if(!committed){for(const file of created)fs.unlinkSync(file);if(generation)fs.rmSync(store+'/'+generation,{recursive:true,force:true});}
    fs.rmSync(store+'/next-'+lease.token,{force:true});lease.remove();process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
  },async publish(){
    lease.assertOwned();validate();check((fs.existsSync(store+'/current')?fs.readlinkSync(store+'/current'):null)===previous,'stale bundle output');
    generation='generation-'+randomUUID();fs.renameSync(transaction.stage,store+'/'+generation);
    for(const [file,target] of links)if(!fs.existsSync(file)&&!fs.lstatSync(file,{throwIfNoEntry:false})){fs.symlinkSync(target,file);created.push(file);}
    fs.symlinkSync(generation,store+'/next-'+lease.token);
    await checkpoint();lease.assertOwned();
    fs.renameSync(store+'/next-'+lease.token,store+'/current');committed=true;
    try{const fd=fs.openSync(store,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}catch(cause){const error=new Error('archive committed; directory fsync failed: '+cause.message);error.committed=true;throw error;}
    return {out,receipt,generation,previousGeneration:previous};
  }};
  function stop(signal){try{transaction.close();}catch(error){console.error(JSON.stringify({status:'FAIL',error:error.message,recoveryRequired:true}));}console.error(JSON.stringify({status:'FAIL',error:'archive cancelled',signal}));process.exit(signal==='SIGINT'?130:143);}
  const interrupt=()=>stop('SIGINT'),terminate=()=>stop('SIGTERM');process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);return transaction;
}
export {durable};
