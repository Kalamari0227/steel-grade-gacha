import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {root,appURL,baselineURL,educationRoot,fixedTime} from './helpers/paths.mjs';
import {openApp,state,capture,destination,settings,sha,mirror} from './helpers/app.mjs';
import {startPwaSite} from './helpers/pwa-site.mjs';
import {attachScreenshot,observeFinalDocuments} from '../tools/final-evidence.mjs';
observeFinalDocuments(test,root);
const catalog=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const errors=new WeakMap();
test.beforeEach(async({page})=>{const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});});
test.afterEach(async({page},info)=>{await capture(info,'console',errors.get(page));expect(errors.get(page)).toEqual([]);});
const only=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
const economy=['owned','stock','scrap','extra','parts','cars','items','pullUsed','quizUsed','orderDone'];
async function screenshot(page,info,name){await attachScreenshot(page,info,name);}
async function backup(page){await settings(page);await page.locator('#btnBackup').click();await expect(page.locator('#backupModal')).toBeVisible();}
async function offlineMode(page,context,site,info,value){
  if(info.project.name==='webkit')site.setTransportOffline(value);else await context.setOffline(value);
  await capture(info,`network-${value?'unavailable':'restored'}`,{mechanism:info.project.name==='webkit'?'origin transport unavailable':'browser context offline',requested:value,navigatorOnline:await page.evaluate(()=>navigator.onLine).catch(()=>null),deviceOfflineClaim:info.project.name!=='webkit'});
}
async function controlled(page,info){
  const result=await page.evaluate(async()=>{
    let timer,listener,expired=false;const result={ready:false,secure:isSecureContext};
    try{await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('SW readiness timeout'));},10000);}),
      (async()=>{await navigator.serviceWorker.ready;if(expired)return;if(!navigator.serviceWorker.controller)await new Promise(resolve=>{listener=resolve;navigator.serviceWorker.addEventListener('controllerchange',listener,{once:true});});})()]);result.ready=true;}
    catch(error){result.error=error.message;}
    finally{clearTimeout(timer);if(listener)navigator.serviceWorker.removeEventListener('controllerchange',listener);}
    result.controller=navigator.serviceWorker?.controller?.scriptURL||null;return result;
  });
  await capture(info,'sw-capability',result);expect(result.ready).toBe(true);expect(result.controller).toBeTruthy();
}
async function armUpgrade(page){
  await page.evaluate(()=>{
    const previous=navigator.serviceWorker.controller;
    window.__changed=new Promise((resolve,reject)=>{
      let next;const clean=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);next?.removeEventListener('statechange',activated);};
      const activated=()=>{if(next.state==='activated'){clean();resolve({controllerChanged:next!==previous,state:next.state});}};
      const changed=()=>{next=navigator.serviceWorker.controller;if(!next||next===previous)return;next.addEventListener('statechange',activated);activated();};
      const timer=setTimeout(()=>{clean();reject(Error('replacement controller activation timeout'));},15000);
      navigator.serviceWorker.addEventListener('controllerchange',changed);
    });window.__changed.catch(()=>{});
  });
}
async function unlocked(page){expect(await page.evaluate(()=>dialogStack.length)).toBe(0);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');expect(await page.evaluate(()=>!!document.activeElement.closest('[hidden],[inert]'))).toBe(false);}

test('@end-to-end-happy shipment card craft quiz demand guarantee reader backup restore garage',async({page,browser},info)=>{
  const artifact=await openApp(page,appURL,'crafting-ready'),steps=[];const start=await state(page);
  await page.locator('#btnPull').click();const pulled=await state(page);
  expect(pulled.stock).toEqual({...start.stock,'poo-270C':start.stock['poo-270C']+1});expect(pulled.pullUsed).toBe(start.pullUsed+1);expect(pulled.extra).toBe(start.extra);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(pulled);
  await page.locator('[data-draw-skip]').click();await page.locator('.draw-art').click();await expect(page.locator('#materialTitle')).toContainText(catalog.cards.find(row=>row.id==='poo-270C').g);
  await screenshot(page,info,'01-card');await page.keyboard.press('Escape');await page.locator('[data-draw-close]').click();steps.push({stage:'pull',before:start,after:pulled});
  await destination(page,'craft');await page.locator('#parts [data-part-key="bpillar"]').click();
  const beforeCraft=await state(page),plan=await page.evaluate(()=>partPlan(findPart('bpillar'))),part=catalog.parts.find(row=>row.key==='bpillar');
  expect(plan).toHaveLength(part.need.length);plan.forEach((id,i)=>expect(part.need[i].any).toContain(id));
  await page.locator('#mkBtn').click();const crafted=await state(page),expectedStock={...beforeCraft.stock};for(const id of plan)expectedStock[id]--;
  expect(crafted.stock).toEqual(expectedStock);expect(crafted.parts.bpillar.use).toEqual(plan);expect(crafted.owned).toEqual(beforeCraft.owned);
  await screenshot(page,info,'02-crafted');await page.keyboard.press('Escape');steps.push({stage:'craft',before:beforeCraft,plan,after:crafted});
  await destination(page,process.env.SGG_EDITION==='game'?'research':'learn');await page.locator('#btnQuiz').click();const beforeQuiz=await state(page),answers=[];
  for(let i=0;i<5;i++){
    const question=await page.evaluate(()=>qState.qs[qState.i]);answers.push(question);
    const explanationText=await page.evaluate(html=>{const element=document.createElement('div');element.innerHTML=html;return element.textContent;},question.e);
    await page.locator('#opts button').nth(question.a).click();
    await expect(page.locator('.learning-reason')).toHaveText(explanationText);
    await page.locator('#qNext').click();
  }
  const quizzed=await state(page);expect(quizzed.extra).toBe(beforeQuiz.extra+1);expect(quizzed.stock).toEqual(beforeQuiz.stock);await page.locator('#qDone').click();steps.push({stage:'quiz',before:beforeQuiz,answers,after:quizzed});
  await page.locator('#btnOrder').click();const beforeDemand=await state(page),key=beforeDemand.orderKey;expect(catalog.orders.some(row=>row.item===key)).toBe(true);
  await page.locator(`[data-choice="${key}"]`).click();const acquired=await state(page);expect(acquired.items[key]).toBe(1);expect(acquired.orderDone).toBe(beforeDemand.orderDone+1);expect(acquired.stock).toEqual(beforeDemand.stock);
  await page.locator('#pkEquip').click();const target=page.locator('[data-equip-id]').first(),id=await target.getAttribute('data-equip-id');expect(catalog.items.find(row=>row.key===key).fit).toContain(id);
  await target.click();expect(await state(page)).toEqual(acquired);await page.locator("#equipConfirm").click();const equipped=await state(page);expect(equipped.items[key]).toBe(id);expect(equipped.stock).toEqual(acquired.stock);await page.locator('#pkDone2').click();steps.push({stage:'guarantee',key,id,before:beforeDemand,acquired,after:equipped});
  await page.locator('#btnToon').click();const beforeReader=await state(page);await page.locator('#toonBox .ep[data-i="1"]').click();
  for(const image of await page.locator('#toonScroll .toon-page img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(el=>el.decode());}
  await expect(page.locator('#toonLoadStatus')).toContainText('1 / 1');await screenshot(page,info,'03-reader');
  await page.locator('#toonBack').click();await expect(page.locator('#toonBox .ep[data-i="1"]')).toBeFocused();await page.keyboard.press('Escape');expect(await state(page)).toEqual(beforeReader);
  const seen=await page.evaluate(()=>localStorage.getItem(TOON_SEEN));await backup(page);const code=await page.locator('#bkOut').inputValue(),beforeRestore=await state(page),currentPack=await page.evaluate(code=>readCode(code),code);
  const baselineContext=await browser.newContext({timezoneId:'Asia/Seoul',serviceWorkers:'block'});let restoreOracle;
  try{
    const baselinePage=await baselineContext.newPage(),baselineArtifact=await openApp(baselinePage,baselineURL,'crafting-ready');
    restoreOracle={artifact:baselineArtifact,...await baselinePage.evaluate(beforeRestore=>{
      applySaved(beforeRestore);save();const before=JSON.parse(JSON.stringify(S)),code=makeCode(),pack=readCode(code);applyCode(pack);
      return {before,code,pack,restoredPack:readCode(makeCode()),state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY),clock:Date.now()};
    },beforeRestore)};
    expect(restoreOracle.before).toEqual(beforeRestore);expect(restoreOracle.pack).toEqual(currentPack);expect(restoreOracle.clock).toBe(new Date(fixedTime).getTime());
  }finally{await baselineContext.close();}
  const expectedGameRestore={...beforeRestore,parts:Object.fromEntries(currentPack.pt.map(key=>[key,{at:0,use:[]}]))};
  await capture(info,'backup-roundtrip-oracles',{beforeRestore,currentPack,expectedGameRestore,restoreOracle});
  await page.locator('#bkIn').fill(code);await page.locator('#bkLoad').click();if(process.env.SGG_EDITION==='game'){await expect(page.locator('#bkConfirm')).toBeVisible();expect(await state(page)).toEqual(beforeRestore);await page.locator('#bkConfirm').click();}await expect(page.locator('#bkRes')).toHaveClass('bkres ok');
  expect(await state(page)).toEqual(process.env.SGG_EDITION==='game'?expectedGameRestore:restoreOracle.state);expect(await page.evaluate(()=>readCode(makeCode()))).toEqual(process.env.SGG_EDITION==='game'?currentPack:restoreOracle.restoredPack);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(process.env.SGG_EDITION==='game'?JSON.stringify(expectedGameRestore):restoreOracle.saved);expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe(seen);await screenshot(page,info,'04-restored');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await destination(page,'garage');await expect(page.locator('#view-garage')).toBeVisible();await screenshot(page,info,'05-garage');await unlocked(page);
  const final=await state(page);await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);expect(only(await state(page),economy)).toEqual(only(final,economy));await expect(page.locator('#view-garage')).toBeVisible();
  await capture(info,'e2e-flow',{artifact,fixture:'crafting-ready',steps,code,seen,beforeRestore,restoreOracle,final,afterReload:await state(page)});
});

test('@end-to-end-happy completed parts car confirmation backup reload retains ownership',async({page},info)=>{
  await openApp(page,appURL,'all-parts');await destination(page,'garage');const before=await state(page);const choice=page.locator('#carBox .garage-option').first(),key=await choice.getAttribute('data-k');
  expect(catalog.cars.some(row=>row.key===key)).toBe(true);await choice.click();expect(await state(page)).toEqual(before);await page.locator('#takeCar').click();const after=await state(page);
  expect(after.cars.map(row=>row.k)).toEqual([...before.cars.map(row=>row.k),key]);expect(after.parts).toEqual({});expect(after.stock).toEqual(before.stock);expect(after.owned).toEqual(before.owned);
  await destination(page,'garage');await page.locator(`#garage [data-car-key="${key}"]`).click();await screenshot(page,info,'garage-detail');await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);expect((await state(page)).cars).toEqual(after.cars);
  await capture(info,'car-continuity',{before,after,reloaded:await state(page)});
});

