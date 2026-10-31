import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const excludedDirectories=new Set(['.git','node_modules','.omo','test-results','playwright-report']);
export const requiredFiles=[
 'README.md','src/README.md','src/app_tpl.html','src/build.sh','src/pwa_body.txt','src/pwa_head.txt','index.html','sw.js',
 'manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','src/uiimg/workshop.webp',
 'package.json','package-lock.json','playwright.config.mjs',
 'docs/feature-map.md','docs/baseline-contracts.md','docs/design/asset-manifest.json',
 'docs/design/system.md','docs/design/art-bible.md','docs/design/screen-states.md',
 'docs/learning-content-review.md','docs/learning-study-protocol.md','docs/redesign-maintenance.md',
 'tests/end-to-end.spec.mjs','tests/final-coverage.spec.mjs','tests/education-data.spec.mjs',
 'tests/storage.spec.mjs','tests/settings-controls.spec.mjs','tests/pwa-update.spec.mjs',
 'tests/accessibility-layout.spec.mjs','tests/assets-performance.spec.mjs',
 'tests/contracts.spec.mjs','tests/reset.spec.mjs','tests/home.spec.mjs','tests/draw.spec.mjs',
 'tests/cards.spec.mjs','tests/crafting.spec.mjs','tests/qp.spec.mjs','tests/garage.spec.mjs',
 'tests/learning.spec.mjs','tests/orders-items.spec.mjs','tests/webtoon.spec.mjs','tests/navigation.spec.mjs',
 'tests/art-preview.spec.mjs','tests/helpers/app.mjs','tests/helpers/paths.mjs','tests/helpers/pwa-site.mjs',
 'tests/fixtures/catalog.json','tools/verify-assets.mjs','tools/delivery-manifest.mjs',
 'tools/case-evidence.mjs','tools/suite-evidence.mjs','tools/delivery-files.mjs',
 'tools/final-evidence.mjs','tools/final-suite.mjs','tools/feature-evidence.mjs','tools/bind-features.mjs','tests/helpers/storage-evidence.mjs'
];
export async function fileRecord(file){
 if(await fs.realpath(file)!==path.resolve(file))throw Error('Symlinked file: '+file);
 const stat=await fs.lstat(file);if(!stat.isFile())throw Error('Expected regular file: '+file);
 const digest=crypto.createHash('sha256');let bytes=0;for await(const chunk of createReadStream(file)){bytes+=chunk.length;digest.update(chunk);}
 if(bytes!==stat.size)throw Error('File changed during fingerprint: '+file);return {bytes,sha256:digest.digest('hex')};
}
export async function walk(directory,relative='',excluded=excludedDirectories){
 const rows=[];
 for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const rel=path.posix.join(relative,entry.name),absolute=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw Error('Review symlink before freeze: '+rel);
  if(entry.isDirectory()){if(!excluded.has(entry.name))rows.push(...await walk(absolute,rel,excluded));}
  else if(entry.isFile())rows.push({path:rel,...await fileRecord(absolute)});
 }return rows;
}
export function requireDelivery(files){
 const byPath=new Map(files.map(row=>[row.path,row]));
 for(const name of requiredFiles)if(!byPath.get(name)?.bytes)throw Error('Missing/empty required delivery file: '+name);
}
export const fingerprint=files=>hash(JSON.stringify(files));
export async function snapshot(root){
 const files=await walk(root);requireDelivery(files);
 return {files,fingerprintSHA256:fingerprint(files)};
}

