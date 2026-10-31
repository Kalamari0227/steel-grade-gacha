import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPackage} from '../../tools/game-build/package.mjs';
import {canonical} from '../../tools/game-build/io.mjs';
import {startEditionSite,record,cleanup} from '../helpers/edition-package-site.mjs';

const root=process.env.SGG_APP_ROOT || path.resolve(import.meta.dirname,'../..');
let packageRoot,initialBinding;
const education=process.env.SGG_EDUCATION_ROOT;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixed=Date.parse('2026-11-01T00:00:00+09:00');
const limits={index:1048576,initial:2097152,visual:41943040,audio:8000000};
const median=rows=>[...rows].sort((a,b)=>a-b)[1];
const catalog=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/catalog.json')));
const fixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/crafting-ready.json'))).state;
fixture.owned=Object.fromEntries(catalog.cards.map(c=>[c.id,true]));
fixture.stock=Object.fromEntries(catalog.cards.map(c=>[c.id,4]));
fixture.items={dagger:1,arrow:1};fixture.parts={};fixture.cars=[];

function within(kind,value){if(!Number.isFinite(value)||value<0||value>limits[kind])throw Error('budget:'+kind);return true;}
function timing(value,baseline){if(!Number.isFinite(value)||value>2000||value>baseline*1.25+500)throw Error('timing');return true;}
function noLeak(row){if(row.urls||row.observers||row.delta)throw Error('leak');return true;}
function nativeDisposed(rows){if(rows.some(row=>row.connected!==0||(!row.ended&&!(row.stopped&&Number.isFinite(row.stopDeadline)&&Number.isFinite(row.currentTime)&&row.currentTime>row.stopDeadline))))throw Error('native-source-lifecycle');return true;}
function boundedTimers(baseline,row){
 for(const timer of row.pendingTimeouts){const initial=baseline.pendingTimeouts.find(v=>v.id===timer.id);if(!initial||!timer.toast||timer.delay!==12000||initial.caller!==timer.caller||initial.scheduledAt!==timer.scheduledAt)throw Error('timer-lifecycle');}
 for(const timer of baseline.pendingTimeouts)if(!row.pendingTimeouts.some(v=>v.id===timer.id)&&!row.timeoutLedger.some(v=>v.id===timer.id&&['fired','cleared'].includes(v.state)))throw Error('timer-expiry-missing');
 return true;
}
function accounting(overflow){if(overflow)throw Error('accounting-overflow');return true;}
async function resolvePackageRoot(){
 const supplied=process.env.SGG_PACKAGE_ROOT;
 if(!supplied)throw Error('SGG_PACKAGE_ROOT missing: explicit absolute game package directory required');
 if(!path.isAbsolute(supplied))throw Error('SGG_PACKAGE_ROOT must be absolute');
 try{const resolved=await fs.realpath(supplied);if(!(await fs.stat(resolved)).isDirectory())throw Error('not a directory');return resolved;}
 catch(error){throw Error('SGG_PACKAGE_ROOT nonexistent or invalid directory: '+supplied,{cause:error});}
}
test.beforeAll(async({},info)=>{
 packageRoot=await resolvePackageRoot();
 try{initialBinding=await binding();await record(info,'explicit-package-binding',{packageRoot,...initialBinding});}
 catch(error){throw Error('SGG_PACKAGE_ROOT invalid, nongame, synthetic or stale package: '+packageRoot,{cause:error});}
});
test.afterAll(async()=>{if(initialBinding)expect(await binding()).toEqual(initialBinding);});
async function binding(){
 const {release,manifestPath}=await verifyPackage(packageRoot),files={};
 expect(release.syntheticFixture,'SGG_PACKAGE_ROOT synthetic fixture forbidden').toBe(false);
 for(const [name,expected] of Object.entries(release.inputs)){const b=await fs.readFile(path.join(root,name)),value=['docs/design/game-asset-manifest.json','src/audio/manifest.json'].includes(name)?canonical(JSON.parse(b)):b;expect(sha(value),'source input '+name).toBe(expected);files[name]={bytes:b.length,sha256:sha(b),releaseInputSHA:sha(value)};}
 for(const name of ['game-release.json',manifestPath,...release.files.map(r=>r.path)]){const b=await fs.readFile(path.join(packageRoot,name));files['package/'+name]={bytes:b.length,sha256:sha(b)};}
 for(const name of ['index.html','sw.js','game-release.json',manifestPath]){const b=await fs.readFile(path.join(root,name));expect(sha(b)).toBe(files['package/'+name].sha256);files['shipping/'+name]={bytes:b.length,sha256:sha(b)};}
 const baseline={};
 async function walk(dir,prefix=''){for(const row of await fs.readdir(dir,{withFileTypes:true})){const n=prefix+row.name;if(row.isDirectory())await walk(path.join(dir,row.name),n+'/');else if(row.isFile()){const b=await fs.readFile(path.join(dir,row.name));baseline[n]={bytes:b.length,sha256:sha(b)};}}}
 await walk(education);expect(Object.keys(baseline)).toHaveLength(219);
 const tar=await fs.readFile(path.join(education,'../education.tar'));expect(sha(tar)).toBe('3b83bf67195ff0681a57ab286ec5626829295c765d63c0947b3c3ca26d210671');
 expect(baseline['index.html'].sha256).toBe('99537b579bddbb93994b7e19fad2348c736c8cb95e1bfa1a4d5dbdeedafa7126');
 return {release,manifestPath,files,baseline,archive:{bytes:tar.length,sha256:sha(tar)}};
}
async function site(info,withEducation=false){
 return startEditionSite(info,{name:'performance',mounts:[{path:'/game/',package:{root:packageRoot}},...(withEducation?[{path:'/edu/',education}]:[])]});
}
function clockAndReadiness({time,variant,seed=null}){
 const NativeDate=Date,refs={performance,now:performance.now,entries:performance.getEntriesByType,timeout:setTimeout,raf:requestAnimationFrame,events:performance.addEventListener};
 function FixedDate(...args){if(new.target)return Reflect.construct(NativeDate,args.length?args:[time],new.target);return new NativeDate(time).toString();}
 Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.prototype=NativeDate.prototype;FixedDate.now=()=>time;window.Date=FixedDate;
 if(seed)localStorage.setItem('sgg_game_save_v1',JSON.stringify(seed));
 const probe={main:0,offline:0,decode:0};window.coldAudio=probe;
 for(const [key,kind] of [['AudioContext','main'],['webkitAudioContext','main'],['OfflineAudioContext','offline']])if(window[key]){const Native=window[key];window[key]=new Proxy(Native,{construct(target,args,newTarget){probe[kind]++;return Reflect.construct(target,args,newTarget);}});}
 const decode=BaseAudioContext.prototype.decodeAudioData;BaseAudioContext.prototype.decodeAudioData=function(...args){probe.decode++;return Reflect.apply(decode,this,args);};
 performance.setResourceTimingBufferSize(10000);window.timingOverflow=false;performance.addEventListener('resourcetimingbufferfull',()=>window.timingOverflow=true);
 window.readyResult=null;
 const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return !!el.getClientRects().length&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&s.visibility!=='hidden'&&s.display!=='none';};
 const imageSet=()=>[...document.images].filter(visible);
 const backgroundSet=()=>[...new Set([...document.querySelectorAll('body *')].filter(visible).flatMap(el=>[...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>new URL(m[1],location.href).href)))].sort();
 const frame=()=>new Promise(requestAnimationFrame);
 const run=async()=>{try{
  while(typeof S==='undefined'||saveHold||!document.getElementById('btnPull')||document.getElementById('btnPull').disabled||document.getElementById('btnPull').closest('[inert]')||(variant==='game'&&(document.body.dataset.route!=='workshop'||document.getElementById('view-workshop').hidden)))await frame();
  await document.fonts.ready;
  let images,backgrounds,stable=false;
  for(let attempt=0;attempt<8&&!stable;attempt++){
   images=imageSet();backgrounds=backgroundSet();
   await Promise.all(images.map(i=>i.decode()));
   await Promise.all(backgrounds.map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>i.decode().then(resolve,reject);i.onerror=()=>reject(Error('CSS image failed'));i.src=src;})));
   const signature=JSON.stringify([images.map(i=>i.currentSrc),backgrounds]);await frame();await frame();stable=signature===JSON.stringify([imageSet().map(i=>i.currentSrc),backgroundSet()]);
  }
  if(!stable)throw Error('Visible image set did not settle');
  if(images.some(i=>!i.complete||!i.naturalWidth||!i.naturalHeight))throw Error('Visible image decode incomplete');
  if(document.querySelector('[data-status="error"]'))throw Error('Artwork fallback present');
  const ready=performance.now();window.readyResult={ready,images:images.map(i=>({url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight})),backgrounds,fonts:document.fonts.status,saveHold,route:document.body.dataset.route,cta:{disabled:document.getElementById('btnPull').disabled,inert:!!document.getElementById('btnPull').closest('[inert]')},stableFrames:2,audio:{...probe},clock:Object.fromEntries(Object.entries(refs).map(([k,v])=>[k,k==='timeout'?setTimeout===v:k==='raf'?requestAnimationFrame===v:k==='events'?performance.addEventListener===v:k==='performance'?performance===v:k==='now'?performance.now===v:performance.getEntriesByType===v])),navigation:performance.getEntriesByType('navigation').length,timeOrigin:performance.timeOrigin,monotonic:performance.now()>0,overflow:window.timingOverflow};
 }catch(error){window.readyResult={error:error.message,at:performance.now()};}};
 if(document.readyState==='complete')void run();else addEventListener('load',run,{once:true});
}
function network(page,base){
 let next=0;const rows=[],jobs=[],ids=new WeakMap(),errors=[];
 page.on('request',request=>{if(!request.url().startsWith(base))return;const row={id:++next,url:request.url(),type:request.resourceType(),state:'requested'};ids.set(request,row);rows.push(row);});
 page.on('requestfailed',request=>{const row=ids.get(request);if(row)Object.assign(row,{state:'failed',failure:request.failure()});});
 page.on('requestfinished',request=>{const row=ids.get(request);if(!row)return;jobs.push((async()=>{const response=await request.response(),body=await response.body();Object.assign(row,{state:'finished',status:response.status(),mime:response.headers()['content-type'],bodySHA:sha(body),actualBodyBytes:body.length,...await request.sizes(),timing:request.timing()});})().catch(error=>Object.assign(row,{state:'error',error:error.message})));});
 page.on('pageerror',error=>errors.push(error.message));
 return {rows,errors,async settle(){await Promise.all(jobs);return rows;}};
}
async function ready(page){await page.waitForFunction(()=>window.readyResult!==null);return page.evaluate(()=>window.readyResult);}
async function fresh(browser){return browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul',serviceWorkers:'block'});}
async function cold(browser,server,variant,round,info){
 const context=await fresh(browser);try{
  expect(await context.storageState()).toEqual({cookies:[],origins:[]});const page=await context.newPage(),ledger=network(page,server.url);
  await page.addInitScript(clockAndReadiness,{time:fixed,variant});const response=await page.goto(server.url+(variant==='game'?'/game/':'/edu/'),{waitUntil:'load'});
  const result=await ready(page);await page.waitForLoadState('networkidle');await ledger.settle();
  const row={variant,round,...result,servedSHA:sha(await response.body()),requests:ledger.rows,pageErrors:ledger.errors,storage:await context.storageState(),cacheState:await page.evaluate(async()=>({cacheKeys:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).length,resources:performance.getEntriesByType('resource').map(e=>({url:e.name,transfer:e.transferSize})),overflow:timingOverflow}))};
  row.initialBytes=ledger.rows.reduce((n,r)=>n+r.responseBodySize+r.responseHeadersSize,0);
  row.readyCutoffBytes=ledger.rows.filter(r=>r.timing.startTime-result.timeOrigin+r.timing.responseEnd<=result.ready).reduce((n,r)=>n+r.responseBodySize+r.responseHeadersSize,0);
  await record(info,`cold-${round}-${variant}`,row);await page.screenshot({path:info.outputPath(`ready-${round}-${variant}.png`)});
  expect(result.error).toBeUndefined();expect(ledger.errors).toEqual([]);expect(ledger.rows.length).toBeGreaterThan(0);expect(ledger.rows.every(r=>r.state==='finished'&&r.status===200&&Number.isFinite(r.responseBodySize)&&r.responseBodySize>=0&&Number.isFinite(r.responseHeadersSize)&&r.responseHeadersSize>0)).toBe(true);
  expect(result.clock).toEqual({performance:true,now:true,entries:true,timeout:true,raf:true,events:true});expect(result.navigation).toBe(1);accounting(result.overflow||row.cacheState.overflow);expect(row.cacheState.workers).toBe(0);expect(row.cacheState.cacheKeys).toEqual([]);
  if(variant==='game'){
   expect(result.audio).toEqual({main:0,offline:0,decode:0});expect(ledger.rows.filter(r=>r.mime.startsWith('audio/'))).toEqual([]);within('initial',row.initialBytes);
   const {release}=await verifyPackage(packageRoot);for(const r of ledger.rows){const name=new URL(r.url).pathname.slice(6)||'index.html',expected=release.files.find(f=>f.path===name);expect(expected,'declared request '+name).toBeTruthy();expect(r.bodySHA).toBe(expected.sha256);expect(r.actualBodyBytes).toBe(expected.bytes);expect(r.mime).toBe(expected.mime);}
   expect(ledger.rows.filter(r=>/character/.test(r.url))).toHaveLength(0);
  }
  for(const e of row.cacheState.resources)expect(ledger.rows.some(r=>r.url===e.url&&r.state==='finished'),'ResourceTiming reconciliation '+e.url).toBe(true);
  return row;
 }finally{await context.close();}}

