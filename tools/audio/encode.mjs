import {ROOT,RATE,args,json,read,write,sha,run,probe,decode,sources,wav,check} from './core.mjs';
const a=args(),root=a.get('--root',ROOT);if(!a.has('--all'))throw new Error('require --all');
const score=json(root,'src/audio/score.json'),cues=json(root,'src/audio/cues.json'),render=json(root,'src/audio/render-receipt.json'),tracks=[];
const previous=a.has('--aac-only')?json(root,'src/audio/manifest.json'):null;
const guardSamples=1088;
for(const t of [...score.tracks,...cues.cues]){
 const bgm=!!t.bpm,variants=[];
 for(const ext of bgm?['ogg','m4a']:['wav']){
  if(previous&&ext!=='m4a'){
   const variant=previous.tracks.find(row=>row.id===t.id).variants.find(v=>v.mime===(ext==='ogg'?'audio/ogg':'audio/wav'));
   check(sha(read(root,variant.path))===variant.sha256,'unchanged variant hash');variants.push(variant);continue;
  }
  const p=bgm?`src/audio/encoded/${t.id}.${ext}`:`src/audio/cues/${t.id}.wav`;
  if(bgm){let input=read(root,`src/audio/masters/${t.id}.wav`);
   if(ext==='m4a'){
    const pcm=decode(input),guarded=new Float32Array(pcm.length+guardSamples*2);
    guarded.set(pcm.subarray(pcm.length-guardSamples*2));guarded.set(pcm,guardSamples*2);input=wav(guarded,2);
   }
   const argv=['-v','error','-i','pipe:0','-map_metadata','-1','-ar','48000',...(ext==='ogg'?['-c:a','libopus','-b:a','96k','-vbr','off','-application','audio','-f','ogg']:['-c:a','aac','-profile:a','aac_low','-b:a','128k','-movflags','frag_keyframe+empty_moov','-f','mp4']),'pipe:1'];write(root,p,run('ffmpeg',argv,input).stdout);}
  const bytes=read(root,p),meta=probe(bytes),stream=meta.streams[0],decoded=decode(bytes),sampleRate=Number(stream.sample_rate),frames=decoded.length/stream.channels,period=bgm?Math.round(64*60/t.bpm*RATE):Math.round(t.duration*RATE);
  // Periodic AAC pre-roll protects the full musical cycle when Apple trims its 2112-frame delay.
  // Actual browser priming/padding trimming is resolved against measured frames by the runtime.
  const skip=meta.packets?.[0]?.side_data_list?.find(s=>s.skip_samples)?.skip_samples||0;
  let priming=0,delayCorrelation=1;
  if(bgm){
   const reference=decode(read(root,`src/audio/masters/${t.id}.wav`)),ch=stream.channels;
   let best=-Infinity;
   for(let lag=0;lag<=Math.min(4096,frames-period);lag++){
    let dot=0,xx=0,yy=0;
    for(let frame=2048;frame<16000;frame+=24){const x=reference[frame*ch],y=decoded[(frame+lag)*ch];dot+=x*y;xx+=x*x;yy+=y*y;}
    const correlation=dot/Math.sqrt(xx*yy);
    if(correlation>best){best=correlation;priming=lag;}
   }
   delayCorrelation=best;
   if(ext==='m4a'){
    const exact=guardSamples+1024;
    check(Math.abs(priming-exact)<=1,'AAC correlation must agree with encoder frame and periodic guard');
    priming=exact;
    let dot=0,xx=0,yy=0;
    for(let frame=2048;frame<16000;frame+=24){const x=reference[frame*ch],y=decoded[(frame+priming)*ch];dot+=x*y;xx+=x*x;yy+=y*y;}
    delayCorrelation=dot/Math.sqrt(xx*yy);
   }
   if(delayCorrelation<.95)throw new Error(`codec delay correlation too weak ${t.id}: ${best}`);
  }
  variants.push({path:p,mime:ext==='ogg'?'audio/ogg':ext==='m4a'?'audio/mp4':'audio/wav',bytes:bytes.length,sha256:sha(bytes),sampleRate,channels:stream.channels,codec:stream.codec_name,profile:stream.profile||null,loopStart:priming/sampleRate,loopEnd:(priming+period)/sampleRate,logicalPeriodSamples:period,logicalPeriodSeconds:period/sampleRate,decodedFrames:frames,decodedPrimingSamples:priming,delayMeasurement:{method:'PCM normalized cross-correlation, lag candidates bounded by decoded padding, 582 samples',correlation:delayCorrelation},encodedSkipSamples:skip,...(ext==='m4a'?{periodicPreRollSamples:guardSamples}:{}),trailingPaddingSamples:frames-priming-period,containerDurationSeconds:Number(meta.format?.duration)||null,loopStrategy:'buffer-boundaries; preserve logical period; optional 20ms overlap at runtime'});
  console.log(`encoded ${t.id} ${ext}: ${bytes.length} bytes; decoded ${frames} frames`);
 }
 tracks.push({id:t.id,kind:bgm?'bgm':'sfx',variants});
}
write(root,'src/audio/manifest.json',{schemaVersion:1,edition:'game',stage:'release',mix:json(root,'src/audio/mix.json'),seed:render.seed,versions:{node:process.version,ffmpeg:run('ffmpeg',['-version']).stdout.toString().split('\n')[0],ffprobe:run('ffprobe',['-version']).stdout.toString().split('\n')[0]},sources:sources(root),masters:render.masters,tracks});
