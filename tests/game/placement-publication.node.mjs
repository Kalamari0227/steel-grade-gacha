import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fingerprint} from '../../tools/game-assets/schema.mjs';
const root=path.resolve(import.meta.dirname,'../..'),evidence=path.resolve(process.argv[2]),tmp=path.join(evidence,'publication-negative-fixture');
await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'publication-resources.json'),JSON.stringify({status:'planned',tmp}));
await fs.mkdir(path.join(tmp,'docs/design/game-reviews/placements'),{recursive:true});
const source=await fs.readFile(path.join(root,'docs/design/game-asset-manifest.json'));
const fragment=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-reviews/placements/manifest-fragment.json')));
const current=JSON.parse(source);for(const update of fragment.placements){const row=current.placements.find(p=>p.cardId===update.value.cardId&&p.side===update.value.side&&p.itemKey===update.value.itemKey);update.beforeSha256=fingerprint(row);}
const tests=[
  ['receipt-mismatch',f=>{},'placement-binding'],
  ['wrong-collection',f=>{f.assets=[{beforeSha256:'bad',value:{}}];},'placement-only-collection'],
  ['unknown-placement',f=>{f.placements[0].value.cardId='unknown';},'unknown-row'],
  ['duplicate-placement',f=>{f.placements[1]=structuredClone(f.placements[0]);},'duplicate-id'],
  ['stale-before-sha',f=>{f.placements[0].beforeSha256='0'.repeat(64);},'stale-fragment'],
  ['wrong-heat-side',f=>{f.placements[0].value.side='alt';},'unknown-row'],
  ['wrong-anchor',f=>{f.placements[0].value.anchor='face';},'placement-transform'],
  ['wrong-alpha-mask',f=>{f.placements[0].value.occlusionMask='character:poo-270C:front';},'occlusion-mask'],
  ['wrong-geometry',f=>{f.placements[0].value.rect.width=-1;},'rectangle']
];
const results=[];
for(const [name,mutate,code] of tests){
 await fs.writeFile(path.join(tmp,'docs/design/game-asset-manifest.json'),source);
 const f=structuredClone(fragment);mutate(f);await fs.writeFile(path.join(tmp,'docs/design/game-reviews/placements/manifest-fragment.json'),JSON.stringify(f));
 if(name==='receipt-mismatch'){const r=f.placements[0].value;await fs.writeFile(path.join(tmp,r.reviewReceipt),JSON.stringify({schemaVersion:1,status:'approved',placementSha256:'0'.repeat(64),characterSha256:'0'.repeat(64),itemSha256:'0'.repeat(64),protectedIntersectionRatio:0,visible:true,fullCard:{path:'x',sha256:'x'},at72:{path:'x',sha256:'x'}}));}
 const report=path.join(evidence,name+'.json');const args=[path.join(root,'tools/build-game-manifest.mjs'),'--root',tmp,'--group','placements','--report',report];
 const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000});
 await fs.writeFile(path.join(evidence,name+'.log'),result.stdout+result.stderr);
 const observed=JSON.parse(await fs.readFile(report));assert.equal(result.status,1);assert.equal(observed.code,code);assert.deepEqual(await fs.readFile(path.join(tmp,'docs/design/game-asset-manifest.json')),source);
 results.push({name,command:[process.execPath,...args],exit:result.status,code,manifestUnchanged:true,report});
}
await fs.rm(tmp,{recursive:true,force:true});await fs.writeFile(path.join(evidence,'publication-resources.json'),JSON.stringify({status:'closed',tmp,removed:!await fs.stat(tmp).then(()=>true,()=>false)}));
await fs.writeFile(path.join(evidence,'publication-negative-summary.json'),JSON.stringify({tests:results,count:results.length},null,2));console.log(JSON.stringify({passed:results.length}));
