import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../src/engine.mjs';

// 확장 A(주행 시험장, 관문 4): 차 상세의 입구, 준비 화면(코스·가진 소재만), 주행 조작·멈춤, 성적서와 기록, 본편 세이브 불변, 넘침.
// 저장은 미리 심는다(stage2.spec.mjs와 같은 방식). 주행은 race.mjs가 내보내는 시험용 손잡이(raceProbe)로 고정 간격만큼 앞으로 돌린다.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const key='sgg_game_save_v1', raceKey='sgg_game_race_v1';
const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json'),'utf8'));
const CARS=data.cars;
const OWNED=['ga-270C','poo-PHS','ssial-270D'];
const state=(extra={})=>({...fresh,owned:Object.fromEntries(OWNED.map(id=>[id,true])),cars:CARS.slice(0,2).map((c,i)=>({k:c.key,at:1700000000000+i*3600000})),...extra});
async function open(page,{seed=state(),motion='reduce'}={}){
  await page.emulateMedia({reducedMotion:motion});
  if(seed) await page.addInitScript(({key,raw})=>{if(sessionStorage.getItem('race-seeded'))return;sessionStorage.setItem('race-seeded','1');localStorage.setItem(key,raw);},{key,raw:JSON.stringify(seed)});
  await page.goto('/#garage');
  await expect(page.locator('main h1')).toBeVisible();
}
const card=(page,k)=>page.locator(`.garage-card[data-car-key="${k}"]`);
const race=page=>page.locator('#race-dialog');
const r=(page,id)=>page.locator(`#race-dialog [data-r="${id}"]`);
const probe=(page,fn,...args)=>page.evaluate(async({fn,args})=>{const m=await import(new URL('./race.mjs',document.baseURI).href);return m.raceProbe[fn](...args);},{fn,args});
const stored=(page,k)=>page.evaluate(k=>localStorage.getItem(k),k);
async function toSetup(page,k=CARS[0].key){
  await card(page,k).click();
  await page.locator('#car-race').click();
  await expect(race(page)).toHaveAttribute('data-pane','setup');
  await expect(r(page,'title')).toBeFocused();
}
const overflow=page=>page.evaluate(()=>{const d=document.querySelector('#race-dialog');return Math.max(document.documentElement.scrollWidth-innerWidth,d.scrollWidth-d.clientWidth,...[...d.querySelectorAll('section:not([hidden])')].map(s=>s.scrollWidth-s.clientWidth));});

test('entry: only owned cars offer the test drive; the race code loads on first use; opening writes nothing',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const asked=[];page.on('request',q=>{if(/race\.mjs/.test(q.url()))asked.push(q.url());});
  await open(page);
  const before=await stored(page,key);
  await expect(card(page,CARS[0].key).locator('.garage-medals .race-mark')).toHaveCount(4);
  await expect(card(page,CARS[0].key).locator('.race-mark[data-medal="none"]')).toHaveCount(4);
  await expect(card(page,CARS[0].key)).toHaveAttribute('aria-label',CARS[0].tag+' 자세히 보기');
  await expect(card(page,CARS[5].key).locator('.garage-medals')).toHaveCount(0);
  await card(page,CARS[5].key).click();
  await expect(page.locator('#car-dialog')).toContainText('미보유');
  await expect(page.locator('#car-race')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await card(page,CARS[0].key).click();
  await expect(page.locator('.car-race-record')).toContainText('아직 기록이 없어요');
  await expect(page.locator('#car-dialog .primary')).toHaveCount(1);
  expect(asked).toEqual([]);
  await page.locator('#car-race').click();
  await expect(race(page)).toHaveAttribute('data-pane','setup');
  expect(asked.length).toBe(1);
  await expect(r(page,'title')).toHaveText(CARS[0].tag+' · '+CARS[0].body);
  await expect(r(page,'title')).toBeFocused();
  await expect(race(page).locator('.race-course')).toHaveCount(4);
  await expect(race(page).locator('.race-course[aria-checked="true"]')).toHaveAttribute('data-course','base');
  await expect(race(page).locator('.race-slot')).toHaveCount(3);
  expect(await stored(page,key)).toBe(before);
  expect(await stored(page,raceKey)).toBeNull();
  expect(errors).toEqual([]);
});

