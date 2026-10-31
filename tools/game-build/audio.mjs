import {spawnSync} from 'node:child_process';
import {check,read,sha,json,relative} from './io.mjs';
export const cueIds='ui.tap ui.back ui.tab ui.confirm ui.unavailable draw.latch draw.coil draw.seal draw.reveal draw.new draw.result card.flip equip.select equip.preview equip.attach craft.material craft.work craft.complete garage.assemble garage.complete research.correct research.incorrect research.reward qp.complete'.split(' ');
export const bgmIds=['workshop','collection','craft','garage'];
const decodedAudio=new Map();
function command(binary,args,bytes){
  const r=spawnSync(binary,args,{input:bytes,timeout:15000,maxBuffer:16*1024*1024});
  check(!r.error&&r.status===0,`audio decoder failed: ${binary}`);return r.stdout;
}
export async function audioInputs(root){
  const manifest=await json(root,'src/audio/manifest.json');
  check(manifest.schemaVersion===1&&manifest.edition==='game'&&manifest.stage==='release','incomplete audio');
  check(Array.isArray(manifest.tracks)&&manifest.tracks.length===28,'incomplete audio tracks');
  const ids=new Set(),files=[],paths=new Set();let bytesTotal=0;
  for(const track of manifest.tracks){
    const bgm=bgmIds.includes(track.id);check(!ids.has(track.id)&&(bgm||cueIds.includes(track.id))&&track.kind===(bgm?'bgm':'sfx'),'audio ID/kind');ids.add(track.id);
    check(Array.isArray(track.variants)&&track.variants.length===(bgm?2:1),'incomplete audio variants');
    check(JSON.stringify(track.variants.map(v=>v.mime).sort())===JSON.stringify((bgm?['audio/mp4','audio/ogg']:['audio/wav']).sort()),'audio MIME variants');
    for(const variant of track.variants){
      relative(variant.path);check(variant.path.startsWith('src/audio/')&&!paths.has(variant.path),'audio path');paths.add(variant.path);
      const bytes=await read(root,variant.path);bytesTotal+=bytes.length;
      check(bytes.length===variant.bytes&&sha(bytes)===variant.sha256,'audio SHA/size');
      const magic={'audio/ogg':bytes.subarray(0,4).toString()==='OggS','audio/mp4':bytes.subarray(4,8).toString()==='ftyp','audio/wav':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE'};
      check(magic[variant.mime],'audio MIME bytes');
      let decoded=decodedAudio.get(variant.sha256);
      if(!decoded){
      const meta=JSON.parse(command('ffprobe',['-v','error','-count_packets','-show_entries','stream=codec_name,profile,sample_rate,channels:format=duration','-of','json','-i','pipe:0'],bytes));
      const stream=meta.streams?.[0],codec={'audio/ogg':'opus','audio/mp4':'aac','audio/wav':'pcm_s16le'}[variant.mime];
      check(stream?.codec_name===codec,'audio codec');
      const pcm=command('ffmpeg',['-v','error','-i','pipe:0','-f','f32le','-ac','1','pipe:1'],bytes);
      check(pcm.length>0,'empty audio decode');
      decoded={duration:pcm.length/4/Number(stream.sample_rate),frames:pcm.length/4,rate:Number(stream.sample_rate),channels:stream.channels,codec,profile:stream.profile};decodedAudio.set(variant.sha256,decoded);
      }
      check(decoded.rate===variant.sampleRate&&variant.sampleRate===48000&&(bgm||decoded.channels===1),'audio codec/rate');
      const duration=decoded.duration;
      check(Number.isFinite(variant.loopStart)&&Number.isFinite(variant.loopEnd)&&variant.loopStart>=0&&variant.loopEnd>variant.loopStart&&variant.loopEnd<=duration+.05,'audio loop bounds');
      if(['decodedFrames','logicalPeriodSamples','logicalPeriodSeconds','decodedPrimingSamples','trailingPaddingSamples'].some(key=>variant[key]!==undefined)){
        check(Number.isSafeInteger(variant.decodedFrames)&&variant.decodedFrames===decoded.frames,'audio decoded frames');
        check(Number.isSafeInteger(variant.logicalPeriodSamples)&&variant.logicalPeriodSamples>0,'audio logical period');
        check(Number.isSafeInteger(variant.decodedPrimingSamples)&&variant.decodedPrimingSamples>=0,'audio priming');
        check(Number.isSafeInteger(variant.trailingPaddingSamples)&&variant.trailingPaddingSamples>=0,'audio padding');
        check(variant.decodedPrimingSamples+variant.logicalPeriodSamples+variant.trailingPaddingSamples===decoded.frames,'audio frame accounting');
        check(Math.abs(variant.loopStart*decoded.rate-variant.decodedPrimingSamples)<.001&&Math.abs((variant.loopEnd-variant.loopStart)*decoded.rate-variant.logicalPeriodSamples)<.001,'audio logical loop points');
        check(Math.abs(variant.logicalPeriodSeconds*decoded.rate-variant.logicalPeriodSamples)<.001,'audio logical seconds');
        if(variant.encodedSkipSamples!==undefined)check(Number.isSafeInteger(variant.encodedSkipSamples)&&variant.encodedSkipSamples>=0,'audio skip samples');
        if(variant.delayMeasurement!==undefined)check(Number.isFinite(variant.delayMeasurement.correlation)&&variant.delayMeasurement.correlation>=.95&&variant.delayMeasurement.correlation<=1,'audio delay measurement');
        check(variant.channels===decoded.channels&&variant.codec===decoded.codec,'audio declared codec/channels');
        if(bgm&&variant.mime==='audio/mp4')check(variant.profile==='LC'&&decoded.profile==='LC','audio AAC-LC profile');
      }
      files.push({...variant,...(manifest.mix?{mix:manifest.mix}:{}),id:track.id,kind:track.kind,body:bytes});
    }
  }
  check(bytesTotal<=8000000,'audio budget');
  check(Array.isArray(manifest.sources)&&manifest.sources.length>=7,'audio source provenance');
  const sourceNames=manifest.sources.map(s=>s.path);
  for(const required of ['src/audio/score.json','src/audio/patches.json','src/audio/mix.json','src/audio/cues.json','tools/audio/render.mjs','tools/audio/encode.mjs','tools/audio/verify.mjs'])check(sourceNames.includes(required),'audio source missing');
  check(new Set(sourceNames).size===sourceNames.length,'duplicate audio sources');
  for(const source of manifest.sources){relative(source.path);check(/^(src|tools)\/audio\//.test(source.path)&&sha(await read(root,source.path))===source.sha256,'audio source SHA');}
  if(manifest.mix!==undefined){
    const mix=await json(root,'src/audio/mix.json');
    check(JSON.stringify(mix)===JSON.stringify(manifest.mix),'audio mix source mismatch');
    check(mix.masterSafetyGain===.85&&mix.defaultBgmGain===.3&&mix.defaultSfxGain===.6&&mix.maxSfxVoices===6,'audio mix policy');
  }
  return {manifest,files};
}
