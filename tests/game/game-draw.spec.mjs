import {test,expect} from '@playwright/test';
import {appURL,baselineURL,fixedTime} from '../helpers/paths.mjs';
import {openApp,state,capture,destination} from '../helpers/app.mjs';
import {storageEvidence} from '../helpers/storage-evidence.mjs';
process.env.SGG_EDITION='game';
storageEvidence(test);
const errors=new WeakMap();
test.beforeEach(async({page})=>{const rows=[];errors.set(page,rows);page.on('pageerror',error=>rows.push(error.message));});
test.afterEach(async({page},info)=>{await capture(info,'console',{errors:errors.get(page)});expect(errors.get(page)).toEqual([]);});
const observed=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:JSON.parse(localStorage.getItem(KEY)),presentation:GAME_DRAW.snapshot(),saves:window.drawSaves,cues:window.drawCues}));
async function open(page,fixture='mid-progress'){
 await openApp(page,appURL,fixture);
 await page.waitForFunction(()=>document.body.dataset.gameRelease && typeof GAME_DRAW!=='undefined');
 await page.evaluate(()=>{
  window.drawSaves=0;window.drawCues=[];const original=save;save=function(){drawSaves++;return original();};
  const audio=GAME_AUDIO;GAME_AUDIO={...audio,play(id){drawCues.push(id);return audio.play(id);}};
 });
}
async function frozen(page){await page.clock.install({time:new Date(fixedTime)});await open(page);await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));}
async function action(page,id){await page.locator('#'+id).evaluate(button=>button.click());}
async function ready(page){await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');expect((await observed(page)).presentation.busy).toBe(false);}
async function shot(page,info,name){await page.locator('#pullBox').screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});}
async function probe(page,name){await page.evaluate(name=>{window.entries=[];const original=window[name];window[name]=function(...args){entries.push({args,state:JSON.parse(JSON.stringify(S)),saved:JSON.parse(localStorage.getItem(KEY))});return original.apply(this,args);};},name);}

