import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha,canonical,write,read,check} from '../../tools/game-build/io.mjs';
import {sourceNames} from '../../tools/game-build/inputs.mjs';
import {bgmIds,cueIds} from '../../tools/game-build/audio.mjs';
export async function fixture(source,root){
  await fs.mkdir(root,{recursive:true});
  await write(root,'SYNTHETIC_GAME_BUILD_FIXTURE.json',canonical({purpose:'synthetic-game-build-tests',version:1}));
  for(const name of sourceNames.filter(n=>!['src/game/audio.js','src/game/presentation.js','src/game/game.css'].includes(n)))await write(root,name,await read(source,name));
  await write(root,'src/game/audio.js',(await read(source,'src/game/audio.js')).toString()+'\nvar fixtureAudioImplementation = GAME_AUDIO; GAME_AUDIO = Object.freeze({...fixtureAudioImplementation,boot:function(bridge){window.fixtureAudioBridge=bridge;return fixtureAudioImplementation.boot(bridge);}});');
  await write(root,'src/game/presentation.js',(await read(source,'src/game/presentation.js')).toString()+'\nvar fixturePresentationImplementation = GAME_PRESENTATION; GAME_PRESENTATION = Object.freeze({...fixturePresentationImplementation,boot:function(bridge){window.fixturePresentationBridge=bridge;return fixturePresentationImplementation.boot(bridge);}});');
  await write(root,'src/game/game.css','body{--fixture-style-applied:1}');
  const manifest=JSON.parse((await read(source,'docs/design/game-asset-manifest.json')).toString());
  manifest.stage='release';
  for(const [i,row] of manifest.assets.entries()){
    const {width,height}=row.dimensions,raw=Buffer.alloc(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const p=(y*width+x)*4;raw[p]=(i+1)%256;raw[p+1]=(i*31)%256;raw[p+2]=(x+y)%256;raw[p+3]=row.alphaRequired&&x<width/4?0:255;
    }
    const result=spawnSync('ffmpeg',['-v','error','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-i','pipe:0','-frames:v','1',...(row.mime==='image/png'?['-c:v','png']:['-c:v','libwebp','-lossless','1']),'-f','image2pipe','pipe:1'],{input:raw,timeout:15000,maxBuffer:16*1024*1024});
    check(result.status===0,'synthetic raster encoder');
    row.status='approved';row.bytes=result.stdout.length;row.sha256=sha(result.stdout);row.masterSha256=sha('synthetic');row.reviewReceipt='synthetic-fixture/never-production.json';
    await write(root,row.path,result.stdout);
  }
  for(const row of manifest.optionalDerived)await write(root,row.path,await read(source,row.path));
  await write(root,'docs/design/game-asset-manifest.json',canonical(manifest));
  const comics=JSON.parse((await read(source,'tools/game-build/comics.json')).toString());
  for(const name of Object.keys(comics))await write(root,name,await read(source,name));
  const sources=[];
  for(const name of ['src/audio/score.json','src/audio/patches.json','src/audio/mix.json','src/audio/cues.json','tools/audio/render.mjs','tools/audio/encode.mjs','tools/audio/verify.mjs']){
    const body=name.endsWith('.json')?'{}':'// SYNTHETIC fixture only\n';await write(root,name,body);sources.push({path:name,sha256:sha(body)});
  }
  const waves={};
  for(const [mime,codec,format] of [['audio/ogg','libopus','ogg'],['audio/mp4','aac','mp4'],['audio/wav','pcm_s16le','wav']]){
    const result=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=0.1','-ac','1','-c:a',codec,...(format==='mp4'?['-movflags','frag_keyframe+empty_moov']:[]),'-f',format,'pipe:1'],{timeout:15000,maxBuffer:1000000});check(result.status===0,'synthetic audio encoder');waves[mime]=result.stdout;
  }
  const tracks=[];
  for(const id of [...bgmIds,...cueIds]){
    const bgm=bgmIds.includes(id),variants=[];
    for(const mime of bgm?['audio/ogg','audio/mp4']:['audio/wav']){
      const body=waves[mime],name=`src/audio/encoded/${id}.${{'audio/ogg':'ogg','audio/mp4':'m4a','audio/wav':'wav'}[mime]}`;
      await write(root,name,body);variants.push({path:name,mime,bytes:body.length,sha256:sha(body),sampleRate:48000,loopStart:0,loopEnd:.1});
    }
    tracks.push({id,kind:bgm?'bgm':'sfx',variants});
  }
  await write(root,'src/audio/manifest.json',canonical({schemaVersion:1,edition:'game',stage:'release',sources,tracks}));
  return manifest;
}
