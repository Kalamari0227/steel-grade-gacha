import { expect, test } from '@playwright/test';
import {captureFinalResponse} from '../../tools/final-evidence.mjs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { root, baselineRoot, baselineURL, fixedTime } from './paths.mjs';
import { installFixture } from '../game/namespaces.mjs';
export const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export async function openApp(page, url, fixture = 'new') {
  await page.clock.setFixedTime(new Date(fixedTime));
  const saved = JSON.parse(await fs.readFile(`${root}/tests/fixtures/${fixture}.json`, 'utf8'));
  await page.addInitScript(() => { Math.random = () => 0; });
  const response = await page.goto(url);
  const served = sha(await response.body());
  const expected = sha(await fs.readFile(`${new URL(url).origin === new URL(baselineURL).origin ? baselineRoot : root}/index.html`));
  expect(served, 'served main document matches disk').toBe(expected);
  await captureFinalResponse(test.info(),response,{root,kind:new URL(url).origin===new URL(baselineURL).origin?'baseline':'current'});
  await page.waitForFunction(() => typeof S !== 'undefined' && !saveHold && typeof partModal !== 'undefined');
  const edition=new URL(url).origin===new URL(baselineURL).origin?'education':(process.env.SGG_EDITION || 'education');
  const namespaces=await installFixture(page,{...saved,edition});
  const reload=await page.reload();
  expect(sha(await reload.body()), 'reloaded main matches disk').toBe(expected);
  await page.waitForFunction(() => typeof S !== 'undefined' && !saveHold);
  return { served, namespaces, state: await state(page) };
}
export const state = page => page.evaluate(() => JSON.parse(JSON.stringify(S)));
export async function destination(page, route) {
  if (await page.locator('.destination-nav').count()) {
    await page.locator(`.destination-nav a[href="#${route}"]`).click();
    await expect(page.locator(`#view-${route}`)).toBeVisible();
  }
}
export async function settings(page) {
  if (await page.locator('#btnSettings').count()) {
    await page.locator('#btnSettings').click();
    await expect(page.locator('#settingsModal')).toBeVisible();
  }
}
export const mirror = page => page.evaluate(() => new Promise(resolve => mirrorGet(raw => resolve(raw ? JSON.parse(raw) : null))));
export async function capture(testInfo, name, value) {
  const file = testInfo.outputPath(`${name}.json`);
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path: file, contentType: 'application/json' });
}
export function catalog() {
  return {
    pool: POOL, cards: allChars().map(c => ({ ...c, fam: c.fam.key, spec: specOf(c), back: specOf(c, true), duct: ductRow(specOf(c)) })),
    parts: PARTS, cars: CARS, items: ITEMS.map(i => ({ ...i, fit: POOL.filter(id => i.fit(findChar(id))) })),
    orders: ORDERS, quiz: QUIZ, promos: PROMOS, rates: LVRATE, rare: RARE,
    keys: { save: KEY, toon: TOON_SEEN }, toon: TOON,
  };
}
