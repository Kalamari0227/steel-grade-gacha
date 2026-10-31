import fs from 'node:fs';
import path from 'node:path';
import {ROOT,RATE,args,json,read,write,sha,run,probe,decode,stats,loudness,check,sources,sourcePaths,bgmIds,cueIds,wav,floats} from './core.mjs';
import {renderTrack,renderCue} from './synthesis.mjs';
export function verify(root,{repeat=false,maxBytes=8000000,artifactDir=null}={}){
 const m=json(root,'src/audio/manifest.json'),score=json(root,'src/audio/score.json'),patches=json(root,'src/audio/patches.json'),mix=json(root,'src/audio/mix.json'),cues=json(root,'src/audio/cues.json'),report={status:'running',checks:0,tracks:[],masters:[],subjectiveListening:'unverified: no listening-capable tool; waveform/score/decode evidence only'};
 const assert=(ok,msg)=>{report.checks++;check(ok,msg);};
 assert(m.schemaVersion===1&&m.stage==='release'&&m.edition==='game','manifest schema');
 assert(JSON.stringify(m.tracks.map(t=>t.id).sort())===JSON.stringify([...bgmIds,...cueIds].sort()),'missingcue or duplicate');
 assert(JSON.stringify(m.sources.map(s=>s.path).sort())===JSON.stringify(sourcePaths.slice().sort()),'source closure');
 for(const s of m.sources)assert(sha(read(root,s.path))===s.sha256,`stale source hash ${s.path}`);
 let total=0;const paths=new Set();
 for(const t of m.tracks){assert(t.kind===(bgmIds.includes(t.id)?'bgm':'sfx'),'kind');assert(t.variants.length===(t.kind==='bgm'?2:1),'variant count');for(const v of t.variants){assert(!path.isAbsolute(v.path)&&!v.path.split('/').includes('..')&&v.path.startsWith('src/audio/')&&!paths.has(v.path),'unsafe/duplicate path');paths.add(v.path);assert(!fs.lstatSync(path.join(root,v.path)).isSymbolicLink(),'symlink');const b=read(root,v.path);assert(sha(b)===v.sha256&&b.length===v.bytes,`wronghash ${t.id}`);total+=b.length;}}
 assert(total<=maxBytes,'budget exceeded');report.bytes=total;
 assert(cues.cues.reduce((s,c)=>s+c.duration,0)<=22,'cue total duration');
 for(const c of cues.cues){const [lo,hi]={ui:[.04,.18],mechanics:[.12,.45],positive:[.3,.9],grand:[1.2,2.4]}[c.category]||[];assert(c.duration>=lo&&c.duration<=hi,`cue duration ${c.id}`);}
 assert(JSON.stringify(m.masters.map(x=>x.id).sort())===JSON.stringify([...bgmIds,...cueIds].sort()),'master inventory');
 const rms=[],unique=new Set();let bgmPeak=0,sfxPeak=0,sfxTruePeak=0;const bgmBuffers=[],cueBuffers=[];
 for(const master of m.masters){const b=read(root,master.path);assert(sha(b)===master.sha256,`master hash ${master.id}`);assert(b.readUInt16LE(20)===3&&b.readUInt32LE(24)===RATE&&b.readUInt16LE(34)===32,'master float32 48k WAV');const bgm=bgmIds.includes(master.id),pcm=decode(b),st=stats(pcm,bgm?2:1);assert(st.rmsDb>-60&&st.peak>0,'silent master');assert(Math.abs(st.dc)<.001,'master DC');if(bgm){assert(st.seam<.012&&st.seam<=st.maxAdjacentJump*1.5,'badloop seam');assert(st.samples===master.periodSamples,'master period');}if(repeat){const t=score.tracks.find(t=>t.id===master.id),c=cues.cues.find(c=>c.id===master.id),again=t?renderTrack(t,score,patches,mix,m.seed).bytes:renderCue(c,patches,mix,m.seed).bytes;assert(sha(again)===master.sha256,`repeat render mismatch ${master.id}`);}report.masters.push({id:master.id,sha256:master.sha256,...st,repeatVerified:repeat});}
 for(const t of m.tracks){const bgm=t.kind==='bgm',row={id:t.id,variants:[]};for(const v of t.variants){const b=read(root,v.path),p=probe(b),stream=p.streams[0],pcm=decode(b),channels=stream.channels,rate=Number(stream.sample_rate),st=stats(pcm,channels),start=Math.round(v.loopStart*rate),end=Math.round(v.loopEnd*rate),logical=pcm.slice(start*channels,end*channels),ls=stats(logical,channels);
 assert(stream.codec_name===({'audio/ogg':'opus','audio/mp4':'aac','audio/wav':'pcm_s16le'}[v.mime]),'codec');assert(v.mime!=='audio/mp4'||stream.profile==='LC','AAC profile');assert(rate===48000&&rate===v.sampleRate,'sample rate');assert(Number.isFinite(v.loopStart)&&Number.isFinite(v.loopEnd)&&start>=0&&end<=st.samples&&end>start,'badloop bounds');assert(st.samples===v.decodedFrames,'decoded frames');assert(end-start===v.logicalPeriodSamples,'logical period');assert(st.rmsDb>-60&&st.peak>.0001,`silent ${t.id}`);assert(st.peak<1,`clipped ${t.id}`);assert(Math.abs(st.dc)<.001,`DC ${t.id}`);
 if(bgm&&v.mime==='audio/mp4'){
 assert(v.periodicPreRollSamples===1088,'AAC periodic pre-roll');
 assert(v.decodedPrimingSamples===2112,'AAC measured encoder plus guard priming');
 assert(v.trailingPaddingSamples===st.samples-v.decodedPrimingSamples-v.logicalPeriodSamples,'AAC trailing padding');
 const reference=decode(read(root,`src/audio/masters/${t.id}.wav`));
 const correlations=[];
 for(const window of [[2048,16000],[v.logicalPeriodSamples-16000,v.logicalPeriodSamples-128]]){
  let dot=0,xx=0,yy=0;
  for(let frame=window[0];frame<window[1];frame+=24){const x=reference[frame*channels],y=logical[frame*channels];dot+=x*y;xx+=x*x;yy+=y*y;}
  const correlation=dot/Math.sqrt(xx*yy);assert(correlation>.95,'AAC full-period leading/trailing correlation');correlations.push(correlation);
 }
 row.browserGuard={periodicPreRollSamples:v.periodicPreRollSamples,decodedPrimingSamples:v.decodedPrimingSamples,trailingPaddingSamples:v.trailingPaddingSamples,correlations};
}
if(bgm){const target=score.tracks.find(x=>x.id===t.id);assert(v.logicalPeriodSamples===Math.round(64*60/target.bpm*RATE),'musical period');const l=loudness(wav(logical,channels));assert(l.integrated>=-21&&l.integrated<=-19,`LUFS ${t.id}: ${l.integrated}`);assert(l.truePeak<=-3,`true peak ${t.id}`);assert(ls.seam<.025&&ls.seam<=ls.maxAdjacentJump*2,`decoded seam ${t.id}`);bgmPeak=Math.max(bgmPeak,10**(l.truePeak/20));if(v.mime==='audio/ogg')bgmBuffers.push(logical);if(artifactDir)write(artifactDir,`${t.id}-${v.mime.split('/')[1]}-loudness.txt`,l.raw);row.variants.push({...v,stats:st,logicalStats:ls,lufs:l.integrated,truePeakDb:l.truePeak});}
 else{assert(channels===1,'SFX mono');assert(st.peakDb<=-6,'SFX peak');assert(Math.abs(st.samples/RATE-cues.cues.find(c=>c.id===t.id).duration)<1/RATE,'SFX duration');rms.push(st.rmsDb);sfxPeak=Math.max(sfxPeak,st.peak);const over=floats(run('ffmpeg',['-v','error','-i','pipe:0','-af','aresample=192000','-f','f32le','pipe:1'],b).stdout),tp=stats(over).peak;sfxTruePeak=Math.max(sfxTruePeak,tp);cueBuffers.push({pcm,peak:tp});assert(!unique.has(v.sha256),'duplicate SFX audio');unique.add(v.sha256);row.variants.push({...v,stats:st});}
 if(artifactDir)write(artifactDir,`${t.id}-${v.mime.split('/')[1]}-probe.json`,p);
 }report.tracks.push(row);}
 report.sfxRmsSpreadDb=Math.max(...rms)-Math.min(...rms);assert(report.sfxRmsSpreadDb<=3,'SFX comparable RMS');
 // Triangle-inequality bound covers any relative cue phase, six voices and two equal-power BGM tracks at unity user gains.
 report.worstMix={bgmTruePeak:bgmPeak,sfxSamplePeak:sfxPeak,sfxTruePeak4x:sfxTruePeak,masterSafetyGain:mix.masterSafetyGain,bound:mix.masterSafetyGain*(Math.SQRT2*bgmPeak+6*sfxTruePeak)};report.worstMix.truePeakBoundDb=20*Math.log10(report.worstMix.bound);assert(report.worstMix.truePeakBoundDb<=-1,'worst mix peak bound');
 const scene=new Float32Array(4*RATE*2),cue=cueBuffers.sort((a,b)=>b.peak-a.peak)[0].pcm;
 for(let frame=0;frame<4*RATE;frame++){const t=frame/RATE,x=Math.min(1,t/mix.transitionSeconds),g1=Math.cos(x*Math.PI/2),g2=Math.sin(x*Math.PI/2);for(let ch=0;ch<2;ch++){let v=bgmBuffers[0][frame*2+ch]*g1+bgmBuffers[1][frame*2+ch]*g2;for(let voice=0;voice<6;voice++){const at=frame-Math.round(voice*.012*RATE);if(at>=0&&at<cue.length)v+=cue[at];}scene[frame*2+ch]=v*mix.masterSafetyGain;}}
 const sceneBytes=wav(scene,2),sceneLoudness=loudness(sceneBytes);assert(sceneLoudness.truePeak<=-1,'actual transition six-voice mix peak');report.mixScene={seconds:4,voices:6,bgmTracks:2,userGains:1,masterSafetyGain:mix.masterSafetyGain,truePeak:sceneLoudness.truePeak,sha256:sha(sceneBytes)};if(artifactDir){write(artifactDir,'transition-six-voices.wav',sceneBytes);write(artifactDir,'transition-six-voices-loudness.txt',sceneLoudness.raw);}
 report.status='pass';return report;
}
function negative(root,out){
 const tmp=path.join(process.env.TMPDIR||out,'negative-fixtures');fs.mkdirSync(tmp,{recursive:true});const results=[];const before=sha(read(root,'src/audio/manifest.json'));
 try{fs.cpSync(path.join(root,'src/audio'),path.join(tmp,'src/audio'),{recursive:true});fs.cpSync(path.join(root,'tools/audio'),path.join(tmp,'tools/audio'),{recursive:true});const original=read(tmp,'src/audio/manifest.json');
 for(const kind of ['silent','clipped','missingcue','badloop','wronghash','budget','wrongpriming']){write(tmp,'src/audio/manifest.json',original);let m=json(tmp,'src/audio/manifest.json'),saved=null,savedMaster=null;const v=m.tracks.find(t=>t.id==='ui.tap').variants[0];
 if(['silent','clipped'].includes(kind)){saved=read(tmp,v.path);const a=new Float32Array(Math.round(.07*RATE));if(kind==='clipped')for(let i=0;i<a.length;i++)a[i]=i%2?1:-1;const b=wav(a,1,false);write(tmp,v.path,b);v.sha256=sha(b);v.bytes=b.length;}
 if(kind==='wrongpriming')m.tracks.find(t=>t.kind==='bgm').variants.find(v=>v.mime==='audio/mp4').decodedPrimingSamples=1024;
 if(kind==='missingcue')m.tracks.pop();if(kind==='badloop'){const master=m.masters[0];savedMaster={path:master.path,bytes:read(tmp,master.path)};const broken=Buffer.from(savedMaster.bytes);broken.writeFloatLE(.75,44);write(tmp,master.path,broken);master.sha256=sha(broken);}if(kind==='wronghash')v.sha256='0'.repeat(64);write(tmp,'src/audio/manifest.json',m);
 const command=[process.execPath,path.join(ROOT,'tools/audio/verify.mjs'),'--all','--root',tmp,'--max-bytes',kind==='budget'?'1':'8000000','--report',path.join(out,`${kind}.json`)];
 const r=spawnChecked(command);check(r.exit!==0,`negative incorrectly passed ${kind}`);write(out,`${kind}.log`,r.output);results.push({case:kind,command,exit:r.exit,observed:r.output.trim(),fixtureManifestSHA:sha(read(tmp,'src/audio/manifest.json'))});if(saved)write(tmp,v.path,saved);if(savedMaster)write(tmp,savedMaster.path,savedMaster.bytes);
 }
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 check(sha(read(root,'src/audio/manifest.json'))===before,'production mutated');return {status:'pass',checks:results.length,results,productionBeforeSHA:before,productionAfterSHA:sha(read(root,'src/audio/manifest.json')),cleanup:{path:tmp,exists:fs.existsSync(tmp)}};
}
import {spawnSync} from 'node:child_process';
function spawnChecked(c){const r=spawnSync(c[0],c.slice(1),{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});return {exit:r.status??-1,output:(r.stdout||'')+(r.stderr||'')+(r.error?.message||'')};}
if(process.argv[1]&&path.resolve(process.argv[1])===path.join(ROOT,'tools/audio/verify.mjs')){
 const a=args(),root=a.get('--root',ROOT),report=a.get('--report',path.join(root,'.omo/evidence/audio.json'));try{check(a.has('--all')||a.get('--case')==='negative-fixtures','require --all or --case negative-fixtures');const r=a.get('--case')==='negative-fixtures'?negative(root,path.dirname(report)):verify(root,{repeat:a.has('--repeat-render'),maxBytes:Number(a.get('--max-bytes','8000000')),artifactDir:path.join(path.dirname(report),'measurements')});write(path.dirname(report),path.basename(report),r);console.log(JSON.stringify({status:r.status,checks:r.checks,bytes:r.bytes,report}));}catch(e){write(path.dirname(report),path.basename(report),{status:'fail',error:e.message});console.error(e.message);process.exitCode=1;}
}
