import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPackage} from '../../tools/game-build/package.mjs';
import {canonical} from '../../tools/game-build/io.mjs';
import {startStatic} from '../../tools/game-qa/server.mjs';
import {portAbsent} from '../helpers/edition-package-site.mjs';
import {fixture,catalog,manifest,fixed,record,cue,go,shot,snapshot} from './audiovisual-support.mjs';
const root=process.env.SGG_APP_ROOT||path.resolve(import.meta.dirname,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
let packageRoot,release,url,server,resource,resourceFile,initialBinding;
async function resolvePackageRoot(){
 const supplied=process.env.SGG_PACKAGE_ROOT;
 if(!supplied)throw Error('SGG_PACKAGE_ROOT missing: explicit absolute game package directory required');
 if(!path.isAbsolute(supplied))throw Error('SGG_PACKAGE_ROOT must be absolute');
 try{const resolved=await fs.realpath(supplied);if(!(await fs.stat(resolved)).isDirectory())throw Error('not a directory');return resolved;}
 catch(error){throw Error('SGG_PACKAGE_ROOT nonexistent or invalid directory: '+supplied,{cause:error});}
}
async function binding(){
 const checked=await verifyPackage(packageRoot),files={};expect(checked.release.syntheticFixture,'SGG_PACKAGE_ROOT synthetic fixture forbidden').toBe(false);
 for(const [name,expected] of Object.entries(checked.release.inputs)){const b=await fs.readFile(path.join(root,name)),value=['docs/design/game-asset-manifest.json','src/audio/manifest.json'].includes(name)?canonical(JSON.parse(b)):b;expect(hash(value),'source input '+name).toBe(expected);files['source/'+name]={bytes:b.length,sha256:hash(b),releaseInputSHA:hash(value)};}
 for(const name of ['game-release.json',checked.manifestPath,...checked.release.files.map(r=>r.path)]){const b=await fs.readFile(path.join(packageRoot,name));files['package/'+name]={bytes:b.length,sha256:hash(b)};}
 for(const name of ['index.html','sw.js','game-release.json',checked.manifestPath]){const b=await fs.readFile(path.join(root,name));expect(hash(b),'shipping '+name).toBe(files['package/'+name].sha256);files['shipping/'+name]={bytes:b.length,sha256:hash(b)};}
 expect(checked.release.files.filter(r=>r.mime.startsWith('audio/'))).toHaveLength(32);
 return {...checked,files};
}
async function closeServer(){
 if(!server)return;const owned=server;server=null;await owned.close();
 resource.listenerAbsent=await portAbsent(owned.port);resource.status='closed';await fs.writeFile(resourceFile,JSON.stringify(resource,null,2));
 expect(resource.listenerAbsent,'owned package listener closed').toBe(true);
}
test.beforeAll(async({},info)=>{
 packageRoot=await resolvePackageRoot();
 try{
  initialBinding=await binding();release=initialBinding.release;
  resourceFile=info.outputPath('audio-package-resources.json');await fs.mkdir(info.outputDir,{recursive:true});
  resource={pid:process.pid,status:'planned',root:packageRoot,port:null,profileRoot:process.env.TMPDIR};await fs.writeFile(resourceFile,JSON.stringify(resource,null,2));
  server=await startStatic(packageRoot,0);url=server.url;Object.assign(resource,{status:'running',port:server.port,url});await fs.writeFile(resourceFile,JSON.stringify(resource,null,2));
  expect([4173,4273,4274]).not.toContain(server.port);
  const http=[];for(const row of release.files){const response=await fetch(url+'/'+row.path),body=Buffer.from(await response.arrayBuffer());expect(response.status).toBe(200);expect(hash(body)).toBe(row.sha256);expect(body.length).toBe(row.bytes);expect(response.headers.get('content-type')).toBe(row.mime);http.push({path:row.path,bytes:body.length,sha256:hash(body),mime:response.headers.get('content-type')});}
  expect((await fetch(url+'/src/app_tpl.html')).status).toBe(404);
  await record(info,'explicit-package-binding',{packageRoot,origin:url,...initialBinding,http,sourceTemplateStatus:404});
 }catch(error){await closeServer();throw Error('SGG_PACKAGE_ROOT invalid, nongame, synthetic or stale package: '+packageRoot,{cause:error});}
});
test.afterAll(async()=>{await closeServer();if(initialBinding)expect(await binding()).toEqual(initialBinding);});
function probe({initial,rate,prefs,deny}){
 const NativeDate=Date,time=Date.parse('2026-11-01T00:00:00+09:00');
 function FixedDate(...args){if(new.target)return Reflect.construct(NativeDate,args.length?args:[time],new.target);return new NativeDate(time).toString();}
 Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.prototype=NativeDate.prototype;FixedDate.now=()=>time;window.Date=FixedDate;
 if(!sessionStorage.getItem('af-seeded')){localStorage.setItem('sgg_game_save_v1',JSON.stringify(initial));if(prefs!==undefined)localStorage.setItem('sgg_game_preferences_v1',typeof prefs==='string'?prefs:JSON.stringify(prefs));sessionStorage.setItem('af-seeded','1');}
 Math.random=()=>0;
 const ids=new WeakMap(),buffers=new WeakMap(),edges=new Map(),sources=[],contexts=[],decoded=[];let next=0;
 const id=o=>{if(!ids.has(o))ids.set(o,++next);return ids.get(o);};
 window.afBuffers=new Map();window.avProbe={starts:[],stops:[],decodes:decoded,errors:[],contexts,seedCount:1};
 window.afParams=new Map();window.af={events:[],writes:[],curves:[],ramps:[],maxNodes:0,maxBGM:0,maxSFX:0,offline:0};
 window.afDigest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const Native=window.AudioContext||window.webkitAudioContext;
 window.AudioContext=new Proxy(Native,{construct(target,args){const c=new target({...args[0],...(rate?{sampleRate:rate}:{})});contexts.push(c);if(deny){let used=false;const resume=c.resume.bind(c);c.resume=()=>{if(!used){used=true;return deny==='hung'?new Promise(()=>{}):Promise.reject(new DOMException('Owned resume denial','NotAllowedError'));}return resume();};}return c;}});
 const Offline=window.OfflineAudioContext;window.OfflineAudioContext=new Proxy(Offline,{construct(target,args){af.offline++;return Reflect.construct(target,args);}});
 const decode=BaseAudioContext.prototype.decodeAudioData;
 BaseAudioContext.prototype.decodeAudioData=async function(bytes){const copy=bytes.slice(0),buffer=await decode.call(this,bytes),sha=await afDigest(copy);const track=window.GAME_CONFIG?.audio&&Object.entries(GAME_CONFIG.audio).find(([,variants])=>variants.some(v=>v.sha256===sha))?.[0];buffers.set(buffer,{id:track,sha});afBuffers.set(sha,buffer);decoded.push({id:track,sha,frames:buffer.length,sampleRate:buffer.sampleRate,offline:this instanceof OfflineAudioContext});return buffer;};
 const connect=AudioNode.prototype.connect,disconnect=AudioNode.prototype.disconnect;
 const peaks=()=>{af.maxNodes=Math.max(af.maxNodes,[...edges.values()].filter(e=>e.size).length);const active=sources.filter(s=>s.connected()&&!s.ended&&(!s.stopped||s.context.currentTime<s.stopDeadline));af.maxBGM=Math.max(af.maxBGM,active.filter(s=>s.loop).length);af.maxSFX=Math.max(af.maxSFX,active.filter(s=>!s.loop).length);};
 AudioNode.prototype.connect=function(target,...args){const result=connect.call(this,target,...args);if(!(this.context instanceof OfflineAudioContext)){if(!edges.has(id(this)))edges.set(id(this),new Set());edges.get(id(this)).add(id(target));peaks();}return result;};
 AudioNode.prototype.disconnect=function(...args){const result=disconnect.apply(this,args);if(!args.length)edges.delete(id(this));else edges.get(id(this))?.delete(id(args[0]));return result;};
 const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...args){const result=start.apply(this,args);if(this.context instanceof OfflineAudioContext)return result;const number=id(this),row={...buffers.get(this.buffer),source:number,loop:this.loop,loopStart:this.loopStart,loopEnd:this.loopEnd,time:performance.now(),contextTime:this.context.currentTime,args,saved:localStorage.getItem('sgg_game_save_v1'),state:JSON.stringify(S),action:af.action};avProbe.starts.push(row);const live={...row,context:this.context,stopped:false,ended:false,connected:()=>edges.get(number)?.size||0};sources.push(live);this.addEventListener('ended',()=>{live.ended=true;live.endedAt=performance.now();},{once:true});peaks();return result;};
 AudioBufferSourceNode.prototype.stop=function(...args){const result=stop.apply(this,args),row=sources.find(s=>s.source===id(this));if(row){row.stopped=true;row.stopDeadline=Math.max(this.context.currentTime,Number(args[0]??0));avProbe.stops.push({source:row.source,time:performance.now(),args,stopDeadline:row.stopDeadline});}return result;};
 for(const method of ['setValueCurveAtTime','linearRampToValueAtTime','setValueAtTime','cancelAndHoldAtTime','cancelScheduledValues']){const native=AudioParam.prototype[method];AudioParam.prototype[method]=function(...args){const result=native.apply(this,args);afParams.set(id(this),this);af.curves.push({param:id(this),method,args:args.map(a=>a instanceof Float32Array?Array.from(a):a),at:contexts[0]?.currentTime});return result;};}
 const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){af.writes.push({key,value,time:performance.now(),action:af.action});return set.call(this,key,value);};
 for(const event of ['click','change'])document.addEventListener(event,e=>{af.action={event,selector:e.target.id||e.target.outerHTML.slice(0,180),time:performance.now(),state:typeof S==='undefined'?null:JSON.stringify(S)};af.events.push(af.action);},true);
 window.afGraph=()=>({contexts:contexts.length,offline:af.offline,connectedNodes:[...edges.values()].filter(e=>e.size).length,maxNodes:af.maxNodes,maxBGM:af.maxBGM,maxSFX:af.maxSFX,sources:sources.map(({context,connected,...s})=>({...s,currentTime:context.currentTime,connected:connected()})),curves:af.curves,events:af.events,writes:af.writes});
 window.addEventListener('error',e=>avProbe.errors.push(e.message));window.addEventListener('unhandledrejection',e=>avProbe.errors.push(String(e.reason)));
}
async function open(page,info,kind='ready',options={}){
 const initial=options.initial||fixture(kind);await page.addInitScript(probe,{initial,...options});
 const response=await page.goto(url);expect(hash(await response.body())).toBe(initialBinding.files['package/index.html'].sha256);expect(new URL(page.url()).origin).toBe(url);
 await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold&&typeof GAME_GARAGE!=='undefined'&&GAME_GARAGE.snapshot().ready);
 expect(await page.locator('body').getAttribute('data-game-fixture')).toBe('false');expect(await page.locator('body').getAttribute('data-game-release')).toBe(release.releaseId);
 await record(info,'binding',{packageRoot,origin:url,release:release.releaseId,servedSHA:hash(await response.body()),audioManifestSHA:hash(await fs.readFile(root+'/src/audio/manifest.json')),nativeClocks:true,subjectiveListening:false});return initial;
}
async function enable(page){await page.locator('#gameAudioChoice [data-audio-enable]').click();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().tracks.filter(t=>!t.ending).map(t=>t.id))).toEqual(['workshop']);}
async function settings(page){await page.locator('#btnSettings').click();await expect(page.locator('#gameAudioControls')).toBeVisible();}
const economy=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY)}));
const audio=page=>page.evaluate(()=>GAME_AUDIO.snapshot());
function validSeam(jump,maxJump){if(!Number.isFinite(jump)||jump>=.025||jump>maxJump*2)throw Error('decoded-loop-seam');return true;}
function disposed(rows){if(rows.some(r=>r.connected!==0||(!r.ended&&!(r.stopped&&Number.isFinite(r.stopDeadline)&&r.currentTime>r.stopDeadline))))throw Error('native-disposal');return true;}
test.afterEach(async({page},info)=>{if(!page.isClosed()){await record(info,'final',{status:info.status,audio:await audio(page).catch(()=>null),graph:await page.evaluate(()=>afGraph()).catch(()=>null),state:await economy(page).catch(()=>null)});}});

