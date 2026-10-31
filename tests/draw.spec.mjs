import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { appURL, baselineURL, baselineRoot, root, fixedTime, evidenceRoot } from './helpers/paths.mjs';
import { openApp, state, capture, sha, destination } from './helpers/app.mjs';

const exchangeCatalog = JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const originalSource = await fs.readFile(`${baselineRoot}/src/app_tpl.html`,'utf8');
const originalLevels = originalSource.match(/var LVG = \{([\s\S]*?)\n\};/);
if(!originalLevels) throw new Error('Original LVG table is missing');
const exchangeLevels = Object.fromEntries([...originalLevels[1].matchAll(/([1-5]):\s*(\[[^\]]*\])/g)].map(([,lv,grades]) => [lv,JSON.parse(grades)]));
if(Object.keys(exchangeLevels).length !== 5) throw new Error('Original LVG table must contain all five levels');
const exchangeLevel = card => Number(Object.keys(exchangeLevels).find(lv => exchangeLevels[lv].includes(card.g)));
const exchangeOracleSHA = sha(originalSource);
const detailSnapshot = page => page.evaluate(() => ({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY)}));

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const found = []; errors.set(page,found);
  page.on('pageerror',error => found.push(error.message));
  page.on('console',message => {if(message.type() === 'error') found.push(message.text());});
});
test.afterEach(async ({page},info) => {await capture(info,'console',errors.get(page));expect(errors.get(page)).toEqual([]);});
async function probe(page,name) {
  await page.evaluate(name => {
    window.drawEntries = [];
    const original = window[name];
    window[name] = function(...args) {
      drawEntries.push({args,state:JSON.parse(JSON.stringify(S)),saved:JSON.parse(localStorage.getItem(KEY))});
      return original.apply(this,args);
    };
  },name);
}
async function ready(page) {
  await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');
  await page.waitForFunction(() => [...document.querySelectorAll('#pullBox img')].every(img => img.complete && img.naturalWidth > 0));
  await expect(page.locator('.draw-results')).toBeVisible();
  expect(await page.evaluate(() => drawBusy())).toBe(false);
}
async function snap(page,info,name,canonical) {
  await page.locator('#pullBox').scrollIntoViewIfNeeded();
  await page.evaluate(async () => {await document.fonts.ready;await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));});
  const file = info.outputPath(`${name}.png`);
  await page.locator('#pullBox').screenshot({path:file});
  if(canonical) await fs.copyFile(file,`${evidenceRoot}/${canonical}.png`);
}
async function saved(page) {return page.evaluate(() => JSON.parse(localStorage.getItem(KEY)));}

for(const fixture of ['new','mid-progress']) test(`@draw-happy single ${fixture} matches baseline saved result`,async ({page},info) => {
    await openApp(page,baselineURL,fixture); await probe(page,'showPull');
    await page.locator('#btnPull').click();
    const expected = await page.evaluate(() => drawEntries[0]);
    const expectedFinal = await state(page);
    const hash = await openApp(page,appURL,fixture); await probe(page,'showPull');
    await page.locator('#btnPull').click();
    expect(await page.evaluate(() => drawEntries[0])).toEqual(expected);
    expect(expected.saved).toEqual(expected.state);
    await ready(page);
    await expect(page.locator('.draw-stock')).toContainText('입고 +1');
    await expect(page.locator('.draw-copy')).toContainText(await page.evaluate(() => USE[drawEntries[0].args[0]]));
    await expect(page.locator('.draw-badge')).toContainText(expected.args[1] ? 'NEW' : '재고 +1');
    await snap(page,info,`single-${fixture}`,fixture === 'new' ? 'single' : undefined);
    await page.locator('.draw-art').click(); await expect(page.locator('#cardModal')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('.draw-art')).toBeFocused();
    expect(await state(page)).toEqual(expectedFinal);
    await capture(info,'single',{hash,fixture,expected,expectedFinal,after:await state(page)});
});

