import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,root} from '../helpers/paths.mjs';
import {openApp,state,capture,destination,settings} from '../helpers/app.mjs';
import {storageEvidence} from '../helpers/storage-evidence.mjs';
process.env.SGG_EDITION='game';storageEvidence(test);
const errors=new WeakMap();
test.beforeEach(async({page})=>{const rows=[];errors.set(page,rows);page.on('pageerror',error=>rows.push(error.message));});
test.afterEach(async({page},info)=>{
 const education=await page.evaluate(()=>({sentinel:localStorage.getItem('steelgrade_gacha_v1'),writes:window.equipmentEducationWrites}));
 expect(education.sentinel).toBe('task26-education-sentinel');expect(education.writes).toEqual([]);expect(errors.get(page)).toEqual([]);await capture(info,'education-console',{education,errors:errors.get(page)});
});
const oracle=JSON.parse(await fs.readFile(root+'/tests/fixtures/catalog.json','utf8'));
const snap=page=>page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY),saves:window.equipmentSaves}));
async function open(page){
 await openApp(page,appURL,'qp-owned');await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();await destination(page,'research');
 await page.evaluate(()=>{S.items=Object.fromEntries(ITEMS.map(it=>[it.key,1]));Object.keys(S.stock).forEach(id=>S.stock[id]=0);refresh();save();localStorage.setItem('steelgrade_gacha_v1','task26-education-sentinel');window.equipmentEducationWrites=[];const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='steelgrade_gacha_v1')equipmentEducationWrites.push(key);return write.call(this,key,value);};const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name==='steelgrade_gacha')equipmentEducationWrites.push(this.transaction.db.name);return put.apply(this,args);};window.equipmentSaves=0;const original=save;save=function(){equipmentSaves++;return original();};});
}
async function select(page,key='shield',id='ga-270E'){
 await page.locator(`#items [data-item-key="${key}"]`).click();await page.locator(`[data-equip-id="${id}"]`).click();
}
async function ready(page){await expect(page.locator('#equipmentArt')).toHaveAttribute('aria-busy','false');await expect(page.locator('#equipmentArt [data-status="error"]')).toHaveCount(0);}
async function shot(page,info,name,value){await fs.mkdir(info.outputDir,{recursive:true});await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));await page.screenshot({path:info.outputPath(name+'.png')});await capture(info,name,value);}

