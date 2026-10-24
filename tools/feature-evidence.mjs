import path from 'node:path';
import {fileRecord} from './delivery-files.mjs';
import {projects} from './suite-evidence.mjs';
import {validateCaseProof} from './case-evidence.mjs';
export async function validateFeatures({rows,mapping,bindings,report,run,files,ownership=new Map()}){
 if(mapping.status!=='reviewed'||!mapping.reviewer||!mapping.reviewEvidence)throw Error('Semantic feature mapping requires explicit review');
 const review=await fileRecord(mapping.reviewEvidence);if(!review.bytes)throw Error('Empty semantic review');
 if(rows.length!==60||mapping.rows?.length!==60||bindings.length!==60||new Set(bindings.map(row=>row.id)).size!==60||new Set(mapping.rows.map(row=>row.id)).size!==60)throw Error('Need60 distinct semantic rows and bindings');
 const records=[{path:path.resolve(mapping.reviewEvidence),...review}];
 const indexSHA256=files.find(row=>row.path==='index.html').sha256;
 for(const row of rows){
  const planned=mapping.rows.find(item=>item.id===row.id),bound=bindings.find(item=>item.id===row.id);
  if(!planned||planned.rowSHA256!==row.rowSHA256||!bound||bound.rowSHA256!==row.rowSHA256||bound.indexSHA256!==indexSHA256)throw Error('Stale semantic row: '+row.id);
  if(!planned.outcomes?.length||new Set(planned.outcomes.map(o=>o.id)).size!==planned.outcomes.length||bound.outcomes?.length!==planned.outcomes.length)throw Error('Missing/duplicate semantic outcomes: '+row.id);
  for(const outcome of planned.outcomes){
   const binding=bound.outcomes.find(item=>item.id===outcome.id);
   if(!outcome.description||!outcome.candidates?.length||!binding?.proofs?.length)throw Error('Unbound semantic outcome: '+row.id+'/'+outcome.id);
   const exempt=new Set();
   for(const exception of outcome.applicabilityExceptions||[]){
    if(!projects.includes(exception.project)||exempt.has(exception.project)||!exception.reason||!exception.reviewer||!exception.reviewEvidence)throw Error('Invalid applicability exception');
    const approval=await fileRecord(exception.reviewEvidence);if(!approval.bytes)throw Error('Empty applicability review');
    records.push({path:path.resolve(exception.reviewEvidence),...approval});exempt.add(exception.project);
   }
   if(exempt.size===projects.length)throw Error('Cannot exempt every project');
   for(const project of projects)if(!exempt.has(project)&&!binding.proofs.some(p=>p.identity?.project===project))throw Error('Missing browser outcome: '+row.id+'/'+outcome.id+'/'+project);
   for(const proof of binding.proofs){
    if(path.resolve(proof.report)!==path.resolve(run.reportPath)||!projects.includes(proof.identity?.project))throw Error('Proof outside final full suite');
    const matches=outcome.candidates.some(candidate=>path.resolve(run.root,candidate.file)===proof.identity.file&&new RegExp(candidate.titlePattern).test(proof.identity.title)&&(!candidate.suiteIncludes||proof.identity.suitePath.includes(candidate.suiteIncludes)));
    if(!matches)throw Error('Case is not a reviewed semantic candidate: '+row.id+'/'+outcome.id);
    records.push(...await validateCaseProof({report,reportPath:run.reportPath,proof,indexSHA256,run,files,ownership}));
   }
  }
 }return records;
}
