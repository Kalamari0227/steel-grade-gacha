import fs from 'node:fs/promises';
import path from 'node:path';
import {test,expect} from '@playwright/test';
import {appURL,fixedTime,root} from '../helpers/paths.mjs';
import {openApp,state,mirror,capture,settings,destination,sha} from '../helpers/app.mjs';

const education={steelgrade_gacha_v1:'education-save-sentinel',sgg_toon_seen:'education-toon-sentinel',sgg_install_dismissed:'1',sgg_installed:'1'};
const errors=new WeakMap();
test.beforeEach(async({page})=>{const found=[];errors.set(page,found);page.on('pageerror',error=>found.push(error.message));});
test.afterEach(async({page},info)=>{await capture(info,'page-errors',errors.get(page));expect(errors.get(page)).toEqual([]);});
async function open(page,fixture='mid-progress'){
  await openApp(page,appURL,fixture);
  await page.evaluate(education=>{
    for(const [key,value] of Object.entries(education))localStorage.setItem(key,value);
    const prefs=JSON.parse(localStorage.getItem(GAME_EDITION.preferences)||'{}');
    localStorage.setItem(GAME_EDITION.preferences,JSON.stringify({...prefs,unrelated:'settings-sentinel'}));
  },education);
  await expect.poll(()=>mirror(page)).toEqual(await state(page));
}
async function progress(page){return page.evaluate(async()=>({state:JSON.parse(JSON.stringify(S)),local:(window.settingsRawGet||Storage.prototype.getItem).call(localStorage,KEY),mirror:await new Promise(resolve=>mirrorGet(resolve)),education:Object.fromEntries(['steelgrade_gacha_v1','sgg_toon_seen','sgg_install_dismissed','sgg_installed'].map(key=>[key,localStorage.getItem(key)]))}));}
async function artifact(page,info,name,extra={}){
  const observed=await progress(page);expect(observed.education).toEqual(education);
  await capture(info,name,{...extra,observed,sha256:sha(JSON.stringify(observed)),surface:await page.evaluate(()=>({route:location.hash,release:document.body.dataset.gameRelease,stack:dialogStack.map(row=>row.el.id),focus:document.activeElement.id,scroll:document.body.style.overflow}))});
  const path=info.outputPath(name+'.png');await page.screenshot({path,animations:'disabled'});await info.attach(name,{path,contentType:'image/png'});
}
async function backup(page){await settings(page);await page.locator('#btnBackup').click();await expect(page.locator('#bkDiag')).toHaveAttribute('aria-busy','false');}
function encode(pack,edition='game'){return (edition==='game'?'SGG-GAME1.':'SGG1.')+Buffer.from(JSON.stringify(edition==='game'?{version:1,edition:'game',progress:pack}:pack)).toString('base64url');}
async function preview(page,pack,edition='game'){await page.locator('#bkIn').fill(encode(pack,edition));await page.locator(edition==='game'?'#bkLoad':'#bkEducation').click();await expect(page.locator('#bkPreview')).toBeVisible();}
async function gain(page,name,value){await page.locator('[data-audio-'+name+']').fill(String(value));await page.locator('[data-audio-'+name+']').dispatchEvent('input');}

test('all five routes retain nested callers and progress after keyboard close',async({page},info)=>{
  // Given populated real game progress on each destination.
  await open(page);const before=await progress(page),routes=[];
  for(const route of ['workshop','dex','craft','research','garage']){
    await destination(page,route);await settings(page);
    // When each existing settings child is opened and closed with Escape.
    for(const [button,dialog] of [['settingsNotice','noticeModal'],['settingsPromo','promoModal'],['btnBackup','backupModal']]){
      await page.locator('#'+button).click();await expect(page.locator('#'+dialog)).toBeVisible();
      expect(await page.locator('#settingsModal').evaluate(el=>el.inert)).toBe(true);
      await page.keyboard.press('Escape');await expect(page.locator('#'+button)).toBeFocused();
      expect(await page.locator('#settingsModal').evaluate(el=>el.inert)).toBe(false);
    }
    await page.keyboard.press('Escape');
    // Then the caller, route, scroll ownership and exact economic state remain intact.
    await expect(page.locator('#btnSettings')).toBeFocused();expect(await page.evaluate(()=>location.hash)).toBe('#'+route);
    expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');expect(await page.locator('#appShell').evaluate(el=>el.inert)).toBe(false);
    expect(await progress(page)).toEqual(before);routes.push(route);
  }
  await artifact(page,info,'five-route-callers',{before,routes});
});