test('shipping package and persistent education binding satisfy actual file and HTTP budgets',async({},info)=>{
 const before=await binding(),server=await site(info,true);try{
  const sums={index:before.files['package/index.html'].bytes,visual:0,audio:0},http=[];
  for(const row of before.release.files){if(row.mime.startsWith('image/'))sums.visual+=row.bytes;if(row.mime.startsWith('audio/'))sums.audio+=row.bytes;const response=await fetch(server.url+'/game/'+row.path),body=Buffer.from(await response.arrayBuffer());expect(response.status).toBe(200);expect(sha(body)).toBe(row.sha256);expect(body.length).toBe(row.bytes);expect(response.headers.get('content-type')).toBe(row.mime);http.push({path:row.path,bytes:body.length,sha256:sha(body),mime:response.headers.get('content-type')});}
  for(const [kind,value] of Object.entries(sums))within(kind,value);
  expect((await fetch(server.url+'/game/src/app_tpl.html')).status).toBe(404);
  await record(info,'package-inventory',{before,sums,http});expect(await binding()).toEqual(before);
 }finally{await server.close();}
});

test('three interleaved fresh native cold runs per variant satisfy independent engine readiness',async({browser},info)=>{
 const before=await binding(),server=await site(info,true),runs=[];try{
  for(let round=0;round<3;round++)for(const variant of round%2?['game','education']:['education','game'])runs.push(await cold(browser,server,variant,round,info));
  const game=median(runs.filter(r=>r.variant==='game').map(r=>r.ready)),edu=median(runs.filter(r=>r.variant==='education').map(r=>r.ready));
  await record(info,'median',{runs:runs.map(r=>({variant:r.variant,round:r.round,ready:r.ready,initialBytes:r.initialBytes})),game,education:edu,absoluteLimit:2000,relativeLimit:edu*1.25+500});expect(runs).toHaveLength(6);timing(game,edu);expect(await binding()).toEqual(before);
 }finally{await server.close();}
});

