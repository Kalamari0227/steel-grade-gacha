import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {appURL,root,evidenceRoot} from './helpers/paths.mjs';
import {openApp,destination,capture} from './helpers/app.mjs';

const baseline=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/catalog.json'),'utf8'));
const browserAudit=new WeakMap();
test.beforeEach(async({page},info)=>{
  const intentionalPaths=info.title.includes('blocked page failure')?['/webtoon/ep01.webp']:
    info.title.includes('unvisited offline entry')?baseline.toon[2].pages.map(p=>'/'+p.img):[];
  const audit={runtimeErrors:[],consoleErrors:[],expectedImageErrors:[],unexpectedConsoleErrors:[],failedRequests:[],intentionalPaths};
  browserAudit.set(page,audit);
  page.on('pageerror',error=>audit.runtimeErrors.push(error.message));
  page.on('requestfailed',request=>audit.failedRequests.push({url:request.url(),resourceType:request.resourceType(),error:request.failure()?.errorText}));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const row={text:message.text(),url:message.location().url};
    audit.consoleErrors.push(row);
  });
});
test.afterEach(async({page},info)=>{
  const audit=browserAudit.get(page);
  const knownFailures=['net::ERR_FAILED','net::ERR_INTERNET_DISCONNECTED','WebKit encountered an internal error','Blocked by Web Inspector'];
  for(const row of audit.consoleErrors){
    let pathname='';try{pathname=new URL(row.url).pathname;}catch{}
    const correlated=audit.failedRequests.find(request=>request.url===row.url&&request.resourceType==='image'&&knownFailures.includes(request.error));
    const expected=audit.intentionalPaths.includes(pathname)&&correlated&&knownFailures.some(error=>row.text==='Failed to load resource: '+error);
    (expected?audit.expectedImageErrors:audit.unexpectedConsoleErrors).push(row);
  }
  await capture(info,'browser-audit',audit);
  expect(audit.runtimeErrors,'uncaught runtime errors').toEqual([]);
  expect(audit.unexpectedConsoleErrors,'unexpected console errors').toEqual([]);
});
const snapshot=page=>page.evaluate(()=>({game:JSON.stringify(S),saved:localStorage.getItem(KEY)}));
const seen=page=>page.evaluate(()=>localStorage.getItem(TOON_SEEN)||'');
async function record(info,name,data){await capture(info,name,data);await fs.mkdir(evidenceRoot,{recursive:true});await fs.writeFile(path.join(evidenceRoot,name+'.json'),JSON.stringify(data,null,2));}
async function shot(page,name){await fs.mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:path.join(evidenceRoot,name+'.png')});}
async function list(page,from='research'){
  await destination(page,from);
  const trigger=page.locator(from==='workshop'?'#homeToon':'#btnToon');
  await trigger.scrollIntoViewIfNeeded();
  const top=await page.evaluate(()=>window.scrollY);
  const seenBefore=await seen(page);await trigger.click();
  await expect(page.locator('#toonModal')).toBeVisible();
  const seenAfter=await seen(page);expect(seenAfter).toBe(seenBefore);
  await capture(test.info(),'list-only-'+from+'-'+Date.now(),{from,seenBefore,seenAfter,game:await snapshot(page)});
  return top;
}
async function episode(page,index){
  await page.locator('#toonBox .ep[data-i="'+index+'"]').click();
  await expect(page.locator('#toonView')).toBeVisible();
  await expect(page.locator('#toonModal')).not.toBeVisible();
}
async function decodePages(page,index){
  const entry=baseline.toon[index],rows=[];
  await expect(page.locator('#toonScroll .toon-page')).toHaveCount(entry.pages.length);
  for(let j=0;j<entry.pages.length;j++){
    const frame=page.locator('#toonScroll .toon-page').nth(j),img=frame.locator('img'),expected=entry.pages[j];
    await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());
    await expect(frame).toHaveAttribute('data-state','ready');
    await expect(img).toHaveAttribute('src',expected.img);
    const dimensions=await img.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
    expect(dimensions).toEqual({width:expected.w,height:expected.h});
    const bounds=await img.boundingBox();expect(bounds.width).toBeGreaterThan(250);
    rows.push({episode:entry.id,page:j,path:expected.img,dimensions});
  }
  await expect(page.locator('#toonLoadStatus')).toContainText('그림 '+entry.pages.length+' / '+entry.pages.length+'장 불러옴');
  return rows;
}

