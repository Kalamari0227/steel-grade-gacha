import {test,expect} from '@playwright/test';
import {appURL,baselineURL,fixedTime} from '../helpers/paths.mjs';
import {openApp,capture,destination,state} from '../helpers/app.mjs';
process.env.SGG_EDITION='game';
const errors=new WeakMap();
test.beforeEach(async({page})=>{const rows=[];errors.set(page,rows);page.on('pageerror',e=>rows.push(e.message));});
test.afterEach(async({page},info)=>{await capture(info,'errors',errors.get(page));expect(errors.get(page)).toEqual([]);});
const observe=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY),saves:window.carSaves,resets:window.partResets,cues:window.carCues,presentation:GAME_GARAGE.snapshot()}));
async function setup(page,fixture='all-parts'){
 await openApp(page,appURL,fixture);await destination(page,'garage');
 await page.evaluate(()=>{window.carSaves=0;window.partResets=0;window.carCues=[];const persist=save;save=function(){carSaves++;return persist();};let parts=S.parts;Object.defineProperty(S,'parts',{enumerable:true,configurable:true,get(){return parts;},set(value){partResets++;parts=value;}});const audio=GAME_AUDIO;GAME_AUDIO={...audio,play(id){carCues.push({id,saved:localStorage.getItem(KEY)});return audio.play(id);}};});
}
async function select(page,key='t'){await page.locator('.garage-option[data-k="'+key+'"]').click();await expect(page.locator('#carsay')).toBeVisible();}
async function confirm(page){await page.locator('#takeCar').evaluate(n=>n.click());}
async function frozen(page){await page.clock.install({time:new Date(fixedTime)});await setup(page);await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));}
async function shot(page,info,name){await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true});}
async function showroom(page,info,key){
 await expect(page.locator('#garageStageTitle')).toBeVisible();
 const geometry=await page.evaluate(()=>{
  const scene=document.querySelector('#garageStage .garage-scene'),car=scene.querySelector('.garage-scene-car img');
  const caption=document.querySelector('#garageStage .garage-scene-caption'),title=document.getElementById('garageStageTitle');
  const rect=element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  return {scene:rect(scene),car:rect(car),caption:rect(caption),title:rect(title),name:title.textContent,expectedName:CARS.find(c=>c.key===GAME_GARAGE.snapshot().car).tag,fit:getComputedStyle(car).objectFit,naturalWidth:car.naturalWidth,naturalHeight:car.naturalHeight,titleWidth:title.clientWidth,titleScrollWidth:title.scrollWidth};
 });
 await capture(info,'showroom-'+key,geometry);
 const path=info.outputPath('showroom-'+key+'.png');await page.locator('#garageStage').screenshot({path});await info.attach('showroom-'+key,{path,contentType:'image/png'});
 const {car,scene,caption,title}=geometry;
 const overlap=Math.max(0,Math.min(car.right,caption.right)-Math.max(car.left,caption.left))*Math.max(0,Math.min(car.bottom,caption.bottom)-Math.max(car.top,caption.top));
 expect(overlap,'readable caption must not cover the displayed car').toBe(0);
 expect(geometry.fit).toBe('contain');expect(geometry.naturalWidth).toBeGreaterThan(0);expect(geometry.naturalHeight).toBeGreaterThan(0);
 expect(car.width).toBeGreaterThan(0);expect(car.height).toBeGreaterThan(0);
 expect(car.left).toBeGreaterThanOrEqual(scene.left);expect(car.top).toBeGreaterThanOrEqual(scene.top);expect(car.right).toBeLessThanOrEqual(scene.right);expect(car.bottom).toBeLessThanOrEqual(scene.bottom);
 expect(geometry.name).toBe(geometry.expectedName);expect(geometry.titleScrollWidth).toBeLessThanOrEqual(geometry.titleWidth);
 expect(title.left).toBeGreaterThanOrEqual(caption.left);expect(title.top).toBeGreaterThanOrEqual(caption.top);expect(title.right).toBeLessThanOrEqual(caption.right);expect(title.bottom).toBeLessThanOrEqual(caption.bottom);
}

