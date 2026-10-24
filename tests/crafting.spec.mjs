import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { root, appURL, evidenceRoot } from './helpers/paths.mjs';
import { openApp, state, capture, destination } from './helpers/app.mjs';

const catalog = JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`, 'utf8'));
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const seen = []; errors.set(page, seen);
  page.on('pageerror', error => seen.push(error.message));
  page.on('console', message => { if(message.type() === 'error') seen.push(message.text()); });
});
test.afterEach(async ({ page }, info) => {
  await capture(info, 'console', errors.get(page));
  expect(errors.get(page)).toEqual([]);
});
async function seed(page, fixture = 'crafting-ready') {
  await openApp(page, appURL, fixture);
  await destination(page, 'workshop');
}
async function open(page, key) {
  await page.locator(`#parts [data-part-key="${key}"]`).click();
  await expect(page.locator('#craftTitle')).toBeFocused();
}
async function select(page, slot, id) {
  const section = page.locator(`.craft-slot[data-slot="${slot}"]`);
  if(!await section.locator('details').evaluate(el => el.open)) await section.locator('summary').click();
  await section.locator(`button[data-id="${id}"]`).click();
  await expect(section.locator(`button[data-id="${id}"]`)).toBeFocused();
  await expect(section.locator(`button[data-id="${id}"]`)).toBeInViewport();
}
async function preview(page) {
  return page.locator('.craft-slot').evaluateAll(slots => slots.map(slot => slot.dataset.selectedId));
}
function expectedStock(before, use) {
  const result = {...before};
  for(const id of use) if(id !== 'qp-1470') { result[id]--; if(!result[id]) delete result[id]; }
  return result;
}
async function record(info, name, value) {
  await capture(info, name, value);
  await fs.mkdir(evidenceRoot, {recursive:true});
  await fs.writeFile(`${evidenceRoot}/${name}.json`, JSON.stringify(value, null, 2));
}
async function screenshot(page, info, name) {
  await page.waitForFunction(() => document.getElementById('partModal').getAnimations({subtree:true}).every(a => a.playState === 'finished'));
  const file = info.outputPath(`${name}.png`); await page.screenshot({path:file});
  await fs.mkdir(evidenceRoot, {recursive:true}); await fs.copyFile(file, `${evidenceRoot}/${name}.png`);
}

test('@craft-happy B pillar exact stock progress persistence and focus', async ({page}, info) => {
  await seed(page);
  const craftingReadyCode=await page.evaluate(()=>makeCode());
  await page.evaluate(() => {
    S.stock = {'poo-PHS':1,'ssial-980Y':2};
    S.parts = Object.fromEntries(PARTS.filter(p => p.key !== 'bpillar').slice(0,12).map(p => [p.key,{at:Date.now(),use:[]}]));
    refresh();
  });
  const before = await state(page);const bpillarCode=await page.evaluate(()=>makeCode());
  await record(info,'manual-import',{craftingReadyCode,bpillarCode});await open(page, 'bpillar');
  expect(await preview(page)).toEqual(['poo-PHS','ssial-980Y']);
  await expect(page.locator('.craft-stock').nth(0)).toContainText('1장 → 0장');
  await expect(page.locator('.craft-stock').nth(1)).toContainText('2장 → 1장');
  await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','2');
  await expect(page.locator('#craftProgress')).toHaveText('12 → 13 / 35');
  await screenshot(page, info, 'bpillar');
  await page.locator('#mkBtn').click();
  const after = await state(page);
  expect(after.stock).toEqual({'ssial-980Y':1}); expect(Object.keys(after.parts)).toHaveLength(13);
  expect(after.parts.bpillar.use).toEqual(['poo-PHS','ssial-980Y']); expect(after.owned).toEqual(before.owned);
  await expect(page.locator('#craftStatus')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-part-key="bpillar"]')).toBeFocused();
  await page.reload(); await page.waitForFunction(() => typeof S !== 'undefined' && !saveHold);
  const restored = await state(page); expect(restored.stock).toEqual(after.stock); expect(restored.parts).toEqual(after.parts);
  await record(info, 'consumption', {before, after, restored});
});

