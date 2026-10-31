import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.env.SGG_APP_ROOT || path.resolve(import.meta.dirname,'../..');
const {startStatic}=await import(path.join(root,'tools/game-qa/server.mjs'));
const evidence=process.env.SGG_EVIDENCE_DIR;
let site;
const {fixture}=await import('./build-fixture.mjs');
const {buildGame}=await import('../../tools/game-build/build.mjs');
const {verifyPackage}=await import('../../tools/game-build/package.mjs');
const snap=page=>page.evaluate(()=>GAME_AUDIO.snapshot());
async function record(info,name,data){const target=info.outputPath(name+'.json');await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(target,JSON.stringify(data,null,2));await info.attach(name,{path:target,contentType:'application/json'});}
async function open(page,options={}){
  await page.clock.setFixedTime(new Date('2026-11-01T00:00:00+09:00'));
  await page.addInitScript(({rate,prefs,deny})=>{
    window.audioProbe={decodes:[],buffers:[],starts:[],writes:[],contexts:[]};
    if(prefs!==undefined&&!sessionStorage.getItem('audioSeeded')){localStorage.setItem('sgg_game_preferences_v1',typeof prefs==='string'?prefs:JSON.stringify(prefs));sessionStorage.setItem('audioSeeded','1');}
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){window.audioProbe.writes.push(key);return set.call(this,key,value);};
    const Offline=window.OfflineAudioContext;
    window.OfflineAudioContext=function(...args){const ctx=new Offline(...args),decode=ctx.decodeAudioData.bind(ctx);ctx.decodeAudioData=async data=>{const b=await decode(data);audioProbe.buffers.push(b);audioProbe.decodes.push({sampleRate:b.sampleRate,length:b.length,nativeFallback:true});return b;};return ctx;};
    window.OfflineAudioContext.prototype=Offline.prototype;
    const Native=window.AudioContext||window.webkitAudioContext;
    window.AudioContext=function(options){const ctx=new Native({...options,sampleRate:rate||48000});window.audioProbe.contexts.push(ctx);
      const decode=ctx.decodeAudioData.bind(ctx);ctx.decodeAudioData=async data=>{const b=await decode(data);window.audioProbe.buffers.push(b);const pcm=b.getChannelData(0);let power=0,peak=0;for(let i=0;i<pcm.length;i+=47){power+=pcm[i]**2;peak=Math.max(peak,Math.abs(pcm[i]));}window.audioProbe.decodes.push({sampleRate:b.sampleRate,length:b.length,rms:Math.sqrt(power/Math.ceil(pcm.length/47)),peak});return b;};
      const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{const s=create(),start=s.start.bind(s);s.start=(...args)=>{window.audioProbe.starts.push({loop:s.loop,loopStart:s.loopStart,loopEnd:s.loopEnd,time:ctx.currentTime,bufferFrames:s.buffer?.length,sampleRate:s.buffer?.sampleRate});return start(...args);};return s;};
      if(deny){const resume=ctx.resume.bind(ctx);let denied=false;ctx.resume=()=>{if(!denied){denied=true;return deny==='hung'?new Promise(()=>{}):Promise.reject(new DOMException('test denial','NotAllowedError'));}return resume();};}
      return ctx;
    };window.AudioContext.prototype=Native.prototype;
  },options);
  await page.goto(site.url);await page.waitForFunction(()=>typeof GAME_AUDIO!=='undefined'&&document.querySelector('#gameAudioChoice')&&typeof S!=='undefined'&&!saveHold);
  await page.evaluate(()=>{window.audioProbe.writes=[];});
}
async function enable(page){await page.locator('#gameAudioChoice [data-audio-enable]').click();await expect.poll(async()=>(await snap(page)).tracks.length).toBe(1);}
async function settings(page){await page.locator('#btnSettings').click();await expect(page.locator('#gameAudioControls')).toBeVisible();}
test.afterEach(async({page},info)=>{if(!page.isClosed())await record(info,'final-observation',{state:await snap(page).catch(()=>null),probe:await page.evaluate(()=>({decodes:window.audioProbe?.decodes,starts:window.audioProbe?.starts})).catch(()=>null),status:info.status});});
test.beforeAll(async()=>{
  test.setTimeout(120000);
  const input=path.join(process.env.TMPDIR,'audio-runtime-input'),pack=path.join(evidence,'synthetic-package');
  const resourceFile=path.join(evidence,'audio-fixture-resources.json');
  if(!await fs.stat(pack).then(()=>true,()=>false)){
    await fs.writeFile(resourceFile,JSON.stringify({status:'planned',input,pack,syntheticArt:true,actualAudio:true},null,2));
    const art=await fixture(root,input),audio=JSON.parse(await fs.readFile(path.join(root,'src/audio/manifest.json'),'utf8'));
    const names=['src/game/audio.js','src/audio/manifest.json',...audio.sources.map(r=>r.path),...audio.tracks.flatMap(t=>t.variants.map(v=>v.path)),...art.optionalDerived.map(r=>r.path)],hashes=[];
    for(const name of names){const bytes=await fs.readFile(path.join(root,name));await fs.mkdir(path.dirname(path.join(input,name)),{recursive:true});await fs.writeFile(path.join(input,name),bytes);hashes.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex')});}
    const built=await buildGame({root:input,out:pack,syntheticFixture:true});
    await fs.writeFile(path.join(evidence,'fixture-production-audio.json'),JSON.stringify({syntheticArt:true,actualAudioVariants:32,actualRuntime:true,hashes,built},null,2));
    await fs.rm(input,{recursive:true,force:true});
    await fs.writeFile(resourceFile,JSON.stringify({status:'retained-deliverable',inputRemoved:!await fs.stat(input).then(()=>true,()=>false),pack,syntheticArt:true,actualAudio:true},null,2));
  }
  const receipt=JSON.parse(await fs.readFile(path.join(evidence,'fixture-production-audio.json'),'utf8'));
  for(const row of receipt.hashes)expect(createHash('sha256').update(await fs.readFile(path.join(root,row.path))).digest('hex')).toBe(row.sha256);
  const {release}=await verifyPackage(pack);expect(release.syntheticFixture).toBe(true);expect(release.files.filter(r=>r.mime.startsWith('audio/'))).toHaveLength(32);
  site=await startStatic(pack);await fs.writeFile(path.join(evidence,'fixture-server-'+test.info().project.name+'.json'),JSON.stringify({url:site.url,port:site.port,pid:process.pid,status:'running',syntheticArt:true,actualAudio:true},null,2));
});
test.afterAll(async()=>{if(site){await site.close();await fs.writeFile(path.join(evidence,'fixture-server-'+test.info().project.name+'.json'),JSON.stringify({url:site.url,port:site.port,status:'closed',socketClosed:await fetch(site.url).then(()=>false,()=>true),syntheticArt:true,actualAudio:true},null,2));}});

test('first visit stays silent until an explicit accessible choice, without economic writes',async({page},info)=>{
  // Given a fresh real game fixture with real production audio.
  const requests=[];page.on('request',r=>{if(/\.(ogg|m4a|wav)(?:\?|$)/.test(r.url()))requests.push(r.url());});await open(page);
  const before=await page.evaluate(()=>({state:JSON.stringify(S),save:localStorage.getItem(KEY)}));
  expect((await snap(page)).state).toBe('uncreated');expect(requests).toEqual([]);
  await expect(page.getByRole('button',{name:'무음으로 계속',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('silent-choice.png')});
  // When the player explicitly enables sound.
  await enable(page);const first=await snap(page);await expect.poll(async()=>(await snap(page)).currentTime).toBeGreaterThan(first.currentTime+.15);
  // Then actual audio clock and non-silent PCM advance, and only preference storage changes.
  const after=await page.evaluate(()=>({state:JSON.stringify(S),save:localStorage.getItem(KEY)}));expect(after).toEqual(before);
  const probe=await page.evaluate(()=>({decodes:audioProbe.decodes,writes:audioProbe.writes,starts:audioProbe.starts}));expect(probe.decodes[0].rms).toBeGreaterThan(.001);expect(probe.writes.every(k=>k==='sgg_game_preferences_v1')).toBe(true);
  expect(first.bgmGain).toBe(.3);expect(first.sfxGain).toBe(.6);expect(first.masterGain).toBeCloseTo(.85,6);expect(requests).toHaveLength(1);
  await settings(page);
  const geometry=await page.locator('#gameAudioControls label, #gameAudioControls input[type="range"]').evaluateAll(nodes=>nodes.map(node=>({tag:node.tagName,height:node.getBoundingClientRect().height})));
  expect(geometry.every(row=>row.height>=44)).toBe(true);await record(info,'control-geometry',{geometry});
  await page.locator('[data-audio-bgm]').press('ArrowRight');expect((await snap(page)).bgmGain).toBe(.31);
  await page.screenshot({path:info.outputPath('sound-controls.png')});await record(info,'gesture-clock-pcm',{before,after,first,afterClock:await snap(page),probe,requests,subjectiveListening:false});
});

for(const rate of [44100,48000])for(const codec of ['opus','aac'])test(`actual ${codec} decoded loops use ${rate} Hz output frames`,async({page},info)=>{
  // Given real production codecs, master references and an explicitly selected output sample rate.
  if(codec==='aac')await page.route('**/*.ogg',r=>r.fulfill({status:404,body:'forced fallback'}));
  await page.route('**/audio-reference/*.wav',r=>r.fulfill({path:path.join(root,'src/audio/masters',new URL(r.request().url()).pathname.split('/').at(-1)),contentType:'audio/wav'}));
  await open(page,{rate});await enable(page);const observations=[];
  for(const [route,id,period] of [['workshop','workshop',48],['dex','collection',160/3],['craft','craft',40],['garage','garage',48]]){
    // When the manager selects this route (craft/research presentation arrives in Task24).
    if(route!=='workshop'){await page.evaluate(route=>GAME_AUDIO.setRoute(route),route);await expect.poll(async()=>(await snap(page)).tracks.some(t=>t.id===id&&!t.ending)).toBe(true);}
    const state=await snap(page),decoded=state.decoded.find(d=>d.id===id);
    // Then loop boundaries span exactly one musical period inside existing decoded PCM.
    expect(decoded.outputSampleRate).toBe(rate);expect(decoded.sampleRate).toBe(decoded.nativeDecodeFallback?48000:rate);expect(decoded.mime).toBe(codec==='aac'?'audio/mp4':'audio/ogg');expect(decoded.loop.periodFrames).toBe(Math.round(period*decoded.sampleRate));
    expect(decoded.loop.end-decoded.loop.start).toBeCloseTo(period,5);expect(decoded.loop.end*decoded.sampleRate).toBeLessThanOrEqual(decoded.frames+2);
    const correlation=await page.evaluate(async({id,loop})=>{
      const b=audioProbe.buffers.at(-1),a=b.getChannelData(0),ref=await (b.sampleRate===audioProbe.contexts[0].sampleRate?audioProbe.contexts[0]:new OfflineAudioContext(2,1,b.sampleRate)).decodeAudioData(await(await fetch('/audio-reference/'+id+'.wav')).arrayBuffer()),r=ref.getChannelData(0);
      const start=Math.round(loop.start*b.sampleRate),frames=loop.periodFrames,results=[];
      for(const [from,to] of [[2048,16000],[frames-16000,frames-128]]){
        let dot=0,xx=0,yy=0;for(let i=from;i<to;i+=24){const x=r[i],y=a[start+i];dot+=x*y;xx+=x*x;yy+=y*y;}
        results.push(dot/Math.sqrt(xx*yy));
      }
      return{start,frames,bufferFrames:b.length,leading:results[0],trailing:results[1],complete:start+frames<=b.length};
    },{id,loop:decoded.loop});
    expect(correlation.complete).toBe(true);expect(correlation.leading).toBeGreaterThan(.95);expect(correlation.trailing).toBeGreaterThan(.95);
    observations.push({id,decoded,correlation});
  }
  await record(info,'decoded-loops',{codec,requestedRate:rate,observations,subjectiveListening:false});
});

test('separate gain controls and mute persist alongside other preferences after reload',async({page},info)=>{
  // Given unrelated preferences and an enabled real audio graph.
  await open(page,{prefs:{representative:'sentinel',audio:{bgmGain:.3,sfxGain:.6}}});await enable(page);await settings(page);
  // When controls change each gain and mute, then the page reloads.
  await page.locator('[data-audio-bgm]').fill('23');await page.locator('[data-audio-bgm]').dispatchEvent('input');
  await page.locator('[data-audio-sfx]').fill('78');await page.locator('[data-audio-sfx]').dispatchEvent('input');
  await page.locator('[data-audio-mute]').check();await expect.poll(async()=>(await snap(page)).state).toBe('suspended');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sgg_game_preferences_v1')));expect(saved.representative).toBe('sentinel');expect(saved.audio).toMatchObject({optedIn:true,muted:true,bgmGain:.23,sfxGain:.78});
  await page.screenshot({path:info.outputPath('gains-muted.png')});
  // Init-script fixture seed is disabled for reload, preserving actual user preferences.
  const state=await snap(page);await record(info,'persisted-controls',{saved,state});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#gameAudioControls'));
  expect(await snap(page)).toMatchObject({muted:true,bgmGain:.23,sfxGain:.78,state:'uncreated',tracks:[],voices:[]});
  await record(info,'reload',{state:await snap(page),prefs:await page.evaluate(()=>JSON.parse(localStorage.getItem('sgg_game_preferences_v1')))});
});

test('rapid route changes and canceled pending cues cannot play late results',async({page},info)=>{
  // Given enabled sound and an intentionally slow real cue response.
  await open(page);await enable(page);await page.route('**/*.wav',async r=>{await new Promise(resolve=>setTimeout(resolve,250));await r.continue();});
  // When route/cancel events invalidate requests repeatedly.
  await page.evaluate(()=>{window.pendingCue=GAME_AUDIO.play('draw.reveal');GAME_AUDIO.cancel();location.hash='craft';});
  for(const name of ['dex','craft','research','garage','workshop','garage']){await page.evaluate(name=>location.hash=name,name);await page.waitForTimeout(30);}
  await expect.poll(async()=>(await snap(page)).tracks.filter(t=>!t.ending).map(t=>t.id)).toEqual(['garage']);
  await expect.poll(async()=>(await snap(page)).tracks.length).toBe(1);
  // Then only the latest route remains and no canceled cue started.
  expect(await page.evaluate(()=>pendingCue)).toBe(false);const state=await snap(page);expect(state.maxTracks).toBeLessThanOrEqual(2);
  const starts=await page.evaluate(()=>audioProbe.starts),canceled=state.decoded.find(row=>row.id==='draw.reveal'),tab=state.decoded.find(row=>row.id==='ui.tab');
  expect(canceled).toBeTruthy();
  const nonLoop=starts.filter(row=>!row.loop),canceledStarts=nonLoop.filter(row=>row.bufferFrames===canceled.frames&&row.sampleRate===canceled.sampleRate);
  expect(canceledStarts).toEqual([]);
  for(const started of nonLoop){expect(tab).toBeTruthy();expect([tab.frames,tab.sampleRate]).not.toEqual([canceled.frames,canceled.sampleRate]);expect([started.bufferFrames,started.sampleRate]).toEqual([tab.frames,tab.sampleRate]);}
  expect(state.startedCues).toBe(nonLoop.length);
  await record(info,'route-cancel',{state,starts,canceled,canceledStarts,normalTab:tab,normalTabStarts:nonLoop});
});

test('voice cap UI cooldown and grand duck run on actual source nodes',async({page},info)=>{
  // Given enabled audio and a decoded grand cue.
  await open(page);await enable(page);await page.evaluate(()=>GAME_AUDIO.play('garage.complete'));await page.evaluate(()=>GAME_AUDIO.cancel());
  // When eight overlapping cues and two immediate UI taps are requested.
  const played=await page.evaluate(async()=>Promise.all(Array.from({length:8},()=>GAME_AUDIO.play('garage.complete'))));
  expect(played.every(Boolean)).toBe(true);let state=await snap(page);expect(state.voices).toHaveLength(6);expect(state.maxVoices).toBe(6);
  await page.waitForTimeout(210);state=await snap(page);expect(state.duckGain).toBeCloseTo(Math.pow(10,-6/20),2);
  const taps=await page.evaluate(async()=>Promise.all([GAME_AUDIO.play('ui.tap'),GAME_AUDIO.play('ui.tap')]));expect(taps).toEqual([true,false]);
  // Then real voices stay bounded and duck returns after completion/cancellation.
  await page.evaluate(()=>GAME_AUDIO.cancel());expect((await snap(page)).voices).toEqual([]);expect((await snap(page)).duckGain).toBe(1);
  await record(info,'cap-cooldown-duck',{played,taps,ducked:state,after:await snap(page)});
});

test('hidden page lifecycle suspends sources and resumes only unmuted opt-in without missed cues',async({page},info)=>{
  // Given opted-in actual playback.
  await open(page);await enable(page);await page.evaluate(()=>GAME_AUDIO.play('garage.complete'));const count=(await snap(page)).startedCues;
  // When the browser lifecycle reports hidden then visible, including a muted return.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(async()=>(await snap(page)).state).toBe('suspended');expect((await snap(page)).tracks).toEqual([]);expect((await snap(page)).voices).toEqual([]);
  expect(await page.evaluate(()=>GAME_AUDIO.play('draw.result'))).toBe(false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(async()=>(await snap(page)).tracks.length).toBe(1);
  expect((await snap(page)).startedCues).toBe(count);
  await page.evaluate(()=>{GAME_AUDIO.setMute(true);window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pageshow'));});
  // Then hidden and muted states have no playing/scheduled sources.
  await expect.poll(async()=>(await snap(page)).state).toBe('suspended');expect((await snap(page)).tracks).toEqual([]);
  await record(info,'lifecycle',{state:await snap(page),injectedLifecycleEvents:true,realSuspendResume:true});
});

test('denied resume offers an actual tap recovery without replaying a missed cue',async({page},info)=>{
  // Given one browser-policy resume rejection over a real AudioContext.
  await open(page,{deny:true});
  // When enabling sound is denied then the player taps recovery.
  await page.locator('#gameAudioChoice [data-audio-enable]').click();await settings(page);await expect(page.getByRole('button',{name:'소리 다시 켜기'})).toBeVisible();
  expect(await page.evaluate(()=>GAME_AUDIO.play('draw.result'))).toBe(false);
  const denied=await snap(page);await page.screenshot({path:info.outputPath('resume-recovery.png')});
  await page.getByRole('button',{name:'소리 다시 켜기'}).click();await expect.poll(async()=>(await snap(page)).tracks.length).toBe(1);
  // Then the actual context runs and the old cue remains absent.
  const after=await snap(page);expect(after.startedCues).toBe(0);expect(after.recovery).toBe(false);await record(info,'resume-denied',{denied,after});
});

for(const fault of ['404','bad-decode'])test(`${fault} audio failures leave controls usable and economic state unchanged`,async({page},info)=>{
  // Given failing audio transport/decode responses.
  await page.route(/\.(ogg|m4a|wav)$/,r=>r.fulfill({status:fault==='404'?404:200,contentType:'audio/ogg',body:'not audio'}));await open(page,{prefs:'{malformed'});
  const before=await page.evaluate(()=>({state:JSON.stringify(S),save:localStorage.getItem(KEY)}));
  // When enabling audio fails in both production codec alternatives.
  await page.locator('#gameAudioChoice [data-audio-enable]').click();await expect.poll(async()=>(await snap(page)).errors.length).toBeGreaterThanOrEqual(2);
  // Then there are no sources, the game state is preserved and mute is usable.
  await settings(page);await page.locator('[data-audio-mute]').check();expect((await snap(page)).tracks).toEqual([]);expect(await page.evaluate(()=>({state:JSON.stringify(S),save:localStorage.getItem(KEY)}))).toEqual(before);
  await page.screenshot({path:info.outputPath(fault+'.png')});await record(info,fault,{before,after:await snap(page)});
});

for(const fault of ['fetch','resume'])test(`hung ${fault} is bounded and recoverable without pending result replay`,async({page},info)=>{
  // Given a transport or resume promise that never completes.
  if(fault==='fetch')await page.route('**/*.ogg',()=>{});
  await open(page,{deny:fault==='resume'?'hung':false});
  // When audio is enabled.
  await page.locator('#gameAudioChoice [data-audio-enable]').click();
  await expect.poll(async()=>(await snap(page)).errors.length,{timeout:8000}).toBeGreaterThan(0);
  const failed=await snap(page);expect(failed.tracks).toEqual([]);
  // Then the bounded operation leaves an actionable control and a fresh gesture recovers.
  if(fault==='fetch')await page.unroute('**/*.ogg');
  await settings(page);await page.locator('#gameAudioControls [data-audio-enable]').click();
  await expect.poll(async()=>(await snap(page)).tracks.length).toBe(1);
  await record(info,'hung-recovery',{failed,after:await snap(page)});
});

test('malformed preference gains are bounded and silent choice never creates an audio context',async({page},info)=>{
  // Given untrusted preference scalars and unrelated text.
  await open(page,{prefs:{custom:'<script>throw new Error("injected")</script>',audio:{bgmGain:900,sfxGain:-2,optedIn:'yes',muted:0}}});
  // When the user selects the equally available silent option.
  await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();
  // Then gain values cannot amplify and no decoder/network/audio graph is created.
  const state=await snap(page);expect(state).toMatchObject({bgmGain:1,sfxGain:0,state:'uncreated',muted:true,optedIn:false});
  expect(await page.evaluate(()=>audioProbe.decodes)).toEqual([]);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sgg_game_preferences_v1')));expect(saved.custom).toContain('<script>');
  await record(info,'invalid-preferences',{state,saved});
});

test('real existing navigation and native interruption update the running soundtrack',async({page},info)=>{
  // Given the current real navigation surface and enabled audio.
  await open(page);await enable(page);
  // When actual menu clicks use pushState and native context suspension interrupts playback.
  await page.locator('.destination-nav a[href="#dex"]').click();
  await expect.poll(async()=>(await snap(page)).tracks.some(t=>t.id==='collection'&&!t.ending)).toBe(true);
  await page.locator('.destination-nav a[href="#garage"]').click();
  await expect.poll(async()=>(await snap(page)).tracks.some(t=>t.id==='garage'&&!t.ending)).toBe(true);
  await page.goBack();await expect.poll(async()=>(await snap(page)).route).toBe('collection');
  await page.evaluate(()=>audioProbe.contexts[0].suspend());await expect.poll(async()=>(await snap(page)).recovery).toBe(true);
  expect((await snap(page)).tracks).toEqual([]);
  // Then a user gesture recovers actual audio without issuing an economic command.
  await settings(page);await page.getByRole('button',{name:'소리 다시 켜기'}).click();
  await expect.poll(async()=>(await snap(page)).tracks.some(t=>t.id==='collection')).toBe(true);
  await page.screenshot({path:info.outputPath('native-interruption-recovered.png')});await record(info,'existing-navigation',{state:await snap(page),futurePresentationRoutes:['craft','research'],routeManagerCoveredSeparately:true});
});
