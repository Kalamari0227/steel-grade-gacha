import {test,expect} from '@playwright/test';
import {appURL,root} from '../helpers/paths.mjs';
import {openApp,state,capture} from '../helpers/app.mjs';
import {storageEvidence} from '../helpers/storage-evidence.mjs';
import {activate,route,tab,key,trap,shot,geometry,reachable,doubleText,focusPaint} from './accessibility-helpers.mjs';
import fs from 'node:fs/promises';
process.env.SGG_EDITION='game';storageEvidence(test);
const sizes=[{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1280,height:900}];
const errors=new WeakMap();
test.beforeEach(async({page})=>{errors.set(page,[]);page.on('pageerror',e=>errors.get(page).push(e.message));await page.addInitScript(()=>{window.a34ReducedAPI=[];const original=Element.prototype.animate;Element.prototype.animate=function(...args){if(matchMedia('(prefers-reduced-motion: reduce)').matches)a34ReducedAPI.push({id:this.id,class:this.className,options:args[1]});return original.apply(this,args);};});});
test.afterEach(async({page},info)=>{await capture(info,'keys-errors',{keys:await page.evaluate(()=>window.a34Keys||[]),errors:errors.get(page),lastGeometry:await page.evaluate(()=>window.a34LastGeometry),fontProof:await page.evaluate(()=>window.a34FontProof)});expect(errors.get(page)).toEqual([]);expect(await page.evaluate(()=>window.a34ReducedAPI||[])).toEqual([]);});
async function boot(page,fixture='crafting-ready'){await openApp(page,appURL,fixture);await activate(page,page.getByRole('button',{name:'무음으로 계속',exact:true}),'Space');}
async function close(page,trigger){await key(page,'Escape');if(trigger)await expect(page.locator(trigger)).toBeFocused();}
async function settings(page){await activate(page,page.locator('#btnSettings'));}

