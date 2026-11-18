import {test,expect} from '@playwright/test';
import {createEngine} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';

// 5단계(공지·기간 행사·출하 알림·토스트): 브라우저에서 본 동작. 규칙의 원본 대조와 엔진 보호는 qa/stage5.test.mjs가 맡는다.
// 시각은 page.clock으로 주입한다(원본 행사는 모두 끝났다). 알림은 권한별 가짜 Notification으로 바꿔 소리 없이 호출만 센다.
const key='sgg_game_save_v1', DAY=86400000;
const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
const rules=createLegacy(), CHARS=rules.allChars();
const ALL=Object.fromEntries(CHARS.map(c=>[c.id,true])), STOCK=Object.fromEntries(CHARS.map(c=>[c.id,2]));
const base=(extra={})=>({...fresh,...extra});
const AT_PROMO=new Date('2026-10-22T12:00:00+09:00'), AT_SOON=new Date('2026-10-21T20:00:00+09:00'), AT_END=new Date('2026-10-26T00:00:30+09:00'), AT_NOW=new Date('2026-11-18T12:00:00+09:00');
async function seedOnce(page,state){
  await page.addInitScript(({key,raw})=>{if(sessionStorage.getItem('stage5-seeded'))return;sessionStorage.setItem('stage5-seeded','1');localStorage.setItem(key,raw);},{key,raw:JSON.stringify(state)});
}
// permission: 'granted'|'denied'|'default'(누르면 answer로 답함)|'none'(미지원). window.__notes에 보낸 알림이, __asked에 권한 요청 횟수가 쌓인다.
async function fakeNotification(page,{permission='granted',answer='granted'}={}){
  await page.addInitScript(({permission,answer})=>{
    window.__notes=[];window.__asked=0;
    if(permission==='none'){delete window.Notification;return;}
    class N{constructor(title,opt){window.__notes.push([title,opt&&opt.body]);}
      static permission=permission;
      static requestPermission(cb){window.__asked++;N.permission=answer;if(cb)cb(answer);return Promise.resolve(answer);}}
    window.Notification=N;
  },{permission,answer});
}
async function open(page,{state=null,at=null,motion='reduce',hash='workshop',notification={}}={}){
  await page.emulateMedia({reducedMotion:motion});
  if(at) await page.clock.install({time:at});
  if(notification) await fakeNotification(page,notification);
  if(state) await seedOnce(page,state);
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const saved=async page=>JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key));
const dlg=page=>page.locator('#ops-dialog');
const band=page=>page.locator('.ops-band');
const toast=page=>page.locator('#toast');

test('a new notice opens once by itself, saves nothing until confirmed, then never shows again',async({page})=>{
  await open(page,{state:base(),at:AT_PROMO});
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page).getByRole('heading',{name:'품질 교육 주간',level:2})).toBeFocused();
  expect(await saved(page)).toMatchObject({noticeSeen:'',promoSeen:''});          // 열린 것만으로는 저장하지 않는다
  await dlg(page).getByRole('button',{name:'확인'}).click();
  await expect(dlg(page)).toBeHidden();
  await expect.poll(async()=>(await saved(page)).noticeSeen).toBe('2026-10-22');
  expect((await saved(page)).promoSeen).toBe('2026-10-22');                         // 공지 확인이 행사 확인을 함께 처리한다
  await page.reload(); await expect(page.locator('main h1')).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(dlg(page)).toBeHidden();
});

test('closing without confirming (Esc) also records, and reloading before any close shows it again',async({page})=>{
  await open(page,{state:base(),at:AT_PROMO});
  await expect(dlg(page)).toBeVisible();
  await page.reload(); await expect(dlg(page)).toBeVisible();                       // 아직 닫지 않았으니 다시 뜬다
  await page.keyboard.press('Escape');
  await expect(dlg(page)).toBeHidden();
  await expect.poll(async()=>(await saved(page)).noticeSeen).toBe('2026-10-22');
});

