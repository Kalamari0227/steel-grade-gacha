import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { appURL, evidenceRoot } from './helpers/paths.mjs';
import { openApp, state, capture, destination, settings } from './helpers/app.mjs';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const seen = [];
  errors.set(page, seen);
  page.on('pageerror', error => seen.push(error.message));
  page.on('console', message => { if (message.type() === 'error') seen.push(message.text()); });
});
test.afterEach(async ({ page }, info) => {
  expect(errors.get(page)).toEqual([]);
  await capture(info, 'console', errors.get(page));
});
async function unlocked(page) {
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(await page.locator('#appShell').evaluate(el => el.inert)).toBe(false);
  expect(await page.evaluate(() => !!document.activeElement.closest('[hidden],[inert]'))).toBe(false);
}
async function assertDialog(page, id) {
  const dialog = page.locator(`#${id}`);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  expect(await dialog.evaluate(el => !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')))).toBe(true);
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  expect(await page.locator('#appShell').evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.waitForFunction(() => [...document.querySelectorAll('.modal.show,.tview.show')].every(el =>
    getComputedStyle(el).opacity === '1' && el.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished')));
}
for (const width of [390, 1280]) test(`@navigation-happy five destinations reload back and dialogs at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const hash = await openApp(page, appURL, 'qp-owned');
  const before = await state(page);
  const screenshots = [];
  for (const route of ['workshop', 'dex', 'craft', 'research', 'garage']) {
    await destination(page, route);
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
    await expect(page.locator('.destination:not([hidden])')).toHaveCount(1);
    await expect(page.locator(`.destination-nav a[href="#${route}"]`)).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const file = info.outputPath(`${route}-${width}.png`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: file });
    expect(await page.evaluate(() => scrollY), 'route capture starts at the document top').toBe(0);
    screenshots.push(file);
    await page.reload();
    await expect(page.locator(`#view-${route}`)).toBeVisible();
  }
  await page.goBack();
  await expect(page.locator('#view-research')).toBeVisible();
  await settings(page);
  await assertDialog(page, 'settingsModal');
  await page.screenshot({ path: info.outputPath(`settings-${width}.png`) });
  for (const [trigger, dialog] of [['settingsNotice', 'noticeModal'], ['settingsPromo', 'promoModal']]) {
    await page.locator(`#${trigger}`).click();
    await assertDialog(page, dialog);
    await page.screenshot({ path: info.outputPath(`${dialog}-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(page.locator(`#${trigger}`)).toBeFocused();
  }
  await page.locator('#btnBackup').click();
  await assertDialog(page, 'backupModal');
  await page.screenshot({ path: info.outputPath(`backup-${width}.png`) });
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnBackup')).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnSettings')).toBeFocused();
  await unlocked(page);
  await destination(page, 'craft');
  const part = page.locator('#parts .pcell').first();
  await part.click();
  await assertDialog(page, 'partModal');
  await page.screenshot({ path: info.outputPath(`part-${width}.png`) });
  await page.keyboard.press('Escape');
  await expect(part).toBeFocused();
  await destination(page, 'research');
  await page.locator('#btnOrder').click();
  await assertDialog(page, 'pickModal');
  await page.screenshot({ path: info.outputPath(`order-${width}.png`) });
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnOrder')).toBeFocused();
  await page.locator('#btnQuiz').click();
  await assertDialog(page, 'quizModal');
  await page.screenshot({ path: info.outputPath(`quiz-${width}.png`) });
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnQuiz')).toBeFocused();
  await destination(page, 'dex');
  const card = page.locator('#dex .cell.have').filter({ hasText: 'PHS' }).first();
  await card.click();
  await assertDialog(page, 'cardModal');
  await page.screenshot({ path: info.outputPath(`card-${width}.png`) });
  await page.locator('#cardFlip').click();
  await expect(page.locator('#cardBox .fbadge')).toContainText('열처리 후');
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  await unlocked(page);
  expect(await state(page)).toEqual(before);
  await capture(info, 'navigation', { hash, before, after: await state(page), screenshots });
});

test('@navigation-happy compact and tablet shell widths', async ({ page }, info) => {
  const hash = await openApp(page, appURL, 'mid-progress');
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 1024 });
    for (const route of ['workshop', 'dex', 'craft', 'research', 'garage']) {
      await destination(page, route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${route}-${width}.png`) });
    }
  }
  await capture(info, 'responsive', hash);
});

test('@navigation-negative unknown route repeated Escape backdrop back and nested dialogs preserve state', async ({ page }, info) => {
  const hash = await openApp(page, `${appURL}/?preview=unrecognized#missing`, 'qp-owned');
  await expect(page).toHaveURL(/\?preview=unrecognized#workshop$/);
  const before = await state(page);
  const cases = [];
  for (let i = 0; i < 3; i++) {
    await settings(page);
    await page.locator('#btnBackup').click();
    await assertDialog(page, 'backupModal');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await unlocked(page);
    cases.push({ action: 'repeated Escape', iteration: i, state: await state(page) });
  }
  await settings(page);
  await page.locator('#settingsModal').click({ position: { x: 4, y: 4 } });
  await expect(page.locator('#settingsModal')).not.toBeVisible();
  await expect(page.locator('#btnSettings')).toBeFocused();
  await unlocked(page);
  await settings(page);
  await page.locator('#btnInstall').click();
  await expect(page.locator('#installBar')).toBeVisible();
  await expect(page.locator('#installGo')).toBeFocused();
  await page.screenshot({ path: info.outputPath('installation-guide.png') });
  await page.locator('#installX').click();
  await expect(page.locator('#btnSettings')).toBeFocused();
  await unlocked(page);
  await destination(page, 'research');
  await page.locator('#btnToon').click();
  await assertDialog(page, 'toonModal');
  await page.screenshot({ path: info.outputPath('webtoon-list.png') });
  await page.locator('#toonBox .ep').first().click();
  await assertDialog(page, 'toonView');
  await page.screenshot({ path: info.outputPath('webtoon-viewer.png') });
  await page.locator('#toonBack').click();
  await assertDialog(page, 'toonModal');
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnToon')).toBeFocused();
  await unlocked(page);
  await destination(page, 'dex');
  await page.locator('#dex .cell.have').first().click();
  await page.goBack();
  await expect(page.locator('#view-research')).toBeVisible();
  await expect(page.locator('.modal.show,.tview.show')).toHaveCount(0);
  await unlocked(page);
  expect(await state(page)).toEqual(before);
  const proof = { hash, before, after: await state(page), cases, console: errors.get(page), lockedScroll: false, hiddenFocus: false };
  await capture(info, 'negative', proof);
  await fs.writeFile(`${evidenceRoot}/negative.json`, JSON.stringify(proof, null, 2));
});