for(const viewport of [...sizes,{width:360,height:800,text200:true},{width:360,height:450},{width:640,height:450}])test.describe(`matrix ${viewport.width}x${viewport.height}${viewport.text200?' text200':''}`,()=>{test.use({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:viewport.width===640?2:1});test('all routes dialogs and keyboard cycles',async({page},info)=>{
 // Given: actual packaged game and an isolated established inventory.
 await page.emulateMedia({reducedMotion:'reduce'});await boot(page);if(viewport.text200){await page.evaluate(()=>window.a34Scale=true);await capture(info,'text200-initial',await doubleText(page));}
 // When: navigate all five routes and each modal through native keyboard events.
 for(const name of ['workshop','dex','craft','research','garage']){await route(page,name);expect(await page.locator('.destination-nav [aria-current=page]').evaluate(e=>getComputedStyle(e,'::after').content)).toContain('✓');await shot(page,info,name);await settings(page);if(name==='workshop')await trap(page,info,'settingsModal');else await shot(page,info,name+'-settings');await close(page,'#btnSettings');}
 await settings(page);
 for(const [trigger,modal]of [['settingsNotice','noticeModal'],['settingsPromo','promoModal']]){await activate(page,page.locator('#'+trigger));await trap(page,info,modal);await close(page,'#'+trigger);}
 await activate(page,page.locator('#btnBackup'));await trap(page,info,'backupModal');const before=await state(page);
 await activate(page,page.locator('#bkIn'));await page.keyboard.type('SGG-GAME1.invalid');await activate(page,page.locator('#bkLoad'));await expect(page.locator('#bkRes')).not.toBeEmpty();await shot(page,info,'backup-error');expect(await state(page)).toEqual(before);
 const code=await page.locator('#bkOut').inputValue();await tab(page,page.locator('#bkIn'));await page.keyboard.press('Meta+A');await page.keyboard.insertText(code);await activate(page,page.locator('#bkLoad'));await expect(page.locator('#bkPreview')).toBeVisible();await trap(page,info,'backupModal');await activate(page,page.locator('#bkCancel'),'Space');expect(await state(page)).toEqual(before);await activate(page,page.locator('#bkLoad'));const expectedRestore=await page.evaluate(code=>Object.assign({},S,GAME_BACKUP.read(code,'game',backupCatalog()).progress),code);await activate(page,page.locator('#bkConfirm'),'Space');await expect(page.locator('#bkRecoverySaved')).toBeVisible();await trap(page,info,'backupModal');expect(await state(page)).toEqual(expectedRestore);await close(page,'#btnBackup');await close(page,'#btnSettings');
 await settings(page);await activate(page,page.locator('#btnInstall'));await trap(page,info,'installBar');await activate(page,page.locator('#installX'),'Space');await expect(page.locator('#btnSettings')).toBeFocused();
 await route(page,'dex');await activate(page,page.locator('#dex [data-card-id="poo-PHS"]'));await trap(page,info,'cardModal');await activate(page,page.locator('#cardFlip'),'Space');await expect(page.locator('[data-card-side="1"]')).toHaveAttribute('aria-pressed','true');await shot(page,info,'card-alt');await close(page,'#dex [data-card-id="poo-PHS"]');
 await activate(page,page.locator('#dexModeGallery'),'Space');expect(await page.locator('#dexModeGallery').evaluate(e=>getComputedStyle(e,'::before').content)).toContain('✓');await tab(page,page.locator('#galleryStage'));const first=await page.locator('#dexGallery').getAttribute('data-card-id');await key(page,'ArrowRight');const next=await page.locator('#dexGallery').getAttribute('data-card-id');expect(next).not.toBe(first);await activate(page,page.locator('#galleryPrev'),'Space');await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id',first);const staticGallery=await page.evaluate(()=>({waapi:a34ReducedAPI,running:document.getAnimations().filter(a=>a.playState==='running').length,transform:getComputedStyle(document.getElementById('galleryArt')).transform}));expect(staticGallery).toEqual({waapi:[],running:0,transform:'none'});await capture(info,'reduced-gallery',staticGallery);await shot(page,info,'gallery-alternative');
 await route(page,'craft');await activate(page,page.locator('#parts [data-part-key="bpillar"]'));await trap(page,info,'partModal');await activate(page,page.locator('#craftBack'),'Space');
 await route(page,'research');await activate(page,page.locator('#researchQPButton'));await trap(page,info,'partModal');await activate(page,page.locator('#qpBack'),'Space');
 await activate(page,page.locator('#btnQuiz'));if(viewport.text200||viewport.height===450)await page.evaluate(()=>{qState.qs[0]=shuffleQ(QUIZ.reduce((a,b)=>a.e.length>b.e.length?a:b));renderQ();});await trap(page,info,'quizModal');const answer=await page.evaluate(()=>qState.qs[qState.i].a);await activate(page,page.locator('#opts button').nth(answer),'Space');await expect(page.locator('#qNext')).toBeFocused();await trap(page,info,'quizModal');await close(page,'#btnQuiz');
 await activate(page,page.locator('#btnOrder'));await trap(page,info,'pickModal');const demand=await page.evaluate(()=>S.orderKey);await activate(page,page.locator(`[data-choice="${demand}"]`),'Space');await trap(page,info,'pickModal');await activate(page,page.locator('#pkEquip'));await trap(page,info,'pickModal');await activate(page,page.locator('[data-equip-id]').first());await trap(page,info,'pickModal');await activate(page,page.locator('[data-equipment-mode="before"]'),'Space');await expect(page.locator('[data-equipment-mode="before"]')).toHaveAttribute('aria-pressed','true');expect(await page.locator('[data-equipment-mode="before"]').evaluate(e=>getComputedStyle(e,'::before').content)).toContain('✓');await activate(page,page.locator('[data-equipment-mode="preview"]'));await activate(page,page.locator('#equipCancel'),'Space');
 await activate(page,page.locator('#btnToon'));await trap(page,info,'toonModal');await activate(page,page.locator('#toonBox [data-i="0"]'));await trap(page,info,'toonView');await activate(page,page.locator('#toonScroll [data-go="list"]'),'Space');await expect(page.locator('#toonBox [data-i="0"]')).toBeFocused();await close(page,'#btnToon');
 await route(page,'garage');await page.goBack();await expect(page).toHaveURL(/#research$/);await page.goForward();await expect(page).toHaveURL(/#garage$/);
 // Then: no retained modal, background lock, or hidden keyboard destination.
 expect(await page.evaluate(()=>({stack:dialogStack.length,locked:document.body.style.overflow,inert:document.getElementById('appShell').inert}))).toEqual({stack:0,locked:'',inert:false});if(viewport.text200)await capture(info,'text200-final-newnodes',await doubleText(page));await capture(info,'complete-matrix',{viewport,geometry:await geometry(page)});
});});

for(const viewport of [...sizes,{width:360,height:450},{width:640,height:450}])test.describe(`garage ${viewport.width}x${viewport.height}`,()=>{
 test.use({viewport,deviceScaleFactor:viewport.width===640?2:1});
 test('keyboard selection cancellation completion and owned car detail',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await boot(page,'all-parts');await route(page,'garage');const before=await state(page);await activate(page,page.locator('#carBox .garage-option').first());await tab(page,page.locator('#cancelCar'));await shot(page,info,'car-choice');await key(page,'Space');expect(await state(page)).toEqual(before);
  await activate(page,page.locator('#carBox .garage-option').first());await activate(page,page.locator('#takeCar'));await expect(page.locator('#garageStageTitle')).toBeFocused();const instantFocus=await page.locator('#garageStageTitle').evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),navTop:document.querySelector('.destination-nav').getBoundingClientRect().top,scrollY}));expect(instantFocus.rect.top).toBeGreaterThanOrEqual(0);expect(instantFocus.rect.bottom).toBeLessThanOrEqual(instantFocus.navTop);await capture(info,'instant-garage-focus',instantFocus);await shot(page,info,'car-complete');const after=await state(page);expect(after.cars.length).toBe(before.cars.length+1);expect(after.parts).toEqual({});await activate(page,page.locator('#garage .owned[data-car-key]').first());await trap(page,info,'partModal');await close(page);expect(await state(page)).toEqual(after);await capture(info,'car-once',{before,after});
 });
});