function resourceProbe(){
 const originalAdd=EventTarget.prototype.addEventListener,originalRemove=EventTarget.prototype.removeEventListener;
 const targetIds=new WeakMap(),listenerIds=new WeakMap(),nodes=new WeakMap(),buffers=new WeakMap(),mainRefs=[],sourceRefs=new Map(),contextRefs=new Map(),sourceLedger=[];let targetId=0,listenerId=0,nodeId=0,bufferId=0;
 let weakTargets=[];const listenerRows=new Map(),edges=new Map(),sources=new Map(),frames=new Set(),timers=new Map(),timeoutLedger=[],urls=new Set(),listenerWrappers=new WeakMap();let timeoutId=0;
 const counters={main:0,offline:0,decodeAttempts:0,decoded:[],maxSources:0,maxBGM:0,maxSFX:0,maxNodes:0,maxEdges:0,maxFrames:0,frameScheduled:0,frameFired:0,urlCreated:0,urlRevoked:0,observers:0,toolObservers:0,observerOrigins:[]};
 const id=node=>{if(!nodes.has(node))nodes.set(node,++nodeId);return nodes.get(node);};
 const nativePlaying=()=>[...sources.values()].filter(row=>!row.ended&&(!row.stopped||sourceRefs.get(row.id)?.deref()?.context.currentTime<row.stopDeadline));
 const peaks=()=>{const playing=nativePlaying();counters.maxBGM=Math.max(counters.maxBGM,playing.filter(r=>r.loop).length);counters.maxSFX=Math.max(counters.maxSFX,playing.filter(r=>!r.loop).length);counters.maxNodes=Math.max(counters.maxNodes,[...edges.values()].filter(v=>v.size).length);};
 const graph=()=>{let total=0;for(const row of edges.values())total+=row.size;return total;};
 EventTarget.prototype.addEventListener=function(type,listener,options){
  if(!listener)return Reflect.apply(originalAdd,this,[type,listener,options]);
  if(!targetIds.has(this)){targetIds.set(this,++targetId);weakTargets.push({id:targetId,ref:new WeakRef(this)});}
  if(!listenerIds.has(listener))listenerIds.set(listener,++listenerId);
  const key=targetIds.get(this)+':'+type+':'+listenerIds.get(listener)+':'+Boolean(typeof options==='boolean'?options:options?.capture);
  let wrappers=listenerWrappers.get(listener);if(!wrappers){wrappers=new Map();listenerWrappers.set(listener,wrappers);}
  const previous=wrappers.get(key)?.deref();if(previous&&listenerRows.has(key))return Reflect.apply(originalAdd,this,[type,previous,options]);
  const once=!!options?.once;
  const wrapper=function(...args){if(once)listenerRows.delete(key);return typeof listener==='function'?Reflect.apply(listener,this,args):Reflect.apply(listener.handleEvent,listener,args);};
  const result=Reflect.apply(originalAdd,this,[type,wrapper,options]);
  if(!options?.signal?.aborted){wrappers.set(key,new WeakRef(wrapper));listenerRows.set(key,{target:targetIds.get(this),type,once});if(options?.signal)originalAdd.call(options.signal,'abort',()=>listenerRows.delete(key),{once:true});}return result;
 };
 EventTarget.prototype.removeEventListener=function(type,listener,options){
  const key=listener&&targetIds.has(this)&&listenerIds.has(listener)?targetIds.get(this)+':'+type+':'+listenerIds.get(listener)+':'+Boolean(typeof options==='boolean'?options:options?.capture):null;
  const wrapper=key?listenerWrappers.get(listener)?.get(key)?.deref():null;
  const result=Reflect.apply(originalRemove,this,[type,wrapper||listener,options]);if(key)listenerRows.delete(key);return result;
 };
 const nativeRAF=requestAnimationFrame,nativeCancel=cancelAnimationFrame;
 window.requestAnimationFrame=function(callback){let handle;handle=nativeRAF.call(this,function(...args){frames.delete(handle);counters.frameFired++;return Reflect.apply(callback,this,args);});frames.add(handle);counters.frameScheduled++;counters.maxFrames=Math.max(counters.maxFrames,frames.size);return handle;};
 window.cancelAnimationFrame=function(handle){const result=nativeCancel.call(this,handle);frames.delete(handle);return result;};
 const nativeTimeout=setTimeout,nativeClear=clearTimeout;
 window.setTimeout=function(callback,delay,...args){
  const row={id:++timeoutId,delay:Number(delay)||0,scheduledAt:performance.now(),caller:new Error().stack,callback:String(callback),state:'pending'};let handle;
  const invoke=typeof callback==='function'?function(...values){timers.delete(handle);row.state='fired';row.finishedAt=performance.now();return Reflect.apply(callback,this,values);}:callback;
  handle=nativeTimeout.call(this,invoke,delay,...args);timers.set(handle,row);timeoutLedger.push(row);return handle;
 };
 window.clearTimeout=function(handle){const result=nativeClear.call(this,handle),row=timers.get(handle);if(row){row.state='cleared';row.finishedAt=performance.now();timers.delete(handle);}return result;};
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
 URL.createObjectURL=function(...args){const result=Reflect.apply(create,this,args);urls.add(result);counters.urlCreated++;return result;};
 URL.revokeObjectURL=function(value){const result=Reflect.apply(revoke,this,[value]);if(urls.delete(value))counters.urlRevoked++;return result;};
 for(const name of ['MutationObserver','ResizeObserver','IntersectionObserver','PerformanceObserver'])if(window[name]){const Native=window[name];window[name]=new Proxy(Native,{construct(target,args,newTarget){const obj=Reflect.construct(target,args,newTarget),stack=new Error().stack,callback=String(args[0]),tool=name==='MutationObserver'&&(stack.includes('InjectedScript._setupGlobalListenersRemovalDetection')||stack.includes('_setupGlobalListenersRemovalDetection@\nInjectedScript@'))&&callback.includes('this.onGlobalListenersRemoved'),kind=tool?'toolObservers':'observers';if(counters.observerOrigins.length<8)counters.observerOrigins.push({name,stack,callback:callback.slice(0,1000),owner:tool?'playwright-global-listener-removal':'observed-test-or-product'});let active=false;const observe=obj.observe,disconnect=obj.disconnect;obj.observe=function(...values){const result=Reflect.apply(observe,this,values);if(!active){active=true;counters[kind]++;}return result;};obj.disconnect=function(...values){const result=Reflect.apply(disconnect,this,values);if(active){active=false;counters[kind]--;}return result;};return obj;}});}
 for(const [name,kind] of [['AudioContext','main'],['webkitAudioContext','main'],['OfflineAudioContext','offline']])if(window[name]){const Native=window[name];window[name]=new Proxy(Native,{construct(target,args,newTarget){const result=Reflect.construct(target,args,newTarget);counters[kind]++;if(kind==='main')mainRefs.push(new WeakRef(result));return result;}});}
 window.resumeStoppedNative=()=>Promise.all(mainRefs.map(ref=>ref.deref()).filter(Boolean).map(context=>context.resume()));
 const decode=BaseAudioContext.prototype.decodeAudioData;
 BaseAudioContext.prototype.decodeAudioData=function(...args){counters.decodeAttempts++;const result=Reflect.apply(decode,this,args);result.then(buffer=>{if(!buffers.has(buffer)){buffers.set(buffer,++bufferId);counters.decoded.push({id:bufferId,frames:buffer.length,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,pcmBytes:buffer.length*buffer.numberOfChannels*4,offline:this instanceof OfflineAudioContext});}},()=>{});return result;};
 const connect=AudioNode.prototype.connect,disconnect=AudioNode.prototype.disconnect;
 AudioNode.prototype.connect=function(target,...args){const result=Reflect.apply(connect,this,[target,...args]);const source=id(this),destination=id(target);if(!edges.has(source))edges.set(source,new Set());edges.get(source).add(destination);counters.maxEdges=Math.max(counters.maxEdges,graph());peaks();return result;};
 AudioNode.prototype.disconnect=function(...args){const result=Reflect.apply(disconnect,this,args);if(!args.length)edges.delete(id(this));else if(args[0]&&typeof args[0]==='object')edges.get(id(this))?.delete(id(args[0]));else edges.delete(id(this));return result;};
 const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...args){const result=Reflect.apply(start,this,args),number=id(this),row={id:number,started:true,startedAt:performance.now(),contextStart:this.context.currentTime,stopped:false,ended:false,loop:this.loop};sources.set(number,row);sourceRefs.set(number,new WeakRef(this));contextRefs.set(number,new WeakRef(this.context));sourceLedger.push(row);peaks();counters.maxSources=Math.max(counters.maxSources,nativePlaying().length);originalAdd.call(this,'ended',event=>{const current=sources.get(number);if(current){current.ended=true;current.endedAt=performance.now();current.contextEnd=event.target.context.currentTime;}},{once:true});return result;};
 AudioBufferSourceNode.prototype.stop=function(...args){const result=Reflect.apply(stop,this,args);const row=sources.get(id(this));if(row){row.stopped=true;row.stoppedAt=performance.now();row.contextStop=this.context.currentTime;row.stopArgs=args;row.stopDeadline=Math.max(this.context.currentTime,Number(args[0]??0));}return result;};
 window.resources=()=>{
  for(const row of sourceLedger){const source=sourceRefs.get(row.id)?.deref();if(source)row.lastContextTime=source.context.currentTime;}
  const connected=new Set();weakTargets=weakTargets.filter(row=>{const node=row.ref.deref();if(!node)return false;if(node===window||node===document||node.isConnected)connected.add(row.id);return true;});
  const liveListeners=[...listenerRows.values()].filter(r=>connected.has(r.target)).length;
  const result={...counters,decoded:[...counters.decoded],sourceLedger:sourceLedger.map(row=>{const source=sourceRefs.get(row.id)?.deref(),context=contextRefs.get(row.id)?.deref();return {...row,connected:edges.get(row.id)?.size||0,currentTime:context?.currentTime??row.lastContextTime,contextState:context?.state??null,weakAlive:!!source};}),frames:frames.size,timers:timers.size,pendingTimeouts:[...timers].map(([handle,row])=>({...row,toast:typeof showToast==='function'&&handle===showToast.t&&/showToast(?:@| \()/.test(row.caller)&&row.callback.includes('revealRouteFocus(target,route)')})),timeoutLedger:timeoutLedger.map(row=>({...row})),urls:urls.size,edges:graph(),connectedNodes:[...edges.values()].filter(v=>v.size).length,nativePlaying:nativePlaying().length,activeSources:[...sources].filter(([key,v])=>!v.ended&&edges.get(key)?.size).length,stoppedDisconnectedAwaitingEnded:[...sources].filter(([key,v])=>v.stopped&&!v.ended&&!edges.get(key)?.size).length,liveListeners,onceListeners:[...listenerRows.values()].filter(r=>connected.has(r.target)&&r.once).length,dom:document.querySelectorAll('*').length,gallery:document.querySelectorAll('#galleryArt .game-card,#galleryBefore .game-card,#galleryAfter .game-card').length,home:document.querySelectorAll('#homeFigure .game-card').length,audio:typeof GAME_AUDIO==='undefined'?null:GAME_AUDIO.snapshot(),garage:typeof GAME_GARAGE==='undefined'?null:GAME_GARAGE.snapshot(),craft:typeof GAME_CRAFTING==='undefined'?null:GAME_CRAFTING.snapshot()};
  for(const [key,row] of listenerRows)if(!weakTargets.some(r=>r.id===row.target))listenerRows.delete(key);
  for(const [key,row] of sources)if(row.ended)sources.delete(key);
  return result;
 };
}
async function bootResource(browser,server){
 const context=await fresh(browser),page=await context.newPage();
 await page.addInitScript(resourceProbe);await page.addInitScript(({time,state})=>{const Native=Date;function FixedDate(...args){if(new.target)return Reflect.construct(Native,args.length?args:[time],new.target);return new Native(time).toString();}Object.setPrototypeOf(FixedDate,Native);FixedDate.prototype=Native.prototype;FixedDate.now=()=>time;window.Date=FixedDate;localStorage.setItem('sgg_game_save_v1',JSON.stringify(state));},{time:fixed,state:fixture});
 await page.goto(server.url+'/game/');await page.waitForFunction(()=>typeof GAME_GARAGE!=='undefined'&&GAME_GARAGE.snapshot().ready&&!saveHold);
 return {context,page};
}
async function settleArt(page){
 await page.waitForFunction(()=>{
  if([...document.querySelectorAll('[data-status="loading"]')].some(e=>e.closest('#galleryArt,#galleryBefore,#galleryAfter,#materialArt,#pickModal,#garageStage')))return false;
  return [...document.images].filter(i=>{const r=i.getBoundingClientRect(),s=getComputedStyle(i);return i.getAttribute('src')&&i.getClientRects().length&&s.visibility!=='hidden'&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;}).every(i=>i.complete);
 });
 return page.evaluate(async()=>{
  const visible=i=>{const r=i.getBoundingClientRect(),s=getComputedStyle(i);return i.getAttribute('src')&&i.getClientRects().length&&s.visibility!=='hidden'&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;};
  const images=[...document.images].filter(visible),urls=images.map(i=>i.currentSrc);
  await Promise.all(images.map(i=>i.decode()));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  const current=[...document.images].filter(visible);
  if(images.length!==current.length||images.some((i,n)=>i!==current[n]||!i.isConnected||i.currentSrc!==urls[n]||!i.complete||!i.naturalWidth))throw Error('Visible image request changed while settling');
  const gallery=document.querySelectorAll('#galleryArt .game-card,#galleryBefore .game-card,#galleryAfter .game-card').length;
  if(gallery>3)throw Error('Gallery visible-neighbor budget');
  return {images:images.map(i=>({url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight})),gallery,stableFrames:2};
 });
}
async function domClick(page,selector){await page.locator(selector).first().evaluate(el=>{if(el.disabled||el.closest('[hidden],[inert]'))throw Error('Unavailable action '+el.id);el.click();});}
async function route(page,name){await domClick(page,'.destination-nav a[href="#'+name+'"]');await expect(page.locator('#view-'+name)).toBeVisible();}
const economic=page=>page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY)}));
async function canonicalWorkshop(page){
 await route(page,'dex');await domClick(page,'#dexModeGrid');await domClick(page,'#dex [data-card-id="poo-270C"]');await page.keyboard.press('Escape');
 await route(page,'workshop');await page.evaluate(()=>{const t=document.getElementById('toast');if(t.classList.contains('show'))document.getElementById('toastX').click();});await settleArt(page);await page.waitForFunction(()=>GAME_AUDIO.snapshot().tracks.length<=1&&GAME_AUDIO.snapshot().voices.length===0&&resources().frames===0&&resources().pendingTimeouts.every(t=>t.toast));
 return page.evaluate(()=>resources());
}

