import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {expect} from '@playwright/test';
export const root=process.env.SGG_APP_ROOT || path.resolve(import.meta.dirname,'../..');
export const url='http://127.0.0.1:'+process.env.SGG_APP_PORT;
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const fixed='2026-11-01T00:00:00+09:00';
export const catalog=JSON.parse(await fs.readFile(root+'/tests/fixtures/catalog.json'));
export const manifest=JSON.parse(await fs.readFile(root+'/src/audio/manifest.json'));
const base=JSON.parse(await fs.readFile(root+'/tests/fixtures/crafting-ready.json')).state;
export function fixture(kind='loop') {
 const state=structuredClone(base);state.items={dagger:1,arrow:1};state.scrap=40;state.extra=0;state.quizUsed=0;state.quizAt=0;state.parts={};state.cars=[];
 if(kind==='loop'){
  delete state.owned['poo-270C'];delete state.stock['poo-270C'];
  state.parts=Object.fromEntries(catalog.parts.filter(p=>p.key!=='bpillar').map(p=>[p.key,{at:Date.parse(fixed)-1000,use:p.need.map(slot=>slot.any[0])}]));
 }
 if(kind==='garage')state.parts=Object.fromEntries(catalog.parts.map(p=>[p.key,{at:Date.parse(fixed)-1000,use:p.need.map(slot=>slot.any[0])}]));
 if(kind==='new'){state.owned={};state.stock={};state.items={};}
 return state;
}
export function nativeProbe({manifest,initial,recordAudio=false,deny=false}) {
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const ids=new Map(manifest.tracks.flatMap(t=>t.variants.map(v=>[v.sha256,t.id]))),buffers=new WeakMap();
 window.avProbe={starts:[],stops:[],decodes:[],errors:[],events:[],contexts:[],seedCount:0};
 if(!sessionStorage.getItem('av-seeded')){localStorage.setItem('sgg_game_save_v1',JSON.stringify(initial));sessionStorage.setItem('av-seeded','1');avProbe.seedCount=1;}
 Math.random=()=>0;
 window.addEventListener('error',e=>avProbe.errors.push(e.message));window.addEventListener('unhandledrejection',e=>avProbe.errors.push(String(e.reason)));
 const decode=BaseAudioContext.prototype.decodeAudioData;
 BaseAudioContext.prototype.decodeAudioData=async function(bytes){const copy=bytes.slice(0),result=await decode.call(this,bytes),sha=await digest(copy);buffers.set(result,{id:ids.get(sha),sha});avProbe.decodes.push({id:ids.get(sha),sha,frames:result.length,sampleRate:result.sampleRate});return result;};
 const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...args){const row={...buffers.get(this.buffer),loop:this.loop,time:performance.now(),contextTime:this.context.currentTime,args,source:avProbe.starts.length,saved:localStorage.getItem('sgg_game_save_v1')};this.avSource=row.source;const result=start.apply(this,args);avProbe.starts.push(row);return result;};
 AudioBufferSourceNode.prototype.stop=function(...args){avProbe.stops.push({source:this.avSource,time:performance.now(),args});return stop.apply(this,args);};
 const Native=window.AudioContext || window.webkitAudioContext;
 window.AudioContext=function(...args){const context=new Native(...args);avProbe.contexts.push(context);if(deny){const resume=context.resume.bind(context);let denied=false;context.resume=()=>{if(!denied){denied=true;return Promise.reject(new DOMException('Owned resume denial','NotAllowedError'));}return resume();};}return context;};window.AudioContext.prototype=Native.prototype;
 if(recordAudio){
  const connect=AudioNode.prototype.connect;let recorder,chunks=[],startedAt;
  AudioNode.prototype.connect=function(target,...args){const result=connect.call(this,target,...args);if(target===this.context.destination&&!recorder){const stream=this.context.createMediaStreamDestination();connect.call(this,stream);recorder=new MediaRecorder(stream.stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(100);startedAt=performance.now();}return result;};
  window.finishAudio=()=>new Promise(resolve=>{recorder.onstop=async()=>{const blob=new Blob(chunks,{type:recorder.mimeType});resolve({mime:blob.type,bytes:Array.from(new Uint8Array(await blob.arrayBuffer())),startedAt,stoppedAt:performance.now(),method:'native master bus to MediaStreamAudioDestinationNode / MediaRecorder'});};recorder.stop();});
 }
}
export async function open(page,info,kind='loop',options={}){
 const initial=options.initial || fixture(kind);
 for(const [id,n] of Object.entries(initial.stock)){expect(initial.owned[id]).toBeTruthy();expect(Number.isSafeInteger(n)&&n>=0).toBe(true);}
 await page.clock.setFixedTime(new Date(fixed));await page.addInitScript(nativeProbe,{manifest,initial,...options});
 const response=await page.goto(url);expect(hash(await response.body())).toBe(hash(await fs.readFile(root+'/index.html')));
 await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold&&typeof GAME_GARAGE!=='undefined'&&GAME_GARAGE.snapshot().ready);
 expect(await page.locator('body').getAttribute('data-game-fixture')).toBe('false');
 await record(info,'initial',{initial,fixtureSHA:hash(JSON.stringify(initial)),servedSHA:hash(await response.body()),release:await page.locator('body').getAttribute('data-game-release'),url:page.url()});
 return initial;
}
export const snapshot=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY),audio:GAME_AUDIO.snapshot(),draw:GAME_DRAW.snapshot(),craft:GAME_CRAFTING.snapshot(),garage:GAME_GARAGE.snapshot(),starts:avProbe.starts,stops:avProbe.stops,decodes:avProbe.decodes,errors:avProbe.errors,seedCount:avProbe.seedCount,url:location.href}));
export async function record(info,name,data){await fs.mkdir(info.outputDir,{recursive:true});const file=info.outputPath(name+'.json');await fs.writeFile(file,JSON.stringify(data,null,2));await info.attach(name,{path:file,contentType:'application/json'});}
export async function shot(page,info,name){const file=info.outputPath(name+'.png');await page.screenshot({path:file});await info.attach(name,{path:file,contentType:'image/png'});await record(info,name+'-binding',{...(await snapshot(page)),viewport:page.viewportSize(),focus:await page.evaluate(()=>document.activeElement?.id)});}
export async function cue(page,id,count=1){await expect.poll(()=>page.evaluate(id=>avProbe.starts.filter(s=>s.id===id).length,id)).toBeGreaterThanOrEqual(count);if(id.startsWith('ui.'))await page.waitForTimeout(110);}
export async function enable(page){await page.locator('#gameAudioChoice [data-audio-enable]').click();await cue(page,'workshop');}
export async function go(page,route){await page.locator('.destination-nav a[href="#'+route+'"]').click();await expect(page.locator('#view-'+route)).toBeVisible();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().route)).toBe({dex:'collection',research:'collection'}[route]||route);}
