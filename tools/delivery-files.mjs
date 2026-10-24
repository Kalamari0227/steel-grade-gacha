import fs from 'node:fs/promises';
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
 const bytes=await fs.readFile(file);return {bytes:bytes.length,sha256:hash(bytes)};
}
export async function walk(directory,relative=''){
 const rows=[];
 for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const rel=path.posix.join(relative,entry.name),absolute=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw Error('Review symlink before freeze: '+rel);
  if(entry.isDirectory()){if(!excludedDirectories.has(entry.name))rows.push(...await walk(absolute,rel));}
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