test('twenty real route and gallery cycles bound native resources and preserve all 47 faces and economy',async({browser},info)=>{
 const server=await site(info),{context,page}=await bootResource(browser,server),ledger=network(page,server.url),rows=[],faces=new Set();try{
  const pre=await page.evaluate(()=>resources());expect({main:pre.main,offline:pre.offline,decode:pre.decodeAttempts}).toEqual({main:0,offline:0,decode:0});
  await page.locator('#gameAudioChoice [data-audio-enable]').click();await page.waitForFunction(()=>GAME_AUDIO.snapshot().tracks.length===1);
  const before=await economic(page);
  const start=await canonicalWorkshop(page);await record(info,'loop-baseline',{before,pre,start});
  for(let cycle=0;cycle<20;cycle++){
   await route(page,'dex');await domClick(page,'#dexModeGallery');
   const startIndex=(cycle*3)%45;
   await page.evaluate(id=>{GAME_COLLECTION.select(id);GAME_COLLECTION.refresh();},catalog.cards[startIndex].id);
   for(let step=0;step<3;step++){
    const card=catalog.cards[startIndex+step];if(!card)break;
    if(step)await domClick(page,'#galleryNext');await settleArt(page);
    faces.add(card.id+':front');expect(await page.locator('#dexGallery').getAttribute('data-card-id')).toBe(card.id);
    if(card.alt){await domClick(page,'[data-gallery-side="1"]');await settleArt(page);faces.add(card.id+':alt');await domClick(page,'[data-gallery-side="0"]');}
   }
   await domClick(page,'#galleryPrev');await domClick(page,'#galleryNext');await domClick(page,'#galleryDetail');await settleArt(page);await page.keyboard.press('Escape');
   await domClick(page,'#galleryEquipment');
   const option=page.locator('[data-card-equipment]').first();if(await option.count()){await option.evaluate(el=>el.click());await domClick(page,'#pickModal [data-equip-id]');await settleArt(page);await domClick(page,'#equipCancel');}await page.keyboard.press('Escape');
   await route(page,'craft');await domClick(page,'#parts [data-part-key="bpillar"]');await settleArt(page);await domClick(page,'#craftBack');
   await route(page,'research');await route(page,'garage');await settleArt(page);await route(page,'workshop');
   const sample=await canonicalWorkshop(page);rows.push({cycle:cycle+1,...sample});
   await record(info,'route-loops-progress',{completedCycles:cycle+1,faces:[...faces],rows});
   expect(sample.gallery).toBe(0);expect(sample.home).toBeLessThanOrEqual(1);noLeak({urls:sample.urls,observers:sample.observers,delta:0});expect(sample.frames).toBe(0);expect(sample.garage.pendingTimerCount).toBe(0);expect(sample.craft.pendingTimerCount).toBe(0);expect(sample.main).toBe(1);expect(sample.edges).toBeLessThanOrEqual(6);expect(sample.connectedNodes).toBeLessThanOrEqual(6);expect(sample.nativePlaying).toBeLessThanOrEqual(1);expect(boundedTimers(start,sample)).toBe(true);expect(sample.audio.tracks.length).toBeLessThanOrEqual(1);expect(sample.audio.voices).toHaveLength(0);
   expect(await economic(page)).toEqual(before);
  }
  const last=rows.at(-1),comparison=rows.filter(r=>[1,5,10,20].includes(r.cycle));
  await record(info,'route-loops',{completedCycles:rows.length,faces:[...faces],comparison,before,after:await economic(page),rows,network:await ledger.settle()});
  expect(faces.size).toBe(47);expect(last.maxEdges).toBeLessThanOrEqual(14);expect(last.maxNodes).toBeLessThanOrEqual(14);expect(last.maxBGM).toBeLessThanOrEqual(2);expect(last.maxSFX).toBeLessThanOrEqual(6);expect(last.audio.maxTracks).toBeLessThanOrEqual(2);expect(last.audio.maxVoices).toBeLessThanOrEqual(6);expect(last.audio.decoded.length).toBeLessThanOrEqual(28);
  for(const row of comparison){expect(row.dom).toBe(start.dom);expect(row.liveListeners).toBe(start.liveListeners);expect(boundedTimers(start,row)).toBe(true);}
  const cached=last.audio.decoded;await route(page,'garage');await route(page,'craft');await route(page,'dex');await canonicalWorkshop(page);expect(await page.evaluate(()=>GAME_AUDIO.snapshot().decoded)).toEqual(cached);
  const demanded=[];
  for(const [name,selector] of [['craft','#parts .pcell img'],['research','#items .guarantee-item img']]){
   await route(page,name);const image=page.locator(selector).last();await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);await image.evaluate(i=>i.decode());demanded.push({route:name,...await image.evaluate(i=>({url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight,loading:i.loading,rect:i.getBoundingClientRect().toJSON()}))});await page.screenshot({path:info.outputPath('lazy-'+name+'.png')});
  }
  await record(info,'lazy-route-demand',{demanded,before,after:await economic(page)});expect(demanded.every(r=>r.loading==='lazy'&&r.width>0&&r.height>0)).toBe(true);expect(await economic(page)).toEqual(before);await canonicalWorkshop(page);
  await page.evaluate(()=>GAME_AUDIO.setMute(true));await page.waitForFunction(()=>resources().activeSources===0);const muted=await page.evaluate(()=>resources());expect(muted.edges).toBeLessThanOrEqual(4);expect(muted.audio.tracks).toHaveLength(0);expect(muted.audio.voices).toHaveLength(0);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));const hidden=await page.evaluate(()=>resources());expect(hidden.audio.tracks).toHaveLength(0);expect(hidden.audio.voices).toHaveLength(0);
  await page.evaluate(()=>resumeStoppedNative());await page.waitForFunction(()=>resources().sourceLedger.every(r=>r.ended||(r.stopped&&Number.isFinite(r.stopDeadline)&&r.currentTime>r.stopDeadline)));expect(nativeDisposed((await page.evaluate(()=>resources())).sourceLedger)).toBe(true);const resumed=await page.evaluate(()=>resources());expect(resumed.activeSources).toBe(0);expect(resumed.edges).toBeLessThanOrEqual(4);
  await record(info,'native-resource-final',{muted,hidden,resumed,logicalDecoded:cached,pcmBytes:last.decoded.reduce((n,r)=>n+r.pcmBytes,0),limitations:'Weak bookkeeping and connected graph bounds; no GC or universal heap-free claim'});await page.screenshot({path:info.outputPath('final.png')});
 }finally{await cleanup([()=>context.close(),()=>server.close()]);}
});