test('@webtoon-happy all3 entries all15 pages and3 thumbnails match baseline',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned'),before=await snapshot(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  expect(await page.evaluate(()=>TOON)).toEqual(baseline.toon);
  await list(page);
  expect(await page.locator('#toonBox .ep').evaluateAll(nodes=>nodes.map(n=>+n.dataset.i))).toEqual([2,1,0]);
  const thumbnails=[];
  for(let i=0;i<3;i++){
    const img=page.locator('#toonBox .ep[data-i="'+i+'"] img');
    await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());
    await expect(img).toHaveAttribute('src',baseline.toon[i].thumb);
    expect(await img.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    thumbnails.push(baseline.toon[i].thumb);
  }
  const rows=[];
  for(let i=0;i<3;i++){
    await episode(page,i);rows.push(...await decodePages(page,i));
    expect(await page.evaluate(()=>dialogStack.filter(e=>e.el.id==='toonView').length)).toBe(1);
    await page.locator('#toonBack').click();
    await expect(page.locator('#toonBox .ep[data-i="'+i+'"]')).toBeFocused();
  }
  expect(rows).toHaveLength(15);expect(thumbnails).toHaveLength(3);
  expect(await snapshot(page)).toEqual(before);expect(errors).toEqual([]);
  await record(info,'episodes',{hash,rows,thumbnails,before,after:await snapshot(page),errors});
});

test('@webtoon-happy NEW remains max opened ID through reload and previous next',async({page},info)=>{
  const hash=await openApp(page,appURL),before=await snapshot(page);
  await list(page);await expect(page.locator('#toonBox .new')).toHaveCount(3);
  await episode(page,0);expect(await seen(page)).toBe('s00');
  await page.locator('#toonScroll [data-go="1"]').click();expect(await seen(page)).toBe('ep01');
  await page.locator('#toonScroll [data-go="2"]').click();expect(await seen(page)).toBe('ep02');
  await expect(page.locator('#toonScroll [data-go="3"]')).toBeDisabled();
  await page.locator('#toonScroll [data-go="1"]').click();expect(await seen(page)).toBe('ep02');
  await page.locator('#toonScroll [data-go="0"]').click();expect(await seen(page)).toBe('ep02');
  await expect(page.locator('#toonScroll [data-go="-1"]')).toBeDisabled();
  expect(await page.evaluate(()=>dialogStack.map(e=>e.el.id))).toEqual(['toonView']);
  const origin=await page.evaluate(()=>({trigger:toonSession.trigger.id,tag:toonSession.trigger.tagName}));
  await page.keyboard.press('Escape');
  await record(info,'seen-origin-focus',{hash,origin,after:await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName}))});
  await expect(page.locator('#btnToon')).toBeFocused();
  const indicators=await page.evaluate(()=>({home:document.getElementById('homeToonStatus').textContent,learningHidden:document.getElementById('toonNew').hidden,seen:localStorage.getItem(TOON_SEEN)}));
  await record(info,'seen-indicators-before-reload',{hash,indicators});
  await expect(page.locator('#homeToonStatus')).not.toContainText('NEW');
  await expect(page.locator('#toonNew')).toBeHidden();
  await page.reload();await list(page);await expect(page.locator('#toonBox .new')).toHaveCount(0);
  await expect(page.locator('#homeToonStatus')).not.toContainText('NEW');
  await expect(page.locator('#toonNew')).toBeHidden();
  expect(await snapshot(page)).toEqual(before);
  await record(info,'seen-semantics',{hash,seen:await seen(page),before,after:await snapshot(page)});
});

test('@webtoon-happy five verified family links resume reader scroll and focus',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned'),before=await snapshot(page);
  await list(page);await episode(page,0);await decodePages(page,0);
  const expected=['poo','ssial','eg','tarae','ga'],rows=[];
  expect(await page.locator('[data-toon-family]').evaluateAll(nodes=>nodes.map(n=>n.dataset.toonFamily))).toEqual(expected);
  for(const key of expected){
    const button=page.locator('[data-toon-family="'+key+'"]');
    await button.scrollIntoViewIfNeeded();await button.focus();
    const top=await page.locator('#toonScroll').evaluate(el=>el.scrollTop);
    await button.click();await expect(page.locator('#view-dex')).toBeVisible();
    await expect(page.locator('#dexFamily')).toHaveValue(key);
    expect(await page.locator('#dex .fam').evaluateAll(nodes=>nodes.map(n=>n.dataset.family))).toEqual([key]);
    await expect(page.locator('#toonView')).not.toBeVisible();
    await page.locator('#toonDexResume').click();
    await expect(page.locator('#toonView')).toBeVisible();await expect(button).toBeFocused();
    expect(Math.abs(await page.locator('#toonScroll').evaluate(el=>el.scrollTop)-top)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(()=>dialogStack.map(e=>e.el.id))).toEqual(['toonView']);
    rows.push({key,top});
  }
  await shot(page,'reader');await page.keyboard.press('Escape');await expect(page.locator('#btnToon')).toBeFocused();
  expect(await snapshot(page)).toEqual(before);await record(info,'family-return',{hash,rows,before,after:await snapshot(page)});
});

