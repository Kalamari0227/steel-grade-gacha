import {test,expect} from '@playwright/test';

// 출하 연출 효과음(2026-11-20 승인 파일 11개)과 제작 음악 2개(2026-11-21 부품 완성 craft·차량 등록 car). 소리를 켜면 파일을 받아 버퍼로 재생하고, 받지 못하면 원래 합성음(오실레이터)을 낸다.
// 들리는지는 시험할 수 없어, Web Audio 호출 수로 어느 길을 탔는지 본다.
// 2026-11-21: 제작 음악 2개를 더해 소리를 켤 때 받는 파일이 13개(+레어 음악)가 됐다. 받는 목록 기대값에 두 이름을 더했다.
const NAMES=['thud','theme','ring','crack','upgrade','burst','chime-steel','chime-silver','chime-gold','chime-holo','chime-rare','craft','car'];
async function open(page){
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    window.__audio={buffers:0,oscillators:0};
    const B=AudioContext.prototype.createBufferSource,O=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createBufferSource=function(){window.__audio.buffers++;return B.call(this);};
    AudioContext.prototype.createOscillator=function(){window.__audio.oscillators++;return O.call(this);};
  });
  await page.goto('/#ship');
  await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
}
// 연출은 [봉인 열기] → (덜컹·깨짐·터짐·종) → [결과 보기]로 넘어간다(prototype.spec의 같은 흐름).
async function reveal(page){
  await page.getByRole('button',{name:'봉인 열기'}).click();
  const toResults=page.getByRole('button',{name:'결과 보기'});
  await expect(toResults).toBeVisible({timeout:15000});
  await toResults.click();
  await expect(page.getByRole('heading',{name:'출하 결과',exact:true})).toBeVisible();
}
async function shipWithSound(page){
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('소리 켜짐');
  await page.waitForTimeout(800);
  await page.getByRole('button',{name:/1회 출하/}).click();
  await reveal(page);
  return page.evaluate(()=>window.__audio);
}

test('소리를 켜면 승인된 효과음 파일 13개를 받아 연출에 쓴다',async({page})=>{
  const got=new Set();
  page.on('response',r=>{const m=/\/audio\/sfx\.([a-z-]+)\.mp3$/.exec(new URL(r.url()).pathname);if(m&&r.ok())got.add(m[1]);});
  await open(page);
  const audio=await shipWithSound(page);
  // 레어 음악(sfx.rare-theme)도 소리를 켤 때 미리 받는다(예전 rare-tuning처럼).
  expect([...got].sort()).toEqual([...NAMES,'rare-theme'].sort());
  expect(audio.buffers).toBeGreaterThan(0);
});

test('효과음 파일을 받지 못하면 원래 합성음으로 연출을 마친다',async({page})=>{
  const warnings=[];page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/audio/sfx.*.mp3',route=>route.abort());
  await open(page);
  const audio=await shipWithSound(page);
  expect(audio.oscillators).toBeGreaterThan(0);
  expect(warnings.some(w=>w.includes('합성음을 냅니다'))).toBe(true);
  expect(errors).toEqual([]);
});

test('소리를 끄면 효과음 파일을 받지 않는다',async({page})=>{
  const asked=[];page.on('request',r=>{if(/\/audio\/sfx\./.test(r.url()))asked.push(r.url());});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/#ship');
  await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
  await page.getByRole('button',{name:/1회 출하/}).click();
  await reveal(page);
  expect(asked).toEqual([]);
});