test('native slow image and corrupt decoder controls reject false readiness and recover retry disposal',async({browser},info)=>{
 const server=await site(info),{release}=await verifyPackage(packageRoot),contexts=[];try{
  const scene=release.files.find(f=>f.path.includes('/scene-workshop-back.')).path,slow=await fresh(browser);contexts.push(slow);const page=await slow.newPage();let gate;
  await page.route('**/'+scene,route=>{gate=route;});await page.addInitScript(clockAndReadiness,{time:fixed,variant:'game'});await page.goto(server.url+'/game/',{waitUntil:'domcontentloaded'});await expect.poll(()=>!!gate).toBe(true);
  const blocked=await page.evaluate(()=>({ready:readyResult,time:performance.now(),complete:document.querySelector('.home-scene-back img')?.complete}));expect(blocked.ready).toBe(null);
  await page.waitForFunction(()=>performance.now()>2100);expect(await page.evaluate(()=>readyResult)).toBe(null);await gate.continue();const released=await ready(page);expect(released.error).toBeUndefined();expect(released.ready).toBeGreaterThan(2000);expect(()=>timing(released.ready,10000)).toThrow('timing');await record(info,'negative-slowimage',{blocked,released,oracleRejected:true});await page.screenshot({path:info.outputPath('slow-released.png')});await slow.close();contexts.pop();
  const {context,page:retry}=await bootResource(browser,server);contexts.push(context);await retry.locator('#gameAudioChoice [data-audio-silent]').click();await route(retry,'dex');
  const asset=await retry.evaluate(()=>IMG_ALT['poo-PHS']);let mode='corrupt',pending;
  await retry.route('**/'+asset,async route=>{if(mode==='corrupt')await route.fulfill({status:200,contentType:'image/webp',body:Buffer.from('invalid native decoder image')});else if(mode==='pending'&&route.request().resourceType()==='fetch')pending=route;else await route.continue();});
  await retry.evaluate(()=>{GAME_COLLECTION.select('poo-PHS');GAME_COLLECTION.refresh();});await domClick(retry,'#dexModeGallery');await domClick(retry,'[data-gallery-side="1"]');
  await expect(retry.locator('#galleryArt [data-status="error"]')).toHaveCount(1);
  const failed=await retry.locator('#galleryArt .game-card-character img').evaluate(async image=>{try{await image.decode();return {decoded:true};}catch(error){return {decoded:false,error:error.name,width:image.naturalWidth};}});expect(failed.decoded).toBe(false);
  const before=await economic(retry);mode='recover';await retry.locator('#galleryArt .game-card-character button').click();await settleArt(retry);expect(await retry.locator('#galleryArt .game-card-character img').evaluate(i=>[i.naturalWidth,i.naturalHeight])).toEqual([960,1440]);expect(await retry.evaluate(()=>resources().urls)).toBe(0);
  mode='corrupt';await domClick(retry,'[data-gallery-side="0"]');await domClick(retry,'[data-gallery-side="1"]');await expect(retry.locator('#galleryArt [data-status="error"]')).toHaveCount(1);mode='pending';await retry.locator('#galleryArt .game-card-character button').click();await expect.poll(()=>!!pending).toBe(true);
  await retry.evaluate(()=>{window.disposedImage=new WeakRef(document.querySelector('#galleryArt .game-card-character img'));});
  await route(retry,'research');await pending.abort().catch(error=>{if(!/handled|closed|Target/.test(error.message))throw error;});
  const disposed=await retry.evaluate(()=>{const image=disposedImage.deref();return !image||(!image.isConnected&&!image.getAttribute('src')&&!image.onload&&!image.onerror);});expect(disposed).toBe(true);expect(await retry.evaluate(()=>resources().urls)).toBe(0);
  await retry.unroute('**/'+asset);await retry.evaluate(()=>{for(const name of ['dex','garage','craft','research','workshop'])document.querySelector('.destination-nav a[href="#'+name+'"]').click();});await settleArt(retry);expect(await retry.locator('body').getAttribute('data-route')).toBe('workshop');expect(await retry.evaluate(()=>resources().gallery)).toBe(0);expect(await economic(retry)).toEqual(before);
  await record(info,'negative-decoder-retry',{failed,disposed,before,after:await economic(retry),resources:await retry.evaluate(()=>resources())});await retry.screenshot({path:info.outputPath('retry-disposed.png')});
 }finally{await cleanup([...contexts.map(c=>()=>c.close()),()=>server.close()]);}
});