test('@craft-happy all35 exact candidate sets default and explicit consumption', async ({page}, info) => {
  test.setTimeout(180000); await seed(page); const rows = [];
  for(const part of catalog.parts) for(const mode of ['default','explicit']) {
    await page.evaluate(() => { S.stock=Object.fromEntries(POOL.map(id=>[id,10])); S.parts={}; refresh(); });
    const before = await state(page); await open(page,part.key);
    await expect(page.locator('.craft-note')).toHaveText(part.note);
    const candidates = await page.locator('.craft-slot').evaluateAll(slots=>slots.map(s=>Array.from(s.querySelectorAll('button[data-id]'),b=>b.dataset.id)));
    expect(candidates).toEqual(part.need.map(slot=>slot.any));
    const defaultPlan = await page.evaluate(key=>partPlan(findPart(key)),part.key);
    expect(await preview(page)).toEqual(defaultPlan);
    const explicit = part.need.map(slot=>slot.any[slot.any.length-1]);
    const selectionBefore={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))},selections=[];
    if(mode==='explicit') for(const [slot,id] of explicit.entries()){
      await select(page,slot,id);const selected={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))};
      expect(selected).toEqual(selectionBefore);selections.push({slot,id,after:selected});
    }
    const predicted=await preview(page); if(mode==='explicit')expect(predicted).toEqual(explicit);
    await expect(page.locator('#craftCost')).toHaveAttribute('data-consume',String(predicted.length));
    await page.locator('#mkBtn').click(); const after=await state(page);
    expect(after.parts[part.key].use).toEqual(predicted); expect(after.stock).toEqual(expectedStock(before.stock,predicted));
    expect(after.owned).toEqual(before.owned); rows.push({key:part.key,mode,candidates,predicted,selectionBefore,selections,use:after.parts[part.key].use,stock:after.stock});
    await page.keyboard.press('Escape');
  }
  await record(info,'recipes',rows); expect(rows).toHaveLength(70);
});

test('@craft-happy QP free slot and explicit ordinary alternative', async ({page},info) => {
  await seed(page,'qp-owned'); await open(page,'bpillar');
  expect(await preview(page)).toEqual(['qp-1470','ssial-980Y']);
  await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','1');
  const before=await state(page); await page.locator('#mkBtn').click(); const free=await state(page);
  expect(free.stock).toEqual(expectedStock(before.stock,['qp-1470','ssial-980Y']));
  expect(free.stock['qp-1470']).toBe(1); await page.keyboard.press('Escape');
  await page.evaluate(saved=>{applySaved(saved);refresh();},before); await open(page,'bpillar');
  const selectionBefore={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))},selections=[];
  for(const [slot,id] of [[0,'ga-1470H'],[1,'ga-980Y']]){await select(page,slot,id);const selected={state:await state(page),saved:await page.evaluate(()=>localStorage.getItem(KEY))};expect(selected).toEqual(selectionBefore);selections.push({slot,id,after:selected});}
  await capture(info,'selection-only',{before:selectionBefore,selections});
  expect(await preview(page)).toEqual(['ga-1470H','ga-980Y']);
  await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','2');
  await page.locator('#mkBtn').click(); const explicit=await state(page);
  expect(explicit.stock).toEqual(expectedStock(before.stock,['ga-1470H','ga-980Y']));
  expect(explicit.owned).toEqual(before.owned); await record(info,'qp-consumption',{before,free,explicit});
});

test('@craft-negative shortage zero stock and completed recipes do not consume', async ({page},info) => {
  await seed(page,'crafting-short'); const rows=[];
  for(const stock of [{},{'poo-PHS':1}]) {
    await page.evaluate(stock=>{S.stock=stock;refresh();},stock); const before=await state(page); await open(page,'bpillar');
    await expect(page.locator('#mkBtn')).toBeDisabled(); expect(await page.locator('.craft-short').count()).toBeGreaterThan(0);
    await screenshot(page,info,'shortage'); await page.keyboard.press('Escape'); expect(await state(page)).toEqual(before);rows.push({before,after:await state(page)});
  }
  await page.evaluate(()=>{S.parts.bpillar={at:Date.now(),use:[]};refresh();}); const before=await state(page); await open(page,'bpillar');
  await expect(page.locator('#mkBtn')).toHaveCount(0); expect(await page.evaluate(()=>craft('bpillar'))).toBe(false);
  expect(await state(page)).toEqual(before); await record(info,'unchanged-state',rows.concat({before,after:await state(page)}));
});

