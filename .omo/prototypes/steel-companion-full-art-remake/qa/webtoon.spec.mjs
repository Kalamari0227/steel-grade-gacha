import {test,expect} from '@playwright/test';

// 6단계(현장 소식지·웹툰): 브라우저에서 본 동작. 읽음 규칙의 원본 대조는 qa/toon.test.mjs가 맡는다.
const TOON='sgg_game_toon_seen', SAVE='sgg_game_save_v1';
async function open(page,{toon=null,hash='research',motion='reduce',init=null}={}){
  await page.emulateMedia({reducedMotion:motion});
  await page.addInitScript(({TOON,toon})=>{if(sessionStorage.getItem('toon-seeded'))return;sessionStorage.setItem('toon-seeded','1');if(toon!==null)localStorage.setItem(TOON,toon);},{TOON,toon});
  if(init) await page.addInitScript(init);
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const dlg=page=>page.locator('#toon-dialog');
const rows=page=>dlg(page).locator('.toon-row');
const seenKey=page=>page.evaluate(k=>localStorage.getItem(k),TOON);
const openSheet=async page=>{await page.locator('#toon-open').click();await expect(dlg(page)).toBeVisible();await expect(dlg(page).locator('#toon-list-title')).toBeFocused();};
async function imagesReady(page){await expect.poll(()=>dlg(page).locator('.toon-page[data-state="ready"]').count()).toBeGreaterThan(0);}

test('처음 프로필은 모두 NEW이고, 목록을 여는 것만으로는 읽음이 바뀌지 않는다',async({page})=>{
  await open(page);
  await expect(page.locator('#toon-note .toon-stamp')).toBeVisible();
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','true');
  await expect(page.getByRole('link',{name:'연구',exact:true})).toHaveAccessibleDescription('새 웹툰이 있어요');
  await openSheet(page);
  await expect(rows(page)).toHaveCount(3);
  await expect(dlg(page).locator('.toon-stamp')).toHaveCount(3);
  expect(await seenKey(page)).toBeNull();
  // 노랑(primary)은 가장 앞선 안 읽은 회차 한 곳
  await expect(dlg(page).locator('button.primary')).toHaveCount(1);
  await expect(rows(page).first().locator('button')).toHaveClass(/primary/);
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE)).toBeNull();
});

test('목록 → 회차 → 다음·이전 → 목록 → 닫기, 읽음은 앞으로만 간다',async({page})=>{
  await open(page);
  await openSheet(page);
  await rows(page).nth(1).locator('button').click();
  await expect(dlg(page).locator('#toon-view-title')).toHaveText('1화 · 녹초');
  await expect(dlg(page).locator('#toon-view-title')).toBeFocused();
  expect(await seenKey(page)).toBe('ep01');
  await imagesReady(page);
  const prev=dlg(page).getByRole('button',{name:'‹ 이전 화'}), next=dlg(page).getByRole('button',{name:'다음 화 ›'});
  await expect(prev).toBeEnabled(); await expect(next).toBeEnabled();
  await next.click();
  await expect(dlg(page).locator('#toon-view-title')).toHaveText('2화 · 톤당');
  await expect(next).toBeDisabled();
  await expect(dlg(page).locator('.toon-note-line')).toContainText('톤당 100만 원');
  expect(await seenKey(page)).toBe('ep02');
  await dlg(page).getByRole('button',{name:'‹ 이전 화'}).click();
  expect(await seenKey(page)).toBe('ep02');
  await dlg(page).getByRole('button',{name:'‹ 이전 화'}).click();
  await expect(dlg(page).locator('#toon-view-title')).toHaveText('연재 안내 · 등장인물 소개');
  await expect(dlg(page).getByRole('button',{name:'‹ 이전 화'})).toBeDisabled();
  expect(await seenKey(page)).toBe('ep02');
  await dlg(page).getByRole('button',{name:'목록'}).click();
  await expect(dlg(page).locator('#toon-list-title')).toBeVisible();
  await expect(dlg(page).locator('.toon-stamp')).toHaveCount(0);
  await expect(rows(page).first().locator('button')).toBeFocused();
  await dlg(page).getByRole('button',{name:'닫기'}).click();
  await expect(dlg(page)).toBeHidden();
  await expect(page.locator('#toon-open')).toBeFocused();
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','false');
  await expect(page.locator('#toon-note .toon-stamp')).toHaveCount(0);
});

