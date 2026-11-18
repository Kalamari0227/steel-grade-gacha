import {test,expect} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {QUIZ} from '../src/quiz.mjs';

// 4단계(철강 퀴즈): 연구 탭 안내서 → 시작 → 5문제 → 결과·보상 → 새로고침 뒤 유지. 틀리면 아무것도 바뀌지 않는다.
// 정답 번호는 답하기 전에는 화면에 없으므로, 화면의 문제 글로 문항 데이터(src/quiz.mjs)를 찾아 정답 글을 안다(보기 순서는 매번 섞인다).
// 저장은 미리 심는다(stage1~3 spec과 같은 방식). 규칙 전수 대조는 qa/quiz-economy.test.mjs, qa/quiz-window.test.mjs, 엔진 보호는 qa/stage4.test.mjs.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const key='sgg_game_save_v1', DAY=86400000;
const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
const rules=createLegacy(), CHARS=rules.allChars();
const ALL=Object.fromEntries(CHARS.map(c=>[c.id,true])), STOCK=Object.fromEntries(CHARS.map(c=>[c.id,2]));
const base=(extra={})=>({...fresh,...extra});
const strip=t=>t.replace(/<\/?b>/g,'').replace(/\s+/g,' ').trim();
const byQuestion=new Map();for(const q of QUIZ){const k=strip(q.q);(byQuestion.get(k)||byQuestion.set(k,[]).get(k)).push(q);}
async function seedOnce(page,state){
  await page.addInitScript(({key,raw})=>{if(sessionStorage.getItem('stage4-seeded'))return;sessionStorage.setItem('stage4-seeded','1');localStorage.setItem(key,raw);},{key,raw:JSON.stringify(state)});
}
async function open(page,{state=null,motion='reduce',hash='research'}={}){
  await page.emulateMedia({reducedMotion:motion});
  if(state) await seedOnce(page,state);
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const raw=page=>page.evaluate(k=>localStorage.getItem(k),key);
const saved=async page=>JSON.parse(await raw(page));
const start=page=>page.getByRole('button',{name:'퀴즈 시작'});
const dlg=page=>page.locator('#quiz-dialog');
async function begin(page){
  await start(page).click();
  await expect(dlg(page)).toBeVisible();await expect(page.locator('#quiz-question')).toBeVisible();
}
// 지금 문제를 읽고 맞는(또는 일부러 틀린) 보기를 고른다.
async function answer(page,{right=true}={}){
  await expect(page.locator('#quiz-verdict')).toHaveCount(0);await expect(page.locator('.quiz-opt').first()).toBeEnabled();// 다음 문제가 그려진 뒤에 읽는다
  const text=strip(await page.locator('#quiz-question').textContent());
  const options=await page.locator('.quiz-opt .quiz-opt-text').allTextContents();
  const pool=byQuestion.get(text);expect(pool,'question found in data: '+text).toBeTruthy();
  const entry=pool.find(q=>options.includes(q.o[q.a]))||pool[0];
  const correct=entry.o[entry.a], idx=options.findIndex(o=>right?o===correct:o!==correct);
  await page.locator('.quiz-opt').nth(idx).click();
  await expect(page.locator('#quiz-verdict')).toHaveText(right?'정답':'오답');
  return entry;
}
// 5문제를 끝까지 푼다(wrong개를 앞에서부터 틀린다). 결과 화면까지 간다.
async function play(page,{wrong=0}={}){
  for(let i=0;i<5;i++){
    await expect(page.locator('.quiz-no b')).toHaveText(String(i+1));
    await answer(page,{right:i>=wrong});
    await page.locator('#quiz-next').click();
  }
  await expect(page.locator('#quiz-result')).toBeVisible();
}
const chipLeft=page=>page.locator('.hud-res .chip.ship b').textContent();

test('new profile: sheet at the front of the lab, start → 5 correct → +1 extra once with one saved write, chip updates at once, reload keeps it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const start0=base();
  await open(page,{state:start0});
  await expect(page.locator('main .research > section').first()).toHaveClass(/quiz-note/);
  await expect(page.locator('.quiz-note')).toContainText('보유 추가 출하0회');await expect(page.locator('.quiz-note')).toContainText('보상 잔여3 / 3회');
  await expect(page.locator('main .placeholder-note')).toHaveCount(0);
  const before=await raw(page);
  expect(await chipLeft(page)).toBe('1');
  await begin(page);
  expect(await raw(page)).toBe(before);// 푸는 동안(시작·답·다음)은 저장을 쓰지 않는다
  await play(page);
  await expect(page.locator('.quiz-report')).toContainText('5 / 5 정답');
  await expect(page.locator('.quiz-reward-text')).toHaveText('추가 출하 +1을 받았어요.');
  await expect(page.locator('.quiz-reward-sum')).toHaveText('보유 추가 출하 1회 · 보상 잔여 2 / 3회');
  await expect(page.locator('.quiz-reward-renew')).toContainText('갱신');
  expect(await chipLeft(page)).toBe('2');// 닫기 전에 상단 칩이 바뀐다
  const after=await saved(page);
  // 보상 기록 말고는 아무것도 안 바뀐다. 연구 탭을 연 것만으로 오늘 날짜로 넘어간 요구 날짜(orderDay)는 원본처럼 어떤 저장에든 같이 쓰인다(퀴즈가 만진 것이 아니다: qa/stage4.test.mjs).
  const same=v=>({...v,extra:0,quizAt:0,quizUsed:0,orderDay:'',orderDone:0});
  expect(same(after)).toEqual(same(start0));
  expect(after.extra).toBe(1);expect(after.quizUsed).toBe(1);expect(after.quizAt).toBeGreaterThan(Date.now()-60000);
  await page.getByRole('button',{name:'확인'}).click();
  await expect(dlg(page)).not.toBeVisible();
  await expect(start(page)).toBeFocused();
  await expect(page.locator('.quiz-note')).toContainText('보유 추가 출하1회');await expect(page.locator('.quiz-note')).toContainText('보상 잔여2 / 3회');
  // 공방의 출하 안내도 바로 바뀐다
  await page.goto('/?after-quiz#ship');
  await expect(page.locator('[data-ship-note]').first()).toContainText('추가 출하 1회 보유');
  expect(await chipLeft(page)).toBe('2');
  await page.reload();
  expect((await saved(page)).extra).toBe(1);expect(await chipLeft(page)).toBe('2');
  expect(errors).toEqual([]);
});

