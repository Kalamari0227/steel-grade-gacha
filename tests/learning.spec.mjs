import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {root,appURL,evidenceRoot} from './helpers/paths.mjs';
import {openApp,state,capture,destination} from './helpers/app.mjs';
const catalog=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const errors=new WeakMap();
test.beforeEach(async({page})=>{const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});});
test.afterEach(async({page},info)=>{await capture(info,'console',errors.get(page));expect(errors.get(page)).toEqual([]);});
async function record(info,name,value){await capture(info,name,value);await fs.mkdir(evidenceRoot,{recursive:true});await fs.writeFile(`${evidenceRoot}/${name}.json`,JSON.stringify(value,null,2));}
async function snap(page,info,name){
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'),undefined,{timeout:5000});
  await fs.mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:`${evidenceRoot}/${name}.png`});
}
async function start(page,info){
  await openApp(page,appURL,'mid-progress');await destination(page,'research');
  await expect(page.locator('[data-learning-target]')).toHaveCount(4);
  if(info)await snap(page,info,'learning-overview');
  await page.locator('#btnQuiz').click();
}
async function answer(page,correct=true){
  const q=await page.evaluate(()=>qState.qs[qState.i]);
  await page.locator('#opts button').nth(correct?q.a:(q.a+1)%q.o.length).click();
  await expect(page.locator('.learning-reason')).toHaveText(q.e);
  await expect(page.locator('#qNext')).toBeFocused();return q;
}
async function finish(page,correct=true){for(let i=0;i<5;i++){await answer(page,correct);await page.locator('#qNext').click();}}

test('@learning-happy five correct answers reward once and owned exact-code card round trip',async({page},info)=>{
  await start(page,info);
  await page.evaluate(()=>{S.owned['ssial-270D']=true;S.extra=0;S.quizUsed=0;S.quizAt=0;
    const related=QUIZ.find(q=>q.q.includes('<b>JSC270D</b>'));
    qState={qs:[related,...QUIZ.slice(0,4)].map(shuffleQ),i:0,right:0};renderQ();});
  const before=await state(page),questions=[];
  questions.push(await answer(page));
  const during=await page.evaluate(()=>structuredClone(qState));
  await page.locator('[data-quiz-card="ssial-270D"]').click();await expect(page.locator('#cardModal')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('[data-quiz-card="ssial-270D"]')).toBeFocused();
  expect(await page.evaluate(()=>structuredClone(qState))).toEqual(during);await snap(page,info,'quiz');
  await page.locator('#qNext').click();
  for(let i=1;i<5;i++){questions.push(await answer(page));await page.locator('#qNext').click();}
  const after=await state(page);expect(after.extra).toBe(1);expect(after.quizUsed).toBe(1);expect(after.quizAt).toBeGreaterThan(0);
  expect(after.stock).toEqual(before.stock);expect(after.owned).toEqual(before.owned);
  await expect(page.locator('.learning-reward')).toContainText('추가 출하 +1');
  await snap(page,info,'learning-result');
  await page.evaluate(()=>{renderQ();renderQ();});expect(await state(page)).toEqual(after);
  await page.locator('#qDone').click();await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
  expect((await state(page)).extra).toBe(1);expect((await state(page)).quizUsed).toBe(1);await record(info,'reward',{before,after,questions});
});

test('@learning-negative wrong repeated answers next and result render never grant extra',async({page},info)=>{
  await start(page);const before=await state(page);
  for(let i=0;i<5;i++){
    await answer(page,false);
    await page.evaluate(()=>{document.querySelector('#opts button').dispatchEvent(new MouseEvent('click'));renderQ();});
    expect(await page.evaluate(()=>qState.right)).toBe(0);
    await page.evaluate(()=>{const next=document.getElementById('qNext');next.click();next.click();});
  }
  await page.evaluate(()=>{renderQ();renderQ();});const after=await state(page);
  expect(after.extra).toBe(before.extra);expect(after.quizUsed).toBe(before.quizUsed);
  await record(info,'no-reward',{before,after});
});

test('@learning-negative correct repeated submission and last next settle only once',async({page},info)=>{
  await start(page);const before=await state(page);
  for(let i=0;i<5;i++){
    const q=await answer(page);
    await page.evaluate(a=>{document.querySelectorAll('#opts button')[a].dispatchEvent(new MouseEvent('click'));},q.a);
    expect(await page.evaluate(()=>qState.right)).toBe(i+1);
    await page.evaluate(()=>{const next=document.getElementById('qNext');next.click();next.click();});
  }
  const after=await state(page);expect(after.extra).toBe(Math.min(before.extra+1,3));expect(after.quizUsed).toBe(1);
  await page.evaluate(()=>renderQ());expect(await state(page)).toEqual(after);await record(info,'duplicate-input',{before,after});
});

