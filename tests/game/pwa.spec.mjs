import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './build-fixture.mjs';
import {buildGame} from '../../tools/game-build/build.mjs';
import {verifyPackage} from '../../tools/game-build/package.mjs';
import {sha} from '../../tools/game-build/io.mjs';
import {startPwaSite} from '../helpers/pwa-site.mjs';
import {startStatic} from '../../tools/game-qa/server.mjs';
const root=path.resolve(import.meta.dirname,'../..'), evidence=process.env.SGG_EVIDENCE_DIR;
const prefix='sgg-game-cache-';
let packs;
test.use({serviceWorkers:'allow'});
test.describe.configure({mode:'serial'});
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-11-01T00:00:00+09:00'));});
async function record(info,name,data){const file=info.outputPath(name+'.json');await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2));await info.attach(name,{path:file,contentType:'application/json'});}
async function ready(page){await page.waitForFunction(()=>!!navigator.serviceWorker.controller && typeof S!=='undefined' && !saveHold);}
async function release(page){return page.getAttribute('body','data-game-release');}
async function cachesOf(page){return page.evaluate(async()=>Promise.all((await caches.keys()).map(async name=>({name,urls:(await (await caches.open(name)).keys()).map(r=>r.url)}))));}
async function decode(page,url){return page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight};},url);}
async function publish(site,page,pkg){site.options.current=pkg;await site.publishCurrent();await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);await expect(page.locator('#gameUpdate')).toBeVisible();}
async function openSite(info){const options={edition:'game',baseline:packs[0],current:packs[1]};const site=await startPwaSite(info,options);site.options=options;return site;}
async function offline(site,value){site.setTransportOffline(value);}
test.beforeAll(async()=>{
  test.setTimeout(120000);
  const packages=path.join(evidence,'synthetic-packages'),input=path.join(process.env.TMPDIR,'pwa-input');
  await fs.writeFile(path.join(evidence,'pwa-fixture-resources.json'),JSON.stringify({status:'planned',input,packages,pid:process.pid,syntheticFixture:true},null,2));
  if(!await fs.stat(packages).then(()=>true,()=>false)){
    const manifest=await fixture(root,input);
    for(const row of manifest.optionalDerived){await fs.mkdir(path.dirname(path.join(input,row.path)),{recursive:true});await fs.copyFile(path.join(root,row.path),path.join(input,row.path));}
    await fs.mkdir(packages);
    for(let i=0;i<3;i++){
      await fs.appendFile(path.join(input,'src/game/game.css'),`\nbody{--fixture-release:${i}}`);
      const built=await buildGame({root:input,out:path.join(packages,String(i)),syntheticFixture:true});
      if(i===0){
        await fs.writeFile(path.join(input,'sw.js'),'stale GENERATED worker is not an authored input');
        await fs.writeFile(path.join(input,'unrelated-dirty-work.txt'),'preserve unrelated dirty work');
        const repeated=await buildGame({root:input,out:path.join(packages,String(i)),syntheticFixture:true});
        expect(repeated).toEqual(built);expect(await fs.readFile(path.join(input,'unrelated-dirty-work.txt'),'utf8')).toBe('preserve unrelated dirty work');
        await fs.writeFile(path.join(evidence,'determinism.json'),JSON.stringify({built,repeated,generatedWorkerIgnored:true},null,2));
      }
    }
    await fs.rm(input,{recursive:true,force:true});
  }
  packs=[];
  for(let i=0;i<3;i++){
    const base=path.join(packages,String(i)),{release,manifestPath}=await verifyPackage(base);
    expect(release.syntheticFixture).toBe(true);
    packs.push({root:base,files:[...release.files.map(row=>row.path),'game-release.json',manifestPath],release});
  }
  await fs.writeFile(path.join(evidence,'pwa-fixture-resources.json'),JSON.stringify({status:'retained-deliverable',packages,inputRemoved:!await fs.stat(input).then(()=>true,()=>false),releases:packs.map(p=>p.release.releaseId),syntheticFixture:true},null,2));
});