test('original eight-car catalog and each exact one-save one-reset acquisition cycle',async({page},info)=>{
 await openApp(page,baselineURL,'all-parts');const original=await page.evaluate(()=>CARS);await setup(page);expect(await page.evaluate(()=>CARS)).toEqual(original);expect(original.map(c=>c.key)).toEqual(['t','h','n','m','s','z','b','d']);const rows=[];
 for(const car of original){
  await page.evaluate(()=>{GAME_GARAGE.cancel();S.parts=Object.fromEntries(PARTS.map(p=>[p.key,{at:Date.now(),use:[]}]));refresh();carSaves=0;partResets=0;});const before=await observe(page);await select(page,car.key);expect((await observe(page)).state).toEqual(before.state);
  await page.locator('#takeCar').evaluate(n=>{n.click();n.click();});const after=await observe(page);expect(after.state.cars).toEqual([...before.state.cars,{k:car.key,at:Date.parse(fixedTime)}]);expect(after.state.parts).toEqual({});expect(after.saves).toBe(1);expect(after.resets).toBe(1);for(const key of ['stock','owned','scrap'])expect(after.state[key]).toEqual(before.state[key]);expect(JSON.parse(after.saved)).toEqual(after.state);await page.locator('[data-garage-skip]').click();expect((await observe(page)).state).toEqual(after.state);rows.push({key:car.key,before,after});
 }
 await expect(page.locator('#garage .owned')).toHaveCount(8);await expect(page.locator('#takeCar')).toHaveCount(0);await expect(page.locator('#carAssemblyTitle')).toContainText('8종을 모두');await capture(info,'eight-cycles',rows);await shot(page,info,'all-eight');await page.reload();await page.waitForFunction(()=>!saveHold);expect((await state(page)).cars.map(c=>c.k)).toEqual(original.map(c=>c.key));
});

test('empty locked preview and 34 parts cannot create or represent a car',async({page},info)=>{
 await setup(page,'new');const empty=await observe(page);await expect(page.locator('#garageStage [data-asset^="car:"]')).toHaveCount(0);await page.locator('#garage [data-car-key="d"]').click();await expect(page.locator('.garage-locked')).toContainText('아직 보유하지');await expect(page.locator('#garageRepresentative')).toHaveCount(0);await expect(page.locator('#garageDetailArt [data-asset="car:d"]')).toHaveAttribute('data-status','ready');expect((await observe(page)).state).toEqual(empty.state);await shot(page,info,'locked-preview');await page.keyboard.press('Escape');await expect(page.locator('#garage [data-car-key="d"]')).toBeFocused();
 await page.evaluate(()=>{S.parts=Object.fromEntries(PARTS.slice(0,34).map(p=>[p.key,{at:Date.now(),use:[]}]));refresh();carSaves=0;partResets=0;});const short=await observe(page);await expect(page.locator('.garage-option')).toHaveCount(0);expect(await page.evaluate(()=>GAME_HOME.select('car','d'))).toBe(false);expect((await observe(page)).state).toEqual(short.state);await capture(info,'empty-short',{empty,short,after:await observe(page)});await shot(page,info,'34-parts');
});

for(const mutation of ['part','owned','all'])test('current '+mutation+' stale confirmation rejects mutation',async({page},info)=>{
 await setup(page);await select(page);await page.evaluate(m=>{if(m==='part')delete S.parts[PARTS[0].key];if(m==='owned')S.cars.push({k:'t',at:1});if(m==='all')S.cars=CARS.map(c=>({k:c.key,at:1}));},mutation);const before=await observe(page);await confirm(page);const after=await observe(page);expect(after.state).toEqual(before.state);expect(after.saved).toBe(before.saved);expect(after.saves).toBe(0);expect(after.resets).toBe(0);await expect(page.locator('#carStatus')).toContainText('상태가 바뀌');await capture(info,'stale',{mutation,before,after});
});

