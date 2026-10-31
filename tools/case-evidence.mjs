import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {reportCases,identityKey,cleanCase} from './suite-evidence.mjs';
import {readFrozenFrontier,validateFrontierRecord,validateReferenceBindings} from './final-evidence.mjs';
export {reportCases};
export function validateServedRecord(served,{identity,annotations,run,frontier,files,baselineSHA,educationSHA}){
 validateFrontierRecord(served,{start:run.start,frontier});
 const byPath=new Map(files.map(row=>[row.path,row])),indexSHA256=byPath.get('index.html')?.sha256;
 let expected=served.kind==='baseline'?baselineSHA:indexSHA256;
 if(served.kind==='education-reference'){
  validateReferenceBindings(run.start.references);const reference=run.start.references.education;
  if(educationSHA!==reference.index.sha256||JSON.stringify(served.reference)!==JSON.stringify(reference))throw Error('Wrong education reference binding');expected=reference.index.sha256;
 }else if(served.reference!==undefined)throw Error('Reference metadata on non-reference role');
 if(!['current','upgrade-current','baseline','education-reference'].includes(served.kind)||served.indexSHA256!==indexSHA256||served.responseStatus!==200||served.servedSHA256!==expected)throw Error('Wrong served evidence');
 const runtimeIds=annotations.filter(row=>row.type==='final-runtime-id');
 if(runtimeIds.length!==1||!runtimeIds[0].description||served.caseId!==runtimeIds[0].description||served.runId!==run.runId||served.project!==identity.project||served.file!==identity.file||JSON.stringify(served.titlePath)!==JSON.stringify([...identity.suitePath,identity.title]))throw Error('Served case/run identity mismatch');
 const testPath=path.relative(run.root,identity.file).split(path.sep).join('/');
 if(served.sourceSHA256!==byPath.get('src/app_tpl.html')?.sha256||served.swSHA256!==byPath.get('sw.js')?.sha256||served.testSHA256!==byPath.get(testPath)?.sha256)throw Error('Served source/SW/test fingerprint mismatch');
 if(!Number.isFinite(Date.parse(served.observedAt))||Date.parse(served.observedAt)<Date.parse(run.start.at)||Date.parse(served.observedAt)>Date.parse(run.end.at))throw Error('Served observation outside final run');
}
export async function validateCaseProof({report,reportPath,proof,indexSHA256,run,files,ownership=new Map()}){
  const cases=reportCases(report),matching=cases.filter(row=>identityKey(row.identity)===identityKey(proof.identity));
  if(matching.length!==1||!cleanCase(matching[0]))throw Error('Not a single clean passed scenario with exact identity');
  const selected=matching[0],identity=selected.identity,project=report.config?.projects?.find(row=>row.id===identity.projectId&&row.name===identity.project);
  if(!identity.specId||!identity.file||!identity.suitePath.length||!project?.outputDir||!path.isAbsolute(project.outputDir))throw Error('Missing case identity or absolute project outputDir');
  const owner=JSON.stringify([path.resolve(reportPath),identityKey(identity)]);
  const requested=[proof.servedArtifact,...(proof.artifacts||[])];
  if(!proof.servedArtifact||!proof.artifacts?.length)throw Error('Missing served or scenario attachment');
  const attachments=selected.results[0].attachments||[],records=[];
  for(const requestedPath of requested){
    if(typeof requestedPath!=='string'||!path.isAbsolute(requestedPath))throw Error('Attachment proof path must be absolute');
    const absolute=path.resolve(requestedPath),attached=attachments.filter(row=>row.path&&path.resolve(row.path)===absolute);
    if(attached.length!==1)throw Error('Proof is not a unique attachment of selected case');
    const relative=path.relative(project.outputDir,absolute),pieces=relative.split(path.sep);
    if(relative.startsWith('..')||path.isAbsolute(relative)||pieces.length<2)throw Error('Attachment must be inside a unique case output directory');
    const caseDirectory=path.join(project.outputDir,pieces[0]);
    for(const other of cases){
      if(other===selected)continue;
      for(const result of other.results)for(const attachment of result.attachments||[]){
        if(!attachment.path)continue;const otherPath=path.resolve(attachment.path);
        if(otherPath===absolute||otherPath.startsWith(caseDirectory+path.sep))throw Error('Attachment path or case directory shared with another case/project');
      }
    }
    for(const key of [absolute,caseDirectory]){if(ownership.has(key)&&ownership.get(key)!==owner)throw Error('Attachment reused across report cases');}
    if(await fs.realpath(absolute)!==absolute)throw Error('Symlinked attachment path is not a frozen case output');
    const stat=await fs.lstat(absolute);if(!stat.isFile()||!stat.size)throw Error('Empty or non-file attachment');
    const bytes=await fs.readFile(absolute);
    if(absolute===path.resolve(proof.servedArtifact)){
      if(attached[0].contentType!=='application/json')throw Error('Served attachment must be JSON');
      const served=JSON.parse(bytes);if(!['current','upgrade-current'].includes(served.kind)||served.indexSHA256!==indexSHA256)throw Error('Wrong served evidence');
      const frontier=await readFrozenFrontier({root:run.root,start:run.start,testFile:identity.file});
      validateServedRecord(served,{identity,annotations:selected.annotations,run,frontier,files});
    }
    ownership.set(absolute,owner);ownership.set(caseDirectory,owner);
    records.push({path:absolute,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),attachmentName:attached[0].name,identity,report:path.resolve(reportPath)});
  }
  return records;
}