test('@draw-happy duplicate scrap preserves last copy',async ({page},info) => {
  await openApp(page,appURL,'mid-progress');
  await page.locator('#btnPull').click(); await ready(page);
  const before = await state(page);
  await page.locator('#btnScrap').click();
  const after = await state(page);
  expect(after.stock['poo-270C']).toBe(before.stock['poo-270C']-1);
  expect(after.scrap).toBe(before.scrap+1); expect(after.owned).toEqual(before.owned);
  await expect(page.locator('#btnScrap')).toBeDisabled();
  await page.evaluate(() => document.getElementById('btnScrap').click());
  expect(await state(page)).toEqual(after); expect(await saved(page)).toEqual(after);
  await capture(info,'duplicate-scrap',{before,after});
});

for(const width of [390,1280]) test(`@draw-happy ten existing array and grid details ${width}`,async ({page},info) => {
  await page.setViewportSize({width,height:width === 390 ? 844 : 900});
    await openApp(page,baselineURL,'mid-progress'); await probe(page,'showTen');
    await page.locator('#btnTen').click(); const expected = await page.evaluate(() => drawEntries[0]);
    await openApp(page,appURL,'mid-progress'); await probe(page,'showTen');
    await page.locator('#btnTen').click();
    expect(await page.evaluate(() => drawEntries[0])).toEqual(expected);
    expect(expected.saved).toEqual(expected.state);
    await expect(page.locator('[data-draw-skip]')).toHaveText('즉시 전체 결과 보기');
    await page.locator('[data-draw-skip]').click(); await ready(page);
    const ids = await page.locator('.tc[data-id]').evaluateAll(nodes => nodes.map(node => node.dataset.id));
    expect(ids).toEqual(expected.args[0]); expect(ids).toHaveLength(10);
    const portraits = await page.locator('.draw-result-tile .game-card-character img').evaluateAll(images => images.map(img => ({fit:getComputedStyle(img).objectFit,ratio:img.getBoundingClientRect().width/img.getBoundingClientRect().height,natural:img.naturalWidth/img.naturalHeight})));
    for(const portrait of portraits){expect(portrait.fit).toBe('contain');expect(portrait.ratio).toBeCloseTo(2/3,2);expect(portrait.natural).toBeCloseTo(2/3,2);}
    expect(await page.evaluate(ids => ids.some(id => lvOf(findChar(id)) >= 3),ids)).toBe(true);
    await expect(page.locator('.draw-result-grid')).toContainText('입고 +1');
    await snap(page,info,`ten-${width}`,width === 390 ? 'ten' : undefined);
    const details = [], beforeDetails = await detailSnapshot(page);
    for(const [index,id] of ids.entries()){
      const trigger = page.locator('.tc[data-id]').nth(index);
      await expect(trigger).toHaveAttribute('data-id',id);
      await trigger.click(); await expect(page.locator('#cardModal')).toBeVisible();
      await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id',id);
      await expect(page.locator('#cardIdentity')).toBeVisible();
      await expect(page.locator('#cardIdentity')).toHaveText(id);
      const detailID = await page.locator('#cardBox').getAttribute('data-card-id');
      const opened = await detailSnapshot(page); expect(opened).toEqual(beforeDetails);
      await page.keyboard.press('Escape'); await expect(page.locator('#cardModal')).toBeHidden();
      await expect(trigger).toBeFocused();
      const closed = await detailSnapshot(page); expect(closed).toEqual(beforeDetails);
      details.push({index,id,detailID,opened,closed});
    }
    expect(details).toHaveLength(10);
    expect(await state(page)).toEqual(expected.state);
    await capture(info,'ten',{ids,portraits,expected,beforeDetails,details,after:await detailSnapshot(page)});
});