for(const rate of [44100,48000])for(const codec of ['opus','aac'])test(`native five loops ${codec} output ${rate} all four final songs`,async({page},info)=>{
 if(codec==='aac')await page.route('**/*.ogg',r=>r.fulfill({status:404,body:'Owned codec-choice negative: force AAC'}));
 await page.route('**/audio-reference/*.wav',r=>r.fulfill({path:path.join(root,'src/audio/masters',new URL(r.request().url()).pathname.split('/').at(-1)),contentType:'audio/wav'}));
 await open(page,info,'ready',{rate});await enable(page);const rows=[];
 for(const [route,id] of [['workshop','workshop'],['dex','collection'],['craft','craft'],['garage','garage']]){
  if(id!=='workshop')await page.evaluate(route=>GAME_AUDIO.setRoute(route),route);
  await expect.poll(async()=>(await audio(page)).tracks.some(t=>t.id===id&&!t.ending)).toBe(true);
  const variant=manifest.tracks.find(t=>t.id===id).variants.find(v=>v.codec===codec),decoded=(await audio(page)).decoded.find(d=>d.id===id);
  expect(decoded.mime).toBe(variant.mime);expect(decoded.outputSampleRate).toBe(rate);
  const response=await page.request.get(new URL(decoded.url,url).href);expect(response.ok()).toBe(true);expect(hash(await response.body())).toBe(variant.sha256);
  const result=await page.evaluate(async({id,decoded,variant,rate})=>{
   const b=afBuffers.get(variant.sha256),loop=decoded.loop,frames=Math.round(variant.logicalPeriodSeconds*rate),output=new OfflineAudioContext(b.numberOfChannels,frames*5,rate),source=output.createBufferSource();
   source.buffer=b;source.loop=true;source.loopStart=loop.start;source.loopEnd=loop.end;source.connect(output.destination);source.start(0,loop.start);
   const rendered=await output.startRendering(),channels=[],seams=[];
   for(let c=0;c<rendered.numberOfChannels;c++){
    const pcm=rendered.getChannelData(c);let power=0,sum=0,peak=0,finite=true,maxJump=0;for(let i=0;i<pcm.length;i++){const x=pcm[i];finite&&=Number.isFinite(x);power+=x*x;sum+=x;peak=Math.max(peak,Math.abs(x));if(i&&i%frames)maxJump=Math.max(maxJump,Math.abs(x-pcm[i-1]));}
    channels.push({channel:c,frames:pcm.length,rms:Math.sqrt(power/pcm.length),dc:sum/pcm.length,peak,finite,maxJump,sha256:await afDigest(pcm.buffer)});
    for(let n=1;n<5;n++){const at=n*frames;seams.push({channel:c,boundary:n,frame:at,jump:Math.abs(pcm[at]-pcm[at-1]),samples:Array.from(pcm.subarray(at-128,at+128))});}
   }
   const refctx=new OfflineAudioContext(2,1,b.sampleRate),reference=await refctx.decodeAudioData(await(await fetch('/audio-reference/'+id+'.wav')).arrayBuffer()),correlations=[];
   for(let c=0;c<b.numberOfChannels;c++){const a=b.getChannelData(c),r=reference.getChannelData(c),start=Math.round(loop.start*b.sampleRate),period=loop.periodFrames;for(const [from,to] of [[2048,16000],[period-16000,period-128]]){let dot=0,xx=0,yy=0;for(let i=from;i<to;i+=24){dot+=r[i]*a[start+i];xx+=r[i]**2;yy+=a[start+i]**2;}correlations.push({channel:c,from,to,value:dot/Math.sqrt(xx*yy)});}}
   return {id,rate,decoded,variant,frames,outputFrames:rendered.length,source:{loop:source.loop,start:source.loopStart,end:source.loopEnd,offset:loop.start,decodeRate:b.sampleRate,bufferFrames:b.length},channels,seams,correlations,method:'native AudioBufferSourceNode loop=true -> OfflineAudioContext five periods; full PCM hashes and all seam PCM retained',clock:GAME_AUDIO.snapshot().currentTime};
  },{id,decoded,variant,rate});
  await record(info,'loop-'+id,result);expect(result.outputFrames).toBe(result.frames*5);expect(result.seams).toHaveLength(8);
  for(const c of result.channels){expect(c.finite).toBe(true);expect(c.rms).toBeGreaterThan(.001);expect(Math.abs(c.dc)).toBeLessThan(.001);}
  for(const s of result.seams)expect(validSeam(s.jump,result.channels[s.channel].maxJump)).toBe(true);
  for(const c of result.correlations)expect(c.value).toBeGreaterThan(.95);
  expect(result.source.end-result.source.start).toBeCloseTo(variant.logicalPeriodSeconds,5);expect(result.source.decodeRate).toBe(decoded.nativeDecodeFallback?48000:rate);rows.push(result);
 }
 await record(info,'matrix',{engine:info.project.name,codec,outputRate:rate,rows});
});