for(const [width,height] of [[360,800],[390,844],[768,1024],[1280,900],[640,450]])test(`settings and backup stay readable with bounded scrolling ${width}x${height}`,async({page},info)=>{
  // Given the approved responsive viewport and reduced motion preference.
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});await open(page);const before=await progress(page);await settings(page);
  // When keyboard navigation visits every settings control and the long backup surface.
  const tabbed=[];
  for(let i=0;i<20;i++){
    await page.keyboard.press('Tab');const row=await page.evaluate(()=>{const el=document.activeElement,box=el.getBoundingClientRect();return {id:el.id,tag:el.tagName,inside:!!el.closest('#settingsModal'),hidden:!!el.closest('[hidden],[inert]'),top:box.top,bottom:box.bottom,height:box.height};});
    expect(row.inside).toBe(true);expect(row.hidden).toBe(false);expect(row.top).toBeGreaterThanOrEqual(0);expect(row.bottom).toBeLessThanOrEqual(height);tabbed.push(row);
  }
  const geometry=await page.locator('#settingsModal button:visible,#settingsModal input[type=range]').evaluateAll(nodes=>nodes.map(el=>({id:el.id,height:el.getBoundingClientRect().height,font:parseFloat(getComputedStyle(el).fontSize)})));
  expect(geometry.every(row=>row.height>=44)).toBe(true);await artifact(page,info,'settings-layout',{width,height,tabbed,geometry,before,reflowApproximation:width===640?'half-size CSS viewport; not physical browser zoom':null});
  await page.locator('#btnBackup').click();await expect(page.locator('#bkDiag')).toHaveAttribute('aria-busy','false');await page.locator('#bkIn').fill('SGG-GAME1.invalid');await page.locator('#bkLoad').click();
  await expect(page.locator('#bkIn')).toHaveAttribute('aria-invalid','true');await page.locator('#bkRes').scrollIntoViewIfNeeded();
  // Then the error and controls are reachable without horizontal clipping or state writes.
  const overflow=await page.locator('#backupModal .box').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,height:el.clientHeight}));expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width+1);
  expect(await progress(page)).toEqual(before);await artifact(page,info,'backup-layout',{width,height,overflow,before});
});

test('real audio remains opt in and gains mute zero states and reload preserve other preferences',async({page},info)=>{
  // Given the actual production audio assets, with no activation gesture.
  const requests=[];page.on('request',r=>{if(/\.(ogg|m4a|wav)(?:\?|$)/.test(r.url()))requests.push(r.url());});await open(page);const before=await progress(page);
  expect(await page.evaluate(()=>GAME_AUDIO.snapshot().state)).toBe('uncreated');expect(requests).toEqual([]);await settings(page);
  // When real controls explicitly enable playback and change independent gains.
  await page.locator('#gameAudioControls [data-audio-enable]').click();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().tracks.length)).toBeGreaterThan(0);
  const started=await page.evaluate(()=>GAME_AUDIO.snapshot());await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().currentTime)).toBeGreaterThan(started.currentTime+.1);
  await gain(page,'bgm',23);await gain(page,'sfx',78);await page.locator('[data-audio-bgm]').press('ArrowRight');expect(await page.evaluate(()=>GAME_AUDIO.snapshot().bgmGain)).toBe(.24);await gain(page,'bgm',23);
  const zero=[];
  for(const [bgm,sfx] of [[0,78],[23,0],[0,0]]){await gain(page,'bgm',bgm);await gain(page,'sfx',sfx);const snap=await page.evaluate(()=>GAME_AUDIO.snapshot());const status=await page.locator('[data-audio-status]').innerText();expect(status).toContain('0');expect(status).not.toBe('소리 켜짐');expect(snap.bgmGain).toBe(bgm/100);expect(snap.sfxGain).toBe(sfx/100);if(!bgm)expect(snap.tracks).toEqual([]);zero.push({bgm,sfx,status,snap});}
  await gain(page,'bgm',23);await gain(page,'sfx',78);await page.locator('[data-audio-mute]').check();await expect.poll(()=>page.evaluate(()=>GAME_AUDIO.snapshot().state)).toBe('suspended');
  const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem(GAME_EDITION.preferences)));expect(prefs.unrelated).toBe('settings-sentinel');expect(prefs.audio).toEqual({optedIn:true,muted:true,bgmGain:.23,sfxGain:.78});
  // Then reload retains preferences without automatically creating an audio context.
  await page.reload();await page.waitForFunction(()=>typeof GAME_AUDIO!=='undefined'&&!saveHold);expect(await page.evaluate(()=>GAME_AUDIO.snapshot())).toMatchObject({state:'uncreated',muted:true,bgmGain:.23,sfxGain:.78,tracks:[],voices:[]});expect(await progress(page)).toEqual(before);await settings(page);await artifact(page,info,'audio-controls',{before,started,zero,prefs,requests,subjectiveHearing:false});
});

