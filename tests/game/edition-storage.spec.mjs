import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,root,fixedTime} from '../helpers/paths.mjs';
import {capture,state,mirror,settings,sha} from '../helpers/app.mjs';
import {installFixture} from './namespaces.mjs';
const fixture=JSON.parse(await fs.readFile(root+'/tests/fixtures/mid-progress.json','utf8'));
const gameKey='sgg_game_save_v1';
const education={steelgrade_gacha_v1:JSON.stringify({...fixture.state,scrap:777}),sgg_toon_seen:'s02',sgg_install_dismissed:'1',sgg_installed:'1'};
const preferences=JSON.stringify({music:false,representative:'poo-270C'});

async function launch(page,scenario={}){
  await page.clock.install({time:new Date(fixedTime)});
  await page.route('**/__edition_seed__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Owned storage fixture</title>'}));
  await page.goto(appURL+'/__edition_seed__');
  await page.evaluate(async ({education,preferences,scenario})=>{
    for(const [key,value] of Object.entries(education))localStorage.setItem(key,value);
    localStorage.setItem('sgg_game_preferences_v1',preferences);
    localStorage.setItem('sgg_game_toon_seen','s00');
    if(scenario.local!==undefined)localStorage.setItem('sgg_game_save_v1',scenario.local);
    for(const [name,key,value] of [['steelgrade_gacha','steelgrade_gacha_v1',education.steelgrade_gacha_v1],['sgg_game','sgg_game_save_v1',scenario.mirror]]){
      const db=await new Promise((resolve,reject)=>{const rq=indexedDB.open(name,1);rq.onupgradeneeded=()=>rq.result.createObjectStore('save');rq.onsuccess=()=>resolve(rq.result);rq.onerror=()=>reject(rq.error);});
      if(value!==undefined)await new Promise((resolve,reject)=>{const tx=db.transaction('save','readwrite');tx.objectStore('save').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      db.close();
    }
  },{education,preferences,scenario});
  await page.addInitScript(({failure,gameKey})=>{
    Math.random=()=>0;window.storageAudit=[];window.rawStorage={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem,open:indexedDB.open.bind(indexedDB)};
    for(const method of ['getItem','setItem','removeItem']){
      const original=Storage.prototype[method];
      Storage.prototype[method]=function(key,...args){storageAudit.push({method,key});if(key===gameKey && ((failure==='denied-read'&&method==='getItem')||(failure==='denied-write'&&method==='setItem')))throw new DOMException('owned test denial','SecurityError');return original.call(this,key,...args);};
    }
    indexedDB.open=function(name,...args){
      storageAudit.push({method:'open',key:name});
      if(name==='sgg_game'&&failure==='timeout')return {};
      const rq=rawStorage.open(name,...args);
      if(name==='sgg_game'&&failure==='late')Object.defineProperty(rq,'onsuccess',{set(callback){rq.addEventListener('success',()=>setTimeout(()=>callback.call(rq),3100));}});
      return rq;
    };
  },{failure:scenario.failure,gameKey});
  const response=await page.goto(appURL);
  expect(sha(await response.body())).toBe(sha(await fs.readFile(root+'/index.html')));
  await page.waitForFunction(()=>typeof S!=='undefined');
  if(scenario.failure==='timeout'||scenario.failure==='late')await page.clock.runFor(2600);
  await page.waitForFunction(()=>!saveHold);
  await expect(page.locator('#btnSettings')).toBeVisible();
}
async function record(page,info,name){
  const actual=await page.evaluate(async education=>{
    const audit=storageAudit.slice();
    const local=Object.fromEntries(Object.keys(education).map(key=>[key,rawStorage.get.call(localStorage,key)]));
    const eduDB=await new Promise((resolve,reject)=>{const rq=rawStorage.open('steelgrade_gacha',1);rq.onsuccess=()=>resolve(rq.result);rq.onerror=()=>reject(rq.error);});
    const entries=await new Promise((resolve,reject)=>{const store=eduDB.transaction('save','readonly').objectStore('save');const rq=store.openCursor();const entries=[];rq.onsuccess=()=>{const c=rq.result;if(c){entries.push([c.key,c.value]);c.continue();}else resolve(entries);};rq.onerror=()=>reject(rq.error);});eduDB.close();
    return {audit,education:{local,entries},game:{save:rawStorage.get.call(localStorage,KEY),toon:rawStorage.get.call(localStorage,TOON_SEEN),preferences:rawStorage.get.call(localStorage,GAME_EDITION.preferences),dismissed:rawStorage.get.call(localStorage,GAME_EDITION.installDismissed),installed:rawStorage.get.call(localStorage,GAME_EDITION.installed)},state:JSON.parse(JSON.stringify(S)),loadFailed,saveHold,storeWarn};
  },education);
  expect(actual.education.local).toEqual(education);
  expect(actual.education.entries).toEqual([['steelgrade_gacha_v1',education.steelgrade_gacha_v1]]);
  expect(actual.audit.filter(row=>Object.hasOwn(education,row.key)||row.key==='steelgrade_gacha')).toEqual([]);
  expect(actual.game.preferences).toBe(preferences);
  await capture(info,name,actual);
  const screenshot=info.outputPath(name+'.png');await page.screenshot({path:screenshot,animations:'disabled'});await info.attach(name,{path:screenshot,contentType:'image/png'});
  return actual;
}
async function warningBackup(page){
  await expect(page.locator('#warnGo')).toBeVisible();await page.locator('#warnGo').click();
  await expect(page.locator('#backupModal')).toBeVisible();
  const code=await page.locator('#bkOut').inputValue();expect(await page.evaluate(code=>Boolean(readCode(code)),code)).toBe(true);
}

test('starts new game without reading or copying education progress',async({page},info)=>{
  // Given education sentinels and no game progress; when the real app boots.
  await launch(page);
  // Then only game state is initialized.
  expect((await state(page)).owned).toEqual({});expect((await state(page)).scrap).toBe(0);
  expect(await mirror(page)).toEqual(await state(page));
  expect(await page.evaluate(()=>({key:KEY,toon:TOON_SEEN,database:idbConn.name,preferences:GAME_EDITION.preferences}))).toEqual({key:gameKey,toon:'sgg_game_toon_seen',database:'sgg_game',preferences:'sgg_game_preferences_v1'});
  await record(page,info,'happy-new');
});
for(const source of ['local','mirror'])test(`loads existing game ${source} without touching education`,async({page},info)=>{
  // Given real persisted game progress; when the page starts.
  await launch(page,{[source]:JSON.stringify(fixture.state)});
  // Then local load or IDB recovery preserves every normalized economic field.
  const actual=await state(page);expect(actual).toEqual({...fixture.state,orderDay:'2026-11-1',orderKey:'arrow'});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(actual);
  await expect.poll(()=>mirror(page)).toEqual(actual);await record(page,info,'happy-'+source);
});
test('local progress retains startup priority over a different mirror',async({page},info)=>{
  // Given divergent real stores; when startup chooses its authoritative record.
  await launch(page,{local:JSON.stringify(fixture.state),mirror:education.steelgrade_gacha_v1});
  // Then the local game record wins and is mirrored.
  expect((await state(page)).scrap).toBe(25);await expect.poll(()=>mirror(page)).toEqual(await state(page));await record(page,info,'happy-local-priority');
});
test('UI draw saves game progress to local and IDB and survives reload',async({page},info)=>{
  // Given a new game; when the user draws through the actual control.
  await launch(page);await page.locator('#btnPull').click();
  // Then a single result is persisted, and reopening retains it.
  expect(await page.evaluate(()=>totalStock())).toBe(1);const saved=await state(page);
  await expect.poll(()=>mirror(page)).toEqual(saved);await page.reload();await page.waitForFunction(()=>!saveHold);
  expect(await state(page)).toEqual(saved);await record(page,info,'happy-draw-reload');
});
for(const failure of ['corrupt-local','corrupt-mirror','denied-read','denied-write','timeout'])test(`preserves education and usable UI on ${failure}`,async({page},info)=>{
  // Given the named failure at the storage boundary; when startup completes.
  const scenario={failure};if(failure==='corrupt-local')Object.assign(scenario,{local:'{broken',mirror:JSON.stringify(fixture.state)});if(failure==='corrupt-mirror')scenario.mirror='{broken';if(failure==='denied-read')scenario.local=JSON.stringify(fixture.state);
  await launch(page,scenario);
  // Then progress is never imported from education and the existing failure route remains usable.
  expect((await state(page)).owned).toEqual({});
  if(['corrupt-local','denied-read','denied-write'].includes(failure))await warningBackup(page);
  else {await settings(page);await page.locator('#btnBackup').click();await expect(page.locator('#bkOut')).toBeVisible();}
  const actual=await record(page,info,'negative-'+failure);
  if(failure==='corrupt-local'){expect(actual.loadFailed).toBe(true);expect(actual.game.save).toBe('{broken');}
  if(failure==='denied-read'){expect(actual.loadFailed).toBe(true);expect(actual.game.save).toBe(JSON.stringify(fixture.state));}
  if(failure==='denied-write'){expect(actual.storeWarn).not.toBe('');expect(actual.game.save).toBeNull();}
  expect(actual.saveHold).toBe(false);
});
test('late IDB recovery cannot replace progress after startup timeout',async({page},info)=>{
  // Given delayed native IDB with an older record; when the user draws after timeout.
  await launch(page,{failure:'late',mirror:JSON.stringify(fixture.state)});await page.locator('#btnPull').click();const drawn=await state(page);
  await page.clock.runFor(4000);await page.waitForFunction(()=>idbState===2);
  // Then completion of the obsolete recovery request cannot roll the live game back.
  await capture(info,'late-observation',{drawn,after:await state(page)});await expect.poll(()=>state(page)).toEqual(drawn);await expect.poll(()=>mirror(page)).toEqual(drawn);await record(page,info,'negative-late-idb');
});
test('reset first click and five-second expiry preserve progress',async({page},info)=>{
  // Given a populated game; when confirmation is abandoned and expires.
  await launch(page,{local:JSON.stringify(fixture.state)});const before=await state(page);const raw=await page.evaluate(()=>localStorage.getItem(KEY));
  await settings(page);await page.locator('#btnReset').click();expect(await state(page)).toEqual(before);await page.keyboard.press('Escape');await page.clock.runFor(5001);
  // Then no progress or auxiliary preference was removed.
  await settings(page);await expect(page.locator('#btnReset')).not.toHaveClass(/arm/);expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(raw);await record(page,info,'negative-reset-cancel');
});
test('confirmed reset clears only game economy and persists canonical state',async({page},info)=>{
  // Given populated game progress; when the user confirms within the guard window.
  await launch(page,{local:JSON.stringify(fixture.state)});await settings(page);await page.locator('#btnReset').click();await page.locator('#btnReset').click();
  // Then the canonical empty state is saved while read/preferences and education remain intact.
  const reset=await state(page);expect(reset.owned).toEqual({});expect(reset.stock).toEqual({});expect(reset.parts).toEqual({});expect(reset.cars).toEqual([]);expect(reset.pullUsed).toBe(0);expect(reset.qpSeen).toBe(0);expect(reset.noticeSeen).toBe('');
  await expect.poll(()=>mirror(page)).toEqual(reset);await page.reload();await page.waitForFunction(()=>!saveHold);expect(await state(page)).toEqual(reset);const actual=await record(page,info,'happy-reset');expect(actual.game.toon).toBe('s00');
});
test('toon mark and install dismissal use independent game flags',async({page},info)=>{
  // Given educational installed/dismissed flags; when users read and dismiss the game guide.
  await launch(page);await page.locator('.destination-nav a[href="#research"]').click();await page.locator('#btnToon').click();await page.locator('#toonBox [data-i="1"]').click();
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await settings(page);await expect(page.locator('#btnInstall')).toBeVisible();await page.locator('#btnInstall').click();await page.locator('#installX').click();
  // Then each action persists exclusively in the game namespace.
  const actual=await record(page,info,'happy-toon-install');expect(actual.game.toon).toBe('ep01');expect(actual.game.dismissed).toBe('1');
});
test('installation event stores independent game identity',async({page},info)=>{
  // Given an uninstalled game; when the browser emits its installation lifecycle event.
  await launch(page);await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  // Then only the game installed flag controls the game's install button.
  await settings(page);await expect(page.locator('#btnInstall')).toBeHidden();const actual=await record(page,info,'happy-installed');expect(actual.game.installed).toBe('1');
});
test('served manifest and head expose game install identity',async({page},info)=>{
  // Given the real built page; when its linked manifest is fetched.
  await launch(page);const manifest=await page.evaluate(async()=>{const r=await fetch(document.querySelector('link[rel=manifest]').href);return r.json();});
  // Then explicit identity, relative launch/scope and approved colors are observable.
  expect(manifest).toMatchObject({id:'./?edition=game',name:'스틸 그레이드 가챠 · 게임',short_name:'스틸가챠 게임',scope:'./',start_url:'./',background_color:'#161B20',theme_color:'#78486E'});
  await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content',manifest.theme_color);await expect(page.locator('meta[name=apple-mobile-web-app-title]')).toHaveAttribute('content',manifest.short_name);await capture(info,'manifest',manifest);await record(page,info,'happy-identity');
});
test('invalid education fixture is rejected before any game write',async({page},info)=>{
  // Given an education-tagged fixture in the game app; when the fixture adapter is invoked.
  await launch(page,{local:JSON.stringify(fixture.state)});const before=await state(page);const saved=await page.evaluate(()=>localStorage.getItem(KEY));
  await expect(installFixture(page,{...fixture,edition:'education'})).rejects.toThrow(/namespace mismatch/);
  // Then mismatched test data fails instead of silently creating misleading success.
  expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(saved);await record(page,info,'negative-fixture');
});

test('backup diagnostics write and remove game-only probe keys',async({page},info)=>{
  // Given healthy real storage; when the user opens the diagnostic dialog.
  await launch(page,{local:JSON.stringify(fixture.state)});await settings(page);await page.locator('#btnBackup').click();
  // Then both probes complete and their temporary keys are removed.
  await expect(page.locator('#bkDiag [data-storage-check=primary]')).toHaveAttribute('data-state','available');await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state','available');await expect(page.locator('#bkDiag')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem(KEY+'_probe'))).toBeNull();
  const keys=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const rq=idbConn.transaction('save','readonly').objectStore('save').getAllKeys();rq.onsuccess=()=>resolve(rq.result);rq.onerror=()=>reject(rq.error);}));
  await expect.poll(keys).toEqual([gameKey]);const actual=await record(page,info,'happy-diagnostics');expect(actual.audit).toContainEqual({method:'setItem',key:gameKey+'_probe'});expect(actual.audit).toContainEqual({method:'removeItem',key:gameKey+'_probe'});
});
test('IDB recovery retains memory progress and backup access when local write is denied',async({page},info)=>{
  // Given a real game mirror and denied local writes; when recovery completes.
  await launch(page,{mirror:JSON.stringify(fixture.state),failure:'denied-write'});
  // Then the exact normalized game progress is visible with an explicit warning.
  expect(await state(page)).toEqual({...fixture.state,orderDay:'2026-11-1',orderKey:'arrow'});await expect(page.locator('#toast')).toContainText('기기 저장은 확인하지 못했습니다');await warningBackup(page);
  const actual=await record(page,info,'negative-recovered-memory');expect(actual.game.save).toBeNull();expect(actual.storeWarn).not.toBe('');
});