async function ready(page){await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');}
async function quiz(page,wrong=false){await page.locator('#btnQuiz').click();for(let i=0;i<5;i++){const a=await page.evaluate(()=>qState.qs[qState.i].a);await page.locator('#opts button').nth(wrong&&i===0?(a+1)%4:a).click();await page.locator('#qNext').click();}await page.locator('#qDone').click();}
async function equipment(page,key='dagger',id='poo-270C'){await page.locator('#cardEquipmentToggle').click();await page.locator('[data-card-equipment="'+key+'"]').click();await page.locator('[data-equip-id="'+id+'"]').click();}
async function craft(page){await go(page,'craft');await page.locator('#parts [data-part-key="bpillar"]').click();const plan=await page.evaluate(()=>partPlan(findPart('bpillar')));await page.locator('#mkBtn').click();return plan;}
async function car(page){await go(page,'garage');await page.locator('.garage-option[data-k="t"]').click();await page.locator('#takeCar').click();}

test('one preseed full real UI loop records native audio starts and exact economic continuity',async({page},info)=>{
 const initial=await open(page,info,'loop',{});await enable(page);await shot(page,info,'00-home');await page.waitForTimeout(700);const steps=[];
 await page.locator('#btnPull').click();await ready(page);await cue(page,'draw.new');expect((await snapshot(page)).audio.duckGain).toBeCloseTo(Math.pow(10,-6/20),2);let s=await snapshot(page);expect(s.state.pullUsed).toBe(initial.pullUsed+1);expect(s.state.stock['poo-270C']).toBe(1);steps.push({stage:'draw',...s});await shot(page,info,'01-draw');await page.waitForTimeout(700);
 await page.locator('.draw-art').click();await equipment(page);await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().route)).toBe('craft');
 const preview=await snapshot(page);await page.locator('[data-equipment-mode="before"]').click();await cue(page,'equip.preview');await page.locator('[data-equipment-mode="preview"]').click();expect((await snapshot(page)).state).toEqual(preview.state);await shot(page,info,'02-preview');await page.waitForTimeout(700);
 await page.locator('#equipConfirm').click();await cue(page,'equip.attach');s=await snapshot(page);expect(s.state).toEqual({...preview.state,items:{...preview.state.items,dagger:'poo-270C'}});steps.push({stage:'equip',...s});await page.locator('#pkDone2').click();await page.locator('#cardX').click();await page.locator('[data-draw-close]').click();
 await go(page,'research');const research=await snapshot(page);await quiz(page);await cue(page,'research.reward');s=await snapshot(page);expect(s.state.extra).toBe(research.state.extra+1);expect(s.state.quizUsed).toBe(research.state.quizUsed+1);expect(s.state.stock).toEqual(research.state.stock);steps.push({stage:'research',...s});await shot(page,info,'03-research');await page.waitForTimeout(700);
 const beforeCraft=(await snapshot(page)).state,plan=await craft(page);await cue(page,'craft.complete');await page.waitForTimeout(180);expect((await snapshot(page)).audio.duckGain).toBeCloseTo(Math.pow(10,-6/20),2);s=await snapshot(page);const stocks={...beforeCraft.stock};for(const id of plan)if(id!=='qp-1470')stocks[id]--;expect(s.state.stock).toEqual(stocks);expect(Object.keys(s.state.parts)).toHaveLength(35);steps.push({stage:'craft',plan,...s});await shot(page,info,'04-craft');await page.waitForTimeout(700);await page.locator('#partX').click();
 const beforeCar=(await snapshot(page)).state;await car(page);await cue(page,'garage.complete');await page.waitForTimeout(180);expect((await snapshot(page)).audio.duckGain).toBeCloseTo(Math.pow(10,-6/20),2);s=await snapshot(page);expect(s.state.parts).toEqual({});expect(s.state.cars).toEqual([{k:'t',at:Date.parse(fixed)}]);expect(s.state.stock).toEqual(beforeCar.stock);expect(s.state.scrap).toBe(beforeCar.scrap);expect(s.seedCount).toBe(1);expect(JSON.parse(s.saved)).toEqual(s.state);steps.push({stage:'garage',...s});await shot(page,info,'05-garage');await page.waitForTimeout(700);
 expect(new Set(s.starts.filter(x=>x.loop).map(x=>x.id))).toEqual(new Set(['workshop','collection','craft','garage']));expect(s.audio.maxTracks).toBeLessThanOrEqual(2);expect(s.audio.maxVoices).toBeLessThanOrEqual(6);await record(info,'whole-loop',{initial,steps,onePreseed:true});
 const expected=['draw.latch','draw.coil','draw.seal','draw.reveal','draw.new','draw.result','equip.select','equip.attach','craft.material','craft.work','craft.complete','garage.assemble','garage.complete','research.reward'];
 for(const id of expected)expect(s.starts.filter(row=>row.id===id),id).toHaveLength(1);
 expect(s.starts.filter(row=>row.id==='equip.preview')).toHaveLength(2);expect(s.starts.filter(row=>row.id==='research.correct')).toHaveLength(5);
 const graph=await page.evaluate(()=>afGraph());expect(graph.contexts).toBe(1);expect(graph.maxNodes).toBeLessThanOrEqual(14);await record(info,'semantic-cues-primary',{expected,starts:s.starts,graph});
});

