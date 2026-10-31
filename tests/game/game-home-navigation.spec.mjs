import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL} from '../helpers/paths.mjs';
import {openApp,state,capture,destination} from '../helpers/app.mjs';
process.env.SGG_EDITION='game';
async function open(page,fixture='new'){
 await openApp(page,appURL,fixture);await page.waitForFunction(()=>document.body.dataset.gameRelease&&document.querySelector('#homeFigure').dataset.hero!==undefined);
 await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();
 if(fixture==='all-cars')await page.evaluate(()=>{S.qpSeen=true;POOL.forEach(id=>{S.owned[id]=true;S.stock[id]=1;});save();refresh();});
}
async function record(page,info,name){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#view-workshop img')].filter(i=>i.src&&!i.hidden).map(i=>i.decode().catch(()=>{})));scrollTo(0,0);});
 await fs.mkdir(info.outputDir,{recursive:true});await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true});await page.screenshot({path:info.outputPath(name+'-viewport.png')});
 await capture(info,name,{state:await state(page),route:await page.evaluate(()=>location.hash),hero:await page.locator('#homeFigure').getAttribute('data-hero'),car:await page.locator('#homeCar').getAttribute('data-car'),release:await page.locator('body').getAttribute('data-game-release')});
}
for(const width of [390,1280])for(const fixture of ['new','mid-progress','all-cars'])test(`actual home ${fixture} at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,fixture);const before=await state(page);
 const expected=await page.evaluate(()=>({hero:allChars().find(c=>S.owned[c.id])?.id||'',car:CARS.find(c=>S.cars.some(row=>row.k===c.key))?.key||'',base:pullBaseLeft(),extra:S.extra,scrap:S.scrap,part:homeRecommendation()?.key||''}));
 await expect(page.locator('#homeFigure')).toHaveAttribute('data-hero',expected.hero);await expect(page.locator('#homeCar')).toHaveAttribute('data-car',expected.car);
 for(const [id,value]of [['homeBase',expected.base],['homeExtra',expected.extra],['homeScrap',expected.scrap]])await expect(page.locator('#'+id)).toHaveText(String(value));
 await expect(page.locator('#homeRecommend')).toHaveAttribute('data-part',expected.part);
 if(expected.hero){await expect(page.locator('#homeFigure .game-card')).toHaveAttribute('data-variant','stage');await expect(page.locator('#homeFigure .game-card-background img,#homeFigure .game-card-frame img')).toHaveCount(0);}else{await expect(page.locator('#homeHeroOpen')).toBeHidden();await expect(page.locator('#homeFigure')).toHaveClass(/is-empty/);}
 if(expected.hero){const geometry=await page.evaluate(()=>{const scene=document.querySelector('.home-scene').getBoundingClientRect(),card=document.querySelector('#homeFigure .game-card').getBoundingClientRect();return {top:card.top-scene.top,bottom:scene.bottom-card.bottom};});expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.bottom).toBeGreaterThanOrEqual(0);if(width===1280){const caption=await page.locator('.home-scene-caption').boundingBox(),nav=await page.locator('.destination-nav').boundingBox();expect(caption.y+caption.height).toBeLessThanOrEqual(nav.y);}}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const id of ['btnPull','btnTen'])expect((await page.locator('#'+id).boundingBox()).height).toBeGreaterThanOrEqual(44);
 if(width===390){const draw=await page.locator('#btnPull').boundingBox(),nav=await page.locator('.destination-nav').boundingBox();expect(draw.y+draw.height).toBeLessThanOrEqual(nav.y);}
 await record(page,info,fixture+'-'+width);expect(await state(page)).toEqual(before);expect(errors).toEqual([]);
});
test('five functional destinations history aliases reload invalid hashes and settings keyboard',async({page},info)=>{
 await open(page,'qp-ready');const before=await state(page);
 for(const route of ['workshop','dex','craft','research','garage']){
  await destination(page,route);await expect(page.locator('.destination:not([hidden])')).toHaveCount(1);await expect(page.locator('#title-'+route)).toBeFocused();
  await page.locator('#btnSettings').click();await expect(page.locator('#settingsModal')).toBeVisible();await expect(page.locator('#gameAudioControls')).toBeAttached();await page.keyboard.press('Escape');await expect(page.locator('#btnSettings')).toBeFocused();
 }
 await page.goBack();await expect(page.locator('#view-research')).toBeVisible();await page.goForward();await expect(page.locator('#view-garage')).toBeVisible();await page.reload();await expect(page.locator('#view-garage')).toBeVisible();
 for(const alias of ['learn','learning','bad-route']){
  const oldLength=await page.evaluate(()=>history.length);await page.evaluate(alias=>{location.hash=alias;},alias);
  await expect(page).toHaveURL(new RegExp('#'+(alias==='bad-route'?'workshop':'research')+'$'));
  expect(await page.evaluate(()=>history.length)).toBeLessThanOrEqual(oldLength+1);
  await page.reload();await expect(page.locator('#view-'+(alias==='bad-route'?'workshop':'research'))).toBeVisible();
 }
 await destination(page,'craft');await page.locator('#parts [data-part-key]').first().click();await expect(page.locator('#partModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#parts [data-part-key]').first()).toBeFocused();
 await destination(page,'research');await expect(page.locator('#btnQuiz')).toBeVisible();await page.locator('#btnToon').click();await expect(page.locator('#toonModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#btnToon')).toBeFocused();
 expect(await state(page)).toEqual(before);await record(page,info,'routes');
});
test('stock zero stays discovered stale selections fall back and preference merges preserve audio',async({page},info)=>{
 await open(page,'mid-progress');await page.evaluate(()=>{Object.keys(S.owned).forEach(id=>S.stock[id]=0);localStorage.setItem(GAME_EDITION.preferences,JSON.stringify({audio:{muted:true,bgmGain:.27},display:{hero:'not-owned',car:'not-owned'},other:'keep'}));refresh();});
 const before=await state(page),ids=await page.evaluate(()=>allChars().filter(c=>S.owned[c.id]).map(c=>c.id));expect(ids.length).toBeGreaterThan(1);
 await expect(page.locator('#homeFigure')).toHaveAttribute('data-hero',ids[0]);await page.locator('#homeHeroSelect').selectOption(ids.at(-1));
 await expect(page.locator('#homeFigure')).toHaveAttribute('data-hero',ids.at(-1));
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(GAME_EDITION.preferences)))).toMatchObject({audio:{muted:true,bgmGain:.27},other:'keep',display:{hero:ids.at(-1)}});
 await page.locator('#homeHeroOpen').click();await expect(page.locator('#cardModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#homeHeroOpen')).toBeFocused();
 expect(await page.evaluate(()=>GAME_HOME.select('hero','<script>invalid</script>'))).toBe(false);expect(await state(page)).toEqual(before);await record(page,info,'stock-zero-preferences');
});
test('failed character art has retry and all navigation and draw controls remain usable',async({page},info)=>{
 await page.route(/character-.*\.webp/,r=>r.abort());await open(page,'mid-progress');const before=await state(page);
 await expect(page.locator('#homeFigure .game-card-fallback:not([hidden])')).toBeVisible();await page.locator('#homeFigure .game-card-fallback:not([hidden]) button').click();await expect(page.locator('#homeFigure .game-card-fallback:not([hidden])')).toBeVisible();
 await destination(page,'craft');await expect(page.locator('#btnScrap3')).toBeVisible();await destination(page,'workshop');await expect(page.locator('#btnPull')).toBeVisible();expect(await state(page)).toEqual(before);await record(page,info,'image-failure');
});
test('default compositor keeps eight layers and stage preserves equipment without unused requests',async({page},info)=>{
 await open(page,'mid-progress');const result=await page.evaluate(async()=>{
 const snapshot=JSON.stringify(S),id='qp-1470',state={owned:{[id]:true},items:{arrow:id},stock:{[id]:0}};const rows=[];
 for(const variant of ['card','stage']){const view=GAME_PRESENTATION.render({cardId:id,side:'front',state,variant});document.body.append(view.element);const loaded=await view.ready;rows.push({variant,layers:view.element.children.length,images:view.element.querySelectorAll('img').length,items:view.items,loaded});view.dispose();}
 return {rows,unchanged:JSON.stringify(S)===snapshot};});
 expect(result).toEqual({rows:[{variant:'card',layers:8,images:5,items:['arrow'],loaded:[true,true,true,true,true]},{variant:'stage',layers:8,images:3,items:['arrow'],loaded:[true,true,true]}],unchanged:true});await capture(info,'default-stage-contract',result);
});
test('QP from catalog uses research and closes to visible caller without changing costs',async({page},info)=>{
 await open(page,'qp-ready');await destination(page,'dex');const before=await state(page);const caller=page.locator('#dex').getByRole('button',{name:'선행개발 과제 열기',exact:true});await caller.click();
 await expect(page).toHaveURL(/#research$/);await expect(page.locator('#qpTitle')).toBeFocused();await page.keyboard.press('Escape');await expect(page).toHaveURL(/#dex$/);await expect(caller).toBeFocused();expect(await state(page)).toEqual(before);await capture(info,'qp-caller',{before,after:await state(page)});
});
test('canonical routes update audio on programmatic link navigation and history',async({page},info)=>{
 await open(page,'mid-progress');await page.locator('.home-links a[href="#research"]').click();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().route)).toBe('collection');
 await destination(page,'craft');await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().route)).toBe('craft');await page.goBack();await expect(page.locator('#view-research')).toBeVisible();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().route)).toBe('collection');await capture(info,'audio-route',await page.evaluate(()=>GAME_AUDIO.snapshot()));
});
test('owned car selection persists independently and does not grant a new car',async({page},info)=>{
 await open(page,'all-cars');const before=await state(page);await page.locator('#homeCarSelect').selectOption('d');await expect(page.locator('#homeCar')).toHaveAttribute('data-car','d');await page.reload();await expect(page.locator('#homeCar')).toHaveAttribute('data-car','d');expect(await state(page)).toEqual(before);await record(page,info,'selected-owned-car');
});

test('first visit audio choices and real draw entry fit above mobile navigation',async({page},info)=>{
 await openApp(page,appURL,'new');await page.waitForFunction(()=>document.querySelector('#homeFigure').dataset.hero!==undefined);
 await expect(page.getByRole('button',{name:'소리 켜기',exact:true}).first()).toBeVisible();await expect(page.getByRole('button',{name:'무음으로 계속',exact:true})).toBeVisible();
 const draw=await page.locator('#btnPull').boundingBox(),nav=await page.locator('.destination-nav').boundingBox();expect(draw.y+draw.height).toBeLessThanOrEqual(nav.y);await capture(info,'first-visit-geometry',{draw,nav});await record(page,info,'first-visit');
});
