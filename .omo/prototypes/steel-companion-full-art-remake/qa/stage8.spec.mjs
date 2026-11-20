import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// 8단계(설치·오프라인): 홈 화면 설치 줄과 안내 창, manifest, 서비스 워커(뼈대 + 본 그림만).
// 다른 시험은 서비스 워커를 막는다(playwright.config). 서비스 워커 시험만 여기서 연다. Playwright WebKit은 서비스 워커가 있을 때 page.reload가 실패해 page.goto로 다시 연다.
const here=path.dirname(fileURLToPath(import.meta.url));
const artwork=JSON.parse(fs.readFileSync(path.join(here,'../../../../current/artwork.json'),'utf8'));
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const KAKAO='Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 KAKAOTALK 10.6.5';
async function open(page,hash='workshop'){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const dlg=page=>page.locator('#install-dialog');

test.describe('설치 안내',()=>{
  test('공방 맨 아래 "홈 화면에 설치" 줄: 다른 탭에서는 보이지 않고, 방법 보기 → 기기 탭 → Esc로 닫으면 초점이 돌아온다',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await open(page);
    const row=page.locator('#install-row');
    await expect(row).toBeVisible();
    await expect(page.locator('#install-note')).toHaveText('홈 화면에서 앱처럼 열 수 있습니다.');
    const go=page.getByRole('button',{name:'홈 화면 설치 방법 보기'});
    await expect(go).toHaveText('방법 보기');
    const ship=await page.locator('main .lobby-ship').boundingBox();
    expect(ship.y+ship.height).toBeLessThanOrEqual(844);
    await go.click();
    await expect(dlg(page)).toBeVisible();
    await expect(dlg(page).locator('#install-close')).toBeFocused();
    await expect(dlg(page).locator('#install-title')).toHaveText('홈 화면에 설치하기');
    // 데스크톱 브라우저: 컴퓨터 탭이 먼저 펴진다
    await expect(dlg(page).locator('[data-t="pc"]')).toHaveAttribute('aria-pressed','true');
    await expect(dlg(page)).toContainText('주소창 오른쪽 끝의 설치 아이콘을 누릅니다.');
    await dlg(page).locator('[data-t="ios"]').click();
    await expect(dlg(page).locator('[data-t="ios"]')).toHaveAttribute('aria-pressed','true');
    await expect(dlg(page).locator('[data-t="ios"]')).toBeFocused();
    await expect(dlg(page)).toContainText('목록을 내려 홈 화면에 추가를 누릅니다.');
    await expect(dlg(page).locator('.install-tip')).toContainText('처음 보는 그림·소리·웹툰은 인터넷 연결이 필요할 수 있습니다.');
    await expect(dlg(page).locator('button.primary')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dlg(page)).toBeHidden();
    await expect(go).toBeFocused();
    await page.locator('a[data-nav="research"]').first().click();
    await expect(row).toBeHidden();
  });

  test('아이폰 사파리는 아이폰 탭이 먼저, 카카오톡 안에서는 브라우저로 옮기라는 안내가 먼저 나온다',async({browser})=>{
    const ios=await browser.newContext({userAgent:IPHONE,viewport:{width:390,height:844}});
    const a=await ios.newPage(); await open(a);
    await expect(a.locator('#install-note')).toHaveText('사파리 공유 버튼으로 홈 화면에 추가합니다.');
    await a.locator('#install-open').click();
    await expect(dlg(a).locator('[data-t="ios"]')).toHaveAttribute('aria-pressed','true');
    await expect(dlg(a)).toContainText('아이폰 · 아이패드 (사파리)');
    await ios.close();
    const kakao=await browser.newContext({userAgent:KAKAO,viewport:{width:390,height:844}});
    const b=await kakao.newPage(); await open(b);
    await expect(b.locator('#install-note')).toHaveText('카카오톡·팀즈 안에서는 설치가 되지 않습니다.');
    await b.locator('#install-open').click();
    await expect(dlg(b).locator('#install-title')).toHaveText('먼저 크롬·사파리로 열어 주세요');
    await expect(dlg(b).locator('.install-warn')).toContainText('지금 카카오톡·팀즈 같은 앱 안에서 열려 있습니다.');
    await expect(dlg(b).locator('[data-t="android"]')).toHaveAttribute('aria-pressed','true');
    await kakao.close();
  });

  test('설치 창을 지원하면 [설치]가 바로 설치를 묻고, 취소·설치 완료를 원본 문구로 알린다',async({page})=>{
    await open(page);
    await page.evaluate(()=>{
      window.__prompts=0;
      const e=new Event('beforeinstallprompt',{cancelable:true});
      e.prompt=()=>{window.__prompts++;return Promise.resolve();};
      e.userChoice=Promise.resolve({outcome:'dismissed'});
      window.dispatchEvent(e);
    });
    const go=page.locator('#install-open');
    await expect(go).toHaveText('설치');
    await expect(page.locator('#install-note')).toHaveText('설치를 누른 뒤 브라우저의 안내를 확인하세요.');
    await go.click();
    await expect(page.locator('#install-note')).toHaveText('설치를 취소했습니다. 웹으로 계속 이용할 수 있습니다.');
    expect(await page.evaluate(()=>window.__prompts)).toBe(1);
    await expect(go).toHaveText('방법 보기');
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
    await expect(page.locator('#install-row')).toBeHidden();
    expect(await page.evaluate(()=>localStorage.getItem('sgg_game_installed'))).toBe('1');
    await page.goto('/#workshop');
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('#install-row')).toBeHidden();
  });

  test('이미 설치된 앱으로 열면 설치 줄이 없다',async({page})=>{
    await page.addInitScript(()=>{const m=window.matchMedia.bind(window);window.matchMedia=q=>q.includes('display-mode: standalone')?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:m(q);});
    await open(page);
    await expect(page.locator('#archive-row')).toBeVisible();
    await expect(page.locator('#install-row')).toBeHidden();
  });
});