for(const [mode,button,method] of [['single','btnPull','showPull'],['ten','btnTen','showTen']]) test(`${mode} committed results and random order match original HTTP baseline`,async({page},info)=>{
 await openApp(page,baselineURL,'mid-progress');const baselineBefore=await state(page);await probe(page,method);await action(page,button);const expected=await page.evaluate(()=>entries[0]);
 await open(page);await probe(page,method);await action(page,button);const entry=await page.evaluate(()=>entries[0]);expect(entry).toEqual(expected);expect(entry.saved).toEqual(entry.state);
 await page.locator('[data-draw-skip]').click();await ready(page);const actual=await observed(page);expect(actual.state).toEqual(expected.state);expect(actual.saved).toEqual(expected.state);expect(actual.saves).toBe(1);
 const ids=mode==='ten'?expected.args[0]:[expected.args[0]],fresh=mode==='ten'?expected.args[1]:[expected.args[1]];
 expect(actual.presentation.results).toEqual(ids.map((id,i)=>({id,isNew:fresh[i]})));expect(await page.locator('[data-result-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.resultId))).toEqual(ids);
 if(mode==='ten'){expect(ids).toHaveLength(10);expect(expected.state.scrap).toBe(baselineBefore.scrap-20);expect(expected.state.pullUsed).toBe(baselineBefore.pullUsed);expect(expected.state.extra).toBe(baselineBefore.extra);expect(await page.evaluate(ids=>ids.some(id=>lvOf(findChar(id))>=3),ids)).toBe(true);}
 await capture(info,'baseline-results',{mode,expected,entry,actual});await shot(page,info,'baseline-'+mode);
});

for(const mode of ['single','ten']) test(`${mode} follows every approved boundary before unlocking`,async({page},info)=>{
 await frozen(page);await action(page,mode==='single'?'btnPull':'btnTen');const committed=await observed(page),rows=[];
 const points=mode==='single'?[[0,'coil'],[449,'coil'],[450,'family'],[799,'family'],[800,'card',0],[1449,'card',0],[1450,'ready']]:[[0,'coil'],[450,'family'],[799,'family'],...Array.from({length:10},(_,i)=>[800+i*220,'card',i]),[3000,'summary',9],[3349,'summary',9],[3350,'ready']];
 let elapsed=0;
 for(const [time,phase,index] of points){await page.clock.runFor(time-elapsed);elapsed=time;const row=await observed(page);expect(row.presentation.phase).toBe(phase);if(index!==undefined)expect(row.presentation.index).toBe(index);if(phase==='summary')await expect(page.locator('[data-result-id]')).toHaveCount(10);expect(row.state).toEqual(committed.state);expect(row.saved).toEqual(committed.saved);expect(row.saves).toBe(1);rows.push({time,...row.presentation});}
 expect((await observed(page)).presentation.pendingTimerCount).toBe(0);await capture(info,'phase-timeline',{mode,committed,rows});await shot(page,info,mode+'-summary');
});

for(const mode of ['single','ten']) for(const operation of ['skip','close']) test(`${mode} ${operation} at every stage preserves one committed outcome`,async({page},info)=>{
 await frozen(page);const fixture=await state(page),rows=[];
 const stages=mode==='single'?[0,450,800,1449]:[0,450,...Array.from({length:10},(_,i)=>800+i*220),3000,3349];
 for(const time of stages){
  await page.evaluate(fixture=>{closeDraw(false);S=JSON.parse(JSON.stringify(fixture));save();refresh();drawSaves=0;drawCues=[];},fixture);
  await action(page,mode==='single'?'btnPull':'btnTen');const committed=await observed(page);await page.clock.runFor(time);
  await page.locator(`[data-draw-${operation}]`).evaluate(button=>button.click());const stopped=await observed(page);await page.clock.runFor(4000);const after=await observed(page);
  expect(after.state).toEqual(committed.state);expect(after.saved).toEqual(committed.saved);expect(after.saves).toBe(1);expect(after.cues).toEqual(stopped.cues);expect(after.presentation.busy).toBe(false);expect(after.presentation.pendingTimerCount).toBe(0);
  if(operation==='close'){expect(after.presentation.handleCount).toBe(0);await expect(page.locator('#pullBox')).not.toBeVisible();}else{await ready(page);expect(after.presentation.results).toEqual(committed.presentation.results);}
  rows.push({time,committed,stopped,after});
 }
 await capture(info,'interrupt-matrix',{mode,operation,rows});
});

test('repeat direct commands and stale event delivery cannot consume while busy',async({page},info)=>{
 await frozen(page);await action(page,'btnPull');const committed=await observed(page);
 await page.evaluate(()=>{tick();refresh();for(let i=0;i<4;i++){tenPull();scrapPull(3,SCRAP_LV3);scrapPull(4,SCRAP_LV4);document.getElementById('btnPull').dispatchEvent(new MouseEvent('click'));}});
 expect((await observed(page)).state).toEqual(committed.state);expect((await observed(page)).saves).toBe(1);await page.clock.runFor(1450);await ready(page);await capture(info,'repeat-entry',{committed,after:await observed(page)});
});

for(const mode of ['single','ten','development']) test(`${mode} reduced motion reaches complete static result within 100ms`,async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,mode==='development'?'qp-owned':'mid-progress');const before=await observed(page);
 const timing=await page.evaluate(mode=>{const start=performance.now();if(mode==='development')showPull(QP_ID,true,'선행개발');else document.getElementById(mode==='ten'?'btnTen':'btnPull').click();return {elapsed:performance.now()-start,phase:GAME_DRAW.snapshot().phase};},mode);
 expect(timing.phase).toBe('ready');expect(timing.elapsed).toBeLessThanOrEqual(100);const after=await observed(page);expect(after.presentation.pendingTimerCount).toBe(0);expect(after.cues).toEqual([]);
 if(mode==='development'){expect(after.state).toEqual(before.state);expect(after.saves).toBe(0);await expect(page.locator('.draw-coil')).toHaveCount(0);await expect(page.locator('.draw-stock')).toContainText('선행개발 소재 등록');}
 expect(after.presentation.results).toHaveLength(mode==='ten'?10:1);await capture(info,'reduced-motion',{mode,before,timing,after});await shot(page,info,'reduced-'+mode);
});

