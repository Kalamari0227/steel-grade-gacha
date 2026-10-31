import {test,expect} from '@playwright/test';
import {appURL} from './helpers/paths.mjs';
import {openApp,state,capture,destination} from './helpers/app.mjs';
import {storageEvidence} from './helpers/storage-evidence.mjs';
storageEvidence(test);

async function finish(page,info,name,before){
  await expect(page.locator('.modal.show,.tview.show')).toHaveCount(0);
  expect(await page.locator('#appShell').evaluate(el=>el.inert)).toBe(false);
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  expect(await state(page)).toEqual(before);
  await capture(info,name,{state:await state(page),active:await page.evaluate(()=>document.activeElement.outerHTML),scrollY:await page.evaluate(()=>scrollY)});
  await page.screenshot({path:info.outputPath(`${name}.png`)});
}
for(const width of [390,1280])test(`@dialog-focus pointer origins and nested settings ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await openApp(page,appURL,'crafting-ready');const before=await state(page);
  await page.locator('#homeRecommend').click();await expect(page.locator('#partModal')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#homeRecommend')).toBeFocused();
  await page.locator('#homeSettings').click();await expect(page.locator('#settingsModal')).toBeVisible();
  for(const [trigger,dialog] of [['settingsNotice','noticeModal'],['settingsPromo','promoModal'],['btnBackup','backupModal']]){
    await page.locator(`#${trigger}`).click();await expect(page.locator(`#${dialog}`)).toBeVisible();
    expect(await page.evaluate(()=>dialogStack.length)).toBe(2);
    await page.keyboard.press('Escape');await expect(page.locator(`#${trigger}`)).toBeFocused();
    expect(await page.locator('#settingsModal').evaluate(el=>el.inert)).toBe(false);
    expect(await page.evaluate(()=>dialogStack.length)).toBe(1);
  }
  await page.keyboard.press('Escape');await expect(page.locator('#homeSettings')).toBeFocused();
  await finish(page,info,`pointer-nested-${width}`,before);
});

test('@dialog-focus reader middle target Tab order and origin scroll',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await openApp(page,appURL,'crafting-ready');await destination(page,'research');const before=await state(page);
  await page.locator('#btnToon').click();await page.locator('#toonBox .ep').first().click();
  await expect(page.locator('#toonView')).toBeVisible();await page.locator('#toonBack').click();
  const episodes=page.locator('#toonBox .ep');await expect(episodes.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.locator('#toonX')).toBeFocused();
  await page.keyboard.press('Tab');await expect(episodes.first()).toBeFocused();
  await page.keyboard.press('Tab');await expect(episodes.nth(1)).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(episodes.first()).toBeFocused();
  expect(await page.evaluate(()=>dialogStack.length)).toBe(1);
  await page.keyboard.press('Escape');await expect(page.locator('#btnToon')).toBeFocused();
  await finish(page,info,'reader-middle-tab',before);
});

test('@dialog-focus material summaries keyboard and rebuilt pointer trigger',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await openApp(page,appURL,'crafting-ready');await destination(page,'craft');
  const origin=page.locator('#parts [data-part-key="bpillar"]');await origin.click();
  await expect(page.locator('#craftTitle')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#partX')).toBeFocused();
  await page.keyboard.press('Tab');const summary=page.locator('#partBox summary').first();await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');await expect(summary.locator('..')).toHaveAttribute('open','');
  await page.keyboard.press('Tab');await expect(page.locator('#partBox details').first().locator('button:not(:disabled)').first()).toBeFocused();
  await page.keyboard.press('Escape');await expect(origin).toBeFocused();
  await origin.click();await page.locator('#mkBtn').click();await expect(page.locator('#craftStatus')).toBeFocused();
  await page.keyboard.press('Escape');await expect(origin).toBeFocused();
  expect(await origin.evaluate(el=>el.isConnected)).toBe(true);
  await capture(info,'rebuilt-trigger',{state:await state(page),active:await origin.evaluate(el=>el.outerHTML)});
  await page.screenshot({path:info.outputPath('rebuilt-trigger.png')});
});

test('@dialog-focus nested card pointer and route does not restore hidden trigger',async({page},info)=>{
  await openApp(page,appURL,'crafting-ready');await destination(page,'research');
  await page.evaluate(()=>{const it=ITEMS.find(it=>fitOwned(it.key).length);S.items[it.key]=1;refresh();});
  const origin=page.locator('#items button[data-item-key]').first();await origin.click();
  const detail=page.locator('[data-guarantee-card]').first();await detail.click();
  await expect(page.locator('#cardModal')).toBeVisible();expect(await page.evaluate(()=>dialogStack.length)).toBe(2);
  await page.keyboard.press('Escape');await expect(detail).toBeFocused();
  await detail.click();await page.locator('[data-card-learning]').click();
  await expect(page.locator('.modal.show,.tview.show')).toHaveCount(0);await expect(page.locator('#title-research')).toBeFocused();
  expect(await page.evaluate(()=>!!document.activeElement.closest('[hidden],[inert]'))).toBe(false);
  await capture(info,'nested-route',{state:await state(page),active:await page.evaluate(()=>document.activeElement.outerHTML)});
});
