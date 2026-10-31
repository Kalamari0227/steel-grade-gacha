import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {packageBinding,hash,verifyPreview} from '../../tools/delivery-files.mjs';
import {verifyPackage} from '../../tools/game-build/package.mjs';
import {startEditionSite,record} from '../helpers/edition-package-site.mjs';
const source=path.resolve(import.meta.dirname,'../..'),origin='http://127.0.0.1:'+process.env.SGG_APP_PORT;
let binding,release;
test.beforeAll(async()=>{binding=await packageBinding(process.env.SGG_PACKAGE_ROOT,source);({release}=await verifyPackage(binding.root));});
test.afterAll(async()=>{if(binding)expect(await packageBinding(binding.root,source)).toEqual(binding);});

test('relocated normal package serves every declared byte and rejects source paths',async({page},info)=>{
 const resource=JSON.parse(await fs.readFile(path.join(process.env.SGG_EVIDENCE_DIR,'resources.json'),'utf8'));
 const preview={schemaVersion:1,status:'serving',root:binding.root,releaseId:binding.releaseId,packageSHA256:binding.fingerprintSHA256,origin,pid:resource.pid,startedAt:resource.startedAt};
 const responses=await verifyPreview(preview,binding),requests=[];page.on('request',r=>requests.push(r.url()));
 await expect(verifyPreview({...preview,releaseId:'0'.repeat(64)},binding)).rejects.toThrow('Stale preview');
 const response=await page.goto(origin+'/index.html');expect(hash(await response.body())).toBe(binding.files.find(r=>r.path==='index.html').sha256);
 expect((await response.headerValue('content-type')).split(';')[0]).toBe('text/html');
 await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
 expect(await page.getAttribute('body','data-game-release')).toBe(release.releaseId);expect(await page.getAttribute('body','data-game-fixture')).toBe('false');
 for(const name of ['src/app_tpl.html','src/audio/manifest.json','tools/build-game.mjs','.git/config'])expect((await page.request.get(origin+'/'+name)).status()).toBe(404);
 expect(requests.every(url=>new URL(url).origin===origin)).toBe(true);
 await record(info,'package-http',{binding,responses,requests,indexSHA:hash(await response.body()),clientRelease:await page.getAttribute('body','data-game-release')});
});
test('every packaged art export and original comic decodes at real dimensions',async({page},info)=>{
 await page.goto(origin);const images=release.files.filter(r=>r.mime.startsWith('image/'));
 expect(images.length).toBeGreaterThan(0);
 const rows=await page.evaluate(async images=>{const rows=[];for(const row of images){const image=new Image();image.src=row.path;await image.decode();rows.push({path:row.path,width:image.naturalWidth,height:image.naturalHeight});image.src='';}return rows;},images);
 expect(rows.map(r=>r.path)).toEqual(images.map(r=>r.path));expect(rows.every(r=>r.width>0&&r.height>0)).toBe(true);
 const expected=JSON.parse(await fs.readFile(path.join(source,'docs/design/game-asset-manifest.json'),'utf8'));
 const config=await page.evaluate(()=>GAME_CONFIG.assets);
 for(const asset of [...expected.assets,...expected.optionalDerived]){const row=rows.find(r=>r.path===config[asset.assetId].url);expect(row).toMatchObject({width:asset.dimensions.width,height:asset.dimensions.height});}
 expect(rows.filter(r=>r.path.startsWith('webtoon/'))).toHaveLength(18);await record(info,'package-images',rows);
});
for(const group of ['bgm','sfx-0','sfx-1','sfx-2'])test('actual package audio decode '+group,async({page},info)=>{
 await page.goto(origin);const manifest=JSON.parse(await fs.readFile(path.join(source,'src/audio/manifest.json'),'utf8'));
 const tracks=group==='bgm'?manifest.tracks.filter(t=>t.kind==='bgm'):manifest.tracks.filter(t=>t.kind==='sfx').slice(Number(group.at(-1))*8,Number(group.at(-1))*8+8);
 const variants=tracks.flatMap(t=>t.variants),files=variants.map(v=>release.files.find(r=>r.sha256===v.sha256&&r.mime===v.mime));
 expect(files.length).toBeGreaterThan(0);expect(files.every(Boolean)).toBe(true);
 const rows=await page.evaluate(async files=>{const ac=new AudioContext(),rows=[];try{for(const file of files){const response=await fetch(file.path);if(!response.ok)throw Error('Audio HTTP '+response.status);const b=await ac.decodeAudioData(await response.arrayBuffer());rows.push({path:file.path,frames:b.length,sampleRate:b.sampleRate,channels:b.numberOfChannels,duration:b.duration});}}finally{await ac.close();}return rows;},files);
 for(const row of rows){expect(row.frames).toBeGreaterThan(0);expect(row.sampleRate).toBeGreaterThan(0);expect(row.duration).toBeGreaterThan(0);expect(row.channels).toBeGreaterThan(0);}
 await record(info,'package-audio-'+group,{variants:variants.length,rows,subjectiveHearing:'unverified'});
});
test('package-only worker caches critical bytes, survives actual transport outage and preserves foreign caches',async({browser},info)=>{
 const site=await startEditionSite(info,{name:'packaged-smoke',mounts:[{path:'/',package:{root:binding.root}}]}),context=await browser.newContext({serviceWorkers:'allow'});
 try{
  const page=await context.newPage();await page.goto(site.url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&typeof S!=='undefined'&&!saveHold);
  const cacheName='sgg-game-cache-'+release.releaseId;
  const cached=await page.evaluate(async ({cacheName,critical})=>{
   const c=await caches.open(cacheName),result=[];
   for(const row of critical){const response=await c.match(row.path);if(!response)throw Error('Missing critical cache '+row.path);const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);result.push({path:row.path,bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')});}
   for(const name of ['foreign-sentinel','steel-grade-gacha-sentinel'])await (await caches.open(name)).put('/sentinel',new Response(name));return result;
  },{cacheName,critical:release.files.filter(r=>r.classification==='critical'&&!r.path.endsWith('.js'))});
  for(const row of cached){const expected=release.files.find(r=>r.path===row.path);expect(row).toEqual({path:expected.path,bytes:expected.bytes,sha256:expected.sha256});}
  const warm=release.files.find(r=>r.path.startsWith('webtoon/'));
  await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();},warm.path);
  const before=await page.evaluate(()=>JSON.stringify(S));site.offline(true);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&typeof S!=='undefined'&&!saveHold);
  expect(await page.getAttribute('body','data-game-release')).toBe(binding.releaseId);expect(await page.evaluate(()=>JSON.stringify(S))).toBe(before);
  await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();},warm.path);
  await page.evaluate(()=>fetch('/owned-outage-proof').catch(()=>null));
  const sentinels=await page.evaluate(async()=>Promise.all(['foreign-sentinel','steel-grade-gacha-sentinel'].map(async name=>({name,body:await(await(await caches.open(name)).match('/sentinel')).text()}))));
  expect(sentinels.every(r=>r.name===r.body)).toBe(true);await record(info,'package-offline',{releaseId:binding.releaseId,before,after:await page.evaluate(()=>JSON.stringify(S)),cached,sentinels});
 }finally{site.offline(false);await context.close();await site.close();}
});
test('relocated game exposes real routes settings and a single natural draw',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
 await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();const before=await page.evaluate(()=>JSON.parse(JSON.stringify(S)));
 for(const name of ['dex','craft','research','garage','workshop']){await page.locator('.destination-nav a[href="#'+name+'"]').click();await expect(page.locator('#view-'+name)).toBeVisible();}
 await page.locator('#btnSettings').click();await expect(page.locator('#settingsModal')).toBeVisible();await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>JSON.parse(JSON.stringify(S)))).toEqual(before);
 await page.locator('#btnPull').click();await page.locator('[data-draw-skip]').click();await page.locator('[data-draw-close]').click();
 expect(await page.evaluate(()=>totalStock())).toBe(1);expect(errors).toEqual([]);
 await record(info,'package-natural-ui',{before,after:await page.evaluate(()=>JSON.parse(JSON.stringify(S))),errors,releaseId:await page.getAttribute('body','data-game-release')});
});
test('unvisited optional image offers real retry and missing audio remains silent in package-only outage',async({browser},info)=>{
 const site=await startEditionSite(info,{name:'packaged-optional',mounts:[{path:'/',package:{root:binding.root}}]}),context=await browser.newContext({serviceWorkers:'allow'});
 try{
  const page=await context.newPage();await page.goto(site.url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&typeof S!=='undefined'&&!saveHold);
  const candidates=release.files.filter(r=>r.classification==='optional'&&r.mime==='image/webp'),audio=release.files.find(r=>r.mime==='audio/wav');
  const art=await page.evaluate(async candidates=>{for(const row of candidates)if(!await caches.match(row.path))return row;},candidates);expect(art).toBeTruthy();
  site.offline(true);
  await page.evaluate(url=>{const image=new Image();image.id='package-unseen';image.alt='미열람 소재';image.src=url;document.body.append(image);},art.path);
  await expect(page.locator('.game-asset-fallback')).toContainText('미열람 소재');expect(await page.locator('#package-unseen').evaluate(i=>i.naturalWidth)).toBe(0);
  const silent=await page.evaluate(url=>new Promise((resolve,reject)=>{const audio=new Audio(),timer=setTimeout(()=>reject(Error('Missing audio failure event')),5000);audio.onerror=()=>{clearTimeout(timer);resolve({paused:audio.paused,readyState:audio.readyState,error:audio.error.code});};audio.src=url;audio.load();}),audio.path);
  expect(silent.paused).toBe(true);expect(silent.readyState).toBe(0);expect(silent.error).toBeGreaterThan(0);
  site.offline(false);await page.getByRole('button',{name:'그림 다시 불러오기'}).click();await expect.poll(()=>page.locator('#package-unseen').evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);
  expect(await page.locator('.game-asset-fallback').count()).toBe(0);await record(info,'package-optional',{art,audio,silent,retryWidth:await page.locator('#package-unseen').evaluate(i=>i.naturalWidth)});
 }finally{site.offline(false);await context.close();await site.close();}
});
