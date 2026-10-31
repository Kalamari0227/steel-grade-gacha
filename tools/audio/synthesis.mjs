import {RATE,check,wav,loudness,stats} from './core.mjs';
function rng(seed){let x=seed>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296*2-1;};}
export function renderTrack(track,score,patches,mix,seed){
  check(track.bars===16&&score.ppq===960&&track.meter.join('/')==='4/4','score structure');
  const period=Math.round(64*60/track.bpm*RATE),a=new Float32Array(period*3*2),beat=60/track.bpm;
  for(let cycle=0;cycle<3;cycle++)for(let ni=0;ni<track.events.length;ni++){
    const e=track.events[ni],p=patches.patches[e.patch];check(p&&e.tick>=0&&e.tick<64*960,'invalid note');
    const start=Math.round(cycle*period+e.tick/score.ppq*beat*RATE),hold=e.durationTicks/score.ppq*beat,tail=hold+p.release,n=Math.ceil(tail*RATE),random=rng(seed+ni*997),freq=440*2**((e.midi-69)/12),left=Math.sqrt((1-e.pan)/2),right=Math.sqrt((1+e.pan)/2);
    let noise=0;
    for(let j=0;j<n;j++){
      const t=j/RATE,attack=Math.min(1,t/p.attack),release=t<hold?1:Math.max(0,1-(t-hold)/p.release)**2;
      const decay=['pad','bass'].includes(e.patch)?1:Math.exp(-t/Math.max(.05,hold*.6));
      let v=0;
      if(e.patch==='brush'){noise=.72*noise+.28*random();v=noise*Math.exp(-t*38);}
      else if(e.patch==='kick')v=Math.sin(2*Math.PI*(48*t+1.6*(1-Math.exp(-t*28))))*Math.exp(-t*20);
      else for(let h=0;h<p.partials.length;h++)v+=p.partials[h]*Math.sin(2*Math.PI*freq*p.ratios[h]*t)*Math.exp(-t*h*.4);
      v*=attack*release*decay*e.gain;
      const at=(start+j)*2;if(at+1<a.length){a[at]+=v*left;a[at+1]+=v*right;}
      if(e.patch!=='bass'&&e.patch!=='kick')for(let tap=0;tap<patches.reverb.tapsSeconds.length;tap++){const to=at+Math.round(patches.reverb.tapsSeconds[tap]*RATE)*2;if(to+1<a.length){const g=patches.reverb.gains[tap];a[to]+=v*right*g;a[to+1]+=v*left*g;}}
    }
  }
  const middle=a.slice(period*2,period*4);let mean=[0,0];for(let i=0;i<middle.length;i++)mean[i%2]+=middle[i]/period;for(let i=0;i<middle.length;i++)middle[i]-=mean[i%2];
  const measured=loudness(wav(middle,2)),gain=10**((mix.bgmIntegratedLufs-measured.integrated)/20);for(let i=0;i<middle.length;i++)middle[i]*=gain;
  return {pcm:middle,bytes:wav(middle,2),periodSamples:period,normalizationGain:gain,rawMeasurement:measured};
}
export function renderCue(cue,patches,mix,seed){
  const n=Math.round(cue.duration*RATE),a=new Float32Array(n),p=patches.patches[cue.patch],random=rng(seed+cue.id.split('').reduce((s,c)=>s+c.charCodeAt(0),0));
  for(let k=0;k<cue.notes.length;k++){const start=Math.round(k*cue.spacing*RATE),remaining=(n-start)/RATE,freq=440*2**((cue.notes[k]-69)/12);for(let j=0;j<n-start;j++){const t=j/RATE,env=Math.min(1,t/cue.attack)*Math.exp(-cue.decay*t/remaining)*Math.min(1,(remaining-t)/.018);let v=0;for(let h=0;h<p.partials.length;h++)v+=p.partials[h]*Math.sin(2*Math.PI*freq*p.ratios[h]*t);a[start+j]+=(v+random()*cue.noise)*env;}}
  let dc=0;for(const v of a)dc+=v/a.length;for(let i=0;i<a.length;i++)a[i]=(a[i]-dc)*Math.min(1,i/120,(a.length-1-i)/120);
  const st=stats(a),gain=Math.min(10**((mix.sfxTargetRmsDb-st.rmsDb)/20),mix.sfxPeakCeiling/st.peak);for(let i=0;i<a.length;i++)a[i]*=gain;
  return {pcm:a,bytes:wav(a),pcm16:wav(a,1,false)};
}
