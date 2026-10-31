import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {root,educationRoot,fixedTime} from './helpers/paths.mjs';
import {capture,state,mirror} from './helpers/app.mjs';
import {startPwaSite} from './helpers/pwa-site.mjs';
import {storageEvidence} from './helpers/storage-evidence.mjs';
import {observeFinalDocuments} from '../tools/final-evidence.mjs';
observeFinalDocuments(test,root,{kind:'education-reference'});
storageEvidence(test);
test.use({serviceWorkers:'allow'});
test.describe.configure({mode:'serial'});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(!educationRoot)throw Error('Education PWA reference requires SGG_EDUCATION_ROOT');
const manifest=JSON.parse(await fs.readFile(`${educationRoot}/docs/design/asset-manifest.json`,'utf8'));
test.beforeEach(async({},info)=>{info.annotations.push({type:'education-reference',description:'Original v72 to preserved education-v1; current game immutable PWA is covered by game/edition-e2e.spec.mjs and game/pwa.spec.mjs'});});
const comicPaths=Object.values(manifest).find(value=>value && value.comics).comics.map(row=>row.path);
const readEpisodes={'mid-progress':[0],'qp-owned':[1],'equipped-items':[2],'all-cars':[0,1,2]};
async function offlineMode(page,context,site,info,value){
  if(info.project.name==='webkit')site.setTransportOffline(value);else await context.setOffline(value);
  await capture(info,`network-${value?'unavailable':'restored'}`,{mechanism:info.project.name==='webkit'?'origin transport unavailable':'browser context offline',requested:value,navigatorOnline:await page.evaluate(()=>navigator.onLine).catch(()=>null)});
}
async function armUpgrade(page){
  await page.evaluate(()=>{
    const previous=navigator.serviceWorker.controller;
    window.upgradeEvent=new Promise((resolve,reject)=>{
      let next;const clean=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);next?.removeEventListener('statechange',activated);};
      const activated=()=>{if(next.state==='activated'){clean();resolve({controllerChanged:next!==previous,state:next.state});}};
      const changed=()=>{next=navigator.serviceWorker.controller;if(!next||next===previous)return;next.addEventListener('statechange',activated);activated();};
      const timer=setTimeout(()=>{clean();reject(Error('replacement controller activation timeout'));},15000);
      navigator.serviceWorker.addEventListener('controllerchange',changed);
    });window.upgradeEvent.catch(()=>{});
  });
}
async function controlled(page,info){
  const capability=await page.evaluate(async()=>{
    const result={secure:isSecureContext,serviceWorker:'serviceWorker' in navigator,cacheStorage:'caches' in window,userAgent:navigator.userAgent,ready:false};let timer,listener,registration,expired=false;
    try{
      if(!result.serviceWorker)throw Error('serviceWorker unavailable');
      await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('entire SW readiness timeout'));},10000);}),
        (async()=>{registration=await navigator.serviceWorker.ready;if(expired)return;if(!navigator.serviceWorker.controller)await new Promise(resolve=>{listener=resolve;navigator.serviceWorker.addEventListener('controllerchange',listener,{once:true});});})()]);
      result.ready=true;
    }catch(error){result.error=error.message;}
    finally{clearTimeout(timer);if(listener)navigator.serviceWorker.removeEventListener('controllerchange',listener);}
    result.active=registration?.active?.state||null;result.controller=navigator.serviceWorker?.controller?.scriptURL||null;return result;
  });
  await capture(info,'sw-capability',{project:info.project.name,...capability});expect(capability.ready).toBe(true);expect(capability.controller).toBeTruthy();
}
const upgrades=['mid-progress','qp-owned','equipped-items','all-cars'].map(fixture=>({fixture,failMigration:false}));
upgrades.push({fixture:'mid-progress',failMigration:true});
for(const {fixture,failMigration} of upgrades) test(`@${failMigration?'pwa-negative':'pwa-upgrade-happy'} same-origin v72 ${fixture} ${failMigration?'migration quota failure':'and read comics'}`,async({page,context},info)=>{
  const site=await startPwaSite(info,{edition:'education',source:educationRoot});
  try{
    const saved=JSON.parse(await fs.readFile(`${root}/tests/fixtures/${fixture}.json`,'utf8'));
    await page.clock.setFixedTime(new Date(fixedTime));
    await page.addInitScript(saved=>{
      if(!sessionStorage.getItem('upgrade-seeded')){
        localStorage.setItem('steelgrade_gacha_v1',JSON.stringify(saved.state));
        sessionStorage.setItem('upgrade-seeded','1');
      }
    },saved);
    const oldResponse=await page.goto(site.url);
    expect(hash(await oldResponse.body())).toBe(site.old.indexSHA);
    await controlled(page,info);
    await page.waitForFunction(()=>typeof S!=='undefined' && !saveHold);
    const readURLs=[];
    for(const episode of readEpisodes[fixture]){
      await page.evaluate(episode=>openToonView(episode),episode);
      const pictures=page.locator('#toonView img');expect(await pictures.count()).toBeGreaterThan(0);
      for(const picture of await pictures.all()){
        await picture.scrollIntoViewIfNeeded();await expect.poll(()=>picture.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
      }
      readURLs.push(...await pictures.evaluateAll(images=>images.map(img=>img.src)));
      await page.evaluate(()=>closeToonView());
    }
    await expect.poll(()=>page.evaluate(async urls=>{
      const cache=await caches.open('steel-grade-gacha-v72');return Promise.all(urls.map(url=>cache.match(url).then(Boolean)));
    },readURLs)).toEqual(readURLs.map(()=>true));
    const before=await state(page),seen=await page.evaluate(()=>localStorage.getItem('sgg_toon_seen'));
    const beforeStorage=await page.evaluate(()=>localStorage.getItem(KEY));
    await expect.poll(()=>mirror(page)).toEqual(before);
    const oldKeys=await page.evaluate(async()=>{
      const cache=await caches.open('steel-grade-gacha-v72');
      const unrelated=await caches.open('unrelated-retain');await unrelated.put('/foreign-marker',new Response('keep'));
      return (await cache.keys()).map(req=>req.url);
    });
    const allowlist=comicPaths.map(path=>`${site.url}/${path}`);
    expect(allowlist).toHaveLength(18);
    const comics=oldKeys.filter(url=>allowlist.includes(url));
    expect(comics.length).toBeGreaterThan(0);
    const workerSource=await fs.readFile(`${educationRoot}/sw.js`,'utf8');
    expect(JSON.parse(workerSource.match(/var COMICS = (\[[\s\S]*?\]);/)[1]).sort()).toEqual([...comicPaths].sort());
    await armUpgrade(page);
    const current=await site.publishCurrent(failMigration);
    await capture(info,'controller-change',await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();return window.upgradeEvent;}));
    const keys=await page.evaluate(()=>caches.keys());
    await capture(info,'activation',await page.evaluate(async()=>({registration:(await navigator.serviceWorker.getRegistration())?.active?.state,caches:await Promise.all((await caches.keys()).map(async key=>({key,entries:await Promise.all((await (await caches.open(key)).keys()).map(async request=>{const response=await (await caches.open(key)).match(request);return{url:request.url,status:response.status,type:response.type,headers:[...response.headers]};}))})))})));
    expect(keys).toContain('unrelated-retain');
    if(failMigration)expect(keys).toContain('steel-grade-gacha-v72');else expect(keys).not.toContain('steel-grade-gacha-v72');
    const migrated=await page.evaluate(async allowlist=>{
      const current=(await caches.keys()).find(key=>key.startsWith('steel-grade-gacha-') && key!=='steel-grade-gacha-v72');
      return (await (await caches.open(current)).keys()).map(request=>request.url).filter(url=>allowlist.includes(url));
    },allowlist);
    expect(migrated.sort()).toEqual(failMigration?[]:[...comics].sort());
    expect(await page.evaluate(async()=>await (await (await caches.open('unrelated-retain')).match('/foreign-marker')).text())).toBe('keep');
    await offlineMode(page,context,site,info,true);
    const response=await page.reload();
    expect(hash(await response.body())).toBe(current.indexSHA);
    await page.waitForFunction(()=>typeof S!=='undefined' && !saveHold);
    expect(await state(page)).toEqual(before);expect(await mirror(page)).toEqual(before);
    expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(beforeStorage);
    expect(await page.evaluate(()=>localStorage.getItem('sgg_toon_seen'))).toBe(seen);
    const unread=readEpisodes[fixture].length<3?allowlist.find(url=>!comics.includes(url)):null;
    if(readEpisodes[fixture].length<3)expect(unread).toBeTruthy();
    const uncached=unread?await page.evaluate(async url=>{
      const keys=await caches.keys();
      const cached=(await Promise.all(keys.map(key=>caches.open(key).then(cache=>cache.match(url))))).some(Boolean);
      try{const response=await fetch(url);return {cached,ok:response.ok,type:response.headers.get('content-type')};}
      catch{return {cached,failed:true};}
    },unread):null;
    if(uncached){expect(uncached.cached).toBe(false);expect(uncached.failed).toBe(true);}
    expect(await page.evaluate(()=>localStorage.getItem('sgg_toon_seen'))).toBe(seen);
    const decoded=await page.evaluate(async urls=>Promise.all(urls.map(url=>new Promise(resolve=>{
      const image=new Image();image.onload=()=>resolve({url,width:image.naturalWidth});image.onerror=()=>resolve({url,width:0});image.src=url;
    }))),comics);
    for(const row of decoded)expect(row.width).toBeGreaterThan(0);
    expect(await page.evaluate(async()=>{
      const image=new Image();image.src='src/uiimg/workshop.webp';await image.decode();return image.naturalWidth;
    })).toBeGreaterThan(0);
    for(const width of [390,1280]){
      await page.setViewportSize({width,height:width===390?844:900});
      const path=info.outputPath(`offline-${width}.png`);await page.screenshot({path,animations:'disabled'});await info.attach(`offline-${width}`,{path,contentType:'image/png'});
    }
    await capture(info,failMigration?'failures':'restore',{fixture,failMigration,episodes:readEpisodes[fixture],before,after:await state(page),stateSHA:hash(JSON.stringify(before)),localStorageSHA:hash(beforeStorage),mirrorSHA:hash(JSON.stringify(await mirror(page))),seen,old:site.old,current,allowlist,comics,migrated,decoded,keys,unread,uncached});
  }finally{await context.setOffline(false);await site.close();}
});

