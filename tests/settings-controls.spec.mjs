import {test,expect} from '@playwright/test';
import {appURL} from './helpers/paths.mjs';
import {openApp,state,capture,settings} from './helpers/app.mjs';
import {storageEvidence} from './helpers/storage-evidence.mjs';
storageEvidence(test);

function except(value,keys){const copy=structuredClone(value);for(const key of keys)delete copy[key];return copy;}
for(const mode of ['clipboard-success','clipboard-reject','clipboard-throw','fallback-success','fallback-false','fallback-throw'])test(`@storage-${mode.endsWith('success')?'happy':'negative'} copy ${mode} backup timestamp only on verified copy`,async({page},info)=>{
  await page.addInitScript(mode=>{
    window.__copyCalls=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:mode.startsWith('clipboard')?{writeText(text){
      window.__copyCalls.push({method:'clipboard',text});
      if(mode==='clipboard-throw')throw new DOMException('blocked','NotAllowedError');
      return mode==='clipboard-reject'?Promise.reject(new DOMException('blocked','NotAllowedError')):Promise.resolve();
    }}:undefined});
    document.execCommand=function(command){
      window.__copyCalls.push({method:'execCommand',command,text:document.querySelector('#bkOut')?.value});
      if(mode==='fallback-throw')throw new DOMException('blocked','NotAllowedError');
      return mode==='fallback-success';
    };
  },mode);
  await openApp(page,appURL,'mid-progress');await settings(page);await page.locator('#btnBackup').click();
  const before=await state(page),code=await page.locator('#bkOut').inputValue();await page.locator('#bkCopy').click();
  const success=mode.endsWith('success');await expect(page.locator('#bkRes')).toHaveClass(success?'bkres ok':'bkres ng');
  const after=await state(page),calls=await page.evaluate(()=>window.__copyCalls);
  expect(calls).toHaveLength(1);expect(calls[0].text).toBe(code);expect(except(after,['backupAt'])).toEqual(except(before,['backupAt']));
  if(success){expect(after.backupAt).toBe(await page.evaluate(()=>Date.now()));expect(JSON.parse(await page.evaluate(()=>localStorage.getItem(KEY))).backupAt).toBe(after.backupAt);}
  else{expect(after.backupAt).toBe(before.backupAt);expect(await page.locator('#bkOut').evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(code.length);}
  await capture(info,'clipboard',{mode,before,after,calls,code,status:await page.locator('#bkRes').innerText()});
});

for(const api of ['promise','callback','both'])test(`@storage-happy notification granted ${api} enable disable without economy changes`,async({page},info)=>{
  await page.addInitScript(api=>{
    window.__permissionCalls=0;window.__notifications=[];
    function FakeNotification(title,options){window.__notifications.push({title,options});}
    FakeNotification.permission='default';FakeNotification.requestPermission=function(callback){
      window.__permissionCalls++;FakeNotification.permission='granted';
      if(api!=='promise'&&callback)callback('granted');
      if(api!=='callback')return Promise.resolve('granted');
    };
    Object.defineProperty(window,'Notification',{configurable:true,value:FakeNotification});
  },api);
  await openApp(page,appURL,'mid-progress');await page.evaluate(()=>{S.bell=false;renderBell();});const before=await state(page);
  expect(await page.evaluate(()=>window.__permissionCalls)).toBe(0);await settings(page);
  await page.evaluate(()=>{window.__bellCompletion={save:0,armBell:0,showToast:0};for(const name of Object.keys(window.__bellCompletion)){const original=window[name];window[name]=function(...args){window.__bellCompletion[name]++;return original.apply(this,args);};}});
  await page.locator('#btnBell').click();
  await expect.poll(()=>page.evaluate(()=>bellOn())).toBe(true);const enabled=await state(page);
  expect(await page.evaluate(()=>window.__permissionCalls)).toBe(1);expect(except(enabled,['bell','belledAt'])).toEqual(except(before,['bell','belledAt']));
  const completion=await page.evaluate(()=>window.__bellCompletion);expect(completion).toEqual({save:1,armBell:1,showToast:1});
  await page.locator('#btnBell').click();expect((await state(page)).bell).toBe(false);expect(await page.evaluate(()=>window.__permissionCalls)).toBe(1);
  expect(except(await state(page),['bell','belledAt'])).toEqual(except(before,['bell','belledAt']));
  await capture(info,'notification',{simulation:'scoped Notification facade; no real OS permission requested',api,completion,before,enabled,after:await state(page),notifications:await page.evaluate(()=>window.__notifications)});
});