test('explicit idle update keeps older live documents, original comics and foreign origins intact',async({page,context,browser},info)=>{
  const site=await openSite(info),edu=await startStatic(process.env.SGG_EDUCATION_ROOT),eduContext=await browser.newContext({serviceWorkers:'allow'});
  let second,third;
  try{
    const eduPage=await eduContext.newPage();await eduPage.goto(edu.url);await eduPage.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const eduBefore=await cachesOf(eduPage);
    await page.goto(site.url);await ready(page);expect(await release(page)).toBe(packs[0].release.releaseId);
    const before=await page.evaluate(()=>({state:JSON.stringify(S),storage:localStorage.getItem(KEY)}));
    const art=packs[0].release.files.find(r=>r.classification==='optional'&&r.mime==='image/webp'&&r.path.startsWith('assets/')).path;
    const decoded=await decode(page,art);
    const comics=packs[0].release.files.filter(r=>r.path.startsWith('webtoon/'));
    await decode(page,comics[0].path);
    await page.evaluate(async paths=>{
      const foreign=await caches.open('foreign-sentinel');await foreign.put('/foreign',new Response('untouched'));
      const education=await caches.open('steel-grade-gacha-v72');await education.put('/education',new Response('untouched'));
      await education.put(paths[1],await fetch(paths[1]));
      await education.put(paths[2],new Response('<html>poison</html>',{headers:{'content-type':'text/html'}}));
    },comics.map(r=>r.path));
    await publish(site,page,packs[1]);
    await page.locator('#btnPull').click();expect(await page.evaluate(()=>drawBusy())).toBe(true);
    await page.locator('#gameUpdateButton').click();expect(await release(page)).toBe(packs[0].release.releaseId);
    await expect.poll(()=>page.evaluate(()=>drawBusy())).toBe(false);
    await page.locator('[data-draw-close]').click();
    const saved=await page.evaluate(()=>({state:JSON.stringify(S),storage:localStorage.getItem(KEY)}));
    second=await context.newPage();await second.clock.setFixedTime(new Date('2026-11-01T00:00:00+09:00'));await second.goto(site.url);await ready(second);
    await page.locator('#btnSettings').click();await page.locator('#btnBackup').click();
    await second.locator('#gameUpdateButton').click();
    await expect(second.locator('#gameUpdateText')).toContainText('다른 창');
    expect(await release(second)).toBe(packs[0].release.releaseId);
    await page.locator('#backupX').click();await page.locator('#settingsX').click();
    await second.locator('#gameUpdateButton').click();
    await expect.poll(()=>release(second)).toBe(packs[1].release.releaseId);await ready(second);
    expect(await release(page)).toBe(packs[0].release.releaseId);
    const after=await page.evaluate(()=>({state:JSON.stringify(S),storage:localStorage.getItem(KEY)}));expect(after).toEqual(saved);
    await publish(site,second,packs[2]);third=await context.newPage();await third.clock.setFixedTime(new Date('2026-11-01T00:00:00+09:00'));await third.goto(site.url);await ready(third);
    await third.locator('#gameUpdateButton').click();await expect.poll(()=>release(third)).toBe(packs[2].release.releaseId);await ready(third);
    const unseenOld=packs[0].release.files.filter(r=>r.classification==='optional'&&r.mime==='image/webp'&&r.path.startsWith('assets/'))[3].path;
    expect(await page.evaluate(async url=>!!await caches.match(url),site.url+'/'+unseenOld)).toBe(false);
    const neverCachedOldDecoded=await decode(page,unseenOld);expect(neverCachedOldDecoded.width).toBeGreaterThan(0);
    const cacheState=await cachesOf(third);
    for(const p of packs)expect(cacheState.map(c=>c.name)).toContain(prefix+p.release.releaseId);
    expect(await page.evaluate(async()=>await (await (await caches.open('foreign-sentinel')).match('/foreign')).text())).toBe('untouched');
    expect(await page.evaluate(async()=>await (await (await caches.open('steel-grade-gacha-v72')).match('/education')).text())).toBe('untouched');
    const migrated=cacheState.find(c=>c.name===prefix+packs[2].release.releaseId).urls;
    expect(migrated).toContain(site.url+'/'+comics[0].path);expect(migrated).toContain(site.url+'/'+comics[1].path);expect(migrated).not.toContain(site.url+'/'+comics[2].path);
    await offline(site,true);
    const oldDecoded=await decode(page,art);expect(oldDecoded.width).toBe(decoded.width);
    await third.reload();await ready(third);expect(await release(third)).toBe(packs[2].release.releaseId);
    const workshop=packs[2].release.files.find(r=>r.path.includes('/scene-workshop-back.')).path;expect((await decode(third,workshop)).width).toBeGreaterThan(0);
    await third.evaluate(()=>fetch('offline-proof').catch(()=>{}));
    expect(await cachesOf(eduPage)).toEqual(eduBefore);
    const hashes=[];for(const comic of comics){const bytes=await fs.readFile(path.join(packs[2].root,comic.path));expect(sha(bytes)).toBe(comic.sha256);hashes.push({path:comic.path,sha256:sha(bytes)});}expect(hashes).toHaveLength(18);
    await page.screenshot({path:info.outputPath('old-document.png')});await third.screenshot({path:info.outputPath('updated-offline.png')});
    await record(info,'release-lifecycle',{syntheticFixture:true,url:site.url,educationOrigin:edu.url,eduBefore,eduAfter:await cachesOf(eduPage),before,saved,after,oldDecoded,neverCachedOldDecoded,cacheState,comics:hashes,releases:packs.map(p=>p.release.releaseId),selectors:['#btnPull','#gameUpdateButton','#btnBackup','#backupX'],oldDocument:await release(page),newDocument:await release(third)});
  }finally{await offline(site,false);await second?.close();await third?.close();await eduContext.close();await edu.close();await site.close();}
});

