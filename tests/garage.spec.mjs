import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {root,appURL,evidenceRoot,fixedTime} from './helpers/paths.mjs';
import {openApp,state,capture,destination} from './helpers/app.mjs';

const catalog=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const detailSnapshot=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY)}));
function acquisitionLabel(at){
  if(!at)return '받은 날 · —';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));
  return `받은 날 · ${parts.month}월 ${parts.day}일 ${parts.hour}:${parts.minute}`;
}
async function inspectCarDetail(page,car,before){
  const acquired=before.state.cars.find(c=>c.k===car.key);
  expect(acquired).toBeTruthy();
  const expected={key:car.key,maker:car.maker,at:acquired.at,date:acquisitionLabel(acquired.at)};
  await expect(page.locator('.garage-detail')).toBeVisible();
  await expect(page.locator('#garageCarTitle')).toBeFocused();
  await expect(page.locator('#garageCarTitle')).toHaveText(car.tag);
  await expect(page.locator('.garage-detail')).toContainText(car.line);
  await expect(page.locator('.garage-detail h4 + p')).toBeVisible();
  await expect(page.locator('.garage-detail h4 + p')).toHaveText(expected.maker);
  await expect(page.locator('.garage-date')).toBeVisible();
  await expect(page.locator('.garage-date')).toHaveText(expected.date);
  await page.locator('#garageDetailArt img').evaluate(img=>img.decode());
  const actual={title:await page.locator('#garageCarTitle').innerText(),maker:await page.locator('.garage-detail h4 + p').innerText(),date:await page.locator('.garage-date').innerText()};
  const opened=await detailSnapshot(page);expect(opened).toEqual(before);
  return {expected,actual,before,opened};
}
const errors=new WeakMap();
test.beforeEach(async({page})=>{
  const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));
  page.on('console',m=>{if(m.type()==='error')list.push(m.text());});
});
test.afterEach(async({page},info)=>{await capture(info,'console',errors.get(page));expect(errors.get(page)).toEqual([]);});
async function setup(page,fixture='all-parts'){
  await openApp(page,appURL,fixture);
  if(await page.locator('#toast').isVisible())await page.locator('#toastX').click();
  await destination(page,'garage');
}
async function settle(page){
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'),undefined,{timeout:5000});
}
async function select(page,car){
  await page.getByRole('button',{name:`${car.tag} ${car.body}`,exact:true}).click();
  await page.waitForFunction(()=>{
    const target=document.getElementById('carsay'),top=scrollY+target.getBoundingClientRect().top;
    const padding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
    const destination=Math.max(0,Math.min(top-padding,document.scrollingElement.scrollHeight-innerHeight));
    return Math.abs(scrollY-destination)<=1&&['takeCar','cancelCar'].every(id=>{
      const el=document.getElementById(id),r=el.getBoundingClientRect();
      return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&
        [[.5,.04],[.96,.5],[.5,.96],[.04,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75],[.5,.5]].every(([x,y])=>el.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));
    });
  },undefined,{timeout:5000});
  await settle(page);
  await expect(page.locator('#carChoiceTitle')).toBeFocused();
  await expect(page.locator(`.garage-option[data-k="${car.key}"]`)).toHaveAttribute('aria-pressed','true');
}
async function record(info,name,value){
  await capture(info,name,value);await fs.mkdir(evidenceRoot,{recursive:true});await fs.writeFile(`${evidenceRoot}/${name}.json`,JSON.stringify(value,null,2));
}
async function snap(page,info,name){
  await settle(page);
  const file=info.outputPath(`${name}.png`);await page.screenshot({path:file,fullPage:name==='garage'});
  await fs.mkdir(evidenceRoot,{recursive:true});await fs.copyFile(file,`${evidenceRoot}/${name}.png`);
}