test.describe('offline upgrade continuity',()=>{
  test.use({serviceWorkers:'allow'});
  observeFinalDocuments(test,root,{kind:'education-reference'});
  test('@end-to-end-negative shortage invalid restore reveal reload and offline update stay isolated',async({page,context},info)=>{
    test.setTimeout(120000);const site=await startPwaSite(info,{edition:'education',source:educationRoot}),receipts=[];
    try{
      const fixture=JSON.parse(await fs.readFile(`${root}/tests/fixtures/crafting-short.json`,'utf8'));
      await page.clock.setFixedTime(new Date(fixedTime));await page.addInitScript(fixture=>{Math.random=()=>0;if(!sessionStorage.getItem('e2e-seeded')){localStorage.setItem('steelgrade_gacha_v1',JSON.stringify(fixture.state));sessionStorage.setItem('e2e-seeded','1');}},fixture);
      const oldResponse=await page.goto(site.url);expect(sha(await oldResponse.body())).toBe(site.old.indexSHA);
      await controlled(page,info);
      await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);const old=await state(page);await expect.poll(()=>mirror(page)).toEqual(old);
      const storageBefore=await page.evaluate(()=>({saved:localStorage.getItem(KEY),seen:localStorage.getItem('sgg_toon_seen')}));
      await armUpgrade(page);
      const current=await site.publishCurrent();const activation=await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();return await window.__changed;});
      expect(activation).toEqual({controllerChanged:true,state:'activated'});await capture(info,'upgrade-activation',activation);
      await offlineMode(page,context,site,info,true);const updated=await page.reload();expect(sha(await updated.body())).toBe(current.indexSHA);await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);expect(await state(page)).toEqual(old);
      await expect.poll(()=>mirror(page)).toEqual(old);
      const storageAfter=await page.evaluate(()=>({saved:localStorage.getItem(KEY),seen:localStorage.getItem('sgg_toon_seen')}));expect(storageAfter).toEqual(storageBefore);
      const hero=await page.locator('.home-hero').evaluate(async image=>{await image.decode();const response=await fetch(image.src);return {width:image.naturalWidth,height:image.naturalHeight,status:response.status,bytes:Array.from(new Uint8Array(await response.arrayBuffer()))};});
      expect(hero.width).toBeGreaterThan(0);expect(hero.height).toBeGreaterThan(0);expect(hero.status).toBe(200);
      const heroSHA=sha(Buffer.from(hero.bytes));expect(heroSHA).toBe(sha(await fs.readFile(`${educationRoot}/src/uiimg/workshop.webp`)));
      await capture(info,'offline-cache-state',{indexSHA:sha(await updated.body()),storageBefore,storageAfter,mirror:await mirror(page),hero:{width:hero.width,height:hero.height,status:hero.status,sha256:heroSHA}});
      await page.locator('#parts [data-part-key="bpillar"]').click();await expect(page.locator('#mkBtn')).toBeDisabled();await page.keyboard.press('Escape');expect(await state(page)).toEqual(old);receipts.push({stage:'shortage',before:old,after:await state(page)});
      await backup(page);const beforeInvalid=await state(page);await page.locator('#bkIn').fill('SGG1.invalid');await page.locator('#bkLoad').click();await expect(page.locator('#bkRes')).toHaveClass('bkres ng');expect(await state(page)).toEqual(beforeInvalid);
      await page.keyboard.press('Escape');await page.keyboard.press('Escape');await unlocked(page);receipts.push({stage:'invalid-restore',before:beforeInvalid,after:await state(page)});
      await page.locator('#btnPull').click();const saved=await state(page);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(saved);expect(saved.stock['poo-270C']).toBe(1);
      await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);expect(await state(page)).toEqual(saved);expect(await page.evaluate(()=>drawBusy())).toBe(false);receipts.push({stage:'reveal-reload',before:saved,after:await state(page)});
      for(const route of ['dex','learn','garage','workshop']){await destination(page,route);await expect(page.locator(`#view-${route}`)).toBeVisible();expect(await state(page)).toEqual(saved);}
      await unlocked(page);await screenshot(page,info,'offline-negative-continuity');await capture(info,'negative-flow',{old:site.old,current,receipts,final:await state(page)});
    }finally{if(info.project.name==='webkit')site.setTransportOffline(false);else await context.setOffline(false);await site.close();}
  });
});