test('failed real audio requests retain the error above zero-volume status',async({page},info)=>{
  // Given unavailable production audio URLs in the real application.
  await page.route(/\.(ogg|m4a)(?:\?|$)/,route=>route.fulfill({status:404,body:'owned unavailable audio'}));await open(page);const before=await progress(page);await settings(page);
  // When playback fails and the user subsequently sets both gains to zero.
  await page.locator('#gameAudioControls [data-audio-enable]').click();await expect(page.locator('[data-audio-status]')).toContainText('불러오지 못했습니다');await gain(page,'bgm',0);await gain(page,'sfx',0);
  // Then the error remains visible, play clocks do not imply audible output, and gameplay survives.
  await expect(page.locator('[data-audio-status]')).toContainText('불러오지 못했습니다');const audio=await page.evaluate(()=>GAME_AUDIO.snapshot());expect(audio.tracks).toEqual([]);expect(audio.errors.length).toBeGreaterThan(0);expect(await progress(page)).toEqual(before);await artifact(page,info,'audio-unavailable-priority',{before,audio});
});

test('audio preference write failure stays visible after subsequent control updates',async({page},info)=>{
  // Given denied writes only to the preference key.
  await open(page);await settings(page);const before=await progress(page);await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===GAME_EDITION.preferences)throw new DOMException('owned denial','QuotaExceededError');return set.call(this,key,value);};});
  // When the user changes a volume and toggles mute.
  await gain(page,'bgm',0);await page.locator('[data-audio-mute]').check();
  // Then the save failure is not replaced by an ordinary muted/success message.
  await expect(page.locator('[data-audio-status]')).toContainText('기기에 저장하지 못했습니다');expect(await page.evaluate(()=>GAME_AUDIO.snapshot().bgmGain)).toBe(0);expect(await progress(page)).toEqual(before);await artifact(page,info,'audio-preference-failure',{before});
});

