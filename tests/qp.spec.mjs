import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,evidenceRoot} from './helpers/paths.mjs';
import {openApp,state,capture,destination} from './helpers/app.mjs';

const errors=new WeakMap();
test.beforeEach(async({page})=>{
  const list=[];errors.set(page,list);
  page.on('pageerror',error=>list.push(error.message));
  page.on('console',message=>{if(message.type()==='error')list.push(message.text());});
  await page.emulateMedia({reducedMotion:'reduce'});
});
test.afterEach(async({page},info)=>{await capture(info,'console',errors.get(page));expect(errors.get(page)).toEqual([]);});
async function setup(page,fixture='qp-ready'){
  await openApp(page,appURL,fixture);await destination(page,'dex');
}
async function enter(page){
  await page.getByRole('button',{name:'선행개발 과제 열기',exact:true}).click();
  await expect(page.locator('#qpTitle')).toBeFocused();
}
async function choice(page,slot,id){
  const section=page.locator(`.qp-cost-slot[data-slot="${slot}"]`);
  if(!await section.locator('details').evaluate(el=>el.open))await section.locator('summary').click();
  await section.locator(`button[data-id="${id}"]`).click();
  await expect(section.locator(`button[data-id="${id}"]`)).toBeFocused();
  await expect(section.locator(`button[data-id="${id}"]`)).toBeInViewport();
}
async function record(info,name,value){
  await capture(info,name,value);await fs.mkdir(evidenceRoot,{recursive:true});
  await fs.writeFile(`${evidenceRoot}/${name}.json`,JSON.stringify(value,null,2));
}
async function snap(page,info,name){
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.modal.show')).every(el=>el.getAnimations({subtree:true}).every(a=>a.playState==='finished')));
  const file=info.outputPath(`${name}.png`);await page.screenshot({path:file});
  await fs.mkdir(evidenceRoot,{recursive:true});await fs.copyFile(file,`${evidenceRoot}/${name}.png`);
}

test('@qp-happy exact development cost once then B pillar free and ordinary choices',async({page},info)=>{
  await setup(page);
  await page.evaluate(()=>{S.stock['ssial-980Y']=2;S.stock['poo-PHS']=1;S.owned['ssial-980Y']=true;refresh();});
  const before=await state(page);await enter(page);
  await expect(page.locator('.qp-development')).toHaveAttribute('data-qp-state','ready');
  await expect(page.locator('#qpScrap')).toHaveText('10 → 0장');await snap(page,info,'development');
  await page.locator('#devBtn').click();
  await expect(page.locator('.draw-header h2')).toHaveText('선행개발 완료');
  await expect(page.locator('#pullBox')).toBeVisible();
  await expect(page.locator('.draw-header h2')).toBeVisible();
  await expect(page.locator('.draw-coil')).not.toBeVisible();
  await snap(page,info,'development-result');
  const developed=await state(page);
  expect(developed.stock).toEqual({'qp-1470':1,'ssial-980Y':2,'poo-PHS':1});expect(developed.scrap).toBe(0);
  expect(developed.owned).toEqual({...before.owned,'qp-1470':true});expect(developed.pullUsed).toBe(before.pullUsed);
  await page.locator('[data-draw-close]').click();
  await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
  expect((await state(page)).stock).toEqual(developed.stock);
  await destination(page,'workshop');await page.locator('[data-part-key="bpillar"]').click();
  expect(await page.locator('.craft-slot').evaluateAll(rows=>rows.map(r=>r.dataset.selectedId))).toEqual(['qp-1470','ssial-980Y']);
  await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','1');await snap(page,info,'qp-slot');
  await page.locator('#mkBtn').click();const free=await state(page);
  expect(free.stock).toEqual({'qp-1470':1,'ssial-980Y':1,'poo-PHS':1});expect(free.parts.bpillar.use).toEqual(['qp-1470','ssial-980Y']);
  await page.keyboard.press('Escape');await page.evaluate(saved=>{applySaved(saved);refresh();},developed);
  await page.locator('[data-part-key="bpillar"]').click();await page.locator('.craft-slot').first().locator('summary').click();
  await page.locator('.craft-slot button[data-id="poo-PHS"]').click();
  await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','2');await page.locator('#mkBtn').click();
  const explicit=await state(page);expect(explicit.stock).toEqual({'qp-1470':1,'ssial-980Y':1});
  expect(explicit.parts.bpillar.use).toEqual(['poo-PHS','ssial-980Y']);expect(explicit.owned).toEqual(developed.owned);
  await record(info,'state-diff',{before,developed,free,explicit});
});