test('promo phases: soon → on → end toast once → no event now, with the same limit everywhere',async({page})=>{
  await open(page,{state:base({noticeSeen:'2026-10-22',promoSeen:'2026-10-22'}),at:AT_SOON});
  await expect(band(page)).toContainText('품질 교육 주간 예고');
  await expect(band(page)).toContainText('10월 22일 00:00 시작');
  await page.clock.fastForward(5*3600*1000);                                        // 10/22 01:00 KST: 진행 중
  await expect(band(page)).toContainText('품질 교육 주간');                          // 공지와 행사가 함께 걸리면 띠는 하나(공지 제목)이고 행사 내용이 실린다
  await expect(band(page)).toContainText('남은 시간');
  await expect(band(page)).toContainText('철강 퀴즈 하루 5회');
  await page.getByRole('link',{name:/연구/}).click();
  await expect(page.locator('.quiz-note')).toContainText('5');                       // 연구 탭의 한도가 행사 한도와 같은 숫자
  await page.getByRole('link',{name:/공방/}).click();
  await page.clock.fastForward(4*DAY);                                              // 10/26 00:00 이후
  await expect(band(page)).toContainText('진행 중인 행사가 없습니다');
  await expect(toast(page)).toBeVisible();
  await expect(toast(page)).toContainText('한정 기간이 끝났습니다');
  await expect(toast(page)).toContainText('퀴즈 3회');
  expect((await saved(page)).promoDone).toBe('2026-10-22');
  await toast(page).getByRole('button',{name:'알림 닫기'}).click();
  await expect(toast(page)).toBeHidden();
  await page.clock.fastForward(30000);
  await expect(toast(page)).toBeHidden();                                           // 종료 안내는 한 번뿐
});

test('the real present has no event: the quiet band is shown and nothing opens by itself',async({page})=>{
  await open(page,{state:base(),at:AT_NOW});
  await expect(band(page)).toContainText('진행 중인 행사가 없습니다');
  await page.waitForTimeout(2500);
  await expect(dlg(page)).toBeHidden(); await expect(toast(page)).toBeHidden();
  await band(page).getByRole('button',{name:'지난 공지'}).click();
  await expect(dlg(page)).toBeVisible(); await expect(dlg(page)).toContainText('지난 공지');
  await page.keyboard.press('Escape');
  expect(await saved(page)).toMatchObject({noticeSeen:'',promoSeen:''});            // 지난 공지는 보기만 한다
});

test('bell: permission is asked only after the button, granted turns it on, denied and unsupported never look on',async({page,context})=>{
  await open(page,{state:base({noticeSeen:'2026-10-22'}),at:AT_NOW,notification:{permission:'default',answer:'granted'}});
  expect(await page.evaluate(()=>window.__asked)).toBe(0);
  await page.getByRole('button',{name:'출하 알림 켜기'}).click();
  await expect(page.locator('.ops-sw')).toHaveText('켜짐');
  expect(await page.evaluate(()=>window.__asked)).toBe(1);
  expect((await saved(page)).bell).toBe(true);
  await expect(toast(page)).toContainText('출하 알림을 켰습니다');
  await page.getByRole('button',{name:'출하 알림 끄기'}).click();
  await expect(page.locator('.ops-sw')).toHaveText('꺼짐'); expect((await saved(page)).bell).toBe(false);
  const denied=await context.newPage();
  await open(denied,{state:base({noticeSeen:'2026-10-22'}),at:AT_NOW,notification:{permission:'default',answer:'denied'}});
  await denied.getByRole('button',{name:'출하 알림 켜기'}).click();
  await expect(denied.locator('.ops-sw')).toHaveText('차단됨');
  await expect(denied.getByRole('button',{name:/출하 알림/})).toHaveCount(0);
  expect((await saved(denied)).bell).toBe(false);
  await expect(denied.locator('#ops-bell-note')).toContainText('막혀 있습니다');
  const none=await context.newPage();
  await open(none,{state:base({noticeSeen:'2026-10-22'}),at:AT_NOW,notification:{permission:'none'}});
  await expect(none.locator('.ops-sw')).toHaveText('없음');
  await expect(none.locator('#ops-bell-note')).toContainText('지원하지 않습니다');
  await expect(none.getByRole('button',{name:/출하 알림/})).toHaveCount(0);
});