test('remaining semantic UI flip rejection incorrect and QP events start actual identified sources once',async({page},info)=>{
 await open(page,info,'ready');await enable(page);await page.locator('#btnSettings').click();await cue(page,'ui.tap');await page.locator('#settingsX').click();await cue(page,'ui.back');
 await page.locator('#homeHeroSelect').selectOption('ga-1470H');await cue(page,'ui.confirm');await go(page,'dex');await cue(page,'ui.tab');await page.locator('#dex [data-card-id="ga-1470H"]').click();await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();await cue(page,'card.flip');
 await equipment(page,'arrow','ga-1470H');await page.evaluate(()=>{delete S.items.arrow;});const before=(await snapshot(page)).state;await page.locator('#equipConfirm').click();await cue(page,'ui.unavailable');expect((await snapshot(page)).state).toEqual(before);await page.locator('#pickX').click();await page.locator('#cardX').click();
 await go(page,'research');await quiz(page,true);await cue(page,'research.incorrect');const previous=(await snapshot(page)).state;await page.locator('#researchQPButton').click();await page.locator('#devBtn').click();await ready(page);await cue(page,'qp.complete');expect((await snapshot(page)).audio.duckGain).toBeCloseTo(Math.pow(10,-6/20),2);const after=await snapshot(page);expect(after.starts.filter(s=>s.id==='qp.complete')).toHaveLength(1);expect(after.state.scrap).toBe(previous.scrap-10);expect(after.state.pullUsed).toBe(previous.pullUsed);expect(after.state.owned['qp-1470']).toBe(true);for(const id of ['ui.tap','ui.back','ui.tab','ui.confirm','card.flip','ui.unavailable','research.incorrect','qp.complete'])expect(after.starts.filter(r=>r.id===id).length,id).toBeGreaterThanOrEqual(1);await record(info,'remaining-cues',{...after,graph:await page.evaluate(()=>afGraph())});
});


test('real preference endpoints silent choice and reload gesture preserve economy',async({page},info)=>{
 const requests=[];page.on('request',r=>{if(/\.(ogg|m4a|wav)$/.test(r.url()))requests.push(r.url());});
 await open(page,info,'ready',{prefs:{custom:'<script>window.injected=true</script>'}});const before=await economy(page);
 expect((await audio(page)).state).toBe('uncreated');expect(await page.evaluate(()=>afGraph().contexts)).toBe(0);expect(requests).toEqual([]);
 await expect(page.getByRole('button',{name:'무음으로 계속',exact:true})).toBeVisible();await shot(page,info,'silent-choice');await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();expect((await audio(page)).state).toBe('uncreated');expect(await page.evaluate(()=>afGraph().contexts)).toBe(0);expect(requests).toEqual([]);await settings(page);await page.locator('#gameAudioControls [data-audio-enable]').click();await expect.poll(async()=>(await audio(page)).tracks.length).toBe(1);await page.locator('#settingsX').click();
 const running=await audio(page);expect(running).toMatchObject({bgmGain:.3,sfxGain:.6});expect(running.masterGain).toBeCloseTo(.85,6);await expect.poll(async()=>(await audio(page)).currentTime).toBeGreaterThan(running.currentTime+.15);
 const pcm=await page.evaluate(()=>{const b=[...afBuffers.values()][0],p=b.getChannelData(0);return {frames:b.length,nonzero:p.some(x=>x!==0),finite:p.every(Number.isFinite)};});expect(pcm.nonzero&&pcm.finite).toBe(true);
 await settings(page);const endpoints=[];
 for(const name of ['bgm','sfx'])for(const value of [0,100]){await page.locator('[data-audio-'+name+']').fill(String(value));await page.locator('[data-audio-'+name+']').dispatchEvent('input');expect((await audio(page))[name+'Gain']).toBe(value/100);endpoints.push(await audio(page));}
 await page.locator('[data-audio-mute]').check();await expect.poll(async()=>(await audio(page)).state).toBe('suspended');expect(await economy(page)).toEqual(before);await shot(page,info,'muted-endpoints');
 const saved=await page.evaluate(()=>localStorage.getItem('sgg_game_preferences_v1'));expect(JSON.parse(saved).custom).toContain('<script>');expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 await page.reload();await page.waitForFunction(()=>typeof GAME_AUDIO!=='undefined'&&!saveHold);expect(await audio(page)).toMatchObject({state:'uncreated',muted:true,bgmGain:1,sfxGain:1});expect(await economy(page)).toEqual(before);
 await record(info,'preferences',{before,after:await economy(page),running,pcm,endpoints,saved,reload:await audio(page),subjectiveListening:false});
});

