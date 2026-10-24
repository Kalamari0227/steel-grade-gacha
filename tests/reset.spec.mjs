import { test, expect } from '@playwright/test';
import { openApp, state, mirror, capture, settings } from './helpers/app.mjs';
import { appURL, baselineURL } from './helpers/paths.mjs';
const missing = ['stock','parts','cars','pullUsed','qpSeen','noticeSeen'];
async function reset(page) {
  await settings(page);
  await page.getByRole('button',{name:'진행 초기화',exact:true}).click();
  await page.getByRole('button',{name:'정말 지웁니다 · 한 번 더 누르면 초기화',exact:true}).click();
}
test('@reset-baseline-repro immutable missing fields and refresh exception', async ({page}, info) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const hash=await openApp(page,baselineURL,'reset-ready');
  await reset(page);
  const after=await state(page);
  expect(missing.filter(k=>!(k in after))).toEqual(missing);
  await expect.poll(()=>errors.length).toBeGreaterThan(0);
  expect(errors.join(' ')).toMatch(/undefined|null/);
  await capture(info,'reset-baseline',{hash,missing,errors,after});
});
test('@reset-happy canonical fields localStorage IDB reload and immediate actions', async ({page},info)=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const hash=await openApp(page,appURL,'reset-ready');
  const before=await state(page);
  const toon=await page.evaluate(()=>localStorage.getItem(TOON_SEEN));
  await reset(page);
  const expected={owned:{},stock:{},last:'',extra:0,quizDay:'',items:{},orderDay:'2026-11-1',orderKey:'',scrap:0,pending:'',pullAt:0,quizAt:0,quizUsed:0,bell:before.bell,belledAt:-1,backupAt:0,orderDone:0,promoSeen:before.promoSeen,promoDone:before.promoDone,noticeSeen:'',parts:{},cars:[],pullUsed:0,qpSeen:0};
  expect(await state(page)).toEqual(expected);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(expected);
  await expect.poll(()=>mirror(page)).toEqual(expected);
  await page.reload();
  expect(await state(page)).toEqual(expected);
  expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe(toon);
  await settings(page);
  await page.getByRole('button',{name:'진행 백업 · 복원',exact:true}).click();
  expect(await page.evaluate(()=>readCode(document.getElementById('bkOut').value).o)).toEqual([]);
  await page.keyboard.press('Escape');
  if(await page.locator('#settingsModal.show').count()) await page.keyboard.press('Escape');
  const pullName=await page.locator('#btnPull').innerText();
  await page.getByRole('button',{name:pullName,exact:true}).click();
  expect(await page.evaluate(()=>totalStock())).toBe(1);
  expect(errors).toEqual([]);
  await capture(info,'reset-storage',{hash,before,expected,afterPull:await state(page),errors,toon});
});
test('@reset-negative first click and five second expiry preserve full state', async ({page},info)=>{
  await page.clock.install();
  await openApp(page,appURL,'reset-ready');
  const before=await state(page);
  const persisted=await page.evaluate(()=>localStorage.getItem(KEY));
  await settings(page);
  await page.getByRole('button',{name:'진행 초기화',exact:true}).click();
  expect(await state(page)).toEqual(before);
  await page.clock.runFor(5001);
  await expect(page.getByRole('button',{name:'진행 초기화',exact:true})).toBeVisible();
  expect(await state(page)).toEqual(before);
  expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(persisted);
  await capture(info,'reset-negative',{before,after:await state(page),persisted});
});
