import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,baselineURL} from './helpers/paths.mjs';
import {openApp,state,capture,settings,mirror} from './helpers/app.mjs';
import {storageEvidence} from './helpers/storage-evidence.mjs';
import {namespaceFor} from './game/namespaces.mjs';
storageEvidence(test);

async function isGame(page){const key=await page.evaluate(()=>KEY);expect(['sgg_game_save_v1','steelgrade_gacha_v1']).toContain(key);return key==='sgg_game_save_v1';}
async function diagnostics(page){
 if(await isGame(page)){
  await expect(page.locator('#bkDiag')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#bkDiag [data-storage-check]')).toHaveCount(2);
  const text=await page.locator('#bkDiag').innerText();expect(text).not.toMatch(/localStorage|IndexedDB|https?:|\/Users\//i);
  const expected=await page.evaluate(async()=>({probe:await new Promise(resolve=>storeDiag(resolve)),warning:!!(saveHold||loadFailed||storeWarn)}));
  await expect(page.locator('#bkDiag [data-storage-check=primary]')).toHaveAttribute('data-state',expected.warning?'unconfirmed':expected.probe.ls==='정상'?'available':'unavailable');
  await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state',expected.probe.idb==='정상'?'available':'unavailable');
  return page.locator('#bkDiag [data-storage-check]').evaluateAll(nodes=>nodes.map(n=>({label:n.dataset.storageCheck,value:n.dataset.state,text:n.textContent})));
 }
 await expect(page.locator('#bkDiag .d')).toHaveCount(4);
 return page.locator('#bkDiag .d').evaluateAll(nodes=>nodes.map(n=>({label:n.querySelector('i').textContent,value:n.querySelector('b').textContent})));
}
async function confirmPreview(page,expected){
 if(!await isGame(page))return;
 const before=expected||await state(page),raw=await page.evaluate(()=>localStorage.getItem(KEY)),output=await page.locator('#bkOut').inputValue();
 const education=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('steelgrade_gacha')||['sgg_toon_seen','sgg_installed','sgg_install_dismissed'].includes(k))));
 await expect(page.locator('#bkPreview')).toBeVisible();await expect(page.locator('#bkRecovery')).toHaveValue(output);
 expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(raw);
 await page.evaluate(()=>{window.__migrationApplyCount=0;window.__migrationApply=applyCode;applyCode=function(pack){window.__migrationApplyCount++;return window.__migrationApply(pack);};});
 try{await page.locator('#bkConfirm').click();expect(await page.evaluate(()=>window.__migrationApplyCount)).toBe(1);}
 finally{await page.evaluate(()=>{applyCode=window.__migrationApply;delete window.__migrationApply;});}
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('steelgrade_gacha')||['sgg_toon_seen','sgg_installed','sgg_install_dismissed'].includes(k))))).toEqual(education);
}