for(const lv of [3,4]) test(`@draw-happy partial tier ${lv} exchange prefers undiscovered independent oracle`,async ({page},info) => {
  const hash = await openApp(page,appURL,'new'), cost = lv === 3 ? 5 : 10;
  const eligible = exchangeCatalog.cards.filter(card => exchangeCatalog.pool.includes(card.id) && exchangeLevel(card) === lv).map(card => card.id);
  expect(eligible.length).toBeGreaterThan(1);
  const discovered = eligible.slice(0,Math.floor(eligible.length/2));
  await page.evaluate(({discovered,cost}) => {
    S.owned = Object.fromEntries(discovered.map(id => [id,true]));
    S.stock = Object.fromEntries(discovered.map(id => [id,2]));
    S.scrap = cost + 2; save(); refresh();
  },{discovered,cost});
  const before = await detailSnapshot(page);
  const missing = eligible.filter(id => !before.state.owned[id]);
  expect(discovered.length).toBeGreaterThan(0); expect(missing.length).toBeGreaterThan(0);
  expect(before.state.pending).toBe(''); expect(JSON.parse(before.saved)).toEqual(before.state);
  await destination(page,'craft');
  await expect(page.locator(`#btnScrap${lv}`)).toBeEnabled();
  await probe(page,'showPull'); await page.locator(`#btnScrap${lv}`).click(); await ready(page);
  const entry = await page.evaluate(() => drawEntries[0]);
  const id = await page.locator('.draw-art').getAttribute('data-draw-detail');
  expect(entry.args[0]).toBe(id); expect(entry.args[1]).toBe(true);
  expect(missing).toContain(id); expect(before.state.owned[id]).toBeUndefined();
  expect(exchangeLevel(exchangeCatalog.cards.find(card => card.id === id))).toBe(lv);
  await expect(page.locator('.draw-art')).toBeVisible();
  await expect(page.locator('.draw-meta').filter({hasText:`LV${lv}`})).toBeVisible();
  await expect(page.locator('.draw-badge')).toContainText('NEW');
  await expect(page.locator('#drawStock')).toHaveText(`${(before.state.stock[id] || 0)+1}장`);
  const after = await detailSnapshot(page);
  const expected = {...before.state,scrap:before.state.scrap-cost,owned:{...before.state.owned,[id]:true},stock:{...before.state.stock,[id]:(before.state.stock[id] || 0)+1}};
  expect(after.state).toEqual(expected); expect(JSON.parse(after.saved)).toEqual(expected);
  expect(entry.state).toEqual(expected); expect(entry.saved).toEqual(expected);
  const image = info.outputPath(`partial-tier-${lv}.png`);
  await page.locator('#pullBox').screenshot({path:image});
  await info.attach(`partial-tier-${lv}`,{path:image,contentType:'image/png'});
  await capture(info,'partial-tier-exchange',{hash,lv,cost,oracle:{source:`${baselineRoot}/src/app_tpl.html`,sha256:exchangeOracleSHA,levels:exchangeLevels,catalog:`${root}/tests/fixtures/catalog.json`},eligible,discovered,missing,id,before,entry,expected,after});
});

for(const lv of [3,4]) test(`@draw-happy completed tier ${lv} fallback exchange`,async ({page},info) => {
  await openApp(page,appURL,`completed-lv${lv}`);
  const before = await state(page);
  const id = await page.evaluate(lv => missingIn(lv)[0],lv);
  await destination(page,'craft');
  await expect(page.locator(`#btnScrap${lv}`)).toBeEnabled();
  await probe(page,'showPull'); await page.locator(`#btnScrap${lv}`).click(); await ready(page);
  const after = await state(page), cost = lv === 3 ? 5 : 10;
  expect(after.scrap).toBe(before.scrap-cost); expect(after.owned).toEqual(before.owned);
  expect(after.stock).toEqual({...before.stock,[id]:(before.stock[id] || 0)+1});
  expect(await page.evaluate(() => drawEntries[0].saved)).toEqual(after);
  await expect(page.locator('.draw-badge')).toContainText('재고 +1');
  await snap(page,info,`completed-lv${lv}`);
  await capture(info,'completed-tier-exchange',{lv,cost,id,before,after});
});

