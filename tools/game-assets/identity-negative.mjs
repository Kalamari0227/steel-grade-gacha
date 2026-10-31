import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fingerprint} from './schema.mjs';
import {readJson,requireValue,safePath,sha} from './io.mjs';

// These probes test real file/receipt rejection, not perceptual character recognition.
export async function identityNegativeScenarios({root,evidence}) {
  const artifacts=path.join(evidence,'identity-pilot-negative-'+randomUUID());
  const temporary=path.join(process.env.TMPDIR||evidence,'pilot-fixture-'+randomUUID());
  await fs.mkdir(artifacts,{recursive:true});
  const write=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');};
  const registry={temporary,artifacts,processes:['actual node CLI timeout 60000ms','ffmpeg timeout 15000ms'],ports:[],status:'registered'};
  await write(path.join(artifacts,'resources.json'),registry);
  const manifestPath='docs/design/game-asset-manifest.json',fragmentPath='docs/design/game-reviews/pilot11/manifest-fragment.json';
  const sourceManifest=await fs.readFile(path.join(root,manifestPath));
  const original=JSON.parse(sourceManifest),candidate=structuredClone(original);
  const sourceFragment=await readJson(await safePath(root,fragmentPath));
  for(const key of ['assets','faces'])for(const update of sourceFragment[key]) {
    const index=candidate[key].findIndex(row=>key==='assets'?row.assetId===update.value.assetId:row.cardId===update.value.cardId&&row.side===update.value.side);
    requireValue(index>=0,'fixture-row',key);candidate[key][index]=update.value;
  }
  const selected=candidate.assets.filter(row=>row.ownerGroup==='pilot11');
  requireValue(selected.length===22&&selected.every(row=>row.status==='approved'),'pilot-fixture','all22 produced rows required');
  const files=new Map();
  const include=async relative=>{if(!files.has(relative))files.set(relative,await fs.readFile(await safePath(root,relative)));};
  for(const row of selected){
    for(const p of [row.path,row.masterPath,row.reference,row.reviewReceipt])await include(p);
    const receipt=JSON.parse(files.get(row.reviewReceipt));await include(receipt.generation.sourceEvidence);
    for(const check of Object.values(receipt.checks))if(check.evidence)await include(check.evidence);
  }
  const base=structuredClone(original);
  for(const row of base.assets)if(row.ownerGroup==='pilot11')Object.assign(row,{status:'pending',bytes:null,sha256:null,masterSha256:null,reviewReceipt:null});
  for(const face of base.faces)if(selected.some(row=>row.assetId===face.character))Object.assign(face,{status:'pending',reviewReceipt:null});
  const fragment={schemaVersion:2,edition:'game',group:'pilot11',assets:selected.map(value=>({beforeSha256:fingerprint(base.assets.find(row=>row.assetId===value.assetId)),value})),faces:candidate.faces.filter(face=>selected.some(row=>row.assetId===face.character)).map(value=>({beforeSha256:fingerprint(base.faces.find(row=>row.cardId===value.cardId&&row.side===value.side)),value})),crops:[],placements:[],optionalDerived:[]};
  const results=[],cli=path.join(root,'tools/verify-game-assets.mjs');
  async function scenario(name,mutate,expectedCode=null,canonical=false){
    for(const [relative,bytes] of files)await write(path.join(temporary,relative),bytes);
    const f=structuredClone(fragment);if(mutate)await mutate(f);
    const current=structuredClone(base);
    if(canonical)for(const key of ['assets','faces'])for(const update of f[key]) {
      const index=current[key].findIndex(row=>key==='assets'?row.assetId===update.value.assetId:row.cardId===update.value.cardId&&row.side===update.value.side);
      current[key][index]=update.value;
    }
    await write(path.join(temporary,manifestPath),current);await write(path.join(temporary,fragmentPath),f);
    await write(path.join(artifacts,name+'-input.json'),f);
    const foreign=path.join(temporary,'docs/design/game-reviews/ga/manifest-fragment.json');
    await write(foreign,'{unfinished sibling fragment');
    const sentinelBefore=sha(await fs.readFile(foreign)),manifestBefore=sha(await fs.readFile(path.join(temporary,manifestPath)));
    const report=path.join(artifacts,name+'.json');
    const argv=[cli,'--root',temporary,'--group','pilot11','--review-root','docs/design/game-reviews','--report',report,...(canonical?['--canonical']:[])];
    const child=spawnSync(process.execPath,argv,{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024,env:{...process.env,TMPDIR:temporary,NODE_COMPILE_CACHE:path.join(temporary,'cache'),BUN_RUNTIME_TRANSPILER_CACHE_PATH:path.join(temporary,'bun')}});
    const actual=JSON.parse(await fs.readFile(report,'utf8'));
    const preserved=manifestBefore===sha(await fs.readFile(path.join(temporary,manifestPath)))&&sentinelBefore===sha(await fs.readFile(foreign));
    const passed=!child.error&&child.status===(expectedCode?1:0)&&actual.status===(expectedCode?'FAIL':'PASS')&&(!expectedCode||actual.code===expectedCode)&&preserved;
    const result={name,passed,command:[process.execPath,...argv],exit:child.status,expectedCode,actualCode:actual.code||null,actualStatus:actual.status,manifestAndSiblingUnchanged:preserved,stdout:child.stdout,stderr:child.stderr,report};
    await write(path.join(artifacts,name+'-cli.json'),result);results.push(result);
    requireValue(passed,'identity-negative-scenario',name);
  }
  const transform=async(args,output)=>{const p=spawnSync('ffmpeg',['-v','error','-y',...args,output],{timeout:15000,maxBuffer:4*1024*1024});requireValue(p.status===0&&!p.error,'fixture-transform',p.stderr?.toString());};
  try {
    await fs.mkdir(temporary,{recursive:true});
    await scenario('valid-production-copy-and-dirty-sibling',null);
    await scenario('missing-alpha',async f=>{const row=f.assets.find(x=>x.value.assetId==='character:poo-270C:front').value,target=path.join(temporary,row.path),source=path.join(temporary,'transform-input.webp');await fs.copyFile(target,source);await transform(['-i',source,'-vf','format=rgb24','-c:v','libwebp','-lossless','1'],target);const bytes=await fs.readFile(target);Object.assign(row,{bytes:bytes.length,sha256:sha(bytes)});},'required-alpha');
    await scenario('alt-mismatch',async f=>{f.faces.find(x=>x.value.cardId==='poo-PHS'&&x.value.side==='alt').value.character='character:poo-PHS:front';},'contract');
    await scenario('facecrop',async f=>{const row=f.assets.find(x=>x.value.assetId==='character:poo-270C:front').value,target=path.join(temporary,row.path),source=path.join(temporary,'transform-input.webp');await fs.copyFile(target,source);await transform(['-i',source,'-vf','crop=960:600:0:350','-c:v','libwebp','-lossless','1'],target);const bytes=await fs.readFile(target);Object.assign(row,{bytes:bytes.length,sha256:sha(bytes)});},'dimensions');
    await scenario('stale-fragment',async f=>{f.assets[0].beforeSha256='0'.repeat(64);},'stale-fragment');
    await scenario('misleading-approved-receipt',async f=>{const row=f.assets[0].value,p=path.join(temporary,row.reviewReceipt),r=JSON.parse(await fs.readFile(p));r.binding.fullId='ga-270C';await write(p,r);},'receipt-binding');
    await scenario('resume-valid-after-rejections',null);
    await scenario('canonical-full-production-copy',null,null,true);
    await scenario('canonical-wrong-image-hash',async f=>{f.assets[0].value.sha256='0'.repeat(64);},'sha256',true);
    await scenario('canonical-misleading-approved-receipt',async f=>{const row=f.assets[0].value,p=path.join(temporary,row.reviewReceipt),r=JSON.parse(await fs.readFile(p));r.binding.fullId='ga-270C';await write(p,r);},'receipt-binding',true);
  } finally {
    await fs.rm(temporary,{recursive:true,force:true});
    registry.status='cleaned';registry.existsAfter=await fs.access(temporary).then(()=>true,()=>false);
    registry.sourceManifestUnchanged=sha(sourceManifest)===sha(await fs.readFile(path.join(root,manifestPath)));
    registry.sourceFilesUnchanged=(await Promise.all([...files].map(async([relative,bytes])=>sha(bytes)===sha(await fs.readFile(path.join(root,relative)))))).every(Boolean);
    await write(path.join(artifacts,'cleanup.json'),registry);
  }
  requireValue(registry.sourceManifestUnchanged&&registry.sourceFilesUnchanged&&!registry.existsAfter,'fixture-source-mutated','production must remain untouched');
  return {status:'PASS',mode:'identity-pilot-negative',caseCount:results.length,passed:results.length,failed:0,artProductionComplete:false,scope:'Actual production copies exercise alpha, mapping, dimension and SHA/receipt contracts. Facecrop is a dimension-invalid raster crop; same-size semantic cropping and visual identity require direct visual QA.',results:results.map(({stdout,stderr,...r})=>r),cleanup:path.join(artifacts,'cleanup.json')};
}