test('@storage-negative rejected notification permission promise reports failure once without save',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.__permissionCalls=0;function MockNotification(){}MockNotification.permission='default';MockNotification.requestPermission=()=>{window.__permissionCalls++;return Promise.reject(new DOMException('test denied','NotAllowedError'));};Object.defineProperty(window,'Notification',{configurable:true,value:MockNotification});});
  await openApp(page,appURL,'mid-progress');await settings(page);const before=await state(page);
  await page.evaluate(()=>{window.__bellCompletion={save:0,armBell:0,showToast:0};for(const name of Object.keys(window.__bellCompletion)){const original=window[name];window[name]=function(...args){window.__bellCompletion[name]++;return original.apply(this,args);};}});
  await page.locator('#btnBell').click();await expect(page.locator('#toast')).toContainText('알림 권한 요청을 완료하지 못했습니다');
  expect(await page.evaluate(()=>window.__permissionCalls)).toBe(1);expect(await state(page)).toEqual(before);expect(errors).toEqual([]);
  const completion=await page.evaluate(()=>window.__bellCompletion);expect(completion).toEqual({save:0,armBell:0,showToast:1});await capture(info,'notification-rejected',{before,after:await state(page),completion,errors});
});

test('@storage-negative unsupported notification disabled and state unchanged',async({page},info)=>{
  await page.addInitScript(()=>Object.defineProperty(window,'Notification',{configurable:true,value:undefined}));
  await openApp(page,appURL,'mid-progress');const before=await state(page);await settings(page);
  await expect(page.locator('#btnBell')).toBeDisabled();await expect(page.locator('#btnBell')).toContainText('지원');
  expect(await state(page)).toEqual(before);await capture(info,'unsupported-bell',{before,after:await state(page)});
});

for(const outcome of ['accepted','dismissed'])test(`@storage-happy install prompt ${outcome} event simulation and lifecycle`,async({page},info)=>{
  await openApp(page,appURL,'mid-progress');const before=await state(page);
  const educationBefore=await page.evaluate(()=>Object.fromEntries(['sgg_installed','sgg_install_dismissed'].map(k=>[k,localStorage.getItem(k)])));
  await page.evaluate(outcome=>{
    window.__installPromptCalls=0;
    const event=new Event('beforeinstallprompt',{cancelable:true});
    event.prompt=()=>{window.__installPromptCalls++;return Promise.resolve();};
    event.userChoice=new Promise(resolve=>window.__resolveInstallChoice=()=>resolve({outcome,platform:'web'}));
    window.dispatchEvent(event);window.__installPrevented=event.defaultPrevented;
  },outcome);
  expect(await page.evaluate(()=>window.__installPrevented)).toBe(true);expect(await page.evaluate(()=>window.__installPromptCalls)).toBe(0);
  await settings(page);const originalStack=await page.evaluate(()=>({stack:dialogStack.map(row=>row.el.id),focus:document.activeElement.id}));await page.locator('#btnInstall').click();await page.locator('#installGo').click();
  expect(await page.evaluate(()=>window.__installPromptCalls)).toBe(1);await page.evaluate(()=>window.__resolveInstallChoice());
  if(outcome==='accepted')await expect(page.locator('#installBar')).not.toHaveClass(/show/);
  else{await expect(page.locator('#installGo')).toHaveText('접기');await page.locator('#installX').click();}
  expect(await page.evaluate(()=>dialogStack.some(row=>row.el.id==='installBar'))).toBe(false);
  expect(await page.evaluate(()=>localStorage.getItem(KEY==='sgg_game_save_v1'?GAME_EDITION.installed:'sgg_installed'))).toBe(null);
  await expect(page.locator('#btnSettings')).toBeFocused();expect(await state(page)).toEqual(before);
  const closed=await page.evaluate(()=>({stack:dialogStack.map(row=>row.el.id),focus:document.activeElement.id}));expect(closed.stack).toEqual([]);
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  expect(await page.evaluate(()=>localStorage.getItem(KEY==='sgg_game_save_v1'?GAME_EDITION.installed:'sgg_installed'))).toBe('1');await expect(page.locator('#btnInstall')).toBeHidden();
  expect(await state(page)).toEqual(before);await page.keyboard.press('Escape');expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  if(await page.evaluate(()=>KEY==='sgg_game_save_v1'))expect(await page.evaluate(()=>Object.fromEntries(['sgg_installed','sgg_install_dismissed'].map(k=>[k,localStorage.getItem(k)])))).toEqual(educationBefore);
  await capture(info,'install-choice',{simulation:'beforeinstallprompt and appinstalled events only; no OS installation performed',outcome,originalStack,closed,before,after:await state(page)});
});

