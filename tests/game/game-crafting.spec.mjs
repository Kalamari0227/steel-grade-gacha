import {test,expect} from '@playwright/test';
import {appURL,baselineURL,fixedTime} from '../helpers/paths.mjs';
import {openApp,capture,destination} from '../helpers/app.mjs';
import {storageEvidence} from '../helpers/storage-evidence.mjs';
process.env.SGG_EDITION='game';
storageEvidence(test);
const errors=new WeakMap();
test.beforeEach(async({page})=>{const rows=[];errors.set(page,rows);page.on('pageerror',e=>rows.push(e.message));});
test.afterEach(async({page},info)=>{await capture(info,'console',{errors:errors.get(page)});expect(errors.get(page)).toEqual([]);});
const observe=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:JSON.parse(localStorage.getItem(KEY)),saves:window.craftSaves,cues:window.craftCues,presentation:GAME_CRAFTING.snapshot()}));
const picks=page=>page.locator('.craft-slot').evaluateAll(rows=>rows.map(row=>row.dataset.selectedId));
async function setup(page,fixture='crafting-ready'){
 await openApp(page,appURL,fixture);await destination(page,'craft');
 await page.evaluate(()=>{window.craftSaves=0;window.craftCues=[];const persist=save;save=function(){craftSaves++;return persist();};const audio=GAME_AUDIO;GAME_AUDIO={...audio,play(id){craftCues.push({id,saved:JSON.parse(localStorage.getItem(KEY))});return audio.play(id);}};});
}
async function frozen(page){await page.clock.install({time:new Date(fixedTime)});await setup(page);await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));}
async function open(page,key='bpillar'){await page.locator(`#parts [data-part-key="${key}"]`).click();}
async function choose(page,slot,id){const row=page.locator(`.craft-slot[data-slot="${slot}"]`);if(!await row.locator('details').evaluate(n=>n.open))await row.locator('summary').click();await row.locator(`button[data-id="${id}"]`).click();}
async function press(page,id){await page.locator('#'+id).evaluate(n=>n.click());}
async function shot(page,info,name){await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true,animations:'disabled'});}
function consumption(stock,use){const out={...stock};for(const id of use)if(id!=='qp-1470'){out[id]--;if(!out[id])delete out[id];}return out;}

test('35 original recipes and 42 slots survive; assembly metadata matches 10/10/15 actual groups',async({page},info)=>{
 await openApp(page,baselineURL,'crafting-ready');const original=await page.evaluate(()=>PARTS);
 await setup(page);const actual=await page.evaluate(()=>({parts:PARTS,assembly:GAME_CONFIG.assembly}));expect(actual.parts).toEqual(original);expect(actual.parts).toHaveLength(35);expect(actual.parts.reduce((n,p)=>n+p.need.length,0)).toBe(42);
 expect(actual.assembly).toHaveLength(35);expect(new Set(actual.assembly.map(r=>r.partKey)).size).toBe(35);expect(Object.values(actual.parts.reduce((out,p)=>(out[p.grp]=(out[p.grp]||0)+1,out),{})).sort((a,b)=>a-b)).toEqual([10,10,15]);
 for(const p of actual.parts)expect(actual.assembly.find(row=>row.partKey===p.key)?.assetId).toBe('part:'+p.key);
 await expect(page.locator('#parts [data-part-key]')).toHaveCount(35);await capture(info,'original-recipes',{original,actual});await shot(page,info,'craft-overview');
});

