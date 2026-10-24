import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {root,appURL,evidenceRoot} from './helpers/paths.mjs';
import {openApp,state,capture,destination} from './helpers/app.mjs';
const catalog=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const errors=new WeakMap();
test.beforeEach(async({page})=>{const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});});
test.afterEach(async({page},info)=>{await capture(info,'console',errors.get(page));expect(errors.get(page)).toEqual([]);});
async function record(info,name,value){await capture(info,name,value);await fs.mkdir(evidenceRoot,{recursive:true});await fs.writeFile(`${evidenceRoot}/${name}.json`,JSON.stringify(value,null,2));}
async function snap(page,name){await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'),undefined,{timeout:5000});await fs.mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:`${evidenceRoot}/${name}.png`});}
async function responseSettled(page){
  const target=await page.locator('#pickBox').evaluate(box=>{
    const res=box.querySelector('#pkres'),r=res.getBoundingClientRect(),b=box.getBoundingClientRect();
    return Math.max(0,Math.min(box.scrollHeight-box.clientHeight,box.scrollTop+r.bottom-(b.top+box.clientTop+box.clientHeight)));
  });
  try{await page.waitForFunction(target=>Math.abs(document.getElementById('pickBox').scrollTop-target)<=1,target,{timeout:5000});}
  catch(error){
    const geometry=await page.locator('#pickBox').evaluate(box=>({scrollTop:box.scrollTop,scrollHeight:box.scrollHeight,clientHeight:box.clientHeight,box:box.getBoundingClientRect().toJSON(),response:box.querySelector('#pkres').getBoundingClientRect().toJSON(),responseStyle:getComputedStyle(box.querySelector('#pkres')).cssText,fonts:document.fonts.status,calls:window.__itemScroll}));
    throw new Error(JSON.stringify({target,geometry}),{cause:error});
  }
  return page.locator('#pickBox').evaluate((box,target)=>({target,scrollTop:box.scrollTop,box:box.getBoundingClientRect().toJSON(),response:box.querySelector('#pkres').getBoundingClientRect().toJSON()}),target);
}
async function setup(page,fixture='crafting-ready'){await openApp(page,appURL,fixture);await destination(page,'learn');}
async function order(page,key){await page.evaluate(key=>{S.orderDay=today();S.orderKey=key;S.orderDone=0;refresh();},key);await page.locator('#btnOrder').click();}
function unchangedResources(after,before){expect(after.stock).toEqual(before.stock);expect(after.owned).toEqual(before.owned);expect(after.extra).toBe(before.extra);expect(after.scrap).toBe(before.scrap);expect(after.quizUsed).toBe(before.quizUsed);}

test('@orders-items-happy all14 acquire equip stock0 nested card and stored states',async({page},info)=>{
  await setup(page);await page.evaluate(()=>{Object.keys(S.stock).forEach(id=>S.stock[id]=0);refresh();});const rows=[];
  for(const item of catalog.items){
    await order(page,item.key);const before=await state(page),wrong=catalog.items.find(it=>it.key!==item.key);
    await page.locator(`[data-choice="${wrong.key}"]`).click();expect(await state(page)).toEqual(before);
    await expect(page.locator('#pkres')).toContainText(catalog.orders.find(o=>o.item===item.key).no);
    await page.locator(`[data-choice="${item.key}"]`).click();const acquired=await state(page);
    expect(acquired.items[item.key]).toBe(1);expect(acquired.orderDone).toBe(1);unchangedResources(acquired,before);
    await expect(page.locator('#pkres')).toContainText(catalog.orders.find(o=>o.item===item.key).yes);
    if(!rows.length){const geometry=await responseSettled(page);await expect(page.locator('#pkEquip')).toBeInViewport({ratio:1});await expect(page.locator('#pkDone')).toBeInViewport({ratio:1});await snap(page,'customer');await record(info,'customer-layout',geometry);}
    await page.locator('#pkEquip').click();expect(await page.evaluate(()=>dialogStack.filter(row=>row.el.id==='pickModal').length)).toBe(1);
    const ids=await page.locator('[data-equip-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.equipId));expect(ids.slice().sort()).toEqual(item.fit.slice().sort());
    const id=ids[0],beforeCard=await state(page);await page.locator(`[data-guarantee-card="${id}"]`).click();
    await expect(page.locator('#cardModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator(`[data-guarantee-card="${id}"]`)).toBeFocused();expect(await state(page)).toEqual(beforeCard);
    await page.locator(`[data-equip-id="${id}"]`).click();const equipped=await state(page);expect(equipped.items[item.key]).toBe(id);unchangedResources(equipped,before);
    await page.locator('#pkDone2').click();
    await page.locator(`#items [data-item-key="${item.key}"]`).click();await expect(page.locator('#cardGuarantees')).toContainText(item.tag);
    await page.keyboard.press('Escape');await expect(page.locator(`#items [data-item-key="${item.key}"]`)).toBeFocused();
    rows.push({key:item.key,before,acquired,equipped,ids});
  }
  expect(rows).toHaveLength(14);await expect(page.locator('#items .guarantee-item')).toHaveCount(14);await expect(page.locator('#items img')).toHaveCount(14);
  await expect(page.locator('#order')).toContainText('14종에 모두 대응');await page.setViewportSize({width:1280,height:1200});await page.locator('#items').screenshot({path:`${evidenceRoot}/items14.png`});await record(info,'items14',rows);
  const saved=await state(page);await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);expect((await state(page)).items).toEqual(saved.items);
});

test('@orders-items-happy later keeps acquired guarantee and card learning link returns to learning',async({page},info)=>{
  await setup(page);const item=catalog.items[0];await order(page,item.key);await page.locator(`[data-choice="${item.key}"]`).click();const acquired=await state(page);
  await page.locator('#pkDone').click();await expect(page.locator('#customerTitle')).toBeFocused();expect(await state(page)).toEqual(acquired);
  await expect(page.locator(`#items [data-item-key="${item.key}"]`)).toContainText('미장착');await page.locator(`#items [data-item-key="${item.key}"]`).click();
  const id=await page.locator('[data-equip-id]').first().getAttribute('data-equip-id');await page.locator(`[data-equip-id="${id}"]`).click();await page.locator('#pkDone2').click();
  await expect(page.locator(`#items [data-item-key="${item.key}"]`)).toBeFocused();await page.locator(`#items [data-item-key="${item.key}"]`).click();
  await page.locator('[data-card-learning]').click();await expect(page.locator('#view-learn')).toBeVisible();await expect(page.locator('#cardModal')).not.toHaveClass(/show/);
  await record(info,'later',{acquired,after:await state(page)});
});

test('@orders-items-negative no candidates no owned guarantee and incompatible targets cannot equip',async({page},info)=>{
  await setup(page,'new');const before=await state(page);await expect(page.locator('#btnOrder')).toHaveCount(0);
  const saved=await page.evaluate(()=>localStorage.getItem(KEY)),locked=[];
  await expect(page.locator('#items [data-item-key]')).toHaveCount(14);
  for(const item of catalog.items){
    const cell=page.locator('#items [data-item-key="'+item.key+'"]');await expect(cell).toHaveClass(/waiting/);await expect(cell.locator('small')).toHaveText('미획득');
    const semantics=await cell.evaluate(el=>({tag:el.tagName,tabIndex:el.tabIndex,role:el.getAttribute('role'),controls:el.querySelectorAll('button,a,input,select,[tabindex]').length}));
    expect(semantics.tag).toBe('DIV');expect(semantics.tabIndex).toBe(-1);expect(semantics.role).not.toBe('button');expect(semantics.controls).toBe(0);
    await cell.click();await expect(page.locator('.modal.show,.tview.show')).toHaveCount(0);expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(saved);locked.push({key:item.key,semantics});
  }
  await capture(info,'locked-guarantees',{before,saved,locked,after:await state(page),savedAfter:await page.evaluate(()=>localStorage.getItem(KEY))});
  await page.evaluate(()=>openPickTarget('shield'));await expect(page.locator('#pickModal')).not.toHaveClass(/show/);expect(await state(page)).toEqual(before);
  await page.evaluate(()=>{S.items.shield=1;refresh();});await page.locator('[data-item-key="shield"]').click();
  await expect(page.locator('.guarantee-empty')).toBeVisible();await expect(page.locator('[data-equip-id]')).toHaveCount(0);const held=await state(page);await snap(page,'incompatible');
  await page.locator('#pickLater').click();expect(await state(page)).toEqual(held);
  await page.evaluate(()=>{S.owned={'wr-SWRM':true};S.stock={'wr-SWRM':0};refresh();});await page.locator('[data-item-key="shield"]').click();
  await expect(page.locator('[data-equip-id]')).toHaveCount(0);await record(info,'no-candidates',{before,held,after:await state(page)});
});

test('@orders-items-negative stale demand quota and duplicate judgement cannot grant twice',async({page},info)=>{
  await setup(page);const rows=[];
  for(const change of ['key','day','quota','owned','no-fit']){
    await page.evaluate(()=>{S.items={};S.owned=Object.fromEntries(POOL.map(id=>[id,true]));});await order(page,'shield');
    await page.evaluate(change=>{
      if(change==='key')S.orderKey='dagger';if(change==='day')S.orderDay='old';if(change==='quota')S.orderDone=orderMax();
      if(change==='owned')S.items.shield=1;if(change==='no-fit')S.owned={};
    },change);
    const before=await state(page);await page.locator('[data-choice="shield"]').click();expect(await state(page)).toEqual(before);
    await page.locator('#pickX').click();rows.push({change,before,after:await state(page)});
  }
  await page.evaluate(()=>{S.items={};S.owned=Object.fromEntries(POOL.map(id=>[id,true]));});await order(page,'shield');
  await page.evaluate(()=>{const button=document.querySelector('[data-choice="shield"]');button.click();button.dispatchEvent(new MouseEvent('click'));});
  expect((await state(page)).orderDone).toBe(1);expect((await state(page)).items.shield).toBe(1);
  await page.locator('#pkDone').click();const before=await state(page);await page.evaluate(()=>openPick());await expect(page.locator('#pickModal')).not.toHaveClass(/show/);expect(await state(page)).toEqual(before);
  await record(info,'unchanged-state',rows);
});

test('@orders-items-negative stale target ownership acquired state and double events preserve resources',async({page},info)=>{
  await setup(page);const rows=[];
  for(const change of ['remove-owned','remove-item','already-equipped','double']){
    await page.evaluate(()=>{S.owned=Object.fromEntries(POOL.map(id=>[id,true]));S.items={shield:1};refresh();});await page.locator('[data-item-key="shield"]').click();
    const id=await page.locator('[data-equip-id]').first().getAttribute('data-equip-id');
    await page.evaluate(({change,id})=>{if(change==='remove-owned')delete S.owned[id];if(change==='remove-item')delete S.items.shield;if(change==='already-equipped')S.items.shield='ssial-270C';},{change,id});
    const before=await state(page);
    await page.locator(`[data-equip-id="${id}"]`).evaluate(button=>{button.click();button.dispatchEvent(new MouseEvent('click'));});
    const after=await state(page);if(change==='double'){expect(after.items.shield).toBe(id);unchangedResources(after,before);}else expect(after).toEqual(before);
    rows.push({change,before,after});await page.locator('#pickX').click();
  }
  await record(info,'stale-equipment',rows);
});

test('@orders-items-happy all14 compatibility and equipped fixture display use original oracle',async({page},info)=>{
  await setup(page,'equipped-items');const before=await state(page);
  const observed=await page.evaluate(()=>ITEMS.map(it=>({key:it.key,fit:POOL.filter(id=>it.fit(findChar(id))),owned:fitOwned(it.key)})));
  for(const row of observed){const oracle=catalog.items.find(it=>it.key===row.key);expect(row.fit).toEqual(oracle.fit);expect(row.owned.slice().sort()).toEqual(oracle.fit.slice().sort());}
  for(const item of catalog.items){await expect(page.locator(`[data-item-key="${item.key}"]`)).toContainText('장착');await expect(page.locator(`[data-item-key="${item.key}"]`)).toContainText(item.scope);}
  expect(await state(page)).toEqual(before);await record(info,'compatibility14',observed);
});

for(const width of [360,768,1280])test(`@orders-items-happy keyboard layout and reduced motion ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await order(page,'shield');
  await page.evaluate(()=>{window.__itemScroll=[];const old=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){window.__itemScroll.push(options);return old.call(this,options);};});
  await page.locator('[data-choice="shield"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#pkres')).toBeFocused();const responseGeometry=await responseSettled(page);await expect(page.locator('#pkEquip')).toBeInViewport({ratio:1});await expect(page.locator('#pkDone')).toBeInViewport({ratio:1});
  expect(await page.locator('#pickBox').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await snap(page,`customer-${width}`);
  await page.locator('#pkEquip').click();await expect(page.locator('#targetTitle')).toBeFocused();await expect(page.locator('#targetTitle')).toBeInViewport({ratio:1});
  expect(await page.evaluate(()=>dialogStack.filter(row=>row.el.id==='pickModal').length)).toBe(1);
  const detail=page.locator('[data-guarantee-card]').first();await detail.click();await expect(page.locator('#cardModal')).toBeVisible();
  await page.keyboard.press('Escape');await expect(detail).toBeFocused();await expect(detail).toBeInViewport();
  expect(await page.evaluate(()=>dialogStack.filter(row=>row.el.id==='pickModal').length)).toBe(1);await page.keyboard.press('Shift+Tab');
  expect(await page.locator('#pickModal').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  const calls=await page.evaluate(()=>window.__itemScroll);expect(calls.length).toBeGreaterThan(0);expect(calls.every(x=>['auto','instant'].includes(x.behavior))).toBe(true);
  await snap(page,`targets-${width}`);await page.keyboard.press('Escape');await expect(page.locator('#customerTitle')).toBeFocused();await record(info,`keyboard-${width}`,{calls,responseGeometry});
});
