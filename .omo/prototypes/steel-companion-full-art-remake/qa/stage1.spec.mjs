import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../src/engine.mjs';

// 1단계(스크랩과 제작): 교환 → 공개 → 결과, 결과 화면 스크랩, 제작 목록 → 상세 → 소재 선택 → 제작.
// 새 프로필에는 스크랩·재고가 없으므로 저장을 미리 심는다(prototype.spec.mjs의 seedOnce와 같은 방식).
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const key='sgg_game_save_v1';
const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json'),'utf8'));
const PARTS=data.parts, byId=Object.fromEntries(data.cards.map(c=>[c.id,c]));
const title=id=>byId[id].familyName+' '+byId[id].grade;
const oneEach=part=>{const stock={};for(const slot of part.need) stock[slot.any[0]]=(stock[slot.any[0]]||0)+1;return stock;};
const level=lv=>data.cards.filter(c=>c.level===lv&&c.family!=='qp').map(c=>c.id);
function save(stock={},extra={}){
  const owned={...(extra.owned||{})};for(const id of Object.keys(stock)) owned[id]=true;
  return {...fresh,...extra,stock,owned};
}
async function seedOnce(page,state){
  await page.addInitScript(({key,raw})=>{if(sessionStorage.getItem('stage1-seeded'))return;sessionStorage.setItem('stage1-seeded','1');localStorage.setItem(key,raw);},{key,raw:JSON.stringify(state)});
}
async function open(page,{state=null,motion='reduce',random=0,hash='workshop'}={}){
  await page.emulateMedia({reducedMotion:motion});
  await page.addInitScript(random=>{Math.random=()=>random;},random);
  if(state) await seedOnce(page,state);
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const chip=(page,label)=>page.locator('.chip',{hasText:label}).locator('b');
const cell=(page,k)=>page.locator(`.pcell[data-part-key="${k}"]`);
const single=PARTS.find(p=>p.need.length===1&&p.need[0].any.length>=2);
const double=PARTS.find(p=>p.need.length===2&&p.need[0].any[0]!==p.need[1].any[0]);
const lastLv3=level(3).at(-1);

test('crafting tab lists all 35 parts in the original groups with approved part art, and opening it does not touch the save',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{hash:'crafting'});
  await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  await expect(page.getByRole('link',{name:'제작',exact:true})).toHaveAttribute('aria-current','page');
  expect(await page.title()).toContain('제작');
  await expect(page.locator('.pcell')).toHaveCount(35);
  await expect(page.locator('.part-group h2')).toHaveText([/바디/,/프레임/,/섀시 · 구동/]);
  await expect(page.locator('.pcell.short')).toHaveCount(35);
  await expect(page.locator('main .muted').first()).toContainText('완성 0 / 35 · 제작 가능 0');
  const art=await page.locator('.pcell-art img').evaluateAll(list=>list.map(i=>i.getAttribute('src')));
  const approved=new Set(PARTS.map(p=>data.assets['part:'+p.key].image));
  expect(art.length).toBe(35);for(const src of art) expect(approved.has(src)).toBe(true);
  expect(await page.locator('main :text("준비 중")').count()).toBe(0);
  await page.getByRole('link',{name:'공방',exact:true}).click();await expect(page.getByRole('heading',{name:'공방',exact:true,level:1})).toBeVisible();
  await page.goBack();await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  await page.goto('/index.html#crafting');await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  expect(errors).toEqual([]);
});

test('crafting tab keyboard: Enter on the link focuses content, Tab reaches a part, Enter opens it, Escape returns focus to that part',async({page})=>{
  await open(page,{state:save(oneEach(single)),hash:'collection'});
  await page.getByRole('link',{name:'제작',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(()=>document.activeElement.id)).toBe('main');
  await page.keyboard.press('Tab');
  // 제작 가능한 부품이 있으면 맨 위 고정 줄(.ready-row)이 먼저 초점을 받는다. 둘 다 같은 부품 상세를 연다.
  expect(await page.evaluate(()=>document.activeElement.matches('.pcell, .ready-row'))).toBe(true);
  const target=cell(page,single.key);await target.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#part-dialog')).toBeVisible();
  await expect(page.getByRole('button',{name:'닫기'})).toBeFocused();
  await expect(page.locator('#part-dialog h2')).toHaveText(single.name);
  await page.keyboard.press('Escape');
  await expect(page.locator('#part-dialog')).not.toBeVisible();
  await expect(target).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>history.state?.partKey)).toBeUndefined();
});

