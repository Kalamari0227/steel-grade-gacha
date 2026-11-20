import {test,expect} from '@playwright/test';
import {createEngine} from '../src/engine.mjs';

// 7단계(진행 보관): 브라우저에서 본 동작. 백업 코드·복원·초기화·사본 규칙의 원본 대조는 qa/stage7.test.mjs가 맡는다.
const SAVE='sgg_game_save_v1', TOON='sgg_game_toon_seen';
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
// 진행이 있는 저장과 그 백업 코드: Node에서 원본 규칙으로 한 번 출하해 만든다.
function progress(extra={}){
  const storage=memory(), e=createEngine({storage,env:{}});
  if(!e.ship(1).ok) throw new Error('seed ship failed');
  const raw=JSON.stringify({...JSON.parse(storage.getItem(SAVE)),...extra});
  const copy=createEngine({storage:{getItem:()=>raw,setItem(){},removeItem(){}},env:{}});
  return {raw,code:copy.backupView().code,owned:Object.keys(JSON.parse(raw).owned)};
}
async function open(page,{save=null,toon=null,hash='workshop'}={}){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({SAVE,TOON,save,toon})=>{if(sessionStorage.getItem('s7-seeded'))return;sessionStorage.setItem('s7-seeded','1');if(save!==null)localStorage.setItem(SAVE,save);if(toon!==null)localStorage.setItem(TOON,toon);},{SAVE,TOON,save,toon});
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const dlg=page=>page.locator('#archive-dialog');
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE);
async function openArchive(page){
  await page.locator('#archive-open').click();
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page).locator('#archive-close')).toBeFocused();
}

test('공방 맨 아래 진행 보관 줄: 출하 버튼은 첫 화면에 남고, 다른 탭에서는 보이지 않는다',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await open(page);
  const row=page.locator('#archive-row');
  await expect(row).toBeVisible();
  await expect(page.locator('#archive-when')).toHaveText('백업 · 복원 · 초기화');
  await expect(page.getByRole('button',{name:'진행 보관 열기'})).toHaveAccessibleDescription('백업 · 복원 · 초기화');
  const ship=await page.locator('main .lobby-ship').boundingBox();
  expect(ship.y+ship.height).toBeLessThanOrEqual(844);
  const box=await row.boundingBox();
  expect(box.y).toBeGreaterThan(ship.y);
  await page.locator('a[data-nav="research"]').first().click();
  await expect(row).toBeHidden();
  await expect(page.locator('footer')).not.toContainText('진행 백업');
});

test('창을 여는 것만으로는 저장이 바뀌지 않고, 코드·저장 상태가 보이며 Esc로 닫으면 초점이 돌아온다',async({page})=>{
  const {raw}=progress();
  await open(page,{save:raw});
  await expect(page.locator('#archive-when')).toHaveText('아직 백업한 적이 없습니다 · 백업 · 복원 · 초기화');
  await openArchive(page);
  await expect(dlg(page).locator('#bk-out')).toHaveValue(/^SGG-GAME1\.[A-Za-z0-9_-]+$/);
  await expect(dlg(page).locator('#bk-summary')).toHaveText('캐릭터 1장 · 아이템 0종 · 스크랩 0장이 담겨 있습니다.');
  await expect(dlg(page).locator('#bk-diag')).toHaveAttribute('aria-busy','false');
  await expect(dlg(page).locator('[data-storage-check="primary"]')).toHaveText('브라우저의 저장 기능을 확인했습니다. 백업 코드도 따로 보관하세요.');
  await expect(dlg(page).locator('[data-storage-check="copy"]')).toHaveText('추가 저장 사본을 만드는 기능도 사용할 수 있습니다.');
  await expect(dlg(page).locator('button.primary:visible')).toHaveCount(1);
  await expect(dlg(page)).not.toContainText('교육용 백업 가져오기');
  expect(JSON.stringify(await saved(page))).toBe(raw);
  await page.keyboard.press('Escape');
  await expect(dlg(page)).toBeHidden();
  await expect(page.locator('#archive-open')).toBeFocused();
});

