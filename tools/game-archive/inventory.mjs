import fs from 'node:fs';
import path from 'node:path';
import {check,sha,json,encode,read,within,tree,strings,member,checked,validateMaster} from './paths.mjs';
const reviewGroups=['cars','environments','ga','items-portable','items-process','masters','parts-body','parts-chassis','parts-frame','pilot11','placements','poo','ssial','wire-special'];
const producers=['task-9/special/export.py','task-12/foundations/export.py','task-12/foundations/draw-crops.py','task-12/foundations/prepared-unreviewed.json','task-12/rooms/prepare-and-verify.mjs','task-12/rooms/initial-rows.json','task-12/rooms/exports.json',...[13,14,15,16].flatMap(n=>[`task-${n}/export.mjs`,`task-${n}/source-inputs.json`]),'task-17/export.mjs','task-17/receipts.mjs','task-17/observations.json',...['arrow','dagger','glass','loupe','potion','shield','spark'].map(n=>`task-17/${n}-tool.json`),'task-18/export.py','task-18/receipts.py','task-18/sources.json','task-18/prompts-complete.json','task-18/observations.json','task-19/export.mjs','task-19/prepare-receipts.mjs','task-19/generation-inputs.json','task-19/initial-manifest.json',...[20,21].flatMap(n=>[`task-${n}/export-review.py`,`task-${n}/export-metrics.json`,`task-${n}/input-snapshot.json`]),'task-22/export-review.py','task-22/receipts.mjs','task-22/exports.json','task-22/observations.json',...['b','d','h','m','n','s','t','z'].map(n=>`task-22/draft/generation/${n}-attempt1.json`)];
const sourceKeys=new Set(['sourcePath','generatedSourcePath','generatedPath','inputPath','source','original','path']);
const pathPrefixes=/^(?:src|docs|tools|webtoon)\//;
function secrets(body,name){
  if(!/\.(?:json|mjs|js|md|txt|html|py|sh)$/.test(name))return;
  const text=body.toString();
  check(!/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bBearer\s+[A-Za-z0-9._-]{30,}/.test(text),'secret-like content: '+name);
}
export function collectInventory(root){
  root=checked(root);const parent=path.dirname(root),evidence=parent+'/.omo/evidence/game-edition/game-20261025-01a16bac';
  const entries=new Map(),bySHA=new Map(),mappings=[],annotations=[],observed=[];
  function add(source,name,role,expected){
    member(name);const body=read(source),hash=sha(body);check(!expected||hash===expected,'hash-mismatch: '+name+' expected '+expected+' actual '+hash);secrets(body,name);
    if(entries.has(name)){check(entries.get(name).sha256===hash,'inventory collision: '+name);return entries.get(name);}
    const row={path:name,bytes:body.length,sha256:hash,role,source};entries.set(name,row);if(!bySHA.has(hash))bySHA.set(hash,name);return row;
  }
  const local=(name,role,expected)=>add(within(root,name),name,role,expected);
  function group(name,extensions,role){const t=tree(root,extensions);t.visit(name);for(const file of t.result)local(file,role);}
  const art=json(read(within(root,'docs/design/game-asset-manifest.json'))),audio=json(read(within(root,'src/audio/manifest.json')));
  for(const row of [...art.assets,...art.optionalDerived]){
    validateMaster(root,row);local(row.path,'art-export',row.sha256);local(row.masterPath,'art-master',row.masterSha256);local(row.reference,'approved-reference');local(row.reviewReceipt,'review-receipt');
    const review=json(read(within(root,row.reviewReceipt)));local(review.generation.sourceEvidence,'generation-receipt',review.generation.sourceEvidenceSha256);
    for(const checkRow of Object.values(review.checks))if(checkRow.evidence)local(checkRow.evidence,'review-proof');
  }
  for(const row of art.placements){local(row.reviewReceipt,'placement-receipt');const review=json(read(within(root,row.reviewReceipt)));for(const k of ['fullCard','at72'])local(review[k].path,'placement-proof',review[k].sha256);}
  for(const dir of reviewGroups)group('docs/design/game-reviews/'+dir,['.png','.json','.md','.mjs','.html'],'production-history');
  for(const name of ['README.md','manifest-fragment.schema.json','placement-receipt.schema.json','producer-example.mjs','review-receipt.schema.json'])local('docs/design/game-reviews/'+name,'review-contract');
  group('docs/design/game-reference',['.png','.json','.md'],'approved-reference');
  for(const dir of ['img','partimg','carimg'])group('src/'+dir,['.jpg','.png'],'identity-reference');
  group('src/audio',['.json','.md','.wav','.m4a','.ogg'],'audio-production');
  for(const row of audio.sources)local(row.path,'audio-source',row.sha256);
  for(const row of audio.masters)local(row.path,'audio-master',row.sha256);
  for(const row of audio.tracks.flatMap(t=>t.variants))local(row.path,'audio-runtime',row.sha256);
  for(const dir of ['tools/audio','tools/game-build','tools/game-assets','tools/game-archive'])group(dir,['.mjs','.json','.md'],'executable-source');
  for(const name of fs.readdirSync(root+'/src/game'))if(/\.(?:js|css|md)$/.test(name))local('src/game/'+name,'game-source');
  for(const name of ['src/app_tpl.html','src/pwa_head.txt','src/pwa_body.txt','src/game-sw-template.js','src/build.sh','manifest.webmanifest','package.json','package-lock.json','tools/build-game.mjs','tools/package-game.mjs','tools/build-game-manifest.mjs','tools/verify-game-assets.mjs','tools/archive-game-sources.mjs','tests/fixtures/catalog.json','tests/game/archive.node.mjs'])local(name,'executable-source');
  for(const name of fs.readdirSync(root+'/docs/design'))if(/^game-.*\.(md|json)$/.test(name))local('docs/design/'+name,'production-document');
  for(const name of ['README.md','docs/game-maintenance.md','docs/releases/game-edition.md'])local(name,'production-document');
  local('docs/design/art-bible.md','identity-document');
  for(const name of Object.keys(json(read(root+'/tools/game-build/comics.json'))))local(name,'original-comic');
  for(const name of producers)add(within(evidence,name),'source-materials/producer-code/'+name,'historical-producer');
  for(const name of ['audio-correction-receipt.json','audio-before-correction.json','corrected-audio.json','independent-verification.json'])add(within(evidence,'task-11/'+name),'source-materials/reviews/audio/task-11/'+name,'audio-correction-history');
  for(const name of ['done-claim.json','independent-verification.json','native-audio-audit.json'])add(within(evidence,'task-31/attempt-2/'+name),'source-materials/reviews/integration/task-31/'+name,'integration-history');
  add(parent+'/.omo/research/game-edition-references-2026-10-25.md','source-materials/references/game-edition-references-2026-10-25.md','reference-research');
  const reference=json(read(root+'/docs/design/game-reference/provenance.json'));
  const allowedGenerated=new Set(reference.approvedReferencesAndTemporaryArt.map(r=>path.dirname(r.source)).filter(p=>p.includes('/.codex/generated_images/')));
  const downloads=reference.externalReference.path;
  function source(value,expected){
    if(pathPrefixes.test(value))return local(value,'mapped-source',expected);
    if(value.startsWith(root+'/'))return local(path.relative(root,value),'mapped-source',expected);
    if(value.startsWith(evidence+'/baselines/original/src/img/'))return add(checked(value),'source-materials/references/original/src/img/'+path.basename(value),'baseline-identity',expected);
    if([...allowedGenerated].some(dir=>path.dirname(path.dirname(value))===path.dirname(dir))&&/^[a-f0-9-]{36}$/.test(path.basename(path.dirname(value)))&&/^exec-[\w-]+\.png$/.test(path.basename(value))){
      const body=read(value),hash=sha(body);observed.push({source:value,path:value,sha256:hash});check(!expected||hash===expected,'hash-mismatch: '+value);const match=bySHA.get(hash);if(match)return entries.get(match);
      return add(value,'source-materials/generated/'+hash+'.png','raw-generation',expected);
    }
    if(value===downloads)return add(value,'source-materials/references/space-2.html','inert-external-reference',expected);
    throw new Error('source outside allowlist: '+value);
  }
  // Only immutable production/reference receipts supply source pointers. Producer commands and QA claims stay inert.
  const receipts=[...entries.values()].filter(row=>row.path.endsWith('.json')&&/^docs\/design\/game-(reviews|reference)\//.test(row.path));
  for(const receipt of receipts)strings(json(read(receipt.source)),(value,p,parentObject,key)=>{
    const candidate=(value.startsWith('/')||pathPrefixes.test(value))&&(sourceKeys.has(key)||/\/(?:referencedImagePaths|referenceFiles|referencedImages|invocation)\/\d+(?:\/path)?$/.test(p));
    if(key==='sourceRun'){annotations.push({receiptPath:receipt.path,jsonPointer:p,value,reason:'historical QA directory, never dereferenced'});return;}
    if(!candidate)return;
    const expected=key==='sourcePath'?parentObject.sourceSha256:key==='generatedSourcePath'||key==='generatedPath'?parentObject.generatedSourceSha256:key==='inputPath'?parentObject.inputSha256:parentObject.sha256;
    const row=source(value,expected);
    mappings.push({receiptPath:receipt.path,jsonPointer:p,original:value,archivedPath:row.path,sha256:row.sha256,role:row.role,sourceClass:value.includes('/.codex/generated_images/')?'generated-original':value.includes('/baselines/original/')?'baseline-identity':value===downloads?'external-reference':path.isAbsolute(value)?'checkout-absolute':'checkout-relative'});
  });
  const map=encode({version:1,entries:mappings,annotations});entries.set('source-materials/provenance-map.json',{path:'source-materials/provenance-map.json',bytes:map.length,sha256:sha(map),role:'provenance-map',body:map});
  const files=[...entries.values()].sort((a,b)=>a.path.localeCompare(b.path));
  const folded=new Set();for(const file of files){const key=file.path.normalize('NFC').toLowerCase();check(!folded.has(key),'case-collision: '+file.path);folded.add(key);}
  const counts={base:art.assets.filter(r=>!['thumbnail','icon'].includes(r.kind)).length,exports:art.assets.length+art.optionalDerived.length,masters:new Set([...art.assets,...art.optionalDerived].map(r=>r.masterPath)).size,faces:art.faces.length,placements:art.placements.length,audioMasters:audio.masters.length,audioVariants:audio.tracks.flatMap(t=>t.variants).length,comics:Object.keys(json(read(root+'/tools/game-build/comics.json'))).length,sourceBytes:files.reduce((n,r)=>n+r.bytes,0),runtimeArtBytes:[...art.assets,...art.optionalDerived].reduce((n,r)=>n+r.bytes,0),runtimeAudioBytes:audio.tracks.flatMap(t=>t.variants).reduce((n,r)=>n+r.bytes,0)};
  const payload=files.map(({source,body,...row})=>row),inputDigest=sha(encode(payload));
  const manifest=encode({version:1,inputDigest,counts,files:payload,requiredMappings:mappings.map(({receiptPath,jsonPointer})=>({receiptPath,jsonPointer}))});
  return {files,manifest,inputDigest,counts,mappings,annotations,observed};
}
export function assertFresh(inventory){for(const row of [...inventory.files,...(inventory.observed||[])])if(row.source)check(sha(read(row.source))===row.sha256,'stale input: '+row.path);}
