import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';

// 3단계(고객 요구·보증 장비): 요구 → 회신 → 정답 → 장착 → 동료 카드·로비의 장착 외형, 새로고침 뒤 유지.
// 저장은 미리 심는다(stage1·2 spec과 같은 방식). 오늘의 요구는 날짜로 정해지므로 화면이 보여 주는 요구를 엔진으로 읽어 정답을 고른다.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const key='sgg_game_save_v1';
const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json'),'utf8'));
const rules=createLegacy(), CHARS=rules.allChars(), ITEMS=rules.ITEMS;
const fitKeys=c=>ITEMS.filter(i=>i.fit(c)).map(i=>i.key);
const ALL=Object.fromEntries(CHARS.map(c=>[c.id,true])), STOCK=Object.fromEntries(CHARS.map(c=>[c.id,2]));
const FOUR=CHARS.find(c=>fitKeys(c).length===4);
const base=(extra={})=>({...fresh,owned:ALL,stock:STOCK,...extra});
const approved=(cardId,side,keys)=>data.appearances.find(a=>a.cardId===cardId&&a.side===side&&a.equipmentKeys.join('+')===[...keys].sort().join('+'));
async function seedOnce(page,state){
  await page.addInitScript(({key,raw})=>{if(sessionStorage.getItem('stage3-seeded'))return;sessionStorage.setItem('stage3-seeded','1');localStorage.setItem(key,raw);},{key,raw:JSON.stringify(state)});
}
async function open(page,{state=null,hash='research',motion='reduce'}={}){
  await page.emulateMedia({reducedMotion:motion});
  if(state) await seedOnce(page,state);
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
  // 연구 탭은 보여 준 요구를 한 번 저장해 굳힌다(pinOrder). 그 저장이 끝난 뒤부터 검사한다.
  if(state&&hash==='research') await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').orderKey,key);
}
const raw=page=>page.evaluate(k=>localStorage.getItem(k),key);
const saved=async page=>JSON.parse(await raw(page));
// 화면이 지금 보여 주는 요구(엔진이 읽음; 저장은 쓰지 않는다)
const todayOrder=page=>page.evaluate(async()=>{const {createEngine}=await import('./engine.mjs');const o=createEngine().order();return {state:o.state,day:o.day,key:o.order?.key,tags:Object.fromEntries(o.choices.map(c=>[c.key,c.tag]))};});
const choice=(page,k)=>page.locator(`.reply-choice[data-choice="${k}"]`);
const cell=(page,k)=>page.locator(`.warranty[data-warranty-key="${k}"]`);
// 호환 보유 동료 하나를 고른다(장착 창은 호환 동료만 보여 준다)
const fitCard=k=>CHARS.find(c=>ITEMS.find(i=>i.key===k).fit(c));
async function answerRight(page){
  const o=await todayOrder(page);expect(o.state).toBe('open');
  await choice(page,o.key).click();
  await expect(page.locator('.order-earned')).toBeVisible();
  return o;
}