test('the renewal toast and the system notification fire once per cycle; the toast closes',async({page})=>{
  const pullAt=AT_NOW.getTime()-DAY+20000;
  await open(page,{state:base({bell:true,belledAt:-1,pullAt,pullUsed:1,noticeSeen:'2026-10-22',promoSeen:'2026-10-22',promoDone:'2026-10-22'}),at:AT_NOW});
  await expect(toast(page)).toBeHidden();
  await page.clock.fastForward(30000);
  await expect(toast(page)).toBeVisible();
  await expect(toast(page)).toContainText('출하 시간이 됐습니다');
  expect(await page.evaluate(()=>window.__notes.length)).toBe(1);
  expect((await saved(page)).belledAt).toBe(pullAt);
  await toast(page).getByRole('button',{name:'알림 닫기'}).click();
  await expect(toast(page)).toBeHidden();
  await page.clock.fastForward(120000);
  await expect(toast(page)).toBeHidden();
  expect(await page.evaluate(()=>window.__notes.length)).toBe(1);
  await page.reload(); await expect(page.locator('main h1')).toBeVisible();          // 갱신 뒤에 새로 연 경우는 알리지 않는다
  await page.clock.fastForward(5000);
  await expect(toast(page)).toBeHidden();
});

test('toasts and auto notices wait while another upper window is open, then appear after it closes',async({page})=>{
  await open(page,{state:base({owned:ALL,stock:STOCK}),at:AT_PROMO,hash:'collection'});
  await expect(dlg(page)).toBeVisible();                                            // 처음엔 공지가 먼저 뜬다
  await page.keyboard.press('Escape'); await expect(dlg(page)).toBeHidden();
  const fresh2=await page.context().newPage();
  await open(fresh2,{state:base({owned:ALL,stock:STOCK,noticeSeen:'2026-10-22',promoSeen:'2026-10-22',bell:true,belledAt:-1,pullAt:AT_PROMO.getTime()-DAY+20000,pullUsed:1}),at:AT_PROMO,hash:'collection'});
  await fresh2.locator('.tile-open').first().click();
  await expect(fresh2.locator('#card-dialog')).toBeVisible();
  await fresh2.clock.fastForward(30000);
  await expect(fresh2.locator('#toast')).toBeHidden();                              // 카드 창 위에는 띄우지 않는다
  await fresh2.keyboard.press('Escape');
  await fresh2.clock.fastForward(2000);
  await expect(fresh2.locator('#toast')).toBeVisible();
});

test('keyboard: the band opens the notice, focus lands on the title, Esc returns focus to the band button',async({page})=>{
  await open(page,{state:base({noticeSeen:'2026-10-22',promoSeen:'2026-10-22'}),at:AT_PROMO});
  const go=band(page).getByRole('button',{name:'자세히 보기'});
  await go.focus(); await page.keyboard.press('Enter');
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page).getByRole('heading',{level:2}).first()).toBeFocused();
  // 뒤의 버튼은 눌리지 않는다(위층 창이라 inert).
  expect(await page.evaluate(()=>{const b=document.querySelector('.ops-bgo');return b?document.elementFromPoint(b.getBoundingClientRect().x+5,b.getBoundingClientRect().y+5)?.closest('#ops-dialog')!==null:true;})).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dlg(page)).toBeHidden();
  await expect(go).toBeFocused();
  expect((await saved(page)).noticeSeen).toBe('2026-10-22');
});

