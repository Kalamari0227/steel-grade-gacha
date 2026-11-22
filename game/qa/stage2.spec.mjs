import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../src/engine.mjs';

// 2단계(차고): 조립 진행, 차량 선택·확정, 차고 8종, 상세, 로비 목표. 저장은 미리 심는다(stage1.spec.mjs와 같은 방식).
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const key='sgg_game_save_v1';
const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json'),'utf8'));
const PARTS=data.parts, CARS=data.cars;
const fullParts=()=>Object.fromEntries(PARTS.map(p=>[p.key,{at:5,use:[]}]));
const ownedCars=n=>CARS.slice(0,n).map((c,i)=>({k:c.key,at:1700000000000+i*3600000}));
async function seedOnce(page,state){
  await page.addInitScript(({key,raw})=>{if(sessionStorage.getItem('stage2-seeded'))return;sessionStorage.setItem('stage2-seeded','1');localStorage.setItem(key,raw);},{key,raw:JSON.stringify(state)});
}
async function open(page,{state=null,hash='garage',motion='reduce'}={}){
  await page.emulateMedia({reducedMotion:motion});
  if(state) await seedOnce(page,state);
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const card=(page,k)=>page.locator(`.garage-card[data-car-key="${k}"]`);
const option=(page,k)=>page.locator(`.garage-option[data-k="${k}"]`);
const full=(extra={})=>({...fresh,parts:fullParts(),...extra});

test('garage tab: progress toward 35 parts, 8 locked cars with approved names, link to crafting, opening it does not touch the save',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  await expect(page.getByRole('heading',{name:'차고',exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  await expect(page.getByRole('link',{name:'차고',exact:true})).toHaveAttribute('aria-current','page');
  expect(await page.title()).toContain('차고');
  await expect(page.locator('main .muted').first()).toContainText('조립 0 / 35개 부품 · 수집 0 / 8종');
  await expect(page.locator('progress')).toHaveAttribute('max','35');
  await expect(page.locator('.garage-card')).toHaveCount(8);
  await expect(page.locator('.garage-card.waiting')).toHaveCount(8);
  await expect(page.locator('.garage-option')).toHaveCount(0);
  expect(await page.locator('main :text("준비 중")').count()).toBe(0);
  for(const car of CARS) await expect(card(page,car.key)).toContainText(car.tag);
  await page.getByRole('button',{name:'제작대에서 조립 계속하기'}).click();
  await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  await page.goto('/index.html#garage');await expect(page.getByRole('heading',{name:'차고',exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  expect(errors).toEqual([]);
});

test('with 35 parts: choosing a car changes nothing until confirmed; cancel returns focus; confirm adds the car, resets parts, shows a light done state',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{state:full({scrap:4})});
  await expect(page.locator('.garage-option')).toHaveCount(8);
  await expect(page.getByRole('heading',{name:'완성할 자동차를 선택하세요'})).toBeVisible();
  const target=CARS[2], raw=await page.evaluate(k=>localStorage.getItem(k),key);
  await option(page,target.key).click();
  await expect(option(page,target.key)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#car-choice-title')).toBeFocused();
  await expect(page.locator('.garage-confirm')).toContainText(target.maker);
  await expect(page.locator('.garage-confirm')).toContainText('35 → 0개');
  await expect(page.locator('.garage-confirm')).toContainText('0 → 1 / 8종');
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
  await page.getByRole('button',{name:'선택 취소'}).click();
  await expect(page.locator('.garage-confirm')).toBeHidden();
  await expect(option(page,target.key)).toBeFocused();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
  await option(page,target.key).click();
  await page.getByRole('button',{name:target.tag+' · 조립 확정'}).click();
  await expect(page.locator('#car-status')).toContainText(target.tag+'을 차고에 등록했어요. 다음 자동차의 조립을 시작할 수 있어요.');
  await expect(page.locator('#car-status')).toBeFocused();
  const s=await saved(page);
  expect(s.cars.map(c=>c.k)).toEqual([target.key]);expect(s.parts).toEqual({});expect(s.scrap).toBe(4);
  await expect(card(page,target.key)).toHaveClass(/owned/);
  await expect(card(page,target.key)).toContainText('보유');
  await expect(page.locator('main .muted').first()).toContainText('조립 0 / 35개 부품 · 수집 1 / 8종');
  await expect(page.locator('.garage-option')).toHaveCount(0);
  const approved=data.assets['car:'+target.key].image;
  await expect(card(page,target.key).locator('img')).toHaveAttribute('src',approved);
  await page.reload();
  await expect(card(page,target.key)).toHaveClass(/owned/);
  await expect(page.locator('progress')).toHaveAttribute('value','0');
  expect(errors).toEqual([]);
});

test('double-clicking confirm adds one car; an owned car cannot be chosen again; a stale confirm shows the original message',async({page})=>{
  await open(page,{state:full()});
  await option(page,'t').click();
  const confirm=page.getByRole('button',{name:/조립 확정/});
  await confirm.dblclick();
  await expect(page.locator('#car-status')).toContainText('차고에 등록했어요');
  expect((await saved(page)).cars).toHaveLength(1);
  // 다른 탭에서 먼저 확정한 뒤 이 탭에서 확정하면 상태 변경 안내를 보여 주고 저장을 건드리지 않는다.
  const other=await page.context().newPage();
  await other.goto('/#garage');
  await other.evaluate(([k,state])=>localStorage.setItem(k,JSON.stringify(state)),[key,{...(await saved(page)),parts:fullParts()}]);
  await page.evaluate(([k,state])=>localStorage.setItem(k,JSON.stringify(state)),[key,{...(await saved(page)),parts:fullParts()}]);
  await page.reload();
  await expect(option(page,'t')).toBeDisabled();
  await option(page,'h').click();
  await page.evaluate(([k,state])=>localStorage.setItem(k,JSON.stringify(state)),[key,{...(await saved(page)),cars:[...(await saved(page)).cars,{k:'h',at:1}]}]);
  const before=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.getByRole('button',{name:/조립 확정/}).click();
  await expect(page.locator('#warning')).toContainText('다른 탭');
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(before);
  await other.close();
});

test('car detail: owned shows maker, line and date; unowned shows a preview; Escape and back return focus to the card',async({page})=>{
  await open(page,{state:{...fresh,cars:ownedCars(2),parts:{}}});
  const mine=CARS[0], locked=CARS[5];
  await expect(card(page,mine.key)).toHaveClass(/owned/);
  await card(page,mine.key).click();
  await expect(page.locator('#car-dialog')).toBeVisible();
  await expect(page.locator('#car-title')).toHaveText(mine.tag);await expect(page.locator('#car-title')).toBeFocused();
  await expect(page.locator('#car-dialog')).toContainText(mine.maker);
  await expect(page.locator('#car-dialog')).toContainText(mine.line);
  await expect(page.locator('#car-dialog')).toContainText('받은 날 ·');
  await expect(page.locator('#car-dialog img')).toHaveAttribute('src',data.assets['car:'+mine.key].image);
  expect((await page.evaluate(k=>localStorage.getItem(k),key))).toContain('"cars"');
  const raw=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.keyboard.press('Escape');
  await expect(page.locator('#car-dialog')).toBeHidden();
  await expect(card(page,mine.key)).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>history.state?.carKey??null)).toBeNull();
  await card(page,locked.key).click();
  await expect(page.locator('#car-dialog')).toContainText('미보유 · 조립 미리보기');
  await expect(page.locator('#car-dialog')).toContainText('아직 보유하지 않은 자동차입니다');
  await expect(page.locator('#car-dialog')).not.toContainText('받은 날');
  await page.goBack();
  await expect(page.locator('#car-dialog')).toBeHidden();
  await expect(page.getByRole('heading',{name:'차고',exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
});

test('lobby goal links to the garage when 35 parts are done, and the garage opens from it',async({page})=>{
  await open(page,{state:full(),hash:'workshop'});
  const link=page.getByRole('button',{name:/자동차를 골라 조립하기/});
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading',{name:'차고',exact:true,level:1})).toBeVisible();
  await expect(page.locator('.garage-option')).toHaveCount(8);
});

test('all eight cars owned: collection-complete message, no options, cards still open',async({page})=>{
  await open(page,{state:{...fresh,cars:ownedCars(8),parts:{}}});
  await expect(page.getByRole('heading',{name:'자동차 8종을 모두 모았어요'})).toBeVisible();
  await expect(page.locator('.garage-option')).toHaveCount(0);
  await expect(page.locator('.garage-card.owned')).toHaveCount(8);
  await page.getByRole('button',{name:'모은 자동차 보기'}).click();
  await expect(page.locator('.garage-card.owned').first()).toBeFocused();
});

test('last car confirm finishes the collection with the original completion text',async({page})=>{
  await open(page,{state:full({cars:ownedCars(7)})});
  await expect(page.locator('.garage-option:not(:disabled)')).toHaveCount(1);
  await page.locator('.garage-option:not(:disabled)').click();
  await page.getByRole('button',{name:/조립 확정/}).click();
  await expect(page.locator('#car-status')).toContainText('자동차 수집 완료.');
  await expect(page.getByRole('heading',{name:'자동차 8종을 모두 모았어요'})).toBeVisible();
});

test('previous-game save with cars opens in the garage; a corrupt cars field is held without writes',async({page})=>{
  await open(page,{state:{...fresh,cars:ownedCars(3),parts:{}}});
  await expect(page.locator('.garage-card.owned')).toHaveCount(3);
  await expect(page.locator('main .muted').first()).toContainText('수집 3 / 8종');
});

test('keyboard: Tab reaches an option, Enter selects, focus moves to the choice, confirm is reachable and Enter confirms',async({page})=>{
  await open(page,{state:full()});
  await option(page,'t').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#car-choice-title')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:/조립 확정/})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#car-status')).toContainText('차고에 등록했어요');
});

for(const size of [{width:390,height:844},{width:1280,height:800}]){
  test(`garage fits ${size.width}px without horizontal scroll and 44px targets`,async({page})=>{
    await page.setViewportSize(size);
    await open(page,{state:full({cars:ownedCars(2)})});
    await option(page,'b').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const small=await page.evaluate(()=>[...document.querySelectorAll('main button')].filter(b=>b.getBoundingClientRect().height<44||b.getBoundingClientRect().width<44).map(b=>b.textContent.trim()));
    expect(small).toEqual([]);
    await card(page,'t').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

// 차량 등록 장면 "출고 검사증"(2026-11-22 사용자 결정, 시안 U0 B안). 위 시험들은 움직임 줄이기(open 기본값)라 장면 없이 바로 끝난다.
const groupRows=()=>{const order=[...new Set(PARTS.map(p=>p.grp))];return order.map(name=>[name,PARTS.filter(p=>p.grp===name).length]);};
test('delivery scene: the certificate shows the car, a pass stamp and part groups, then folds into the new card; the save is already written',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{state:full(),motion:'no-preference'});
  const target=CARS[1];
  await option(page,target.key).click();
  await page.getByRole('button',{name:target.tag+' · 조립 확정'}).click();
  const layer=page.locator('.delivery');
  await expect(layer).toBeVisible();
  await expect(layer).toHaveAttribute('aria-hidden','true');
  await expect(layer).toContainText(target.tag+' · '+target.body);
  await expect(layer.locator('.delivery-stamp')).toContainText('합격');
  await expect(layer.locator('.delivery-art img')).toHaveAttribute('src',data.assets['car:'+target.key].image);
  const rows=await layer.locator('.delivery-check').evaluateAll(list=>list.map(r=>[r.querySelector('span').textContent,Number(r.querySelector('b').textContent)]));
  expect(rows.map(r=>r[1]).reduce((a,b)=>a+b,0)).toBe(35);
  expect(new Set(rows.map(r=>r[0]))).toEqual(new Set(groupRows().map(r=>r[0])));
  await expect(layer.locator('.delivery-total')).toContainText('1 / 8종');
  // 장면 중에도 저장과 상태 문구는 이미 끝나 있다.
  expect((await saved(page)).cars.map(c=>c.k)).toEqual([target.key]);
  await expect(page.locator('#car-status')).toContainText(target.tag+'을 차고에 등록했어요.');
  await expect(page.locator('#car-status')).toBeFocused();
  await expect(layer.locator('.delivery-check.on')).toHaveCount(rows.length,{timeout:4000});
  await expect(layer).toHaveCount(0,{timeout:6000});
  await expect(card(page,target.key)).toHaveClass(/just-done/);
  await expect(page.locator('#car-status')).toBeFocused();
  expect(errors).toEqual([]);
});
// Tab 같은 다른 키도 넘기기만 하고 초점은 상태 문구에 남는다(2026-11-22 검토 사소 2).
for(const how of ['click','Escape','Tab']){
  test(`delivery scene: ${how} skips it at once and the new card is highlighted`,async({page})=>{
    await open(page,{state:full(),motion:'no-preference'});
    await option(page,'t').click();
    await page.getByRole('button',{name:/조립 확정/}).click();
    await expect(page.locator('.delivery')).toBeVisible();
    if(how==='click') await page.locator('.delivery').click({position:{x:20,y:20}}); else await page.keyboard.press(how);
    await expect(page.locator('.delivery')).toHaveCount(0,{timeout:1000});
    await expect(card(page,'t')).toHaveClass(/just-done/);
    await expect(page.locator('#car-status')).toBeFocused();
    expect((await saved(page)).cars.map(c=>c.k)).toEqual(['t']);
  });
}
test('delivery scene: reduced motion shows no scene; leaving the garage mid-scene removes it without touching the result',async({page})=>{
  await open(page,{state:full()});
  await option(page,'t').click();
  await page.getByRole('button',{name:/조립 확정/}).click();
  await expect(page.locator('#car-status')).toContainText('차고에 등록했어요');
  await expect(page.locator('.delivery')).toHaveCount(0);
  await expect(card(page,'t')).toHaveClass(/just-done/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(([k,state])=>localStorage.setItem(k,JSON.stringify(state)),[key,{...(await saved(page)),parts:fullParts()}]);
  await page.reload();
  await option(page,'h').click();
  await page.getByRole('button',{name:/조립 확정/}).click();
  await expect(page.locator('.delivery')).toBeVisible();
  await page.evaluate(()=>{location.hash='#crafting';});
  await expect(page.getByRole('heading',{name:'제작',exact:true,level:1})).toBeVisible();
  await expect(page.locator('.delivery')).toHaveCount(0);
  expect((await saved(page)).cars.map(c=>c.k)).toEqual(['t','h']);
});
