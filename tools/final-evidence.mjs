import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileRecord,fingerprint,hash} from './delivery-files.mjs';
import {canonical} from './game-build/io.mjs';
export function validateReferenceBindings(before,...comparisons){
 const after=comparisons.length?comparisons[0]:before;
 if(!before||JSON.stringify(Object.keys(before).sort())!==JSON.stringify(['education','original']))throw Error('Missing named reference bindings');
 for(const [role,row] of Object.entries(before)){
  if(row.role!==role||!path.isAbsolute(row.root||''))throw Error('Invalid named reference root');
  for(const [key,name] of [['index','index.html'],['sw','sw.js']])if(row[key]?.path!==path.join(row.root,name)||!Number.isSafeInteger(row[key]?.bytes)||row[key].bytes<=0||!/^[a-f0-9]{64}$/.test(row[key]?.sha256||''))throw Error('Invalid named reference artifact');
 }
 if(before.original.root===before.education.root||JSON.stringify(before)!==JSON.stringify(after))throw Error('Changed named reference bindings');
}
export async function readReferenceBindings({originalRoot=process.env.SGG_BASELINE_ROOT,educationRoot=process.env.SGG_EDUCATION_ROOT}={}){
 const rows={};
 for(const [role,root] of [['original',originalRoot],['education',educationRoot]]){
  if(!path.isAbsolute(root||'')||await fs.realpath(root)!==path.resolve(root))throw Error('Explicit named reference root required');
  rows[role]={role,root};for(const [key,name] of [['index','index.html'],['sw','sw.js']]){const file=path.join(root,name);rows[role][key]={path:file,...await fileRecord(file)};}
 }
 validateReferenceBindings(rows);return rows;
}
export async function readFrozenFrontier({root,start,testFile}){
 if(!start?.files?.length||fingerprint(start.files)!==start.fingerprintSHA256)throw Error('Invalid frozen start reference');
 const testPath=path.relative(root,testFile).split(path.sep).join('/');
 if(!testPath||testPath.startsWith('../')||path.isAbsolute(testPath))throw Error('Case outside frozen source root');
 const byPath=new Map(start.files.map(row=>[row.path,row])),names=['index.html','src/app_tpl.html','src/pwa_body.txt','sw.js',testPath];
 if(byPath.has('game-release.json')){
  const releaseBytes=await fs.readFile(path.join(root,'game-release.json'));
  if(hash(releaseBytes)!==byPath.get('game-release.json').sha256)throw Error('Changed response frontier: game-release.json');
  const release=JSON.parse(releaseBytes);if(!/^[a-f0-9]{64}$/.test(release.releaseId))throw Error('Invalid frontier release');
  names.push('game-release.json','manifest.webmanifest',`assets/game/${release.releaseId}/manifest.${hash(canonical(release))}.json`);
 }
 const frontier=[];
 for(const name of [...new Set(names)].sort()){
  const expected=byPath.get(name);if(!expected)throw Error('Missing frozen frontier row: '+name);
  const actual=await fileRecord(path.join(root,name));
  if(actual.sha256!==expected.sha256||actual.bytes!==expected.bytes)throw Error('Changed response frontier: '+name);
  frontier.push({path:name,...actual});
 }
 return frontier;
}
export function validateFrontierRecord(record,{start,frontier}){
 if(record.schema!==2||record.measurementScope!=='response-and-file-frontier'||record.frozenFingerprintReferenceSHA256!==start.fingerprintSHA256||record.fingerprintSHA256!==undefined||JSON.stringify(record.frontier)!==JSON.stringify(frontier))throw Error('Wrong response frontier measurement scope/reference/rows');
}
export async function captureFinalResponse(info,response,{root,kind='current'}){
 if(!process.env.SGG_FINAL_START)return;
 if(!response||!response.ok())throw Error('Missing successful actual document response');
 const start=JSON.parse(await fs.readFile(process.env.SGG_FINAL_START,'utf8'));
 const frontier=await readFrozenFrontier({root,start,testFile:info.file});
 const bytes=await response.body(),servedSHA256=hash(bytes);
 const byPath=new Map(frontier.map(row=>[row.path,row]));
 if(!['current','baseline','upgrade-current','education-reference'].includes(kind))throw Error('Unknown response role');
 let reference;
 if(kind==='education-reference'){
  validateReferenceBindings(start.references);reference=start.references.education;
  if(process.env.SGG_EDUCATION_ROOT!==reference.root)throw Error('Education reference root differs from frozen binding');
  for(const key of ['index','sw']){const actual=await fileRecord(reference[key].path);if(actual.bytes!==reference[key].bytes||actual.sha256!==reference[key].sha256)throw Error('Changed education reference artifact');}
  if(servedSHA256!==reference.index.sha256)throw Error('Actual education response is not frozen reference');
 }else if(kind!=='baseline'&&servedSHA256!==byPath.get('index.html').sha256)throw Error('Actual current response is not frozen index');
 const record={schema:2,measurementScope:'response-and-file-frontier',frontier,kind,runId:start.runId,caseId:info.testId,project:info.project.name,
  file:info.file,titlePath:info.titlePath,observedAt:new Date().toISOString(),url:response.url(),
  responseStatus:response.status(),servedSHA256,indexSHA256:byPath.get('index.html').sha256,
  frozenFingerprintReferenceSHA256:start.fingerprintSHA256,sourceSHA256:byPath.get('src/app_tpl.html').sha256,
  swSHA256:byPath.get('sw.js').sha256,testSHA256:byPath.get(path.relative(root,info.file).split(path.sep).join('/'))?.sha256,...(reference?{reference}:{} )};
 if(!record.testSHA256)throw Error('Case file missing from frozen inventory');
 if(!info.annotations.some(row=>row.type==='final-runtime-id'))info.annotations.push({type:'final-runtime-id',description:info.testId});
 const name=kind==='baseline'?'baseline-freeze-served':kind==='education-reference'?'education-reference-freeze-served':'final-freeze-served';
 const file=info.outputPath(name+'-'+randomUUID()+'.json');
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(record,null,2));
 await info.attach(name,{path:file,contentType:'application/json'});
 return record;
}
export async function attachScreenshot(page,info,name){
 const file=info.outputPath(name+'-'+randomUUID()+'.png');await page.screenshot({path:file});
 await info.attach(name,{path:file,contentType:'image/png'});
}
export function observeFinalDocuments(test,root,{kind='current'}={}){
 if(!['current','education-reference'].includes(kind))throw Error('Unknown document observer role');
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
  if(kind==='education-reference')validateReferenceBindings(start.references);
  const expected=kind==='education-reference'?start.references.education.index.sha256:start.files.find(row=>row.path==='index.html').sha256;
  let current;
  for(const row of documents.get(page)||[]){const result=await row.body;if(result.bytes&&hash(result.bytes)===expected)current={row,bytes:result.bytes};}
  if(!current)return; // Baseline-only or deliberately offline-first scenarios cannot substantiate current feature proofs.
  const response={ok:()=>true,url:()=>current.row.url,status:()=>current.row.status,body:async()=>current.bytes};
  await captureFinalResponse(info,response,{root,kind:kind==='education-reference'?kind:'upgrade-current'});
 });
}