test('actual UI nested overlay return and four-route precedence keep one context',async({page},info)=>{
 await open(page,info);await enable(page);const before=await economy(page),timeline=[];
 for(const route of ['dex','craft','research','garage','workshop']){await go(page,route);const id={dex:'collection',research:'collection'}[route]||route;await expect.poll(async()=>(await audio(page)).tracks.filter(t=>!t.ending).map(t=>t.id)).toEqual([id]);timeline.push({route,audio:await audio(page)});}
 await go(page,'dex');await page.locator('#dexModeGallery').click();await page.locator('#galleryDetail').click();await equipment(page,'dagger','poo-270C');await expect.poll(async()=>(await audio(page)).route).toBe('craft');
 await page.locator('#equipTargets').click();await page.locator('[data-guarantee-card="eg-SECC"]').click();expect((await audio(page)).route).toBe('craft');await page.locator('#cardX').click();await expect(page.locator('[data-guarantee-card="eg-SECC"]')).toBeFocused();expect((await audio(page)).route).toBe('craft');await page.locator('#pickX').click();await page.locator('#cardX').click();await expect.poll(async()=>(await audio(page)).route).toBe('collection');
 expect(await economy(page)).toEqual(before);await shot(page,info,'nested-return');
 for(const route of ['dex','craft','garage','research','workshop','garage'])await page.locator('.destination-nav a[href="#'+route+'"]').click();
 await expect.poll(async()=>(await audio(page)).tracks.filter(t=>!t.ending).map(t=>t.id)).toEqual(['garage']);await expect.poll(async()=>(await audio(page)).tracks.length).toBe(1);
 const graph=await page.evaluate(()=>afGraph());expect(graph.contexts).toBe(1);expect(graph.maxBGM).toBeLessThanOrEqual(2);expect(graph.maxNodes).toBeLessThanOrEqual(14);await record(info,'route-timeline',{timeline,graph,before,after:await economy(page)});
});