test('@pwa-negative first visit offline does not create progress',async({page,context},info)=>{
  const site=await startPwaSite(info,{edition:'education',source:educationRoot});
  try{
    const current=await site.publishCurrent();
    await offlineMode(page,context,site,info,true);
    await expect(page.goto(site.url)).rejects.toThrow();
    await offlineMode(page,context,site,info,false);const response=await page.goto(site.url);expect(hash(await response.body())).toBe(current.indexSHA);await controlled(page,info);
    expect(await page.evaluate(()=>Object.keys(S.owned))).toEqual([]);
    await capture(info,'failures',{kind:'first-visit-offline',current,servedSHA:hash(await response.body()),owned:await page.evaluate(()=>Object.keys(S.owned))});
  }finally{await context.setOffline(false);await site.close();}
});

for(const failMigration of [false,true])test(`@pwa-negative mixed old comic responses ${failMigration?'failed copy retention':'normal migration'} and fresh HTML recovery`,async({page,context},info)=>{
  const site=await startPwaSite(info,{edition:'education',source:educationRoot});
  try{
    const fixture=JSON.parse(await fs.readFile(`${root}/tests/fixtures/mid-progress.json`,'utf8'));await page.clock.setFixedTime(new Date(fixedTime));
    await page.addInitScript(fixture=>{if(!sessionStorage.getItem('mixed-seeded')){localStorage.setItem('steelgrade_gacha_v1',JSON.stringify(fixture.state));sessionStorage.setItem('mixed-seeded','1');}},fixture);
    await page.goto(site.url);await controlled(page,info);await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
    const paths=[comicPaths[0],comicPaths[1],comicPaths[2]],before=await state(page),seen=await page.evaluate(()=>localStorage.getItem(TOON_SEEN));
    await expect.poll(()=>mirror(page)).toEqual(before);const saved=await page.evaluate(()=>localStorage.getItem(KEY));
    await page.evaluate(async paths=>{
      const cache=await caches.open('steel-grade-gacha-v72'),valid=await fetch(paths[0]);await cache.put(paths[0],valid);
      await cache.put(paths[1],new Response('<html>old error</html>',{status:200,headers:{'content-type':'text/html'}}));
      await cache.put(paths[2],new Response('old failure',{status:503,headers:{'content-type':'image/webp'}}));
    },paths);
    await armUpgrade(page);const current=await site.publishCurrent(failMigration);
    await capture(info,'controller-change',await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();return window.upgradeEvent;}));
    await offlineMode(page,context,site,info,true);const response=await page.reload();expect(hash(await response.body())).toBe(current.indexSHA);await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
    const observations=await page.evaluate(async paths=>{
      const results=[];for(const url of paths){try{const response=await fetch(url);results.push({url,ok:response.ok,type:response.headers.get('content-type')});}catch{results.push({url,failed:true});}}
      return {results,keys:await caches.keys()};
    },paths);
    expect(observations.results[0].ok).toBe(true);expect(observations.results[0].type).toMatch(/^image\//);expect(observations.results.slice(1).every(row=>row.failed)).toBe(true);
    expect(observations.keys.includes('steel-grade-gacha-v72')).toBe(failMigration);
    await offlineMode(page,context,site,info,false);
    site.setResponse('/'+paths[1],{status:200,contentType:'text/html',body:'<html>fresh server error</html>'});
    const poison=await page.evaluate(async url=>{try{await fetch(url);return {failed:false};}catch{return {failed:true};}},paths[1]);expect(poison.failed).toBe(true);
    const currentCached=await page.evaluate(async url=>{const key=(await caches.keys()).find(k=>k.startsWith('steel-grade-gacha-')&&k!=='steel-grade-gacha-v72');return !!(await (await caches.open(key)).match(url));},paths[1]);expect(currentCached).toBe(false);
    site.setResponse('/'+paths[1],null);
    const recovery=await page.evaluate(async paths=>Promise.all(paths.map(async url=>{const response=await fetch(url);const blob=await response.blob(),image=new Image(),objectURL=URL.createObjectURL(blob);try{image.src=objectURL;await image.decode();return {url,type:blob.type,width:image.naturalWidth};}finally{URL.revokeObjectURL(objectURL);}})),paths.slice(1));
    for(const row of recovery){expect(row.type).toMatch(/^image\//);expect(row.width).toBeGreaterThan(0);}
    expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(saved);expect(await mirror(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe(seen);
    await capture(info,'mixed-responses',{failMigration,current,paths,observations,poison,currentCached,recovery,stateSHA:hash(JSON.stringify(before)),localSHA:hash(saved),mirrorSHA:hash(JSON.stringify(await mirror(page))),seen});
  }finally{await context.setOffline(false);await site.close();}
});

test('@pwa-negative uncached image fails without HTML or read credit',async({page,context},info)=>{
  const site=await startPwaSite(info,{edition:'education',source:educationRoot});
  try{
    await site.publishCurrent();await page.goto(site.url);await controlled(page,info);
    await page.waitForFunction(()=>typeof S!=='undefined' && !saveHold);
    const before=await state(page),seen=await page.evaluate(()=>localStorage.getItem('sgg_toon_seen'));
    const missing=await page.evaluate(async()=>{const response=await fetch('webtoon/never-existed.webp');return {status:response.status,type:response.headers.get('content-type')};});
    expect(missing.status).toBe(404);
    expect(await page.evaluate(async()=>!!(await caches.match(new URL('webtoon/never-existed.webp',location.href))))).toBe(false);
    await offlineMode(page,context,site,info,true);
    const failed=await page.evaluate(async()=>{
      try{const response=await fetch('webtoon/ep02-8.webp');return {failed:false,type:response.headers.get('content-type')};}
      catch{return {failed:true};}
    });
    expect(failed.failed).toBe(true);expect(await state(page)).toEqual(before);
    expect(await page.evaluate(()=>localStorage.getItem('sgg_toon_seen'))).toBe(seen);
    await capture(info,'failures',{before,after:await state(page),seen,missing,failed});
  }finally{await context.setOffline(false);await site.close();}
});
