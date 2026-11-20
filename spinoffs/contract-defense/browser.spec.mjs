import { test, expect } from '@playwright/test';
const entry = '/spinoffs/contract-defense/';
test('a hidden page keeps its shipping deadline on return', async ({ page }) => {
  await page.clock.install();
  await page.goto(entry);
  await page.getByRole('button', { name: '도금이에게 맡기기' }).click();
  const time = await page.locator('#clock').innerText();
  const setHidden = (hidden) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await page.clock.fastForward(30000);
  await setHidden(false);
  await page.clock.runFor(32);
  await expect(page.locator('#clock')).toHaveText(time);
  await page.clock.fastForward(1010);
  await expect(page.locator('#clock')).toHaveText('02:59');
});
for (const width of [1280, 390]) {
  test('promise victory and retry at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto(entry);
    await expect(page.getByRole('heading', { name: '마지막 두 상자', exact: true })).toBeVisible();
    await expect(page.locator('#roster img')).toHaveCount(3);
    expect(
      await page
        .locator('#roster img')
        .evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0)),
    ).toBeTruthy();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.getByRole('button', { name: '도금이에게 맡기기' }).click();
    await page.clock.fastForward(152100);
    await page.getByRole('button', { name: '도금이 선택', exact: true }).first().click();
    await page.getByRole('button', { name: 'B선으로 이동 미리보기' }).click();
    await expect(page.getByText(/이동하면 약속이 깨져요/)).toBeVisible();
    const time = await page.locator('#clock').innerText();
    await page.clock.fastForward(10000);
    await expect(page.locator('#clock')).toHaveText(time);
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.clock.fastForward(8100);
    await page.getByRole('button', { name: '강판 다리 펼치기' }).click();
    await page.clock.fastForward(3500);
    await expect(page.getByRole('heading', { name: '계약 이행 완료' })).toBeVisible();
    await page.getByRole('button', { name: '다시 도전하기' }).click();
    await expect(page.locator('#clock')).toHaveText('03:00');
    await page.getByRole('button', { name: '도금이에게 맡기기' }).click();
    await page.clock.fastForward(1050);
    await expect(page.locator('#clock')).toHaveText('02:59');
  });
}
test('inspect and pay, reroute and miss deadline', async ({ page }) => {
  await page.clock.install();
  await page.goto(entry);
  await page.getByRole('button', { name: '도금이에게 맡기기' }).click();
  await page.clock.fastForward(82500);
  await page.getByRole('button', { name: /즉시 통과/ }).click();
  await expect(page.locator('#budget')).toHaveText('2');
  await page.getByRole('button', { name: '씨알 선택', exact: true }).first().click();
  await page.getByRole('button', { name: 'B선으로 이동 미리보기' }).click();
  await page.getByRole('button', { name: '이동 확정' }).click();
  await expect(page.locator('#budget')).toHaveText('1');
  await page.clock.fastForward(100000);
  await expect(page.getByRole('heading', { name: '출항 시간 종료' })).toBeVisible();
  await expect(page.locator('#result-copy')).toContainText('9/10');
});
