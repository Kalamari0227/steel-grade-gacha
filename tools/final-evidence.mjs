import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {snapshot,hash} from './delivery-files.mjs';
export async function captureFinalResponse(info,response,{root,kind='current'}){
 if(!process.env.SGG_FINAL_START)return;
 if(!response||!response.ok())throw Error('Missing successful actual document response');
 const start=JSON.parse(await fs.readFile(process.env.SGG_FINAL_START,'utf8'));
 const current=await snapshot(root);
 if(current.fingerprintSHA256!==start.fingerprintSHA256)throw Error('Case inputs changed since final run start');
 const bytes=await response.body(),servedSHA256=hash(bytes);
 const byPath=new Map(current.files.map(row=>[row.path,row]));
 if(!['current','baseline','upgrade-current'].includes(kind))throw Error('Unknown response role');
 if(kind!=='baseline'&&servedSHA256!==byPath.get('index.html').sha256)throw Error('Actual current response is not frozen index');
 const record={schema:1,kind,runId:start.runId,caseId:info.testId,project:info.project.name,
  file:info.file,titlePath:info.titlePath,observedAt:new Date().toISOString(),url:response.url(),
  responseStatus:response.status(),servedSHA256,indexSHA256:byPath.get('index.html').sha256,
  fingerprintSHA256:current.fingerprintSHA256,sourceSHA256:byPath.get('src/app_tpl.html').sha256,
  swSHA256:byPath.get('sw.js').sha256,testSHA256:byPath.get(path.relative(root,info.file).split(path.sep).join('/'))?.sha256};
 if(!record.testSHA256)throw Error('Case file missing from frozen inventory');
 if(!info.annotations.some(row=>row.type==='final-runtime-id'))info.annotations.push({type:'final-runtime-id',description:info.testId});
 const name=kind==='baseline'?'baseline-freeze-served':'final-freeze-served';
 const file=info.outputPath(name+'-'+randomUUID()+'.json');
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(record,null,2));
 await info.attach(name,{path:file,contentType:'application/json'});
 return record;
}
export async function attachScreenshot(page,info,name){
 const file=info.outputPath(name+'-'+randomUUID()+'.png');await page.screenshot({path:file});
 await info.attach(name,{path:file,contentType:'image/png'});
}
export function observeFinalDocuments(test,root){
 const documents=new WeakMap();
 test.beforeEach(async({page})=>{
  if(!process.env.SGG_FINAL_START)return;
  const rows=[];documents.set(page,rows);
  page.on('response',response=>{
   if(response.request().resourceType()==='document'&&response.ok()){
    const row={url:response.url(),status:response.status(),body:response.body().then(bytes=>({bytes}),error=>({error:error.message}))};rows.push(row);
   }
  });
 });
 test.afterEach(async({page},info)=>{
  if(!process.env.SGG_FINAL_START)return;
  const start=JSON.parse(await fs.readFile(process.env.SGG_FINAL_START,'utf8'));
  const expected=start.files.find(row=>row.path==='index.html').sha256;
  let current;
  for(const row of documents.get(page)||[]){const result=await row.body;if(result.bytes&&hash(result.bytes)===expected)current={row,bytes:result.bytes};}
  if(!current)return; // Baseline-only or deliberately offline-first scenarios cannot substantiate current feature proofs.
  const response={ok:()=>true,url:()=>current.row.url,status:()=>current.row.status,body:async()=>current.bytes};
  await captureFinalResponse(info,response,{root,kind:'upgrade-current'});
 });
}
