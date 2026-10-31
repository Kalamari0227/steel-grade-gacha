import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { appURL, evidenceRoot } from './helpers/paths.mjs';
import { openApp, state, capture, destination } from './helpers/app.mjs';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = []; errors.set(page, list);
  page.on('pageerror', error => list.push(error.message));
  page.on('console', message => { if(message.type() === 'error') list.push(message.text()); });
});
test.afterEach(async ({ page }, info) => {
  await capture(info, 'console', errors.get(page));
  expect(errors.get(page)).toEqual([]);
});
async function observe(page) {
  return page.evaluate(() => {
    const p = PARTS.find(p => !partDone(p) && partReady(p));
    const plan = p ? partPlan(p) : [];
    return { base: pullBaseLeft(), extra: S.extra, scrap: S.scrap, parts: partCount(), ready: partsReadyCount(), cars: carsOwned(),
      ordinary: POOL.filter(id => S.owned[id]).length, qp: hasQP(), qpVisible: qpRevealed(), allParts: carDone(), allCars: allCarsDone(),
      recommendation: p ? { key: p.key, name: p.name, plan, consume: plan.filter(id => id !== QP_ID).length, free: plan.filter(id => id === QP_ID).length } : null };
  });
}
async function assertHome(page, expected) {
  for(const [id, value] of [['homeBase',expected.base],['homeExtra',expected.extra],['homeScrap',expected.scrap]]) await expect(page.locator(`#${id}`)).toHaveText(String(value));
  await expect(page.locator('#stChars')).toHaveText(`${expected.ordinary} / 44`);
  await expect(page.locator('#stParts')).toHaveText(`${expected.parts} / 35`);
  await expect(page.locator('#stCars')).toHaveText(`${expected.cars} / 8`);
  await expect(page.locator('#homeProgress')).toHaveAttribute('value', String(expected.parts));
  await expect(page.locator('#homeQP')).toContainText(expected.qp ? '개발 완료' : expected.qpVisible ? '과제 공개' : '잠김');
  if(expected.allCars) await expect(page.locator('#homeRecTitle')).toHaveText('모든 자동차를 모았어요');
  else if(expected.allParts) await expect(page.locator('#homeRecTitle')).toHaveText('새 자동차를 선택하세요');
  else if(expected.recommendation) {
    await expect(page.locator('#homeRecommend')).toHaveAttribute('data-part',expected.recommendation.key);
    await expect(page.locator('#homeRecTitle')).toContainText(expected.recommendation.name);
    await expect(page.locator('#homeRecCost')).toContainText(`재고 ${expected.recommendation.consume}장 사용`);
    if(expected.recommendation.free) await expect(page.locator('#homeRecCost')).toContainText(`QP ${expected.recommendation.free}칸 무소모`);
  } else await expect(page.locator('#homeRecommend')).toHaveText('소재 도감 살펴보기 ›');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function screenshot(page, info, name, canonical) {
  if(await page.locator('#toast.show').count()) await page.locator('#toastX').click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('#view-workshop img')].filter(img => !img.hidden).map(img => img.decode()));
    scrollTo(0,0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({path:file,fullPage:true});
  await page.evaluate(async () => {scrollTo(0,0);await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));});
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({path:info.outputPath(`${name}-viewport.png`)});
  if(canonical) await fs.copyFile(file, `${evidenceRoot}/${canonical}.png`);
}
for(const fixture of ['new','mid-progress','crafting-ready','all-parts','all-cars','qp-owned']) {
  test(`@home-happy dynamic state ${fixture}`,async ({page},info) => {
    const hash = await openApp(page,appURL,fixture);
    const expected = await observe(page), before = await state(page);
    await assertHome(page,expected);
    expect(await page.locator('.home-hero').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(300);
    await screenshot(page,info,fixture,fixture === 'crafting-ready' ? 'home' : undefined);
    await page.locator('#homeRecommend').focus();
    await page.evaluate(() => {refresh();refresh();refresh();});
    await expect(page.locator('#homeRecommend')).toBeFocused();
    await page.locator('#homeRecommend').click();
    if(expected.allCars || expected.allParts) {
      await expect(page.locator('#view-garage')).toBeVisible();
      if(expected.allParts && !expected.allCars) await expect(page.locator('#carBox .garage-option').first()).toBeVisible();
    } else if(expected.recommendation) {
      await expect(page.locator('#partModal')).toBeVisible();
      await expect(page.locator('#partBox')).toContainText(expected.recommendation.name);
      await page.keyboard.press('Escape');
      await expect(page.locator('#homeRecommend')).toBeFocused();
    } else await expect(page.locator('#view-dex')).toBeVisible();
    expect(await state(page)).toEqual(before);
    await destination(page,'workshop');
    await page.locator('.home-links a[href="#research"]').click();
    await expect(page.locator('#btnQuiz')).toBeVisible();
    await destination(page,'workshop');
    await page.locator('#homeToon').click();
    await expect(page.locator('#toonModal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#homeToon')).toBeFocused();
    expect(await state(page)).toEqual(before);
    const data = { fixture,hash,expected,before,after:await state(page) };
    await capture(info,'state-assertions',data);
    if(fixture === 'crafting-ready') await fs.writeFile(`${evidenceRoot}/state-assertions.json`,JSON.stringify(data,null,2));
  });
}
test('@home-happy desktop workshop and QP no consumption recommendation',async ({page},info) => {
  await page.setViewportSize({width:1280,height:900});
  await openApp(page,appURL,'qp-owned');
  await page.evaluate(() => {
    const target = PARTS.find(p => partPlan(p)?.includes(QP_ID));
    if(!target) throw new Error('QP fixture must have a free slot');
    PARTS.slice(0,PARTS.indexOf(target)).forEach(p => {S.parts[p.key] = true;});
    refresh();
  });
  const expected = await observe(page), before = await state(page);
  expect(expected.recommendation.free).toBeGreaterThan(0);
  await assertHome(page,expected);
  await screenshot(page,info,'home-1280','home-1280');
  await page.locator('#homeRecommend').click();
  await expect(page.locator('#partModal')).toBeVisible();
  expect(await state(page)).toEqual(before);
  await capture(info,'qp-plan',{expected,before,after:await state(page)});
});
test('@home-negative cooldown scrap19 zero ready and long digits',async ({page},info) => {
  await openApp(page,appURL,'crafting-short');
  await page.evaluate(() => {S.stock = {};S.pullAt = Date.now();S.pullUsed = pullMax();S.extra = 0;S.scrap = 19;refresh();});
  const before = await state(page), expected = await observe(page);
  expect(expected.ready).toBe(0);
  await assertHome(page,expected);
  await expect(page.locator('#btnPull')).toBeDisabled();
  await expect(page.locator('#btnTen')).toBeDisabled();
  await expect(page.locator('#homeTenStatus')).toContainText('1개 부족');
  await expect(page.locator('#homePullStatus')).toContainText('기본 출하 대기');
  await screenshot(page,info,'empty-cooldown','empty-cooldown');
  await page.evaluate(() => {document.getElementById('btnPull').click();document.getElementById('btnTen').click();});
  await page.locator('#homeRecommend').click();
  await expect(page.locator('#view-dex')).toBeVisible();
  expect(await state(page)).toEqual(before);
  await page.evaluate(() => {S.extra = 123456789;S.scrap = 987654321;refresh();});
  await destination(page,'workshop');
  await assertHome(page,await observe(page));
  await screenshot(page,info,'long-digits');
  for(const id of ['homeRecommend','btnPull','btnTen']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(390);
  }
  await capture(info,'negative',{expected,before,afterCooldown:before,longDigits:await observe(page)});
});
test('@home-negative promotion ends and hidden view time refresh',async ({page},info) => {
  await openApp(page,appURL,'promo-boundaries');
  const boundary = await page.evaluate(() => PROMOS[PROMOS.length-1].to);
  await page.clock.setFixedTime(new Date(boundary-1));
  await page.evaluate(() => {refresh();});
  expect(await page.evaluate(() => promoOn())).toBe(true);
  expect(await page.locator('#promoBar.show,#noticeBar.show').count()).toBeGreaterThan(0);
  if(await page.locator('#promoBar.show').count()) {
    await page.locator('#promoBar').click();
    await expect(page.locator('#promoModal')).toBeVisible();
  } else {
    await page.locator('#noticeGo').click();
    await expect(page.locator('#noticeModal')).toBeVisible();
  }
  await page.keyboard.press('Escape');
  const before = await state(page);
  await destination(page,'dex');
  await page.clock.setFixedTime(new Date(boundary));
  await page.evaluate(() => {document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.evaluate(() => promoOn())).toBe(false);
  await expect(page.locator('#promoBar')).not.toBeVisible();
  await expect(page.locator('#noticeBar')).not.toBeVisible();
  await destination(page,'workshop');
  await assertHome(page,await observe(page));
  const after = await state(page);
  for(const key of ['owned','stock','scrap','extra','parts','cars','pullUsed']) expect(after[key]).toEqual(before[key]);
  await screenshot(page,info,'promotion-ended');
  await capture(info,'promotion-ended',{boundary,observed:await observe(page),before,after});
});

for(const width of [390,1280]) test(`@home-happy active notice and promo entries ${width}`,async ({page},info) => {
  await page.setViewportSize({width,height:width === 390 ? 844 : 900});
  await openApp(page,appURL,'mid-progress');
  const dates = await page.evaluate(() => {
    const notice = NOTICES.find(n => PROMOS.some(p => p.from < n.until && p.to > n.from));
    const promo = PROMOS.find(p => !NOTICES.some(n => n.from <= p.from && p.from < n.until));
    if(!notice || !promo) throw new Error('Need real notice and standalone promo dates');
    return {notice:notice.from,promo:promo.from};
  });
  for(const kind of ['notice','promo']) {
    await page.clock.setFixedTime(new Date(dates[kind]));
    await page.evaluate(() => refresh());
    const entry = page.locator(kind === 'notice' ? '#noticeGo' : '#promoBar');
    await expect(entry).toBeVisible();
    const style = await entry.evaluate(el => ({background:getComputedStyle(el).backgroundImage,height:el.getBoundingClientRect().height,color:getComputedStyle(el).color}));
    expect(style.background).toBe('none');
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeLessThanOrEqual(190);
    await screenshot(page,info,`${kind}-active-${width}`);
    const before = await state(page);
    await entry.click();
    await expect(page.locator(`#${kind}Modal`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(entry).toBeFocused();
    expect(await state(page)).toEqual(before);
    await capture(info,`${kind}-entry`,{dates,style,state:before});
  }
});