test('known invalid backup fields produce distinct readable errors without any state changes',async({page},info)=>{
  // Given the same valid pack and current progress for every malformed boundary input.
  await open(page);await backup(page);const before=await progress(page),pack=await page.evaluate(()=>makePack()),code=await page.locator('#bkOut').inputValue();
  const cases=[['scrap',{...pack,s:-1},'스크랩'],['inventory',{...pack,st:{P270C:-1}},'재고'],['materials',{...pack,o:[null]},'소재'],['item',{...pack,i:{arrow:true}},'아이템'],['date',{...pack,od:'2026-2-30'},'날짜'],['parts',{...pack,pt:['unknown']},'부품'],['cars',{...pack,cr:[['unknown',0]]},'자동차'],['quota',{...pack,pu:-1},'출하'],['injection',{...pack,o:['<img src=x onerror="window.injected=true">']},'소재']];
  const observed=[];
  // When invalid field values reach the real import boundary through the input.
  for(const [name,value,label] of cases){await page.locator('#bkIn').fill(encode(value));await page.locator('#bkLoad').click();const message=await page.locator('#bkRes').innerText();expect(message).toContain(label);expect(message).not.toMatch(/(?:\bi\.|\bst\.|\bo\[|code:|progress:|base64|UTF-8|<img)/);await expect(page.locator('#bkPreview')).toBeHidden();expect(await progress(page)).toEqual(before);expect(await page.locator('#bkOut').inputValue()).toBe(code);observed.push({name,message});}
  for(const invalid of ['SGG-GAME1.%%%','x'.repeat(256*1024+1),encode(pack,'education')]){await page.locator('#bkIn').fill(invalid);await page.locator('#bkLoad').click();await expect(page.locator('#bkIn')).toHaveAttribute('aria-invalid','true');expect(await progress(page)).toEqual(before);}
  // Then errors remain data and the exact original progress and export survive.
  expect(await page.evaluate(()=>window.injected)).toBeUndefined();await artifact(page,info,'invalid-fields',{before,observed});
});

for(const edition of ['game','education'])test(`explicit ${edition} preview cancel replace and recovery keep education intact`,async({page},info)=>{
  // Given populated game progress and a detached valid incoming pack.
  await open(page);await backup(page);const before=await progress(page),old=await page.locator('#bkOut').inputValue(),incoming={v:1,o:['P270C','-qp-1470'],st:{P270C:0,'-qp-1470':3},i:{arrow:'-qp-1470'},s:71};
  // When the preview is cancelled, then confirmed once after a fresh preview.
  await preview(page,incoming,edition);expect(await progress(page)).toEqual(before);await expect(page.locator('#bkRecovery')).toHaveValue(old);await page.locator('#bkCancel').click();expect(await progress(page)).toEqual(before);
  await preview(page,incoming,edition);await page.locator('#bkConfirm').click();
  // Then the new progress is durable and the page retains the exact previous game code.
  await expect(page.locator('#bkRes')).toHaveClass('bkres ok');expect((await state(page)).scrap).toBe(71);expect((await state(page)).items.arrow).toBe('qp-1470');expect((await state(page)).stock).toEqual({'poo-270C':0,'qp-1470':3});await expect(page.locator('#bkRecoveryOut')).toHaveValue(old);await expect.poll(()=>mirror(page)).toEqual(await state(page));await artifact(page,info,'replace-'+edition,{before,incoming,old});
  await page.locator('#bkIn').fill(old);await page.locator('#bkLoad').click();await page.locator('#bkConfirm').click();expect(await page.evaluate(()=>makePack())).toEqual(JSON.parse(Buffer.from(old.split('.')[1],'base64url').toString()).progress);
});

test('edited and stale previews cannot apply a second or outdated replacement',async({page},info)=>{
  // Given a ready preview and a changed current game.
  await open(page);await backup(page);await preview(page,{v:1,o:['P270C'],s:88});await page.evaluate(()=>{S.scrap++;save();});await expect.poll(()=>mirror(page)).toEqual(await state(page));const before=await progress(page);
  // When the obsolete confirmation is attempted twice.
  await page.locator('#bkConfirm').click();await page.evaluate(()=>document.getElementById('bkConfirm').click());
  // Then it is rejected without losing the newer state; editing a later preview also invalidates it.
  await expect(page.locator('#bkRes')).toHaveClass('bkres ng');expect(await progress(page)).toEqual(before);await preview(page,{v:1,o:['P270C'],s:89});await page.locator('#bkIn').fill(encode({v:1,o:['P270C'],s:99}));await expect(page.locator('#bkPreview')).toBeHidden();expect(await progress(page)).toEqual(before);await artifact(page,info,'stale-and-edit',{before});
});

test('clipboard rejection selects the current code without claiming backup completion',async({page},info)=>{
  // Given a browser that rejects clipboard writes.
  await open(page);await backup(page);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(){return Promise.reject(new DOMException('owned denial','NotAllowedError'));}}}));const before=await progress(page),code=await page.locator('#bkOut').inputValue();
  // When copying the current backup fails.
  await page.locator('#bkCopy').click();
  // Then the code remains selectable and backupAt and all progress are unchanged.
  await expect(page.locator('#bkRes')).toHaveClass('bkres ng');expect(await page.locator('#bkOut').evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(code.length);expect(await progress(page)).toEqual(before);await artifact(page,info,'clipboard-rejected',{before,code});
});

