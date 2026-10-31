import fs from 'node:fs/promises';
import path from 'node:path';
import {check,sha,canonical,read,json,write,boundary,exists,replaceDirectory} from './io.mjs';
export async function verifyPackage(root){
  const release=await json(root,'game-release.json');
  check(release.schemaVersion===1&&release.edition==='game'&&typeof release.syntheticFixture==='boolean','release schema');
  check(/^[a-f0-9]{64}$/.test(release.releaseId),'release ID');
  check(release.releaseId===sha(canonical({schemaVersion:1,syntheticFixture:release.syntheticFixture,inputs:release.inputs})),'release input identity');
  const prefix=`assets/game/${release.releaseId}/`,manifestPath=prefix+`manifest.${sha(canonical(release))}.json`;
  check((await read(root,manifestPath)).toString()===canonical(release),'immutable manifest mismatch');
  check(Array.isArray(release.files)&&release.files.length>200,'release entries');
  const names=new Set();
  for(const row of release.files){
    check(!names.has(row.path)&&['critical','optional'].includes(row.classification),'duplicate/invalid release entry');names.add(row.path);
    const bytes=await read(root,row.path);check(bytes.length===row.bytes&&sha(bytes)===row.sha256,'release file SHA/size');
    if(row.path.startsWith('assets/'))check(row.path.startsWith(prefix)&&path.basename(row.path).includes(row.sha256),'immutable content path');
  }
  const comics=await json(path.resolve(import.meta.dirname,'../..'),'tools/game-build/comics.json');
  check(canonical(release.files.filter(r=>r.path.startsWith('webtoon/')).map(r=>r.path).sort())===canonical(Object.keys(comics).sort()),'exact comic entries');
  for(const [name,expected] of Object.entries(comics))check(sha(await read(root,name))===expected,'original comic mismatch');
  for(const name of ['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'])check(names.has(name),'missing shell entry');
  const index=(await read(root,'index.html')).toString();
  check(index.includes(`data-game-release="${release.releaseId}"`)&&index.includes(`data-game-fixture="${release.syntheticFixture}"`),'index release binding');
  check((await read(root,'sw.js')).toString().includes(release.releaseId),'SW release binding');
  check(!/\/Users\/|\/home\/|file:\/\/\/|src\/uiimg\//.test(index),'runtime source path');
  const declared=[...index.matchAll(/assets\/game\/[\w/.-]+/g)].map(m=>m[0]);
  for(const url of declared)check(names.has(url),'undeclared runtime URL');
  return {release,manifestPath};
}
export async function packageGame(source,target,fault){
  await boundary(source);await boundary(target);
  check(target!==source&&!target.startsWith(source+path.sep)&&!source.startsWith(target+path.sep),'package output overlaps source');
  if(await exists(target)){
    check(await exists(path.join(target,'game-release.json')),'refuse unrelated output directory');await verifyPackage(target);
  }
  const {release,manifestPath}=await verifyPackage(source);
  await fs.mkdir(path.dirname(target),{recursive:true});
  const stage=await fs.mkdtemp(path.join(path.dirname(target),'.game-package-'));
  try{
    if(fault?.kind==='owned-copy-obstruction'){check(path.dirname(target)===fault.owner,'fault owner boundary');await fs.mkdir(path.join(stage,'index.html'));fault.reached=true;}
    for(const name of [...release.files.map(r=>r.path),'game-release.json',manifestPath])await write(stage,name,await read(source,name));
    await verifyPackage(stage);
    const current=await verifyPackage(source);check(canonical(current.release)===canonical(release),'source changed during copy');
    await replaceDirectory(stage,target);
  }finally{await fs.rm(stage,{recursive:true,force:true});}
  return {status:'PASS',releaseId:release.releaseId,syntheticFixture:release.syntheticFixture,files:release.files.length,indexSHA:release.files.find(r=>r.path==='index.html').sha256};
}
export async function packageFiles(root){
 const rows=[];
 async function visit(relative=''){
  for(const entry of (await fs.readdir(path.join(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const name=path.posix.join(relative,entry.name);check(!entry.isSymbolicLink(),'package symlink');
   if(entry.isDirectory())await visit(name);else{check(entry.isFile(),'nonregular package file');const bytes=await read(root,name);rows.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
  }
 }await visit();check(rows.length>0,'empty package inventory');return rows;
}
export async function packageNegative({source,target,name}){
 check(['missing-release-entry','hash-mismatch','temp-failure'].includes(name),'unknown package negative case');
 await boundary(source);await boundary(target);check(source!==target&&!target.startsWith(source+path.sep)&&!source.startsWith(target+path.sep),'negative overlap');
 const checked=await verifyPackage(source),prior=await verifyPackage(target);
 check(!checked.release.syntheticFixture&&!prior.release.syntheticFixture,'negative requires real normal packages');
 const before=await packageFiles(target),sourceBefore=await packageFiles(source),owner=await fs.mkdtemp(path.join(path.dirname(target),'.package-negative-'));
 const input=path.join(owner,'source'),output=path.join(owner,'previous');let result;
 try{
  await packageGame(source,input);await packageGame(target,output);const previous=await packageFiles(output);
  const victim=checked.release.files.find(r=>r.path==='index.html').path,fault={kind:'owned-copy-obstruction',owner,reached:false};
  if(name==='missing-release-entry')await fs.unlink(path.join(input,victim));
  if(name==='hash-mismatch'){const bytes=await read(input,victim);bytes[0]^=1;await fs.writeFile(path.join(input,victim),bytes);}
  let failure;try{await packageGame(input,output,name==='temp-failure'?fault:undefined);}catch(error){failure={message:error.message,code:error.code||null};}
  check(failure,'negative unexpectedly succeeded');
  check(name==='missing-release-entry'?failure.code==='ENOENT':name==='hash-mismatch'?failure.message.includes('release file SHA/size'):fault.reached&&['EISDIR','EEXIST'].includes(failure.code),'negative missed intended boundary');
  const after=await packageFiles(output),residue=(await fs.readdir(owner)).filter(n=>n.startsWith('.game-package-')||n.startsWith('previous.previous-'));
  check(canonical(previous)===canonical(after)&&residue.length===0,'previous package changed or stage leaked');
  result={status:'EXPECTED_REJECTION',case:name,failure,reached:true,source,target,owner,previous,after,residue};
 }finally{await fs.rm(owner,{recursive:true,force:true});}
 check(canonical(before)===canonical(await packageFiles(target))&&canonical(sourceBefore)===canonical(await packageFiles(source)),'caller source/target changed');
 return {...result,callerPreserved:true,ownedRemoved:!await exists(owner)};
}
