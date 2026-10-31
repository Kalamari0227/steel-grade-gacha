import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,root,baselineRoot} from '../helpers/paths.mjs';
import {openApp,state,capture,destination,sha} from '../helpers/app.mjs';
process.env.SGG_EDITION='game';
const oracle=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const audits=new WeakMap();
test.beforeEach(async({page})=>{
 const audit={runtime:[],console:[]};audits.set(page,audit);
 page.on('pageerror',error=>audit.runtime.push(error.message));
 page.on('console',message=>{if(message.type()==='error')audit.console.push({text:message.text(),url:message.location().url});});
 await page.addInitScript(()=>{
  localStorage.setItem('steelgrade_gacha_v1','task27-education-sentinel');window.researchEducationWrites=[];
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='steelgrade_gacha_v1'||key==='sgg_toon_seen')researchEducationWrites.push(key);return set.call(this,key,value);};
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name==='steelgrade_gacha')researchEducationWrites.push(this.transaction.db.name);return put.apply(this,args);};
 });
});
test.afterEach(async({page},info)=>{
 const audit=audits.get(page);await capture(info,'browser-audit',audit);expect(audit.runtime).toEqual([]);
 const education=await page.evaluate(()=>({value:localStorage.getItem('steelgrade_gacha_v1'),writes:researchEducationWrites}));await capture(info,'education-isolation',education);expect(education).toEqual({value:'task27-education-sentinel',writes:[]});
 const allowed=info.title.includes('comic404')?'/webtoon/ep01.webp':info.title.includes('uncached offline')?'/webtoon/':null;
 expect(audit.console.filter(row=>!allowed||!row.url.includes(allowed))).toEqual([]);
});
async function open(page,fixture='mid-progress'){
 await openApp(page,appURL,fixture);await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();await destination(page,'research');
}
async function record(page,info,name,data={}){
 await capture(info,name,{...data,state:await state(page),release:await page.locator('body').getAttribute('data-game-release'),route:await page.evaluate(()=>location.hash)});
 await page.screenshot({path:info.outputPath(name+'.png')});
}
async function trace(page){
 await page.evaluate(()=>{window.researchTrace=[];const priorSave=save,priorAudio=GAME_AUDIO;
 save=function(){researchTrace.push({event:'save',extra:S.extra,used:S.quizUsed});return priorSave();};
 GAME_AUDIO={...priorAudio,play(id){researchTrace.push({event:id,extra:S.extra,used:S.quizUsed});return Promise.resolve(false);}};
 });
}
async function finish(page,correct){
 for(let i=0;i<5;i++){
  const answer=await page.evaluate(correct=>{const q=qState.qs[qState.i];return correct?q.a:(q.a+1)%q.o.length;},correct);
  await page.locator('#opts button').nth(answer).click();await expect(page.locator('#qNext')).toBeFocused();await page.locator('#qNext').click();
 }
}