test('new profile: request sheet says none, 14 locked warranties, quiz placeholder, opening writes nothing',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  await expect(page.getByRole('heading',{name:'연구',exact:true,level:1})).toBeVisible();
  await expect(page.locator('.order-sheet')).toContainText('현재 보유 소재로 대응할 수 있는 요구가 없어요');
  await expect(page.locator('.warranty')).toHaveCount(14);await expect(page.locator('.warranty.locked')).toHaveCount(14);
  await expect(page.locator('main .placeholder-note')).toContainText('준비 중');
  expect(await raw(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('request → wrong reply grants nothing → correct reply grants the warranty → equip → card, lobby and reload show the approved look',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const start=base();
  await open(page,{state:start});
  await expect(page.locator('.order-sheet')).toContainText('오늘 회신 잔여 1 / 1건 · 보유 보증 0 / 14종');
  const before=await raw(page);
  const o=await todayOrder(page);expect(o.state).toBe('open');
  expect(await raw(page)).toBe(before);// 요구를 다시 읽어도 더 쓰지 않는다
  // 요구를 본 순간 그 요구만 저장에 굳는다(원본과 같음). 보증·재고·자원은 그대로다.
  const pinned=await saved(page);expect(pinned.orderKey).toBe(o.key);expect(pinned.orderDay).toBe(o.day);expect(pinned.orderDone).toBe(0);
  expect({...pinned,orderKey:'',orderDay:''}).toEqual({...start,orderKey:'',orderDay:''});
  const wrong=Object.keys(o.tags).find(k=>k!==o.key);
  await choice(page,wrong).click();
  await expect(choice(page,wrong)).toBeDisabled();await expect(choice(page,wrong)).toHaveClass(/wrong/);
  await expect(page.locator('#order-status')).toContainText('이 항목은 아니에요');await expect(page.locator('#order-status')).toBeFocused();
  expect(await raw(page)).toBe(before);// 오답은 지급도 저장도 없다
  await expect(page.locator('.warranty.locked')).toHaveCount(14);
  await choice(page,o.key).click();
  await expect(page.locator('.order-earned')).toContainText('대응 완료');
  const afterRight=await saved(page);
  expect(afterRight.items).toEqual({[o.key]:1});expect(afterRight.orderDone).toBe(1);expect(afterRight.stock).toEqual(start.stock);
  await expect(page.locator('.order-sheet')).toContainText('오늘 회신 잔여 0 / 1건 · 보유 보증 1 / 14종');
  await expect(page.locator('.page-count')).toHaveText(/1\/14/);
  await expect(cell(page,o.key)).toHaveClass(/owned/);await expect(page.locator('.warranty.locked')).toHaveCount(13);
  await expect(page.locator('#order-status')).toBeFocused();
  await expect(page.locator('.reply-choice')).toHaveCount(0);// 오늘 몫을 썼으면 회신란이 사라진다
  // 정답 직후 '장착'(노랑 주 행동 하나)과 '나중에'
  await expect(page.locator('main .primary')).toHaveCount(1);
  await page.getByRole('button',{name:'보유 소재에 장착'}).click();
  await expect(page.locator('#equip-dialog')).toBeVisible();await expect(page.locator('#equip-title')).toBeFocused();
  const target=fitCard(o.key);
  const targets=await page.locator('.equip-target').evaluateAll(list=>list.map(n=>n.dataset.equipId));
  expect(targets.sort()).toEqual(CHARS.filter(c=>ITEMS.find(i=>i.key===o.key).fit(c)).map(c=>c.id).sort());
  await page.locator(`.equip-target[data-equip-id="${target.id}"]`).click();
  await expect(page.locator('#equip-dialog .card-stage')).toHaveAttribute('data-appearance',approved(target.id,'front',[o.key]).id);
  await page.getByRole('button',{name:'장착 전'}).click();
  await expect(page.locator('#equip-dialog .card-stage')).toHaveAttribute('data-appearance',approved(target.id,'front',[]).id);
  await page.getByRole('button',{name:'미리보기'}).click();
  expect(await saved(page)).toEqual(afterRight);// 미리보기·확인 단계는 저장을 바꾸지 않는다
  await page.getByRole('button',{name:/장착 확정/}).click();
  await expect(page.locator('#equip-status')).toContainText('보증을 걸었습니다');await expect(page.locator('#equip-status')).toBeFocused();
  const afterEquip=await saved(page);
  expect(afterEquip.items[o.key]).toBe(target.id);expect(afterEquip.stock).toEqual(start.stock);
  expect({...afterEquip,items:afterRight.items}).toEqual(afterRight);
  await page.getByRole('button',{name:'동료 카드 보기'}).click();
  await expect(page.locator('#card-dialog')).toBeVisible();
  const equippedSlot=page.locator(`#equipment .slot[data-key="${o.key}"]`);
  await expect(equippedSlot).toHaveAttribute('data-state','equipped');
  await expect(page.locator('#card-dialog .card-stage')).toHaveAttribute('data-appearance',approved(target.id,'front',[o.key]).id);
  await page.keyboard.press('Escape');
  await expect(cell(page,o.key)).toHaveClass(/equipped/);await expect(cell(page,o.key)).toContainText('장착 ·');
  // 로비 대표로 지정하면 장착 외형으로 서고, 새로고침 뒤에도 같다
  await page.goto('/#collection');await page.reload();
  await page.locator(`.tile[data-card-id="${target.id}"] .tile-open`).click();
  await page.getByRole('button',{name:'로비 대표로 지정'}).click();
  await page.keyboard.press('Escape');
  await page.goto('/#workshop');await page.reload();
  await expect(page.locator('.lobby-figure img')).toHaveAttribute('src',approved(target.id,'front',[o.key]).image);
  await page.goto('/#research');await page.reload();
  expect((await saved(page)).items[o.key]).toBe(target.id);
  await expect(cell(page,o.key)).toHaveClass(/equipped/);
  await expect(page.locator('.order-sheet')).toContainText('장착 ·');
  expect(errors).toEqual([]);
});

test('"나중에" keeps the warranty owned; the warranty list equips it later; an equipped warranty cannot be used again',async({page})=>{
  await open(page,{state:base()});
  const o=await answerRight(page);
  await page.getByRole('button',{name:'나중에'}).click();
  await expect(page.locator('#order-title')).toBeFocused();
  await expect(page.getByRole('button',{name:'나중에'})).toHaveCount(0);
  expect((await saved(page)).items).toEqual({[o.key]:1});
  await cell(page,o.key).click();
  await expect(page.locator('#equip-dialog')).toBeVisible();
  const target=fitCard(o.key);
  await page.locator(`.equip-target[data-equip-id="${target.id}"]`).click();
  await page.getByRole('button',{name:'취소'}).click();// 취소는 소재 선택으로 돌아가며 저장을 바꾸지 않는다
  await expect(page.locator('.equip-target').first()).toBeVisible();
  expect((await saved(page)).items).toEqual({[o.key]:1});
  await page.locator(`.equip-target[data-equip-id="${target.id}"]`).click();
  await page.getByRole('button',{name:/장착 확정/}).click();
  await page.getByRole('button',{name:'확인',exact:true}).click();
  await expect(page.locator('#equip-dialog')).not.toBeVisible();
  await expect(cell(page,o.key)).toBeFocused();
  expect((await saved(page)).items).toEqual({[o.key]:target.id});
  // 장착한 보증을 누르면 장착 창이 아니라 그 동료 카드가 열린다(해제·재배치 없음)
  await cell(page,o.key).click();
  await expect(page.locator('#card-dialog')).toBeVisible();await expect(page.locator('#equip-dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cell(page,o.key)).toBeFocused();
  expect((await saved(page)).items).toEqual({[o.key]:target.id});
});

test('double clicks process once: the reply and the equip confirm each write one time',async({page})=>{
  await open(page,{state:base()});
  await page.evaluate(()=>{window.__writes=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sgg_game_save_v1')window.__writes++;return set.call(this,k,v);};});
  const o=await todayOrder(page);
  await choice(page,o.key).dblclick();
  await expect(page.locator('.order-earned')).toBeVisible();
  expect(await page.evaluate(()=>window.__writes)).toBe(1);
  const s=await saved(page);expect(s.orderDone).toBe(1);expect(s.items).toEqual({[o.key]:1});
  await page.getByRole('button',{name:'보유 소재에 장착'}).click();
  const target=fitCard(o.key);
  await page.locator(`.equip-target[data-equip-id="${target.id}"]`).click();
  await page.getByRole('button',{name:/장착 확정/}).dblclick();
  await expect(page.locator('#equip-status')).toContainText('보증을 걸었습니다');
  expect(await page.evaluate(()=>window.__writes)).toBe(2);
  expect((await saved(page)).items[o.key]).toBe(target.id);
});

test('keyboard: Tab and Enter answer, open the equip window, pick, confirm; focus follows and returns',async({page})=>{
  await open(page,{state:base()});
  const o=await todayOrder(page);
  await choice(page,o.key).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#order-status')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'보유 소재에 장착'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#equip-title')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.equip-target').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#equip-title')).toBeFocused();
  await page.getByRole('button',{name:/장착 확정/}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#equip-status')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#equip-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>document.activeElement?.dataset?.warrantyKey||document.activeElement?.id)).toBeTruthy();
  expect(Object.values((await saved(page)).items).filter(v=>v!==1)).toHaveLength(1);
});

test('card dialog: equipped warranties show, owned ones preview only, locked ones stay locked; the combination is always an approved look',async({page})=>{
  const keys=fitKeys(FOUR);
  const items={[keys[0]]:FOUR.id,[keys[1]]:1};
  await open(page,{state:base({items,orderDay:'2026-11-15',orderDone:1}),hash:'collection'});
  await page.locator(`.tile[data-card-id="${FOUR.id}"] .tile-open`).click();
  const slot=k=>page.locator(`#equipment .slot[data-key="${k}"]`);
  await expect(slot(keys[0])).toHaveAttribute('data-state','equipped');
  await expect(slot(keys[1])).toHaveAttribute('data-state','free');
  await expect(slot(keys[2])).toHaveAttribute('data-state','locked');await expect(slot(keys[3])).toHaveAttribute('data-state','locked');
  await expect(page.locator('#equipment .slot')).toHaveCount(4);
  await expect(page.locator('#equipment button.slot')).toHaveCount(1);// 눌러 볼 수 있는 것은 획득·미장착 하나뿐
  const stageNow=()=>page.locator('#card-dialog .card-stage').getAttribute('data-appearance');
  expect(await stageNow()).toBe(approved(FOUR.id,'front',[keys[0]]).id);
  await slot(keys[1]).click();
  await expect(slot(keys[1])).toHaveAttribute('aria-pressed','true');await expect(slot(keys[1])).toBeFocused();
  expect(await stageNow()).toBe(approved(FOUR.id,'front',[keys[0],keys[1]]).id);
  await expect(page.locator('#card-dialog .slot-hint')).toContainText('미리보기');
  await slot(keys[1]).click();
  expect(await stageNow()).toBe(approved(FOUR.id,'front',[keys[0]]).id);
  expect((await saved(page)).items).toEqual(items);// 미리보기는 저장하지 않는다
  if(FOUR.alt){await page.locator('[data-side=alt]').click();expect(await stageNow()).toBe(approved(FOUR.id,'alt',[keys[0]]).id);}
});

test('four items on one companion show the approved four-item look on both sides and in the lobby',async({page})=>{
  const keys=fitKeys(FOUR);
  const items=Object.fromEntries(keys.map(k=>[k,FOUR.id]));
  await open(page,{state:base({items,featured:FOUR.id,orderDay:'2026-11-15',orderDone:1}),hash:'workshop'});
  await expect(page.locator('.lobby-figure img')).toHaveAttribute('src',approved(FOUR.id,'front',keys).image);
  await page.goto('/#collection');
  await page.locator(`.tile[data-card-id="${FOUR.id}"] .tile-open`).click();
  await expect(page.locator('#equipment .slot[data-state=equipped]')).toHaveCount(4);
  await expect(page.locator('#card-dialog .card-stage')).toHaveAttribute('data-appearance',approved(FOUR.id,'front',keys).id);
  if(FOUR.alt){await page.locator('[data-side=alt]').click();await expect(page.locator('#card-dialog .card-stage')).toHaveAttribute('data-appearance',approved(FOUR.id,'alt',keys).id);}
  // 보증 14종 중 이 4종은 장착, 나머지는 잠김
  await page.keyboard.press('Escape');
  await page.goto('/#research');
  await expect(page.locator('.warranty.equipped')).toHaveCount(4);await expect(page.locator('.warranty.locked')).toHaveCount(10);
});

test('seeded states: three warranty states in the list, all-14 state, previous-game save is read as is',async({page})=>{
  const fit=Object.fromEntries(ITEMS.map(i=>[i.key,CHARS.filter(c=>i.fit(c)).map(c=>c.id)]));
  const k=ITEMS.map(i=>i.key);
  const items={[k[0]]:1,[k[1]]:1,[k[2]]:1,[k[3]]:fit[k[3]][0],[k[4]]:fit[k[4]][0]};
  await open(page,{state:base({items,orderDay:new Date().getFullYear()+'-'+(new Date().getMonth()+1)+'-'+new Date().getDate(),orderKey:k[5],orderDone:1})});
  await expect(page.locator('.warranty.owned')).toHaveCount(3);await expect(page.locator('.warranty.equipped')).toHaveCount(2);await expect(page.locator('.warranty.locked')).toHaveCount(9);
  await expect(page.locator('.order-sheet')).toContainText('오늘 회신 잔여 0 / 1건 · 보유 보증 5 / 14종');
  expect(await page.locator('.warranty.locked').first().evaluate(n=>n.tagName)).toBe('DIV');// 잠긴 것은 버튼이 아니다
  expect(await page.locator('.warranty.owned').first().evaluate(n=>n.tagName)).toBe('BUTTON');
  await expect(page.locator('.order-sheet')).toContainText('오늘 회신 횟수를 모두 사용했어요');
});

test('previous-game save: items, orderDay, orderDone and orderKey are read as they are and a held save is never overwritten',async({page})=>{
  const card=fitCard('arrow');
  const prev=base({owned:{[card.id]:true,...Object.fromEntries(CHARS.slice(0,5).map(c=>[c.id,true]))},stock:{[card.id]:1},items:{arrow:1},orderDay:'2026-11-14',orderKey:'arrow',orderDone:1,quizDay:'2026-11-19'});
  await open(page,{state:prev});
  await expect(page.locator('.warranty.owned')).toHaveCount(1);await expect(cell(page,'arrow')).toContainText('보유 · 미장착');
  const after=await saved(page);expect(after.items).toEqual({arrow:1});expect(after.quizDay).toBe('2026-11-19');
  // 모르는 키·호환되지 않는 카드는 보류: 저장을 덮어쓰지 않고, 요구 회신도 하지 않는다
  const bad=JSON.stringify({...fresh,owned:ALL,stock:STOCK,items:{tea:1}});
  await page.evaluate(({k,v})=>localStorage.setItem(k,v),{k:key,v:bad});
  await page.reload();
  await expect(page.locator('#warning')).toContainText('손상');
  await expect(page.locator('.reply-choice')).toHaveCount(0);
  expect(await raw(page)).toBe(bad);
});

test('two tabs: a stale tab cannot grant or equip a second time and keeps the first tab\'s save',async({page,context})=>{
  await open(page,{state:base()});
  const second=await context.newPage();
  await second.emulateMedia({reducedMotion:'reduce'});
  await second.goto('/#research');await expect(second.locator('main h1')).toBeVisible();
  const o=await todayOrder(page);
  await choice(page,o.key).click();
  await expect(page.locator('.order-earned')).toBeVisible();
  const first=await raw(page);
  await choice(second,o.key).click();
  await expect(second.locator('#warning')).toContainText('다른 탭');
  expect(await raw(second)).toBe(first);
  expect((await saved(second)).orderDone).toBe(1);
  await second.close();
});

test('a failed write keeps the in-memory grant, warns and offers the backup; a corrupt save grants nothing',async({page})=>{
  await open(page,{state:base()});
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sgg_game_save_v1')throw new Error('quota');return set.call(this,k,v);};});
  const before=await raw(page);
  const o=await todayOrder(page);
  await choice(page,o.key).click();
  await expect(page.locator('.order-earned')).toBeVisible();
  await expect(page.locator('#warning')).toContainText('저장');await expect(page.getByRole('button',{name:'진행 백업 받기'})).toBeVisible();
  expect(await raw(page)).toBe(before);
  const corrupt=await page.context().newPage();
  await corrupt.addInitScript(()=>localStorage.setItem('sgg_game_save_v1','{bad'));
  await corrupt.goto('/#research');
  await expect(corrupt.locator('#warning')).toContainText('손상');
  await expect(corrupt.locator('.reply-choice')).toHaveCount(0);
  expect(await corrupt.evaluate(()=>localStorage.getItem('sgg_game_save_v1'))).toBe('{bad');
  await corrupt.close();
});

for(const width of [390,1280]){
  test(`research and equip window at ${width}px: no horizontal overflow, 44px targets`,async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await open(page,{state:base()});
    const check=async(selector)=>{
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const boxes=await page.locator(selector).evaluateAll(list=>list.filter(n=>n.offsetParent!==null).map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.slice(0,20),w:r.width,h:r.height,left:r.left,right:r.right};}));
      expect(boxes.length).toBeGreaterThan(0);
      for(const b of boxes){expect(b.h,b.text).toBeGreaterThanOrEqual(44);expect(b.w,b.text).toBeGreaterThanOrEqual(44);expect(b.left,b.text).toBeGreaterThanOrEqual(0);expect(b.right,b.text).toBeLessThanOrEqual(width);}
    };
    await check('main .reply-choice');
    await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-order.png`)});
    const o=await answerRight(page);
    await check('main button');
    await page.getByRole('button',{name:'보유 소재에 장착'}).click();
    await check('#equip-dialog button');
    await page.locator('.equip-target').first().click();
    await check('#equip-dialog button');
    await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-equip.png`)});
    await page.keyboard.press('Escape');
    await expect(cell(page,o.key)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('with motion allowed the flow still works without errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{state:base(),motion:'no-preference'});
  const o=await answerRight(page);
  await page.getByRole('button',{name:'보유 소재에 장착'}).click();
  await page.locator('.equip-target').first().click();
  await page.getByRole('button',{name:/장착 확정/}).click();
  await expect(page.locator('#equip-status')).toContainText('보증을 걸었습니다');
  expect(Object.values((await saved(page)).items)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('the request seen today stays the same after a reload and a newly found companion; the warranty buttons name their state',async({page})=>{
  // 호환 동료가 하나뿐인 상태에서 요구를 보고, 새로고침 뒤 연구 탭을 열지 않은 채 보유가 늘어나도(다른 탭·출하) 같은 요구가 남는다
  const one=CHARS.find(c=>fitKeys(c).length>=1);
  await open(page,{state:{...fresh,owned:{[one.id]:true},stock:{[one.id]:1},extra:3}});
  const seen=await todayOrder(page);expect(seen.state).toBe('open');
  expect((await saved(page)).orderKey).toBe(seen.key);
  await page.goto('/#workshop');await page.reload();
  await page.evaluate(({k,ids})=>{const s=JSON.parse(localStorage.getItem(k));for(const id of ids){s.owned[id]=true;s.stock[id]=1;}localStorage.setItem(k,JSON.stringify(s));},{k:key,ids:CHARS.map(c=>c.id)});
  await page.reload();
  await page.goto('/#research');await page.reload();
  await expect(page.locator('.reply-choice').first()).toBeVisible();
  expect((await todayOrder(page)).key).toBe(seen.key);
  expect((await saved(page)).orderKey).toBe(seen.key);
  // 보증서 버튼 이름: 상태와 열리는 곳
  await choice(page,seen.key).click();
  await expect(page.locator('.order-earned')).toBeVisible();
  await expect(cell(page,seen.key)).toHaveAttribute('aria-label',new RegExp('보유 · 미장착 · 장착할 소재 고르기$'));
  await page.getByRole('button',{name:'보유 소재에 장착'}).click();
  await page.locator('.equip-target').first().click();
  await page.getByRole('button',{name:/장착 확정/}).click();
  await page.getByRole('button',{name:'확인',exact:true}).click();
  await expect(cell(page,seen.key)).toHaveAttribute('aria-label',new RegExp('장착 · .+ · 동료 카드 열기$'));
});
