import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const key='steel_companion_prototype_20261109_v1';
async function saved(page){await page.waitForFunction(k=>localStorage.getItem(k)!==null,key);return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function readyArt(page){
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('img:not([loading=lazy])')].map(img=>img.decode().catch(error=>{if(!(error instanceof DOMException)) throw error;})));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
}
async function open(page,{random=0,motion='reduce'}={}){
  await page.emulateMedia({reducedMotion:motion});
  await page.addInitScript(({random})=>{Math.random=()=>random;localStorage.setItem('sgg_game_save_v1','original-progress-preserved');},{random});
  await page.goto('/');await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
}
test('new profile → single → card → JA → collection reopen; no duplicate grant on reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await page.getByRole('button',{name:/1회 출하/}).click();
  await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible();
  const first=await saved(page);expect(Object.values(first.stock)).toEqual([1]);
  await page.getByRole('button',{name:'동료 카드 열기'}).click();
  await expect(page.locator('#card-dialog')).toBeVisible();
  const quote=await page.locator('blockquote[lang=ko]').innerText();
  await expect(page.locator('details.ja')).not.toHaveAttribute('open','');
  await page.locator('details.ja summary').click();await expect(page.locator('[lang=ja]')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#card-dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'도감에서 보기',exact:true}).click();
  await page.locator('.tile-open').first().click();expect(await page.locator('blockquote[lang=ko]').innerText()).toBe(quote);
  await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>history.state?.cardId)).toBeUndefined();await page.reload();
  expect(await saved(page)).toEqual(first);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>localStorage.getItem('sgg_game_save_v1'))).toBe('original-progress-preserved');
});
test('ten skip/navigation/details preserve exactly10 cards, one20scrap charge and guarantee',async({page})=>{
  await open(page,{motion:'no-preference'});
  await page.getByRole('button',{name:/10연 출하/}).click();
  const committed=await saved(page);expect(committed.scrap).toBe(40);
  await expect(page.getByRole('button',{name:'건너뛰기'})).toBeVisible();
  await page.getByRole('button',{name:'건너뛰기'}).click();
  await expect(page.locator('.result-grid .tile')).toHaveCount(10);
  const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json')));
  expect(committed.results.cards.some(r=>data.cards.find(c=>c.id===r.id).level>=3)).toBe(true);
  await page.locator('.tile-open').first().click();await page.keyboard.press('Escape');
  await page.getByRole('link',{name:'공방',exact:true}).click();
  await page.getByRole('link',{name:'출하 결과',exact:true}).click();
  await expect(page.locator('.result-grid .tile')).toHaveCount(10);expect(await saved(page)).toEqual(committed);
});
test('all301 stage keys preserve exact image bindings and all47 dialogue strings',async({page})=>{
  await open(page);
  const result=await page.evaluate(async()=>{
    const data=await(await fetch('./data.json')).json();const {stage}=await import('./ui.mjs');
    const failures=[];
    for(const appearance of data.appearances){
      const card=data.cards.find(c=>c.id===appearance.cardId),node=stage(data,card,appearance);
      if(node.dataset.appearance!==appearance.id||node.querySelector('.stage-character img')?.getAttribute('src')!==appearance.image) failures.push(appearance.id);
      node.querySelectorAll('img').forEach(img=>img.removeAttribute('src'));
    }
    return {count:data.appearances.length,failures,dialogue:data.dialogue.length};
  });
  expect(result).toEqual({count:301,failures:[],dialogue:47});
});
test('image failure has retry without spending; corrupt save blocks commands',async({page})=>{
  await open(page);await page.getByRole('button',{name:/1회 출하/}).click();const before=await saved(page);
  await page.route('**/art/*',route=>route.abort());await page.getByRole('button',{name:'동료 카드 열기'}).click();
  await page.locator('#equipment').selectOption({index:1});
  await expect(page.locator('#card-dialog .art-error').first()).toBeVisible();
  await expect(page.locator('#card-dialog').getByRole('button',{name:'다시 시도'}).first()).toBeVisible();
  expect(await saved(page)).toEqual(before);await page.unroute('**/art/*');
  await page.locator('#card-dialog').getByRole('button',{name:'다시 시도'}).first().click();
  await page.evaluate(k=>localStorage.setItem(k,'{bad'),key);await page.goto('/#workshop');await page.reload();
  await expect(page.getByRole('button',{name:/1회 출하/})).toBeDisabled();
  await expect(page.locator('#warning')).toContainText('손상');
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{bad');
});
test('all47 card dialogues, heat treatment and approved4item composition at390 and1280',async({page},info)=>{
  await open(page);
  await page.evaluate(async k=>{
    const {createEngine}=await import('./engine.mjs');const state=createEngine().state();const d=await(await fetch('./data.json')).json();
    for(const c of d.cards){state.owned[c.id]=true;state.stock[c.id]=1;}
    localStorage.setItem(k,JSON.stringify(state));
  },key);
  await page.goto('/#collection');await page.reload();
  const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json')));
  for(const row of data.dialogue){
    const tile=page.locator(`.tile[data-card-id="${row.cardId}"] .tile-open`);await tile.click();
    if(row.side==='alt') await page.locator('[data-side=alt]').click();
    else if(await page.locator('[data-side=front]').count()) await page.locator('[data-side=front]').click();
    await expect(page.locator('blockquote[lang=ko]')).toHaveText(row.ko);
    await expect(page.locator('details.ja [lang=ja]')).toHaveText(row.ja);
    await page.keyboard.press('Escape');
  }
  const four=data.appearances.find(a=>a.equipmentKeys.length===4);
  await page.locator(`.tile[data-card-id="${four.cardId}"] .tile-open`).click();
  if(four.side==='alt') await page.locator('[data-side=alt]').click();
  await page.locator('#equipment').selectOption(four.equipmentKeys.join('|'));
  await expect(page.locator('#card-dialog .card-stage')).toHaveAttribute('data-appearance',four.id);
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:width===390?844:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await readyArt(page);await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-${width}-equipped.png`)});
  }
});
test('mobile unknown gallery hides grades/codes and QP, keyboard and no horizontal overflow',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await open(page);
  await readyArt(page);await page.screenshot({path:path.join(root,`screenshot-${info.project.name}-390-workshop.png`)});
  await page.getByRole('button',{name:'도감 열기'}).click();
  await expect(page.locator('.unknown')).toHaveCount(44);
  expect(await page.locator('.collection').innerText()).not.toContain('JSH270C');
  expect(await page.locator('.collection').innerText()).not.toContain('큐피');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement.tagName)).not.toBe('BODY');
});
test('touch opening at each level follows committed result and audio denial is isolated',async({browser})=>{
  for(const [random,level,duration] of [[.1,1,2500],[.6,2,2500],[.85,3,3500],[.99,4,4500]]){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
    const page=await context.newPage();
    await page.addInitScript(()=>{AudioContext.prototype.resume=function(){return Promise.reject(new DOMException('test audio denial','NotAllowedError'));};});
    await open(page,{random,motion:'no-preference'});
    await page.locator('#sound').tap();await page.getByRole('button',{name:/1회 출하/}).tap();
    const before=await saved(page), data=JSON.parse(await fs.readFile(path.join(root,'public/data.json')));
    const drawn = data.cards.find(c=>c.id===before.results.cards[0].id);
    expect(drawn.level).toBe(level);
    const expectedDuration = drawn.rare ? 8500 : duration;
    const start=Date.now();await page.getByRole('button',{name:'봉인 열기'}).tap();
    await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible({timeout:expectedDuration+2000});
    expect(Date.now()-start).toBeGreaterThanOrEqual(expectedDuration-200);expect(Date.now()-start).toBeLessThan(expectedDuration+2000);
    expect(await saved(page)).toEqual(before);await context.close();
  }
});
test('two real tabs cannot overwrite a simultaneous shipment',async({context,page})=>{
  await context.addInitScript(k=>{
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key===k){const start=performance.now();while(performance.now()-start<350){/* Deliberately widen the write race. */}}return write.call(this,key,value);};
  },key);
  const other=await context.newPage();await open(page);await open(other,{random:.99});
  await Promise.all([page.getByRole('button',{name:/10연 출하/}).click(),other.getByRole('button',{name:/10연 출하/}).click()]);
  await expect.poll(async()=>await page.getByRole('heading',{name:'출하 결과',exact:true}).count()+await other.getByRole('heading',{name:'출하 결과',exact:true}).count()).toBe(1);
  await expect.poll(async()=>(await page.locator('#warning').innerText())+(await other.locator('#warning').innerText())).toContain('다른 탭');
  const final=await saved(page);expect(final.scrap).toBe(40);expect(Object.values(final.stock).reduce((a,b)=>a+b,0)).toBe(10);
});
test('skip link focuses current content without changing result route or economy',async({page})=>{
  await open(page);await page.getByRole('button',{name:/1회 출하/}).click();const before=await saved(page);
  await page.locator('.skip-link').focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#results');expect(await page.evaluate(()=>document.activeElement.id)).toBe('main');
  expect(await saved(page)).toEqual(before);
});