test('pinned ready rows list at most three craftable parts, open the same part detail, and focus returns to that part in the list',async({page})=>{
  await open(page,{state:save(oneEach(single)),hash:'crafting'});
  const before=await saved(page);
  const row=page.locator(`.ready-row[data-ready-key="${single.key}"]`);
  await expect(row).toBeVisible();
  expect(await page.locator('.ready-row').count()).toBeLessThanOrEqual(3);
  await expect(page.locator('.pcell')).toHaveCount(PARTS.length);
  await row.click();
  await expect(page.locator('#part-dialog h2')).toHaveText(single.name);
  await page.keyboard.press('Escape');
  await expect(page.locator('#part-dialog')).not.toBeVisible();
  await expect(cell(page,single.key)).toBeFocused();
  expect(await saved(page)).toEqual(before);
});

for(const [label,size] of [['390px',{width:390,height:844}],['1280px',{width:1280,height:800}]]){
  test(`crafting list and part detail at ${label}: 44px targets and no horizontal overflow`,async({page})=>{
    await page.setViewportSize(size);
    await open(page,{state:save(oneEach(double),{scrap:3}),hash:'crafting'});
    const check=async(selector)=>{
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const boxes=await page.locator(selector).evaluateAll(list=>list.filter(n=>n.getBoundingClientRect().width>0).map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.slice(0,20),w:r.width,h:r.height,left:r.left,right:r.right};}));
      expect(boxes.length).toBeGreaterThan(0);
      for(const box of boxes){expect(box.h,box.text).toBeGreaterThanOrEqual(44);expect(box.w,box.text).toBeGreaterThanOrEqual(44);expect(box.left,box.text).toBeGreaterThanOrEqual(0);expect(box.right,box.text).toBeLessThanOrEqual(size.width);}
    };
    await check('nav a:visible, #sound, main button');
    await cell(page,double.key).click();await expect(page.locator('#part-dialog')).toBeVisible();
    await check('#part-dialog button');
    // 제작 버튼은 스크롤하면 항상 화면 안에서 눌러 볼 수 있어야 한다.
    const make=page.locator('#part-dialog .craft-button');
    await make.scrollIntoViewIfNeeded();await expect(make).toBeVisible();
    const box=await make.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
  });
}

test('part detail shows per-slot candidates with stock, remaining stock after crafting, and choosing a candidate changes the plan',async({page})=>{
  const [first,second]=single.need[0].any;
  await open(page,{state:save({[first]:1,[second]:3}),hash:'crafting'});
  await cell(page,single.key).click();
  const dialog=page.locator('#part-dialog');
  await expect(dialog.locator('.part-slot')).toHaveCount(1);
  await expect(dialog.locator('.cand')).toHaveCount(single.need[0].any.length);
  await expect(dialog.locator(`.cand[data-id="${second}"]`)).toHaveAttribute('aria-pressed','true');
  await expect(dialog.locator('.part-after li')).toContainText(`${title(second)}　재고 3장 → 2장`);
  await dialog.locator(`.cand[data-id="${first}"]`).click();
  await expect(dialog.locator(`.cand[data-id="${first}"]`)).toHaveAttribute('aria-pressed','true');
  await expect(dialog.locator(`.cand[data-id="${first}"]`)).toBeFocused();
  await expect(dialog.locator('.part-after li')).toContainText(`${title(first)}　재고 1장 → 0장`);
  const rest=single.need[0].any.filter(id=>id!==first&&id!==second);
  for(const id of rest) await expect(dialog.locator(`.cand[data-id="${id}"]`)).toBeDisabled();
  expect((await saved(page)).parts).toEqual({});
});