test('native buffer overflow numeric boundaries and forced real resources reject misleading success',async({browser},info)=>{
 const server=await site(info),{context,page}=await bootResource(browser,server);try{
  const controls=[];for(const [kind,limit] of Object.entries(limits)){expect(within(kind,limit)).toBe(true);expect(()=>within(kind,limit+1)).toThrow('budget:'+kind);controls.push({kind,exact:limit,rejected:limit+1});}
  for(const value of [NaN,Infinity,-1])expect(()=>within('index',value)).toThrow('budget:index');expect(()=>timing(2001,99999)).toThrow('timing');expect(()=>timing(1001,100)).toThrow('timing');expect(timing(625,100)).toBe(true);
  const overflow=await page.evaluate(async()=>{performance.clearResourceTimings();performance.setResourceTimingBufferSize(1);let observed=false;const event=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Missing native overflow')),5000);performance.addEventListener('resourcetimingbufferfull',()=>{clearTimeout(timeout);observed=true;resolve();},{once:true});});await Promise.all([1,2,3].map(n=>fetch('icon-192.png?resource-overflow='+n,{cache:'no-store'}).then(r=>r.arrayBuffer())));await event;return {observed,native:performance instanceof Performance,entries:performance.getEntriesByType('resource').length};});expect(overflow.observed).toBe(true);expect(()=>accounting(overflow.observed)).toThrow('accounting-overflow');
  const forced=await page.evaluate(()=>{const baseline=resources();const url=URL.createObjectURL(new Blob(['owned negative']));const observer=new MutationObserver(()=>{});observer.observe(document.body,{childList:true});const leaked=resources();observer.disconnect();URL.revokeObjectURL(url);return {baseline,leaked,restored:resources()};});await record(info,'forced-resource-provenance',forced);expect(()=>noLeak({urls:forced.leaked.urls,observers:forced.leaked.observers,delta:0})).toThrow('leak');expect(noLeak({urls:forced.restored.urls,observers:forced.restored.observers,delta:0})).toBe(true);expect(()=>noLeak({urls:0,observers:0,delta:1})).toThrow('leak');
  const timerControl=await page.evaluate(()=>{const baseline=resources();clearTimeout(showToast.t);const unknown=setTimeout(()=>{},12000),replacement=resources();clearTimeout(unknown);return {baseline,replacement,restored:resources()};});
  expect(()=>boundedTimers(timerControl.baseline,timerControl.replacement)).toThrow('timer-lifecycle');expect(boundedTimers(timerControl.baseline,timerControl.restored)).toBe(true);
  const listeners=await page.evaluate(()=>{
   const baseline=resources(),controller=new AbortController();let calls=0,receiver=false;const fn=function(){calls++;receiver=this===window;};
   addEventListener('owned-once-control',fn,{once:true});addEventListener('owned-once-control',fn,{once:true});const registered=resources();dispatchEvent(new Event('owned-once-control'));dispatchEvent(new Event('owned-once-control'));const fired=resources();
   addEventListener('owned-remove-control',fn,{once:true});removeEventListener('owned-remove-control',fn);dispatchEvent(new Event('owned-remove-control'));
   addEventListener('owned-abort-control',fn,{signal:controller.signal});controller.abort();dispatchEvent(new Event('owned-abort-control'));return {baseline,registered,fired,restored:resources(),calls,receiver};
  });expect(listeners.registered.liveListeners).toBe(listeners.baseline.liveListeners+1);expect(listeners.fired.liveListeners).toBe(listeners.baseline.liveListeners);expect(listeners.restored.liveListeners).toBe(listeners.baseline.liveListeners);expect(listeners.calls).toBe(1);expect(listeners.receiver).toBe(true);
  const nativeControl=await page.evaluate(async()=>{
   const context=new AudioContext(),source=context.createBufferSource(),gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);source.buffer=context.createBuffer(1,48000,48000);source.loop=true;source.connect(gain);await context.resume();source.start();source.disconnect();
   const id=resources().sourceLedger.at(-1).id;window.ownedNativeControl={context,source,gain,id};const row=()=>resources().sourceLedger.filter(r=>r.id===id);const missingStop=row();source.stop(context.currentTime+.3);return {missingStop,futureStop:row()};
  });expect(()=>nativeDisposed(nativeControl.missingStop)).toThrow('native-source-lifecycle');expect(()=>nativeDisposed(nativeControl.futureStop)).toThrow('native-source-lifecycle');
  await page.waitForFunction(()=>{const r=resources().sourceLedger.find(v=>v.id===ownedNativeControl.id);return r.currentTime>r.stopDeadline;});
  const nativeSettled=await page.evaluate(async()=>{const {context,source,gain,id}=ownedNativeControl,row=()=>resources().sourceLedger.filter(r=>r.id===id),disconnected=row();source.connect(gain);const stillConnected=row();source.disconnect();gain.disconnect();await context.close();delete window.ownedNativeControl;return {disconnected,stillConnected,final:row()};});
  expect(nativeDisposed(nativeSettled.disconnected)).toBe(true);expect(()=>nativeDisposed(nativeSettled.stillConnected)).toThrow('native-source-lifecycle');expect(nativeDisposed(nativeSettled.final)).toBe(true);
  await record(info,'native-lifecycle-controls',{nativeControl,nativeSettled,timerControl,listeners});
  await record(info,'negative-oracles',{controls,overflow,forced,expectedFailureLayers:['byte-budget','timing','native-resource-accounting','live-resource-leak']});
 }finally{await cleanup([()=>context.close(),()=>server.close()]);}
});

async function playActualCue(page,id){
 let cooldown=null;
 if(id.startsWith('ui.')){const began=await page.evaluate(()=>performance.now());await page.waitForFunction(t=>performance.now()-t>=100,began);cooldown={began,observed:await page.evaluate(()=>performance.now())};}
 const played=await page.evaluate(id=>GAME_AUDIO.play(id),id);expect(played,'actual native cue '+id).toBe(true);return {id,played,cooldown};
}

test('native audio voice cache and decoder failure stay bounded through all routes and cues',async({browser},info)=>{
 const server=await site(info),{context,page}=await bootResource(browser,server);try{
  await page.locator('#gameAudioChoice [data-audio-enable]').click();await page.waitForFunction(()=>GAME_AUDIO.snapshot().tracks.length===1);
  for(const [name,id] of [['dex','collection'],['craft','craft'],['garage','garage'],['workshop','workshop']]){await route(page,name);await page.waitForFunction(id=>{const s=GAME_AUDIO.snapshot();return s.tracks.length===1&&s.tracks[0].id===id&&!s.tracks[0].ending;},id);}
  const cueIds=await page.evaluate(()=>Object.keys(GAME_CONFIG.audio).filter(id=>id.includes('.')));
  const firstCueRuns=[];for(const id of cueIds)firstCueRuns.push(await playActualCue(page,id));
  await page.waitForFunction(()=>GAME_AUDIO.snapshot().voices.length===0&&GAME_AUDIO.snapshot().tracks.length===1);
  const before=await page.evaluate(()=>resources());expect(before.audio.decoded.map(v=>v.id).sort()).toEqual(await page.evaluate(()=>Object.keys(GAME_CONFIG.audio).sort()));expect(before.main).toBe(1);expect(before.audio.maxVoices).toBeLessThanOrEqual(6);expect(before.audio.maxTracks).toBeLessThanOrEqual(2);expect(before.edges).toBeLessThanOrEqual(6);expect(before.maxEdges).toBeLessThanOrEqual(14);expect(before.maxNodes).toBeLessThanOrEqual(14);expect(before.maxBGM).toBeLessThanOrEqual(2);expect(before.maxSFX).toBeLessThanOrEqual(6);expect(before.audio.decoded.length).toBeLessThanOrEqual(28);
  const repeatedCueRuns=[];for(const id of cueIds)repeatedCueRuns.push(await playActualCue(page,id));await page.waitForFunction(()=>GAME_AUDIO.snapshot().voices.length===0);const after=await page.evaluate(()=>resources());expect(after.audio.decoded).toEqual(before.audio.decoded);expect(after.decoded).toEqual(before.decoded);
  await page.evaluate(()=>GAME_AUDIO.setMute(true));await page.waitForFunction(()=>resources().activeSources===0);const muted=await page.evaluate(()=>resources());expect(muted.edges).toBeLessThanOrEqual(4);
  await page.evaluate(()=>resumeStoppedNative());await page.waitForFunction(()=>resources().sourceLedger.every(r=>r.ended||(r.stopped&&Number.isFinite(r.stopDeadline)&&r.currentTime>r.stopDeadline)));expect(nativeDisposed((await page.evaluate(()=>resources())).sourceLedger)).toBe(true);const resumed=await page.evaluate(()=>resources());expect(resumed.activeSources).toBe(0);expect(resumed.edges).toBeLessThanOrEqual(4);
  await record(info,'audio-cache',{cueIds,firstCueRuns,repeatedCueRuns,before,after,muted,resumed,pcmBytes:after.decoded.reduce((sum,r)=>sum+r.pcmBytes,0),offlineFallbackSeparated:true,nativeSemantics:'https://www.w3.org/TR/webaudio-1.1/#AudioScheduledSourceNode'});
 }finally{await cleanup([()=>context.close(),()=>server.close()]);}
});

test('corrupt native audio decode stays silent and subsequent real bytes recover without retained requests',async({browser},info)=>{
 const server=await site(info),{context,page}=await bootResource(browser,server);try{
  await page.locator('#gameAudioChoice [data-audio-enable]').click();await page.waitForFunction(()=>GAME_AUDIO.snapshot().tracks.length===1);
  const pattern='**/audio-craft.complete.*';await page.route(pattern,route=>route.fulfill({status:200,contentType:'audio/wav',body:Buffer.from('corrupt owned native audio fixture')}));
  const failed=await page.evaluate(async()=>({played:await GAME_AUDIO.play('craft.complete'),resources:resources()}));expect(failed.played).toBe(false);expect(failed.resources.audio.voices).toHaveLength(0);expect(failed.resources.audio.errors.some(e=>e.stage==='craft.complete')).toBe(true);expect(failed.resources.decodeAttempts).toBeGreaterThan(0);
  await page.unroute(pattern);expect(await page.evaluate(()=>GAME_AUDIO.play('craft.complete'))).toBe(true);await page.waitForFunction(()=>GAME_AUDIO.snapshot().voices.length===0);const recovered=await page.evaluate(()=>resources());expect(recovered.audio.decoded.filter(d=>d.id==='craft.complete')).toHaveLength(1);expect(recovered.edges).toBeLessThanOrEqual(6);await page.evaluate(()=>GAME_AUDIO.setMute(true));await page.evaluate(()=>resumeStoppedNative());await page.waitForFunction(()=>resources().sourceLedger.every(r=>r.ended||(r.stopped&&Number.isFinite(r.stopDeadline)&&r.currentTime>r.stopDeadline)));expect(nativeDisposed((await page.evaluate(()=>resources())).sourceLedger)).toBe(true);const final=await page.evaluate(()=>resources());expect(final.activeSources).toBe(0);expect(final.edges).toBeLessThanOrEqual(4);await record(info,'negative-audio-decoder',{failed,recovered,final});
 }finally{await cleanup([()=>context.close(),()=>server.close()]);}
});
