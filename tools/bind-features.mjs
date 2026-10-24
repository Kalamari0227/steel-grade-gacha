import fs from 'node:fs/promises';
import path from 'node:path';
import {snapshot} from './delivery-files.mjs';
import {validateFinalSuite} from './suite-evidence.mjs';
import {validateFeatures} from './feature-evidence.mjs';
const [runPath,mappingPath,out]=process.argv.slice(2);
if(!runPath||!mappingPath||!out)throw Error('Usage: bind-features.mjs run.json reviewed-mapping.json external-bindings.json');
const run=JSON.parse(await fs.readFile(runPath,'utf8')),mapping=JSON.parse(await fs.readFile(mappingPath,'utf8'));
if(path.resolve(out).startsWith(run.root+path.sep))throw Error('Bindings must be outside APP');
const reportBytes=await fs.readFile(run.reportPath),inventoryBytes=await fs.readFile(run.inventoryPath);
const report=JSON.parse(reportBytes),inventory=JSON.parse(inventoryBytes),{files}=await snapshot(run.root);
const suite=validateFinalSuite({report,inventory,run,files,reportBytes,inventoryBytes}),indexSHA256=files.find(row=>row.path==='index.html').sha256,bindings=[];
for(const row of mapping.rows){
 const outcomes=[];
 for(const outcome of row.outcomes){
  const proofs=[];
  for(const project of suite.projects){
   if((outcome.applicabilityExceptions||[]).some(e=>e.project===project))continue;
   const matches=suite.cases.filter(c=>c.identity.project===project&&outcome.candidates.some(candidate=>
    c.identity.file===path.resolve(run.root,candidate.file)&&new RegExp(candidate.titlePattern).test(c.identity.title)&&
    (!candidate.suiteIncludes||c.identity.suitePath.includes(candidate.suiteIncludes))));
   if(matches.length!==1)throw Error('Resolve exactly one case for '+row.id+'/'+outcome.id+'/'+project+'; got '+matches.length);
   const selected=matches[0],attachments=selected.results[0].attachments||[];
   const served=[];
   for(const attachment of attachments)if(attachment.name==='final-freeze-served'&&attachment.path){
    const data=JSON.parse(await fs.readFile(attachment.path,'utf8'));
    if(data.servedSHA256===indexSHA256&&data.runId===run.runId)served.push(attachment.path);
   }
   const artifacts=attachments.filter(a=>a.path&&a.name!=='final-freeze-served'&&['application/json','image/png'].includes(a.contentType)).map(a=>a.path);
   if(!served.length||!artifacts.length)throw Error('Missing real case receipt/artifacts for '+row.id+'/'+outcome.id+'/'+project);
   proofs.push({report:run.reportPath,identity:selected.identity,servedArtifact:served.at(-1),artifacts});
  }
  outcomes.push({id:outcome.id,proofs});
 }
 bindings.push({id:row.id,rowSHA256:row.rowSHA256,indexSHA256,outcomes});
}
const source=await fs.readFile(path.join(run.root,'docs/feature-map.md'),'utf8');
const {hash}=await import('./delivery-files.mjs');
const rows=source.split('\n').filter(line=>line.startsWith('|')&&!/^\|[- ]+\|/.test(line)&&!/^\| 기존 /.test(line)).map((line,i)=>({id:'FM'+String(i+1).padStart(3,'0'),rowSHA256:hash(line)}));
await validateFeatures({rows,mapping,bindings,report,run,files});
await fs.writeFile(out,JSON.stringify(bindings,null,2));