test('malformed backup error identifies its input without changing progress',async({page},info)=>{
 await boot(page);await settings(page);await activate(page,page.locator('#btnBackup'));const before=await state(page);await tab(page,page.locator('#bkIn'));await page.keyboard.insertText('SGG-GAME1.<img src=x onerror="window.injected=true">');await activate(page,page.locator('#bkLoad'));await shot(page,info,'malformed-error');await expect(page.locator('#bkIn')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#bkIn')).toHaveAttribute('aria-describedby',/bkRes/);await expect(page.locator('#bkOut')).toHaveAccessibleName('내 백업 코드');expect(await page.evaluate(()=>!!window.injected)).toBe(false);expect(await state(page)).toEqual(before);await close(page,'#btnBackup');
 await activate(page,page.locator('#btnBackup'));const valid=await page.locator('#bkOut').inputValue();await tab(page,page.locator('#bkIn'));await page.keyboard.insertText(valid);await activate(page,page.locator('#bkLoad'));await expect(page.locator('#bkPreview')).toBeVisible();await page.evaluate(()=>{S.scrap++;save();refresh();});const stale=await state(page);await activate(page,page.locator('#bkConfirm'),'Space');await expect(page.locator('#bkRes')).toContainText('다시 미리보기');expect(await state(page)).toEqual(stale);await shot(page,info,'stale-backup-confirmation');await close(page,'#btnBackup');await close(page,'#btnSettings');
 // An actual toast timeout must not remove the native keyboard's focused dismiss control.
 await page.evaluate(()=>showToast('키보드로 닫을 수 있는 알림','알림'));await tab(page,page.locator('#toastX'));await focusPaint(page,info,'toast-before-expiry');await page.waitForTimeout(12050);await expect(page.locator('#toast')).toHaveClass(/show/);await expect(page.locator('#toastX')).toBeFocused();await reachable(page.locator('#toastX'));await focusPaint(page,info,'toast-after-expiry');await key(page,'Space');await expect(page.locator('#toast')).not.toHaveClass(/show/);await expect(page.locator('#btnSettings')).toBeFocused();expect(await state(page)).toEqual(stale);await capture(info,'toast-focused-expiry',{deadlineMs:12000,observedAfterMs:12050,focus:await page.locator(':focus').getAttribute('id')});
});

async function toastExpiryReady(page){
 await page.setViewportSize({width:360,height:800});
 await page.emulateMedia({reducedMotion:'reduce'});
 await boot(page);await captureToastTimer(page);await page.evaluate(()=>showToast('도감 맨 끝에 새 칸이 생겼습니다.','선행개발 과제가 열렸습니다'));await page.locator('.destination-nav a[href="#dex"]').click();await doubleText(page);
 await page.locator('#btnSettings').click();await page.locator('#btnBackup').click();
 const code=await page.locator('#bkOut').inputValue();await page.locator('#bkIn').fill(code);await page.locator('#bkLoad').click();await page.locator('#bkConfirm').click();
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('.destination-nav a[href="#dex"]').click();await doubleText(page);
 await page.evaluate(()=>{const timer=a34ToastTimers.find(t=>t.id===showToast.t);if(!timer)throw Error('Missing original toast expiry');clearTimeout(timer.id);window.a34ExpireToast=()=>Reflect.apply(timer.fn,window,timer.args);});
 await tab(page,page.locator('#dexClear'));
}
async function captureToastTimer(page){
 await page.evaluate(()=>{window.a34ToastTimers=[];const original=window.setTimeout;window.setTimeout=function(fn,ms,...args){const id=Reflect.apply(original,this,[fn,ms,...args]);if(ms===12000&&typeof fn==='function')a34ToastTimers.push({id,fn,args});return id;};});
}
test('toast expiry during native keyboard focus keeps the destination card visible',async({page},info)=>{
 for(const timing of ['hold','before-key','keydown-before-frame','sync-focus','microtask-focus','nexttask-focus']){
  await toastExpiryReady(page);const before=await page.evaluate(()=>({scrollY,toast:toast.className,card:document.querySelector('#dex [data-card-id="poo-270C"]').getBoundingClientRect().toJSON()}));
  await page.evaluate(async timing=>{window.a34Frontier=[];
   if(timing==='before-key'){a34ExpireToast();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));a34Frontier.push('expiry-frame-complete');}
   if(timing==='keydown-before-frame')document.addEventListener('keydown',function expireOnTab(event){if(event.key!=='Tab')return;document.removeEventListener('keydown',expireOnTab,true);a34ExpireToast();a34Frontier.push('expiry-in-keydown');requestAnimationFrame(()=>a34Frontier.push('expiry-frame-complete'));},true);
   document.addEventListener('focusin',function expireOnCard(event){if(!event.target.matches('#dex [data-card-id="poo-270C"]'))return;document.removeEventListener('focusin',expireOnCard,true);a34Frontier.push('native-card-focus');if(timing==='sync-focus')a34ExpireToast();if(timing==='microtask-focus')queueMicrotask(a34ExpireToast);if(timing==='nexttask-focus')setTimeout(a34ExpireToast,0);},true);},timing);
  await page.keyboard.press(process.platform==='darwin'&&page.context().browser().browserType().name()==='webkit'?'Alt+Tab':'Tab');
  const card=page.locator('#dex [data-card-id="poo-270C"]');await expect(card).toBeFocused();
  if(timing!=='hold')await expect(page.locator('#toast')).not.toHaveClass(/show/);
  const after=await reachable(card);expect(after.focusVisible).toBe(true);expect(Object.values(after.outlineClip).every(Boolean)).toBe(true);
  await shot(page,info,'toast-expiry-'+timing);await focusPaint(page,info,'toast-expiry-'+timing+'-ring');
  const frontier=await page.evaluate(()=>a34Frontier);
  if(timing==='before-key')expect(frontier).toEqual(['expiry-frame-complete','native-card-focus']);
  if(timing==='keydown-before-frame')expect(frontier).toEqual(['expiry-in-keydown','native-card-focus','expiry-frame-complete']);
  await capture(info,'toast-expiry-'+timing,{timing,frontier,before,after,scrollY:await page.evaluate(()=>scrollY)});
 }
});
test('toast expiry cannot reveal a stale or modal-owned destination',async({page},info)=>{
 for(const transition of ['visible','route','modal','disconnected','hidden','inert']){
  await toastExpiryReady(page);
  if(transition==='visible'){await page.keyboard.press(process.platform==='darwin'&&page.context().browser().browserType().name()==='webkit'?'Alt+Shift+Tab':'Shift+Tab');await expect(page.locator('#dexStock')).toBeFocused();}
  const result=await page.evaluate(async transition=>{
   const target=document.activeElement,original=Element.prototype.scrollIntoView,calls=[];Element.prototype.scrollIntoView=function(...args){calls.push(this===target?'expired-target':this.id);return Reflect.apply(original,this,args);};
   const beforeRect=target.getBoundingClientRect().toJSON(),navTop=document.querySelector('.destination-nav').getBoundingClientRect().top,style=getComputedStyle(target),outline=parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset);
   a34ExpireToast();
   if(transition==='route')document.querySelector('.destination-nav a[href="#research"]').click();
   if(transition==='modal')document.getElementById('btnSettings').click();
   if(transition==='disconnected')target.remove();
   if(transition==='hidden')target.hidden=true;
   if(transition==='inert')target.inert=true;
   const focus=document.activeElement,scroll=scrollY;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   Element.prototype.scrollIntoView=original;
   return {transition,beforeRect,navTop,outline,calls,sameFocus:focus===document.activeElement,focusCleared:document.activeElement===document.body,focus:document.activeElement.id,scrollBefore:scroll,scrollAfter:scrollY,stack:dialogStack.map(e=>e.el.id),route:document.body.dataset.route};
  },transition);
  await capture(info,'toast-expiry-guard-'+transition,result);expect(result.calls).not.toContain('expired-target');expect(result.sameFocus||(!['route','modal'].includes(transition)&&result.focusCleared)).toBe(true);
  if(transition==='visible'){expect(result.beforeRect.top).toBeGreaterThanOrEqual(result.outline);expect(result.beforeRect.bottom+result.outline).toBeLessThanOrEqual(result.navTop);expect(result.scrollAfter).toBe(result.scrollBefore);await reachable(page.locator('#dexStock'));}
  if(transition==='route'){expect(result.route).toBe('research');expect(result.focus).toBe('title-research');}
  if(transition==='modal'){expect(result.stack).toEqual(['settingsModal']);expect(await page.locator('#appShell').evaluate(e=>e.inert)).toBe(true);}
 }
});