test('@storage-happy install platform guides collapse close and reopen without economy change',async({page},info)=>{
  await openApp(page,appURL,'mid-progress');const before=await state(page),educationBefore=await page.evaluate(()=>Object.fromEntries(['sgg_installed','sgg_install_dismissed'].map(k=>[k,localStorage.getItem(k)])));await settings(page);await page.locator('#btnInstall').click();
  const choices=[];
  for(const [tab,heading,instruction] of [['ios','아이폰 · 아이패드 (사파리)','공유 버튼'],['android','안드로이드 (크롬)','오른쪽 위 메뉴(⋮)'],['pc','컴퓨터 (크롬 · 엣지)','주소창 오른쪽 끝의 설치 아이콘']]){
    await page.locator(`#installSteps [data-t="${tab}"]`).focus();await page.keyboard.press('Enter');
    await expect(page.locator(`#installSteps [data-t="${tab}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator(`#installSteps [data-t="${tab}"]`)).toBeFocused();
    const title=page.locator('#installSteps > p').filter({hasText:heading}),body=page.locator('#installSteps > ol');
    await expect(title).toBeVisible();await expect(body).toBeVisible();await expect(body).toContainText(instruction);
    choices.push({tab,heading:await title.innerText(),body:await body.innerText(),text:await page.locator('#installSteps').innerText()});
  }
  await page.locator('#installGo').click();await expect(page.locator('#installSteps')).not.toHaveClass(/show/);
  await page.locator('#installGo').click();await expect(page.locator('#installSteps')).toHaveClass(/show/);
  await page.locator('#installX').click();await expect(page.locator('#btnSettings')).toBeFocused();
  expect(await page.evaluate(()=>localStorage.getItem(KEY==='sgg_game_save_v1'?GAME_EDITION.installDismissed:'sgg_install_dismissed'))).toBe('1');
  await settings(page);await page.locator('#btnInstall').click();await expect(page.locator('#installSteps')).toHaveClass(/show/);await expect(page.locator('#installGo')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#btnSettings')).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');expect(await state(page)).toEqual(before);
  if(await page.evaluate(()=>KEY==='sgg_game_save_v1'))expect(await page.evaluate(()=>Object.fromEntries(['sgg_installed','sgg_install_dismissed'].map(k=>[k,localStorage.getItem(k)])))).toEqual(educationBefore);
  await capture(info,'install-guides',{before,after:await state(page),choices,closed:await page.evaluate(()=>({stack:dialogStack.map(row=>row.el.id),focus:document.activeElement.id}))});
});