test('native voice six cap crossfade grand envelopes and disposal reject misleading cleanup',async({page},info)=>{
 await open(page,info);await enable(page);const before=await economy(page);const envelopes=[];
 await page.evaluate(()=>{
  window.afObservations=[];
  window.afEnvelopePlan=()=>{const attack=af.curves.filter(r=>r.method==='linearRampToValueAtTime'&&Math.abs(r.args[0]-10**(-6/20))<1e-6).at(-1),hold=af.curves.filter(r=>r.param===attack.param&&r.method==='setValueAtTime'&&Math.abs(r.args[0]-10**(-6/20))<1e-6).at(-1),restore=af.curves.filter(r=>r.param===attack.param&&r.method==='linearRampToValueAtTime'&&r.args[0]===1).at(-1);return {param:attack.param,attack,hold,restore};};
  window.afImmediateSchedule=(observation,param)=>{const events=observation.events.filter(r=>r.param===param);return events.length===2&&events[0].method==='cancelScheduledValues'&&events[1].method==='setValueAtTime'&&events[1].args[0]===1&&events.every((event,i)=>event.args[i] >= observation.before.currentTime&&event.args[i]<=event.at&&event.at<=observation.immediate.currentTime);};
  window.afSampleTimeline=async(param,windows,samples)=>{
   for(const [phase,lower,upper] of windows)await new Promise((resolve,reject)=>{
    let frame;const fail=error=>{clearTimeout(timeout);cancelAnimationFrame(frame);reject(error);},timeout=setTimeout(()=>fail(Error('native-phase-timeout '+phase)),5000);
    const tick=()=>{const time=avProbe.contexts[0].currentTime;if(time<lower){frame=requestAnimationFrame(tick);return;}
     const sample={phase,param,lower,upper,time,value:afParams.get(param).value,voices:GAME_AUDIO.snapshot().voices,through:avProbe.contexts[0].currentTime};samples.push(sample);
     if(time>=upper||sample.through>=upper){fail(Error('native-phase-window '+JSON.stringify(sample)));return;}clearTimeout(timeout);resolve();
    };tick();
   });
  };
 });
 const observe=async(fn,arg)=>{try{return await page.evaluate(fn,arg);}finally{await record(info,'native-atomic-observations',await page.evaluate(()=>afObservations));}};
 for(const id of ['draw.reveal','craft.complete','garage.complete','qp.complete']){
  const envelope=await observe(async id=>{
   const accepted=await GAME_AUDIO.play(id),timing=afEnvelopePlan(),observation={kind:'natural',id,accepted,timing,samples:[]};afObservations.push(observation);
   await afSampleTimeline(timing.param,[['attack',timing.attack.args[1]+.03,timing.attack.args[1]+.25],['hold',timing.hold.args[1]-.35,timing.hold.args[1]-.1],['release-middle',timing.hold.args[1]+.15,timing.hold.args[1]+.28],['restored',timing.restore.args[1]+.04,timing.restore.args[1]+.3]],observation.samples);return {...observation,graph:afGraph()};
  },id);
  const {timing,samples}=envelope;expect(envelope.accepted).toBe(true);expect(timing.attack.args[1]-timing.attack.at).toBeCloseTo(.15,2);expect(timing.restore.args[1]-timing.hold.args[1]).toBeCloseTo(.4,5);
  for(const sample of samples){expect(sample.time).toBeGreaterThanOrEqual(sample.lower);expect(sample.through).toBeLessThan(sample.upper);
   if(sample.phase==='attack'||sample.phase==='hold'){expect(sample.value).toBeCloseTo(10**(-6/20),2);expect(sample.voices).toContain(id);expect(sample.through).toBeLessThan(timing.hold.args[1]);}
   if(sample.phase==='release-middle'){expect(sample.value).toBeGreaterThan(10**(-6/20));expect(sample.value).toBeLessThan(1);}
   if(sample.phase==='restored')expect(sample.value).toBeCloseTo(1,2);
  }
  envelopes.push(envelope);
 }
 const cancelObservation=await observe(async()=>{
  const accepted=await GAME_AUDIO.play('garage.complete'),cancelPlan=afEnvelopePlan(),observation={kind:'cancel',accepted,cancelPlan,preSamples:[],cancelSamples:[]};afObservations.push(observation);
  await afSampleTimeline(cancelPlan.param,[['pre-cancel',cancelPlan.attack.args[1]+.03,cancelPlan.attack.args[1]+.25]],observation.preSamples);
  const before=GAME_AUDIO.snapshot(),active=afGraph().sources.filter(s=>!s.loop&&s.connected&&!s.stopped&&!s.ended),curveStart=af.curves.length;GAME_AUDIO.cancel();
  const cancellation={before,active,immediate:GAME_AUDIO.snapshot(),events:af.curves.slice(curveStart),graph:afGraph()};observation.cancellation=cancellation;
  if(!afImmediateSchedule(cancellation,cancelPlan.param))throw Error('native-cancel-schedule '+JSON.stringify(cancellation.events));
  const set=cancellation.events.find(r=>r.param===cancelPlan.param&&r.method==='setValueAtTime');
  await afSampleTimeline(cancelPlan.param,[['processed',set.args[1]+.035,cancelPlan.hold.args[1]-.4],['old-hold-before',cancelPlan.hold.args[1]-.2,cancelPlan.hold.args[1]-.05],['old-hold-after',cancelPlan.hold.args[1]+.035,cancelPlan.hold.args[1]+.15],['old-release-middle',cancelPlan.hold.args[1]+.2,cancelPlan.hold.args[1]+.3],['old-restore-after',cancelPlan.restore.args[1]+.04,cancelPlan.restore.args[1]+.3]],observation.cancelSamples);return observation;
 });
 const {cancelPlan,cancellation,cancelSamples}=cancelObservation;await record(info,'cancel-immediate',{cancelPlan,cancellation});await record(info,'cancel-clock-samples',{cancelPlan,cancellation,cancelSamples});expect(cancelObservation.accepted).toBe(true);expect(cancellation.before.duckGain).toBeCloseTo(10**(-6/20),6);expect(cancellation.before.voices).toEqual(['garage.complete']);expect(cancellation.immediate.voices).toHaveLength(0);expect(cancellation.active).toHaveLength(1);
 const cancelEvents=cancellation.events.filter(r=>r.param===cancelPlan.param);expect(cancelEvents.map(r=>r.method)).toEqual(['cancelScheduledValues','setValueAtTime']);expect(cancelEvents[1].args[0]).toBe(1);
 for(const [event,timeIndex] of [[cancelEvents[0],0],[cancelEvents[1],1]]){expect(event.args[timeIndex]).toBeGreaterThanOrEqual(cancellation.before.currentTime);expect(event.args[timeIndex]).toBeLessThanOrEqual(event.at);expect(event.at).toBeLessThanOrEqual(cancellation.immediate.currentTime);}
 const cancelledSources=cancellation.graph.sources.filter(s=>cancellation.active.some(a=>a.source===s.source));for(const source of cancelledSources){expect(source.stopped).toBe(true);expect(source.connected).toBe(0);expect(Number.isFinite(source.stopDeadline)).toBe(true);expect(source.stopDeadline).toBeLessThanOrEqual(cancellation.immediate.currentTime);}
 for(const sample of cancelSamples){expect(sample.time).toBeGreaterThanOrEqual(sample.lower);expect(sample.through).toBeLessThan(sample.upper);expect(sample.value).toBe(1);expect(sample.voices).toHaveLength(0);}
 const observationNegatives=await observe(async param=>{
  const result={kind:'observation-negatives',missedSamples:[],schedules:[]};afObservations.push(result);const now=avProbe.contexts[0].currentTime;
  try{await afSampleTimeline(param,[['intentionally-missed',now-.02,now-.01]],result.missedSamples);result.missedRejected=false;}catch(error){if(!error.message.startsWith('native-phase-window '))throw error;result.missedRejected=true;result.missedError=error.message;}
  const gain=avProbe.contexts[0].createGain();
  for(const kind of ['future-event','missing-event']){const before=GAME_AUDIO.snapshot(),index=af.curves.length;gain.gain.cancelScheduledValues(avProbe.contexts[0].currentTime);if(kind==='future-event')gain.gain.setValueAtTime(1,avProbe.contexts[0].currentTime+.5);const observation={before,immediate:GAME_AUDIO.snapshot(),events:af.curves.slice(index)},param=observation.events[0].param;result.schedules.push({kind,observation,rejected:!afImmediateSchedule(observation,param)});gain.gain.cancelScheduledValues(avProbe.contexts[0].currentTime);}
  gain.disconnect();return result;
 },cancelPlan.param);
 await record(info,'observation-negatives',observationNegatives);expect(observationNegatives.missedRejected).toBe(true);expect(observationNegatives.schedules.every(s=>s.rejected)).toBe(true);

 const accepted=await page.evaluate(async()=>Promise.all(Array.from({length:8},()=>GAME_AUDIO.play('garage.complete'))));expect(accepted).toEqual(Array(8).fill(true));expect((await audio(page)).voices).toHaveLength(6);
 await go(page,'dex');await expect.poll(async()=>(await audio(page)).tracks.some(t=>t.id==='collection')).toBe(true);await page.evaluate(()=>GAME_AUDIO.cancel());
 const taps=await page.evaluate(()=>Promise.all([GAME_AUDIO.play('ui.tap'),GAME_AUDIO.play('ui.tap')]));expect(taps).toEqual([true,false]);await page.evaluate(()=>GAME_AUDIO.cancel());
 await expect.poll(async()=>(await audio(page)).tracks.length).toBe(1);const graph=await page.evaluate(()=>afGraph());expect(graph.contexts).toBe(1);expect(graph.maxSFX).toBeLessThanOrEqual(6);expect(graph.maxBGM).toBeLessThanOrEqual(2);expect(graph.maxNodes).toBeLessThanOrEqual(14);expect(graph.connectedNodes).toBeLessThanOrEqual(6);
 const transitions=graph.curves.filter(r=>r.method==='setValueCurveAtTime');expect(transitions.length).toBeGreaterThanOrEqual(2);expect(transitions.every(r=>r.args[2]===.4&&r.args[0].length===65)).toBe(true);for(const curve of transitions){const values=curve.args[0],incoming=values[0]===0,scale=incoming?1:values[0];for(let i=0;i<65;i++)expect(values[i]).toBeCloseTo(scale*(incoming?Math.sin(i/64*Math.PI/2):Math.cos(i/64*Math.PI/2)),6);}
 await page.evaluate(()=>GAME_AUDIO.setMute(true));await expect.poll(async()=>(await audio(page)).state).toBe('suspended');await page.evaluate(()=>avProbe.contexts[0].resume());await page.waitForTimeout(80);
 const muted=await page.evaluate(()=>afGraph());expect(muted.connectedNodes).toBeLessThanOrEqual(4);expect(disposed(muted.sources)).toBe(true);
 const row=muted.sources[0];expect(()=>disposed([{...row,ended:false,stopped:false}])).toThrow('native-disposal');expect(()=>disposed([{...row,ended:false,stopDeadline:row.currentTime+1}])).toThrow('native-disposal');expect(()=>disposed([{...row,connected:1}])).toThrow('native-disposal');expect(await economy(page)).toEqual(before);
 await record(info,'native-envelope-cap',{apiStress:true,notSemanticUICoverage:true,envelopes,cancelPlan,cancellation,cancelSamples,observationNegatives,accepted,taps,graph,muted,negativeDisposal:['missing-stop','future-stop','connected'],before,after:await economy(page)});
});

