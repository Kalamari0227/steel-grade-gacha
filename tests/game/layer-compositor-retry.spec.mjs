import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {appURL,root} from '../helpers/paths.mjs';
const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-asset-manifest.json')));
const fragment=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-reviews/placements/manifest-fragment.json')));
const config={assets:Object.fromEntries(manifest.assets.map(row=>[row.assetId,{url:'/'+row.path}])),faces:manifest.faces,placements:fragment.placements.map(row=>row.value)};
async function record(info,name,value){await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(info.outputPath(name+'.json'),JSON.stringify(value,null,2));}
async function open(page){await page.goto(appURL);await page.waitForFunction(()=>typeof S!=='undefined');await page.addStyleTag({path:path.join(root,'src/game/game.css')});await page.evaluate(config=>{window.GAME_CONFIG=config;document.body.replaceChildren();document.body.style.cssText='margin:0;background:#161b20'},config);await page.addScriptTag({path:path.join(root,'src/game/presentation.js')});await page.evaluate(()=>{window.urlProbe={created:[],revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);urlProbe.created.push(url);return url};URL.revokeObjectURL=url=>{urlProbe.revoked.push(url);return revoke(url)};GAME_PRESENTATION.boot({findChar,items:ITEMS,getState:()=>S})});}
async function render(page,face,keys,width){return page.evaluate(async({face,width})=>{const view=GAME_PRESENTATION.render({cardId:face.cardId,side:face.side,state:{owned:{[face.cardId]:true},items:{}}});window.statusHistory=[];window.retryView=view;view.onStatus(status=>statusHistory.push({...status,frozen:Object.isFrozen(status)}));document.body.replaceChildren(view.element);view.element.style.width=width+'px';return {loaded:await view.ready}}, {face,width});}
test('missing artwork exposes readable retry and reduced motion has immediate static layers',async({page},info)=>{
 const requests=[];page.on('request',request=>{if(request.url().includes('/characters/qp-1470/front.webp'))requests.push(request.url());});
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 await page.route('**/characters/qp-1470/front.webp',r=>r.abort());
 const face=manifest.faces.find(f=>f.cardId==='qp-1470');const result=await render(page,face,[],360);expect(result.loaded.includes(false)).toBe(true);
 await expect(page.getByRole('button',{name:/그림 다시 시도/})).toBeVisible();
 await expect(page.locator('.game-card-name')).toHaveText('1470 QP');
 const motion=await page.locator('.game-card').evaluate(e=>({animation:getComputedStyle(e).animationName,transition:getComputedStyle(e).transitionDuration,transform:getComputedStyle(e).transform}));expect(motion).toEqual({animation:'none',transition:'0s',transform:'none'});
 await page.screenshot({path:info.outputPath('missing-art-readable.png')});await page.unroute('**/characters/qp-1470/front.webp');await page.getByRole('button',{name:/그림 다시 시도/}).click();await expect(page.locator('[data-asset="character:qp-1470:front"]')).toHaveAttribute('data-status','ready');await page.screenshot({path:info.outputPath('retry-recovered.png')});const decoded=await page.locator('[data-asset="character:qp-1470:front"] img').evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight,complete:i.complete}));expect(decoded).toEqual({width:960,height:1440,complete:true});const urls=await page.evaluate(()=>urlProbe);expect(urls.created).toHaveLength(1);expect(urls.revoked).toEqual(urls.created);expect(requests).toHaveLength(2);expect(requests[1]).toBe(requests[0]);await record(info,'retry-motion',{result,motion,requests,decoded,urls});
 const current=await page.evaluate(async()=>({history:statusHistory,originalReady:await retryView.ready}));expect(current.originalReady).toEqual(result.loaded);expect(current.history.every(s=>s.frozen)).toBe(true);expect(current.history.at(-1)).toEqual({loading:0,error:0,ready:4,frozen:true});expect(current.history.some((s,i)=>s.loading===1&&i>0&&current.history[i-1].error===1)).toBe(true);await record(info,'retry-status-contract',current);
});

test('disposing an in-flight card settles without stale callbacks or retained DOM',async({page},info)=>{
 await open(page);let route;await page.route('**/characters/qp-1470/front.webp',r=>{route=r;});
 await page.evaluate(()=>{window.pendingCard=GAME_PRESENTATION.render({cardId:'qp-1470',side:'front',state:{owned:{'qp-1470':true},items:{}}});document.body.append(pendingCard.element);window.pendingReady=pendingCard.ready;});
 await expect.poll(()=>Boolean(route)).toBe(true);
 const result=await page.evaluate(async()=>{const before=JSON.stringify(S);pendingCard.dispose();pendingCard.dispose();return {ready:await pendingReady,connected:pendingCard.element.isConnected,stateUnchanged:before===JSON.stringify(S),images:[...pendingCard.element.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),load:i.onload,error:i.onerror}))}});
 await route.abort();expect(result.connected).toBe(false);expect(result.stateUnchanged).toBe(true);expect(result.ready.every(x=>typeof x==='boolean')).toBe(true);expect(result.images.every(i=>i.src===null&&i.load===null&&i.error===null)).toBe(true);await record(info,'dispose',result);
});

test('disposing a pending retry aborts its immutable URL fetch and leaks no object URLs',async({page},info)=>{
 await open(page);let retryRoute;const failures=[];page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
 await page.route('**/characters/qp-1470/front.webp',r=>r.request().resourceType()==='image'?r.abort():void(retryRoute=r));
 await page.evaluate(async()=>{window.retryCard=GAME_PRESENTATION.render({cardId:'qp-1470',side:'front',state:{owned:{'qp-1470':true},items:{}}});window.statusCalls=[];window.removedCalls=0;const unsubscribe=retryCard.onStatus(()=>removedCalls++);unsubscribe();retryCard.onStatus(status=>statusCalls.push(status));document.body.append(retryCard.element);await retryCard.ready});
 await page.getByRole('button',{name:/그림 다시 시도/}).click();await expect.poll(()=>Boolean(retryRoute)).toBe(true);
 const beforeDispose=await page.evaluate(()=>statusCalls.length);await page.evaluate(()=>retryCard.dispose());await expect.poll(()=>failures.length).toBe(2);
 const result=await page.evaluate(()=>{retryCard.onStatus(()=>statusCalls.push('disposed'));return {connected:retryCard.element.isConnected,urls:urlProbe,statusCalls,removedCalls}});expect(result.connected).toBe(false);expect(result.urls.created).toEqual([]);expect(result.statusCalls).toHaveLength(beforeDispose);expect(result.statusCalls.at(-1)).toEqual({loading:1,error:0,ready:3});expect(result.removedCalls).toBe(1);await record(info,'abort-retry',{result,failures,url:retryRoute.request().url()});await retryRoute.abort().catch(()=>{});
});