export async function absoluteInput(value,label){
 if(typeof value!=='string'||!path.isAbsolute(value))throw Error(label+' requires an explicit absolute path');
 if(await fs.realpath(value)!==path.resolve(value))throw Error(label+' symlink boundary');
 return value;
}
/** @typedef {{path:string,bytes:number,sha256:string}} Artifact */
export async function boundArtifact(row){
 if(!row||!Number.isSafeInteger(row.bytes)||row.bytes<0||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('Invalid artifact record');
 if(typeof row.path!=='string'||!path.isAbsolute(row.path))throw Error('Artifact requires absolute path');
 const target=row.resolvedPath||row.path;await absoluteInput(target,'artifact');
 if(await fs.realpath(row.path)!==target)throw Error('Unbound artifact symlink target');
 const actual=await fileRecord(target);
 if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)throw Error('Stale artifact SHA/bytes: '+row.path);
 return {...actual,path:row.path,...(row.resolvedPath?{resolvedPath:row.resolvedPath}:{})};
}
export async function packageBinding(directory,source){
 const root=await absoluteInput(directory,'SGG_PACKAGE_ROOT');
 const {verifyPackage}=await import('./game-build/package.mjs');
 const {canonical}=await import('./game-build/io.mjs');
 const {release,manifestPath}=await verifyPackage(root);
 if(release.syntheticFixture!==false)throw Error('Synthetic final package');
 const names=[...release.files.map(r=>r.path),'game-release.json',manifestPath].sort();
 const files=await walk(root,'',new Set());
 if(JSON.stringify(files.map(r=>r.path).sort())!==JSON.stringify(names))throw Error('Package contains undeclared files');
 if(source){
  if(path.resolve(source)===root||root.startsWith(path.resolve(source)+path.sep))throw Error('Package must be relocated outside source');
  for(const [name,expected] of Object.entries(release.inputs)){
   const bytes=await fs.readFile(path.join(source,name)),value=['docs/design/game-asset-manifest.json','src/audio/manifest.json'].includes(name)?canonical(JSON.parse(bytes)):bytes;
   if(hash(value)!==expected)throw Error('Stale source input: '+name);
  }
  for(const name of ['index.html','sw.js','game-release.json',manifestPath])if((await fileRecord(path.join(source,name))).sha256!==files.find(r=>r.path===name)?.sha256)throw Error('Package differs from shipping: '+name);
 }
 return {root,releaseId:release.releaseId,manifestPath,files,fingerprintSHA256:fingerprint(files)};
}
export async function verifyHttpFile(origin,row){
 const url=new URL(row.path,origin.endsWith('/')?origin:origin+'/');
 if(url.origin!==new URL(origin).origin)throw Error('Foreign HTTP origin');
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)}),bytes=Buffer.from(await response.arrayBuffer());
 const mime=(response.headers.get('content-type')||'').split(';')[0];
 if(response.status!==200||bytes.length!==row.bytes||hash(bytes)!==row.sha256||mime!==row.mime)throw Error('HTTP SHA/MIME/bytes mismatch: '+row.path);
 return {url:String(url),status:response.status,mime,bytes:bytes.length,sha256:hash(bytes)};
}
export async function verifyPreview(receipt,binding){
 if(receipt.schemaVersion!==1||receipt.status!=='serving'||receipt.root!==binding.root||receipt.releaseId!==binding.releaseId||receipt.packageSHA256!==binding.fingerprintSHA256)throw Error('Stale preview binding');
 const origin=new URL(receipt.origin);
 if(origin.origin!==receipt.origin||origin.hostname!=='127.0.0.1'||origin.protocol!=='http:'||!origin.port||[4173,4273,4274].includes(Number(origin.port)))throw Error('Unowned/protected preview origin');
 if(!Number.isSafeInteger(receipt.pid)||receipt.pid<=0||!Number.isFinite(Date.parse(receipt.startedAt)))throw Error('Missing preview owner');
 const {release}=await (await import('./game-build/package.mjs')).verifyPackage(binding.root),rows=[];
 for(const row of binding.files){const declared=release.files.find(r=>r.path===row.path);rows.push(await verifyHttpFile(origin.origin,{...row,mime:declared?.mime||'application/json'}));}
 for(const name of ['src/app_tpl.html','src/audio/manifest.json','tools/build-game.mjs','.git/config']){
  const response=await fetch(new URL('/'+name,origin),{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status!==404)throw Error('Source exposed by preview: '+name);
 }
 return rows;
}
export async function deliveryLinks(hub,entries){
 await absoluteInput(hub,'SGG_DELIVERY_HUB');const text=await fs.readFile(hub,'utf8');
 const links=[...text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map(m=>m[1]);
 if(!links.length||!Array.isArray(entries)||!entries.length)throw Error('Empty delivery links');
 if(new Set(entries.map(r=>r.href)).size!==entries.length)throw Error('Duplicate delivery target');
 if(JSON.stringify([...new Set(links)].sort())!==JSON.stringify(entries.map(r=>r.href).sort()))throw Error('Unbound/missing hub link');
 const results=[];
 for(const row of entries){
  if(typeof row.href!=='string'||/^(?:javascript:|data:|file:)/i.test(row.href))throw Error('Unsafe delivery URL');
  const artifact=await boundArtifact(row.artifact);if(artifact.bytes===0)throw Error('Empty delivery target');
  if(/^https?:/.test(row.href)){
   const url=new URL(row.href);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||[4173,4273,4274].includes(Number(url.port)))throw Error('Unowned delivery URL');
   results.push(await verifyHttpFile(url.origin,{...artifact,path:url.pathname,mime:row.mime}));
  }else{
   const [name,fragment]=decodeURIComponent(row.href).split('#');
   if(path.resolve(path.dirname(hub),name)!==artifact.path)throw Error('Wrong hub file target');
   if(fragment){const body=await fs.readFile(artifact.path,'utf8'),headings=[...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>m[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-'));if(!body.includes('id="'+fragment+'"')&&!headings.includes(fragment))throw Error('Missing delivery anchor');}
   results.push({href:row.href,...artifact});
  }
 }return results;
}

export async function editionLineage({root,evidenceRoot,packageRoot}){
 const file=path.join(await absoluteInput(evidenceRoot,'SGG_EDITION_EVIDENCE_ROOT'),'packages.json');
 const list=JSON.parse(await fs.readFile(file,'utf8'));
 if(!Array.isArray(list)||JSON.stringify(list.map(p=>p.variant))!==JSON.stringify(['A','B','C']))throw Error('Edition packages require ordered unique A B C');
 const {verifyPackage}=await import('./game-build/package.mjs'),{canonical}=await import('./game-build/io.mjs');
 const current=await packageBinding(packageRoot,root),a=await verifyPackage(current.root),template=await fs.readFile(path.join(root,'src/app_tpl.html'));
 if(list[0].root!==current.root)throw Error('Edition A differs from F package');
 const packages=[];
 for(const row of list){
  const binding=await packageBinding(row.root),actual=await verifyPackage(row.root);
  if(canonical(actual.release)!==canonical(row.release))throw Error('Stale edition package declaration');
  const expected={...a.release.inputs};
  if(row.variant!=='A')expected['src/app_tpl.html']=hash(Buffer.concat([template,Buffer.from('\n<!-- SGG final edition '+row.variant+' -->\n')]));
  if(canonical(actual.release.inputs)!==canonical(expected))throw Error('Edition variant differs from current comment-only source');
  packages.push({variant:row.variant,...binding});
 }
 if(new Set(packages.map(p=>p.releaseId)).size!==3)throw Error('Edition releases must be distinct');
 return {input:{path:file,...await fileRecord(file)},packages};
}

export async function validateMedia({set,freeze,receipt}){
 const source=async name=>{
  const row=freeze.files.find(f=>f.path===name);if(!row)throw Error('Missing frozen media source');
  await boundArtifact({...row,path:path.join(set.sourceRoot,name)});return JSON.parse(await fs.readFile(path.join(set.sourceRoot,name),'utf8'));
 };
 const art=await source('docs/design/game-asset-manifest.json'),audio=await source('src/audio/manifest.json');
 const expected=new Map(art.assets.filter(r=>!['thumbnail','icon'].includes(r.kind)).map(r=>['art:'+r.assetId,r]));
 for(const track of audio.tracks)for(const variant of track.variants)expected.set('audio:'+track.id+':'+variant.mime,variant);
 const composites=new Map(art.faces.map(f=>['face:'+f.cardId+':'+f.side,{face:f,set:'fullset'}]));
 for(const p of art.placements)composites.set('placement:'+p.cardId+':'+p.side+':'+p.itemKey,{face:art.faces.find(f=>f.cardId===p.cardId&&f.side===p.side),set:p.itemKey,placement:p});
 const ids=[...expected.keys(),...composites.keys()].sort();
 if(!Array.isArray(set.media)||JSON.stringify(set.media.map(r=>r.id).sort())!==JSON.stringify(ids))throw Error('Incomplete media identities');
 const artShard=receipt.shards.find(s=>s.spec==='tests/game/art-full-review.spec.mjs');
 for(const media of set.media){
  await boundArtifact(media.artifact);const declared=expected.get(media.id);
  if(declared){
   const frozen=freeze.files.find(f=>f.path===declared.path);
   if(!frozen||frozen.sha256!==declared.sha256||frozen.bytes!==declared.bytes||media.artifact.sha256!==declared.sha256||media.artifact.bytes!==declared.bytes)throw Error('Media differs from manifest artifact');
  }else{
   if(!media.proof||!artShard?.attachments?.some(a=>a.path===media.proof.path&&a.sha256===media.proof.sha256&&a.bytes===media.proof.bytes))throw Error('Composite proof is not a final art attachment');
   await boundArtifact(media.proof);const proof=JSON.parse(await fs.readFile(media.proof.path,'utf8')),need=composites.get(media.id);
   const rows=proof.rows?.filter(r=>r.cardId===need.face.cardId&&r.side===need.face.side&&r.set===need.set);
   if(proof.boot?.current?.release!==set.releaseId||proof.manifestSha256!==freeze.files.find(f=>f.path==='docs/design/game-asset-manifest.json').sha256||rows?.length!==1)throw Error('Wrong composite release or identity');
   const row=rows[0],full=row.proofs?.full;
   if(JSON.stringify(row.receiptBinding?.face)!==JSON.stringify(need.face)||row.receiptBinding.faceSha256!==hash(JSON.stringify(need.face))||full?.sha256!==media.artifact.sha256||full?.bytes!==media.artifact.bytes)throw Error('Wrong composite source or export');
   if(need.placement&&!row.receiptBinding.placements.some(p=>JSON.stringify(p.placement)===JSON.stringify(need.placement)&&p.placementSha256===hash(JSON.stringify(need.placement))))throw Error('Wrong composite placement');
  }
  const direct=set.links.find(link=>link.artifact.path===media.artifact.path);
  if(direct){await boundArtifact(direct.artifact);continue;}
  const index=set.links.find(link=>link.artifact.path===media.indexPath);if(!index)throw Error('Missing media delivery index');
  await boundArtifact(index.artifact);const body=await fs.readFile(index.artifact.path,'utf8');
  const refs=[...body.matchAll(/(?:src|href)=["']([^"']+)["']|\[[^\]]*\]\(([^)\s]+)\)/g)].map(m=>m[1]||m[2]);
  if(!refs.some(ref=>{if(/^[a-z]+:/i.test(ref))return false;return path.resolve(path.dirname(index.artifact.path),decodeURIComponent(ref.split(/[?#]/)[0]))===media.artifact.path;}))throw Error('Media absent from delivery index');
 }
 return ids;
}