test('a wrong answer gives nothing, shows 오답 with the right answer, and retrying draws a new set; nothing is saved',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{state:base()});
  const before=await raw(page);
  await begin(page);
  const first=strip(await page.locator('#quiz-question').textContent());
  const entry=await answer(page,{right:false});
  await expect(page.locator('.quiz-opt.right')).toHaveCount(1);await expect(page.locator('.quiz-opt.wrong')).toHaveCount(1);
  await expect(page.locator('.quiz-opt.right .quiz-opt-tag')).toHaveText('정답');await expect(page.locator('.quiz-opt.wrong .quiz-opt-tag')).toHaveText('내 답 · 오답');
  await expect(page.locator('.quiz-answer')).toContainText(strip(entry.o[entry.a]));
  await expect(page.locator('.quiz-score')).toHaveText('정답 0개');
  await page.locator('#quiz-next').click();
  for(let i=1;i<5;i++){await answer(page);await page.locator('#quiz-next').click();}
  await expect(page.locator('.quiz-report')).toContainText('4 / 5 정답');
  await expect(page.locator('.quiz-reward-text')).toHaveText('5문제를 모두 맞추면 추가 출하를 받아요.');
  await expect(page.locator('.quiz-reward-sum')).toHaveText('보유 추가 출하 0회 · 보상 잔여 3 / 3회');
  expect(await raw(page)).toBe(before);
  expect(await chipLeft(page)).toBe('1');
  await page.getByRole('button',{name:'다시 도전'}).click();
  await expect(page.locator('.quiz-no b')).toHaveText('1');
  expect(strip(await page.locator('#quiz-question').textContent())).toBeTruthy();
  void first;
  expect(await raw(page)).toBe(before);
  expect(errors).toEqual([]);
});

test('exhausted limit: start is disabled with the renew time, nothing is written; a window ending in a few seconds opens the button by itself',async({page})=>{
  const spent=base({extra:3,quizAt:Date.now()-3600000,quizUsed:3});
  await open(page,{state:spent});
  await expect(start(page)).toBeDisabled();
  await expect(page.locator('.quiz-note')).toContainText('보상 잔여 횟수를 모두 사용했어요.');await expect(page.locator('.quiz-note')).toContainText('갱신돼요');
  await expect(page.locator('.quiz-note')).toContainText('보상 잔여0 / 3회');
  expect(await raw(page)).toBe(JSON.stringify(spent));
  await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.quizAt=Date.now()-86400000+3500;localStorage.setItem(k,JSON.stringify(s));},key);
  await page.reload();
  await expect(start(page)).toBeDisabled();
  await expect(start(page)).toBeEnabled({timeout:10000});// 24시간 창이 끝나면 안내서가 스스로 열린다
  await expect(page.locator('.quiz-note')).toContainText('보상 잔여3 / 3회');
});