test('@draw-happy reduced motion result is immediate and scroll is instant',async ({page},info) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await openApp(page,appURL);
  const observed = await page.evaluate(() => {
    const scroll = Element.prototype.scrollIntoView, calls = [];
    Element.prototype.scrollIntoView = function(options){calls.push(options);return scroll.call(this,options);};
    document.getElementById('btnPull').click();
    return {phase:document.getElementById('pullBox').dataset.phase,busy:drawBusy(),calls};
  });
  expect(observed.phase).toBe('ready'); expect(observed.busy).toBe(false);
  expect(observed.calls.every(call => call.behavior !== 'smooth')).toBe(true);
  await ready(page); await capture(info,'reduced-motion',observed);
});

test('@draw-negative busy survives tick refresh and phase timing',async ({page},info) => {
  await page.clock.install({time:new Date(fixedTime)});
  await openApp(page,appURL,'mid-progress');
  await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));
  await probe(page,'showPull');
  const first = await page.evaluate(() => {
    document.getElementById('btnPull').click();
    const after = JSON.parse(JSON.stringify(S)); tick();refresh();
    const disabled = ['btnPull','btnTen','btnScrap3','btnScrap4'].map(id => document.getElementById(id).disabled);
    for(let i=0;i<5;i++) for(const id of ['btnPull','btnTen','btnScrap3','btnScrap4']) document.getElementById(id).click();
    return {after,disabled,phase:document.getElementById('pullBox').dataset.phase};
  });
  expect(first.disabled).toEqual([true,true,true,true]); expect(first.phase).toBe('coil');
  expect(await state(page)).toEqual(first.after);
  expect(await page.evaluate(() => drawEntries.length)).toBe(1);
  await page.clock.runFor(450); await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','family');
  await page.clock.runFor(1000); await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');
  expect(await state(page)).toEqual(first.after); expect(await saved(page)).toEqual(first.after);
  await capture(info,'phase-timing',{first,elapsed:1450,after:await state(page)});
});

for(const action of ['skip','close','route','reload']) test(`@draw-negative ${action} during reveal does not repay or redraw`,async ({page},info) => {
  await page.clock.install({time:new Date(fixedTime)});
  await openApp(page,appURL,'mid-progress');
  await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));
  await page.evaluate(() => document.getElementById('btnTen').click());
  const afterDraw = await state(page); expect(await saved(page)).toEqual(afterDraw);
  if(action === 'skip') await page.evaluate(() => document.querySelector('[data-draw-skip]').click());
  if(action === 'close') await page.evaluate(() => document.querySelector('[data-draw-close]').click());
  if(action === 'route') await page.evaluate(() => document.querySelector('.destination-nav a[href="#dex"]').click());
  if(action === 'reload') await page.reload();
  await page.clock.fastForward(2000);
  expect(await state(page)).toEqual(afterDraw); expect(await saved(page)).toEqual(afterDraw);
  expect(await page.evaluate(() => drawBusy())).toBe(false);
  if(action !== 'skip') await expect(page.locator('#pullBox')).not.toBeVisible();
  await capture(info,'state-diff',{action,afterDraw,after:await state(page)});
});