test('@garage-happy eight assembly cycles keep materials and sync garage home counts',async({page},info)=>{
  await setup(page);const rows=[];
  for(const [index,car] of catalog.cars.entries()){
    if(index)await page.evaluate(()=>{S.parts=Object.fromEntries(PARTS.map(p=>[p.key,{at:Date.now(),use:[]}]));refresh();});
    const before=await state(page);expect(Object.keys(before.parts)).toHaveLength(35);await select(page,car);
    expect(await state(page)).toEqual(before);await expect(page.locator('#carsay')).toContainText('35 → 0개');
    await page.locator('#takeCar').click();const after=await state(page);
    expect(after.cars).toEqual([...before.cars,{k:car.key,at:Date.parse(fixedTime)}]);expect(after.parts).toEqual({});
    expect(after.stock).toEqual(before.stock);expect(after.owned).toEqual(before.owned);expect(after.scrap).toBe(before.scrap);
    await expect(page.locator(await page.locator('#garageStageTitle').count()?'#garageStageTitle':'#carStatus')).toBeFocused();
    await expect(page.locator('#garage .owned')).toHaveCount(index+1);
    const beforeDetail=await detailSnapshot(page);
    await page.locator(`#garage [data-car-key="${car.key}"]`).click();
    const detail=await inspectCarDetail(page,car,beforeDetail);
    await page.keyboard.press('Escape');await expect(page.locator('#partModal')).toBeHidden();
    await expect(page.locator(`#garage [data-car-key="${car.key}"]`)).toBeFocused();
    detail.closed=await detailSnapshot(page);expect(detail.closed).toEqual(beforeDetail);
    await destination(page,'workshop');await expect(page.locator('#stCars')).toHaveText(`${index+1} / 8`);await expect(page.locator('#stParts')).toHaveText('0 / 35');
    await destination(page,'garage');rows.push({car:car.key,before,after,detail});
  }
  await expect(page.locator('#carAssemblyTitle')).toHaveText('자동차 8종을 모두 모았어요');
  await expect(page.locator('#takeCar')).toHaveCount(0);await expect(page.locator('.garage-option')).toHaveCount(0);
  await snap(page,info,'garage');await record(info,'cycles',rows);expect(rows).toHaveLength(8);
  await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
  expect((await state(page)).cars.map(c=>c.k)).toEqual(catalog.cars.map(c=>c.key));
});

test('@garage-happy next assembly link and reduced motion focus',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await setup(page);const car=catalog.cars[0];await select(page,car);
  await page.evaluate(()=>{
    window.__garageScroll=[];const original=Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView=function(options){window.__garageScroll.push(options);return original.call(this,options);};
  });
  await page.locator('#takeCar').focus();await page.keyboard.press('Enter');
  await expect(page.locator(await page.locator('#garageStageTitle').count()?'#garageStageTitle':'#carStatus')).toBeFocused();
  const calls=await page.evaluate(()=>window.__garageScroll);expect(calls.length).toBeGreaterThan(0);expect(calls.every(c=>c.behavior!=='smooth')).toBe(true);
  await page.getByRole('link',{name:'제작대에서 조립 계속하기',exact:true}).click();
  await expect(page.locator('#view-craft')).toBeVisible();await expect(page.locator('#title-craft')).toBeFocused();
  await record(info,'next-assembly',{calls,after:await state(page)});
});

test('@garage-negative cancel and detached confirmation preserve all state',async({page},info)=>{
  await page.setViewportSize({width:360,height:844});
  await setup(page);const before=await state(page),car=catalog.cars[0];await select(page,car);
  await page.evaluate(()=>{window.__oldConfirm=document.getElementById('takeCar');});
  await page.locator('#cancelCar').click();await expect(page.locator('.garage-confirm')).toBeHidden();
  await expect(page.locator(`.garage-option[data-k="${car.key}"]`)).toBeFocused();
  await expect(page.locator(`.garage-option[data-k="${car.key}"]`)).toBeInViewport();
  await snap(page,info,'garage-cancel-return');
  await page.evaluate(()=>window.__oldConfirm.click());expect(await state(page)).toEqual(before);
  await record(info,'cancelled',{before,after:await state(page)});
});