test('selection cancel and detached confirmation preserve stock including QP; valid confirm adds no cost',async({page},info)=>{
 await setup(page);await page.evaluate(()=>{S.owned[QP_ID]=true;S.stock[QP_ID]=1;PARTS.forEach(p=>{S.parts[p.key].use=p.need.map(sl=>qpCovers(sl)?QP_ID:sl.any[0]);});});const before=await observe(page);await select(page);await page.evaluate(()=>window.detachedCar=document.getElementById('takeCar'));await page.locator('#cancelCar').click();await page.evaluate(()=>detachedCar.click());expect((await observe(page)).state).toEqual(before.state);expect((await observe(page)).saves).toBe(0);await expect(page.locator('.garage-option[data-k="t"]')).toBeFocused();await select(page);await confirm(page);const after=await observe(page);expect(after.resets).toBe(1);for(const k of ['stock','owned','scrap'])expect(after.state[k]).toEqual(before.state[k]);await capture(info,'cancel-qp',{before,after});
});

test('readonly reveal timeline uses saved result before two cues and completes by 1500ms',async({page},info)=>{
 await frozen(page);await select(page);await confirm(page);const committed=await observe(page),rows=[];let elapsed=0;
 for(const [at,phase] of [[0,'light'],[449,'light'],[450,'turntable'],[1499,'turntable'],[1500,'complete']]){await page.clock.runFor(at-elapsed);elapsed=at;const row=await observe(page);expect(row.presentation.phase).toBe(phase);expect(row.state).toEqual(committed.state);expect(row.saves).toBe(1);expect(row.resets).toBe(1);rows.push({at,...row.presentation});}
 const after=await observe(page);expect(after.presentation.pendingTimerCount).toBe(0);expect(after.cues.map(c=>c.id)).toEqual(['garage.assemble','garage.complete']);expect(after.cues.every(c=>c.saved===committed.saved)).toBe(true);await capture(info,'timeline',{committed,rows,after});
});

for(const action of ['skip','escape','route','hide','pagehide','reset','restore'])test(action+' cancels delayed reveal without another transaction',async({page},info)=>{
 await frozen(page);const code=await page.evaluate(()=>makeCode());await select(page);await confirm(page);await page.clock.runFor(450);const committed=await observe(page);
 if(action==='skip')await page.locator('[data-garage-skip]').evaluate(n=>n.click());
 if(action==='escape')await page.keyboard.press('Escape');
 let routeBoundary=null;
 if(action==='route'){await page.evaluate(()=>{location.hash='#craft';routeView(true);});await page.clock.runFor(1);routeBoundary=await observe(page);expect(routeBoundary.cues).toEqual([...committed.cues,{id:'ui.tab',saved:committed.saved}]);expect(routeBoundary.presentation).toMatchObject({active:false,busy:false,pendingTimerCount:0,imageCount:0});}
 if(action==='hide')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 if(action==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 if(action==='reset')await page.evaluate(()=>{document.getElementById('btnSettings').click();document.getElementById('btnReset').click();document.getElementById('btnReset').click();});
 if(action==='restore')await page.evaluate(code=>{document.getElementById('btnSettings').click();document.getElementById('btnBackup').click();document.getElementById('bkIn').value=code;document.getElementById('bkLoad').click();document.getElementById('bkConfirm').click();},code);
 const stopped=await observe(page);await page.clock.runFor(4000);const after=await observe(page);expect(after.state).toEqual(stopped.state);expect(after.saved).toBe(stopped.saved);expect(after.cues).toEqual(stopped.cues);expect(after.presentation.pendingTimerCount).toBe(0);expect(after.presentation.busy).toBe(false);if(!['reset','restore'].includes(action)){expect(after.saves).toBe(1);expect(after.resets).toBe(1);}await capture(info,'interruption',{action,committed,routeBoundary,stopped,after});if(action==='restore'){expect(after.presentation).toMatchObject({active:true,car:null,phase:'display',busy:false,pendingTimerCount:0});await expect(page.locator('#garageStageTitle')).toHaveText('비어 있는 전시대');}
});

test('reduced and muted preserve committed car; idle cleanup does not cancel unrelated SFX',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await page.evaluate(()=>GAME_AUDIO.setMute(true));await select(page);const elapsed=await page.evaluate(()=>{const at=performance.now();document.getElementById('takeCar').click();return performance.now()-at;});const after=await observe(page);expect(elapsed).toBeLessThanOrEqual(100);expect(after.presentation).toMatchObject({phase:'complete',busy:false,pendingTimerCount:0});expect(after.cues).toEqual([]);await page.evaluate(()=>{GAME_GARAGE.cancel();window.idleCancels=0;GAME_AUDIO={...GAME_AUDIO,cancel(){idleCancels++;}};GAME_GARAGE.cancel();closePart();});expect(await page.evaluate(()=>idleCancels)).toBe(0);await capture(info,'reduced-idle',{elapsed,after});
});