test('@qp-happy explicit development candidate consumes chosen CR and preserves abundant GA',async({page},info)=>{
  await setup(page);await page.evaluate(()=>{S.stock['ga-1180Y']=3;S.owned['ga-1180Y']=true;refresh();});
  const before=await state(page);await enter(page);
  await expect(page.locator('.qp-cost-slot').nth(1)).toHaveAttribute('data-selected-id','ga-1180Y');
  const selectionBefore={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))};
  await choice(page,1,'ssial-1180Y');
  const selectionAfter={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))};
  expect(selectionAfter).toEqual(selectionBefore);await capture(info,'selection-only',{before:selectionBefore,after:selectionAfter,selected:'ssial-1180Y'});
  await expect(page.locator('.qp-cost-slot').nth(1)).toHaveAttribute('data-selected-id','ssial-1180Y');
  await page.keyboard.press('Tab');expect(await page.locator('#partModal').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.locator('#devBtn').click();const after=await state(page);
  expect(after.stock).toEqual({'ga-1180Y':3,'qp-1470':1});expect(after.scrap).toBe(0);
  expect(after.owned).toEqual({...before.owned,'qp-1470':true});await record(info,'explicit-development',{before,after});
});

test('@qp-negative all three discovery requirements gate entry independently of stock',async({page},info)=>{
  await setup(page);const fixture=await state(page),rows=[];
  for(const id of ['ssial-1470M','ga-1470H','poo-PHS']){
    await page.evaluate(({fixture,id})=>{applySaved(structuredClone(fixture));delete S.owned[id];refresh();},{fixture,id});
    const before=await state(page);
    expect(await page.evaluate(()=>qpRevealed())).toBe(false);
    await expect(page.getByRole('button',{name:'선행개발 과제 열기',exact:true})).toHaveCount(0);
    await page.evaluate(()=>openDevelop());await expect(page.locator('#partModal')).not.toBeVisible();
    expect(await state(page)).toEqual(before);rows.push({missing:id,before,after:await state(page)});
  }
  await page.evaluate(fixture=>{applySaved(fixture);S.stock={};refresh();},fixture);
  expect(await page.evaluate(()=>qpRevealed())).toBe(true);await enter(page);await expect(page.locator('#devBtn')).toBeDisabled();
  await snap(page,info,'development-insufficient');
  await record(info,'discovery-blocked',rows);
});

test('@qp-negative scrap9 missing1470M missing1180 and owned block charges',async({page},info)=>{
  await setup(page);const fixture=await state(page),rows=[];
  for(const patch of [{scrap:9},{stock:{'ssial-1180Y':1}},{stock:{'ssial-1470M':1}}]){
    await page.evaluate(({fixture,patch})=>{applySaved({...structuredClone(fixture),...patch});refresh();},{fixture,patch});
    const before=await state(page);await enter(page);await expect(page.locator('#devBtn')).toBeDisabled();
    await page.evaluate(()=>document.getElementById('devBtn').click());expect(await state(page)).toEqual(before);
    await page.keyboard.press('Escape');rows.push({patch,before,after:await state(page)});
  }
  await page.evaluate(fixture=>{applySaved(fixture);S.owned[QP_ID]=true;S.stock[QP_ID]=1;refresh();},fixture);
  const owned=await state(page);await page.evaluate(()=>openDevelop());
  await expect(page.locator('#partModal')).not.toBeVisible();expect(await state(page)).toEqual(owned);
  await expect(page.getByRole('button',{name:'선행개발 과제 열기',exact:true})).toHaveCount(0);
  await record(info,'blocked',rows.concat({owned,after:await state(page)}));
});

