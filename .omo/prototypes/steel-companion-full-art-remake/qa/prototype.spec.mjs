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
  await page.goto('/#ship');await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
}
test('new profile → single → card → KO/JA inscription → collection reopen; no duplicate grant on reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await page.getByRole('button',{name:/1회 출하/}).click();
  await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible();
  const first=await saved(page);expect(Object.values(first.stock)).toEqual([1]);
  await page.getByRole('button',{name:'동료 카드 열기'}).click();
  await expect(page.locator('#card-dialog')).toBeVisible();
  const quote=await page.locator('blockquote[lang=ko]').innerText();
  const ja=page.locator('#card-dialog p.ja-line[lang=ja]');await expect(ja).toBeVisible();
  const engraved=page.locator('#card-dialog .stage-inscription');await expect(engraved).toHaveAttribute('aria-hidden','true');
  expect(await engraved.locator('.inscription-ko[lang=ko]').innerText()).toBe(quote);
  expect(await engraved.locator('.inscription-ja[lang=ja]').textContent()).toBe(await ja.textContent());
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
  await page.locator('#equipment .slot').first().click();
  await expect(page.locator('#card-dialog .art-error').first()).toBeVisible();
  await expect(page.locator('#card-dialog').getByRole('button',{name:'다시 시도'}).first()).toBeVisible();
  expect(await saved(page)).toEqual(before);await page.unroute('**/art/*');
  await page.locator('#card-dialog').getByRole('button',{name:'다시 시도'}).first().click();
  await page.evaluate(k=>localStorage.setItem(k,'{bad'),key);await page.goto('/#ship');await page.reload();
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
    await expect(page.locator('#card-dialog p.ja-line[lang=ja]')).toHaveText(row.ja);
    await expect(page.locator('#card-dialog .stage-inscription .inscription-ko')).toHaveText(row.ko);
    await expect(page.locator('#card-dialog .stage-inscription .inscription-ja')).toHaveText(row.ja);
    await page.keyboard.press('Escape');
  }
  const four=data.appearances.find(a=>a.equipmentKeys.length===4);
  await page.locator(`.tile[data-card-id="${four.cardId}"] .tile-open`).click();
  if(four.side==='alt') await page.locator('[data-side=alt]').click();
  for(const k of four.equipmentKeys){const slot=page.locator(`#equipment .slot[data-key="${k}"]`);await slot.click();await expect(slot).toHaveAttribute('aria-pressed','true');await expect(slot).toBeFocused();}
  await expect(page.locator('#equipment .slot[aria-pressed=true]')).toHaveCount(4);
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
  await page.getByRole('link',{name:'도감',exact:true}).click();
  await expect(page.locator('.unknown')).toHaveCount(44);
  expect(await page.locator('.collection').innerText()).not.toContain('JSH270C');
  expect(await page.locator('.collection').innerText()).not.toContain('큐피');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement.tagName)).not.toBe('BODY');
});
test('touch opening at each level follows committed result and audio denial is isolated',async({browser})=>{
  for(const [random,level,duration] of [[.1,1,2600],[.6,2,3000],[.85,3,3400],[.99,4,4200]]){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
    const page=await context.newPage();
    await page.addInitScript(()=>{AudioContext.prototype.resume=function(){return Promise.reject(new DOMException('test audio denial','NotAllowedError'));};});
    await open(page,{random,motion:'no-preference'});
    await page.locator('#sound').tap();await page.getByRole('button',{name:/1회 출하/}).tap();
    const before=await saved(page), data=JSON.parse(await fs.readFile(path.join(root,'public/data.json')));
    const drawn = data.cards.find(c=>c.id===before.results.cards[0].id);
    expect(drawn.level).toBe(level);
    const expectedDuration = drawn.rare ? 3700 : duration;
    const start=Date.now();await page.getByRole('button',{name:'봉인 열기'}).tap();
    const results=page.getByRole('heading',{name:'출하 결과',exact:true}), toResults=page.getByRole('button',{name:'결과 보기'});
    await expect(toResults).toBeVisible({timeout:expectedDuration+2000});
    expect(Date.now()-start).toBeGreaterThanOrEqual(expectedDuration-200);expect(Date.now()-start).toBeLessThan(expectedDuration+2000);
    await expect(toResults).toBeFocused();await page.waitForTimeout(1500);
    await expect(results).toHaveCount(0);await expect(page.locator('.cutin .stage-inscription')).toBeVisible();
    await toResults.tap();await expect(results).toBeVisible();
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
test('lobby shows the latest discovery, pinning from the card changes it and survives reload without spending',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{let c=0;Math.random=()=>((c++*37)%100)/100;});
  await page.goto('/');await expect(page.getByRole('heading',{name:'공방',exact:true,level:1})).toBeVisible();
  await expect(page.locator('.lobby-hero.empty')).toBeVisible();await expect(page.locator('.lobby-name')).toHaveCount(0);
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  await page.getByRole('button',{name:/코일 출하/}).click();await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
  await expect(page.getByRole('link',{name:'공방',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:/10연 출하/}).click();await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible();
  const before=await saved(page), data=JSON.parse(await fs.readFile(path.join(root,'public/data.json')));
  const title=id=>{const c=data.cards.find(x=>x.id===id);return c.familyName+' '+c.grade;};
  const fresh=before.results.cards.filter(c=>c.isNew), latest=fresh[fresh.length-1].id, other=before.results.cards.find(c=>c.id!==latest).id;
  await page.getByRole('link',{name:'공방',exact:true}).click();
  await expect(page.locator('.lobby-title')).toHaveText(title(latest));
  await expect(page.locator('.lobby-figure img')).toHaveAttribute('src',data.appearances.find(a=>a.cardId===latest&&a.side==='front'&&!a.equipmentKeys.length).image);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const boxes=await page.locator('main button').evaluateAll(list=>list.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,w:r.width,h:r.height}}));
  for(const box of boxes){expect(box.h,box.text).toBeGreaterThanOrEqual(44);expect(box.w,box.text).toBeGreaterThanOrEqual(44);}
  await page.getByRole('link',{name:'도감',exact:true}).click();
  await page.locator(`.tile[data-card-id="${other}"] .tile-open`).click();
  const pin=page.locator('#card-dialog .feature-pin');await expect(pin).toHaveAttribute('aria-pressed','false');
  await pin.click();await expect(pin).toHaveAttribute('aria-pressed','true');await expect(pin).toBeFocused();
  expect(await saved(page)).toEqual({...before,featured:other});
  await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>history.state?.cardId)).toBeUndefined();
  await page.getByRole('link',{name:'공방',exact:true}).click();await expect(page.locator('.lobby-title')).toHaveText(title(other));
  await page.reload();await expect(page.locator('.lobby-title')).toHaveText(title(other));
  await page.locator('.lobby-name').click();await expect(page.locator('#card-dialog h2')).toHaveText(title(other));
  expect(await saved(page)).toEqual({...before,featured:other});expect(errors).toEqual([]);
});