test('@draw-negative quotas costs last copy and actual empty pool preserve state',async ({page},info) => {
  await openApp(page,appURL);
  await page.evaluate(() => {S.pullAt=Date.now();S.pullUsed=pullMax();S.extra=0;S.scrap=19;save();refresh();});
  const before = await state(page);
  await expect(page.locator('#btnPull')).toBeDisabled(); await expect(page.locator('#btnTen')).toBeDisabled();
  await page.evaluate(() => {document.getElementById('btnPull').click();document.getElementById('btnTen').click();});
  expect(await state(page)).toEqual(before);
  await page.evaluate(() => {S.scrap=4;save();refresh();}); const insufficient = await state(page);
  await expect(page.locator('#btnScrap3')).toBeDisabled();
  await page.evaluate(() => {scrapPull(3,SCRAP_LV3);scrapPull(4,SCRAP_LV4);});
  expect(await state(page)).toEqual(insufficient);
  await page.evaluate(() => {S.scrap=100;POOL=[];save();refresh();}); const empty = await state(page);
  await expect(page.locator('#btnTen')).toBeDisabled(); await expect(page.locator('#btnScrap3')).toBeDisabled();
  await page.evaluate(() => {tenPull();scrapPull(3,SCRAP_LV3);scrapPull(4,SCRAP_LV4);});
  expect(await state(page)).toEqual(empty);
  await capture(info,'state-diff',{before,insufficient,empty,after:await state(page)});
});

test('@draw-negative single last inventory cannot be scrapped',async ({page},info) => {
  await openApp(page,appURL); await page.locator('#btnPull').click(); await ready(page);
  const after = await state(page);
  expect(after.stock['poo-270C']).toBe(1); await expect(page.locator('#btnScrap')).toHaveCount(0);
  await expect(page.locator('.draw-copy')).toContainText('마지막 한 장');
  await page.keyboard.press('Escape'); expect(await state(page)).toEqual(after);
  await capture(info,'last-copy',{after});
});

test('@draw-happy family glyphs and QP development presentation',async ({page},info) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await openApp(page,appURL,'qp-owned');
  const before = await state(page);
  const glyphs = await page.evaluate(() => FAMS.map(f => {const face=GAME_CONFIG.faces.find(face=>face.side==='front' && findChar(face.cardId).fam.key===f.key);return {family:f.abbr==='Wire Rod'?'WR':f.abbr,cardId:face.cardId,art:GAME_CONFIG.assets[face.character].url};}));
  expect(glyphs.map(row => row.family).sort()).toEqual(['PO','CR','GA','WR','EG','QP'].sort());
  for(const glyph of glyphs){expect(glyph.cardId).toBeTruthy();expect(glyph.art).toMatch(/assets\/game\/.+\.webp$/);}
  await page.evaluate(() => showPull(QP_ID,true,'선행개발'));
  await ready(page);
  await expect(page.locator('.draw-header h2')).toHaveText('선행개발 완료');
  await expect(page.locator('#pullBox')).not.toContainText('소재 출하');
  await expect(page.locator('.draw-stock')).toContainText('선행개발 소재 등록');
  await expect(page.locator('.draw-coil')).not.toBeVisible();
  await expect(page.locator('#pullBox')).not.toContainText('저장됐습니다');
  expect(await state(page)).toEqual(before);
  await snap(page,info,'development-complete');
  await capture(info,'family-development',{glyphs,before,after:await state(page)});
});