for(const mode of ['throw','silent'])test(`restore remains usable in memory when persistence ${mode}`,async({page},info)=>{
  // Given existing progress and a denied or silently discarded primary write.
  await open(page);await backup(page);const before=await progress(page),old=await page.locator('#bkOut').inputValue();await page.evaluate(mode=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY){if(mode==='throw')throw new DOMException('owned denial','QuotaExceededError');return;}return set.call(this,key,value);};},mode);
  // When replacement commits the new state in memory.
  await preview(page,{v:1,o:['P270C'],s:88});await page.locator('#bkConfirm').click();
  // Then failure never rolls it back or claims durable success, and recovery remains available.
  await expect(page.locator('#bkRes')).toHaveClass('bkres ng');await expect(page.locator('#bkRes')).toContainText('기기 저장을 확인하지 못했습니다');expect((await state(page)).scrap).toBe(88);expect((await progress(page)).local).toBe(before.local);await expect(page.locator('#bkRecoveryOut')).toHaveValue(old);const current=await page.locator('#bkOut').inputValue();expect(JSON.parse(Buffer.from(current.split('.')[1],'base64url').toString()).progress.s).toBe(88);await artifact(page,info,'memory-only-'+mode,{before,current,old});
});

test('read failure overrides a healthy storage probe without overwriting the saved game',async({page},info)=>{
  // Given a saved game whose progress key becomes unreadable on the next load.
  await open(page);const raw=(await progress(page)).local;
  await page.addInitScript(()=>{window.settingsRawGet=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='sgg_game_save_v1')throw new DOMException('owned read denial','SecurityError');return window.settingsRawGet.call(this,key);};});
  await page.reload();await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);const before=await progress(page);expect(await page.evaluate(()=>loadFailed)).toBe(true);
  // When diagnostic scratch-key writes still succeed.
  await backup(page);
  // Then the player sees the read failure rather than a generic healthy-save claim.
  await expect(page.locator('#bkDiag [data-storage-check=primary]')).toHaveAttribute('data-state','unconfirmed');await expect(page.locator('#bkDiag')).toContainText('덮어쓰기를 멈췄습니다');expect((await progress(page)).local).toBe(raw);expect(await progress(page)).toEqual(before);await artifact(page,info,'read-failure-priority',{before,raw});
});

test('pending startup recovery blocks preview until its existing timeout releases the hold',async({page},info)=>{
  // Given a missing primary save and an unresponsive game mirror in owned browser state.
  await page.clock.install({time:new Date(fixedTime)});await open(page);await page.evaluate(()=>localStorage.removeItem(KEY));
  await page.addInitScript(()=>{const original=indexedDB.open.bind(indexedDB);indexedDB.open=function(name,...args){return name==='sgg_game'?(window.settingsPendingIDB={}):original(name,...args);};});
  await page.clock.pauseAt(new Date(new Date(fixedTime).getTime()+1000));await page.reload();await page.waitForFunction(()=>typeof S!=='undefined');expect(await page.evaluate(()=>saveHold)).toBe(true);
  const before=await page.evaluate(()=>({state:JSON.stringify(S),raw:localStorage.getItem(KEY)}));
  // When the player asks to preview a valid code while the mirror check is pending.
  await settings(page);await page.locator('#btnBackup').click();await page.locator('#bkIn').fill(encode({v:1,o:['P270C'],s:88}));await page.locator('#bkLoad').click();
  // Then no preview or replacement is allowed and the pending-memory state is unchanged.
  await expect(page.locator('#bkPreview')).toBeHidden();await expect(page.locator('#bkRes')).toContainText('저장 사본을 확인 중');expect(await page.evaluate(()=>({state:JSON.stringify(S),raw:localStorage.getItem(KEY)}))).toEqual(before);await capture(info,'save-hold-before-release',{before,status:await page.locator('#bkRes').innerText()});
  await page.clock.runFor(3100);expect(await page.evaluate(()=>saveHold)).toBe(false);
  // Finish the injected request with an error before collecting the mirror result.
  await page.evaluate(()=>window.settingsPendingIDB.onerror());expect((await progress(page)).mirror).toBeNull();expect(JSON.parse((await progress(page)).local)).toEqual(await state(page));await artifact(page,info,'save-hold-released',{before,mirrorFault:'pending request ended with an injected error after the hold timeout'});
});