const qpSeed={owned:{'ssial-1470M':true,'ga-1470H':true,'poo-PHS':true,'ssial-1180Y':true},stock:{'ssial-1470M':1,'ga-1470H':1,'poo-PHS':1,'ssial-1180Y':2},last:'',extra:12,quizDay:'',items:{},orderDay:'',orderKey:'',scrap:30,pending:'',pullAt:0,quizAt:0,quizUsed:0,bell:false,belledAt:-1,backupAt:0,orderDone:0,promoSeen:'',promoDone:'',noticeSeen:'',parts:{},cars:[],pullUsed:0,qpSeen:0,prototypeVersion:1,results:null};
async function openQP(page,motion){
  await page.emulateMedia({reducedMotion:motion});
  await page.addInitScript(({key,seed})=>{if(sessionStorage.getItem('qp-seeded'))return;sessionStorage.setItem('qp-seeded','1');localStorage.setItem(key,JSON.stringify(seed));},{key,seed:qpSeed});
  await page.goto('/#collection');await expect(page.getByRole('heading',{name:'선행개발 과제 · 1470 QP'})).toBeVisible();
}
test('QP development plays the LV5 hero once, skip keeps the saved result, reload cannot repeat',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openQP(page,'no-preference');
  await page.getByRole('button',{name:/개발하기/}).click();
  const hero=page.getByRole('dialog',{name:/선행개발 성공/});await expect(hero).toBeVisible();
  const after=await saved(page);
  expect(after.scrap).toBe(20);expect(after.stock['qp-1470']).toBe(1);expect(after.owned['qp-1470']).toBe(true);
  expect(after.stock['ssial-1470M']).toBeUndefined();expect(after.stock['ssial-1180Y']).toBe(1);
  const approved=await page.evaluate(async()=>{const d=await (await fetch('data.json')).json();const a=d.appearances.find(x=>x.cardId==='qp-1470'&&x.side==='front'&&!x.equipmentKeys.length);return [a.image,d.assets['background:qp'].image];});
  const used=await hero.locator('img').evaluateAll(list=>[...new Set(list.map(i=>new URL(i.src).pathname.replace(/^\//,'')))]);
  expect(used.sort()).toEqual([...new Set(approved)].sort());
  await expect(hero.getByRole('button',{name:'건너뛰기'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(hero).toHaveCount(0);
  await expect(page.locator('#card-dialog')).toBeVisible();await expect(page.locator('#card-dialog h2')).toHaveText('큐피 1470QP');
  await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'선행개발 과제 · 1470 QP'})).toHaveCount(0);
  // 카드를 닫으면 history.back()이 비동기로 끝난다. 그 전에 새로 고치면 탐색이 겹쳐 중단된다 (첫 테스트와 같은 대기).
  await expect.poll(()=>page.evaluate(()=>history.state?.cardId)).toBeUndefined();
  await page.reload();expect(await saved(page)).toEqual(after);
  await expect(page.getByRole('dialog',{name:/선행개발 성공/})).toHaveCount(0);expect(errors).toEqual([]);
});
test('QP development with reduced motion skips the hero and opens the card directly',async({page})=>{
  await openQP(page,'reduce');
  await page.getByRole('button',{name:/개발하기/}).click();
  await expect(page.locator('#card-dialog')).toBeVisible();await expect(page.locator('.qph')).toHaveCount(0);
  expect((await saved(page)).stock['qp-1470']).toBe(1);
});
for(const [slug,name] of [['crafting','제작'],['garage','차고'],['research','연구']]){
  test(`${name} tab opens as an empty placeholder without touching the save`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
    const raw=()=>page.evaluate(k=>localStorage.getItem(k),key);
    expect(await raw()).toBeNull();
    await page.getByRole('link',{name:name,exact:true}).click();
    await expect(page.getByRole('heading',{name:name,exact:true,level:1})).toBeVisible();
    await expect(page.locator('main [role=status]')).toContainText('준비 중');
    await expect(page.getByRole('link',{name:name,exact:true})).toHaveAttribute('aria-current','page');
    await expect(page.getByRole('link',{name:'공방',exact:true})).not.toHaveAttribute('aria-current','page');
    expect(new URL(page.url()).hash).toBe('#'+slug);
    expect(await page.title()).toContain(name);
    expect(await page.locator('main img').count()).toBe(0);
    expect(await raw()).toBeNull();
    await page.goBack();await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
    await page.goForward();await expect(page.getByRole('heading',{name:name,exact:true,level:1})).toBeVisible();
    await page.goto('/index.html#'+slug);
    await expect(page.getByRole('heading',{name:name,exact:true,level:1})).toBeVisible();
    expect(errors).toEqual([]);
  });
  test(`${name} tab keyboard: Enter on link moves focus to content, Tab reaches the way back`,async({page})=>{
    await open(page);
    await page.getByRole('link',{name:name,exact:true}).focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('heading',{name:name,exact:true,level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.activeElement.id)).toBe('main');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button',{name:'공방으로'})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading',{name:'공방',exact:true,level:1})).toBeVisible();
    await page.getByRole('link',{name:'공방',exact:true}).focus();
    for(const next of ['도감',...(slug==='crafting'?['제작']:slug==='garage'?['제작','차고']:['제작','차고','연구'])]){
      await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:next,exact:true})).toBeFocused();
    }
  });
  test(`${name} tab at 390px: 44px targets and no horizontal overflow`,async({page})=>{
    await page.setViewportSize({width:390,height:844});await open(page);
    await page.getByRole('link',{name:name,exact:true}).click();
    await expect(page.getByRole('heading',{name:name,exact:true,level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const boxes=await page.locator('nav a:visible, #sound, main button').evaluateAll(list=>list.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,w:r.width,h:r.height,right:r.right,left:r.left}}));
    expect(boxes.length).toBeGreaterThanOrEqual(7);
    for(const box of boxes){expect(box.h,box.text).toBeGreaterThanOrEqual(44);expect(box.w,box.text).toBeGreaterThanOrEqual(44);expect(box.left,box.text).toBeGreaterThanOrEqual(0);expect(box.right,box.text).toBeLessThanOrEqual(390);}
  });
}
