import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,root,fixedTime} from '../helpers/paths.mjs';
import {capture,state,mirror,settings,sha} from '../helpers/app.mjs';
const fixture=JSON.parse(await fs.readFile(root+'/tests/fixtures/mid-progress.json','utf8'));
const gameKey='sgg_game_save_v1';
const education={steelgrade_gacha_v1:JSON.stringify({...fixture.state,scrap:777}),sgg_toon_seen:'s02',sgg_install_dismissed:'1',sgg_installed:'1'};
const preferences=JSON.stringify({music:false,representative:'poo-270C'});

export async function launch(page,scenario={}){
  await page.clock.install({time:new Date(fixedTime)});
  await page.route('**/__edition_seed__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Owned storage fixture</title>'}));
  await page.goto(appURL+'/__edition_seed__');
  await page.evaluate(async ({education,preferences,scenario})=>{
    for(const [key,value] of Object.entries(education))localStorage.setItem(key,value);
    localStorage.setItem('sgg_game_preferences_v1',preferences);
    localStorage.setItem('sgg_game_toon_seen','s00');
    localStorage.setItem('sgg_game_install_dismissed','1');
    localStorage.setItem('sgg_game_installed','1');
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
    for(const method of ['put','delete','clear']){
      const original=IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method]=function(...args){storageAudit.push({method,key:this.transaction.db.name,entryKey:method==='put'?args[1]:args[0]});return original.apply(this,args);};
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
export async function record(page,info,name){
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
  expect(actual.game.toon).toBe('s00');
  expect(actual.game.dismissed).toBe('1');
  expect(actual.game.installed).toBe('1');
  await capture(info,name,actual);
  const screenshot=info.outputPath(name+'.png');await page.screenshot({path:screenshot,animations:'disabled'});await info.attach(name,{path:screenshot,contentType:'image/png'});
  return actual;
}