const fields=['v','o','i','s','x','p','q','u','pu','od','ok','on','pt','st','cr'].sort();
for(const width of [390,1280])test(`@storage-visual backup diagnostics and install ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:900});
  await openApp(page,appURL,'mid-progress');const before=await state(page);await backup(page);
  await diagnostics(page);
  const code=await page.locator('#bkOut').inputValue();
  for(const [name,selector] of [['backup','#bkOut'],['diagnostic','#bkDiag']]){
    await page.locator(selector).scrollIntoViewIfNeeded();
    const path=info.outputPath(`${name}-${width}.png`);await page.screenshot({path,animations:'disabled'});await info.attach(name,{path,contentType:'image/png'});
  }
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await settings(page);await page.locator('#btnInstall').click();
  await expect(page.locator('#installGo')).toBeFocused();await expect(page.locator('#installSteps')).toBeVisible();
  const path=info.outputPath(`install-${width}.png`);await page.screenshot({path,animations:'disabled'});await info.attach('install',{path,contentType:'image/png'});
  expect(await state(page)).toEqual(before);await capture(info,'visual-state',{width,before,after:await state(page),code});
});
async function backup(page){await settings(page);await page.locator('#btnBackup').click();await expect(page.locator('#backupModal')).toBeVisible();}
for(const fixture of ['mid-progress','qp-owned','equipped-items','all-cars']) test(`@storage-happy SGG1 exact subset ${fixture}`,async({page},info)=>{
  await openApp(page,baselineURL,fixture);await backup(page);
  const originalCode=await page.locator('#bkOut').inputValue();
  const originalPack=await page.evaluate(code=>readCode(code),originalCode);
  await page.locator('#bkIn').fill(originalCode);await page.locator('#bkLoad').click();
  const originalRestored=await page.evaluate(()=>readCode(makeCode()));
  await openApp(page,appURL,fixture);await backup(page);
  const code=await page.locator('#bkOut').inputValue();
  const before=await page.evaluate(code=>({pack:readCode(code),state:JSON.parse(JSON.stringify(S)),seen:localStorage.getItem(TOON_SEEN)}),code);
  expect(Object.keys(before.pack).sort()).toEqual(fields);
  expect(before.pack).toEqual(originalPack);
  await page.locator('#bkIn').fill(code);await page.locator('#bkLoad').click();
  await confirmPreview(page,before.state);
  await expect(page.locator('#bkRes')).toHaveClass('bkres ok');
  expect(await page.evaluate(()=>readCode(makeCode()))).toEqual(await isGame(page)?before.pack:originalRestored);
  for(const key of ['bell','promoSeen','promoDone','noticeSeen','qpSeen'])expect((await state(page))[key]).toEqual(before.state[key]);
  expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe(before.seen);
  await expect.poll(()=>mirror(page)).toEqual(await state(page));
  await capture(info,'restore',{fixture,originalPack,originalRestored,before,after:await state(page),code});
});

test('@storage-happy normal diagnostics reflect actual browser storage and address',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');const before=await state(page);await backup(page);
  await diagnostics(page);
  const expected=await page.evaluate(async()=>({diagnostic:await new Promise(resolve=>storeDiag(resolve)),where:location.origin+location.pathname,
    local:JSON.parse(localStorage.getItem(KEY)),mirror:await new Promise(resolve=>mirrorGet(raw=>resolve(JSON.parse(raw))))}));
  const rows=await diagnostics(page);
  expect(expected.diagnostic.ls).toBe('정상');expect(expected.diagnostic.idb).toBe('정상');
  if(await isGame(page)){
    await expect(page.locator('#bkDiag')).not.toContainText(expected.where);
    await expect(page.locator('#bkDiag [data-storage-check=primary]')).toHaveAttribute('data-state','available');
    await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state','available');
  }else{
    expect(rows.map(row=>row.value)).toEqual([expected.diagnostic.mode,'정상','정상',expected.diagnostic.persist]);
    await expect(page.locator('#bkDiag .addr')).toHaveText(expected.where);
  }
  expect(expected.local).toEqual(before);expect(expected.mirror).toEqual(before);expect(await state(page)).toEqual(before);
  await capture(info,'diagnostics',{rows,expected,before,after:await state(page)});
});

test('@storage-happy restore refreshes same-dialog code summary and immediate copy',async({page},info)=>{
  await openApp(page,baselineURL,'mid-progress');const incoming=await page.evaluate(()=>makeCode());
  await openApp(page,appURL,'crafting-ready');
  const initial=JSON.parse(await fs.readFile(new URL('./fixtures/crafting-ready.json',import.meta.url),'utf8'));
  await page.evaluate(saved=>{applySaved(saved.state);save();refresh();},initial);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText(value){window.copiedBackup=value;return Promise.resolve();}},configurable:true}));
  await backup(page);const original={code:await page.locator('#bkOut').inputValue(),summary:await page.locator('#bkSummary, #bkCopy + .hint').first().innerText(),state:await state(page)};
  await page.locator('#bkIn').fill('SGG1.invalid');await page.locator('#bkLoad').click();
  await expect(page.locator('#bkRes')).toHaveClass('bkres ng');await expect(page.locator('#bkOut')).toHaveValue(original.code);await expect(page.locator('#bkSummary, #bkCopy + .hint').first()).toHaveText(original.summary);expect(await state(page)).toEqual(original.state);
  const trigger=await isGame(page)?'#bkEducation':'#bkLoad';
  await page.locator('#bkIn').fill(incoming);await page.locator(trigger).focus();await page.keyboard.press('Enter');
  await confirmPreview(page,original.state);
  await expect(page.locator('#bkRes')).toHaveClass('bkres ok');await expect(page.locator(trigger)).toBeFocused();
  const current=await page.evaluate(()=>({code:makeCode(),pack:readCode(makeCode()),state:JSON.parse(JSON.stringify(S))}));
  expect(current.code).not.toBe(original.code);await expect(page.locator('#bkOut')).toHaveValue(current.code);
  await expect(page.locator('#bkSummary, #bkCopy + .hint').first()).toHaveText(`캐릭터 ${Object.keys(current.state.owned).length}장 · 아이템 ${Object.keys(current.state.items).length}종 · 스크랩 ${current.state.scrap}장이 담겨 있습니다.`);
  await page.locator('#bkCopy').click();await expect.poll(()=>page.evaluate(()=>window.copiedBackup)).toBe(current.code);
  expect(await page.evaluate(()=>readCode(window.copiedBackup))).toEqual(current.pack);
  const after=await state(page);expect({...after,backupAt:current.state.backupAt}).toEqual(current.state);expect(after.backupAt).toBeGreaterThan(current.state.backupAt);
  await capture(info,'restore-copy',{original,incoming,current,after,copied:await page.evaluate(()=>window.copiedBackup)});
});

test('@storage-negative warning opens accessible backup without changing progress',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('denied','SecurityError');return original.call(this,key,value);};save();});
  const before=await state(page),raw=await page.evaluate(()=>localStorage.getItem(KEY));
  await expect(page.locator('#warnGo')).toBeVisible();await page.locator('#warnGo').click();
  await expect(page.locator('#backupModal')).toBeVisible();await expect(page.locator('#bkOut')).toBeVisible();
  await page.locator('#bkOut').focus();await expect(page.locator('#bkOut')).toBeFocused();
  const code=await page.locator('#bkOut').inputValue();expect(code).toMatch(await isGame(page)?/^SGG-GAME1\./:/^SGG1\./);
  expect(await page.evaluate(code=>!!readCode(code),code)).toBe(true);
  expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(raw);
  await capture(info,'warning-backup',{before,after:await state(page),raw,code,focus:await page.evaluate(()=>document.activeElement.id)});
});
test('@storage-negative corrupt SGG1 changes neither current nor saved state',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');await backup(page);
  const before=await state(page),raw=await page.evaluate(()=>localStorage.getItem(KEY));
  await page.locator('#bkIn').fill(await isGame(page)?'SGG-GAME1.this-is-invalid':'SGG1.this-is-invalid');await page.locator('#bkLoad').click();
  await expect(page.locator('#bkRes')).toHaveClass('bkres ng');
  expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(raw);
  await capture(info,'failures',{kind:'corrupt-code',before,after:await state(page),raw});
});
for(const failure of ['throw','silent']) test(`@storage-negative restore ${failure} storage never reports success`,async({page},info)=>{
  await openApp(page,appURL,'mid-progress');await backup(page);
  const code=await page.locator('#bkOut').inputValue();
  await page.evaluate(failure=>{
    localStorage.removeItem(KEY);
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key===KEY){if(failure==='throw')throw new DOMException('denied','QuotaExceededError');return;}
      return original.call(this,key,value);
    };
  },failure);
  await page.locator('#bkIn').fill(code);await page.locator('#bkLoad').click();
  await confirmPreview(page);
  await expect(page.locator('#bkRes')).toHaveClass('bkres ng');
  await expect(page.locator('#bkRes')).toContainText('저장');
  expect(await page.evaluate(()=>storeWarn.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(null);
  await capture(info,'failures',{failure,message:await page.locator('#bkRes').innerText(),state:await state(page),storeWarn:await page.evaluate(()=>storeWarn)});
});
for(const kind of ['valid-mirror-empty-local','corrupt-mirror-empty-local','corrupt-local-valid-mirror']) test(`@storage-${kind==='valid-mirror-empty-local'?'happy':'negative'} boot priority unchanged ${kind}`,async({page},info)=>{
  const observations=[];
  for(const url of [baselineURL,appURL]){
    await openApp(page,url,'mid-progress');await expect.poll(()=>mirror(page)).toEqual(await state(page));
    await page.evaluate(async kind=>{
      const raw=JSON.stringify(S);
      await new Promise((resolve,reject)=>idbOpen(db=>{
        const tx=db.transaction('save','readwrite');
        tx.objectStore('save').put(kind==='corrupt-mirror-empty-local'?'broken':raw,KEY);
        tx.oncomplete=resolve;tx.onerror=()=>reject(Error('seed mirror failed'));
      }));
      if(kind==='corrupt-local-valid-mirror')localStorage.setItem(KEY,'broken');else localStorage.removeItem(KEY);
    },kind);
    await page.reload();await page.waitForFunction(()=>typeof S!=='undefined' && !saveHold);
    observations.push(await page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),loadFailed,saveHold,raw:localStorage.getItem(KEY)})));
  }
  expect(observations[1]).toEqual(observations[0]);
  await capture(info,'restore',{kind,baseline:observations[0],current:observations[1]});
});

test('@storage-negative notification denied makes no automatic permission request',async({page},info)=>{
  await page.addInitScript(()=>{
    window.permissionRequests=0;
    Object.defineProperty(Notification,'permission',{get:()=> 'denied'});
    Notification.requestPermission=()=>{permissionRequests++;return Promise.resolve('denied');};
  });
  await openApp(page,appURL,'mid-progress');const before=await state(page);
  await settings(page);await expect(page.locator('#btnBell')).toBeDisabled();
  await page.evaluate(()=>document.getElementById('btnBell').click());
  expect(await page.evaluate(()=>permissionRequests)).toBe(0);expect(await state(page)).toEqual(before);
  await capture(info,'failures',{kind:'notification-denied',before,after:await state(page),requests:0});
});

test('@storage-happy installation guide keyboard return',async({page},info)=>{
  await openApp(page,appURL);await settings(page);await page.locator('#btnInstall').click();
  await expect(page.locator('#installBar')).toHaveAttribute('role','dialog');
  await expect(page.locator('#installGo')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#installBar')).not.toBeVisible();
  await expect(page.locator('#btnSettings')).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  await capture(info,'install-guide',{focus:await page.evaluate(()=>document.activeElement.id)});
});

test('@storage-happy legacy backup missing stock gets one per discovered card',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');await backup(page);
  const legacy=await page.evaluate(()=>{
    const pack=readCode(makeCode());delete pack.st;delete pack.pu;
    return 'SGG1.'+btoa(JSON.stringify(pack)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  });
  await page.locator('#bkIn').fill(legacy);await page.locator(await isGame(page)?'#bkEducation':'#bkLoad').click();
  await confirmPreview(page);
  const after=await state(page);
  expect(after.stock).toEqual(Object.fromEntries(Object.keys(after.owned).map(id=>[id,1])));
  expect(after.pullUsed).toBe(after.pullAt?1:0);
  await capture(info,'restore',{legacy,after});
});

test('@storage-negative unsupported persistence and blocked IDB stay explicit',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');
  await page.addInitScript(()=>{
    Object.defineProperty(window,'indexedDB',{value:{open(){throw new DOMException('blocked','SecurityError');}}});
    Object.defineProperty(navigator,'storage',{value:{}});
  });
  await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);await backup(page);
  const diagnostic=await page.evaluate(()=>new Promise(resolve=>storeDiag(resolve)));
  expect(diagnostic.persist).toBe('지원 안 함');expect(diagnostic.idb).toBe('막힘');
  if(await isGame(page)){
    await diagnostics(page);await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state','unavailable');
    await expect(page.locator('#bkDiag')).toContainText('추가 저장 사본을 확인하지 못했습니다');
    await expect(page.locator('#bkDiag')).toContainText('백업 코드를 보관하세요');
  }else{await expect(page.locator('#bkDiag')).toContainText('지원 안 함');await expect(page.locator('#bkDiag')).toContainText('막힘');}
  await capture(info,'failures',{kind:'unsupported-storage',text:await page.locator('#bkDiag').innerText(),state:await state(page)});
});

test('@storage-negative IDB recovery with denied local write reports memory recovery only',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');const before=await state(page);
  await expect.poll(()=>mirror(page)).toEqual(before);
  await page.evaluate(()=>localStorage.removeItem(KEY));
  await page.addInitScript(saveKey=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key===saveKey)throw new DOMException('denied','SecurityError');
      return original.call(this,key,value);
    };
  },namespaceFor(process.env.SGG_EDITION || 'education').save);
  await page.reload();await page.waitForFunction(()=>typeof S!=='undefined' && !saveHold && !!storeWarn);
  expect(await state(page)).toEqual(before);
  await expect(page.locator('#toast')).toContainText('기기 저장은 확인하지 못했습니다');
  expect(await page.evaluate(()=>localStorage.getItem(KEY))).toBe(null);
  await capture(info,'failures',{kind:'mirror-recovery-denied-local',before,after:await state(page),warning:await page.locator('#toast').innerText()});
});

test('@storage-negative denied local reads preserve baseline startup priority',async({page},info)=>{
  await page.addInitScript(({currentKey,baselineOrigin})=>{
    const saveKey=location.origin===baselineOrigin?'steelgrade_gacha_v1':currentKey;
    const original=Storage.prototype.getItem;window.rawGet=original;
    Storage.prototype.getItem=function(key){
      if(key===saveKey)throw new DOMException('denied','SecurityError');
      return original.call(this,key);
    };
  },{currentKey:namespaceFor(process.env.SGG_EDITION || 'education').save,baselineOrigin:new URL(baselineURL).origin});
  const observations=[];
  for(const url of [baselineURL,appURL]){
    await openApp(page,url,'mid-progress');
    observations.push(await page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),loadFailed,saveHold,raw:rawGet.call(localStorage,KEY)})));
  }
  expect(observations[1]).toEqual(observations[0]);expect(observations[1].loadFailed).toBe(true);
  await capture(info,'failures',{kind:'denied-read',baseline:observations[0],current:observations[1]});
});