test('reset cancel close route change and 5001ms expiry preserve exact progress',async({page},info)=>{
  // Given a populated game and a controllable clock installed before navigation.
  await page.clock.install({time:new Date(fixedTime)});await open(page,'reset-ready');await page.clock.pauseAt(new Date(new Date(fixedTime).getTime()+1000));const before=await progress(page),observed=[];
  // When each supported abandonment route interrupts the armed confirmation.
  for(const mode of ['cancel','escape','close','route','expiry']){
    await settings(page);await page.locator('#btnReset').click();await expect(page.locator('#resetCancel')).toBeVisible();expect(await progress(page)).toEqual(before);
    if(mode==='cancel')await page.locator('#resetCancel').click();
    if(mode==='escape')await page.keyboard.press('Escape');
    if(mode==='close')await page.locator('#settingsX').click();
    if(mode==='route'){await page.evaluate(()=>location.hash='garage');await expect(page.locator('#settingsModal')).toBeHidden();}
    if(mode==='expiry')await page.clock.runFor(5001);
    // Then re-entry starts a new confirmation instead of deleting progress.
    await expect(page.locator('#btnReset')).not.toHaveClass(/arm/);expect(await progress(page)).toEqual(before);observed.push(mode);
    if(await page.locator('#settingsModal.show').count())await page.locator('#settingsX').click();
  }
  await artifact(page,info,'reset-cancel-expiry',{before,observed});
});

test('two explicit reset clicks persist the exact canonical state and retain preferences',async({page},info)=>{
  // Given a fully populated reset fixture and unrelated preference flags.
  await open(page,'reset-ready');const before=await state(page),prefs=await page.evaluate(()=>localStorage.getItem(GAME_EDITION.preferences)),toon=await page.evaluate(()=>localStorage.getItem(TOON_SEEN));await settings(page);
  // When the second explicit click confirms within five seconds.
  await page.locator('#btnReset').click();await page.locator('#btnReset').click();
  // Then only canonical game fields reset and a first action remains available.
  const expected={owned:{},stock:{},last:'',extra:0,quizDay:'',items:{},orderDay:'2026-11-1',orderKey:'',scrap:0,pending:'',pullAt:0,quizAt:0,quizUsed:0,bell:before.bell,belledAt:-1,backupAt:0,orderDone:0,promoSeen:before.promoSeen,promoDone:before.promoDone,noticeSeen:'',parts:{},cars:[],pullUsed:0,qpSeen:0};
  expect(await state(page)).toEqual(expected);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(expected);await expect.poll(()=>mirror(page)).toEqual(expected);await page.reload();await page.waitForFunction(()=>!saveHold);expect(await state(page)).toEqual(expected);expect(await page.evaluate(()=>localStorage.getItem(GAME_EDITION.preferences))).toBe(prefs);expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe(toon);await expect(page.locator('#btnPull')).toBeEnabled();await artifact(page,info,'canonical-reset',{before,expected,prefs,toon});
});

for(const mode of ['unsupported','denied','rejected'])test(`notification ${mode} stays gesture bound and preserves progress`,async({page},info)=>{
  // Given a deliberately unsupported, denied or rejecting permission facade.
  await page.addInitScript(mode=>{window.permissionCalls=0;function NotificationFixture(){}NotificationFixture.permission=mode==='denied'?'denied':'default';NotificationFixture.requestPermission=()=>{window.permissionCalls++;return Promise.reject(new DOMException('owned denial','NotAllowedError'));};Object.defineProperty(window,'Notification',{configurable:true,value:mode==='unsupported'?undefined:NotificationFixture});},mode);
  await open(page);const before=await progress(page);expect(await page.evaluate(()=>window.permissionCalls)).toBe(0);await settings(page);
  // When the permission control is inspected or explicitly requested where available.
  if(mode==='rejected'){await page.locator('#btnBell').click();await expect(page.locator('#toast')).toHaveClass(/show/);expect(await page.evaluate(()=>window.permissionCalls)).toBe(1);}else{await expect(page.locator('#btnBell')).toBeDisabled();expect(await page.evaluate(()=>window.permissionCalls)).toBe(0);}
  // Then no failed permission request changes the saved game.
  expect(await progress(page)).toEqual(before);await artifact(page,info,'permission-'+mode,{before,simulation:'Notification facade; no physical OS permission proof'});
});