test('이전 게임의 읽음 기록(같은 키)을 이어받는다',async({page})=>{
  await open(page,{toon:'ep01'});
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','true');
  await openSheet(page);
  await expect(dlg(page).locator('.toon-stamp')).toHaveCount(1);
  await expect(rows(page).nth(2).locator('.toon-stamp')).toBeVisible();
  await expect(rows(page).nth(2).locator('button')).toHaveClass(/primary/);
  await dlg(page).getByRole('button',{name:'닫기'}).click();
  await page.evaluate(k=>localStorage.setItem(k,'ep02'),TOON);
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','false');
});

test('손상된 읽음 값은 모두 NEW로 보이고 쓰기 실패는 조용히 넘어간다',async({page})=>{
  await open(page,{toon:'zzz'});
  await openSheet(page);
  await expect(dlg(page).locator('.toon-stamp')).toHaveCount(3);
  await dlg(page).getByRole('button',{name:'닫기'}).click();
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sgg_game_toon_seen')throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
  await openSheet(page);
  await rows(page).nth(1).locator('button').click();
  await expect(dlg(page).locator('#toon-view-title')).toHaveText('1화 · 녹초');
  await imagesReady(page);
  expect(await seenKey(page)).toBe('zzz');
  await dlg(page).getByRole('button',{name:'목록'}).click();
  await expect(dlg(page).locator('.toon-stamp')).toHaveCount(3);
});

test('다른 탭에서 읽음이 바뀌면 점과 소식지 줄이 따라가고 진행 저장은 그대로다',async({page,context})=>{
  await open(page);
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','true');
  const other=await context.newPage();
  await other.goto('/#workshop');
  await other.evaluate(k=>localStorage.setItem(k,'ep02'),TOON);
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','false');
  await expect(page.locator('#toon-note .toon-stamp')).toHaveCount(0);
  await other.close();
});

test('다른 탭 변경 때 열려 있는 목록이 다시 그려지고 초점은 그대로다',async({page,context})=>{
  await open(page);
  await openSheet(page);
  await rows(page).first().locator('button').focus();
  const other=await context.newPage(); await other.goto('/#workshop');
  await other.evaluate(k=>localStorage.setItem(k,'ep01'),TOON);
  await expect(dlg(page).locator('.toon-stamp')).toHaveCount(1);
  await expect(rows(page).first().locator('button')).toBeFocused();
  await other.close();
});

test('그림 불러오기 실패는 그 쪽만 표시하고, 다시 시도하면 불러온다',async({page})=>{
  let calls=0;
  await page.route(/webtoon\/ep01\.webp/,route=>{calls++;return calls===1?route.abort('failed'):route.continue();});
  await open(page);
  await openSheet(page);
  await rows(page).nth(1).locator('button').click();
  const pageBox=dlg(page).locator('.toon-page').first();
  await expect(pageBox).toHaveAttribute('data-state','error');
  await expect(pageBox.locator('.toon-status')).toContainText('그림을 불러오지 못했습니다');
  const retry=pageBox.getByRole('button',{name:'그림 다시 불러오기'});
  await expect(retry).toBeVisible();
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await retry.click();
  await expect(pageBox).toHaveAttribute('data-state','ready');
  await expect(retry).toBeHidden();
  expect(calls).toBe(2);
  // 실패해도 회차는 열렸으므로 읽음이다(원본과 같다).
  expect(await seenKey(page)).toBe('ep01');
});

test('키보드: Enter로 열고, Esc는 지면→목록→닫기, 닫으면 열기 버튼으로 초점이 돌아온다',async({page})=>{
  await open(page);
  await page.locator('#toon-open').focus();
  await page.keyboard.press('Enter');
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page).locator('#toon-list-title')).toBeFocused();
  // 초점 순서: 창 머리의 [닫기] → 첫 회차의 [읽기]. 제목에서 Tab 한 번이 첫 읽기로 간다.
  await page.keyboard.press('Tab');
  await expect(rows(page).first().locator('button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dlg(page).locator('#toon-view-title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dlg(page).locator('#toon-list-title')).toBeVisible();
  await expect(rows(page).first().locator('button')).toBeFocused();
  // 떠 있는 동안 뒤의 버튼은 눌리지 않는다
  await expect(page.locator('#quiz-start')).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dlg(page)).toBeHidden();
  await expect(page.locator('#toon-open')).toBeFocused();
});