for(const width of [360,390,768,1280])test('all eight owned representative preferences and keyboard detail '+width,async({page},info)=>{
 await page.setViewportSize({width,height:({360:800,390:844,768:1024,1280:900})[width]});await setup(page,'all-cars');await page.evaluate(()=>localStorage.setItem(GAME_EDITION.preferences,JSON.stringify({audio:{muted:true,bgmGain:.27},other:'preserve'})));const before=await observe(page),rows=[];
 for(const key of ['t','h','n','m','s','z','b','d']){await page.locator('#garage [data-car-key="'+key+'"]').click();await expect(page.locator('#garageCarTitle')).toBeFocused();await page.locator('#garageRepresentative').click();await expect(page.locator('#garagePreferenceStatus')).toContainText('대표 차량');await expect(page.locator('#garageStage .garage-showroom')).toHaveAttribute('data-car',key);await expect(page.locator('#garageStage [data-asset="car:'+key+'"]')).toHaveAttribute('data-status','ready');await page.keyboard.press('Tab');expect(await page.evaluate(()=>partModal.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(page.locator('#garage [data-car-key="'+key+'"]')).toBeFocused();await showroom(page,info,key);rows.push(await page.evaluate(()=>JSON.parse(localStorage.getItem(GAME_EDITION.preferences))));}
 expect(rows.every(p=>p.other==='preserve'&&p.audio.bgmGain===.27)).toBe(true);expect((await observe(page)).state).toEqual(before.state);expect((await observe(page)).saves).toBe(0);await shot(page,info,'owned-'+width);await capture(info,'representatives',{width,before,rows,after:await observe(page)});await page.reload();await expect(page.locator('#garageStage .garage-showroom')).toHaveAttribute('data-car','d');await destination(page,'workshop');await expect(page.locator('#homeCar')).toHaveAttribute('data-car','d');
});

test('representative storage failure and stale ownership preserve previous preferences',async({page},info)=>{
 await setup(page,'all-cars');await page.locator('#garage [data-car-key="d"]').click();const before=await observe(page);await page.evaluate(()=>{window.oldPrefs=localStorage.getItem(GAME_EDITION.preferences);const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===GAME_EDITION.preferences)throw new DOMException('owned denial','QuotaExceededError');return set.call(this,k,v);};});await page.locator('#garageRepresentative').click();await expect(page.locator('#garagePreferenceStatus')).toContainText('저장하지 못');expect(await page.evaluate(()=>localStorage.getItem(GAME_EDITION.preferences)===oldPrefs)).toBe(true);expect((await observe(page)).state).toEqual(before.state);await page.evaluate(()=>{S.cars=S.cars.filter(c=>c.k!=='d');});const stale=await observe(page);await page.locator('#garageRepresentative').click();expect((await observe(page)).state).toEqual(stale.state);expect((await observe(page)).saves).toBe(0);await capture(info,'preference-failure',{before,stale,after:await observe(page)});
});