test('three rewards fill the window; the fourth start is refused; "한 판 더" appears only while rewards remain; the extra stays at the cap',async({page})=>{
  await open(page,{state:base()});
  for(let n=1;n<=3;n++){
    await begin(page);await play(page);
    await expect(page.locator('.quiz-reward-text')).toHaveText('추가 출하 +1을 받았어요.');
    await expect(page.locator('.quiz-reward-sum')).toHaveText(`보유 추가 출하 ${n}회 · 보상 잔여 ${3-n} / 3회`);
    if(n<3){await expect(page.getByRole('button',{name:'한 판 더'})).toBeVisible();await page.getByRole('button',{name:'한 판 더'}).click();await expect(page.locator('.quiz-no b')).toHaveText('1');await page.getByRole('button',{name:'닫기'}).click();await page.getByRole('button',{name:'그만하기'}).click();await expect(dlg(page)).not.toBeVisible();}
  }
  await expect(page.getByRole('button',{name:'한 판 더'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'확인'})).toBeVisible();
  await page.getByRole('button',{name:'확인'}).click();
  await expect(start(page)).toBeDisabled();
  const s=await saved(page);expect(s.extra).toBe(3);expect(s.quizUsed).toBe(3);
});

test('extra at the cap: five correct only spends one reward, with the original wording',async({page})=>{
  await open(page,{state:base({extra:3,quizAt:Date.now()-3600000,quizUsed:1})});
  await begin(page);await play(page);
  await expect(page.locator('.quiz-reward-text')).toHaveText('보유 추가 출하가 상한에 도달해 수량은 늘지 않았어요.');
  await expect(page.locator('.quiz-reward-sum')).toHaveText('보유 추가 출하 3회 · 보상 잔여 1 / 3회');
  const s=await saved(page);expect(s.extra).toBe(3);expect(s.quizUsed).toBe(2);
});

test('while the leave confirmation is up, an option click is ignored; "계속 풀기" then answers normally',async({page})=>{
  await open(page,{state:base()});
  await begin(page);
  await page.getByRole('button',{name:'닫기'}).click();
  await expect(page.locator('.quiz-leave')).toBeVisible();
  await page.locator('.quiz-opt').first().dispatchEvent('click');
  await expect(page.locator('.quiz-opt.picked')).toHaveCount(0);await expect(page.locator('.quiz-verdict')).toHaveCount(0);await expect(page.locator('.quiz-leave')).toBeVisible();
  await page.getByRole('button',{name:'계속 풀기'}).click();
  await page.locator('.quiz-opt').first().click();
  await expect(page.locator('.quiz-verdict')).toBeVisible();
});

test('closing asks first, "계속 풀기" returns to the same question, "그만하기" ends it with the save unchanged; a new start is a new quiz',async({page})=>{
  await open(page,{state:base()});
  const before=await raw(page);
  await begin(page);
  await answer(page);
  const text=strip(await page.locator('#quiz-question').textContent());
  await page.getByRole('button',{name:'닫기'}).click();
  await expect(page.locator('.quiz-leave')).toBeVisible();await expect(page.locator('#quiz-leave-title')).toBeFocused();
  await page.getByRole('button',{name:'계속 풀기'}).click();
  await expect(page.locator('.quiz-leave')).toHaveCount(0);expect(strip(await page.locator('#quiz-question').textContent())).toBe(text);await expect(page.locator('#quiz-next')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('.quiz-leave')).toBeVisible();
  await page.getByRole('button',{name:'그만하기'}).click();
  await expect(dlg(page)).not.toBeVisible();await expect(start(page)).toBeFocused();
  expect(await raw(page)).toBe(before);
  await begin(page);await expect(page.locator('.quiz-no b')).toHaveText('1');
  expect(await raw(page)).toBe(before);
});