test('뒤로 가기: 지면 → 목록 → 닫기, 다시 뒤로 가면 이전 화면',async({page})=>{
  await open(page,{hash:'workshop'});
  await page.locator('a[data-nav="research"]').click();
  await expect(page.locator('#toon-open')).toBeVisible();
  await openSheet(page);
  await rows(page).first().locator('button').click();
  await expect(dlg(page).locator('#toon-view-title')).toBeVisible();
  await page.goBack();
  await expect(dlg(page).locator('#toon-list-title')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#research');
  await page.goBack();
  await expect(dlg(page)).toBeHidden();
  expect(new URL(page.url()).hash).toBe('#research');
  await expect(page.locator('#toon-open')).toBeFocused();
  await page.goBack();
  await expect(page.locator('main h1')).toHaveText(/공방|스틸|코일|출하/);
});

test('연재 안내 글에 이전 게임 이름이 없고, 글은 요소로만 그려진다',async({page})=>{
  await open(page);
  await openSheet(page);
  await rows(page).first().locator('button').click();
  const lead=dlg(page).locator('.toon-lead');
  await expect(lead).toContainText('스틸 컴패니언');
  await expect(dlg(page)).not.toContainText('가챠');
  expect(await dlg(page).locator('.toon-sheet').evaluate(n=>n.querySelectorAll('script,style,iframe').length)).toBe(0);
  await expect(dlg(page).locator('.toon-cap')).toHaveCount(5);
  // 그림 자리는 w·h 비율로 먼저 잡힌다
  const first=dlg(page).locator('.toon-frame').nth(1);
  const ratio=await first.evaluate(n=>n.style.aspectRatio);
  expect(ratio).toBe('1200 / 800');
});

test('큰 그림은 늦게 불러온다(2화 여덟 쪽을 처음부터 모두 요청하지 않는다)',async({page})=>{
  const requested=new Set();
  page.on('request',r=>{const m=r.url().match(/webtoon\/(ep02-\d)\.webp/);if(m)requested.add(m[1]);});
  await open(page,{toon:'ep01'});
  await openSheet(page);
  await rows(page).nth(2).locator('button').click();
  await expect(dlg(page).locator('#toon-view-title')).toHaveText('2화 · 톤당');
  await expect.poll(()=>requested.size).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(requested.size).toBeLessThan(8);
  const loading=await dlg(page).locator('.toon-frame img').evaluateAll(list=>list.map(i=>i.loading));
  expect(loading[0]).toBe('eager'); expect(loading.slice(1).every(v=>v==='lazy')).toBe(true);
  // 끝까지 내리면 나머지도 불러온다
  for(let i=0;i<40;i++){await dlg(page).evaluate(n=>{n.scrollTop+=350;});await page.waitForTimeout(60);}
  await expect.poll(()=>requested.size,{timeout:15000}).toBe(8);
});

for(const [w,h] of [[390,700],[1280,800]]){
  test(`${w}px: 가로 넘침 없음·조작 영역 44px·창이 화면 안`,async({page})=>{
    await page.setViewportSize({width:w,height:h});
    await open(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth)).toBe(true);
    expect((await page.locator('#toon-open').boundingBox()).height).toBeGreaterThanOrEqual(44);
    await openSheet(page);
    for(const b of await dlg(page).locator('button').all()){const box=await b.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);}
    let box=await dlg(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(w);expect(box.y+box.height).toBeLessThanOrEqual(h);
    await rows(page).nth(1).locator('button').click();
    await imagesReady(page);
    for(const b of await dlg(page).locator('button:visible').all()){const bb=await b.boundingBox();expect(bb.height).toBeGreaterThanOrEqual(44);}
    box=await dlg(page).boundingBox();
    expect(box.x+box.width).toBeLessThanOrEqual(w);expect(box.y+box.height).toBeLessThanOrEqual(h);
    expect(await dlg(page).evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
  });
}

for(const [w,h] of [[390,700],[390,844],[320,640]]){
  test(`${w}×${h}: 공방의 코일 출하 버튼이 첫 화면(독 위)에 남는다`,async({page})=>{
    await page.setViewportSize({width:w,height:h});
    await open(page,{hash:'workshop'});
    const ship=await page.locator('.lobby-ship').boundingBox(), dock=await page.locator('nav').boundingBox();
    expect(ship.y+ship.height).toBeLessThanOrEqual(Math.min(dock.y,h));
  });
}

test('연구 탭 라벨의 NEW 점은 공방 첫 화면에 요소를 더하지 않는다',async({page})=>{
  await open(page,{hash:'workshop'});
  await expect(page.locator('a[data-nav="research"]')).toHaveAttribute('data-new','true');
  await expect(page.locator('main #toon-note, main .toon-note')).toHaveCount(0);
});