test('all 103 real compatible selections and 107 face previews preserve stock-zero state and installed items',async({page},info)=>{
 test.setTimeout(100000);await open(page);const rows=[],actual=await page.evaluate(()=>ITEMS.map(it=>({key:it.key,ids:allChars().filter(c=>it.fit(c)).map(c=>c.id)})));
 for(const item of actual){
  expect(item.ids.filter(id=>id!=='qp-1470').sort()).toEqual(oracle.items.find(it=>it.key===item.key).fit.slice().sort());
  await page.locator(`#items [data-item-key="${item.key}"]`).evaluate(button=>button.click());
  expect(await page.locator('[data-equip-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.equipId).sort())).toEqual(item.ids.slice().sort());
  await page.locator('#pickLater').evaluate(button=>button.click());
  for(const id of item.ids){
   await page.evaluate(({key,id})=>{S.items=Object.fromEntries(ITEMS.map(it=>[it.key,it.key!==key&&it.fit(findChar(id))?id:1]));refresh();},{key:item.key,id});
   const before=await snap(page);await page.locator(`#items [data-item-key="${item.key}"]`).evaluate(button=>button.click());await page.locator(`[data-equip-id="${id}"]`).evaluate(button=>button.click());await ready(page);
   const installed=await page.evaluate(id=>itemsOf(id).map(it=>it.key),id);
   for(const side of oracle.cards.find(c=>c.id===id).alt?['front','alt']:['front']){
    if(side==='alt'){await page.locator('[data-equipment-side="alt"]').evaluate(button=>button.click());await ready(page);}
    const shown=await page.locator('#equipmentArt [data-item]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item));expect(shown.slice().sort()).toEqual([...installed,item.key].sort());
    await page.locator('[data-equipment-mode="before"]').evaluate(button=>button.click());await ready(page);expect(await page.locator('#equipmentArt [data-item]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item).sort())).toEqual(installed.slice().sort());
    await page.locator('[data-equipment-mode="preview"]').evaluate(button=>button.click());await ready(page);expect(await snap(page)).toEqual(before);
    rows.push({key:item.key,id,side,installed,shown});
   }
   await page.locator('#equipCancel').evaluate(button=>button.click());expect(await snap(page)).toEqual(before);
   await page.evaluate(()=>{S.items=Object.fromEntries(ITEMS.map(it=>[it.key,1]));refresh();});
  }
 }
 expect(actual.reduce((n,it)=>n+it.ids.length,0)).toBe(103);expect(rows).toHaveLength(107);expect(rows).toContainEqual(expect.objectContaining({key:'arrow',id:'qp-1470'}));await capture(info,'all-103-107',rows);
});

test('explicit confirmation commits once before attach cue and QP game backup restores stock-zero equipment',async({page},info)=>{
 await open(page);await select(page,'arrow','qp-1470');await ready(page);await page.locator('[data-equipment-mode="before"]').click();await ready(page);await expect(page.locator('#equipmentArt [data-item="arrow"]')).toHaveCount(0);const before=await snap(page);
 await page.evaluate(()=>{window.equipmentTrace=[];const original=save;save=function(){equipmentTrace.push('save');return original();};const audio=GAME_AUDIO;GAME_AUDIO={...audio,play(id){equipmentTrace.push(id);return Promise.resolve(false);}};});
 await page.locator('#equipConfirm').evaluate(button=>{button.click();button.dispatchEvent(new MouseEvent('click'));});
 await expect(page.locator('[data-equipment-mode="before"]')).toHaveAttribute('aria-pressed','false');await expect(page.locator('[data-equipment-mode="preview"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-equipment-mode="preview"]')).toHaveText('장착 완료');await expect(page.locator('#equipmentArt')).toHaveAttribute('data-mode','complete');await expect(page.locator('#equipmentArt [data-item="arrow"]')).toHaveCount(1);
 const after=await snap(page);expect(after.saves-before.saves).toBe(1);const expected=JSON.parse(before.state);expected.items.arrow='qp-1470';expect(JSON.parse(after.state)).toEqual(expected);expect(JSON.parse(after.saved)).toEqual(expected);
 expect(await page.evaluate(()=>equipmentTrace.slice(0,2))).toEqual(['save','equip.attach']);await page.locator('#pkDone2').click();
 await settings(page);await page.locator('#btnBackup').click();const code=await page.locator('#bkOut').inputValue();expect(code).toMatch(/^SGG-GAME1\./);
 await page.locator('#bkIn').fill(code);await page.locator('#bkLoad').click();await expect(page.locator('#bkPreview')).toBeVisible();await page.locator('#bkConfirm').click();
 expect((await state(page)).items.arrow).toBe('qp-1470');expect((await state(page)).stock).toEqual(expected.stock);await shot(page,info,'qp-backup-roundtrip',{before,after,restored:await state(page)});
});

for(const change of ['remove-item','elsewhere','remove-owned','incompatible'])test(`current ${change} state rejects stale confirmation without save`,async({page},info)=>{
 await open(page);await select(page);await ready(page);
 await page.evaluate(change=>{if(change==='remove-item')delete S.items.shield;if(change==='elsewhere')S.items.shield='ssial-270C';if(change==='remove-owned')delete S.owned['ga-270E'];if(change==='incompatible'){const item=findItem('shield');item.fit=()=>false;}},change);
 const before=await snap(page);await page.locator('#equipConfirm').click();expect(await snap(page)).toEqual(before);await expect(page.locator('#equipConfirm')).toBeDisabled();await expect(page.locator('#equipmentArt .game-card')).toHaveCount(0);
 await shot(page,info,'stale-'+change,{before,after:await snap(page)});await page.keyboard.press('Escape');
});

test('no candidates invalid keys and invalid candidate cannot mutate progress or markup',async({page},info)=>{
 await open(page);await page.evaluate(()=>{S.owned={};refresh();});const before=await snap(page);
 for(const key of ['unknown','<img src=x onerror="window.injected=true">'])await page.evaluate(key=>openPickTarget(key),key);
 await expect(page.locator('#pickModal')).toBeHidden();await page.locator('#items [data-item-key="shield"]').click();await expect(page.locator('.guarantee-empty')).toBeVisible();await expect(page.locator('[data-equip-id]')).toHaveCount(0);await page.keyboard.press('Escape');expect(await snap(page)).toEqual(before);
 await page.evaluate(()=>{S.owned={'ga-270E':true};refresh();});await page.locator('#items [data-item-key="shield"]').click();await page.locator('[data-equip-id]').evaluate(button=>button.dataset.equipId='qp-1470');const candidate=await snap(page);await page.locator('[data-equip-id]').click();expect(await snap(page)).toEqual(candidate);expect(await page.evaluate(()=>!!window.injected)).toBe(false);await capture(info,'invalid-eligibility',{before,candidate,after:await snap(page)});
});

test('cancel Escape route item changes and detached controls never commit or retain preview',async({page},info)=>{
 await open(page);const before=await snap(page);
 for(const close of ['cancel','escape','route']){
  await select(page);await ready(page);await page.locator('#equipConfirm').evaluate(el=>window.detachedConfirm=el);
  await page.locator('[data-preview-item="potion"]').click();await ready(page);await page.locator('#equipTargets').click();await expect(page.locator('#equipmentArt')).toHaveCount(0);await page.locator('[data-equip-id="ga-270E"]').click();await ready(page);
  if(close==='cancel')await page.locator('#equipCancel').click();if(close==='escape')await page.keyboard.press('Escape');if(close==='route')await page.evaluate(()=>{location.hash='#dex';});
  await expect(page.locator('#pickModal')).toBeHidden();await page.evaluate(()=>detachedConfirm.dispatchEvent(new MouseEvent('click')));expect(await snap(page)).toEqual(before);await expect(page.locator('#equipmentArt')).toHaveCount(0);
  if(close==='route')await destination(page,'research');
 }
 await select(page);await page.locator('#pickX').click();expect(await snap(page)).toEqual(before);await capture(info,'cancel-lifecycle',{before,after:await snap(page)});
});

test('denied storage keeps confirmed memory and exposes backup without repeating save',async({page},info)=>{
 await open(page);await select(page);const before=await snap(page);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('owned task26 denial','QuotaExceededError');return original.call(this,key,value);};});
 await page.locator('#equipConfirm').click();const after=await snap(page);expect(JSON.parse(after.state).items.shield).toBe('ga-270E');expect(after.saved).toBe(before.saved);expect(after.saves-before.saves).toBe(1);expect(await page.evaluate(()=>storeWarn)).not.toBe('');
 await page.locator('#pkDone2').click();await page.locator('#warnGo').click();await expect(page.locator('#bkOut')).toBeVisible();expect(await page.locator('#bkOut').inputValue()).toMatch(/^SGG-GAME1\./);await shot(page,info,'storage-denied',{before,after});
});

test('failed image retries update live status and cancel aborts pending old handles',async({page},info)=>{
 const release=JSON.parse(await fs.readFile(root+'/game-release.json','utf8'));const url=release.files.find(row=>/\/item-shield\..*\.webp$/.test(row.path)).path;await page.route('**/'+url,r=>r.abort());await open(page);const before=await snap(page);await select(page);
 await expect(page.locator('#equipmentArt [data-status="error"]')).toHaveCount(1);await expect(page.locator('#equipmentLoad')).toContainText('불러오지 못');await page.unroute('**/'+url);await expect(page.locator('#equipmentArt .game-asset-fallback')).toHaveCount(0);await page.locator('#equipmentArt [data-asset="item:shield"] .game-card-fallback button').click();await ready(page);await expect(page.locator('#equipmentLoad')).toHaveText('');expect(await snap(page)).toEqual(before);await shot(page,info,'image-recovered',{before,after:await snap(page)});
 await page.locator('#equipCancel').click();let pending;await page.route('**/'+url,r=>{pending=r;});await select(page);await expect.poll(()=>Boolean(pending)).toBe(true);await page.locator('#equipCancel').click();await pending.abort();await expect(page.locator('#equipmentArt')).toHaveCount(0);expect(await snap(page)).toEqual(before);await capture(info,'pending-disposed',{before,after:await snap(page)});
});

for(const width of [390,1280])test(`before preview explicit actions full body keyboard and nested card return ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:900});await open(page);await page.evaluate(()=>{S.items.potion='ga-270E';refresh();});const before=await snap(page);await select(page);await ready(page);
 for(const mode of ['before','preview']){
  await page.locator(`[data-equipment-mode="${mode}"]`).click();await ready(page);
  const geometry=await page.locator('#pickBox').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,art:document.querySelector('#equipmentArt').getBoundingClientRect().toJSON(),confirm:document.querySelector('#equipConfirm').getBoundingClientRect().toJSON(),cancel:document.querySelector('#equipCancel').getBoundingClientRect().toJSON(),character:getComputedStyle(document.querySelector('#equipmentArt .game-card-character img')).objectFit,targets:[...el.querySelectorAll('.equipment-modes button,.equipment-actions button')].map(n=>n.getBoundingClientRect().height)}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(geometry.character).toBe('contain');expect(geometry.targets.every(n=>n>=44)).toBe(true);await expect(page.locator('#equipConfirm')).toBeInViewport({ratio:1});await expect(page.locator('#equipCancel')).toBeInViewport({ratio:1});await shot(page,info,`equipment-${mode}-${width}`,geometry);
 }
 await page.locator('#equipConfirm').focus();await page.keyboard.press('Tab');await expect(page.locator('#equipCancel')).toBeFocused();await page.keyboard.press('Escape');expect(await snap(page)).toEqual(before);
 await destination(page,'dex');await page.locator('#dex [data-card-id="ga-1470H"]').click();await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();await page.locator('#cardEquipmentToggle').click();await page.locator('[data-card-equipment="arrow"]').click();await page.locator('[data-equip-id="ga-1470H"]').click();await page.locator('#equipConfirm').click();await page.locator('#pkDone2').click();await expect(page.locator('#cardEquipmentToggle')).toBeFocused();await expect(page.locator('#cardBox')).toHaveAttribute('data-side','alt');await expect(page.locator('#materialArt [data-item="arrow"]')).toHaveCount(1);await shot(page,info,`nested-return-${width}`,await snap(page));
});

test('global fallback still repairs non-compositor art without activating its host',async({page},info)=>{
 const release=JSON.parse(await fs.readFile(root+'/game-release.json','utf8')),url=release.files.find(row=>/\/car-d\..*\.webp$/.test(row.path)).path;
 await page.route('**/'+url,route=>route.abort());await open(page);const before=await snap(page);
 await page.evaluate(url=>{const host=document.createElement('button');host.id='equipmentFallbackHost';host.type='button';host.setAttribute('aria-label','일반 그림 검증');host.onclick=()=>{window.unwantedEquipmentHost=true;};const img=new Image();img.id='equipmentFallbackImage';img.alt='일반 차량 그림';img.style.width='160px';img.src=url;host.append(img);document.body.append(host);},url);
 const retry=page.locator('#equipmentFallbackHost + .game-asset-fallback button');await expect(retry).toBeVisible();expect(await page.locator('button button').count()).toBe(0);await shot(page,info,'non-compositor-failed',{before});
 await page.unroute('**/'+url);await retry.focus();await page.keyboard.press('Enter');await expect.poll(()=>page.locator('#equipmentFallbackImage').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);await expect(page.locator('#equipmentFallbackHost + .game-asset-fallback')).toHaveCount(0);await expect(page.locator('#equipmentFallbackHost')).toBeFocused();expect(await page.evaluate(()=>!!window.unwantedEquipmentHost)).toBe(false);expect(await snap(page)).toEqual(before);await capture(info,'non-compositor-recovered',{before,after:await snap(page)});
});