test('double clicks count once: an option, "다음 문제" and the result button',async({page})=>{
  await open(page,{state:base()});
  await begin(page);
  const text=strip(await page.locator('#quiz-question').textContent());
  const options=await page.locator('.quiz-opt .quiz-opt-text').allTextContents();
  const entry=byQuestion.get(text).find(q=>options.includes(q.o[q.a]))||byQuestion.get(text)[0];
  await page.locator('.quiz-opt').nth(options.indexOf(entry.o[entry.a])).dblclick();
  await expect(page.locator('#quiz-verdict')).toHaveText('정답');await expect(page.locator('.quiz-score')).toHaveText('정답 1개');
  await page.locator('#quiz-next').dblclick();
  await expect(page.locator('.quiz-no b')).toHaveText('2');await expect(page.locator('#quiz-verdict')).toHaveCount(0);// 두 번째 누름이 다음 문제의 보기를 고르지 않는다
  await answer(page);await page.locator('#quiz-next').click();
  for(let i=2;i<4;i++){await answer(page);await page.locator('#quiz-next').click();}
  await answer(page);
  await page.locator('#quiz-next').dblclick();
  await expect(page.locator('#quiz-result')).toBeVisible();
  await expect(page.locator('.quiz-report')).toContainText('5 / 5 정답');
  const s=await saved(page);expect(s.extra).toBe(1);expect(s.quizUsed).toBe(1);
  await expect(page.locator('.quiz-no')).toHaveCount(0);
});

test('related material: an owned companion named in the question opens its card and returns to the same explanation; Back asks instead of leaving',async({page})=>{
  // 모든 소재를 보유해도 문제 글에 보유 소재 코드가 나오는 문항은 413개 중 하나뿐이다. 그 문항이 첫 문제로 뽑히도록 난수 한 번을 맞춘다.
  const rigged=QUIZ.findIndex(q=>{const l=createLegacy();l.setQuiz(QUIZ);for(const c of l.allChars())l.state().owned[c.id]=true;return l.quizRelated(q).length>0;});
  expect(rigged).toBeGreaterThanOrEqual(0);
  await page.addInitScript(()=>{const orig=Math.random;window.__rig=undefined;Math.random=()=>{if(window.__rig!==undefined){const v=window.__rig;window.__rig=undefined;return v;}return orig();};});
  const state=base({owned:ALL,stock:STOCK});
  await open(page,{state});
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').orderKey,key);// 연구 탭이 보여 준 요구를 한 번 저장한 뒤부터 비교한다
  const before=await raw(page);
  await page.evaluate(i=>{window.__rig=(i+0.5)/413;},rigged);
  await begin(page);
  expect(strip(await page.locator('#quiz-question').textContent())).toBe(strip(QUIZ[rigged].q));
  await answer(page,{right:false});
  const text=strip(await page.locator('#quiz-question').textContent());
  const opener=page.locator('[data-quiz-card]').first();
  await expect(opener).toBeVisible();
  await opener.click();
  await expect(page.locator('#card-dialog')).toBeVisible();
  await page.locator('#card-dialog .close-button').click();
  await expect(page.locator('#card-dialog')).not.toBeVisible();
  await expect(dlg(page)).toBeVisible();
  expect(strip(await page.locator('#quiz-question').textContent())).toBe(text);await expect(page.locator('.quiz-explain')).toBeVisible();
  await expect(opener).toBeFocused();
  // Back: 풀이 중이므로 확인을 띄우고 연구 화면에 그대로 있다
  await page.goBack();
  await expect(page.locator('.quiz-leave')).toBeVisible();expect(new URL(page.url()).hash).toBe('#research');
  await page.getByRole('button',{name:'계속 풀기'}).click();
  expect(await raw(page)).toBe(before);
});

test('no related material: the dex link ends the quiz and opens the collection',async({page})=>{
  await open(page,{state:base()});
  const before=await raw(page);
  await begin(page);
  await answer(page,{right:false});
  const link=page.getByRole('link',{name:'소재 도감 둘러보기 · 현재 퀴즈 종료'});
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading',{name:'동료 도감',exact:true,level:1})).toBeVisible();
  await expect(dlg(page)).not.toBeVisible();
  expect(await raw(page)).toBe(before);
});