test('@draw-happy dex-origin development opens visible result after saved development',async ({page},info) => {
  await openApp(page,appURL,'qp-ready');
  await page.locator('.destination-nav a[href="#dex"]').click();
  await page.getByRole('button',{name:'선행개발 과제 열기',exact:true}).click();
  await probe(page,'showPull');
  await page.locator('#devBtn').click();
  const entry = await page.evaluate(() => drawEntries[0]);
  expect(entry.saved).toEqual(entry.state);
  await expect(page).toHaveURL(/#workshop$/);
  await expect(page.locator('[data-draw-skip]')).toBeFocused();
  await ready(page);
  await expect(page.locator('.draw-art')).toBeFocused();
  expect(await state(page)).toEqual(entry.state);
  await expect(page.locator('.draw-header h2')).toHaveText('선행개발 완료');
  await capture(info,'dex-development',{entry,after:await state(page)});
});

for(const action of ['reset','restore']) test(`@draw-negative ${action} clears active reveal timers`,async ({page},info) => {
  await page.clock.install({time:new Date(fixedTime)});
  await openApp(page,appURL,'mid-progress');
  await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));
  const code = await page.evaluate(() => makeCode());
  await fs.writeFile(`${evidenceRoot}/mid-progress-import.txt`,code+'\n');
  await page.evaluate(() => document.getElementById('btnTen').click());
  expect(await page.evaluate(() => drawBusy())).toBe(true);
  await page.evaluate(({action,code}) => {
    document.getElementById('btnSettings').click();
    if(action === 'reset') {
      document.getElementById('btnReset').click();
      document.getElementById('btnReset').click();
    } else {
      document.getElementById('btnBackup').click();
      document.getElementById('bkIn').value = code;
      document.getElementById('bkLoad').click();
      document.getElementById('bkConfirm').click();
    }
  },{action,code});
  const after = await state(page);
  expect(await page.evaluate(() => drawState)).toBe(null);
  await page.clock.fastForward(2000);
  expect(await state(page)).toEqual(after);
  expect(await saved(page)).toEqual(after);
  await expect(page.locator('#pullBox')).not.toBeVisible();
  await expect(page.locator('#btnPull')).toBeEnabled();
  await capture(info,'lifecycle-reset-restore',{action,after});
});

test('@draw-happy keyboard reveal focus and voluntary focus movement',async ({page},info) => {
  await openApp(page,appURL,'mid-progress');
  await page.locator('#btnPull').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-draw-skip]')).toBeFocused();
  await ready(page); await expect(page.locator('.draw-art')).toBeFocused();
  await page.locator('[data-draw-close]').click(); await expect(page.locator('#btnPull')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-draw-skip]')).toBeFocused();
  await page.locator('#title-workshop').focus(); await ready(page);
  await expect(page.locator('#title-workshop')).toBeFocused();
  const final = await state(page);
  await capture(info,'keyboard-focus',{active:await page.evaluate(() => document.activeElement.id),state:final});
});

test('@draw-happy desktop single result visual',async ({page},info) => {
  await page.setViewportSize({width:1280,height:900});
  await openApp(page,appURL,'mid-progress');
  await page.locator('#btnPull').click(); await ready(page);
  await snap(page,info,'single-1280');
  await capture(info,'desktop-single',{state:await state(page)});
});

for(const width of [390,1280]) test(`@draw-happy six family emblem surface ${width}`,async ({page},info) => {
  await page.setViewportSize({width,height:900});
  await page.clock.install({time:new Date(fixedTime)});
  await openApp(page,appURL,'mid-progress');
  await page.clock.pauseAt(new Date(Date.parse(fixedTime)+1000));
  const before = await state(page);
  await page.evaluate(() => {const ids=FAMS.map(f=>allChars().find(c=>c.fam.key===f.key).id);while(ids.length<10)ids.push(ids[0]);startDraw(drawResultSnapshot(ids,ids.map(()=>false),'ten','계열 확인'));});
  await page.clock.runFor(450);
  await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','family');
  await page.locator('#pullBox').screenshot({path:info.outputPath(`families-${width}.png`),animations:'disabled'});
  const glyphs = await page.locator('.draw-family').evaluateAll(nodes => nodes.map(node => ({family:node.dataset.family,text:node.textContent,rect:node.getBoundingClientRect().toJSON()})));
  expect(glyphs).toHaveLength(6);
  expect(glyphs.map(row=>row.family).sort()).toEqual(['poo','ssial','ga','tarae','eg','qp'].sort());for(const glyph of glyphs){expect(glyph.text.length).toBeGreaterThan(0);expect(glyph.rect.width).toBeGreaterThan(0);}
  expect(await state(page)).toEqual(before);
  await capture(info,'glyph-surface',{width,glyphs,before,after:await state(page)});
});