test('multilayer image error remains keyboard reachable while each layer recovers',async({page},info)=>{
 await boot(page);await route(page,'dex');const urls=await page.evaluate(()=>{const face=GAME_CONFIG.faces.find(f=>f.cardId==='poo-PHS'&&f.side==='front');return [face.background,face.character].map(id=>GAME_CONFIG.assets[id].url);});
 for(const url of urls)await page.route('**/'+url,r=>r.abort());await activate(page,page.locator('#dex [data-card-id="poo-PHS"]'));await expect(page.locator('#materialArt [data-status="error"]')).toHaveCount(2);const before=await state(page);
 for(const [index,layer]of ['background','character'].entries()){const retry=page.locator(`#materialArt .game-card-${layer} .game-card-fallback button`);await tab(page,retry);await shot(page,info,'error-focus-'+layer);await focusPaint(page,info,'error-'+layer);await page.unroute('**/'+urls[index]);await key(page,index?'Space':'Enter');await expect(page.locator('#materialArt [data-status="error"]')).toHaveCount(1-index);}
 await expect(page.locator('#cardArtStatus')).toHaveText('');await shot(page,info,'error-recovered');await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.getElementById('cardFlip').addEventListener('click',()=>window.a34FlipImmediate={side:cardBox.dataset.side,transform:getComputedStyle(document.getElementById('materialArt')).transform,running:document.getAnimations().filter(a=>a.playState==='running').length}));await activate(page,page.locator('#cardFlip'),'Space');expect(await page.evaluate(()=>a34FlipImmediate)).toEqual({side:'alt',transform:'none',running:0});await page.waitForFunction(()=>document.querySelector('#materialArt .game-card').getAttribute('aria-busy')==='false');await page.locator('#materialArt').hover();const bounds=await page.locator('#materialArt').boundingBox();await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.2);await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.8);const staticCard=await page.locator('#materialArt').evaluate(e=>({transform:getComputedStyle(e).transform,glareDisplay:getComputedStyle(e,'::after').display,waapi:a34ReducedAPI,running:document.getAnimations().filter(a=>a.playState==='running').length}));expect(staticCard).toEqual({transform:'none',glareDisplay:'none',waapi:[],running:0});await capture(info,'reduced-flip-and-actual-pointer-tilt',staticCard);await close(page,'#dex [data-card-id="poo-PHS"]');expect(await state(page)).toEqual(before);
});