test('keyboard: Enter starts, Tab/Enter answer, focus follows to the verdict, Escape asks, focus returns to the start button',async({page})=>{
  await open(page,{state:base()});
  await start(page).focus();await page.keyboard.press('Enter');
  await expect(page.locator('#quiz-question')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('.quiz-opt').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quiz-verdict')).toBeFocused();
  for(let i=0;i<4&&!(await page.locator('#quiz-next').evaluate(n=>n===document.activeElement));i++) await page.keyboard.press('Tab');
  await expect(page.locator('#quiz-next')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quiz-question')).toBeFocused();await expect(page.locator('.quiz-no b')).toHaveText('2');
  await page.keyboard.press('Escape');
  await expect(page.locator('#quiz-leave-title')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'계속 풀기'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'그만하기'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dlg(page)).not.toBeVisible();await expect(start(page)).toBeFocused();
});

for(const width of [390,1280]){
  test(`quiz at ${width}px: question, explanation and result have no horizontal overflow and 44px targets`,async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await open(page,{state:base()});
    const check=async selector=>{
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await dlg(page).evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
      const boxes=await page.locator(selector).evaluateAll(list=>list.filter(n=>n.offsetParent!==null).map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.slice(0,20),w:r.width,h:r.height,left:r.left,right:r.right};}));
      expect(boxes.length).toBeGreaterThan(0);
      for(const b of boxes){expect(b.h,b.text).toBeGreaterThanOrEqual(44);expect(b.w,b.text).toBeGreaterThanOrEqual(44);expect(b.left,b.text).toBeGreaterThanOrEqual(0);expect(b.right,b.text).toBeLessThanOrEqual(width);}
    };
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-quiz-sheet.png`)});
    await begin(page);
    await check('#quiz-dialog button');
    await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-quiz-question.png`)});
    await answer(page,{right:false});
    await check('#quiz-dialog button');
    await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-quiz-explain.png`)});
    await page.locator('#quiz-next').click();
    for(let i=1;i<5;i++){await answer(page);await page.locator('#quiz-next').click();}
    await expect(page.locator('#quiz-result')).toBeVisible();
    await check('#quiz-dialog button');
    await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-quiz-result.png`)});
  });
}

test('reduced motion removes the option transition; with motion allowed the quiz still works without errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,{state:base(),motion:'reduce'});
  await begin(page);
  expect(await page.locator('.quiz-opt').first().evaluate(n=>getComputedStyle(n).transitionDuration)).toBe('0s');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'그만하기'}).click();
  const calm=await page.context().newPage();
  await calm.emulateMedia({reducedMotion:'no-preference'});await calm.goto('/#research');await expect(calm.locator('main h1')).toBeVisible();
  await begin(calm);
  expect(await calm.locator('.quiz-opt').first().evaluate(n=>getComputedStyle(n).transitionDuration)).not.toBe('0s');
  await calm.close();
  expect(errors).toEqual([]);
});

test('previous-game save: extra, quizAt, quizUsed and quizDay are read as they are and carried through a reward',async({page})=>{
  const old=base({extra:2,quizAt:Date.now()-3600000,quizUsed:2,quizDay:'2026-11-14'});
  await open(page,{state:old});
  await expect(page.locator('.quiz-note')).toContainText('보유 추가 출하2회');await expect(page.locator('.quiz-note')).toContainText('보상 잔여1 / 3회');
  expect(await raw(page)).toBe(JSON.stringify(old));
  await begin(page);await play(page);
  const s=await saved(page);
  expect(s.extra).toBe(3);expect(s.quizUsed).toBe(3);expect(s.quizAt).toBe(old.quizAt);expect(s.quizDay).toBe('2026-11-14');
  await expect(page.getByRole('button',{name:'한 판 더'})).toHaveCount(0);
});

test('two tabs: a stale tab cannot grant a second reward and keeps the first tab\'s save',async({page,context})=>{
  await open(page,{state:base()});
  await begin(page);
  for(let i=0;i<4;i++){await answer(page);await page.locator('#quiz-next').click();}
  await answer(page);// 마지막 문제 해설에서 멈춘다
  const second=await context.newPage();
  await second.emulateMedia({reducedMotion:'reduce'});
  await second.goto('/#research');await expect(second.locator('main h1')).toBeVisible();
  await begin(second);await play(second);
  await expect(second.locator('.quiz-reward-text')).toHaveText('추가 출하 +1을 받았어요.');
  const winner=await raw(second);
  await page.locator('#quiz-next').click();
  await expect(page.locator('.quiz-error')).toContainText('다른 탭');
  await expect(page.locator('#quiz-result')).toHaveCount(0);
  await expect(page.locator('#warning')).toContainText('다른 탭');
  expect(await raw(page)).toBe(winner);expect((await saved(page)).extra).toBe(1);expect((await saved(page)).quizUsed).toBe(1);
  await second.close();
});