for(const fault of ['quota','interruption','critical-html'])test(`failed ${fault} install preserves previous playable shell and progress`,async({page},info)=>{
  const site=await openSite(info);
  try{
    await page.goto(site.url);await ready(page);
    await page.locator('#btnPull').click();await page.locator('[data-draw-skip]').click();await page.locator('[data-draw-close]').click();
    expect(await page.evaluate(()=>Object.keys(S.owned).length)).toBe(1);
    const before=await page.evaluate(()=>({storage:localStorage.getItem(KEY),state:JSON.stringify(S)}));
    await site.publishCurrent();
    const critical=packs[1].release.files.find(r=>r.path.includes('/scene-workshop-back.')).path;
    if(fault==='critical-html')site.setResponse('/'+critical,{status:200,contentType:'text/html',body:'<html>bad asset</html>'});
    else if(fault==='interruption')site.setResponse('/'+critical,{disconnect:true});
    else{
      const original=await fs.readFile(path.join(packs[1].root,'sw.js'),'utf8');
      const injection=fault==='quota'?`\nconst put=Cache.prototype.put;Cache.prototype.put=function(key,value){if(String(key).includes('scene-workshop-back'))return Promise.reject(new DOMException('quota probe','QuotaExceededError'));return put.call(this,key,value);};`:`\nconst get=self.fetch;self.fetch=function(key,options){if(String(key).includes('scene-workshop-back'))return Promise.reject(new DOMException('interrupted probe','AbortError'));return get.call(this,key,options);};`;
      site.setResponse('/sw.js',{status:200,contentType:'text/javascript',body:original+injection});
    }
    const result=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();const worker=reg.installing;if(!worker)return {state:reg.waiting?.state||'none'};return new Promise(resolve=>{worker.addEventListener('statechange',()=>{if(['redundant','installed'].includes(worker.state))resolve({state:worker.state});});});});
    expect(result.state).toBe('redundant');
    const keys=(await cachesOf(page)).map(c=>c.name);expect(keys).toContain(prefix+packs[0].release.releaseId);expect(keys).not.toContain(prefix+packs[1].release.releaseId);
    await offline(site,true);await page.reload();await ready(page);expect(await release(page)).toBe(packs[0].release.releaseId);
    await page.evaluate(()=>fetch('offline-proof').catch(()=>{}));
    const after=await page.evaluate(()=>({storage:localStorage.getItem(KEY),state:JSON.stringify(S)}));expect(after).toEqual(before);
    const rejectedRelease=await release(page);
    await offline(site,false);
    if(fault==='interruption'){
      const repeated=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();const worker=reg.installing;return new Promise(resolve=>worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve(worker.state);}));});
      expect(repeated).toBe('redundant');expect(await release(page)).toBe(packs[0].release.releaseId);
    }
    site.setResponse('/'+critical,null);site.setResponse('/sw.js',null);
    await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
    await page.locator('#gameUpdateButton').click();await expect.poll(()=>release(page)).toBe(packs[1].release.releaseId);await ready(page);
    expect(await page.evaluate(()=>({storage:localStorage.getItem(KEY),state:JSON.stringify(S)}))).toEqual(before);
    await record(info,'failed-install',{fault,result,before,after,keys,rejectedRelease,resumedRelease:await release(page),injectedAt:critical,repeatedInterruptions:fault==='interruption'?2:0});
  }finally{await offline(site,false);await site.close();}
});