for(const outcome of ['dismissed','rejected','accepted'])test(`install ${outcome} reports a truthful outcome and leaves game progress intact`,async({page},info)=>{
  // Given the real install surface with a simulated browser prompt lifecycle.
  await open(page);await page.evaluate(()=>{localStorage.removeItem(GAME_EDITION.installed);document.getElementById('btnInstall').hidden=false;});const before=await progress(page);
  await page.evaluate(outcome=>{window.installCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=()=>{window.installCalls++;return outcome==='rejected'?Promise.reject(new DOMException('owned failure','NotAllowedError')):Promise.resolve();};event.userChoice=Promise.resolve({outcome});window.dispatchEvent(event);},outcome);
  expect(await page.evaluate(()=>window.installCalls)).toBe(0);await settings(page);await page.locator('#btnInstall').click();
  // When the player explicitly starts installation.
  await page.locator('#installGo').click();expect(await page.evaluate(()=>window.installCalls)).toBe(1);
  // Then only the real appinstalled event may set the installed flag.
  if(outcome==='accepted')await expect(page.locator('#installBar')).not.toHaveClass(/show/);
  else{await expect(page.locator('#installGo')).toBeEnabled();await expect(page.locator('#installSub')).toContainText(outcome==='rejected'?'열지 못했습니다':'취소했습니다');await artifact(page,info,'install-'+outcome,{before,simulation:'beforeinstallprompt event facade only'});await page.locator('#installX').click();}
  expect(await page.evaluate(()=>localStorage.getItem(GAME_EDITION.installed))).toBeNull();expect(await progress(page)).toEqual(before);await expect(page.locator('#btnSettings')).toBeFocused();await artifact(page,info,'install-closed-'+outcome,{before,simulation:'No physical OS install performed'});
});

test('unsupported install offers platform guides without requesting installation',async({page},info)=>{
  // Given no beforeinstallprompt event.
  await page.addInitScript(()=>window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();event.stopImmediatePropagation();},true));
  await open(page);const before=await progress(page);await settings(page);await page.locator('#btnInstall').click();
  // When each guide is selected by keyboard and the guide is closed.
  const tabs=[];for(const tab of ['ios','android','pc']){const button=page.locator('#installSteps [data-t='+tab+']');await button.focus();await page.keyboard.press('Enter');await expect(button).toHaveAttribute('aria-pressed','true');await expect(button).toBeFocused();tabs.push(await page.locator('#installSteps').innerText());}
  await expect(page.locator('#installSteps')).toContainText('인터넷 연결이 필요할 수 있습니다');await artifact(page,info,'install-guides',{before,tabs});await page.keyboard.press('Escape');await expect(page.locator('#btnSettings')).toBeFocused();expect(await progress(page)).toEqual(before);
});

test('fresh empty artwork retry keeps the same game state and returns the real asset',async({page},info)=>{
  // Given a new game with only its empty display plinth request blocked.
  const release=JSON.parse(await fs.readFile(path.join(root,'game-release.json'))),asset=release.files.find(row=>/\/stage-plinth\./.test(row.path));expect(asset).toBeTruthy();const assetURL=new URL(asset.path,appURL+'/').href,blocked=[];await page.route(assetURL,route=>{blocked.push(route.request().url());return route.abort('failed');});await open(page,'new');const before=await progress(page);expect(blocked.length).toBeGreaterThan(0);
  await expect(page.locator('#homeFigure .home-art-status')).toBeVisible();await expect(page.locator('#btnPull')).toBeEnabled();await expect(page.locator('#homeHeroOpen')).toBeHidden();
  // When connectivity returns and the player retries the failed image.
  await page.unroute(assetURL);const responsePromise=page.waitForResponse(response=>response.url().split('?')[0]===assetURL&&response.status()===200);await page.locator('#homeFigure .home-art-status button').click();const recovered=await responsePromise;expect(sha(await recovered.body())).toBe(asset.sha256);
  // Then the actual image decodes and retry neither awards nor consumes anything.
  await expect(page.locator('#homeFigure .home-art-status')).toBeHidden();await expect(page.locator('#homeFigure .game-asset-fallback')).toHaveCount(0);expect(await page.locator('#homeFigure img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);expect(await progress(page)).toEqual(before);await artifact(page,info,'empty-image-retry',{before,asset,assetURL,blocked,recovered:{url:recovered.url(),status:recovered.status(),sha256:sha(await recovered.body())}});
});

test('completed collection still leads to the existing garage without new rewards',async({page},info)=>{
  // Given the existing all-cars fixture.
  await open(page,'all-cars');const before=await progress(page);
  // When the completed-state next action is chosen.
  await page.locator('#homeRecommend').click();
  // Then it routes to the real garage and awards nothing.
  await expect(page.locator('#view-garage')).toBeVisible();expect(await progress(page)).toEqual(before);await artifact(page,info,'completed-next-action',{before});
});