test('native two-track equal-power transition and six strongest voices render bounded PCM',async({page},info)=>{
 await open(page,info);const result=await page.evaluate(async()=>{
  const context=new OfflineAudioContext(2,48000*4,48000),master=context.createGain();master.gain.value=.85;master.connect(context.destination);const tracks=[];
  for(const [id,variants] of Object.entries(GAME_CONFIG.audio)){const variant=variants[0],response=await fetch(variant.url),bytes=await response.arrayBuffer(),sha=await afDigest(bytes),buffer=await context.decodeAudioData(bytes);let peak=0;for(let ch=0;ch<buffer.numberOfChannels;ch++)for(const x of buffer.getChannelData(ch))peak=Math.max(peak,Math.abs(x));tracks.push({id,variant,sha,buffer,peak});}
  const bgm=tracks.filter(t=>['workshop','collection','craft','garage'].includes(t.id)).sort((a,b)=>b.peak-a.peak).slice(0,2),cue=tracks.filter(t=>!['workshop','collection','craft','garage'].includes(t.id)).sort((a,b)=>b.peak-a.peak)[0],graph=[];
  for(let i=0;i<2;i++){const source=context.createBufferSource(),gain=context.createGain(),curve=Float32Array.from({length:65},(_,n)=>i?Math.sin(n/64*Math.PI/2):Math.cos(n/64*Math.PI/2));source.buffer=bgm[i].buffer;source.connect(gain);gain.connect(master);gain.gain.setValueCurveAtTime(curve,0,.4);source.start();graph.push({kind:'bgm',id:bgm[i].id,sha:bgm[i].sha,gainCurve:Array.from(curve),at:0,duration:.4});}
  for(let n=0;n<6;n++){const source=context.createBufferSource();source.buffer=cue.buffer;source.connect(master);source.start(n*.012);graph.push({kind:'sfx',id:cue.id,sha:cue.sha,at:n*.012});}
  const output=await context.startRendering(),pcm=new Float32Array(output.length*2);for(let i=0;i<output.length;i++)for(let ch=0;ch<2;ch++)pcm[i*2+ch]=output.getChannelData(ch)[i];let binary='';const bytes=new Uint8Array(pcm.buffer);for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {graph,inputs:tracks.map(({buffer,...t})=>t),frames:output.length,rate:output.sampleRate,channels:2,masterSafetyGain:.85,unityUserGains:true,grandDuckExcludedConservatively:true,pcmBase64:btoa(binary),pcmSHA:await afDigest(pcm.buffer)};
 });
 const {wav,loudness}=await import('../../tools/audio/core.mjs');const raw=Buffer.from(result.pcmBase64,'base64');expect(hash(raw)).toBe(result.pcmSHA);const pcm=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),bytes=wav(pcm,2),meter=loudness(bytes);delete result.pcmBase64;
 await fs.writeFile(info.outputPath('mix-pcm.wav'),bytes);await fs.writeFile(info.outputPath('mix-loudness.txt'),meter.raw);await record(info,'mix-graph',{...result,truePeak:meter.truePeak,wavSHA:hash(bytes),method:'native OfflineAudioContext source/gain graph, final served encoded inputs; not live game capture'});
 expect(result.frames).toBe(192000);expect(result.graph.filter(r=>r.kind==='sfx')).toHaveLength(6);expect(meter.truePeak).toBeLessThanOrEqual(-1);expect(pcm.every(Number.isFinite)).toBe(true);expect(pcm.some(x=>x!==0)).toBe(true);
});

test('hidden pagehide native interruption repeated cancellation and delayed requests preserve committed results',async({page},info)=>{
 await open(page,info);await enable(page);const stages=[];
 for(let n=0;n<3;n++){
  expect(await page.evaluate(()=>GAME_AUDIO.play('garage.complete'))).toBe(true);const before=await economy(page),count=(await audio(page)).startedCues;
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(async()=>(await audio(page)).state).toBe('suspended');expect((await audio(page)).voices).toEqual([]);expect((await audio(page)).tracks).toEqual([]);expect(await page.evaluate(()=>GAME_AUDIO.play('draw.result'))).toBe(false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(async()=>(await audio(page)).tracks.length).toBe(1);expect((await audio(page)).startedCues).toBe(count);expect(await economy(page)).toEqual(before);stages.push({cycle:n,audio:await audio(page),graph:await page.evaluate(()=>afGraph())});
 }
 await page.evaluate(()=>avProbe.contexts[0].suspend());await expect.poll(async()=>(await audio(page)).recovery).toBe(true);await settings(page);await page.getByRole('button',{name:'소리 다시 켜기'}).click();await expect.poll(async()=>(await audio(page)).tracks.length).toBe(1);await page.locator('#settingsX').click();
 await page.route('**/*.wav',async route=>{await new Promise(r=>setTimeout(r,450));await route.continue();});
 await page.locator('#btnPull').click();const committed=await economy(page);await page.locator('[data-draw-skip]').click();await page.locator('[data-draw-close]').click();await go(page,'dex');await page.waitForTimeout(1800);expect(await economy(page)).toEqual(committed);expect((await snapshot(page)).starts.filter(r=>r.id?.startsWith('draw.'))).toEqual([]);expect((await snapshot(page)).draw.pendingTimerCount).toBe(0);
 await page.evaluate(()=>{GAME_AUDIO.setMute(true);dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));});await expect.poll(async()=>(await audio(page)).state).toBe('suspended');expect((await audio(page)).tracks).toEqual([]);
 await record(info,'interruptions',{injectedLifecycleEvents:true,nativeSuspendResume:true,stages,committed,after:await economy(page),graph:await page.evaluate(()=>afGraph())});
});