test('코드 복사: 성공하면 마지막 백업 날짜를 남기고, 실패하면 직접 복사를 안내하며 기록하지 않는다',async({page,context,browserName})=>{
  const {raw}=progress();
  if(browserName==='chromium') await context.grantPermissions(['clipboard-read','clipboard-write']);
  else await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))}});});
  await open(page,{save:raw});
  await openArchive(page);
  await dlg(page).locator('#bk-copy').click();
  if(browserName==='chromium'){
    await expect(dlg(page).locator('#bk-copy-res')).toHaveText('복사했습니다. 메모 등에 붙여 넣어 따로 보관하세요.');
    expect((await saved(page)).backupAt).toBeGreaterThan(0);
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toMatch(/^SGG-GAME1\./);
    await page.keyboard.press('Escape');
    await expect(page.locator('#archive-when')).toHaveText(/^마지막 백업 \d+월 \d+일 · 백업 · 복원 · 초기화$/);
  } else {
    await expect(dlg(page).locator('#bk-copy-res')).toHaveText('자동 복사를 하지 못했습니다. 코드 전체를 선택해 직접 복사해 주세요.');
    expect((await saved(page)).backupAt).toBe(0);
  }
});

test('복원: 미리보기 → 교체, 교체 전 복구 코드가 남고 공방이 새 진행으로 바뀐다',async({page})=>{
  const from=progress(), here=progress({bell:true});
  await open(page,{save:here.raw,toon:'ep02'});
  await openArchive(page);
  const input=dlg(page).locator('#bk-in');
  await input.fill(from.code);
  await dlg(page).getByRole('button',{name:'게임용 백업 미리보기'}).click();
  await expect(dlg(page).locator('#bk-preview')).toBeVisible();
  await expect(dlg(page).locator('#bk-preview-title')).toBeFocused();
  await expect(dlg(page).locator('#bk-previous')).toHaveText(/^현재 게임 진행: 발견 1종/);
  await expect(dlg(page).locator('#bk-next')).toHaveText(/^불러올 게임 진행: 발견 1종/);
  const recovery=await dlg(page).locator('#bk-recovery').inputValue();
  expect(recovery).toMatch(/^SGG-GAME1\./);
  expect(JSON.stringify(await saved(page))).toBe(here.raw);
  // 입력을 고치면 미리보기가 닫힌다
  await input.press('End'); await input.type(' ');
  await expect(dlg(page).locator('#bk-preview')).toBeHidden();
  await dlg(page).getByRole('button',{name:'게임용 백업 미리보기'}).click();
  await dlg(page).getByRole('button',{name:'게임용 진행 교체'}).click();
  await expect(dlg(page).locator('#bk-res')).toHaveText('진행을 이 창에 적용했습니다. 기기에 저장된 진행을 확인했습니다. 캐릭터 1장 · 아이템 0종 · 스크랩 0장.');
  await expect(dlg(page).locator('#bk-recovery-saved')).toBeVisible();
  await expect(dlg(page).locator('#bk-recovery-out')).toHaveValue(recovery);
  const after=await saved(page);
  expect(Object.keys(after.owned)).toEqual(from.owned);
  expect(after.bell).toBe(true); expect(after.results).toBeNull();
  expect(await page.evaluate(k=>localStorage.getItem(k),TOON)).toBe('ep02');
  await page.keyboard.press('Escape');
  await expect(page.locator('#archive-open')).toBeFocused();
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  expect(Object.keys((await saved(page)).owned)).toEqual(from.owned);
});

test('잘못된 코드: 교육용 코드·깨진 코드는 오류만 보이고 진행은 그대로다',async({page})=>{
  const {raw}=progress();
  await open(page,{save:raw});
  await openArchive(page);
  const input=dlg(page).locator('#bk-in');
  await input.fill('SGG1.eyJ2IjoxfQ');
  await dlg(page).getByRole('button',{name:'게임용 백업 미리보기'}).click();
  await expect(dlg(page).locator('#bk-res')).toHaveText('게임용 백업은 SGG-GAME1.으로 시작합니다. 교육용 SGG1. 코드는 이 게임에서 불러올 수 없습니다.');
  await expect(input).toHaveAttribute('aria-invalid','true');
  await expect(dlg(page).locator('#bk-preview')).toBeHidden();
  await input.fill('SGG-GAME1.@@');
  await dlg(page).getByRole('button',{name:'게임용 백업 미리보기'}).click();
  await expect(dlg(page).locator('#bk-res')).toHaveText('백업 코드를 읽지 못했습니다. 코드 전체를 빠짐없이 붙여 넣어 주세요.');
  expect(JSON.stringify(await saved(page))).toBe(raw);
});

