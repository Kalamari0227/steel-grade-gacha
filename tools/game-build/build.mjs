import fs from 'node:fs/promises';
import path from 'node:path';
import {collect,assertFresh} from './inputs.mjs';
import {render} from './render.mjs';
import {verifyPackage} from './package.mjs';
import {openPublication} from './publication.mjs';
import {check,sha,canonical,read,write,boundary,exists} from './io.mjs';
async function assemble(input,stage){
  const prefix=`assets/game/${input.releaseId}/`,assetMap={},audioMap={},files=[];
  async function entry(name,body,mime,classification){
    const bytes=Buffer.from(body);await write(stage,name,bytes);files.push({path:name,sha256:sha(bytes),bytes:bytes.length,mime,classification});return name;
  }
  for(const row of input.art){
    const url=prefix+row.assetId.replaceAll(':','-')+'.'+row.sha256+path.extname(row.path);
    await entry(url,row.body,row.mime,['scene:workshop:back','scene:workshop:foreground','stage:plinth'].includes(row.assetId)||row.kind==='icon'?'critical':'optional');
    assetMap[row.assetId]={url,sha256:row.sha256,mime:row.mime,bytes:row.bytes};
  }
  for(const row of input.audio.files){
    const ext={'audio/ogg':'.ogg','audio/mp4':'.m4a','audio/wav':'.wav'}[row.mime],url=prefix+'audio-'+row.id+'.'+row.sha256+ext;
    await entry(url,row.body,row.mime,'optional');
    const timing={};
    for(const key of ['channels','codec','profile','logicalPeriodSamples','logicalPeriodSeconds','decodedFrames','decodedPrimingSamples','encodedSkipSamples','trailingPaddingSamples','delayMeasurement','loopStrategy','mix'])if(row[key]!==undefined)timing[key]=row[key];
    (audioMap[row.id]??=[]).push({url,sha256:row.sha256,bytes:row.bytes,mime:row.mime,sampleRate:row.sampleRate,loopStart:row.loopStart,loopEnd:row.loopEnd,...timing});
  }
  const html=render({...input,assetMap,audioMap});
  const shell=[['index.html',html,'text/html'],['manifest.webmanifest',input.source['manifest.webmanifest'],'application/manifest+json']];
  for(const [name,body,mime] of shell){await entry(name,body,mime,'critical');await entry(prefix+path.parse(name).name+'.'+sha(body)+path.extname(name),body,mime,'critical');}
  for(const [id,name] of [['192','icon-192.png'],['512','icon-512.png'],['180','apple-touch-icon.png']])await entry(name,input.art.find(r=>r.assetId==='icon:'+id).body,'image/png','critical');
  for(const row of input.comics)await entry(row.path,row.body,'image/webp','optional');
  const sw=`var GAME_RELEASE_ID = "${input.releaseId}";\nvar GAME_RELEASE_ASSETS = ${canonical(files)};\n`+input.source['src/game-sw-template.js'];
  await entry('sw.js',sw,'text/javascript','critical');
  await entry(prefix+'sw.'+sha(sw)+'.js',sw,'text/javascript','critical');
  const release={schemaVersion:1,edition:'game',releaseId:input.releaseId,syntheticFixture:input.syntheticFixture,inputs:input.inputs,files:files.sort((a,b)=>a.path.localeCompare(b.path))};
  const body=canonical(release),manifestPath=prefix+`manifest.${sha(body)}.json`;
  await write(stage,manifestPath,body);await write(stage,'game-release.json',body);await verifyPackage(stage);
  return {release,manifestPath};
}
export async function buildGame(options){
  const root=await boundary(options.root),target=await boundary(options.out);
  if(options.syntheticFixture)check(target!==root&&!target.startsWith(path.resolve(import.meta.dirname,'../..')+path.sep),'fixture output must be isolated');
  check(target===root||(!target.startsWith(root+path.sep)&&!root.startsWith(target+path.sep)),'build output overlaps source');
  const publication=openPublication(target);
  try{
    if(target!==root&&await exists(target)){
      check(await exists(path.join(target,'game-release.json')),'refuse unrelated build output');await verifyPackage(target);
    }
    const input=await collect(root,options.syntheticFixture),stage=publication.stage;
    const {release}=await assemble(input,stage);await assertFresh(input,root);await publication.publish(release);
    return {status:'PASS',releaseId:release.releaseId,syntheticFixture:release.syntheticFixture,files:release.files.length,indexSHA:release.files.find(r=>r.path==='index.html').sha256};
  }finally{publication.close();}
}