test('setup: courses change what each slot covers; the picker offers only discovered materials; focus returns to the slot',async({page})=>{
  await open(page);await toSetup(page);
  await expect(race(page).locator('.race-slot').nth(0)).toContainText('우박 구간 · 염수 눈길');
  await race(page).locator('.race-course[data-course="oval"]').click();
  await expect(race(page).locator('.race-course[data-course="oval"]')).toHaveAttribute('aria-checked','true');
  await expect(race(page).locator('.race-course[data-course="oval"]')).toBeFocused();
  await expect(race(page).locator('.race-slot').nth(0)).toContainText('염수 눈길');
  await expect(race(page).locator('.race-slot').nth(1)).toContainText('비틀림 굽잇길');
  await expect(race(page).locator('.race-slot').nth(2)).toContainText('고속 주회로 · 염수 눈길 · 급경사 언덕');
  await race(page).locator('.race-course[data-course="base"]').click();
  await r(page,'pick-frame').click();
  const picker=r(page,'picker');
  await expect(picker.locator('h3')).toBeFocused();
  await expect(picker.locator('h3')).toHaveText('프레임 칸에 꽂을 소재');
  await expect(picker.locator('.race-tile')).toHaveCount(44);                       // 선행개발 QP는 개발 전이라 없다
  await expect(picker.locator('.race-tile:not(.locked)')).toHaveCount(OWNED.length);
  await expect(picker.locator('.race-tile.locked').first()).toHaveAttribute('aria-disabled','true');
  expect((await picker.locator('.race-tile.locked').allTextContents()).every(t=>t==='?미발견')).toBe(true);
  await picker.locator('.race-tile.locked').first().click({force:true});                       // 못 가진 소재는 눌러도 그대로
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');                                               // Esc는 소재 창만 닫는다
  await expect(picker).toBeHidden();await expect(race(page)).toHaveAttribute('open','');
  await expect(r(page,'pick-frame')).toBeFocused();
  await r(page,'pick-frame').click();
  await picker.locator('.race-tile[data-card="poo-PHS"]').click();
  await expect(picker).toBeHidden();
  await expect(race(page).locator('.race-slot').nth(1)).toContainText('프레임 칸 · 포오 PHS');
  await expect(r(page,'pick-frame')).toBeFocused();
  await expect(r(page,'pick-frame')).toHaveText('바꾸기');
  await r(page,'pick-frame').click();
  await expect(picker.locator('.race-tile.on')).toHaveAttribute('data-card','poo-PHS');
  await picker.getByRole('button',{name:'표준 강판으로 (꽂지 않음)'}).click();
  await expect(race(page).locator('.race-slot').nth(1)).toContainText('프레임 칸 · 표준 강판');
  expect(await stored(page,raceKey)).toBeNull();
});

test('run: keys steer, boost and pause; Escape and a hidden tab pause instead of closing; a finished run writes only the race record',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);await toSetup(page);
  const before=await stored(page,key);
  for(const [slot,id] of [['body','ga-270C'],['frame','poo-PHS'],['chassis','poo-PHS']]){await r(page,'pick-'+slot).click();await r(page,'picker').locator(`.race-tile[data-card="${id}"]`).click();}
  await r(page,'start').click();
  await expect(race(page)).toHaveAttribute('data-pane','run');
  await expect(race(page).locator('.dialog-head')).toBeHidden();
  await expect(r(page,'stage')).toBeFocused();
  let s=await probe(page,'advance',3.2);
  expect([s.phase,s.course,s.car,s.bot]).toEqual(['go','base',CARS[0].key,false]);
  expect(s.tiers).toEqual([1,2,2,2]);                                                // 우박 통함, 염수·충돌 벽·요철 최적
  await page.keyboard.down('ArrowLeft');s=await probe(page,'advance',0.6);await page.keyboard.up('ArrowLeft');
  expect(s.x).toBeLessThan(-0.2);
  await page.keyboard.down('d');s=await probe(page,'advance',1.2);await page.keyboard.up('d');
  expect(s.x).toBeGreaterThan(0);
  await page.keyboard.press(' ');
  expect((await probe(page,'state')).boosts).toBe(1);
  await page.keyboard.press(' ');                                                     // 게이지가 없으면 더 쓰지 못한다
  expect((await probe(page,'state')).boosts).toBe(1);
  await page.keyboard.press('Escape');
  await expect(r(page,'paused')).toBeVisible();await expect(race(page)).toHaveAttribute('open','');
  await expect(r(page,'resume')).toBeFocused();
  expect((await probe(page,'state')).paused).toBe(true);
  await r(page,'resume').click();
  await expect(r(page,'paused')).toBeHidden();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  await expect(r(page,'paused')).toBeVisible();
  s=await probe(page,'advance',900);                                                  // 조향 없이 끝까지(길 밖으로 밀려 느리다)
  expect(s.phase).toBe('done');
  await expect(race(page)).toHaveAttribute('data-pane','result');
  await expect(r(page,'sheet-title')).toBeFocused();
  await expect(r(page,'sheet-title')).toHaveText('기본 시험로 · '+CARS[0].tag+' · '+CARS[0].body);
  await expect(r(page,'lines').locator('li')).toHaveCount(4);
  expect(await r(page,'lines').locator('li i').allTextContents()).toEqual(['통함','최적','최적','최적']);
  await expect(r(page,'medal')).toContainText('소재 7/8');
  await expect(r(page,'best')).toHaveText('이 차로 이 코스를 달린 첫 기록입니다.');
  const rec=JSON.parse(await stored(page,raceKey));
  expect(Object.keys(rec.best)).toEqual([CARS[0].key+':base']);
  expect(rec.best[CARS[0].key+':base'].t).toBeGreaterThan(60);
  expect(rec.best[CARS[0].key+':base'].ghost.length).toBeGreaterThan(200);
  expect(await stored(page,key)).toBe(before);                                        // 본편 세이브는 바이트까지 그대로
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sgg_game_')).sort())).toEqual([raceKey,key].sort());
  // 다시 달려 더 느리면 기록은 그대로다
  await r(page,'again').click();
  await probe(page,'advance',3.2);await probe(page,'advance',1200);
  await expect(r(page,'best')).toContainText('이 차의 이 코스 최고 기록');
  expect(JSON.parse(await stored(page,raceKey)).best[CARS[0].key+':base'].t).toBe(rec.best[CARS[0].key+':base'].t);
  // 닫으면 차 상세로: 기록 줄과 초점, 뒤로 가기, 차고 선반의 메달
  await race(page).getByRole('button',{name:'차 상세로'}).click();
  await expect(race(page)).not.toHaveAttribute('open','');
  await expect(page.locator('#car-dialog')).toHaveAttribute('open','');
  await expect(page.locator('#car-race')).toBeFocused();
  await expect(page.locator('.car-race-record')).toContainText('가장 빠른 기록');
  await page.locator('#car-race').click();
  await expect(race(page)).toHaveAttribute('data-pane','setup');
  await expect(race(page).locator('.race-course[data-course="base"] .race-mark')).not.toHaveAttribute('data-medal','none');
  await page.goBack();
  await expect(race(page)).not.toHaveAttribute('open','');
  await expect(page.locator('#car-dialog')).toHaveAttribute('open','');
  await page.goBack();
  await expect(page.locator('#car-dialog')).not.toHaveAttribute('open','');
  await expect(card(page,CARS[0].key).locator('.race-mark[data-medal="none"]')).toHaveCount(3);
  await expect(card(page,CARS[0].key)).toHaveAttribute('aria-label',/시험 주행 메달/);
  expect(await stored(page,key)).toBe(before);
  expect(errors).toEqual([]);
});

