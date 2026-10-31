import {isDeepStrictEqual} from 'node:util';
import {exactKeys, readJson, requireValue, safePath, sha} from './io.mjs';
import {decode, fileBytes} from './images.mjs';
import {fingerprint} from './schema.mjs';
export const checkNames=['face','silhouette','emblem','material','thumbnail72'];
export function binding(row) {
  return {assetId:row.assetId,fullId:row.cardId||row.assetId,side:row.side||null,path:row.path,sha256:row.sha256,masterPath:row.masterPath,masterSha256:row.masterSha256,reference:row.reference};
}
export async function reviewAsset(row,context) {
  const {root,reviewRoot,manifest}=context;
  requireValue(row.reviewReceipt?.startsWith(reviewRoot+'/'),'receipt-root',row.assetId);
  const receipt=await readJson(await safePath(root,row.reviewReceipt));
  exactKeys(receipt,['schemaVersion','status','purpose','reviewer','reviewedAt','binding','referenceSha256','generation','checks','metadata'],'receipt');
  requireValue(receipt.schemaVersion===1&&receipt.status==='approved'&&receipt.purpose==='production','receipt-status',row.assetId);
  requireValue(typeof receipt.reviewer==='string'&&receipt.reviewer.trim().length>1&&typeof receipt.reviewedAt==='string'&&Number.isFinite(Date.parse(receipt.reviewedAt)),'receipt-reviewer',row.assetId);
  requireValue(isDeepStrictEqual(receipt.binding,binding(row)),'receipt-binding',row.assetId);
  const reference=await fileBytes(root,row.reference);
  requireValue(sha(reference)===receipt.referenceSha256,'reference-sha256',row.assetId);
  exactKeys(receipt.generation,['method','sourceEvidence','sourceEvidenceSha256'],'generation');
  requireValue(receipt.generation.method===(row.derivedFrom?'derived-export':'built-in-imagegen'),'generation-method',row.assetId);
  const generation=await fileBytes(root,receipt.generation.sourceEvidence);
  requireValue(sha(generation)===receipt.generation.sourceEvidenceSha256,'generation-evidence',row.assetId);
  exactKeys(receipt.checks,checkNames,'review checks');
  const checkProof=[];
  for(const name of checkNames) {
    const check=receipt.checks[name];exactKeys(check,['result','observation','evidence','sha256','displayWidth'],name);
    requireValue(typeof check.observation==='string'&&check.observation.trim().length>=12,'review-observation',`${row.assetId}.${name}`);
    if(check.result==='not-applicable') {
      requireValue(!['character','thumbnail'].includes(row.kind)&&['face','emblem'].includes(name)&&check.evidence===null&&check.sha256===null&&check.displayWidth===null,'review-na',`${row.assetId}.${name}`);
      continue;
    }
    requireValue(check.result==='pass','review-check',`${row.assetId}.${name}`);
    const evidence=await fileBytes(root,check.evidence);
    requireValue(sha(evidence)===check.sha256,'review-evidence',`${row.assetId}.${name}`);
    const raster=decode(evidence);
    requireValue(check.displayWidth===(name==='thumbnail72'?72:null) && (name!=='thumbnail72'||raster.width===72),'review-72px',row.assetId);
    checkProof.push({check:name,path:check.evidence,sha256:check.sha256,width:raster.width,height:raster.height});
  }
  exactKeys(receipt.metadata,['face','crop'],'review metadata');
  const face=manifest.faces.find(f=>f.character===row.assetId);
  const crop=manifest.crops.find(c=>c.assetId===row.assetId);
  requireValue(receipt.metadata.face===(face?fingerprint(face):null)&&receipt.metadata.crop===(crop?fingerprint(crop):null),'review-metadata',row.assetId);
  if(face)requireValue(face.status==='approved'&&face.reviewReceipt===row.reviewReceipt,'face-review',row.assetId);
  if(crop)requireValue(crop.status==='approved','crop-review',row.assetId);
  return {path:row.reviewReceipt,sha256:sha(await fileBytes(root,row.reviewReceipt)),checks:checkProof};
}
export async function reviewPlacement(row,context) {
  const id=`${row.cardId}:${row.side}:${row.itemKey}`;
  requireValue(row.status==='approved'&&row.reviewReceipt?.startsWith(context.reviewRoot+'/'),'placement-pending',id);
  const receipt=await readJson(await safePath(context.root,row.reviewReceipt));
  exactKeys(receipt,['schemaVersion','status','placementSha256','characterSha256','itemSha256','protectedIntersectionRatio','visible','fullCard','at72'],'placement receipt');
  const character=context.manifest.assets.find(x=>x.assetId===`character:${row.cardId}:${row.side}`),item=context.manifest.assets.find(x=>x.assetId===`item:${row.itemKey}`);
  requireValue(receipt.schemaVersion===1&&receipt.status==='approved'&&receipt.placementSha256===fingerprint(row)&&receipt.characterSha256===character.sha256&&receipt.itemSha256===item.sha256,'placement-binding',id);
  requireValue(Number.isFinite(receipt.protectedIntersectionRatio)&&receipt.protectedIntersectionRatio>=0&&receipt.protectedIntersectionRatio<=.01&&receipt.visible===true,'placement-visibility',id);
  for(const name of ['fullCard','at72']) {
    const proof=receipt[name];exactKeys(proof,['path','sha256'],name);
    const bytes=await fileBytes(context.root,proof.path);requireValue(sha(bytes)===proof.sha256,'placement-evidence',id);decode(bytes);
  }
}