test('UI confirmation commits exact selected costs and save before every readonly assembly phase',async({page},info)=>{
 await frozen(page);await open(page);await choose(page,0,'ga-1470H');await choose(page,1,'ga-980Y');const before=await observe(page);expect(before.saves).toBe(0);const selected=await picks(page);
 await press(page,'mkBtn');const committed=await observe(page);expect(committed.state.parts.bpillar.use).toEqual(selected);expect(committed.state.stock).toEqual(consumption(before.state.stock,selected));expect(committed.saved).toEqual(committed.state);expect(committed.saves).toBe(1);expect(committed.cues[0].saved).toEqual(committed.state);
 const rows=[];let elapsed=0;
 for(const [time,phase] of [[0,'material'],[299,'material'],[300,'form'],[649,'form'],[650,'place'],[1099,'place'],[1100,'complete']]){await page.clock.runFor(time-elapsed);elapsed=time;const row=await observe(page);expect(row.presentation.phase).toBe(phase);expect(row.state).toEqual(committed.state);expect(row.saved).toEqual(committed.saved);expect(row.saves).toBe(1);rows.push({time,...row.presentation});}
 expect((await observe(page)).presentation.pendingTimerCount).toBe(0);expect((await observe(page)).cues.map(row=>row.id)).toEqual(['craft.material','craft.work','craft.complete']);await capture(info,'commit-timeline',{before,committed,rows,after:await observe(page)});await shot(page,info,'assembly-complete');
});

for(const operation of ['skip','close'])test(`${operation} at all assembly boundaries never changes the committed craft`,async({page},info)=>{
 await frozen(page);const fixture=(await observe(page)).state,rows=[];
 for(const time of [0,300,650,1099]){
  await page.evaluate(fixture=>{closePart();S=structuredClone(fixture);save();refresh();craftSaves=0;craftCues=[];},fixture);await open(page);await press(page,'mkBtn');const committed=await observe(page);await page.clock.runFor(time);
  if(operation==='skip')await page.locator('[data-craft-skip]').evaluate(n=>n.click());else await page.keyboard.press('Escape');const stopped=await observe(page);await page.clock.runFor(2000);const after=await observe(page);
  expect(after.state).toEqual(committed.state);expect(after.saved).toEqual(committed.saved);expect(after.saves).toBe(1);expect(after.cues).toEqual(stopped.cues);expect(after.presentation.pendingTimerCount).toBe(0);expect(after.presentation.busy).toBe(false);
  if(operation==='close'){expect(after.presentation.imageCount).toBe(0);expect(after.presentation.cleanupCount).toBe(0);}else expect(after.presentation.phase).toBe('complete');rows.push({time,committed,stopped,after});
 }
 await capture(info,'interrupt-boundaries',{operation,rows});
});

test('reduced motion is immediate and quiet with the same saved craft',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await open(page);const before=await observe(page);
 const elapsed=await page.evaluate(()=>{const begin=performance.now();document.getElementById('mkBtn').click();return performance.now()-begin;});const after=await observe(page);
 expect(elapsed).toBeLessThanOrEqual(100);expect(after.presentation).toMatchObject({phase:'complete',busy:false,pendingTimerCount:0});expect(after.cues).toEqual([]);expect(after.saves).toBe(1);expect(after.saved).toEqual(after.state);expect(after.state.stock).toEqual(consumption(before.state.stock,after.state.parts.bpillar.use));await capture(info,'reduced',{before,elapsed,after});
});