test('@craft-negative stale stock and repeated clicks revalidate without overconsumption', async ({page},info) => {
  await seed(page); await open(page,'bpillar');
  await page.evaluate(()=>{S.stock={'poo-PHS':1};}); const shortage=await state(page);
  await page.locator('#mkBtn').click(); await expect(page.locator('#mkBtn')).toBeDisabled();
  expect(await state(page)).toEqual(shortage); await expect(page.locator('#craftStatus')).toBeFocused(); await page.keyboard.press('Escape');
  await page.evaluate(()=>{S.stock={'poo-PHS':1,'ssial-980Y':2,'ga-1470H':1};refresh();}); await open(page,'bpillar');
  await page.evaluate(()=>{delete S.stock['poo-PHS'];}); const before=await state(page);
  await page.locator('#mkBtn').click();
  expect(await state(page)).toEqual(before); expect(await preview(page)).toEqual(['ga-1470H','ssial-980Y']);
  await expect(page.locator('#craftStatus')).toBeFocused();
  await expect(page.locator('#mkBtn')).toBeEnabled();
  await page.evaluate(()=>{const b=document.getElementById('mkBtn');b.click();b.click();}); const after=await state(page);
  expect(after.parts.bpillar.use).toEqual(['ga-1470H','ssial-980Y']);
  expect(after.stock).toEqual({'ssial-980Y':1}); expect(after.owned).toEqual(before.owned); expect(Object.keys(after.parts)).toHaveLength(1);
  await record(info,'stale-double-click',{shortage,before,after});
});

test('@craft-negative invalid explicit pick falls back and repeated slots reserve stock', async ({page},info) => {
  await seed(page); await open(page,'bpillar');
  await page.locator('.craft-slot').first().locator('summary').click();
  const candidate=page.locator('.craft-slot').first().locator('button[data-id]').first();
  await candidate.evaluate(b=>b.dataset.id='invalid-card'); await candidate.click();
  expect(await preview(page)).toEqual(['poo-PHS','ssial-980Y']);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{findPart('bpillar').need=[{n:'첫 칸',any:['poo-270C']},{n:'둘째 칸',any:['poo-270C']}];S.stock={'poo-270C':1};refresh();});
  const before=await state(page); await open(page,'bpillar');
  expect(await preview(page)).toEqual(['poo-270C','']); await expect(page.locator('#mkBtn')).toBeDisabled();
  expect(await page.evaluate(()=>partPlan(findPart('bpillar')))).toBeNull(); expect(await state(page)).toEqual(before);
  await page.keyboard.press('Escape'); await page.evaluate(()=>{S.stock['poo-270C']=2;refresh();}); await open(page,'bpillar');
  expect(await preview(page)).toEqual(['poo-270C','poo-270C']); await expect(page.locator('#craftCost')).toHaveAttribute('data-consume','2');
  await page.locator('#mkBtn').click(); const after=await state(page);
  expect(after.stock).toEqual({}); expect(after.parts.bpillar.use).toEqual(['poo-270C','poo-270C']);
  await record(info,'repeated-reservations',{before,after});
});

test('@craft-negative same selected material changed quantity refreshes preview before consumption', async ({page},info) => {
  await seed(page);await page.evaluate(()=>{S.stock={'poo-PHS':1,'ssial-980Y':2};refresh();});await open(page,'bpillar');
  await page.evaluate(()=>{S.stock['ssial-980Y']=3;});const before=await state(page);await page.locator('#mkBtn').click();
  expect(await state(page)).toEqual(before);await expect(page.locator('.craft-stock').nth(1)).toContainText('3장 → 2장');
  expect(await preview(page)).toEqual(['poo-PHS','ssial-980Y']);await page.locator('#mkBtn').click();const after=await state(page);
  expect(after.stock).toEqual({'ssial-980Y':2});expect(after.parts.bpillar.use).toEqual(['poo-PHS','ssial-980Y']);
  await record(info,'stale-quantity',{before,after});
});

for(const width of [360,390,768,1280]) test(`@craft-happy material choices retain dialog focus at ${width}`, async ({page},info) => {
  await page.setViewportSize({width,height:width<768?844:1024});await page.emulateMedia({reducedMotion:'reduce'}); await seed(page); await open(page,'bpillar');
  await select(page,0,'ga-1470H'); await select(page,1,'ga-980Y');
  expect(await preview(page)).toEqual(['ga-1470H','ga-980Y']);
  for(const key of ['Tab','Shift+Tab','Shift+Tab']) {
    await page.keyboard.press(key);
    expect(await page.locator('#partModal').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  expect(await page.locator('#partBox').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('.craft-hero img').evaluate(img=>img.decode());
  await screenshot(page,info,`craft-choices-${width}`);
  await page.locator('#craftTitle').scrollIntoViewIfNeeded();await screenshot(page,info,`craft-top-${width}`);
  await page.locator('#mkBtn').scrollIntoViewIfNeeded();await expect(page.locator('#mkBtn')).toBeInViewport();await screenshot(page,info,`craft-cost-${width}`);
  await page.locator('#craftBack').click();
  await expect(page.locator('[data-part-key="bpillar"]')).toBeFocused();
  expect(await page.locator('#appShell').evaluate(el=>el.inert)).toBe(false);
});
