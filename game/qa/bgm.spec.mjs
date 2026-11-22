import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

// 탭별 배경음악(2026-11-22 사용자 결정: 시안 docs/design/game-bgm-2026-11-22-u0, A안·겹쳐 바꾸기).
// 들리는지는 시험할 수 없어 Web Audio 호출(버퍼 길이·반복 구간·멈춤 예약)과 받는 파일로 어느 곡이 어떻게 도는지 본다.
// 음악 문맥은 소리 창에서 배경음악을 먼저 켜 첫 AudioContext로 만들고, 그 문맥의 출력 바로 앞 GainNode(줄임용)를 지켜본다.
const data=JSON.parse(await fs.readFile(new URL('../public/data.json',import.meta.url),'utf8'));
const TRACK_SECONDS=Object.fromEntries(Object.entries(data.bgm).map(([k,v])=>[k,v.loopEnd+1]));
async function open(page,hash='workshop'){
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    window.__ctx=[];window.__dest=[];window.__starts=[];window.__stops=[];
    const AC=window.AudioContext;
    window.AudioContext=class extends AC{constructor(...a){super(...a);window.__ctx.push(this);}};
    const C=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(target,...rest){if(target instanceof AudioDestinationNode)window.__dest.push(this);return C.call(this,target,...rest);};
    const S=AudioBufferSourceNode.prototype.start,T=AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.loop&&this.context===window.__ctx[0])window.__starts.push({seconds:Math.round(this.buffer.duration*10)/10,loopStart:this.loopStart,loopEnd:this.loopEnd,offset:a[1]});return S.apply(this,a);};
    AudioBufferSourceNode.prototype.stop=function(...a){if(this.buffer&&this.loop&&this.context===window.__ctx[0])window.__stops.push(Math.round(this.buffer.duration*10)/10);return T.apply(this,a);};
    window.__duck=()=>{const ctx=window.__ctx[0];const node=window.__dest.find(n=>n.context===ctx&&n instanceof GainNode);return node?Math.round(node.gain.value*100)/100:null;};
  });
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
}
const started=page=>page.evaluate(()=>window.__starts);
const near=(a,b)=>Math.abs(a-b)<0.15;
async function music(page){
  await page.locator('#sound').click();
  await page.locator('#music-toggle').click();
  await expect(page.locator('#music-toggle')).toHaveAttribute('aria-checked','true');
}