test('@garage-negative 34 parts stale confirmation and already owned reject mutation',async({page},info)=>{
  await setup(page);const fixture=await state(page),car=catalog.cars[0],rows=[];
  await page.evaluate(()=>{delete S.parts[PARTS[0].key];refresh();});const short=await state(page);
  await expect(page.locator('.garage-option')).toHaveCount(0);await expect(page.locator('#takeCar')).toHaveCount(0);expect(await state(page)).toEqual(short);
  rows.push({scenario:'34 parts',before:short,after:await state(page)});
  for(const mutation of ['remove-part','already-owned','all-cars']){
    await page.evaluate(fixture=>{applySaved(structuredClone(fixture));refresh();},fixture);await select(page,car);
    await page.evaluate(({mutation,key})=>{
      if(mutation==='remove-part')delete S.parts[PARTS[0].key];
      if(mutation==='already-owned')S.cars.push({k:key,at:Date.now()});
      if(mutation==='all-cars')S.cars=CARS.map(c=>({k:c.key,at:Date.now()}));
    },{mutation,key:car.key});
    const before=await state(page);await page.locator('#takeCar').click();expect(await state(page)).toEqual(before);
    await expect(page.locator('#carStatus')).toBeFocused();rows.push({scenario:mutation,before,after:await state(page)});
  }
  await record(info,'unchanged-state',rows);
});

test('@garage-negative detached double confirm adds one car and clears parts once',async({page},info)=>{
  await setup(page,'seven-cars');const car=catalog.cars[7];const before=await state(page);await select(page,car);
  await page.evaluate(()=>{const confirm=document.getElementById('takeCar');confirm.click();confirm.click();});
  const after=await state(page);expect(after.cars).toHaveLength(8);expect(new Set(after.cars.map(c=>c.k)).size).toBe(8);
  expect(after.parts).toEqual({});expect(after.stock).toEqual(before.stock);expect(after.owned).toEqual(before.owned);
  await expect(page.locator('#takeCar')).toHaveCount(0);await record(info,'double-confirm',{before,after});
});

test('@garage-negative owned and allcars fixtures show no repeated reward path',async({page},info)=>{
  await setup(page,'all-cars');const before=await state(page);
  await expect(page.locator('#garage .owned')).toHaveCount(8);await expect(page.locator('.garage-option')).toHaveCount(0);
  await expect(page.locator('#takeCar')).toHaveCount(0);await page.locator('#garageBrowse').click();
  await expect(page.locator('#garage .owned').first()).toBeFocused();expect(await state(page)).toEqual(before);
  await record(info,'allcars',{before,after:await state(page)});
});

test('@garage-happy QP used in parts does not add a fixed card cost at confirmation',async({page},info)=>{
  await setup(page);await page.evaluate(()=>{
    S.owned[QP_ID]=true;S.stock[QP_ID]=1;
    PARTS.forEach(p=>{S.parts[p.key].use=p.need.map(sl=>qpCovers(sl)?QP_ID:sl.any[0]);});refresh();
  });
  const before=await state(page);await select(page,catalog.cars[0]);await page.locator('#takeCar').click();
  const after=await state(page);expect(after.parts).toEqual({});expect(after.cars).toHaveLength(1);
  expect(after.stock).toEqual(before.stock);expect(after.owned).toEqual(before.owned);expect(after.scrap).toBe(before.scrap);
  await record(info,'qp-parts',{before,after});
});

for(const width of [360,768,1280])test(`@garage-happy selection and detail keyboard layout ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await setup(page,'seven-cars');const car=catalog.cars[7];await select(page,car);
  expect(await page.locator('#carBox').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(page.locator('#carChoiceTitle')).toBeInViewport({ratio:1});
  await expect(page.locator('#takeCar')).toBeInViewport({ratio:1});
  const action=await page.locator('#takeCar').boundingBox(),nav=await page.locator('.destination-nav').boundingBox();
  expect(action.y+action.height).toBeLessThanOrEqual(nav.y);
  await snap(page,info,`garage-selection-${width}`);await page.locator('#cancelCar').click();
  const beforeDetail=await detailSnapshot(page),key=await page.locator('#garage .owned').first().getAttribute('data-car-key');
  const detailCar=catalog.cars.find(c=>c.key===key);expect(detailCar).toBeTruthy();
  await page.locator('#garage .owned').first().click();
  const detail=await inspectCarDetail(page,detailCar,beforeDetail);
  await page.keyboard.press('Shift+Tab');expect(await page.locator('#partModal').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');expect(await page.locator('#partModal').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  expect(await page.locator('#partBox').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await snap(page,info,`garage-detail-${width}`);await page.keyboard.press('Escape');await expect(page.locator('#partModal')).toBeHidden();
  await expect(page.locator('#garage .owned').first()).toBeFocused();
  detail.closed=await detailSnapshot(page);expect(detail.closed).toEqual(beforeDetail);
  await capture(info,'garage-detail',{width,...detail});
});
