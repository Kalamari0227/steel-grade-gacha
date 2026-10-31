import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fingerprint} from '../../tools/game-assets/schema.mjs';
const root=path.resolve(import.meta.dirname,'../..'),run=path.resolve(process.argv[2]);
const folder=(await fs.readdir(path.join(run,'artifacts'))).find(x=>x.startsWith('layer-compositor-all-47')&&x.endsWith('-chromium'));
const artifacts=path.join(run,'artifacts',folder),coverage=JSON.parse(await fs.readFile(path.join(artifacts,'coverage.json')));
if(coverage.faces!==47||coverage.pairs!==103||coverage.placements!==107)throw Error('Incomplete measured coverage');
const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-asset-manifest.json'))),fragment=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-reviews/placements/manifest-fragment.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),summary=[];
async function proof(file){const relative='docs/design/game-reviews/placements/'+file,bytes=await fs.readFile(path.join(artifacts,file));await fs.writeFile(path.join(root,relative),bytes);return {path:relative,sha256:sha(bytes)};}
for(const {value:row} of fragment.placements){
 const observation=coverage.observations.find(x=>x.cardId===row.cardId&&x.side===row.side),measure=observation.items.find(i=>i.itemKey===row.itemKey);
 if(measure.protectedIntersectionRatio>.01||measure.visiblePixels<=0||observation.fullSetProtectedIntersectionRatio>.01)throw Error('Rejected measured placement');
 const prefix=row.cardId+'-'+row.side+'-'+row.itemKey;
 const receipt={schemaVersion:1,status:'approved',placementSha256:fingerprint(row),characterSha256:manifest.assets.find(a=>a.assetId===`character:${row.cardId}:${row.side}`).sha256,itemSha256:manifest.assets.find(a=>a.assetId==='item:'+row.itemKey).sha256,protectedIntersectionRatio:measure.protectedIntersectionRatio,visible:true,fullCard:await proof(prefix+'.png'),at72:await proof(prefix+'-72.png')};
 await fs.writeFile(path.join(root,row.reviewReceipt),JSON.stringify(receipt,null,2)+'\n');summary.push({cardId:row.cardId,side:row.side,itemKey:row.itemKey,receipt:row.reviewReceipt,...measure});
}
const fullsets=[];for(const face of manifest.faces){const prefix=face.cardId+'-'+face.side+'-fullset';fullsets.push({cardId:face.cardId,side:face.side,fullCard:await proof(prefix+'.png'),at72:await proof(prefix+'-72.png'),protectedIntersectionRatio:coverage.observations.find(x=>x.cardId===face.cardId&&x.side===face.side).fullSetProtectedIntersectionRatio});}
await fs.writeFile(path.join(root,'docs/design/game-reviews/placements/coverage.json'),JSON.stringify({sourceRun:run,faces:47,materials:45,pairs:103,placements:107,fullsets,observations:summary},null,2)+'\n');
console.log(JSON.stringify({receipts:summary.length,fullsets:fullsets.length}));