test('a failed write keeps the in-memory grant, warns and offers the backup; a corrupt save cannot start a quiz and is not overwritten',async({page})=>{
  await open(page,{state:base()});
  const before=await raw(page);
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sgg_game_save_v1')throw new Error('quota');return set.call(this,k,v);};});
  await begin(page);await play(page);
  await expect(page.locator('.quiz-reward-text')).toHaveText('추가 출하 +1을 받았어요.');
  await expect(dlg(page).locator('.quiz-error')).toContainText('저장');// 모달 안에서도 경고가 보인다
  await expect(page.locator('#warning')).toContainText('저장');await expect(page.getByRole('button',{name:'진행 백업 받기'})).toBeVisible();
  expect(await raw(page)).toBe(before);
  const corrupt=await page.context().newPage();
  await corrupt.addInitScript(()=>localStorage.setItem('sgg_game_save_v1','{bad'));
  await corrupt.goto('/#research');
  await expect(corrupt.locator('#warning')).toContainText('손상');
  await expect(corrupt.getByRole('button',{name:'퀴즈 시작'})).toBeDisabled();
  await expect(corrupt.locator('.quiz-status')).toContainText('저장 상태를 확인할 때까지');
  expect(await corrupt.evaluate(()=>localStorage.getItem('sgg_game_save_v1'))).toBe('{bad');
  await corrupt.close();
});

test('the quiz never touches items, stock, scrap, the order record or the last shipment result',async({page})=>{
  // 보유 소재가 없으면 오늘의 요구가 없어 연구 탭을 열어도 요구 기록을 쓰지 않는다(그래서 요구 기록이 그대로인지 볼 수 있다).
  const state=base({scrap:7,items:{shield:1},orderDay:'2026-11-14',orderKey:'',orderDone:1});
  await open(page,{state});
  await begin(page);await play(page);
  const s=await saved(page);
  // orderDay·orderDone은 연구 탭을 연 것만으로 오늘 날짜로 넘어가 어떤 저장에든 같이 쓰인다(원본 todaysOrder). 퀴즈 명령이 만지지 않는 것은 엔진 테스트가 확인한다.
  for(const k of ['owned','stock','scrap','items','orderKey','parts','cars','pullAt','pullUsed','results']) expect(s[k],k).toEqual(state[k]);
});

// 통합 검토(2026-11-18) 지적 3건.
test('review: the leave confirmation is scrolled into view on a short screen, and "다음 문제" is ignored while it is up',async({page})=>{
  await page.setViewportSize({width:390,height:700});
  await open(page,{state:base()});
  await begin(page);await answer(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.quiz-leave')).toBeInViewport({ratio:.98});
  await expect(page.locator('#quiz-leave-title')).toBeFocused();
  await page.locator('#quiz-next').dispatchEvent('click');
  await expect(page.locator('.quiz-no b')).toHaveText('1');await expect(page.locator('.quiz-leave')).toBeVisible();
  await page.getByRole('button',{name:'계속 풀기'}).click();
  await page.locator('#quiz-next').click();
  await expect(page.locator('.quiz-no b')).toHaveText('2');
  // 뒤로 가기로 띄운 확인도 보이는 곳에 온다.
  await answer(page);
  await page.goBack();
  await expect(page.locator('.quiz-leave')).toBeInViewport({ratio:.98});
});
test('review: a slow failed question load keeps its message on the sheet, writes nothing, and the next try loads and starts',async({page})=>{
  let fail=true;
  await page.route('**/quiz.mjs*',async route=>{if(!fail)return route.continue();await new Promise(r=>setTimeout(r,2300));await route.abort();});
  await open(page,{state:base()});
  const before=await raw(page);
  await start(page).click();
  await expect(page.locator('#quiz-status')).toHaveText('퀴즈 문항을 읽지 못했어요. 연결을 확인하고 다시 시도해 주세요.',{timeout:8000});
  await expect(start(page)).toBeEnabled();await expect(dlg(page)).toBeHidden();
  expect(await raw(page)).toBe(before);
  fail=false;
  await begin(page);
  await expect(page.locator('.quiz-no b')).toHaveText('1');
});
