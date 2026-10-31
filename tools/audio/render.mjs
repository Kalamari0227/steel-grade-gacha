import {ROOT,args,json,write,sha,run} from './core.mjs';
import {renderTrack,renderCue} from './synthesis.mjs';
const a=args(),root=a.get('--root',ROOT),seed=Number(a.get('--seed','20261025'));
if(!a.has('--all')||!Number.isSafeInteger(seed))throw new Error('require --all --seed integer');
const score=json(root,'src/audio/score.json'),patches=json(root,'src/audio/patches.json'),mix=json(root,'src/audio/mix.json'),cues=json(root,'src/audio/cues.json');
const receipt={seed,node:process.version,ffmpeg:run('ffmpeg',['-version']).stdout.toString().split('\n')[0],method:'Three complete cycles synthesized, middle cycle extracted with periodic release/reverb tails',masters:[]};
for(const track of score.tracks){const r=renderTrack(track,score,patches,mix,seed),p=`src/audio/masters/${track.id}.wav`;write(root,p,r.bytes);receipt.masters.push({id:track.id,path:p,sha256:sha(r.bytes),periodSamples:r.periodSamples,normalizationGain:r.normalizationGain});console.log(`render BGM ${track.id} ${r.periodSamples} samples ${sha(r.bytes)}`);}
for(const cue of cues.cues){const r=renderCue(cue,patches,mix,seed),p=`src/audio/masters/${cue.id}.wav`;write(root,p,r.bytes);write(root,`src/audio/cues/${cue.id}.wav`,r.pcm16);receipt.masters.push({id:cue.id,path:p,sha256:sha(r.bytes),periodSamples:r.pcm.length});console.log(`render SFX ${cue.id} ${r.pcm.length} samples`);}
write(root,'src/audio/render-receipt.json',receipt);
