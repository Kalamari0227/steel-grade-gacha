import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verify} from '../game-assets/verify.mjs';
import {validateSchema} from '../game-assets/schema.mjs';
import {imageMime,decode} from '../game-assets/images.mjs';
import {read,json,check,sha,exists,canonical} from './io.mjs';
import {audioInputs} from './audio.mjs';
const decodedImages=new Map();
const toolRoot=fileURLToPath(new URL('../../',import.meta.url));
export const sourceNames=['src/app_tpl.html','src/pwa_head.txt','src/pwa_body.txt','src/game/edition.js','src/game/backup.js','src/game/audio.js','src/game/audiovisual.js','src/game/presentation.js','src/game/home.js','src/game/collection.js','src/game/equipment.js','src/game/draw.js','src/game/crafting.js','src/game/garage.js','docs/design/game-reviews/parts-body/assembly-metadata.json','docs/design/game-reviews/parts-frame/assembly-metadata.json','docs/design/game-reviews/parts-chassis/assembly-metadata.json','src/game/game.css','src/game-sw-template.js','manifest.webmanifest'];
export async function collect(root,syntheticFixture){
  const marker=await exists(path.join(root,'SYNTHETIC_GAME_BUILD_FIXTURE.json'));
  if(syntheticFixture){
    check(root!==path.resolve(toolRoot)&&marker,'fixture must use separate declared input root');
    const declaration=await json(root,'SYNTHETIC_GAME_BUILD_FIXTURE.json');
    check(canonical(declaration)===canonical({purpose:'synthetic-game-build-tests',version:1}),'fixture declaration');
  }else check(!marker,'synthetic fixture cannot be production');
  const manifest=await json(root,'docs/design/game-asset-manifest.json');
  validateSchema(manifest);
  check(manifest.assets.every(a=>a.status==='approved'),`pending assets: ${manifest.assets.filter(a=>a.status!=='approved').length}`);
  if(!syntheticFixture)await verify(manifest,{root,reviewRoot:'docs/design/game-reviews',group:'all'});
  const art=[];
  for(const row of [...manifest.assets,...manifest.optionalDerived]){
    const body=await read(root,row.path);check(body.length===row.bytes&&sha(body)===row.sha256,'art SHA/size');check(imageMime(body)===row.mime,'art MIME');
    art.push({...row,body});
  }
  const audio=await audioInputs(root),source={},inputs={};
  for(const row of art){
    let actual=decodedImages.get(row.sha256);
    if(!actual){actual=decode(row.body);decodedImages.set(row.sha256,actual);}
    check(actual.width===row.dimensions.width&&actual.height===row.dimensions.height&&actual.visible>0,'art dimensions');
    if(row.alphaRequired)check(actual.transparent>0,'art alpha');
  }
  for(const name of sourceNames){const body=await read(root,name);source[name]=body.toString();inputs[name]=sha(body);}
  inputs['docs/design/game-asset-manifest.json']=sha(canonical(manifest));
  inputs['src/audio/manifest.json']=sha(canonical(audio.manifest));
  for(const row of [...art,...audio.files])inputs[row.path]=row.sha256;
  for(const row of audio.manifest.sources)inputs[row.path]=row.sha256;
  const comicContract=await json(toolRoot,'tools/game-build/comics.json');
  const comicReferences=[...new Set(source['src/app_tpl.html'].match(/webtoon\/[\w-]+\.webp/g))].sort();
  check(canonical(comicReferences)===canonical(Object.keys(comicContract).sort()),'exact 18 original comic references');
  const comics=[];
  for(const [name,expected] of Object.entries(comicContract)){const body=await read(root,name);check(sha(body)===expected,'original comic SHA');inputs[name]=expected;comics.push({path:name,body});}
  for(const dir of ['tools/game-build','tools/game-assets']){
    for(const file of (await fs.readdir(path.join(toolRoot,dir))).sort()){
      if(file.endsWith('.mjs')||file.endsWith('.json'))inputs[dir+'/'+file]=sha(await read(toolRoot,dir+'/'+file));
    }
  }
  for(const name of ['tools/build-game.mjs','tools/package-game.mjs','src/build.sh'])inputs[name]=sha(await read(toolRoot,name));
  const releaseId=sha(canonical({schemaVersion:1,syntheticFixture,inputs}));
  return {manifest,art,audio,source,comics,inputs,releaseId,syntheticFixture};
}

export async function assertFresh(input,root){
  for(const [name,expected] of Object.entries(input.inputs)){
    const base=name.startsWith('tools/game-')||['tools/build-game.mjs','tools/package-game.mjs','src/build.sh'].includes(name)?toolRoot:root;
    const body=await read(base,name);
    const value=['docs/design/game-asset-manifest.json','src/audio/manifest.json'].includes(name)?canonical(JSON.parse(body.toString())):body;
    check(sha(value)===expected,`stale input: ${name}`);
  }
}