for(const viewport of sizes)test(`draw single and ten keyboard results ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});await boot(page,'mid-progress');
 for(const [button,count]of [['btnPull',1],['btnTen',10]]){await tab(page,page.locator('#'+button));await focusPaint(page,info,button+'-trigger');await key(page,'Space');await expect(page.locator('[data-result-id]')).toHaveCount(count);await shot(page,info,'draw-'+count);for(const detail of await page.locator('[data-draw-detail],.tc').all())await tab(page,detail);await activate(page,page.locator('[data-draw-close]'),'Space');await expect(page.locator(await page.locator('#'+button).isEnabled()?'#'+button:'#title-workshop')).toBeFocused();}
});

for(const action of ['single','ten','exchange','qp','equip','craft','car'])test(`normal skip reduced preserve one ${action} outcome`,async({page},info)=>{
 const results=[];
 await page.addInitScript(()=>{window.a34Effects=[];window.a34Smooth=[];const animate=Element.prototype.animate;Element.prototype.animate=function(...args){a34Effects.push(args[1]);return animate.apply(this,args);};for(const [owner,name]of [[window,'scrollTo'],[Element.prototype,'scrollTo'],[Element.prototype,'scrollIntoView']]){const original=owner[name];owner[name]=function(...args){if(args.some(a=>a?.behavior==='smooth'))a34Smooth.push({name,args});return original.apply(this,args);};}});
 for(const mode of ['normal','skip','reduce']){
  await page.emulateMedia({reducedMotion:mode==='reduce'?'reduce':'no-preference'});await boot(page,action==='car'?'all-parts':action==='qp'?'qp-ready':['craft','equip'].includes(action)?'crafting-ready':'mid-progress');
  let selector;
  if(['single','ten','exchange'].includes(action))selector={single:'#btnPull',ten:'#btnTen',exchange:'#btnScrap3'}[action];
  if(action==='exchange')await page.locator('.destination-nav a[href="#craft"]').click();
  if(action==='qp'){await page.locator('.destination-nav a[href="#research"]').click();await page.locator('#researchQPButton').click();selector='#devBtn';}
  if(action==='craft'){await page.locator('.destination-nav a[href="#craft"]').click();await page.locator('#parts [data-part-key="bpillar"]').click();selector='#mkBtn';}
  if(action==='car'){await page.locator('.destination-nav a[href="#garage"]').click();await page.locator('.garage-option[data-k="t"]').click();selector='#takeCar';}
  if(action==='equip'){await page.locator('.destination-nav a[href="#research"]').click();await page.locator('#btnOrder').click();const demand=await page.evaluate(()=>S.orderKey);await page.locator(`[data-choice="${demand}"]`).click();await page.locator('#pkEquip').click();await page.locator('[data-equip-id]').first().click();selector='#equipConfirm';}
  if(action==='exchange'&&mode==='reduce')for(const id of ['btnScrap3','btnScrap4']){await tab(page,page.locator('#'+id));await focusPaint(page,info,id+'-trigger');}
  await page.evaluate(()=>{window.a34Saves=0;const original=save;save=function(){a34Saves++;return original();};window.a34Effects=[];window.a34Smooth=[];});const before=await state(page);
  const immediate=await page.locator(selector).evaluate(button=>{button.click();return {draw:GAME_DRAW.snapshot(),craft:GAME_CRAFTING.snapshot(),car:GAME_GARAGE.snapshot(),results:[...document.querySelectorAll('[data-result-id]')].map(e=>({id:e.dataset.resultId,text:e.textContent})),craftText:document.getElementById('craftStatus')?.textContent,carText:document.getElementById('garageStageTitle')?.textContent,equipText:document.getElementById('pkres')?.textContent,saves:a34Saves,state:JSON.parse(JSON.stringify(S))};});
  if(mode==='reduce'){for(const key of ['draw','craft','car']){expect(immediate[key].pendingTimerCount).toBe(0);expect(immediate[key].busy).toBe(false);}if(['single','ten','exchange','qp'].includes(action)){expect(immediate.draw.phase).toBe('ready');expect(immediate.results.length).toBe(action==='ten'?10:1);expect(immediate.results.every(r=>r.text.trim())).toBe(true);}if(action==='craft')expect(immediate.craft.phase).toBe('complete');if(action==='car')expect(immediate.car.phase).toBe('complete');}
  if(mode==='skip'){const skip=page.locator('[data-draw-skip]:visible,[data-craft-skip]:visible,[data-garage-skip]:visible');if(await skip.count())await skip.first().click();}
  await page.waitForFunction(()=>!GAME_DRAW.snapshot().busy&&!GAME_CRAFTING.snapshot().busy&&!GAME_GARAGE.snapshot().busy);const outcome=await page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:JSON.parse(localStorage.getItem(KEY)),saves:a34Saves,draw:GAME_DRAW.snapshot(),craft:GAME_CRAFTING.snapshot(),car:GAME_GARAGE.snapshot()}));expect(outcome.saves).toBe(1);expect(outcome.saved).toEqual(outcome.state);expect(outcome.state).toEqual(immediate.state);
  if(mode==='reduce'){await page.mouse.move(30,30);await page.mouse.move(300,400);const motion=await page.evaluate(()=>{const bad=[];for(const e of document.querySelectorAll('body *')){if(!e.getClientRects().length||e.closest('[hidden],[inert]'))continue;for(const pseudo of [null,'::before','::after']){const s=getComputedStyle(e,pseudo);if(pseudo&&['none','normal'].includes(s.content))continue;if((s.animationName!=='none'&&s.animationDuration.split(',').some(v=>parseFloat(v)>0))||s.transitionDuration.split(',').some(v=>parseFloat(v)>0))bad.push({tag:e.tagName,id:e.id,pseudo,animation:s.animation,transition:s.transition});}}return {bad,waapi:a34Effects,smooth:a34Smooth,running:document.getAnimations().filter(a=>a.playState==='running').length,tilt:[...document.querySelectorAll('.material-art,.game-card,.gallery-card')].filter(e=>e.getClientRects().length).map(e=>({class:e.className,transform:getComputedStyle(e).transform}))};});expect(motion.bad).toEqual([]);expect(motion.waapi).toEqual([]);expect(motion.smooth).toEqual([]);expect(motion.running).toBe(0);expect(motion.tilt.every(e=>e.transform==='none')).toBe(true);await capture(info,'reduced-motion-'+action,motion);}
  await shot(page,info,mode+'-'+action);results.push({mode,before,immediate,outcome});await page.keyboard.press('Escape');if(await page.locator('[data-draw-close]:visible').count())await page.locator('[data-draw-close]').click();await page.waitForTimeout(50);expect(await state(page)).toEqual(outcome.state);expect(await page.evaluate(()=>a34Saves)).toBe(1);
 }
 expect(results[1].outcome.state).toEqual(results[0].outcome.state);expect(results[2].outcome.state).toEqual(results[0].outcome.state);await capture(info,'equivalent-'+action,results);
});

test('dialog return preserves later wheel and programmatic scrolling while retaining focus clearance',async({page},info)=>{
 for(const reducedMotion of ['no-preference','reduce'])for(const action of ['wheel','programmatic','no-later-scroll']){
  await page.emulateMedia({reducedMotion});await boot(page,'qp-owned');await route(page,'dex');
  const previous=page.locator('#dex [data-card-id="ga-780Y"]'),next=page.locator('#dex [data-card-id="ga-340W"]');
  await previous.scrollIntoViewIfNeeded({timeout:5000});await previous.click({timeout:5000});
  await page.waitForFunction(()=>{const modal=document.getElementById('cardModal'),img=document.querySelector('#cardBox .game-card-character img');return modal&&img&&getComputedStyle(modal).opacity==='1'&&getComputedStyle(img).opacity==='1'&&modal.getAnimations({subtree:true}).every(animation=>animation.playState==='finished');},null,{timeout:5000});
  if(action==='no-later-scroll')await page.evaluate(()=>{const target=document.querySelector('#dex [data-card-id="ga-780Y"]'),r=target.getBoundingClientRect(),nav=document.querySelector('.destination-nav').getBoundingClientRect();window.scrollTo(0,scrollY+r.top-(nav.top-r.height/2));});
  await page.evaluate(()=>{
   const original=window.revealRouteFocus,trigger=document.querySelector('#dex [data-card-id="ga-780Y"]'),modal=document.getElementById('cardModal'),route='dex';
   let pending=null,phase='draining',escape=null,restoreFocus=null,barrierReady=false,framesReady=false;
   const errors=[],wheel=[],barrier=[],frames=[];
   const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
   function geometry(id){const el=document.querySelector(`#dex [data-card-id="${id}"]`),r=rect(el),style=getComputedStyle(el),outline=Math.max(0,parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset)),nav=document.querySelector('.destination-nav').getBoundingClientRect(),bottom=Math.min(innerHeight,nav.top);return {rect:r,inViewport:r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth,focusVisible:el.matches(':focus-visible'),outline,outlineClear:r.top>=outline&&r.bottom<=bottom-outline&&r.left>=outline&&r.right<=innerWidth-outline,connected:el.isConnected,hasRects:el.getClientRects().length>0,hiddenOrInert:!!el.closest('[hidden],[inert]'),destination:el.closest('.destination')?.id};}
   function sample(){return {time:performance.now(),root:{x:scrollX,y:scrollY},viewport:{width:innerWidth,height:innerHeight},nav:rect(document.querySelector('.destination-nav')),active:document.activeElement.dataset.cardId,route:document.body.dataset.route,dialogCount:dialogStack.length,modalShown:modal.classList.contains('show'),previous:geometry('ga-780Y'),next:geometry('ga-340W'),wheel:[...wheel],errors:[...errors]};}
   function modalOwnsFocus(){return modal.classList.contains('show')&&dialogStack.at(-1)?.el===modal&&modal.contains(document.activeElement)&&document.body.dataset.route===route;}
   function restoredTargetEligible(){const state=sample();return !state.modalShown&&state.dialogCount===0&&document.activeElement===trigger&&state.route===route&&state.previous.connected&&state.previous.hasRects&&!state.previous.hiddenOrInert&&state.previous.focusVisible&&state.previous.destination==='view-dex';}
   function keydown(event){if(phase!=='armed'||event.key!=='Escape')return;if(escape||!event.isTrusted||!modalOwnsFocus()){errors.push('Ambiguous Escape or modal ownership');return;}escape={time:performance.now(),isTrusted:event.isTrusted,modalOwnedFocus:true};}
   function focusin(event){if(phase!=='armed'||event.target!==trigger)return;if(!escape||restoreFocus||!restoredTargetEligible()){errors.push('Ambiguous dialog-return focus boundary');return;}restoreFocus={time:performance.now(),state:sample()};}
   function recordWheel(event){wheel.push({isTrusted:event.isTrusted,deltaX:event.deltaX,deltaY:event.deltaY});}
   document.addEventListener('keydown',keydown,true);document.addEventListener('focusin',focusin,true);document.addEventListener('wheel',recordWheel,{capture:true,passive:true});
   window.revealRouteFocus=function(...args){
    if(args[0]===trigger&&args[1]===route&&phase!=='draining'){
     if(phase==='armed'&&escape&&restoreFocus&&restoredTargetEligible()&&!pending){pending={thisArg:this,args};phase='held';return;}
     errors.push('Matching reveal outside the single observed Escape-return boundary');
    }
    return Reflect.apply(original,this,args);
   };
   window.__dialogReturnProbe={get held(){return phase==='held'&&!!pending;},get barrierReady(){return barrierReady;},get framesReady(){return framesReady;},get errors(){return errors;},arm(){if(!barrierReady||errors.length||!modalOwnsFocus())throw Error('Prior frame/modal boundary incomplete');phase='armed';},release(){if(phase!=='held'||!pending||errors.length)throw Error('Missing or ambiguous dialog-return callback');const call=pending;pending=null;phase='released';return Reflect.apply(original,call.thisArg,call.args);},sample,startFrames(){function frame(){frames.push(sample());if(frames.length===3)framesReady=true;else requestAnimationFrame(frame);}requestAnimationFrame(frame);},evidence(){return {escape,restoreFocus,barrier,frames,errors:[...errors]};},restore(){window.revealRouteFocus=original;document.removeEventListener('keydown',keydown,true);document.removeEventListener('focusin',focusin,true);document.removeEventListener('wheel',recordWheel,true);}};
   requestAnimationFrame(()=>{barrier.push({time:performance.now(),modalOwnedFocus:modalOwnsFocus()});if(!modalOwnsFocus())errors.push('Modal ownership lost in prior-frame barrier');requestAnimationFrame(()=>{barrier.push({time:performance.now(),modalOwnedFocus:modalOwnsFocus()});if(!modalOwnsFocus())errors.push('Modal ownership lost before arm');barrierReady=true;});});
  });
  try{
   await page.waitForFunction(()=>__dialogReturnProbe.barrierReady||__dialogReturnProbe.errors.length,null,{timeout:5000});
   expect(await page.evaluate(()=>__dialogReturnProbe.errors)).toEqual([]);await page.evaluate(()=>__dialogReturnProbe.arm());
   await page.keyboard.press('Escape');await page.waitForFunction(()=>__dialogReturnProbe.held||__dialogReturnProbe.errors.length,null,{timeout:5000});
   expect(await page.evaluate(()=>__dialogReturnProbe.errors)).toEqual([]);await expect(page.locator('#cardModal')).toBeHidden();await expect(previous).toBeFocused();
   const before=await page.evaluate(()=>__dialogReturnProbe.sample());
   if(action!=='no-later-scroll'){
    expect(before.next.inViewport).toBe(false);expect(before.previous.outlineClear).toBe(true);
    const delta=before.next.rect.top+before.next.rect.height/2-before.viewport.height/2;expect(delta).not.toBe(0);
    if(action==='wheel'){
     await page.mouse.wheel(0,delta);
     await page.waitForFunction(y=>__dialogReturnProbe.sample().wheel.some(event=>event.isTrusted)&&scrollY!==y,before.root.y,{timeout:5000});
    }else await next.scrollIntoViewIfNeeded({timeout:5000});
   }
   const requested=await page.evaluate(()=>__dialogReturnProbe.sample());
   expect(requested.errors).toEqual([]);expect(requested.active).toBe('ga-780Y');expect(requested.route).toBe('dex');expect(requested.modalShown).toBe(false);expect(requested.dialogCount).toBe(0);
   expect(requested.previous.connected).toBe(true);expect(requested.previous.hasRects).toBe(true);expect(requested.previous.hiddenOrInert).toBe(false);expect(requested.previous.focusVisible).toBe(true);expect(requested.previous.destination).toBe('view-dex');
   expect(requested.previous.outlineClear).toBe(false);
   expect(requested.previous.rect.top<requested.previous.outline||requested.previous.rect.bottom+requested.previous.outline>Math.min(requested.viewport.height,requested.nav.top)).toBe(true);
   if(action!=='no-later-scroll'){expect(requested.root.y).not.toBe(before.root.y);expect(requested.next.inViewport).toBe(true);}
   else{expect(requested.root).toEqual(before.root);expect(requested.previous.rect.bottom+requested.previous.outline).toBeGreaterThan(requested.nav.top);}
   await page.evaluate(()=>{__dialogReturnProbe.release();__dialogReturnProbe.startFrames();});
   await page.waitForFunction(()=>__dialogReturnProbe.framesReady||__dialogReturnProbe.errors.length,null,{timeout:5000});
   const evidence=await page.evaluate(()=>__dialogReturnProbe.evidence());expect(evidence.errors).toEqual([]);
   for(const frame of evidence.frames){
    expect(frame.active).toBe('ga-780Y');expect(frame.previous.focusVisible).toBe(true);
    if(action!=='no-later-scroll'){expect(frame.root).toEqual(requested.root);expect(frame.next.inViewport).toBe(true);}
    else{expect(frame.previous.outlineClear).toBe(true);expect(frame.previous.rect.top).toBeGreaterThanOrEqual(frame.previous.outline);expect(frame.previous.rect.bottom+frame.previous.outline).toBeLessThanOrEqual(Math.min(frame.viewport.height,frame.nav.top));}
   }
   const name=`dialog-return-${reducedMotion}-${action}`;await page.screenshot({path:info.outputPath(name+'.png'),timeout:5000});await capture(info,name,{reducedMotion,action,before,requested,...evidence});
  }finally{await page.evaluate(()=>window.__dialogReturnProbe?.restore());}
 }
});
