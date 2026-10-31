import fs from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {exactKeys, relativePath, requireValue, sha} from './io.mjs';
export const contract=JSON.parse(await fs.readFile(new URL('./contract.json',import.meta.url),'utf8'));
export const assetMutable=['status','bytes','sha256','masterSha256','reviewReceipt'];
export const fingerprint=value=>sha(JSON.stringify(value));
const same=(a,b,label)=>requireValue(isDeepStrictEqual(a,b),'contract',label);
const hash=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
export function rectangle(r,label) {
  exactKeys(r,['x','y','width','height'],label);
  requireValue(Object.values(r).every(Number.isFinite) && r.x>=0 && r.y>=0 && r.width>0 && r.height>0 && r.x+r.width<=1 && r.y+r.height<=1,'rectangle',label);
}
function point(p,label) {
  exactKeys(p,['x','y'],label);
  requireValue(Object.values(p).every(v=>Number.isFinite(v)&&v>=0&&v<=1),'point',label);
}
export function lifecycle(row,label) {
  requireValue(['pending','approved'].includes(row.status),'status',label);
  if(row.status==='approved') requireValue(typeof row.reviewReceipt==='string','receipt-required',label);
  if(row.reviewReceipt!==null) relativePath(row.reviewReceipt);
}
export function validateAsset(row,expected) {
  exactKeys(row,[...Object.keys(expected),...assetMutable],row.assetId);
  for(const [key,value] of Object.entries(expected)) same(row[key],value,`${row.assetId}.${key}`);
  for(const field of ['path','masterPath','reference']) relativePath(row[field]);
  lifecycle(row,row.assetId);
  switch(row.status) {
    case 'pending': for(const key of ['bytes','sha256','masterSha256','reviewReceipt']) same(row[key],null,`${row.assetId}.${key} pending`);break;
    case 'approved': requireValue(Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.bytes<=41943040&&hash(row.sha256)&&hash(row.masterSha256),'asset-metadata',row.assetId);break;
    default: throw Error('unreachable status');
  }
}
export function derivedContract(row) {
  const source=contract.assets.find(x=>x.assetId===row.derivedFrom);
  requireValue(source,'derived-source',row.assetId);
  let expected;
  switch(row.kind) {
    case 'car-thumbnail':
      requireValue(source.kind==='car','derived-source',row.assetId);
      expected={assetId:`car-thumbnail:${source.assetId.split(':')[1]}`,path:`src/game/art/car-thumbnails/${source.assetId.split(':')[1]}.webp`,dimensions:{width:240,height:160},alphaRequired:true};break;
    case 'occlusion-mask': {
      requireValue(source.kind==='character' && ['left','right'].includes(row.hand),'derived-source',row.assetId);
      expected={assetId:`occlusion-mask:${source.cardId}:${source.side}:${row.hand}`,path:`src/game/art/masks/${source.cardId}/${source.side}-${row.hand}.webp`,dimensions:{width:960,height:1440},alphaRequired:true,hand:row.hand};break;
    }
    case 'draw-crop': {
      requireValue(source.kind==='draw' && ['left','right','open','seal'].includes(row.piece),'derived-source',row.assetId);
      expected={assetId:`draw-crop:${source.assetId.split(':')[1]}:${row.piece}`,path:`src/game/art/draw/crops/${source.assetId.split(':')[1]}-${row.piece}.webp`,dimensions:{width:768,height:768},alphaRequired:true,piece:row.piece};break;
    }
    default: requireValue(false,'derived-kind',row.kind);
  }
  return {...expected,kind:row.kind,group:source.group,ownerGroup:source.ownerGroup,mime:'image/webp',derivedFrom:source.assetId,masterPath:source.masterPath,reference:source.reference};
}
export function validateSchema(m) {
  exactKeys(m,['schemaVersion','edition','stage','baselineCommits','counts','families','specialFrameIds','groups','budgets','assets','faces','compatiblePairs','placements','crops','optionalDerived'],'manifest');
  for(const key of ['schemaVersion','edition','baselineCommits','counts','families','specialFrameIds','groups','compatiblePairs'])same(m[key],contract[key],key);
  requireValue(['schema-only','release'].includes(m.stage),'stage',m.stage);
  same(m.budgets,{visualBytes:41943040,indexBytes:1048576,initialTransferBytes:2097152},'budgets');
  requireValue(Array.isArray(m.assets)&&m.assets.length===175,'asset-count','125 base + 47 thumbnails + 3 icons');
  requireValue(Array.isArray(m.optionalDerived)&&m.optionalDerived.length<=110,'derived-count','bounded declared exports');
  const ids=new Set(),paths=new Set(),baseHashes=new Set();
  for(const row of [...m.assets,...m.optionalDerived]) {
    requireValue(row && typeof row.assetId==='string','asset-id','missing');
    requireValue(!ids.has(row.assetId),'duplicate-id',row.assetId);ids.add(row.assetId);
    requireValue(!paths.has(row.path),'duplicate-path',row.path);paths.add(row.path);
    const expected=m.assets.includes(row)?contract.assets.find(x=>x.assetId===row.assetId):derivedContract(row);
    requireValue(expected,'unknown-asset',row.assetId);validateAsset(row,expected);
    if(row.status==='approved' && !row.derivedFrom) {requireValue(!baseHashes.has(row.sha256),'duplicate-base-image',row.assetId);baseHashes.add(row.sha256);}
  }
  requireValue(Array.isArray(m.faces)&&m.faces.length===47,'face-count','47');
  const faceIds=new Set();
  for(const face of m.faces) {
    exactKeys(face,['cardId','side','family','character','background','frame','thumbnail','status','safeRects','anchors','reviewReceipt'],'face');
    const id=`${face.cardId}:${face.side}`,character=contract.assets.find(x=>x.assetId===`character:${id}`);
    requireValue(character && !faceIds.has(id),'face-id',id);faceIds.add(id);
    same(face.family,character.family,`${id}.family`);
    same(face.character,character.assetId,`${id}.character`);
    same(face.background,'background:'+character.family,`${id}.background`);
    same(face.frame,'frame:'+(contract.specialFrameIds.includes(face.cardId)?'special':'standard'),`${id}.frame`);
    same(face.thumbnail,`thumbnail:${id}`,`${id}.thumbnail`);
    lifecycle(face,id);exactKeys(face.safeRects,['face','emblem'],id);
    for(const [key,rect] of Object.entries(face.safeRects))rectangle(rect,`${id}.${key}`);
    exactKeys(face.anchors,['leftHand','rightHand','workbench'],id);
    for(const [key,p] of Object.entries(face.anchors))point(p,`${id}.${key}`);
  }
  requireValue(Array.isArray(m.placements)&&m.placements.length===107,'placement-count','107');
  const placementIds=new Set();
  for(const p of m.placements) {
    exactKeys(p,['cardId','itemKey','side','status','rect','pivot','rotation','z','anchor','occlusionMask','reviewReceipt'],'placement');
    const id=`${p.cardId}:${p.side}:${p.itemKey}`;
    requireValue(!placementIds.has(id)&&contract.placementKeys.some(x=>x.cardId===p.cardId&&x.side===p.side&&x.itemKey===p.itemKey),'placement-id',id);placementIds.add(id);
    lifecycle(p,id);rectangle(p.rect,id);point(p.pivot,id);
    requireValue(Number.isFinite(p.rotation)&&p.rotation>=-180&&p.rotation<=180&&[10,40].includes(p.z)&&['leftHand','rightHand','workbench'].includes(p.anchor),'placement-transform',id);
    if(p.occlusionMask!==null)requireValue(m.optionalDerived.some(x=>x.assetId===p.occlusionMask&&x.kind==='occlusion-mask'&&x.derivedFrom===`character:${p.cardId}:${p.side}`),'occlusion-mask',id);
  }
  const cropIds=contract.assets.filter(x=>['background','scene'].includes(x.kind)).map(x=>x.assetId).sort();
  requireValue(Array.isArray(m.crops),'crop-list','required');same(m.crops.map(x=>x.assetId).sort(),cropIds,'crops');
  for(const c of m.crops){exactKeys(c,['assetId','status','desktop','mobile'],'crop');requireValue(['pending','approved'].includes(c.status),'crop-status',c.assetId);rectangle(c.desktop,c.assetId);rectangle(c.mobile,c.assetId);}
  return {base:125,thumbnails:47,icons:3,optionalDerived:m.optionalDerived.length,faces:47,materials:45,compatiblePairs:103,placements:107,pending:m.assets.filter(x=>x.status==='pending').length};
}
