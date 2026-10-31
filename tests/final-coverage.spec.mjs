import {test,expect} from '@playwright/test';
import {appURL,baselineURL,root} from './helpers/paths.mjs';
import fs from 'node:fs/promises';
import {openApp,state,capture,destination,settings} from './helpers/app.mjs';
import {attachScreenshot} from '../tools/final-evidence.mjs';
const gameEdition=process.env.SGG_EDITION==='game';
const errors=new WeakMap();
const catalog=JSON.parse(await fs.readFile(root+'/tests/fixtures/catalog.json','utf8'));
test('@final-coverage craft and development header count clears close at narrow and enlarged layouts',async({browser},info)=>{
 test.setTimeout(120000);const rows=[];
 for(const viewport of [{width:360,height:844,dpr:1},{width:390,height:844,dpr:1},{width:640,height:450,dpr:2}])for(const fixture of ['crafting-ready','all-parts','qp-ready','qp-owned']){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:viewport.dpr,timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  try{
   const page=await context.newPage(),runtime=[];page.on('pageerror',error=>runtime.push(error.message));
   await openApp(page,appURL,fixture==='qp-owned'?'qp-ready':fixture);let before={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))};
   const entryMethod=fixture==='qp-owned'?'actual ready UI then owned fixture setup exercises stale-owned guard rendering':'actual UI entry';
   if(fixture.startsWith('qp-')){
    await destination(page,'dex');await page.getByRole('button',{name:'선행개발 과제 열기',exact:true}).click();
    if(fixture==='qp-owned'){
     const owned=JSON.parse(await fs.readFile(root+'/tests/fixtures/qp-owned.json','utf8'));
     await page.evaluate(saved=>{applySaved(saved);save();},owned.state);before={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))};
     await page.locator('#devBtn').click();await expect(page.locator('.qp-development')).toHaveAttribute('data-qp-state','owned');
     expect({state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))}).toEqual(before);
     await expect(page.locator('#qpStatus')).toBeFocused();await capture(info,`owned-guard-${viewport.width}`,{before,after:await state(page),scrollTop:await page.locator('#partBox').evaluate(el=>el.scrollTop)});
     await page.keyboard.press('Tab');await expect(page.locator('#partX')).toBeFocused();await expect.poll(()=>page.locator('#partBox').evaluate(el=>el.scrollTop)).toBe(0);
    }
   }
   else {await destination(page,gameEdition?'craft':'workshop');await page.locator('#parts [data-part-key="bpillar"]').click();}
   await page.locator('#partModal').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));await Promise.all([...el.querySelectorAll('img')].filter(img=>img.getClientRects().length).map(img=>img.decode()));});
   await expect(page.locator('#partModal')).toHaveCSS('opacity','1');
   const geometry=await page.evaluate(()=>{
    const close=document.getElementById('partX'),cr=close.getBoundingClientRect(),rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
    return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,close:rect(cr),spans:[...document.querySelectorAll('.craft-top span')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,rect:rect(r),clear:r.right<=cr.left||r.left>=cr.right||r.bottom<=cr.top||r.top>=cr.bottom,visible:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,hit:[r.left+1,(r.left+r.right)/2,r.right-1].every(x=>[r.top+1,(r.top+r.bottom)/2,r.bottom-1].every(y=>el.contains(document.elementFromPoint(x,y))))};})};
   });
   await capture(info,`header-geometry-${fixture}-${viewport.width}`,geometry);
   expect([geometry.width,geometry.height,geometry.dpr]).toEqual([viewport.width,viewport.height,viewport.dpr]);expect(geometry.close.width).toBeGreaterThanOrEqual(44);expect(geometry.close.height).toBeGreaterThanOrEqual(44);
   expect(geometry.spans).toHaveLength(2);for(const span of geometry.spans){expect(span.clear).toBe(true);expect(span.visible).toBe(true);expect(span.hit).toBe(true);}
   await attachScreenshot(page,info,`header-${fixture}-${viewport.width}`);await page.locator('#partX').click();
   expect({state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))}).toEqual(before);expect(runtime).toEqual([]);rows.push({viewport,fixture,entryMethod,geometry,before,after:await state(page),runtime});
  }finally{await context.close();}
 }
 await capture(info,'header-clearance',{mechanism:'640x450 DPR2 layout equivalence, not native browser zoom',rows});
});
test.beforeEach(async({page})=>{const rows=[];errors.set(page,rows);page.on('pageerror',e=>rows.push(e.message));});
test.afterEach(async({page},info)=>{await capture(info,'runtime-errors',errors.get(page));expect(errors.get(page)).toEqual([]);});
test('@final-coverage toast close hides shown message and preserves saved progress',async({page},info)=>{
 const hash=await openApp(page,appURL,'mid-progress'),before=await state(page),saved=await page.evaluate(()=>localStorage.getItem(KEY));
 await page.evaluate(()=>showToast('T23 표시 검증','닫기 검증'));
 await expect(page.locator('#toast')).toHaveClass(/show/);await expect(page.locator('#toast')).toBeVisible();
 await attachScreenshot(page,info,'toast-shown');await page.locator('#toastX').click();
 await expect(page.locator('#toast')).not.toHaveClass(/show/);await expect(page.locator('#toast')).not.toBeVisible();
 expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(saved);
 await capture(info,'toast-close',{hash,before,after:await state(page),saved});
});
const dialogs=[
 {id:'cardModal',route:'dex',trigger:'#dex .cell.have',close:'#cardX'},
 {id:'partModal',route:gameEdition?'craft':'workshop',trigger:'#parts .pcell',close:'#partX'},
 {id:'pickModal',route:gameEdition?'research':'learn',trigger:'#btnOrder',close:'#pickX'},
 {id:'quizModal',route:gameEdition?'research':'learn',trigger:'#btnQuiz',close:'#quizX'},
 {id:'backupModal',settings:true,trigger:'#btnBackup',close:'#backupX'},
 {id:'noticeModal',settings:true,trigger:'#settingsNotice',close:'#noticeX'},
 {id:'promoModal',settings:true,trigger:'#settingsPromo',close:'#promoGo'}
];
for(const mode of ['button','backdrop','Escape'])test(`@final-coverage shared close ${mode} all seven modal types`,async({page},info)=>{
 test.setTimeout(120000);const hash=await openApp(page,appURL,'qp-owned'),rows=[];
 for(const item of dialogs){
  if(item.settings)await settings(page);else await destination(page,item.route);
  const trigger=page.locator(item.trigger).first();await trigger.focus();
  const stack=await page.evaluate(()=>dialogStack.map(row=>row.el.id));await trigger.click();
  await expect(page.locator('#'+item.id)).toBeVisible();const before=await state(page),saved=await page.evaluate(()=>localStorage.getItem(KEY));
  if(mode==='button')await page.locator(item.close).click();
  else if(mode==='backdrop')await page.locator('#'+item.id).click({position:{x:4,y:4}});
  else await page.keyboard.press('Escape');
  await expect(page.locator('#'+item.id)).not.toBeVisible();await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>dialogStack.map(row=>row.el.id))).toEqual(stack);
  expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(saved);
  if(item.settings)await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  rows.push({modal:item.id,mode,before,after:await state(page),saved});
 }
 await capture(info,'shared-close',{hash,rows});await attachScreenshot(page,info,'shared-close-end');
});
test('@final-coverage browser back closes each modal without hidden focus or state changes',async({page},info)=>{
 test.setTimeout(120000);const hash=await openApp(page,appURL,'qp-owned'),rows=[];
 for(const item of dialogs){
  const route=item.route||'workshop',previous=route==='dex'?'garage':'dex';
  await destination(page,previous);await destination(page,route);
  if(item.settings)await settings(page);
  await page.locator(item.trigger).first().click();await expect(page.locator('#'+item.id)).toBeVisible();
  const before=await state(page);await page.goBack();await expect(page.locator('#view-'+previous)).toBeVisible();
  await expect(page.locator('.modal.show,.tview.show')).toHaveCount(0);
  expect(await page.evaluate(()=>dialogStack.length)).toBe(0);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  expect(await page.evaluate(()=>!!document.activeElement.closest('[hidden],[inert]'))).toBe(false);
  expect(await state(page)).toEqual(before);rows.push({modal:item.id,previous,before,after:await state(page)});
 }
 await capture(info,'back-close',{hash,rows});
});
test('@final-coverage visibility at midnight resets demand day without extra rewards',async({page},info)=>{
 const hash=await openApp(page,appURL,'mid-progress');await destination(page,gameEdition?'research':'learn');await page.locator('#btnOrder').click();
 const initial=await page.evaluate(()=>({key:S.orderKey,fit:fitOwned(S.orderKey),owned:!!S.items[S.orderKey],day:S.orderDay,state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY)}));
 expect(catalog.orders.some(order=>order.item===initial.key)).toBe(true);expect(initial.fit.length).toBeGreaterThan(0);expect(initial.owned).toBe(false);expect(initial.day).toBe('2026-11-1');
 const key=initial.key;await page.locator('[data-choice="'+key+'"]').click();await page.locator('#pkDone').click();
 const before=await state(page);expect(before.orderDone).toBe(1);
 await destination(page,'dex');await page.clock.setFixedTime(new Date('2026-11-02T00:00:01+09:00'));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 const after=await state(page);expect(after.orderDay).toBe('2026-11-2');expect(after.orderDone).toBe(0);
 for(const field of ['owned','stock','items','extra','scrap','parts','cars','pullUsed','quizUsed'])expect(after[field]).toEqual(before[field]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(after);
 const order=await page.evaluate(()=>({key:S.orderKey,fit:S.orderKey?fitOwned(S.orderKey):[],owned:!!S.items[S.orderKey]}));
 expect(catalog.orders.some(candidate=>candidate.item===order.key)).toBe(true);expect(order.fit.length).toBeGreaterThan(0);expect(order.owned).toBe(false);
 await capture(info,'midnight-demand',{hash,initial,before,after,order});
});