test('@qp-negative stale inventory rechecks preview and double develop grants once',async({page},info)=>{
  await setup(page);await enter(page);await page.evaluate(()=>{S.scrap=9;});const blocked=await state(page);
  await page.locator('#devBtn').click();await expect(page.locator('#devBtn')).toBeDisabled();expect(await state(page)).toEqual(blocked);
  await page.keyboard.press('Escape');await page.evaluate(()=>{S.scrap=10;S.stock['ga-1180Y']=1;S.owned['ga-1180Y']=true;refresh();});
  await enter(page);await page.evaluate(()=>{delete S.stock['ssial-1180Y'];});const before=await state(page);
  await page.locator('#devBtn').click();expect(await state(page)).toEqual(before);
  await expect(page.locator('.qp-cost-slot').nth(1)).toHaveAttribute('data-selected-id','ga-1180Y');
  await expect(page.locator('#qpStatus')).toBeFocused();
  await page.evaluate(()=>{const button=document.getElementById('devBtn');button.click();button.click();});
  const after=await state(page);expect(after.stock).toEqual({'qp-1470':1});expect(after.scrap).toBe(0);
  expect(after.owned).toEqual({...before.owned,'qp-1470':true});
  await expect(page.locator('.draw-header h2')).toHaveText('선행개발 완료');
  await expect(page.locator('#pullBox')).toBeVisible();
  await record(info,'stale-development',{blocked,before,after});
});

test('@qp-negative free QP never covers missing980 slot',async({page},info)=>{
  await setup(page,'qp-owned');await page.evaluate(()=>{delete S.stock['ssial-980Y'];delete S.stock['ga-980Y'];refresh();});
  const before=await state(page);await destination(page,'workshop');await page.locator('[data-part-key="bpillar"]').click();
  await expect(page.locator('.craft-slot').first()).toHaveAttribute('data-selected-id','qp-1470');
  await expect(page.locator('.craft-slot').nth(1)).toHaveAttribute('data-selected-id','');await expect(page.locator('#mkBtn')).toBeDisabled();
  expect(await page.evaluate(()=>craft('bpillar'))).toBe(false);expect(await state(page)).toEqual(before);
  await record(info,'missing980',{before,after:await state(page)});
});

test('@qp-negative changed quantities and detached buttons cannot charge unseen costs',async({page},info)=>{
  await setup(page);await enter(page);
  await page.evaluate(()=>{window.oldDevelop=document.getElementById('devBtn');S.stock['ssial-1180Y']=2;S.scrap=11;});
  const before=await state(page);await page.locator('#devBtn').click();
  expect(await state(page)).toEqual(before);await expect(page.locator('#qpScrap')).toHaveText('11 → 1장');
  await expect(page.locator('.qp-cost-slot').nth(1)).toContainText('재고 2장 → 1장');
  await page.evaluate(()=>oldDevelop.click());expect(await state(page)).toEqual(before);
  await page.keyboard.press('Escape');await page.evaluate(()=>oldDevelop.click());
  expect(await state(page)).toEqual(before);await expect(page.locator('#partModal')).not.toBeVisible();
  await enter(page);await page.locator('#devBtn').click();const after=await state(page);
  expect(after.stock).toEqual({'ssial-1180Y':1,'qp-1470':1});expect(after.scrap).toBe(1);
  await record(info,'qp-stale-quantity',{before,after});
});

for(const width of [360,390,768,1280])test(`@qp-happy layout keyboard reduced motion ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await setup(page);
  await page.evaluate(()=>{S.stock['ga-1180Y']=2;S.owned['ga-1180Y']=true;refresh();});
  await enter(page);await expect(page.locator('#qpTitle')).toBeInViewport();await snap(page,info,`qp-top-${width}`);
  const statusBox=await page.locator('.qp-development .craft-top span:last-child').boundingBox();
  const closeBox=await page.locator('#partX').boundingBox();expect(statusBox.x+statusBox.width).toBeLessThanOrEqual(closeBox.x);
  await choice(page,1,'ssial-1180Y');await snap(page,info,`qp-choice-${width}`);
  await page.keyboard.press('Tab');expect(await page.locator('#partModal').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.locator('#devBtn').focus();await expect(page.locator('#devBtn')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await snap(page,info,`qp-cost-${width}`);await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'선행개발 과제 열기',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.body.classList.contains('modal-open'))).toBe(false);
  expect(await page.locator('main').evaluate(el=>el.inert)).toBe(false);
});
