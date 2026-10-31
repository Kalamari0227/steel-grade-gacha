import {exactKeys,readJson,requireValue,safePath,sha} from './io.mjs';
import {contract,fingerprint,rectangle} from './schema.mjs';
import {decode,fileBytes} from './images.mjs';
export const partGroups=['parts-body','parts-frame','parts-chassis'];
export async function verifyPartAssembly(manifest,{root,reviewRoot,group}) {
  requireValue(partGroups.includes(group),'assembly-group',group);
  const relative=`${reviewRoot}/${group}/assembly-metadata.json`,metadata=await readJson(await safePath(root,relative));
  exactKeys(metadata,['schemaVersion','group','coordinateSystem','convention','parts'],'assembly metadata');
  requireValue(metadata.schemaVersion===1&&metadata.group===group&&metadata.coordinateSystem==='vehicle-side-normalized-v1'&&metadata.convention==='x=0 front, x=1 rear; y=0 roof/top, y=1 ground; left-side schematic, not physical CAD','assembly-convention',group);
  const expected=contract.groups[group],catalog=await readJson(await safePath(root,'tests/fixtures/catalog.json'));
  requireValue(Array.isArray(metadata.parts)&&metadata.parts.length===expected.length,'assembly-count',group);
  const seen=new Set(),proofs=new Map();
  for(const row of metadata.parts) {
    exactKeys(row,['partKey','assetId','assetSha256','surface','anchor','bounds','layer','recipeSha256','review'],'assembly row');
    requireValue(expected.includes(row.assetId)&&row.assetId===`part:${row.partKey}`,'assembly-id',row.assetId);
    requireValue(!seen.has(row.assetId),'assembly-duplicate',row.assetId);seen.add(row.assetId);
    const asset=manifest.assets.find(asset=>asset.assetId===row.assetId),recipe=catalog.parts.find(part=>part.key===row.partKey);
    requireValue(asset&&asset.sha256===row.assetSha256&&recipe&&fingerprint(recipe)===row.recipeSha256,'assembly-binding',row.assetId);
    requireValue(['outer','inner','assembly','structural','mechanical'].includes(row.surface),'assembly-surface',row.assetId);
    if(row.partKey==='trunkin')requireValue(row.surface==='inner','assembly-surface',row.assetId);
    if(row.partKey==='trunko')requireValue(row.surface==='assembly','assembly-surface',row.assetId);
    exactKeys(row.anchor,['x','y'],'assembly anchor');
    requireValue(Object.values(row.anchor).every(value=>Number.isFinite(value)&&value>=0&&value<=1),'assembly-anchor',row.assetId);
    rectangle(row.bounds,'assembly bounds');
    requireValue(row.anchor.x>=row.bounds.x&&row.anchor.x<=row.bounds.x+row.bounds.width&&row.anchor.y>=row.bounds.y&&row.anchor.y<=row.bounds.y+row.bounds.height,'assembly-anchor',row.assetId);
    requireValue(Number.isSafeInteger(row.layer)&&row.layer>=0&&row.layer<=100,'assembly-layer',row.assetId);
    exactKeys(row.review,['status','observation','evidence','sha256'],'assembly review');
    requireValue(row.review.status==='approved'&&typeof row.review.observation==='string'&&row.review.observation.trim().length>=12,'assembly-review',row.assetId);
    requireValue(typeof row.review.evidence==='string'&&row.review.evidence.startsWith(`${reviewRoot}/${group}/`),'assembly-evidence',row.assetId);
    if(!proofs.has(row.review.evidence)){const bytes=await fileBytes(root,row.review.evidence);decode(bytes);proofs.set(row.review.evidence,sha(bytes));}
    requireValue(proofs.get(row.review.evidence)===row.review.sha256,'assembly-evidence',row.assetId);
  }
  return {path:relative,sha256:sha(await fileBytes(root,relative)),checked:seen.size,coordinateSystem:metadata.coordinateSystem,scope:'Semantic normalized diagram anchors, SHA-bound assets/recipes and direct-review evidence. No automatic image-shape or engineering-CAD recognition.'};
}
