import {contract, validateSchema} from './schema.mjs';
import {requireValue} from './io.mjs';
import {inspectAsset} from './images.mjs';
import {reviewAsset, reviewPlacement} from './reviews.mjs';
export async function verify(manifest,context) {
  const counts=validateSchema(manifest);
  if(context.schemaOnly)return {status:'PASS',mode:'schema-only',counts,artProductionComplete:false,assets:[]};
  const group=context.group||'all';
  const placementsOnly=group==='placements';
  requireValue(placementsOnly||group==='all'||Object.hasOwn(contract.groups,group),'unknown-group',group);
  const placementAssetIds=placementsOnly?new Set(manifest.faces.map(face=>face.character).concat(manifest.placements.map(row=>'item:'+row.itemKey))):null;
  const selected=[...manifest.assets,...manifest.optionalDerived].filter(row=>placementsOnly?placementAssetIds.has(row.assetId):group==='all'||contract.groups[group].includes(row.assetId)||row.group===group||row.ownerGroup===group);
  requireValue(selected.length>0,'zero-assets',group);
  const pending=selected.filter(row=>row.status!=='approved').map(row=>row.assetId);
  requireValue(pending.length===0,'pending-assets',JSON.stringify({count:pending.length,ids:pending}));
  const bytes=manifest.assets.reduce((sum,row)=>sum+(row.bytes||0),0)+manifest.optionalDerived.reduce((sum,row)=>sum+(row.bytes||0),0);
  requireValue(bytes<=manifest.budgets.visualBytes,'visual-budget',bytes);
  if(placementsOnly)for(const placement of manifest.placements)await reviewPlacement(placement,{...context,manifest});
  const assets=[];
  for(const row of selected) {
    const image=await inspectAsset(row,context.root);
    const review=await reviewAsset(row,{...context,manifest});
    assets.push({...image,review});
  }
  if(group==='all'||placementsOnly) {
    if(group==='all')requireValue(manifest.stage==='release','release-stage',manifest.stage);
    if(!placementsOnly)for(const placement of manifest.placements)await reviewPlacement(placement,{...context,manifest});
  }
  return {status:'PASS',mode:placementsOnly?'placements':group==='all'?'release':'group',group,counts,checked:assets.length,bytes,artProductionComplete:group==='all',assets};
}