test('@webtoon-happy home and learning origin list position keyboard four widths',async({page},info)=>{
  const hash=await openApp(page,appURL),before=await snapshot(page),rows=[];
  for(const width of [360,390,768,1280]){
    await page.setViewportSize({width,height:844});
    for(const origin of ['workshop','research']){
      const originTop=await list(page,origin);
      const selected=page.locator('#toonBox .ep[data-i="0"]');await selected.scrollIntoViewIfNeeded();
      const listTop=await page.locator('#toonModal .box').evaluate(el=>el.scrollTop);
      await selected.click();await decodePages(page,0);
      await page.locator('#toonBack').focus();await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#toonScroll [data-go="1"]')).toBeFocused();
      await page.keyboard.press('Tab');await expect(page.locator('#toonBack')).toBeFocused();
      await page.locator('#toonBack').click();await expect(selected).toBeFocused();
      expect(Math.abs(await page.locator('#toonModal .box').evaluate(el=>el.scrollTop)-listTop)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const seenBeforeClose=await seen(page),beforeClose=await snapshot(page);await page.locator('#toonX').click();await expect(page.locator(origin==='workshop'?'#homeToon':'#btnToon')).toBeFocused();
      await expect(page.locator('#toonModal')).not.toBeVisible();expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');expect(await page.evaluate(()=>dialogStack.length)).toBe(0);
      expect(await seen(page)).toBe(seenBeforeClose);expect(await snapshot(page)).toEqual(beforeClose);
      expect(Math.abs(await page.evaluate(()=>window.scrollY)-originTop)).toBeLessThanOrEqual(1);
      rows.push({width,origin,listTop,originTop,seenBeforeClose,seenAfterClose:await seen(page),beforeClose,afterClose:await snapshot(page)});
    }
  }
  expect(await snapshot(page)).toEqual(before);await record(info,'reader-responsive',{hash,rows,before,after:await snapshot(page)});
});

test('@webtoon-negative delayed image is loading not decoded',async({page},info)=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/webtoon/ep01.webp',async route=>{await gate;await route.continue();});
  try{
    const hash=await openApp(page,appURL),before=await snapshot(page);await list(page);await episode(page,1);
    const frame=page.locator('.toon-page');
    await expect(frame).toHaveAttribute('data-state','loading');
    await expect(page.locator('#toonLoadStatus')).toContainText('그림 0 / 1장');
    expect(await seen(page)).toBe('ep01');
    release();await decodePages(page,1);expect(await snapshot(page)).toEqual(before);
    await record(info,'slow-image',{hash,seen:await seen(page),before,after:await snapshot(page)});
  }finally{release();}
});

test('@webtoon-negative blocked page failure retry and invalid episode preserve mark-on-open',async({page},info)=>{
  await page.route('**/webtoon/ep01.webp',route=>route.abort());
  const hash=await openApp(page,appURL),before=await snapshot(page);await list(page);await episode(page,1);
  const frame=page.locator('.toon-page');
  await expect(frame).toHaveAttribute('data-state','error');
  await expect(page.locator('#toonLoadStatus')).toContainText('그림 0 / 1장');
  await expect(frame.locator('[data-retry]')).toBeVisible();
  expect(await seen(page)).toBe('ep01');
  await page.evaluate(()=>{openToonView(-1);openToonView(99);});
  expect(await seen(page)).toBe('ep01');expect(await page.evaluate(()=>toonCur)).toBe(1);
  await shot(page,'offline-status');
  await page.unroute('**/webtoon/ep01.webp');
  await frame.locator('[data-retry]').click();await decodePages(page,1);
  await expect(frame.locator('img')).toHaveAttribute('src','webtoon/ep01.webp');
  expect(await seen(page)).toBe('ep01');expect(await snapshot(page)).toEqual(before);
  await record(info,'state',{hash,seen:await seen(page),before,after:await snapshot(page)});
});

test('@webtoon-negative unvisited offline entry errors without declaring image success',async({page},info)=>{
  const hash=await openApp(page,appURL),before=await snapshot(page);await list(page);
  await page.context().setOffline(true);
  try{
    await episode(page,2);
    for(const frame of await page.locator('.toon-page').all()){
      await frame.scrollIntoViewIfNeeded();await expect(frame).toHaveAttribute('data-state','error');
    }
    await expect(page.locator('#toonLoadStatus')).toContainText('그림 0 / 8장');
    expect(await seen(page)).toBe('ep02');
    expect(await page.evaluate(()=>dialogStack.map(e=>e.el.id))).toEqual(['toonView']);
    expect(await snapshot(page)).toEqual(before);
    await record(info,'uncached-offline',{hash,seen:await seen(page),before,after:await snapshot(page)});
  }finally{await page.context().setOffline(false);}
});