test('car image owns one fallback, reload retry and held-close cleanup; audio failure is non-economic',async({page},info)=>{
 let blocked=true,held=false,release;const gate=new Promise(resolve=>release=resolve),requests=[];
 await page.route('**/*',async route=>{const target=/\/car-d\.[a-f0-9]+\.webp$/.test(new URL(route.request().url()).pathname);if(target)requests.push({blocked,held});if(target&&held)await gate;return target&&blocked?route.fulfill({status:404,body:'owned car unavailable'}):route.continue();});
 try{
  await setup(page,'all-cars');const before=await observe(page);await page.locator('#garage [data-car-key="d"]').click();const art=page.locator('#garageDetailArt'),fallback=art.locator('.garage-art-fallback');await expect(fallback).toBeVisible();await expect(art.locator('.game-asset-fallback')).toHaveCount(0);await expect(fallback.getByRole('button')).toHaveCount(1);await shot(page,info,'car-image-failure');
  blocked=false;await fallback.getByRole('button').click();await expect(art.locator('.garage-art')).toHaveAttribute('data-status','ready');await expect(fallback).toBeHidden();const recovered=await observe(page);expect(recovered.state).toEqual(before.state);
  blocked=true;await art.locator('img').evaluate(img=>{img.src=GAME_CONFIG.assets['car:d'].url+'?owned-retry=1';});await expect(fallback).toBeVisible();blocked=false;held=true;await fallback.getByRole('button').click();await expect.poll(()=>requests.some(r=>r.held)).toBe(true);await page.keyboard.press('Escape');release();await page.unrouteAll({behavior:'wait'});await expect(page.locator('#garageDetailArt')).toHaveCount(0);const after=await observe(page);expect(after.presentation.detailActive).toBe(false);expect(after.state).toEqual(before.state);expect(after.saves).toBe(0);await capture(info,'image-recovery',{before,recovered,requests,after});
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('failed audio and denied save retain one committed in-memory car with backup warning',async({page},info)=>{
 await setup(page);await select(page);const before=await observe(page);await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===KEY)throw new DOMException('owned save denial','QuotaExceededError');return set.call(this,k,v);};GAME_AUDIO={...GAME_AUDIO,play(){return Promise.reject(new Error('owned audio failure'));}};});await confirm(page);await expect(page.locator('#storeWarn')).toBeVisible();await expect.poll(async()=>(await observe(page)).presentation.audioFailed).toBe(true);const committed=await observe(page);expect(committed.saved).toBe(before.saved);expect(committed.saves).toBe(1);expect(committed.resets).toBe(1);expect(committed.state.cars).toHaveLength(1);await page.locator('[data-garage-skip]').click();expect((await observe(page)).state).toEqual(committed.state);await capture(info,'save-audio-failure',{before,committed,after:await observe(page)});
});

test('normal opted-in garage cues decode and start after saved transaction',async({page},info)=>{
 await setup(page);await page.locator('#gameAudioChoice [data-audio-enable]').click();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().state)).toBe('running');const before=await page.evaluate(()=>GAME_AUDIO.snapshot());await select(page);await confirm(page);await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().startedCues)).toBeGreaterThanOrEqual(before.startedCues+2);await expect(page.locator('.garage-showroom')).toHaveAttribute('data-phase','complete');const after=await observe(page),audio=await page.evaluate(()=>GAME_AUDIO.snapshot());expect(after.cues.map(c=>c.id)).toEqual(['garage.assemble','garage.complete']);expect(after.cues.every(c=>c.saved===after.saved)).toBe(true);expect(audio.route).toBe('garage');expect(after.saves).toBe(1);await capture(info,'audible-runtime',{before,audio,after,subjectiveListening:false});
});

test('shared craft and QP ownership is disposed before garage; fresh detail never restores a stale caller',async({page},info)=>{
 await setup(page,'crafting-ready');await destination(page,'craft');await page.locator('#parts [data-part-key="bpillar"]').click();await page.locator('#mkBtn').click();expect(await page.evaluate(()=>GAME_CRAFTING.snapshot().active)).toBe(true);
 await page.evaluate(()=>{S.cars=[{k:'d',at:1}];openCar('d',document.getElementById('title-craft'));});expect(await page.evaluate(()=>GAME_CRAFTING.snapshot())).toMatchObject({active:false,busy:false,pendingTimerCount:0,imageCount:0,cleanupCount:0});await expect(page.locator('#garageCarTitle')).toBeVisible();await page.keyboard.press('Escape');expect((await observe(page)).presentation.detailActive).toBe(false);
 await page.evaluate(()=>{history.replaceState(null,'','#research');routeView(false);qpCaller={route:'#craft',scroll:0,craft:{key:'bpillar',picks:[],plan:[],stock:[]}};openCar('d',document.getElementById('title-research'));});expect(await page.evaluate(()=>qpCaller)).toBeNull();await page.keyboard.press('Escape');await expect(page.locator('#view-research')).toBeVisible();await expect(page.locator('#craftTitle')).toHaveCount(0);await capture(info,'shared-owner',{conditionalStaleCallerProbe:true,craft:await page.evaluate(()=>GAME_CRAFTING.snapshot()),after:await observe(page)});
});