test('@final-coverage automatic notice promo seen done merge match baseline without repeated rewards',async({browser},info)=>{
 test.setTimeout(180000);const rows=[];
 const resources=s=>Object.fromEntries(['owned','stock','extra','scrap','items','parts','cars','pullUsed','quizUsed'].map(key=>[key,s[key]]));
 for(const mode of ['merged','standalone'])for(const variant of ['baseline','current']){
  const context=await browser.newContext({timezoneId:'Asia/Seoul',serviceWorkers:'block'}),page=await context.newPage(),runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')runtimeErrors.push(message.text());});
  try{
   const hash=await openApp(page,variant==='baseline'?baselineURL:appURL,'promo-boundaries'),before=await state(page);
   const schedule=await page.evaluate(mode=>{
    const promo=mode==='merged'?PROMOS[PROMOS.length-1]:PROMOS.find(p=>!NOTICES.some(n=>n.from<=p.from&&p.from<n.until));
    const notice=NOTICES.find(n=>n.from<=promo.from&&promo.from<n.until);
    return {promo:JSON.parse(JSON.stringify(promo)),notice:notice?JSON.parse(JSON.stringify(notice)):null};
   },mode);
   expect(!!schedule.notice).toBe(mode==='merged');
   await page.clock.setFixedTime(new Date(schedule.promo.from));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   const modal=mode==='merged'?'#noticeModal':'#promoModal';await expect(page.locator(modal)).toBeVisible();
   await expect(page.locator('#noticeModal.show,#promoModal.show')).toHaveCount(1);
   const shown=await state(page);expect(shown.promoSeen).toBe(schedule.promo.key);expect(shown.promoDone).toBe(before.promoDone);
   expect(shown.noticeSeen).toBe(schedule.notice?schedule.notice.key:before.noticeSeen);expect(resources(shown)).toEqual(resources(before));
   const saved=await page.evaluate(()=>localStorage.getItem(KEY));expect(JSON.parse(saved)).toEqual(shown);
   if(mode==='merged'){await expect(page.locator('#noticeGo')).toBeVisible();await expect(page.locator('#promoBar')).not.toBeVisible();}
   await page.locator(mode==='merged'?'#noticeOk':'#promoGo').click();
   await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('#noticeModal.show,#promoModal.show')).toHaveCount(0);
   expect(await state(page)).toEqual(shown);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(saved);
   let ended=null;
   if(mode==='merged'){
    await page.clock.setFixedTime(new Date(schedule.promo.to));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('#toast')).toHaveClass(/show/);ended=await state(page);expect(ended.promoDone).toBe(schedule.promo.key);expect(ended.promoSeen).toBe(schedule.promo.key);expect(ended.noticeSeen).toBe(schedule.notice.key);expect(resources(ended)).toEqual(resources(before));
    const endedSaved=await page.evaluate(()=>localStorage.getItem(KEY));expect(JSON.parse(endedSaved)).toEqual(ended);await page.locator('#toastX').click();
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('#toast')).not.toHaveClass(/show/);expect(await state(page)).toEqual(ended);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(endedSaved);
   }
   expect(runtimeErrors).toEqual([]);rows.push({mode,variant,hash,schedule,before,shown,saved,ended,runtimeErrors});
   if(variant==='current'){const original=rows.find(row=>row.mode===mode&&row.variant==='baseline');expect({schedule,before,shown,saved,ended}).toEqual(Object.fromEntries(['schedule','before','shown','saved','ended'].map(key=>[key,original[key]])));}
  }finally{await context.close();}
 }
 await capture(info,'automatic-announcements',rows);
});