for(const operation of ['route','hide','pagehide','reset','restore','reload']) test(`${operation} cancels timers and visual handles without replay`,async({page},info)=>{
 await frozen(page);const original=await state(page),code=await page.evaluate(()=>makeCode());await action(page,'btnTen');await page.clock.runFor(1020);const committed=await observed(page);
 let routeBoundary=null;
 if(operation==='route'){await destination(page,'dex');await page.clock.runFor(1);routeBoundary=await observed(page);expect(routeBoundary.cues).toEqual([...committed.cues,'ui.tab']);expect(routeBoundary.presentation).toMatchObject({active:false,busy:false,pendingTimerCount:0,handleCount:0});}
 if(operation==='hide')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 if(operation==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 if(operation==='reset')await page.evaluate(()=>{document.getElementById('btnSettings').click();document.getElementById('btnReset').click();document.getElementById('btnReset').click();});
 if(operation==='restore')await page.evaluate(code=>{document.getElementById('btnSettings').click();document.getElementById('btnBackup').click();document.getElementById('bkIn').value=code;document.getElementById('bkLoad').click();document.getElementById('bkConfirm').click();},code);
 if(operation==='reload')await page.reload();
 const stopped=await observed(page);
 if(operation==='hide')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(5000);const after=await observed(page);expect(after.presentation).toMatchObject({active:false,busy:false,pendingTimerCount:0,handleCount:0});expect(after.state).toEqual(stopped.state);expect(after.saved).toEqual(stopped.saved);expect(after.cues).toEqual(stopped.cues);
 if(operation==='restore')expect(after.state.owned).toEqual(original.owned);else if(operation==='reset')expect(after.state.owned).toEqual({});else expect(after.state).toEqual(committed.state);
 await expect(page.locator('#pullBox')).not.toBeVisible();await capture(info,'lifecycle',{operation,original,committed,routeBoundary,stopped,after});
});

test('a newer result owns the DOM after a delayed old compositor completes',async({page},info)=>{
 await frozen(page);const urls=await page.evaluate(()=>GAME_CONFIG.faces.filter(face=>face.cardId==='poo-270C').map(face=>GAME_CONFIG.assets[face.character].url));let release;
 const gate=new Promise(resolve=>{release=resolve;});await page.route('**/*',async route=>{if(urls.some(url=>route.request().url().endsWith(url)))await gate;await route.continue();});
 await action(page,'btnPull');await page.clock.runFor(800);await page.evaluate(()=>closeDraw(false));await action(page,'btnTen');await page.clock.runFor(3350);const committed=await observed(page);release();await page.unrouteAll({behavior:'wait'});
 await expect(page.locator('[data-result-id]')).toHaveCount(10);expect((await observed(page)).presentation.results).toEqual(committed.presentation.results);expect((await observed(page)).state).toEqual(committed.state);await capture(info,'stale-compositor',{committed,after:await observed(page)});
});

test('missing art retry and rejected audio preserve result and available detail action',async({page},info)=>{
 let blocked=true;const requests=[];
 await page.route('**/*',route=>{const target=/\/character-poo-270C-front\.[a-f0-9]+\.webp$/.test(route.request().url());if(target)requests.push({url:route.request().url(),blocked});return target&&blocked?route.fulfill({status:404,body:'missing'}):route.continue();});
 await open(page);
 await page.evaluate(()=>{const audio=GAME_AUDIO;GAME_AUDIO={...audio,play(){return Promise.reject(new Error('Owned audio failure'));}};});
 await action(page,'btnPull');await ready(page);const committed=await observed(page);await expect(page.locator('.draw-result-art [data-status="error"]')).toHaveCount(1);await expect(page.locator('.draw-art')).toBeEnabled();
 await shot(page,info,'art-error');blocked=false;await page.locator('.draw-result-art [data-status="error"] button').click();await expect(page.locator('.draw-result-art [data-status="error"]')).toHaveCount(0);expect((await observed(page)).state).toEqual(committed.state);expect((await observed(page)).saves).toBe(1);await capture(info,'asset-audio-failure',{committed,requests,after:await observed(page)});expect(requests.some(row=>row.blocked)).toBe(true);expect(requests.some(row=>!row.blocked)).toBe(true);
});

test('save denied keeps committed memory result and exposes backup access',async({page},info)=>{
 await open(page);const before=await observed(page);await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Owned save failure','QuotaExceededError');return set.call(this,key,value);};});
 await action(page,'btnPull');await page.locator('[data-draw-skip]').click();await ready(page);const after=await observed(page);expect(after.state.extra).toBe(before.state.extra-1);expect(after.state.pullUsed).toBe(before.state.pullUsed);expect(after.state.stock[after.presentation.results[0].id]).toBe(before.state.stock[after.presentation.results[0].id]+1);expect(after.saved).toEqual(before.saved);expect(after.saves).toBe(1);
 await expect(page.locator('#storeWarn')).toBeVisible();await page.locator('#warnGo').click();await expect(page.locator('#backupModal')).toBeVisible();expect(await page.locator('#bkOut').inputValue()).toMatch(/^SGG-GAME1\./);await capture(info,'save-denied',{before,after});
});

test('single empty candidate pool rejects before consumption or save',async({page},info)=>{
 await open(page);await page.evaluate(()=>{POOL=[];refresh();});const before=await observed(page);
 await page.locator('#btnPull').evaluate(button=>button.dispatchEvent(new MouseEvent('click')));const after=await observed(page);expect(after.state).toEqual(before.state);expect(after.saved).toEqual(before.saved);expect(after.saves).toBe(0);expect(after.presentation.active).toBe(false);await expect(page.locator('#btnPull')).toBeDisabled();await capture(info,'empty-single',{before,after});
});

test('duplicate result scraps once and preserves the last copy',async({page},info)=>{
 await open(page);await action(page,'btnPull');await page.locator('[data-draw-skip]').click();const before=await observed(page),id=before.presentation.results[0].id;
 await page.locator('#btnScrap').evaluate(button=>{button.click();button.dispatchEvent(new MouseEvent('click'));});const after=await observed(page);expect(after.state.stock[id]).toBe(before.state.stock[id]-1);expect(after.state.scrap).toBe(before.state.scrap+1);expect(after.state.owned).toEqual(before.state.owned);expect(after.saves-before.saves).toBe(1);await expect(page.locator('#btnScrap')).toBeDisabled();
 await page.evaluate(id=>{closeDraw(false);S.stock[id]=1;save();showPull(id,false);finishDraw(true);},id);const last=await observed(page);await expect(page.locator('#btnScrap')).toHaveCount(0);expect((await observed(page)).state).toEqual(last.state);await capture(info,'last-stock',{before,after,last});
});

for(const width of [390,1280]) test(`ten exact details and keyboard focus remain accessible at width ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:900});await open(page);await page.locator('#btnTen').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-draw-skip]')).toBeFocused();await page.keyboard.press('Enter');await ready(page);await expect(page.locator('.tc').first()).toBeFocused();
 const committed=await observed(page),ids=committed.presentation.results.map(card=>card.id),rows=[];
 for(const [index,id] of ids.entries()){const button=page.locator('.tc').nth(index);await button.click();await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id',id);await page.keyboard.press('Escape');await expect(button).toBeFocused();expect((await observed(page)).state).toEqual(committed.state);rows.push({index,id});}
 await shot(page,info,'ten-'+width);await page.locator('[data-draw-close]').click();await expect(page.locator('#title-workshop')).toBeFocused();await capture(info,'details-focus',{width,committed,rows,after:await observed(page)});
});

test('presentation snapshots ignore subsequent input edits and reject malformed input before replacing the active result',async({page},info)=>{
 await frozen(page);await action(page,'btnPull');const committed=await observed(page);
 const result=await page.evaluate(()=>{const data=drawResultSnapshot(['poo-270C'],[true],'single','검증');GAME_DRAW.start(data,{trigger:document.activeElement,focusReveal:false});data.cards[0].id='qp-1470';data.cards[0].isNew=false;data.state.owned={};const stable=GAME_DRAW.snapshot();let rejected=false;try{GAME_DRAW.start({...data,cards:[]},{trigger:document.activeElement});}catch(error){rejected=error instanceof TypeError;}return {stable,rejected,after:GAME_DRAW.snapshot()};});
 expect(result.rejected).toBe(true);expect(result.after).toEqual(result.stable);expect(result.after.results).toEqual([{id:'poo-270C',isNew:true}]);await page.clock.runFor(1450);expect((await observed(page)).state).toEqual(committed.state);await capture(info,'snapshot-boundary',{committed,result,after:await observed(page)});
});

test('development result retains imported QP duplicate scrap and selected detail semantics',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,'qp-owned');await page.evaluate(()=>{S.stock[QP_ID]=2;save();refresh();drawSaves=0;showPull(QP_ID,true,'선행개발');});const before=await observed(page);
 await page.locator('.draw-art').click();await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id','qp-1470');await page.keyboard.press('Escape');await page.locator('#btnScrap').click();const after=await observed(page);expect(after.state.stock['qp-1470']).toBe(1);expect(after.state.scrap).toBe(before.state.scrap+1);expect(after.saves).toBe(1);expect(after.state.owned).toEqual(before.state.owned);await capture(info,'qp-duplicate-preserved',{before,after});
});

test('development saved result plays one QP cue and never consumes or saves',async({page},info)=>{
 await frozen(page);const before=await observed(page);await page.evaluate(()=>showPull(QP_ID,true,'선행개발'));await page.clock.runFor(650);await ready(page);const after=await observed(page);expect(after.state).toEqual(before.state);expect(after.saved).toEqual(before.saved);expect(after.saves).toBe(0);expect(after.cues).toEqual(['qp.complete']);await capture(info,'development-one-cue',{before,after});
});