test('short-height and 200 percent equivalent reflow preserve full car and keyboard controls',async({page},info)=>{
 await page.setViewportSize({width:640,height:450});await setup(page,'all-cars');await page.locator('#garage [data-car-key="d"]').click();await expect(page.locator('#garageDetailArt .garage-art')).toHaveAttribute('data-status','ready');await page.locator('#garageRepresentative').scrollIntoViewIfNeeded();await expect(page.locator('#garageRepresentative')).toBeInViewport();await page.locator('#garageRepresentative').focus();await page.keyboard.press('Enter');await expect(page.locator('#garagePreferenceStatus')).toContainText('대표 차량');await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>partModal.contains(document.activeElement))).toBe(true);expect(await page.evaluate(()=>partBox.scrollWidth<=partBox.clientWidth&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot(page,info,'short-200-reflow');await capture(info,'reflow',{viewport:{width:640,height:450},nativeZoom:false,after:await observe(page)});
});

for(const reduced of [false,true])test('short landscape keyboard grand reveal keeps all eight full cars above navigation reduced '+reduced,async({page},info)=>{
 await page.setViewportSize({width:640,height:450});await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await setup(page);const cars=await page.evaluate(()=>CARS.map(c=>({key:c.key,tag:c.tag}))),cycles=[];
 await page.evaluate(()=>{window.landscapeScroll=[];const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){landscapeScroll.push({id:this.id,...options});return scroll.call(this,options);};});
 for(const car of cars){
  await page.evaluate(()=>{GAME_GARAGE.cancel();S.parts=Object.fromEntries(PARTS.map(p=>[p.key,{at:Date.now(),use:[]}]));refresh();carSaves=0;partResets=0;landscapeScroll=[];});const before=await observe(page);await select(page,car.key);await page.evaluate(()=>{landscapeScroll=[];});await page.locator('#takeCar').focus();await page.keyboard.press('Enter');const rows=[];let previous=0;
  for(const at of [0,100,500,1500]){
   await page.waitForTimeout(at-previous);previous=at;
   const row=await page.evaluate(()=>{const rect=n=>n.getBoundingClientRect().toJSON(),scene=document.querySelector('#garageStage .garage-scene'),car=scene.querySelector('.garage-scene-car'),image=car.querySelector('img'),caption=document.querySelector('#garageStage .garage-scene-caption'),title=document.getElementById('garageStageTitle');return {car:rect(car),image:rect(image),scene:rect(scene),caption:rect(caption),title:rect(title),name:title.textContent,titleWidth:title.clientWidth,titleScrollWidth:title.scrollWidth,fit:getComputedStyle(image).objectFit,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,nav:rect(document.querySelector('.destination-nav')),focus:document.activeElement.id,saves:carSaves,resets:partResets,scroll:landscapeScroll,phase:GAME_GARAGE.snapshot().phase};});rows.push({at,...row});
   if(at===0||at===1500){const path=info.outputPath('landscape-'+car.key+'-'+at+'.png');await page.screenshot({path});await info.attach('landscape-'+car.key+'-'+at,{path,contentType:'image/png'});}
  }
  const after=await observe(page);await capture(info,'landscape-'+car.key,{reduced,viewport:{width:640,height:450},before,after,rows});cycles.push({key:car.key,rows});
  for(const row of rows){
   expect.soft(row.car.top,car.key+' full vehicle top at '+row.at).toBeGreaterThanOrEqual(0);expect.soft(row.car.bottom,car.key+' full vehicle and wheels above fixed navigation at '+row.at).toBeLessThanOrEqual(row.nav.top+1);
   expect.soft(row.image.top).toBeGreaterThanOrEqual(row.scene.top);expect.soft(row.image.bottom).toBeLessThanOrEqual(row.scene.bottom);expect.soft(row.image.left).toBeGreaterThanOrEqual(row.scene.left);expect.soft(row.image.right).toBeLessThanOrEqual(row.scene.right);
   expect.soft(row.caption.bottom,car.key+' normal-flow caption cannot cover vehicle').toBeLessThanOrEqual(row.car.top);expect.soft(row.title.top).toBeGreaterThanOrEqual(0);expect.soft(row.title.bottom).toBeLessThanOrEqual(row.nav.top);expect.soft(row.titleScrollWidth).toBeLessThanOrEqual(row.titleWidth);expect.soft(row.name).toBe(car.tag);
   expect.soft(row.scene.width/row.scene.height).toBeCloseTo(1.5,2);expect.soft(row.fit).toBe('contain');expect.soft(row.naturalWidth).toBeGreaterThan(0);expect.soft(row.naturalHeight).toBeGreaterThan(0);expect.soft(row.focus).toBe('garageStageTitle');expect.soft(row.saves).toBe(1);expect.soft(row.resets).toBe(1);expect.soft(row.scroll).toEqual([{id:'garageStage',behavior:'instant',block:'start'}]);
  }
  expect(after.state.cars).toEqual([...before.state.cars,{k:car.key,at:Date.parse(fixedTime)}]);expect(after.state.parts).toEqual({});for(const key of ['stock','owned','scrap'])expect(after.state[key]).toEqual(before.state[key]);expect(JSON.parse(after.saved)).toEqual(after.state);expect(after.presentation.phase).toBe('complete');
 }
 await capture(info,'landscape-cycles',cycles);
});