// 특수 봉인(레어) 연출: 레어 음악(2026-11-21 sfx.rare-theme, 6.7초) 위에 잠금 쿵(thud)·금속 울림(ring), 카드 등장 때 터짐(burst), 이어 레어 종(chime-rare)이 겹친다.
// 레어를 뽑는 운은 시험이 정할 수 없어, 같은 모듈의 reveal()에 레어 카드 결과를 직접 넘긴다. 어떤 파일이 울렸는지는 버퍼 길이로 가린다.
test('특수 봉인 연출에도 효과음 파일(잠금·터짐·레어 종)이 겹친다',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    window.__played=[];
    const S=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer)window.__played.push(Math.round(this.buffer.duration*100)/100);return S.apply(this,a);};
  });
  await page.goto('/#ship');
  await expect(page.getByRole('heading',{name:'코일 출하소'})).toBeVisible();
  await page.locator('#sound').click();
  await page.evaluate(async()=>{
    const {createSound,reveal}=await import('./reveal.mjs');
    const data=await (await fetch('./data.json')).json();
    const sound=createSound(); sound.toggle();
    await new Promise(r=>setTimeout(r,1200));
    const host=document.createElement('div'); document.body.replaceChildren(host);
    reveal(host,data,{cards:[{id:data.cards.find(c=>c.rare).id,isNew:true}]},()=>{},sound);
  });
  await page.getByRole('button',{name:'봉인 열기'}).click();
  await expect(page.locator('.signal-call')).toContainText('특수 봉인');
  await expect(page.locator('.cutin')).toBeVisible({timeout:10000});
  await page.waitForTimeout(1800);
  const played=await page.evaluate(()=>window.__played);
  // 디코더에 따라 길이가 수십 ms 달라진다(예: burst 1.51 → 1.54).
  for(const length of [0.94,0.44,1.51,2.52,6.7]) expect(played.some(p=>Math.abs(p-length)<0.05),length+' in '+JSON.stringify(played)).toBe(true);
});

// 부품 완성·차량 등록 음악(2026-11-21): 성공한 순간 한 번 울린다. 버퍼 길이로 어느 파일인지 가린다(craft 2.25초, car 4.7초).
const SAVE_KEY='sgg_game_save_v1';
async function withSound(page,state,hash){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({key,raw})=>{
    window.__played=[];
    const S=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer)window.__played.push(Math.round(this.buffer.duration*100)/100);return S.apply(this,a);};
    if(sessionStorage.getItem('sfx-seeded'))return;sessionStorage.setItem('sfx-seeded','1');localStorage.setItem(key,raw);
  },{key:SAVE_KEY,raw:JSON.stringify(state)});
  await page.goto('/#'+hash);
  await expect(page.locator('main h1')).toBeVisible();
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('소리 켜짐');
  await page.waitForTimeout(1200);
}
const heard=(page,length)=>expect.poll(async()=>(await page.evaluate(()=>window.__played)).some(p=>Math.abs(p-length)<0.05),{timeout:3000}).toBe(true);

test('부품을 만들면 부품 완성 음악이 울린다',async({page})=>{
  const {createEngine}=await import('../src/engine.mjs');
  const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
  await withSound(page,{...fresh,owned:{'ssial-270E':true},stock:{'ssial-270E':1}},'crafting');
  await page.locator('.ready-row').first().click();
  await page.getByRole('button',{name:'제작하기'}).click();
  await expect(page.locator('.part-result')).toContainText('완성!');
  await heard(page,2.25);
  expect((await page.evaluate(()=>window.__played)).some(p=>Math.abs(p-4.7)<0.05)).toBe(false);
});

test('차를 차고에 등록하면 차량 등록 음악이 울린다',async({page})=>{
  const {createEngine}=await import('../src/engine.mjs');
  const fresh=createEngine({storage:{getItem:()=>null,setItem(){}}}).state();
  const data=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../public/data.json',import.meta.url),'utf8'));
  const car=data.cars[0];
  await withSound(page,{...fresh,parts:Object.fromEntries(data.parts.map(p=>[p.key,{at:5,use:[]}]))},'garage');
  await page.locator(`.garage-option[data-k="${car.key}"]`).click();
  await page.getByRole('button',{name:car.tag+' · 조립 확정'}).click();
  await expect(page.locator('#car-status')).toContainText('차고에 등록했어요');
  await heard(page,4.7);
});
