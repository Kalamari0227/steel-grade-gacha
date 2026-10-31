// This helper binds prepared, actually reviewed rows; it never approves or creates artwork.
// node docs/design/game-reviews/producer-example.mjs pilot11 prepared.json > fragment.tmp
// mv fragment.tmp docs/design/game-reviews/pilot11/manifest-fragment.json
import fs from 'node:fs/promises';
import {contract, fingerprint, validateSchema} from '../../../tools/game-assets/schema.mjs';
import {exactKeys, readJson, requireValue} from '../../../tools/game-assets/io.mjs';
const [group,preparedPath,...extra]=process.argv.slice(2);
requireValue(group && preparedPath && extra.length===0 && Object.hasOwn(contract.groups,group),'usage','producer-example.mjs <group> <prepared.json>');
const manifest=JSON.parse(await fs.readFile(new URL('../game-asset-manifest.json',import.meta.url),'utf8'));
validateSchema(manifest);
const prepared=await readJson(preparedPath);
exactKeys(prepared,['assets','faces','crops','placements','optionalDerived'],'prepared rows');
const fragment={schemaVersion:2,edition:'game',group};
for(const name of ['assets','faces','crops','placements','optionalDerived']) {
  requireValue(Array.isArray(prepared[name]),'prepared-list',name);
  fragment[name]=prepared[name].map(value=>{
    requireValue(value.status==='approved','prepared-pending',name);
    const previous=manifest[name].find(row=>name==='faces'||name==='placements'?row.cardId===value.cardId&&row.side===value.side&&(name==='faces'||row.itemKey===value.itemKey):row.assetId===value.assetId);
    requireValue(previous||name==='optionalDerived','unknown-row',name);
    return {beforeSha256:previous?fingerprint(previous):null,value};
  });
}
requireValue(Object.values(prepared).some(rows=>rows.length>0),'empty-fragment',group);
console.log(JSON.stringify(fragment,null,2));