test('@learning-negative cap exhausted stale quota and closed session preserve rewards',async({page},info)=>{
  await start(page);await page.evaluate(()=>{S.extra=quizMax();S.quizUsed=0;S.quizAt=Date.now();});
  await finish(page);expect((await state(page)).extra).toBe(3);expect((await state(page)).quizUsed).toBe(1);
  await expect(page.locator('.learning-reward')).toContainText('수량은 늘지');await page.locator('#qRetry').click();
  await page.evaluate(()=>{S.quizUsed=quizMax();});const before=await state(page);await finish(page);
  expect(await state(page)).toEqual(before);await expect(page.locator('#qRetry')).toHaveCount(0);
  await page.locator('#qDone').click();await expect(page.locator('#btnQuiz')).toBeDisabled();
  await page.evaluate(()=>{renderQ();document.getElementById('btnQuiz').dispatchEvent(new MouseEvent('click'));});expect(await state(page)).toEqual(before);
  await record(info,'quota',{before,after:await state(page)});
});

test('@learning-negative generic dex route closes current session without reward and returns cleanly',async({page},info)=>{
  await start(page);
  await page.evaluate(()=>{S.owned['ssial-1470M']=true;qState.qs[0]=shuffleQ(QUIZ.find(q=>q.q==='<b>1470M</b>의 M은 무엇을 가리킵니까?'));renderQ();});
  await answer(page);await expect(page.locator('[data-quiz-card]')).toHaveCount(0);
  const before=await state(page);await page.getByRole('link',{name:'소재 도감 둘러보기 · 현재 퀴즈 종료'}).click();
  await expect(page.locator('#view-dex')).toBeVisible();expect(await page.evaluate(()=>qState)).toBeNull();
  await page.goBack();await expect(page.locator('#view-research')).toBeVisible();await page.locator('#btnQuiz').click();
  expect(await page.evaluate(()=>[qState.i,qState.right])).toEqual([0,0]);expect(await state(page)).toEqual(before);
  await record(info,'route-return',{before,after:await state(page)});
});

test('@learning-happy all source questions retain shuffled answer mapping and 24 hour event quota',async({page},info)=>{
  await start(page);
  const result=await page.evaluate(()=>({quiz:QUIZ,rows:QUIZ.map(q=>{const mixed=shuffleQ(q);return {q:mixed.q,e:mixed.e,answer:mixed.o[mixed.a],options:mixed.o.slice().sort()};})}));
  expect(result.quiz).toEqual(catalog.quiz);result.rows.forEach((row,i)=>expect(row).toEqual({q:catalog.quiz[i].q,e:catalog.quiz[i].e,answer:catalog.quiz[i].o[catalog.quiz[i].a],options:catalog.quiz[i].o.slice().sort()}));
  expect(result.rows).toHaveLength(413);
  const events=await page.evaluate(()=>PROMOS.map(p=>({from:p.from,max:p.quizMax})));
  for(const event of events){await page.clock.setFixedTime(new Date(event.from+1));await page.evaluate(()=>refresh());expect(await page.evaluate(()=>quizMax())).toBe(event.max);}
  await page.clock.setFixedTime(new Date('2026-11-01T00:00:00+09:00'));
  const expiry=await page.evaluate(()=>{S.quizAt=Date.now()-DAY+1;S.quizUsed=quizMax();return quizLeft();});expect(expiry).toBe(0);
  await page.clock.setFixedTime(new Date('2026-11-01T00:00:00.001+09:00'));expect(await page.evaluate(()=>quizLeft())).toBe(3);
  await record(info,'question-mapping',{count:result.rows.length,rows:result.rows,events});
});

for(const width of [360,768,1280])test(`@learning-happy keyboard reduced motion and layout ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await start(page);
  if(width===360) await page.evaluate(()=>{qState.qs[0]=shuffleQ(QUIZ.reduce((a,b)=>a.e.length>b.e.length?a:b));renderQ();});
  await page.evaluate(()=>{window.__quizScroll=[];const prior=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){window.__quizScroll.push(options);return prior.call(this,options);};});
  await expect(page.locator('#quizQuestion')).toBeFocused();const a=await page.evaluate(()=>qState.qs[0].a);
  await page.locator('#opts button').nth(a).focus();await page.keyboard.press('Enter');await expect(page.locator('#qNext')).toBeFocused();
  await expect(page.locator('#qNext')).toBeInViewport({ratio:1});
  const geometry=await page.evaluate(()=>{
    const count=document.querySelector('.learning-progress span:last-child').getBoundingClientRect();
    const close=document.querySelector('#quizModal .x').getBoundingClientRect();
    const next=document.getElementById('qNext').getBoundingClientRect();
    return {countRight:count.right,closeLeft:close.left,nextTop:next.top,nextBottom:next.bottom,viewport:innerHeight};
  });
  expect(geometry.countRight).toBeLessThanOrEqual(geometry.closeLeft-8);
  expect(await page.locator('#quizBox').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const calls=await page.evaluate(()=>window.__quizScroll);expect(calls.length).toBeGreaterThan(0);expect(calls.every(c=>c.behavior==='auto')).toBe(true);
  await snap(page,info,`quiz-${width}`);await page.keyboard.press('Escape');await expect(page.locator('#btnQuiz')).toBeFocused();
  await record(info,`keyboard-${width}`,{calls,geometry,after:await state(page)});
});
