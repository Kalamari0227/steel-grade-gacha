import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,root} from '../helpers/paths.mjs';
import {openApp,capture,destination} from '../helpers/app.mjs';
process.env.SGG_EDITION='game';
const oracle=JSON.parse(await fs.readFile(root+'/tests/fixtures/catalog.json','utf8'));
const snapshot=page=>page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY)}));
async function open(page,fixture='qp-owned'){
 const served=await openApp(page,appURL,fixture);await page.getByRole('button',{name:'무음으로 계속',exact:true}).click();await destination(page,'dex');return served;
}
async function ready(page){await expect(page.locator('#galleryArt [data-status="loading"]')).toHaveCount(0);}
async function record(page,info,name,value){await fs.mkdir(info.outputDir,{recursive:true});await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true});await capture(info,name,value);}
test('collection and card doubled text remain readable at narrow width without horizontal overflow',async({page},info)=>{
 await page.setViewportSize({width:360,height:800});await open(page);const before=await snapshot(page);await page.locator('#dexFamily').selectOption('ga');await page.locator('#dexModeGallery').click();await ready(page);
 await page.locator('.gallery-information').evaluate(root=>{const nodes=[...root.querySelectorAll('*')],sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));nodes.forEach((el,i)=>el.style.fontSize=sizes[i]*2+'px');});
 await page.locator('#galleryEquipment').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);await record(page,info,'gallery-doubled-text',{mechanism:'computed text sizes doubled once; real CSS text enlargement, not native browser zoom'});
 await page.locator('#galleryDetail').click();await page.locator('#cardModal').evaluate(root=>{const nodes=[...root.querySelectorAll('*')],sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));nodes.forEach((el,i)=>el.style.fontSize=sizes[i]*2+'px');});
 await page.locator('#cardGuarantees').scrollIntoViewIfNeeded();const geometry=await page.locator('#cardBox').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,box:el.getBoundingClientRect().toJSON(),guarantees:document.querySelector('#cardGuarantees').getBoundingClientRect().toJSON()}));expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width+1);expect(geometry.guarantees.top).toBeGreaterThanOrEqual(geometry.box.top);expect(geometry.guarantees.bottom).toBeLessThanOrEqual(geometry.box.bottom);await record(page,info,'card-doubled-text',{geometry,before});
 await page.locator('#cardX').scrollIntoViewIfNeeded();await page.locator('#cardX').focus();await page.keyboard.press('Enter');await expect(page.locator('#galleryDetail')).toBeFocused();expect(await snapshot(page)).toEqual(before);
});
test('invalid card and alt requests cannot reveal locked data or inject markup',async({page},info)=>{
 await open(page,'mid-progress');const before=await snapshot(page);
 const invalid=await page.evaluate(()=>{const invalid='<img src=x onerror="window.collectionInjected=true">';openCard(invalid);GAME_COLLECTION.select(invalid);GAME_COLLECTION.refresh();openCard('ssial-270C');setCardSide('ssial-270C',1,true);return {side:cardBox.dataset.side,id:cardBox.dataset.cardId,injected:!!window.collectionInjected};});
 expect(invalid).toEqual({side:'front',id:'ssial-270C',injected:false});await expect(page.locator('#cardFlip')).toHaveCount(0);await page.keyboard.press('Escape');await page.evaluate(()=>openCard('poo-PHS'));await expect(page.locator('#cardModal')).toBeHidden();expect(await snapshot(page)).toEqual(before);await capture(info,'negative-invalid',{invalid,before,after:await snapshot(page)});
});
test('existing equipment action returns to same alt card with current layers guarantees and focus',async({page},info)=>{
 await open(page);await page.evaluate(()=>{S.items.arrow=1;save();refresh();});await page.locator('#dex [data-card-id="ga-1470H"]').click();await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();
 await page.locator('#cardEquipmentToggle').click();await page.locator('[data-card-equipment="arrow"]').click();await page.keyboard.press('Escape');await expect(page.locator('#cardEquipmentToggle')).toBeFocused();
 const before=await snapshot(page);await page.locator('[data-card-equipment="arrow"]').click();await page.locator('#pickModal [data-equip-id="ga-1470H"]').click();expect(await snapshot(page)).toEqual(before);await page.locator("#equipConfirm").click();await page.locator('#pkDone2').click();
 await expect(page.locator('#cardEquipmentToggle')).toBeFocused();await expect(page.locator('#cardBox')).toHaveAttribute('data-side','alt');await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id','ga-1470H');
 await expect(page.locator('#materialArt [data-item="arrow"]')).toHaveCount(1);await expect(page.locator('#cardGuarantees')).toHaveText('두께 엄격재');await expect(page.locator('#cardEquipmentChoices')).toContainText('이 소재에 장착됨');await expect(page.locator('[data-card-equipment="arrow"]')).toHaveCount(0);
 const after=await snapshot(page),expected=JSON.parse(before.state);expected.items.arrow='ga-1470H';expect(JSON.parse(after.state)).toEqual(expected);expect(JSON.parse(after.saved)).toEqual(expected);await record(page,info,'equipment-return-current',{before,after});
});
test('all 45 IDs / 47 faces retain independent material oracle and real default eight layers',async({page},info)=>{
 test.setTimeout(90000);const served=await open(page),before=await snapshot(page),rows=[];
 await expect(page.locator('#secChars')).toHaveText('45 / 45');await page.locator('#dexModeGallery').click();
 for(const [index,card] of oracle.cards.entries()){
  await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id',card.id);
  for(const side of card.alt?[0,1]:[0]){
   if(side)await page.locator('[data-gallery-side="1"]').click();await ready(page);
   const spec=side?card.back:card.spec,text=side?card.alt:card;
   await expect(page.locator('#dexGallery')).toHaveAttribute('data-side',side?'alt':'front');
   await expect(page.locator('#galleryTS')).toHaveText(spec.ts+' MPa');await expect(page.locator('#galleryDuctLabel')).toHaveText(spec.ra?'단면수축률 RA':'연신율 EL');await expect(page.locator('#galleryDuct')).toHaveText((spec.ra||spec.el)+' %');
   await expect(page.locator('#galleryDescription')).toHaveText(text.t);await expect(page.locator('#galleryQuote')).toHaveText('“'+text.line+'”');
   const observed=await page.locator('#galleryArt .game-card').evaluate(el=>({id:el.dataset.cardId,side:el.dataset.side,variant:el.dataset.variant,layers:[...el.children].map(n=>n.dataset.layer),dimensions:[el.querySelector('.game-card-character img').naturalWidth,el.querySelector('.game-card-character img').naturalHeight],frame:el.querySelector('.game-card-frame [data-asset]').dataset.asset,fit:getComputedStyle(el.querySelector('.game-card-character img')).objectFit,errors:el.querySelectorAll('[data-status="error"]').length}));
   expect(observed).toEqual({id:card.id,side:side?'alt':'front',variant:'card',layers:['background','rear-equipment','plinth','character','front-equipment','frame','foil','text'],dimensions:[960,1440],frame:['poo-PHS','ga-1470H','ssial-1180Y','ga-1180Y','qp-1470'].includes(card.id)?'frame:special':'frame:standard',fit:'contain',errors:0});rows.push(observed);
  }
  if(!card.alt)await expect(page.locator('#galleryHeat')).toBeHidden();
  if(index<44)await page.locator('#galleryNext').click();
 }
 expect(rows).toHaveLength(47);await expect(page.locator('#galleryNext')).toBeDisabled();expect(await snapshot(page)).toEqual(before);await record(page,info,'happy-all-faces',{served,rows,before,after:await snapshot(page)});
});
test('all six family / LV intersections and discovery stock filters share selection across modes',async({page},info)=>{
 await open(page);const before=await snapshot(page),cases=[];
 for(const family of ['all','poo','ssial','ga','tarae','eg','qp'])for(const level of ['all','1','2','3','4','5']){
  await page.locator('#dexFamily').selectOption(family);await page.locator('#dexLevel').selectOption(level);
  const expected=oracle.cards.filter(c=>(family==='all'||c.fam===family));
  const ids=await page.evaluate(()=>allChars().filter(c=>dexMatches(c,c.fam)).map(c=>c.id));
  expect(ids.every(id=>expected.some(c=>c.id===id))).toBe(true);
  expect(await page.locator('#dex [data-card-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardId))).toEqual(ids);
  await page.locator('#dexModeGallery').click();
  if(ids.length)expect(ids).toContain(await page.locator('#dexGallery').getAttribute('data-card-id'));else await expect(page.locator('#galleryEmpty')).toBeVisible();
  await page.locator('#dexModeGrid').click();cases.push({family,level,ids});
 }
 await page.locator('#dexClear').click();await page.locator('#dex [data-card-id="ga-1470H"]').click();await page.keyboard.press('Escape');await page.locator('#dexModeGallery').click();await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id','ga-1470H');
 await page.locator('#dexModeGrid').click();await page.locator('#dexModeGallery').click();await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id','ga-1470H');expect(await snapshot(page)).toEqual(before);await capture(info,'filter-matrix',{cases,before,after:await snapshot(page)});
});
test('locked, empty, stock zero and QP disclosure retain semantics without mutation',async({page},info)=>{
 await open(page,'mid-progress');const before=await snapshot(page);
 await page.locator('#dexStock').selectOption('zero');await page.locator('#dexModeGallery').click();await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id','ssial-270C');await expect(page.locator('#galleryStock')).toHaveText('재고 0장');await expect(page.locator('#galleryFacts')).toBeVisible();
 await page.locator('#dexFamily').selectOption('poo');await expect(page.locator('#galleryEmpty')).toBeVisible();await page.locator('#galleryReset').click();await page.locator('#dexFiltersToggle').click();await page.locator('#dexDiscovery').selectOption('locked');await expect(page.locator('#galleryFacts')).toBeHidden();await expect(page.locator('#galleryArt img')).toHaveCount(0);await expect(page.locator('#galleryActions')).toBeHidden();await expect(page.locator('#dexFamily option[value="qp"]')).toHaveCount(0);
 expect(await snapshot(page)).toEqual(before);await record(page,info,'negative-locked-stock0',{before,after:await snapshot(page)});
 await open(page,'qp-ready');const qpBefore=await snapshot(page);await page.locator('#dexFamily').selectOption('qp');await page.locator('#dexModeGallery').click();await expect(page.locator('#galleryDevelop')).toBeVisible();await page.locator('#dexFiltersToggle').click();await page.locator('#dexStock').selectOption('available');await expect(page.locator('#galleryEmpty')).toBeVisible();expect(await snapshot(page)).toEqual(qpBefore);await capture(info,'qp-locked',{qpBefore,after:await snapshot(page)});
});
test('failed immutable character layer retries; rapid flips and route disposal keep only current art',async({page},info)=>{
 await open(page);const before=await snapshot(page);await page.locator('#dexFamily').selectOption('poo');await page.locator('#dexLevel').selectOption('4');
 const url=await page.evaluate(()=>IMG_ALT['poo-PHS']);await page.route('**/'+url,r=>r.abort());await page.locator('#dexModeGallery').click();await page.locator('[data-gallery-side="1"]').click();
 await expect(page.locator('#galleryArt [data-status="error"]')).toHaveCount(1);await expect(page.locator('#galleryTS')).toHaveText(oracle.cards.find(c=>c.id==='poo-PHS').back.ts+' MPa');await record(page,info,'negative-art-failed',{before,url});
 await page.unroute('**/'+url);await page.locator('#galleryArt').getByRole('button',{name:/그림 다시 시도/}).click();await ready(page);await expect(page.locator('#galleryArt [data-status="error"]')).toHaveCount(0);
 await page.evaluate(()=>{window.oldCollectionImages=[...document.querySelectorAll('#galleryArt img')];});
 for(let i=0;i<9;i++)await page.locator('[data-gallery-side="'+i%2+'"]').click();await ready(page);await expect(page.locator('#dexGallery')).toHaveAttribute('data-side','front');await expect(page.locator('#galleryArt .game-card')).toHaveCount(1);
 const disposed=await page.evaluate(()=>oldCollectionImages.every(i=>!i.isConnected&&i.getAttribute('src')===null&&i.onload===null&&i.onerror===null));expect(disposed).toBe(true);
 await destination(page,'research');await expect(page.locator('#galleryArt .game-card')).toHaveCount(0);await page.goBack();await expect(page.locator('#dexGallery')).toBeVisible();await ready(page);await expect(page.locator('#dexGallery')).toHaveAttribute('data-side','front');
 await page.locator('#galleryDetail').click();for(let i=0;i<7;i++)await page.locator('#cardFlip').click();await expect(page.locator('#cardBox')).toHaveAttribute('data-side','alt');await page.keyboard.press('Escape');await expect(page.locator('#galleryDetail')).toBeFocused();await expect(page.locator('#materialArt')).toHaveCount(0);
 expect(await snapshot(page)).toEqual(before);await record(page,info,'negative-retry-rapid-route',{before,after:await snapshot(page),disposed});
});
for(const width of [390,1280,640])test(`gallery keyboard touch equivalents, deep links and full body at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===640?450:width===390?844:900});await page.emulateMedia({reducedMotion:'reduce'});await open(page);const before=await snapshot(page);
 await page.locator('#dexFamily').selectOption('ga');await page.locator('#dexModeGallery').click();await ready(page);const first=await page.locator('#dexGallery').getAttribute('data-card-id');
 await page.locator('#galleryStage').focus();await page.keyboard.press('ArrowRight');const second=await page.locator('#dexGallery').getAttribute('data-card-id');expect(second).not.toBe(first);await page.keyboard.press('ArrowLeft');await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id',first);
  await page.locator('#galleryStage').dispatchEvent('pointerdown',{isPrimary:true,pointerId:6,pointerType:'touch',clientX:280,clientY:200});await page.locator('#galleryStage').dispatchEvent('pointercancel',{pointerId:6});await page.locator('#galleryStage').dispatchEvent('pointerup',{isPrimary:true,pointerId:6,pointerType:'touch',clientX:70,clientY:210});await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id',first);
 await page.locator('#galleryStage').dispatchEvent('pointerdown',{isPrimary:true,pointerId:7,pointerType:'touch',clientX:280,clientY:200});await page.locator('#galleryStage').dispatchEvent('pointerup',{isPrimary:true,pointerId:7,pointerType:'touch',clientX:70,clientY:210});await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id',second);
 await page.locator('#galleryPrev').click();await expect(page.locator('#dexGallery')).toHaveAttribute('data-card-id',first);await ready(page);
 const geometry=await page.locator('#galleryArt .game-card').evaluate(el=>({width:el.clientWidth,height:el.clientHeight,scroll:document.documentElement.scrollWidth,viewport:innerWidth,animations:el.getAnimations({subtree:true}).length}));expect(geometry.width/geometry.height).toBeCloseTo(2/3,2);expect(geometry.scroll).toBeLessThanOrEqual(width);expect(geometry.animations).toBe(0);
 await page.evaluate(()=>scrollTo(0,0));if(width!==640){const art=await page.locator('#galleryArt').boundingBox(),nav=await page.locator('.destination-nav').boundingBox(),next=await page.locator('#galleryNext').boundingBox();expect(art.y).toBeGreaterThanOrEqual(0);expect(art.y+art.height).toBeLessThanOrEqual(nav.y);expect(next.y+next.height).toBeLessThanOrEqual(nav.y);}await record(page,info,'happy-gallery-'+width,{before,geometry,mechanism:width===640?'640x450 CSS reflow equivalent to 200% of 1280x900, not native zoom':'CSS viewport'});
 await page.locator('#galleryParts').click();await expect(page.locator('#cardCraftChoices')).toBeVisible();const part=page.locator('[data-card-part-key]').first();if(await part.count()){await part.click();await expect(page).toHaveURL(/#craft$/);await expect(page.locator('#partModal')).toBeVisible();await page.keyboard.press('Escape');await page.goBack();}else await page.keyboard.press('Escape');
 await page.locator('#galleryEquipment').click();await expect(page.locator('#cardEquipmentChoices')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#galleryEquipment')).toBeFocused();expect(await snapshot(page)).toEqual(before);await capture(info,'deep-links-'+width,{before,after:await snapshot(page)});
});
for(const surface of ['gallery','modal'])test(`retry status follows partial failure pending recovery and disposal in ${surface}`,async({page},info)=>{
 await open(page);const before=await snapshot(page),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.locator('#dexFamily').selectOption('poo');await page.locator('#dexLevel').selectOption('4');
 const url=await page.evaluate(()=>IMG_ALT['poo-PHS']),background=await page.evaluate(()=>GAME_CONFIG.assets[GAME_CONFIG.faces.find(f=>f.cardId==='poo-PHS'&&f.side==='alt').background].url);let pending;
 await page.route('**/'+background,route=>route.abort());
 await page.route('**/'+url,route=>route.request().resourceType()==='image'?route.abort():void(pending=route));
 if(surface==='gallery')await page.locator('#dexModeGallery').click();else await page.locator('#dex [data-card-id="poo-PHS"]').click();
 const art=page.locator(surface==='gallery'?'#galleryArt':'#materialArt'),status=page.locator(surface==='gallery'?'#galleryLoad':'#cardArtStatus');
 const flip=()=>surface==='gallery'?page.locator('[data-gallery-side="1"]').click():page.locator('#cardFlip').click();
 await flip();await expect(art.locator('[data-status="loading"]')).toHaveCount(0);await expect(art.locator('[data-status="error"]')).toHaveCount(2);await expect(status).toContainText('다시 시도');await expect(art.locator('.game-card')).toHaveAttribute('aria-busy','false');
 await art.locator('.game-card-character').getByRole('button',{name:/그림 다시 시도/}).click();await expect.poll(()=>Boolean(pending)).toBe(true);await expect(status).toHaveText('그림 불러오는 중 · 일부 그림은 다시 시도가 필요해요.');await expect(art.locator('.game-card')).toHaveAttribute('aria-busy','true');await record(page,info,'retry-pending-'+surface,{before,url});
 await pending.continue();await expect(art.locator('[data-status="loading"]')).toHaveCount(0);await expect(art.locator('[data-status="error"]')).toHaveCount(1);await expect(status).toContainText('다시 시도');await expect(art.locator('.game-card')).toHaveAttribute('aria-busy','false');
 await page.unroute('**/'+background);await art.locator('.game-card-background').getByRole('button',{name:/그림 다시 시도/}).click();await expect(art.locator('[data-status="loading"]')).toHaveCount(0);await expect(art.locator('[data-status="error"]')).toHaveCount(0);await expect(status).toHaveText(surface==='gallery'?'열처리 후':'');await expect(art.locator('.game-card')).toHaveAttribute('aria-busy','false');
 expect(await art.locator('.game-card-character img').evaluate(i=>[i.naturalWidth,i.naturalHeight])).toEqual([960,1440]);await record(page,info,'retry-recovered-'+surface,{before,after:await snapshot(page)});
 if(surface==='gallery')await page.locator('[data-gallery-side="0"]').click();else await page.locator('#cardFlip').click();await flip();await expect(art.locator('[data-status="error"]')).toHaveCount(1);pending=null;await art.getByRole('button',{name:/그림 다시 시도/}).click();await expect.poll(()=>Boolean(pending)).toBe(true);
 await art.evaluate(el=>{window.retryOldImages=[...el.querySelectorAll('img')];window.retryOldStatus=document.querySelector(el.id==='galleryArt'?'#galleryLoad':'#cardArtStatus');window.retryOldText=retryOldStatus.textContent});
 if(surface==='gallery')await destination(page,'research');else await page.keyboard.press('Escape');
 await pending.abort().catch(()=>{});expect(await page.evaluate(()=>retryOldImages.every(i=>!i.isConnected&&i.getAttribute('src')===null&&i.onload===null&&i.onerror===null))).toBe(true);expect(await page.evaluate(()=>retryOldStatus.textContent===retryOldText)).toBe(true);
 await page.unroute('**/'+url);if(surface==='gallery')await page.goBack();else await page.locator('#dex [data-card-id="poo-PHS"]').click();
 for(let i=0;i<5;i++){if(surface==='gallery')await page.locator('[data-gallery-side="'+i%2+'"]').click();else await page.locator('#cardFlip').click();}
 await expect(art.locator('[data-status="loading"]')).toHaveCount(0);await expect(status).not.toContainText('다시 시도');await expect(art.locator('.game-card')).toHaveAttribute('aria-busy','false');expect(errors).toEqual([]);expect(await snapshot(page)).toEqual(before);await record(page,info,'retry-dispose-'+surface,{before,after:await snapshot(page),errors});
});