test('tiny landscape and explicit root-font preference keep a legible painted car with scroll access',async({page},info)=>{
 const scenarios=[{width:640,height:208,rootFontPercent:100},{width:640,height:225,rootFontPercent:100},{width:640,height:416,rootFontPercent:200}],observed=[];
 for(const scenario of scenarios){
  await page.setViewportSize({width:scenario.width,height:scenario.height});await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
  await page.evaluate(percent=>{document.documentElement.style.fontSize=percent+'%';},scenario.rootFontPercent);await select(page);
  await page.evaluate(()=>{window.tinyBoundaryScroll=[];const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){tinyBoundaryScroll.push({id:this.id,...options});return scroll.call(this,options);};});
  const before=await observe(page);await page.locator('#takeCar').focus();await page.keyboard.press('Enter');await expect(page.locator('#garageStage [data-asset="car:t"]')).toHaveAttribute('data-status','ready');
  const inspect=()=>page.evaluate(()=>{
   const rect=n=>n.getBoundingClientRect().toJSON(),scene=document.querySelector('#garageStage .garage-scene'),car=scene.querySelector('.garage-scene-car'),image=car.querySelector('img'),title=document.getElementById('garageStageTitle'),caption=document.querySelector('#garageStage .garage-scene-caption'),nav=document.querySelector('.destination-nav'),box=rect(image),navigation=rect(nav),style=getComputedStyle(title);
   const paintedWidth=Math.min(box.width,box.height*image.naturalWidth/image.naturalHeight),paintedHeight=Math.min(box.height,box.width*image.naturalHeight/image.naturalWidth),painted={left:box.left+(box.width-paintedWidth)/2,top:box.top+(box.height-paintedHeight)/2,width:paintedWidth,height:paintedHeight};painted.right=painted.left+painted.width;painted.bottom=painted.top+painted.height;
   const visibleWidth=Math.max(0,Math.min(innerWidth,painted.right)-Math.max(0,painted.left)),visibleHeight=Math.max(0,Math.min(navigation.top,painted.bottom)-Math.max(0,painted.top)),centerX=painted.left+painted.width/2,centerY=painted.top+painted.height/2,hit=centerX>=0&&centerX<innerWidth&&centerY>=0&&centerY<navigation.top?document.elementsFromPoint(centerX,centerY):[];
   return {innerWidth,innerHeight,rootFontSize:getComputedStyle(document.documentElement).fontSize,scene:rect(scene),car:rect(car),image:box,painted,visibleWidth,visibleHeight,visiblePaintedArea:visibleWidth*visibleHeight,sceneHitAtImageCenter:hit.includes(scene),caption:rect(caption),title:rect(title),titleFontSize:parseFloat(style.fontSize),titleLineHeight:parseFloat(style.lineHeight),titleWidth:title.clientWidth,titleScrollWidth:title.scrollWidth,nav:navigation,fit:getComputedStyle(image).objectFit,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,scrollY,maxScroll:document.documentElement.scrollHeight-innerHeight,documentWidth:document.documentElement.scrollWidth,focus:document.activeElement.id,scroll:tinyBoundaryScroll,saves:carSaves,resets:partResets};
  });
  const initial=await inspect(),name='tiny-'+scenario.height+'-root-'+scenario.rootFontPercent;let path=info.outputPath(name+'-initial.png');await page.screenshot({path});await info.attach(name+'-initial',{path,contentType:'image/png'});
  await page.locator('.garage-scene-car').evaluate(n=>n.scrollIntoView({behavior:'instant',block:'center'}));const scrolled=await inspect();path=info.outputPath(name+'-scroll.png');await page.screenshot({path});await info.attach(name+'-scroll',{path,contentType:'image/png'});const after=await observe(page);await capture(info,name,{scenario,rootPreferenceEmulation:true,nativeBrowserZoom:false,before,after,initial,scrolled});observed.push({scenario,initial,scrolled});
  expect.soft(scrolled.scene.height,'scene must not collapse at '+name).toBeGreaterThan(0);expect.soft(scrolled.car.height,'vehicle must remain at least as tall as its readable title line at '+name).toBeGreaterThanOrEqual(scrolled.titleLineHeight);expect.soft(scrolled.visiblePaintedArea,'loaded vehicle must paint above fixed navigation after native scroll at '+name).toBeGreaterThan(0);expect.soft(scrolled.sceneHitAtImageCenter,'vehicle scene must be exposed after native scroll at '+name).toBe(true);
  expect.soft(scrolled.fit).toBe('contain');expect.soft(scrolled.titleScrollWidth).toBeLessThanOrEqual(scrolled.titleWidth);expect.soft(scrolled.caption.bottom).toBeLessThanOrEqual(scrolled.car.top);expect.soft(scrolled.documentWidth).toBeLessThanOrEqual(scrolled.innerWidth);expect.soft(initial.focus).toBe('garageStageTitle');expect.soft(initial.scroll).toEqual([{id:'garageStage',behavior:'instant',block:'start'}]);expect.soft(after.saves).toBe(1);expect.soft(after.resets).toBe(1);expect(after.state.cars).toEqual([{k:'t',at:Date.parse(fixedTime)}]);expect(after.state.parts).toEqual({});for(const key of ['stock','owned','scrap'])expect(after.state[key]).toEqual(before.state[key]);expect(JSON.parse(after.saved)).toEqual(after.state);
  const control=page.locator('.destination-nav a[href="#workshop"]');await control.focus();const controlBox=await control.boundingBox();expect.soft(controlBox.y).toBeGreaterThanOrEqual(0);expect.soft(controlBox.y+controlBox.height).toBeLessThanOrEqual(scenario.height);await page.keyboard.press('Enter');await expect(page.locator('#view-workshop')).toBeVisible();expect((await observe(page)).state).toEqual(after.state);
 }
 await capture(info,'tiny-boundary-scenarios',observed);
});

test('malformed car presentation input cannot replace current display or mutate progress',async({page},info)=>{
 await setup(page,'all-cars');const before=await observe(page);const rejected=await page.evaluate(()=>{try{GAME_GARAGE.showStage(document.getElementById('garageStage'),'<script>car</script>',true);return false;}catch(e){return e instanceof TypeError;}});expect(rejected).toBe(true);expect(await observe(page)).toEqual(before);await capture(info,'malformed',{before,rejected});
});