test('unseen art retry, HTML/hash poison and audio failures never become cached HTML',async({page},info)=>{
  const site=await openSite(info);
  try{
    await page.goto(site.url);await ready(page);
    const rows=packs[0].release.files.filter(r=>r.path.startsWith('assets/')&&r.classification==='optional');
    const art=rows.filter(r=>r.mime==='image/webp').slice(0,4),audio=rows.find(r=>r.mime==='audio/wav');
    const results=[];
    for(const [i,row] of [...art.slice(0,2),audio].entries()){
      site.setResponse('/'+row.path,{status:i===2?404:200,contentType:i===1?row.mime:'text/html',body:i===1?'wrong hash':'<html><script>window.injectedPwa=true</script></html>'});
      const result=await page.evaluate(async url=>{try{await fetch(url);return {failed:false};}catch{return {failed:true};}},row.path);expect(result.failed).toBe(true);
      expect(await page.evaluate(async url=>!!await caches.match(url),site.url+'/'+row.path)).toBe(false);results.push({row,result});
      site.setResponse('/'+row.path,null);
    }
    site.setResponse('/'+audio.path,{status:200,contentType:'text/html',body:'<html>audio poison</html>'});
    expect(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},audio.path)).toBe(true);
    site.setResponse('/'+audio.path,null);expect(await page.evaluate(()=>!!window.injectedPwa)).toBe(false);
    // A stale/corrupt cached response is revalidated before use and repaired from the network.
    await page.evaluate(async ({url,name})=>{await (await caches.open(name)).put(url,new Response('stale',{headers:{'content-type':'image/webp'}}));},{url:site.url+'/'+art[0].path,name:prefix+packs[0].release.releaseId});
    const repaired=await decode(page,art[0].path);expect(repaired.width).toBeGreaterThan(0);
    await offline(site,true);
    await page.evaluate(url=>{const img=new Image();img.id='unseen-art';img.alt='미열람 소재';img.src=url;const host=document.createElement('button');host.type='button';host.setAttribute('aria-label','소재 상세');host.onclick=()=>{window.unwantedDetails=true;};host.append(img);document.body.append(host);},art[2].path);
    await expect(page.locator('.game-asset-fallback')).toContainText('미열람 소재');
    expect(await page.locator('button button').count()).toBe(0);
    expect(await page.locator('#unseen-art').evaluate(img=>img.naturalWidth)).toBe(0);
    const silent=await page.evaluate(url=>new Promise((resolve,reject)=>{const audio=new Audio();const timer=setTimeout(()=>reject(Error('media failure event missing')),5000);audio.onerror=()=>{clearTimeout(timer);resolve({paused:audio.paused,readyState:audio.readyState,error:audio.error.code});};audio.src=url;audio.load();}),audio.path);expect(silent.paused).toBe(true);expect(silent.readyState).toBe(0);expect(silent.error).toBeGreaterThan(0);
    await page.screenshot({path:info.outputPath('optional-fallback.png')});
    await offline(site,false);await page.getByRole('button',{name:'그림 다시 불러오기'}).focus();await page.getByRole('button',{name:'그림 다시 불러오기'}).press('Enter');
    await expect.poll(()=>page.locator('#unseen-art').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    expect(await page.locator('.game-asset-fallback').count()).toBe(0);expect(await page.evaluate(()=>!!window.unwantedDetails)).toBe(false);
    await expect(page.getByRole('button',{name:'소재 상세',exact:true})).toBeFocused();
    const keyboardFocus=await page.evaluate(()=>document.activeElement.getAttribute('aria-label'));
    await offline(site,true);
    await page.evaluate(url=>{const host=document.createElement('button');host.type='button';host.setAttribute('aria-label','포인터 소재 상세');host.onclick=()=>{window.unwantedDetails=true;};const image=new Image();image.id='pointer-art';image.alt='포인터 재시도 소재';image.src=url;host.append(image);document.body.append(host);},art[3].path);
    await expect(page.locator('.game-asset-fallback')).toContainText('포인터 재시도 소재');
    await offline(site,false);await page.getByRole('button',{name:'그림 다시 불러오기'}).click();
    await expect.poll(()=>page.locator('#pointer-art').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>!!window.unwantedDetails)).toBe(false);
    const missing=await page.evaluate(async()=>{const r=await fetch('assets/game/unknown/image.webp');return {status:r.status,mime:r.headers.get('content-type')};});expect(missing).toEqual({status:404,mime:'text/plain'});
    await record(info,'optional-failure',{results,repaired,silent,missing,retryFocus:keyboardFocus,pointerRetryWidth:await page.locator('#pointer-art').evaluate(img=>img.naturalWidth),nestedButtons:await page.locator('button button').count(),retryWidth:await page.locator('#unseen-art').evaluate(img=>img.naturalWidth),caches:await cachesOf(page)});
  }finally{await offline(site,false);await site.close();}
});