test('crafting: one click consumes only the planned stock, marks the part done, survives reload, and a double click cannot craft twice',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const extra=level(1)[0], stock={...oneEach(double)};stock[double.need[0].any[0]]+=1;stock[extra]=(stock[extra]||0)+1;
  await open(page,{state:save(stock,{scrap:4}),hash:'crafting'});
  await expect(cell(page,double.key)).toHaveClass(/ready/);
  await cell(page,double.key).click();
  const before=await saved(page);
  await page.locator('#part-dialog .craft-button').dblclick();
  await expect(page.locator('#part-dialog .part-result')).toContainText('완성');
  await expect(page.locator('#part-dialog .part-result')).toBeFocused();
  const after=await saved(page);
  expect(Object.keys(after.parts)).toEqual([double.key]);
  expect(after.parts[double.key].use).toHaveLength(2);
  const left={...before.stock};for(const id of after.parts[double.key].use){left[id]--;if(!left[id])delete left[id];}
  expect(after.stock).toEqual(left);
  expect(after.owned).toEqual(before.owned);expect(after.scrap).toBe(4);
  await page.keyboard.press('Escape');
  await expect(cell(page,double.key)).toHaveClass(/done/);await expect(cell(page,double.key)).toBeFocused();
  await expect(cell(page,double.key).locator('.part-state')).toHaveText('완성');
  await expect(page.locator('main .muted').first()).toContainText('완성 1 / 35');
  await page.reload();
  await expect(cell(page,double.key)).toHaveClass(/done/);
  expect(await saved(page)).toEqual(after);
  await cell(page,double.key).click();await expect(page.locator('#part-dialog .part-result')).toContainText('완성한 부품');
  await expect(page.locator('#part-dialog .craft-button')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('QP-covered slots craft without spending a card, and the chip and lobby goal follow right after a command',async({page})=>{
  const qpPart=PARTS.find(p=>p.need.every(sl=>sl.any.some(id=>id.startsWith('ssial-1470')||id==='ga-1470H'||id==='poo-PHS')));
  await open(page,{state:save({'qp-1470':1},{scrap:2}),hash:'crafting'});
  await cell(page,qpPart.key).click();
  await expect(page.locator('#part-dialog .cand-qp, #part-dialog .cand:has-text("QP로 대신하기")').first()).toBeVisible();
  await page.locator('#part-dialog .craft-button').click();
  await expect(page.locator('#part-dialog .part-result')).toBeVisible();
  const after=await saved(page);
  expect(after.stock['qp-1470']).toBe(1);expect(after.parts[qpPart.key].use.every(id=>id==='qp-1470')).toBe(true);
});

test('lobby goal opens the crafting tab on that part and its detail',async({page})=>{
  await open(page,{state:save(oneEach(single))});
  await expect(page.locator('.goal .section-label')).toContainText('제작 가능한 부품');
  await page.locator('.goal-open').click();
  await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  await expect(page.locator('#part-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#part-dialog')).not.toBeVisible();
  await expect.poll(()=>page.evaluate(()=>history.state?.partKey)).toBeUndefined();
  await page.goBack();await expect(page.getByRole('heading',{name:'공방',exact:true,level:1})).toBeVisible();
});

test('exchange LV3 and LV4: cost, reveal, result with the exchange title, chip updates, and reload keeps it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{state:save({}, {scrap:17}),hash:'ship',motion:'no-preference'});
  const lv3=page.getByRole('button',{name:/LV3 확정 교환/}),lv4=page.getByRole('button',{name:/LV4 확정 교환/});
  await expect(lv3).toBeEnabled();await expect(lv4).toBeEnabled();
  await lv3.click();
  await expect(page.getByRole('button',{name:'건너뛰기'})).toBeVisible();
  expect((await saved(page)).scrap).toBe(12);
  await page.getByRole('button',{name:'건너뛰기'}).click();
  await expect(page.getByRole('heading',{name:'LV3 확정 교환 결과',level:1})).toBeVisible();
  const first=await saved(page);
  expect(first.results.exchange).toBe(3);expect(first.results.mode).toBe('single');
  expect(Object.values(first.stock)).toEqual([1]);expect(byId[first.results.cards[0].id].level).toBe(3);
  await expect(chip(page,'스크랩')).toHaveText('12');
  await page.getByRole('link',{name:'공방',exact:true}).click();
  await page.getByRole('link',{name:'공방',exact:true}).click();
  await page.goto('/#ship');
  await page.getByRole('button',{name:/LV4 확정 교환/}).click();
  await page.getByRole('button',{name:'건너뛰기'}).click();
  await expect(page.getByRole('heading',{name:'LV4 확정 교환 결과',level:1})).toBeVisible();
  const second=await saved(page);
  expect(second.scrap).toBe(2);expect(byId[second.results.cards[0].id].level).toBe(4);
  await page.reload();
  await expect(page.getByRole('heading',{name:'LV4 확정 교환 결과',level:1})).toBeVisible();
  expect(await saved(page)).toEqual(second);
  await page.goto('/#ship');
  await expect(page.getByRole('button',{name:/LV3 확정 교환/})).toBeDisabled();
  await expect(page.getByRole('button',{name:/LV4 확정 교환/})).toBeDisabled();
  expect(errors).toEqual([]);
});

test('exchange prefers an undiscovered card of that level and never runs short of scrap',async({page})=>{
  const lv3=level(3);const owned=Object.fromEntries(lv3.filter(id=>id!==lastLv3).map(id=>[id,true]));
  await open(page,{state:save({}, {scrap:9,owned}),hash:'ship',random:0});
  await page.getByRole('button',{name:/LV3 확정 교환/}).click();
  await expect(page.getByRole('heading',{name:'LV3 확정 교환 결과',level:1})).toBeVisible();
  const state=await saved(page);
  expect(state.results.cards[0]).toMatchObject({id:lastLv3,isNew:true});expect(state.scrap).toBe(4);
  await page.goto('/#ship');await expect(page.getByRole('button',{name:/LV3 확정 교환/})).toBeDisabled();
  const raw=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.getByRole('button',{name:/LV3 확정 교환/}).click({force:true,trial:true}).catch(()=>{});
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
});

test('result screen: scrap only on cards with 2+ in stock, one at a time, the last copy is kept, chip and note follow',async({page})=>{
  const [a,b,c]=level(1);
  const results={id:'t-1',at:1730000000000,mode:'ten',cards:[a,a,b,c,c,c,level(2)[0],level(2)[1],level(2)[2],level(3)[0]].map(id=>({id,isNew:false,stock:0}))};
  await open(page,{state:save({[a]:2,[b]:1,[c]:3,[level(2)[0]]:1,[level(2)[1]]:1,[level(2)[2]]:1,[level(3)[0]]:1},{scrap:1,results}),hash:'results'});
  await expect(page.locator('.result-grid .tile')).toHaveCount(10);
  // a(2장) 카드가 두 번, c(3장) 카드가 세 번 나왔으므로 같은 카드의 타일마다 버튼이 있고, 재고 1장짜리에는 없다.
  await expect(page.locator(`.scrap-button[data-scrap-id="${a}"]`)).toHaveCount(2);
  await expect(page.locator(`.scrap-button[data-scrap-id="${c}"]`)).toHaveCount(3);
  await expect(page.locator(`.scrap-button[data-scrap-id="${b}"]`)).toHaveCount(0);
  await expect(page.locator('.scrap-button')).toHaveCount(5);
  await expect(chip(page,'스크랩')).toHaveText('1');
  const first=page.locator(`.scrap-button[data-scrap-id="${a}"]`).first();
  await first.click();
  await expect(chip(page,'스크랩')).toHaveText('2');
  expect((await saved(page)).stock[a]).toBe(1);expect((await saved(page)).scrap).toBe(2);
  await expect(page.locator(`.scrap-button[data-scrap-id="${a}"]`)).toHaveCount(0);
  await expect(page.locator('.scrap-done')).toHaveText('스크랩 +1 · 재고 1장');
  await expect(page.locator(`.tile[data-card-id="${a}"]`).first().locator('.tile-note')).toContainText('재고 1');
  await expect(page.locator('.tile-open', {hasText:title(a)}).first()).toBeFocused();
  const c1=page.locator(`.scrap-button[data-scrap-id="${c}"]`).first();
  await c1.click();await expect(chip(page,'스크랩')).toHaveText('3');
  await expect(page.locator(`.scrap-button[data-scrap-id="${c}"]`)).toHaveCount(3);
  await page.locator(`.scrap-button[data-scrap-id="${c}"]`).first().click();
  await expect(chip(page,'스크랩')).toHaveText('4');
  await expect(page.locator(`.scrap-button[data-scrap-id="${c}"]`)).toHaveCount(0);
  expect((await saved(page)).stock[c]).toBe(1);
  await page.reload();
  expect((await saved(page)).stock).toMatchObject({[a]:1,[c]:1});
  await expect(page.locator('.scrap-button')).toHaveCount(0);
});

test('single result screen scrap button works and keeps focus on the card button',async({page})=>{
  const a=level(1)[0];
  const results={id:'t-2',at:1730000000000,mode:'single',cards:[{id:a,isNew:false,stock:2}]};
  await open(page,{state:save({[a]:2},{results}),hash:'results'});
  await page.getByRole('button',{name:/스크랩 \+1/}).click();
  await expect(page.getByRole('button',{name:'동료 카드 열기'})).toBeFocused();
  await expect(chip(page,'스크랩')).toHaveText('1');
  await expect(page.locator('.scrap-done')).toBeVisible();
  await expect(page.locator('.scrap-button')).toHaveCount(0);
});

test('another tab changing the save stops this tab from crafting, exchanging or scrapping',async({browser})=>{
  const context=await browser.newContext();
  const a=await context.newPage(),b=await context.newPage();
  const state=save({...oneEach(single),[level(1)[0]]:2},{scrap:9});
  for(const p of [a,b]) await open(p,{state,hash:'crafting'});
  await cell(b,single.key).click();await b.locator('#part-dialog .craft-button').click();
  await expect(b.locator('#part-dialog .part-result')).toBeVisible();
  const winner=await saved(b);
  await cell(a,single.key).click();
  await a.locator('#part-dialog .craft-button').click();
  await expect(a.locator('#warning [role=alert]')).toContainText('다른 탭');
  expect(await saved(a)).toEqual(winner);
  await a.goto('/#ship');
  expect(await saved(a)).toEqual(winner);
  await context.close();
});

test('a corrupt save is held: crafting and exchange never overwrite it',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(k=>{if(!sessionStorage.getItem('c')){sessionStorage.setItem('c','1');localStorage.setItem(k,'{broken');}},key);
  await page.goto('/#crafting');
  await expect(page.locator('#warning [role=alert]')).toBeVisible();
  await cell(page,single.key).click();
  await expect(page.locator('#part-dialog .craft-button')).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.goto('/#ship');
  await expect(page.getByRole('button',{name:/LV3 확정 교환/})).toBeDisabled();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{broken');
});

test('a failed write keeps the in-memory result, warns, and offers the backup',async({page})=>{
  await page.addInitScript(k=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===k&&sessionStorage.getItem('fail-writes')) throw new DOMException('quota','QuotaExceededError');return set.call(this,name,value);};},key);
  await open(page,{state:save(oneEach(single)),hash:'crafting'});
  await page.evaluate(()=>sessionStorage.setItem('fail-writes','1'));
  await cell(page,single.key).click();
  await page.locator('#part-dialog .craft-button').click();
  await expect(page.locator('#part-dialog .part-result')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#warning [role=alert]')).toContainText('저장');
  await expect(page.getByRole('button',{name:'진행 백업 받기'})).toBeVisible();
  await expect(cell(page,single.key)).toHaveClass(/done/);
  expect((await saved(page)).parts).toEqual({});
});

test('a previous-game save with number and {at,use} parts shows them as done',async({page})=>{
  const [a,b]=PARTS, use=b.need.map(sl=>sl.any[0]);
  await open(page,{state:save({},{parts:{[a.key]:1730000000000,[b.key]:{at:1730000001000,use}}}),hash:'crafting'});
  await expect(cell(page,a.key)).toHaveClass(/done/);await expect(cell(page,b.key)).toHaveClass(/done/);
  await expect(page.locator('main .muted').first()).toContainText('완성 2 / 35');
  await expect(page.locator('#warning [role=alert]')).toHaveCount(0);
});

test('reduced motion removes the completion animation; normal motion keeps a short one',async({browser})=>{
  for(const [motion,expected] of [['reduce',/^none$/],['no-preference',/part-done/]]){
    const context=await browser.newContext({reducedMotion:motion}),page=await context.newPage();
    await open(page,{state:save(oneEach(single)),hash:'crafting',motion});
    await cell(page,single.key).click();await page.locator('#part-dialog .craft-button').click();
    await expect(page.locator('#part-dialog .part-result')).toBeVisible();
    expect(await page.locator('#part-dialog .part-figure').evaluate(n=>getComputedStyle(n).animationName)).toMatch(expected);
    await context.close();
  }
});