for(const width of [390,1280])test(`research activities and original catalogs at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:900});await open(page,'qp-ready');
 const before=await state(page);await expect(page.locator('[data-learning-target]')).toHaveCount(4);
 await expect(page.locator('#researchQPButton')).toBeEnabled();await expect(page.locator('[data-research-material]')).toHaveCount(3);
 await page.locator('[data-research-art]').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 const geometry=await page.evaluate(()=>({button:document.getElementById('btnQuiz').getBoundingClientRect().toJSON(),nav:document.querySelector('.destination-nav').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
 expect(geometry.overflow).toBe(false);expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.nav.top);
 const actual=await page.evaluate(()=>({quiz:QUIZ,orders:ORDERS,toon:TOON}));
 expect(actual).toEqual({quiz:oracle.quiz,orders:oracle.orders,toon:oracle.toon});expect(actual.quiz).toHaveLength(413);expect(actual.orders).toHaveLength(14);
 await record(page,info,'research-overview-'+width,{geometry,counts:{quiz:actual.quiz.length,orders:actual.orders.length}});
 for(const id of ['btnQuiz','order','items','btnToon']){
  await page.locator(`[data-learning-target="${id}"]`).click();await expect(page.locator('#'+id)).toBeFocused();
 }
 await page.locator('#btnToon').click();await expect(page.locator('#toonModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#btnToon')).toBeFocused();
 expect(await state(page)).toEqual(before);
});

test('first accepted quiz answers and actual reward emit once after settlement',async({page},info)=>{
 await open(page);await trace(page);await page.locator('#btnQuiz').click();const before=await state(page);
 for(let i=0;i<5;i++){
  const answer=await page.evaluate(()=>qState.qs[qState.i].a);
  await page.locator('#opts button').nth(answer).evaluate(button=>{button.click();button.dispatchEvent(new MouseEvent('click'));});
  await page.evaluate(()=>renderQ());await page.locator('#qNext').evaluate(button=>{button.click();button.click();});
 }
 const after=await state(page);expect(after.extra).toBe(before.extra+1);expect(after.quizUsed).toBe(before.quizUsed+1);
 await page.evaluate(()=>{renderQ();renderQ();});expect(await state(page)).toEqual(after);
 const events=await page.evaluate(()=>researchTrace);expect(events.filter(x=>x.event==='research.correct')).toHaveLength(5);expect(events.filter(x=>x.event==='research.reward')).toHaveLength(1);
 const reward=events.findIndex(x=>x.event==='research.reward');expect(events[reward-1].event).toBe('save');expect(events[reward].extra).toBe(after.extra);
 await record(page,info,'quiz-settlement',{before,after,events});
});

for(const mode of ['wrong','cap','quota'])test(`quiz ${mode} gives no extra reward cue`,async({page},info)=>{
 await open(page);await page.locator('#btnQuiz').click();
 await page.evaluate(mode=>{if(mode==='cap')S.extra=quizMax();if(mode==='quota'){S.quizUsed=quizMax();S.quizAt=Date.now();}},mode);
 const before=await state(page);await trace(page);await finish(page,mode!=='wrong');
 const after=await state(page),events=await page.evaluate(()=>researchTrace);
 expect(after.extra).toBe(before.extra);expect(events.filter(x=>x.event==='research.reward')).toHaveLength(0);
 if(mode==='wrong')expect(events.filter(x=>x.event==='research.incorrect')).toHaveLength(5);
 if(mode==='quota')expect(after).toEqual(before);
 await record(page,info,'quiz-'+mode,{before,after,events});
});

test('order wrong double answer and day rollover never issue another guarantee',async({page},info)=>{
 await open(page,'crafting-ready');await page.evaluate(()=>{S.items={};S.orderDay=today();S.orderKey='shield';S.orderDone=0;refresh();});await trace(page);
 await page.locator('#btnOrder').click();const before=await state(page);
 await page.locator('[data-choice="dagger"]').evaluate(button=>{button.click();button.click();});expect(await state(page)).toEqual(before);
 await page.locator('[data-choice="shield"]').evaluate(button=>{button.click();button.dispatchEvent(new MouseEvent('click'));});
 const after=await state(page);expect(after.items.shield).toBe(1);expect(after.orderDone).toBe(1);expect(after.stock).toEqual(before.stock);
 const events=await page.evaluate(()=>researchTrace);expect(events.filter(x=>x.event==='research.incorrect')).toHaveLength(1);expect(events.filter(x=>x.event==='research.reward')).toHaveLength(1);
 const reward=events.findIndex(x=>x.event==='research.reward');expect(events[reward-1].event).toBe('save');
 await page.locator('#pkDone').click();await page.evaluate(()=>{S.items={};S.orderKey='shield';S.orderDone=0;refresh();});await page.locator('#btnOrder').click();
 await page.clock.setFixedTime(new Date('2026-11-02T00:00:00+09:00'));const stale=await state(page);const traceBefore=await page.evaluate(()=>researchTrace.length);
 await page.locator('[data-choice="shield"]').click();expect(await state(page)).toEqual(stale);expect(await page.evaluate(()=>researchTrace.length)).toBe(traceBefore);
 await record(page,info,'order-day-rollover',{before,after,stale,events});
});

test('QP stale discovery rejects confirmation without save or consumption',async({page},info)=>{
 await open(page,'qp-ready');await page.locator('#researchQPButton').click();await trace(page);
 await page.evaluate(()=>delete S.owned['ga-1470H']);const before=await state(page);
 await page.locator('#devBtn').click();expect(await state(page)).toEqual(before);await expect(page.locator('#devBtn')).toBeDisabled();await expect(page.locator('#qpStatus')).toBeFocused();
 expect(await page.evaluate(()=>researchTrace.filter(x=>x.event==='save').length)).toBe(0);
 await record(page,info,'qp-stale-discovery',{before,after:await state(page),events:await page.evaluate(()=>researchTrace)});
});

test('QP material detail preserves picks and caller then exact valid cost occurs once',async({page},info)=>{
 await open(page,'qp-ready');await destination(page,'dex');const caller=page.locator('#dex').getByRole('button',{name:'선행개발 과제 열기',exact:true});await caller.click();
 const before=await state(page);await expect(page).toHaveURL(/#research$/);
 const slot=page.locator('.qp-cost-slot').nth(1);await slot.locator('summary').click();const material=slot.locator('[data-qp-material="ssial-1180Y"]');await material.click();
 await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id','ssial-1180Y');await page.keyboard.press('Escape');await expect(material).toBeFocused();
 await expect(slot).toHaveAttribute('data-selected-id','ssial-1180Y');expect(await state(page)).toEqual(before);
 await page.locator('#qpBack').click();await expect(caller).toBeFocused();await expect(page).toHaveURL(/#dex$/);expect(await state(page)).toEqual(before);
 await caller.click();await page.locator('#devBtn').evaluate(button=>{button.click();button.click();});const after=await state(page);
 expect(after.stock).toEqual({'qp-1470':1});expect(after.scrap).toBe(0);expect(after.owned).toEqual({...before.owned,'qp-1470':true});expect(after.pullUsed).toBe(before.pullUsed);
 await record(page,info,'qp-material-caller-cost',{before,after});
});

test('locked QP and unsatisfied customer remain descriptive without rewards',async({page},info)=>{
 await open(page,'new');const before=await state(page);
 await expect(page.locator('#researchQPButton')).toBeDisabled();await expect(page.locator('#btnOrder')).toHaveCount(0);await expect(page.locator('#items .waiting')).toHaveCount(14);
 await page.evaluate(()=>{openDevelop();openPick();});expect(await state(page)).toEqual(before);await expect(page.locator('.modal.show')).toHaveCount(0);
 await record(page,info,'locked-and-unsatisfied',{before});
});

test('craft QP review returns to caller and owned QP remains reachable in research',async({page},info)=>{
 await open(page,'qp-ready');await destination(page,'craft');const before=await state(page);
 await page.locator('#craftResearch').click();await expect(page).toHaveURL(/#research$/);await expect(page.locator('#qpTitle')).toBeFocused();
 await page.locator('#qpBack').click();await expect(page).toHaveURL(/#craft$/);await expect(page.locator('#craftResearch')).toBeFocused();expect(await state(page)).toEqual(before);
 await page.locator('#craftResearch').click();await page.locator('#devBtn').click();await page.locator('[data-draw-close]').click();await destination(page,'research');
 await expect(page.locator('#researchQPButton')).toBeHidden();await expect(page.locator('#researchQPOwned')).toBeVisible();const owned=await state(page);
 await page.locator('#researchQPOwned').click();await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id','qp-1470');await page.keyboard.press('Escape');await expect(page.locator('#researchQPOwned')).toBeFocused();expect(await state(page)).toEqual(owned);
 await record(page,info,'craft-caller-owned-QP',{before,owned});
});

test('comic404 retries original bytes without changing economy or opened marker',async({page},info)=>{
 await open(page);const before=await state(page);await page.route('**/webtoon/ep01.webp',route=>route.fulfill({status:404,body:'not found'}));
 await page.locator('#btnToon').click();await page.locator('#toonBox [data-i="1"]').click();await expect(page.locator('.toon-page')).toHaveAttribute('data-state','error');
 expect(await page.evaluate(()=>toonSeen())).toBe('ep01');await record(page,info,'comic404',{before});
 await page.unroute('**/webtoon/ep01.webp');await page.locator('[data-retry="0"]').click();await expect(page.locator('.toon-page')).toHaveAttribute('data-state','ready');
 expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>toonSeen())).toBe('ep01');await page.locator('#toonBack').click();await expect(page.locator('#toonBox [data-i="1"]')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#btnToon')).toBeFocused();
 const files=oracle.toon.flatMap(entry=>[entry.thumb,...entry.pages.map(p=>p.img)]),rows=[];
 for(const file of files){const actual=await fs.readFile(`${root}/${file}`),original=await fs.readFile(`${baselineRoot}/${file}`);expect(sha(actual)).toBe(sha(original));rows.push({file,sha:sha(actual),bytes:actual.length});}
 expect(rows).toHaveLength(18);await capture(info,'original-comic-bytes',rows);
});

test('uncached offline comic keeps failure visible and returns to research',async({page},info)=>{
 await open(page);await page.locator('#btnToon').click();const before=await state(page);await page.context().setOffline(true);
 try{
  await page.locator('#toonBox [data-i="2"]').click();
  for(const frame of await page.locator('.toon-page').all()){await frame.scrollIntoViewIfNeeded();await expect(frame).toHaveAttribute('data-state','error');}
  expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>toonSeen())).toBe('ep02');await record(page,info,'comic-offline',{before});
  await page.keyboard.press('Escape');await expect(page.locator('#btnToon')).toBeFocused();
 }finally{await page.context().setOffline(false);}
});

test('short 360 viewport and 200 percent text keep quiz action close and navigation reachable',async({page},info)=>{
 await page.setViewportSize({width:360,height:640});await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 await page.evaluate(()=>{const nodes=[...document.querySelectorAll('#view-research *')].map(node=>({node,size:parseFloat(getComputedStyle(node).fontSize)}));nodes.forEach(({node,size})=>node.style.fontSize=(size*2)+'px');});
 await page.locator('#btnQuiz').scrollIntoViewIfNeeded();await page.locator('#btnQuiz').click();
 await page.evaluate(()=>{qState.qs[0]=shuffleQ(QUIZ.reduce((a,b)=>a.e.length>b.e.length?a:b));renderQ();});
 const a=await page.evaluate(()=>qState.qs[0].a);await page.locator('#opts button').nth(a).focus();await page.keyboard.press('Enter');await expect(page.locator('#qNext')).toBeFocused();
 const fonts=await page.locator('#quizModal *').evaluateAll(nodes=>{const rows=nodes.map(node=>({node,size:parseFloat(getComputedStyle(node).fontSize)}));rows.forEach(({node,size})=>node.style.fontSize=size*2+'px');return rows.map(({node,size})=>({id:node.id,before:size,after:parseFloat(getComputedStyle(node).fontSize)}));});
 expect(fonts.every(row=>row.after===row.before*2)).toBe(true);await capture(info,'actual-dynamic-text-scaling',fonts);await page.locator('#qNext').scrollIntoViewIfNeeded();await expect(page.locator('#qNext')).toBeInViewport();
 expect(await page.locator('#quizBox').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await record(page,info,'short-large-text',{method:'font sizes captured before doubling; CSS text scaling, not native browser zoom'});
 await page.locator('#quizX').scrollIntoViewIfNeeded();await page.locator('#quizX').click();await expect(page.locator('#btnQuiz')).toBeFocused();
});