test('초기화: 5초 안 두 번째 누름만 실행하고, 취소·시간 초과는 진행을 유지한다',async({page})=>{
  const {raw}=progress({bell:true,promoSeen:'P'});
  await page.clock.install();
  await open(page,{save:raw,toon:'ep04'});
  await openArchive(page);
  const go=dlg(page).locator('#reset-go'), status=dlg(page).locator('#reset-status');
  await go.click();
  await expect(go).toHaveText('5초 안에 다시 누르면 게임 진행 초기화');
  await expect(status).toHaveText('아직 지우지 않았습니다. 취소하거나 이 화면을 닫으면 현재 진행을 유지합니다.');
  await dlg(page).getByRole('button',{name:'초기화 취소'}).click();
  await expect(status).toHaveText('초기화를 취소했습니다. 현재 진행을 유지합니다.');
  await expect(go).toBeFocused();
  await go.click();
  await page.clock.runFor(5100);
  await expect(status).toHaveText('확인 시간이 지났습니다. 현재 진행을 유지합니다.');
  await expect(go).toHaveText('진행 초기화');
  expect(JSON.stringify(await saved(page))).toBe(raw);
  await go.click(); await go.click();
  await expect(status).toHaveText('게임 진행을 초기화했습니다. 공방에서 1회 출하로 다시 시작하세요.');
  const after=await saved(page);
  expect(after.owned).toEqual({}); expect(after.scrap).toBe(0); expect(after.bell).toBe(true); expect(after.promoSeen).toBe('P');
  expect(await page.evaluate(k=>localStorage.getItem(k),TOON)).toBe('ep04');
  await page.keyboard.press('Escape');
  await expect(page.locator('#archive-when')).toHaveText('백업 · 복원 · 초기화');
});

test('빈 local이면 IndexedDB 사본에서 되살리고 토스트로 알린다',async({page})=>{
  const {raw,owned}=progress();
  await open(page,{save:raw});
  // 이 판이 연 뒤 사본을 한 벌 쓴다(원본 부팅의 mirrorPut).
  await expect.poll(()=>page.evaluate(()=>new Promise(r=>{const q=indexedDB.open('sgg_game',1);q.onsuccess=()=>{const g=q.result.transaction('save').objectStore('save').get('sgg_game_save_v1');g.onsuccess=()=>r(!!g.result);};q.onerror=()=>r(false);}))).toBe(true);
  await page.evaluate(k=>localStorage.removeItem(k),SAVE);
  await page.reload();
  await expect(page.locator('#toast')).toContainText('이 기기의 저장소가 비어 있어 사본에서 되살렸습니다. 백업 코드를 받아 두세요.');
  expect(Object.keys((await saved(page)).owned)).toEqual(owned);
});

test('손상된 저장: 경고가 원본 제목과 함께 뜨고, 보관 창에서 백업 코드로 되살리면 저장이 다시 열린다',async({page})=>{
  const {code,owned}=progress();
  await open(page,{save:'{broken'});
  const warning=page.locator('#warning');
  await expect(warning).toContainText('진행 저장을 확인해 주세요');
  await expect(warning).toContainText('기존 자료는 덮어쓰지 않습니다');
  await warning.getByRole('button',{name:'진행 백업 · 복원 열기'}).click();
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page).locator('[data-storage-check="primary"]')).toHaveAttribute('data-state','unconfirmed');
  await expect(dlg(page).locator('#bk-res')).toContainText('기존 자료는 덮어쓰지 않습니다');
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE)).toBe('{broken');
  await dlg(page).locator('#bk-in').fill(code);
  await dlg(page).getByRole('button',{name:'게임용 백업 미리보기'}).click();
  await dlg(page).getByRole('button',{name:'게임용 진행 교체'}).click();
  await expect(dlg(page).locator('#bk-res')).toHaveText(/^진행을 이 창에 적용했습니다\. 기기에 저장된 진행을 확인했습니다\./);
  expect(Object.keys((await saved(page)).owned)).toEqual(owned);
  await page.keyboard.press('Escape');
  await expect(warning).toBeHidden();
});