for(const fault of ['404','bad-decode','offline-uncached','denied-resume','hung-resume'])test(`${fault} leaves real committed craft and recovery controls intact`,async({page},info)=>{
 if(fault==='404'||fault==='bad-decode')await page.route(/\.(ogg|m4a|wav)$/,r=>r.fulfill({status:fault==='404'?404:200,body:'owned invalid audio fixture',contentType:'audio/ogg'}));
 
 await open(page,info,'ready',{deny:fault==='denied-resume'?true:fault==='hung-resume'?'hung':false});if(fault==='offline-uncached')await page.context().setOffline(true);const started=Date.now();await page.locator('#gameAudioChoice [data-audio-enable]').click();await expect.poll(async()=>(await audio(page)).errors.length).toBeGreaterThan(0);
 const failureElapsedMs=Date.now()-started,failed=await audio(page);expect(failed.tracks).toEqual([]);const before=await economy(page),plan=await craft(page);await expect(page.locator('.craft-assembly-result')).toHaveAttribute('data-phase','complete');const after=await economy(page),stock={...before.state.stock};for(const id of plan)if(id!=='qp-1470')stock[id]--;expect(after.state.stock).toEqual(stock);expect(after.state.parts.bpillar.use).toEqual(plan);expect(JSON.parse(after.saved)).toEqual(after.state);
 await page.locator('#partX').click();await settings(page);const needsResume=fault==='denied-resume'||fault==='hung-resume';await expect(page.locator('[data-audio-status]')).toHaveText(needsResume?'소리 다시 켜기를 눌러 주세요.':'소리를 불러오지 못했습니다. 무음으로 계속할 수 있습니다.');await expect(page.locator('#gameAudioControls').getByRole('button',{name:needsResume?'소리 다시 켜기':'소리 켜기',exact:true})).toBeVisible();await shot(page,info,fault);
 await page.unroute(/\.(ogg|m4a|wav)$/);if(fault==='offline-uncached')await page.context().setOffline(false);await page.locator('#gameAudioControls [data-audio-enable]').click();await expect.poll(async()=>(await audio(page)).tracks.length).toBe(1);expect((await audio(page)).startedCues).toBe(0);expect(await economy(page)).toEqual(after);
 await record(info,'network-resume',{fault,failureElapsedMs,elapsedMs:Date.now()-started,before,after,plan,failed,recovered:await audio(page)});
});

test('low bandwidth expired cue hung fetch and stale route are bounded without late starts',async({page},info)=>{
 await open(page,info);await enable(page);const before=await economy(page);
 await page.route('**/*.wav',async route=>{await new Promise(r=>setTimeout(r,1700));await route.continue();});const start=Date.now();const expired=await page.evaluate(()=>GAME_AUDIO.play('draw.result'));expect(expired).toBe(false);expect((await audio(page)).startedCues).toBe(0);await page.unroute('**/*.wav');
 const late=[];await page.route('**/*audio-craft*',route=>late.push(route));await page.evaluate(()=>GAME_AUDIO.setRoute('craft'));await expect.poll(()=>late.length).toBeGreaterThan(0);await page.evaluate(()=>GAME_AUDIO.setRoute('garage'));for(const route of late)await route.continue();await page.unroute('**/*audio-craft*');await expect.poll(async()=>(await audio(page)).tracks.filter(t=>!t.ending).map(t=>t.id)).toEqual(['garage']);
 await page.route('**/*.wav',()=>{});const pending=page.evaluate(()=>GAME_AUDIO.play('draw.reveal'));await expect.poll(async()=>(await audio(page)).errors.some(e=>e.name==='TimeoutError'),{timeout:7000}).toBe(true);expect(await pending).toBe(false);await page.unroute('**/*.wav');expect((await audio(page)).startedCues).toBe(0);expect(await economy(page)).toEqual(before);
 const broken=await page.evaluate(async()=>{const c=new OfflineAudioContext(1,20,48000),b=c.createBuffer(1,4,48000);b.copyToChannel(new Float32Array([1,1,-1,-1]),0);const source=c.createBufferSource();source.buffer=b;source.loop=true;source.loopStart=0;source.loopEnd=4/48000;source.connect(c.destination);source.start();const rendered=await c.startRendering(),pcm=Array.from(rendered.getChannelData(0));return {pcm,seams:[4,8,12,16].map(at=>Math.abs(pcm[at]-pcm[at-1])),sourceLoop:source.loop};});for(const jump of broken.seams)expect(()=>validSeam(jump,2)).toThrow('decoded-loop-seam');
 await record(info,'negative-stress',{apiStress:true,expired,elapsedMs:Date.now()-start,lateRequests:late.length,failed:await audio(page),brokenLoopRejected:true,broken,before,after:await economy(page)});
});

test('quota reopen import reset and unmuted reload never replay missed result cues',async({page},info)=>{
 const initial=fixture('ready');initial.quizAt=Date.parse(fixed);initial.quizUsed=2;await open(page,info,'ready',{initial});await enable(page);await go(page,'research');await page.locator('#btnQuiz').click();await page.evaluate(()=>{S.quizUsed=3;});const before=await economy(page);for(let i=0;i<5;i++){const answer=await page.evaluate(()=>qState.qs[qState.i].a);await page.locator('#opts button').nth(answer).click();await page.locator('#qNext').click();}await page.locator('#qDone').click();expect((await snapshot(page)).starts.filter(r=>r.id==='research.reward')).toEqual([]);expect((await economy(page)).state.extra).toBe(before.state.extra);expect((await economy(page)).state.quizUsed).toBe(3);
 await expect(page.locator('#btnQuiz')).toBeDisabled();expect((await snapshot(page)).starts.filter(r=>r.id==='research.reward')).toEqual([]);
 await go(page,'workshop');await page.locator('#btnPull').click();const committed=await economy(page);await settings(page);await page.locator('#btnBackup').click();await expect(page.locator('#bkOut')).toBeVisible();const code=await page.locator('#bkOut').inputValue();await page.locator('#bkIn').fill(code);await page.locator('#bkLoad').click();await page.locator('#bkCancel').click();expect((await economy(page)).state.stock).toEqual(committed.state.stock);
 await page.locator('#bkLoad').click();await page.locator('#bkConfirm').click();const imported=await economy(page);expect(imported.state.stock).toEqual(committed.state.stock);expect(imported.state.pullUsed).toBe(committed.state.pullUsed);await page.locator('#backupX').click();await page.locator('#btnReset').click();const armed=await economy(page);expect(armed).toEqual(imported);await page.locator('#btnReset').click();const reset=await economy(page);expect(reset.state.owned).toEqual({});expect(reset.state.stock).toEqual({});await page.locator('#settingsX').click();const marker=await page.evaluate(()=>performance.now());await page.waitForTimeout(1600);const after=await snapshot(page);expect(after.starts.filter(r=>r.time>marker&&r.id?.startsWith('draw.'))).toEqual([]);expect(await economy(page)).toEqual(reset);
 await record(info,'quota-import-reset',{staleQuotaFixture:'quizUsed2 accepted opening then test-owned concurrent quota3 before accepted answers',before,committed,imported,reset,after,graph:await page.evaluate(()=>afGraph())});await page.reload();await page.waitForFunction(()=>typeof GAME_AUDIO!=='undefined'&&!saveHold);expect(await audio(page)).toMatchObject({optedIn:true,muted:false,state:'uncreated',tracks:[],voices:[]});expect(await page.evaluate(()=>afGraph().contexts)).toBe(0);await record(info,'unmuted-reload',{audio:await audio(page),graph:await page.evaluate(()=>afGraph()),state:await economy(page)});
});