test('an automatic test drive is never saved, and the best picks win the base course',async({page})=>{
  test.setTimeout(90000);
  await open(page);await toSetup(page,CARS[1].key);
  for(const [slot,id] of [['body','ga-270C'],['frame','poo-PHS'],['chassis','poo-PHS']]){await r(page,'pick-'+slot).click();await r(page,'picker').locator(`.race-tile[data-card="${id}"]`).click();}
  await r(page,'start').click();
  await probe(page,'advance',3.2);
  const mid=await probe(page,'advance',30,{auto:true});
  expect(mid.bot).toBe(true);expect(mid.speed).toBeGreaterThan(0.3);
  expect((await probe(page,'advance',300,{auto:true})).phase).toBe('done');
  await expect(race(page)).toHaveAttribute('data-pane','result');
  await expect(r(page,'best')).toHaveText('자동 조향 기록은 저장하지 않습니다.');
  const total=await r(page,'total').textContent(), [m,sec]=total.split(':');
  expect(Number(m)*60+Number(sec)).toBeLessThan(73);
  expect(await stored(page,raceKey)).toBeNull();
});

test('load failure: the car detail says so and a second try works',async({page})=>{
  await open(page);
  let fail=true;
  await page.route('**/race.mjs*',route=>fail?route.abort():route.continue());
  await card(page,CARS[0].key).click();
  await page.locator('#car-race').click();
  await expect(page.locator('.car-race-status')).toHaveText('주행 시험장을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
  await expect(page.locator('#car-race')).toBeFocused();
  await expect(race(page)).not.toHaveAttribute('open','');
  fail=false;
  await page.locator('#car-race').click();
  await expect(race(page)).toHaveAttribute('data-pane','setup');
  await expect(page.locator('.car-race-status')).toHaveText('');
});

for(const [w,h] of [[320,640],[390,844],[1280,800]]) test(`layout ${w}×${h}: setup, picker, run and report fit without sideways scroll; controls are at least 44px`,async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:w,height:h});
  await open(page);await toSetup(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  const small=()=>page.evaluate(()=>[...document.querySelectorAll('#race-dialog button')].filter(b=>b.offsetParent&&!b.closest('[inert]')&&(b.getBoundingClientRect().width<44||b.getBoundingClientRect().height<44)).map(b=>b.textContent.slice(0,12)));
  expect(await small()).toEqual([]);
  await r(page,'pick-body').click();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await small()).toEqual([]);
  await r(page,'picker').locator('.race-tile[data-card="ga-270C"]').click();
  await r(page,'start').click();
  await probe(page,'advance',3.2);await probe(page,'advance',8,{auto:true});
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await small()).toEqual([]);
  const box=await r(page,'stage').boundingBox(), pads=await race(page).locator('.race-pads').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(w);
  expect(pads.y+pads.height).toBeLessThanOrEqual(h);                                  // 도로와 조작 버튼이 한 화면에
  await probe(page,'advance',300,{auto:true});
  await expect(race(page)).toHaveAttribute('data-pane','result');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await small()).toEqual([]);
});