test.describe('manifest·서비스 워커',()=>{
  test.use({serviceWorkers:'allow'});

  test('manifest는 이름 "스틸 컴패니언"과 승인 아이콘만 쓰고, 화면에 "체험판" 표기가 없다',async({page,request})=>{
    await open(page);
    const href=await page.locator('link[rel="manifest"]').getAttribute('href');
    const m=await (await request.get(href)).json();
    expect(m.name).toBe('스틸 컴패니언'); expect(m.short_name).toBe('스틸 컴패니언');
    expect(m.display).toBe('standalone'); expect(m.start_url).toBe('./'); expect(m.scope).toBe('./');
    const icons=new Map();
    const walk=o=>{if(Array.isArray(o))o.forEach(walk);else if(o&&typeof o==='object'){if(/^icon:(180|192|512)$/.test(o.id||'')&&o.status==='approved')icons.set(o.id,o.sha256);Object.values(o).forEach(walk);}};
    walk(artwork);
    expect(icons.size).toBe(3);
    for(const icon of m.icons){
      const body=await (await request.get(icon.src)).body();
      const sum=crypto.createHash('sha256').update(body).digest('hex');
      expect([...icons.values()]).toContain(sum);
      expect(icon.src).toBe('art/'+sum+'.png');
    }
    const touch=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(touch).toBe('./art/'+icons.get('icon:180')+'.png');
    await expect(page).toHaveTitle('공방 · 스틸 컴패니언');
    await expect(page.locator('body')).not.toContainText('체험판');
  });

  test('뼈대를 미리 받고, 본 그림만 저장해 오프라인에서도 공방을 연다. 이전 게임 캐시는 건드리지 않는다',async({page,context,browserName})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/#workshop');
    // 같은 출처의 이전 게임 캐시를 미리 만들어 둔다
    await page.evaluate(async()=>{await (await caches.open('sgg-game-cache-'+'a'.repeat(64))).put('/old-game-probe',new Response('old'));});
    await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,null,{timeout:20000});
    await page.goto('/?again=1#workshop');
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const keys=await page.evaluate(()=>caches.keys());
    expect(keys.filter(k=>k.startsWith('steel-companion-shell-'))).toHaveLength(1);
    expect(keys).toContain('sgg-game-cache-'+'a'.repeat(64));
    const shell=await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('steel-companion-shell-'));const c=await caches.open(name);return (await c.keys()).map(r=>new URL(r.url).pathname);});
    for(const file of ['/index.html','/app.mjs','/engine.mjs','/data.json','/prototype.css','/manifest.json','/quiz.mjs']) expect(shell).toContain(file);
    expect(shell.some(p=>p.startsWith('/art/')&&!/\.png$/.test(p))).toBe(false);
    await expect.poll(()=>page.evaluate(async()=>(await (await caches.open('steel-companion-art-v1')).keys()).length)).toBeGreaterThan(0);
    const seen=await page.evaluate(async()=>(await (await caches.open('steel-companion-art-v1')).keys()).map(r=>new URL(r.url).pathname));
    expect(seen.every(p=>/^\/art\/[a-f0-9]{64}\.(webp|png|jpg)$/.test(p))).toBe(true);
    // 오프라인 열기: Playwright WebKit은 setOffline과 서비스 워커를 함께 쓰면 탐색이 내부 오류로 끊겨(도구 한계) Chromium에서만 본다.
    if(browserName==='chromium'){
      await context.setOffline(true);
      await page.goto('/?offline=1#workshop');
      await expect(page.locator('main h1')).toHaveText('공방');
      await expect(page.locator('#install-row')).toBeVisible();
      await context.setOffline(false);
    }
    expect(await page.evaluate(async()=>(await (await caches.open('sgg-game-cache-'+'a'.repeat(64))).match('/old-game-probe'))?.text())).toBe('old');
  });

  // ── 최종 통합 검토(2026-11-20) 지적 반영 ──
  async function controlled(page){
    await page.goto('/#workshop');
    await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,null,{timeout:20000});
    await page.goto('/?c=1#workshop');
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  }
  test('검토: 게임 시작 주소가 아닌 같은 범위의 페이지는 서비스 워커가 가로채지 않는다(phs-preview 등)',async({page})=>{
    await controlled(page);
    await page.goto('/dev/seed.html');
    await expect(page.locator('main h1')).not.toHaveText('공방');
    await expect(page).not.toHaveTitle(/스틸 컴패니언$/);
  });

  test('검토: 뼈대 파일 하나라도 SHA가 틀리면 서비스 워커를 설치하지 않는다',async({page,context,browserName})=>{
    test.skip(browserName!=='chromium','서비스 워커의 요청 가로채기는 Playwright Chromium만 지원');
    await context.route('**/legacy.mjs',async route=>{
      if(!route.request().serviceWorker()) return route.continue();
      const r=await route.fetch();route.fulfill({response:r,body:(await r.text())+'\n// tampered'});
    });
    await page.goto('/#workshop');
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForTimeout(3000);
    expect(await page.evaluate(async()=>(await caches.keys()).filter(k=>k.startsWith('steel-companion-shell-')))).toEqual([]);
    expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.active)).toBe(false);
  });

  test('검토: 새 버전은 [새 버전 적용]을 눌러야 바뀌고, 바뀔 때 데이터가 가리키지 않는 옛 그림을 지운다',async({page,browserName})=>{
    test.skip(browserName!=='chromium','Playwright WebKit은 서비스 워커가 있으면 새로고침이 내부 오류로 끊긴다');
    await controlled(page);
    const stale='/art/'+'0'.repeat(64)+'.webp';
    await page.evaluate(async stale=>{await (await caches.open('steel-companion-art-v1')).put(stale,new Response('old'));},stale);
    // 서비스 워커 스크립트 갱신 요청은 Playwright가 가로채지 못해, 검토 서버가 내주는 public/sw.mjs 끝에 한 줄을 잠시 붙였다가 반드시 되돌린다.
    const file=path.join(here,'../public/sw.mjs'),original=fs.readFileSync(file);
    try{
      fs.writeFileSync(file,Buffer.concat([original,Buffer.from('\n// next build (stage8 test)\n')]));
      await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
      const note=page.locator('#update');
      await expect(note).toBeVisible({timeout:20000});
      await expect(note).toContainText('새 버전이 준비되었습니다. 원할 때 적용해 주세요.');
      expect(await page.evaluate(async stale=>!!(await (await caches.open('steel-companion-art-v1')).match(stale)),stale)).toBe(true);
      await Promise.all([page.waitForEvent('load'),note.getByRole('button',{name:'새 버전 적용'}).click()]);
      await expect(page.locator('main h1')).toBeVisible();
      await expect.poll(()=>page.evaluate(async stale=>!!(await (await caches.open('steel-companion-art-v1')).match(stale)),stale)).toBe(false);
      await expect(page.locator('#update')).toBeHidden();
    }finally{fs.writeFileSync(file,original);}
  });
});

test('검토: 640×450(200% 확대에 해당)에서 설치 줄과 안내 창이 넘치지 않는다',async({page})=>{
  await page.setViewportSize({width:640,height:450});
  await open(page);
  await page.locator('#install-open').scrollIntoViewIfNeeded();
  await expect(page.locator('#install-row')).toBeVisible();
  await page.locator('#install-open').click();
  await expect(dlg(page)).toBeVisible();
  const box=await dlg(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(640);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThanOrEqual(450);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#install-close').click();
  await expect(dlg(page)).toBeHidden();
});

