import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const RATE=48000;
export const cueIds='ui.tap ui.back ui.tab ui.confirm ui.unavailable draw.latch draw.coil draw.seal draw.reveal draw.new draw.result card.flip equip.select equip.preview equip.attach craft.material craft.work craft.complete garage.assemble garage.complete research.correct research.incorrect research.reward qp.complete'.split(' ');
export const bgmIds=['workshop','collection','craft','garage'];
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const read=(root,p)=>fs.readFileSync(path.join(root,p));
export const json=(root,p)=>JSON.parse(read(root,p));
export function write(root,p,b){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof b==='object'&&!Buffer.isBuffer(b)?JSON.stringify(b,null,2)+'\n':b);}
export function check(ok,message){if(!ok)throw new Error(message);}
export function args(){const a=process.argv.slice(2);return {has:k=>a.includes(k),get:(k,d)=>a.includes(k)?a[a.indexOf(k)+1]:d};}
export function run(bin,argv,input){const r=spawnSync(bin,argv,{input,timeout:60000,maxBuffer:128*1024*1024});check(!r.error&&r.status===0,`${bin} failed: ${r.error?.message||r.stderr?.toString().slice(-1500)}`);return r;}
export function wav(pcm,channels=1,float=true){const bytes=float?4:2,b=Buffer.alloc(44+pcm.length*bytes);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(float?3:1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(RATE,24);b.writeUInt32LE(RATE*channels*bytes,28);b.writeUInt16LE(channels*bytes,32);b.writeUInt16LE(bytes*8,34);b.write('data',36);b.writeUInt32LE(pcm.length*bytes,40);for(let i=0;i<pcm.length;i++)float?b.writeFloatLE(pcm[i],44+i*4):b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(pcm[i]*32767))),44+i*2);return b;}
export function floats(b){const a=new Float32Array(b.length/4);for(let i=0;i<a.length;i++)a[i]=b.readFloatLE(i*4);return a;}
export function decode(b){return floats(run('ffmpeg',['-v','error','-i','pipe:0','-f','f32le','pipe:1'],b).stdout);}
export function probe(b){return JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-show_packets','-of','json','-i','pipe:0'],b).stdout);}
export function stats(a,channels=1){let peak=0,sum=0,sq=0,jump=0;for(let i=0;i<a.length;i++){check(Number.isFinite(a[i]),'nonfinite sample');peak=Math.max(peak,Math.abs(a[i]));sum+=a[i];sq+=a[i]*a[i];if(i>=channels)jump=Math.max(jump,Math.abs(a[i]-a[i-channels]));}let seam=0;for(let c=0;c<channels;c++)seam=Math.max(seam,Math.abs(a[c]-a[a.length-channels+c]));return {peak,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(sq/a.length),dc:sum/a.length,seam,maxAdjacentJump:jump,samples:a.length/channels};}
export function loudness(b){const r=run('ffmpeg',['-hide_banner','-i','pipe:0','-af','loudnorm=I=-20:TP=-3:LRA=11:print_format=json','-f','null','-'],b);const s=r.stderr.toString(),m=s.match(/\{\s*"input_i"[\s\S]*?\}/);check(m,'missing loudnorm JSON');const v=JSON.parse(m[0]);return {integrated:Number(v.input_i),truePeak:Number(v.input_tp),raw:s};}
export const sourcePaths=['src/audio/score.json','src/audio/patches.json','src/audio/mix.json','src/audio/cues.json','tools/audio/core.mjs','tools/audio/synthesis.mjs','tools/audio/render.mjs','tools/audio/encode.mjs','tools/audio/verify.mjs','tools/audio/preview.mjs'];
export function sources(root){return sourcePaths.map(p=>({path:p,sha256:sha(read(root,p))}));}