test('소리 창: 소리 버튼이 효과음·배경음악 스위치 창을 열고 Esc로 닫힌다. 켜기 전에는 배경음악 파일을 받지 않는다',async({page})=>{
  const asked=[];page.on('request',r=>{if(/\/bgm\//.test(r.url()))asked.push(r.url());});
  await open(page);
  const button=page.locator('#sound'),panel=page.locator('#sound-panel');
  await expect(button).toHaveText('소리 꺼짐');
  await expect(button).toHaveAttribute('aria-expanded','false');
  await expect(panel).toBeHidden();
  await button.click();
  await expect(panel).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('switch',{name:/효과음/})).toHaveAttribute('aria-checked','false');
  await expect(page.getByRole('switch',{name:/배경음악/})).toHaveAttribute('aria-checked','false');
  await expect(page.locator('#sfx-toggle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
  // 바깥을 누르면 닫힌다.
  await button.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(8,500);
  await expect(panel).toBeHidden();
  // 화면이 바뀌어도 닫힌다.
  await button.click();
  await expect(panel).toBeVisible();
  await page.evaluate(()=>{location.hash='#garage';});
  await expect(panel).toBeHidden();
  for(const view of ['crafting','garage','collection','research','workshop']){await page.evaluate(v=>{location.hash='#'+v;},view);await expect(page.locator('main h1')).toBeVisible();}
  expect(asked).toEqual([]);
});

test('배경음악: 켜면 탭의 곡을 반복 구간으로 틀고, 탭을 바꾸면 겹쳐 바꾸며, 공방·출하는 같은 곡을 잇고, 끄면 멈춘다',async({page})=>{
  const got=[];page.on('response',r=>{const m=/\/bgm\/([a-z]+)\.mp3$/.exec(new URL(r.url()).pathname);if(m&&r.ok())got.push(m[1]);});
  await open(page);
  await music(page);
  await expect(page.locator('#sound')).toHaveText('소리 켜짐');
  await expect(page.locator('#sfx-toggle')).toHaveAttribute('aria-checked','false');
  await expect.poll(()=>started(page).then(s=>s.length),{timeout:15000}).toBe(1);
  const [first]=await started(page);
  expect(near(first.seconds,TRACK_SECONDS.workshop)).toBe(true);
  expect(first.loopStart).toBe(1);expect(first.offset).toBe(1);
  expect(Math.abs(first.loopEnd-data.bgm.workshop.loopEnd)).toBeLessThan(0.001);
  await page.evaluate(()=>{location.hash='#crafting';});
  await expect.poll(()=>started(page).then(s=>s.length),{timeout:15000}).toBe(2);
  expect(near((await started(page))[1].seconds,TRACK_SECONDS.crafting)).toBe(true);
  // 앞 곡은 겹침(0.8초) 뒤 멈추도록 예약된다.
  await expect.poll(()=>page.evaluate(()=>window.__stops)).toContainEqual(Math.round(TRACK_SECONDS.workshop*10)/10);
  // 출하 화면은 공방 곡, 같은 곡끼리(공방 → 출하)는 새로 시작하지 않는다.
  await page.evaluate(()=>{location.hash='#ship';});
  await expect.poll(()=>started(page).then(s=>s.length),{timeout:15000}).toBe(3);
  await page.evaluate(()=>{location.hash='#workshop';});
  await expect(page.locator('main h1')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await started(page)).length).toBe(3);
  expect(got.sort()).toEqual(['crafting','workshop']);
  await page.locator('#sound').click();
  await page.locator('#music-toggle').click();
  await expect(page.locator('#music-toggle')).toHaveAttribute('aria-checked','false');
  await expect(page.locator('#sound')).toHaveText('소리 꺼짐');
  // 멈춤 예약: 공방(→제작), 제작(→출하), 공방(끄기).
  await expect.poll(()=>page.evaluate(()=>window.__stops.length)).toBe(3);
});

test('A안: 효과음이 켜져 출하 음악이 울리는 동안 배경음악을 줄여 끄고, 결과 화면으로 넘어가면 되돌린다',async({page})=>{
  await open(page,'ship');
  await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
  await music(page);
  await page.locator('#sfx-toggle').click();
  await expect(page.locator('#sfx-toggle')).toHaveAttribute('aria-checked','true');
  await expect.poll(()=>started(page).then(s=>s.length),{timeout:15000}).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__duck())).toBe(1);
  await page.getByRole('button',{name:/1회 출하/}).click();
  await page.getByRole('button',{name:'봉인 열기'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__duck()),{timeout:3000}).toBe(0);
  const toResults=page.getByRole('button',{name:'결과 보기'});
  await expect(toResults).toBeVisible({timeout:15000});
  expect(await page.evaluate(()=>window.__duck())).toBe(0);
  await toResults.click();
  await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__duck()),{timeout:4000}).toBe(1);
});

test('효과음이 꺼져 있으면 출하 연출 중에도 배경음악을 줄이지 않는다. 화면이 숨으면 멈췄다가 돌아오면 잇는다',async({page})=>{
  await open(page,'ship');
  await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
  await music(page);
  await expect.poll(()=>started(page).then(s=>s.length),{timeout:15000}).toBe(1);
  await page.getByRole('button',{name:/1회 출하/}).click();
  await page.getByRole('button',{name:'봉인 열기'}).click();
  await page.waitForTimeout(800);
  expect(await page.evaluate(()=>window.__duck())).toBe(1);
  const hide=hidden=>page.evaluate(h=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});document.dispatchEvent(new Event('visibilitychange'));},hidden);
  await hide(true);
  await expect.poll(()=>page.evaluate(()=>window.__ctx[0].state)).toBe('suspended');
  await hide(false);
  await expect.poll(()=>page.evaluate(()=>window.__ctx[0].state)).toBe('running');
});