for(const width of [390,1280])test(`material detail returns to unchanged choices and focus at width ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:900});await setup(page);await open(page);await choose(page,0,'ga-1470H');await choose(page,1,'ga-980Y');const before=await observe(page),selected=await picks(page);
 const detail=page.locator('.craft-slot[data-slot="1"] [data-craft-material="ga-980Y"]');await detail.click();await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id','ga-980Y');await page.keyboard.press('Escape');await expect(detail).toBeFocused();expect(await picks(page)).toEqual(selected);expect((await observe(page)).state).toEqual(before.state);expect((await observe(page)).saved).toEqual(before.saved);expect((await observe(page)).saves).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await capture(info,'detail-return',{width,before,selected,after:await observe(page)});await shot(page,info,'material-detail-'+width);
});

for(const develop of [false,true])test(`QP ${develop?'success result':'cancel'} returns same part and picks and rechecks displayed quantity`,async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page,'qp-ready');await page.evaluate(()=>{S.stock['poo-PHS']=2;S.stock['ssial-980Y']=3;S.owned['ssial-980Y']=true;save();refresh();craftSaves=0;});await open(page);await choose(page,0,'poo-PHS');await choose(page,1,'ssial-980Y');const selected=await picks(page),before=await observe(page);await press(page,'craftQP');await expect(page.locator('#qpTitle')).toBeVisible();
 const material=page.locator('[data-qp-material]').first();await material.evaluate(button=>{button.closest('details').open=true;});await material.click();await page.keyboard.press('Escape');await expect(material).toBeFocused();
 await page.evaluate(()=>{S.stock['ssial-980Y']++;save();});
 if(develop){await press(page,'devBtn');await expect(page.locator('#pullBox')).toBeVisible();await page.locator('[data-draw-close]').click();}else await page.keyboard.press('Escape');
 expect(await picks(page)).toEqual(selected);await expect(page.locator('.craft-slot[data-slot="1"] button[data-id="ssial-980Y"]')).toBeFocused();const returned=await observe(page);expect(returned.state.parts.bpillar).toBeUndefined();
 await press(page,'mkBtn');const reviewed=await observe(page);expect(reviewed.state).toEqual(returned.state);expect(reviewed.saves).toBe(returned.saves);await expect(page.locator('#craftStatus')).toBeFocused();await press(page,'mkBtn');const after=await observe(page);expect(after.state.parts.bpillar.use).toEqual(selected);expect(after.saves).toBe(reviewed.saves+1);expect(after.state.stock).toEqual(consumption(reviewed.state.stock,selected));if(develop)expect(after.state.stock['qp-1470']).toBe(1);await capture(info,'qp-return',{develop,before,selected,returned,reviewed,after});
});

test('locked QP research uses explicit same-part return without spending',async({page},info)=>{
 await setup(page);await page.evaluate(()=>{delete S.owned['ssial-1470M'];refresh();});await open(page);await choose(page,0,'ga-1470H');const selected=await picks(page),before=await observe(page);await press(page,'craftQP');await expect(page.locator('#view-research')).toBeVisible();await press(page,'craftResearchReturn');expect(await picks(page)).toEqual(selected);const after=await observe(page);expect(after.state).toEqual(before.state);expect(after.saves).toBe(0);await capture(info,'locked-research-return',{before,selected,after});
});

for(const operation of ['route','hide','pagehide','reset','restore'])test(`${operation} cancels assembly without late state effects`,async({page},info)=>{
 await frozen(page);const code=await page.evaluate(()=>makeCode());await open(page);await press(page,'mkBtn');await page.clock.runFor(300);const committed=await observe(page);
 if(operation==='route'){await page.evaluate(()=>{location.hash='#dex';});await expect(page.locator('#view-dex')).toBeVisible();await expect.poll(()=>page.evaluate(()=>GAME_CRAFTING.snapshot().active)).toBe(false);await page.clock.runFor(0);const routed=await observe(page);expect(routed.cues.slice(committed.cues.length)).toEqual([{id:'ui.tab',saved:committed.saved}]);expect(routed.state).toEqual(committed.state);expect(routed.saved).toEqual(committed.saved);expect(routed.saves).toBe(committed.saves);expect(routed.presentation).toMatchObject({active:false,busy:false,pendingTimerCount:0,imageCount:0,cleanupCount:0});await capture(info,'route-callback-boundary',{committed,routed});}
 if(operation==='hide')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 if(operation==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 if(operation==='reset')await page.evaluate(()=>{document.getElementById('btnSettings').click();document.getElementById('btnReset').click();document.getElementById('btnReset').click();});
 if(operation==='restore')await page.evaluate(code=>{document.getElementById('btnSettings').click();document.getElementById('btnBackup').click();document.getElementById('bkIn').value=code;document.getElementById('bkLoad').click();document.getElementById('bkConfirm').click();},code);
 const stopped=await observe(page);await page.clock.runFor(3000);const after=await observe(page);expect(after.state).toEqual(stopped.state);expect(after.saved).toEqual(stopped.saved);expect(after.cues).toEqual(stopped.cues);expect(after.presentation).toMatchObject({active:false,busy:false,pendingTimerCount:0,imageCount:0,cleanupCount:0});await capture(info,'lifecycle',{operation,committed,stopped,after});
});

test('owned art has exactly one fallback and retry, recovers, then ignores a held retry after close',async({page},info)=>{
 let blocked=true,held=false,release;const requests=[];const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/*',async route=>{
  const target=/\/part-bpillar\.[a-f0-9]+\.webp$/.test(new URL(route.request().url()).pathname);
  if(target)requests.push({url:route.request().url(),blocked,held});
  if(target&&held)await gate;
  return target&&blocked?route.fulfill({status:404,body:'owned missing part'}):route.continue();
 });
 try{
  await setup(page);await page.evaluate(()=>{GAME_AUDIO={...GAME_AUDIO,play(){return Promise.reject(new Error('owned audio failure'));}};});await open(page);await press(page,'mkBtn');const committed=await observe(page);
  const owner=page.locator('#craftAssembly'),fallback=owner.locator('.craft-art-fallback').filter({hasText:'B 필러'});
  await expect(fallback).toBeVisible();await expect(owner.locator('.craft-art-fallback:visible')).toHaveCount(1);await expect(fallback.getByRole('button')).toHaveCount(1);await expect(owner.locator('.game-asset-fallback')).toHaveCount(0);await expect(owner.locator('img[data-game-fallback]')).toHaveCount(0);await shot(page,info,'asset-failure');
  blocked=false;await fallback.getByRole('button').click();await expect(fallback).toBeHidden();await expect(owner.locator('[data-assembly-part="bpillar"] .craft-art')).toHaveAttribute('data-status','ready');await expect(owner.locator('.game-asset-fallback')).toHaveCount(0);
  const recovered=await observe(page);expect(recovered.state).toEqual(committed.state);expect(recovered.saves).toBe(1);
  blocked=true;await owner.locator('[data-assembly-part="bpillar"] img').evaluate(img=>{img.src=GAME_CONFIG.assets['part:bpillar'].url+'?owned-retry=1';});await expect(fallback).toBeVisible();await expect(owner.locator('.craft-art-fallback:visible')).toHaveCount(1);await expect(owner.locator('.game-asset-fallback')).toHaveCount(0);
  blocked=false;held=true;await fallback.getByRole('button').click();await expect.poll(()=>requests.some(row=>row.held)).toBe(true);await page.keyboard.press('Escape');const closed=await observe(page);release();await page.unrouteAll({behavior:'wait'});const after=await observe(page);
  expect(after.state).toEqual(committed.state);expect(after.saved).toEqual(committed.saved);expect(after.saves).toBe(1);expect(after.cues).toEqual(closed.cues);expect(after.presentation).toMatchObject({active:false,pendingTimerCount:0,imageCount:0,cleanupCount:0});await expect(page.locator('#craftAssembly')).toHaveCount(0);expect(requests.some(row=>row.blocked)).toBe(true);expect(requests.some(row=>!row.blocked&&!row.held)).toBe(true);await capture(info,'failure-recovery',{committed,recovered,closed,requests,after});
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('malformed presentation input cannot replace the saved result or mutate economics',async({page},info)=>{
 await frozen(page);await open(page);await press(page,'mkBtn');const before=await observe(page);
 const rejection=await page.evaluate(()=>{try{GAME_CRAFTING.start(document.getElementById('craftAssembly'),{partKey:'not-a-part',completed:[],materials:[]});return false;}catch(error){return error instanceof TypeError;}});expect(rejection).toBe(true);expect(await observe(page)).toEqual(before);await capture(info,'malformed-snapshot',{rejection,before,after:await observe(page)});
});

test('save denial exposes backup while readonly assembly cannot repeat committed memory costs',async({page},info)=>{
 await setup(page);await open(page);const before=await observe(page);await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Owned save failure','QuotaExceededError');return set.call(this,key,value);};});await press(page,'mkBtn');const committed=await observe(page);expect(committed.saves).toBe(1);expect(committed.saved).toEqual(before.saved);expect(committed.state.stock).toEqual(consumption(before.state.stock,committed.state.parts.bpillar.use));await expect(page.locator('#storeWarn')).toBeVisible();await page.keyboard.press('Escape');await page.locator('#warnGo').click();await expect(page.locator('#backupModal')).toBeVisible();expect(await page.locator('#bkOut').inputValue()).toMatch(/^SGG-GAME1\./);expect((await observe(page)).saves).toBe(1);await capture(info,'save-denied',{before,committed,after:await observe(page)});
});

test('duplicate material slots reserve both units and detached double confirmation commits once',async({page},info)=>{
 await setup(page);await page.evaluate(()=>{const p=findPart('bpillar');p.need=[{any:['poo-PHS']},{any:['poo-PHS']}];S.stock={'poo-PHS':1};refresh();});await open(page);const before=await observe(page);await expect(page.locator('#mkBtn')).toBeDisabled();await press(page,'mkBtn');expect((await observe(page)).state).toEqual(before.state);await page.keyboard.press('Escape');
 await page.evaluate(()=>{S.stock['poo-PHS']=2;refresh();});await open(page);await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','2');await page.evaluate(()=>{const button=document.getElementById('mkBtn');button.click();button.click();});const after=await observe(page);expect(after.state.parts.bpillar.use).toEqual(['poo-PHS','poo-PHS']);expect(after.state.stock).toEqual({});expect(after.saves).toBe(1);await capture(info,'duplicate-reservation',{before,after});
});

for(const operation of ['route','reset','restore','different-part','hide'])test(`pending QP successful result cannot restore old caller after ${operation}`,async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page,'qp-ready');await page.evaluate(()=>{S.stock['poo-PHS']=1;S.stock['ssial-980Y']=2;S.owned['ssial-980Y']=true;refresh();});const code=await page.evaluate(()=>makeCode());await open(page);await press(page,'craftQP');await press(page,'devBtn');await expect(page.locator('#pullBox')).toBeVisible();const developed=await observe(page);
 if(operation==='route')await destination(page,'dex');
 if(operation==='reset')await page.evaluate(()=>{document.getElementById('btnSettings').click();document.getElementById('btnReset').click();document.getElementById('btnReset').click();});
 if(operation==='restore')await page.evaluate(code=>{document.getElementById('btnSettings').click();document.getElementById('btnBackup').click();document.getElementById('bkIn').value=code;document.getElementById('bkLoad').click();document.getElementById('bkConfirm').click();},code);
 if(operation==='different-part'){await destination(page,'craft');await open(page,'hood');}
 if(operation==='hide')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.evaluate(()=>closeDraw(true));expect(await page.evaluate(()=>craftResultCaller)).toBeNull();expect(await page.evaluate(()=>craftResearchCaller)).toBeNull();if(operation==='different-part')await expect(page.locator('#craftTitle')).toContainText('후드');else await expect(page.locator('#craftTitle')).toHaveCount(0);await capture(info,'invalidated-return',{operation,developed,after:await observe(page)});
});

// Conditional state-boundary coverage only; this fixture is NOT proof of a reachable historical UI regression.
test('retained locked research caller transfers into development if eligibility changes in place',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page,'qp-ready');await page.evaluate(()=>{delete S.owned['ssial-1470M'];S.stock['poo-PHS']=1;S.stock['ssial-980Y']=2;S.owned['ssial-980Y']=true;refresh();});await open(page);await choose(page,0,'poo-PHS');const selected=await picks(page);await press(page,'craftQP');await expect(page.locator('#craftResearchReturn')).toBeVisible();
 await page.evaluate(()=>{S.owned['ssial-1470M']=true;refresh();});const before=await observe(page);await press(page,'researchQPButton');expect(await page.evaluate(()=>craftResearchCaller)).toBeNull();await expect(page.locator('#craftResearchReturn')).toBeHidden();await press(page,'devBtn');await page.locator('[data-draw-close]').click();expect(await picks(page)).toEqual(selected);const after=await observe(page);expect(after.state.parts.bpillar).toBeUndefined();expect(after.saves-before.saves).toBe(1);await capture(info,'conditional-caller-transfer',{fixtureOnly:true,before,selected,after});
});