test('cold offline and unknown client do not create progress or force an update',async({page,context},info)=>{
  const site=await openSite(info);let unknown;
  try{
    await offline(site,true);await expect(page.goto(site.url)).rejects.toThrow();await offline(site,false);
    // Load the script-free old document before registration, so navigation cannot be replaced by the shell.
    site.setResponse('/unknown.html',{status:200,contentType:'text/html',body:'<!doctype html><title>Unresponsive old client</title>'});
    unknown=await context.newPage();await unknown.goto(site.url+'/unknown.html');
    await page.goto(site.url);await ready(page);expect(await page.evaluate(()=>Object.keys(S.owned))).toEqual([]);
    await publish(site,page,packs[1]);const started=Date.now();await page.locator('#gameUpdateButton').click();
    await expect(page.locator('#gameUpdateText')).toContainText('다른 창');
    expect(Date.now()-started).toBeLessThan(10000);expect(await release(page)).toBe(packs[0].release.releaseId);
    expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
    await page.evaluate(async()=>{(await navigator.serviceWorker.getRegistration()).waiting.postMessage({type:'<script>skipWaiting()</script>'});});
    expect(await release(page)).toBe(packs[0].release.releaseId);
    await record(info,'cold-offline',{owned:await page.evaluate(()=>Object.keys(S.owned)),cacheState:await cachesOf(page),document:await release(page),unknownTitle:await unknown.title(),activationBlocked:true,unresponsiveClientDeadlineMs:Date.now()-started});
  }finally{await unknown?.close();await offline(site,false);await site.close();}
});