for(const [w,h] of [[390,700],[1280,800]]) test(`layout ${w}x${h}: no horizontal overflow, 44px targets, the opened box is inside the screen`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await open(page,{state:base(),at:AT_PROMO});
  await expect(dlg(page)).toBeVisible();
  const box=await dlg(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(w); expect(box.y+box.height).toBeLessThanOrEqual(h);
  for(const sel of ['#ops-dialog .close-button','#ops-ok']){const b=await page.locator(sel).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);}
  await page.locator('#ops-ok').scrollIntoViewIfNeeded(); await expect(page.locator('#ops-ok')).toBeInViewport();
  await page.locator('#ops-ok').click();
  await expect(dlg(page)).toBeHidden();
  for(const sel of ['.ops-go','.ops-bgo']){const b=await page.locator(sel).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth)).toBe(true);
  // 토스트도 화면 안, 44px 닫기.
  await page.clock.fastForward(1000);
  await page.getByRole('button',{name:'출하 알림 켜기'}).click();
  await expect(toast(page)).toBeVisible();
  const t=await toast(page).boundingBox();
  expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x+t.width).toBeLessThanOrEqual(w); expect(t.y+t.height).toBeLessThanOrEqual(h);
  const x=await toast(page).getByRole('button',{name:'알림 닫기'}).boundingBox(); expect(x.height).toBeGreaterThanOrEqual(44);
});

test('reduced motion removes the toast animation',async({page})=>{
  await open(page,{state:base({noticeSeen:'2026-10-22',promoSeen:'2026-10-22'}),at:AT_NOW,motion:'reduce'});
  await page.getByRole('button',{name:'출하 알림 켜기'}).click();
  await expect(toast(page)).toBeVisible();
  expect(await toast(page).evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('persistence: a stale tab cannot record the notice and keeps the other tab save; a failed write warns but keeps the screen',async({page,context})=>{
  await open(page,{state:base(),at:AT_PROMO});
  await expect(dlg(page)).toBeVisible();
  const other=await context.newPage(); await other.goto('/#workshop');
  await other.evaluate(([k,raw])=>localStorage.setItem(k,raw),[key,JSON.stringify(base({scrap:99}))]);
  await dlg(page).getByRole('button',{name:'확인'}).click();
  await expect(page.locator('#warning')).toContainText('다른 탭');
  expect((await saved(page)).scrap).toBe(99); expect((await saved(page)).noticeSeen).toBe('');
});

test('persistence: a corrupt save opens nothing and is not overwritten',async({page})=>{
  await page.addInitScript(k=>localStorage.setItem(k,'{bad'),key);
  await open(page,{at:AT_PROMO});
  await page.waitForTimeout(2500);
  await expect(dlg(page)).toBeHidden();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{bad');
});

test('persistence: a write failure still lets the notice be confirmed and warns',async({page})=>{
  await open(page,{state:base(),at:AT_PROMO});
  await expect(dlg(page)).toBeVisible();
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('quota');};});
  await dlg(page).getByRole('button',{name:'확인'}).click();
  await expect(dlg(page)).toBeHidden();
  await expect(page.locator('#warning')).toContainText('저장');
  await page.waitForTimeout(2500); await expect(dlg(page)).toBeHidden();             // 메모리 기록이 남아 같은 화면에서 다시 뜨지 않는다
});

test('an old save keeps its confirmed notice, promo and bell: nothing shows again and the bell state is kept',async({page})=>{
  await open(page,{state:base({noticeSeen:'2026-10-22',promoSeen:'2026-10-22',promoDone:'2026-10-22',bell:true,belledAt:1234}),at:AT_PROMO});
  await page.waitForTimeout(2500);
  await expect(dlg(page)).toBeHidden(); await expect(toast(page)).toBeHidden();
  await expect(page.locator('.ops-sw')).toHaveText('켜짐');
  expect(await saved(page)).toMatchObject({belledAt:1234,bell:true});
});
