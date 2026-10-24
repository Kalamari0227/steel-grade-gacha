import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { appURL, baselineRoot, root, evidenceRoot } from './helpers/paths.mjs';
const originalQPKeys=['ssial-1470M','ga-1470H','poo-PHS'];
const expectedCardParts=id=>baseline.parts.filter(p=>p.need.some(slot=>id==='qp-1470'?slot.any.some(candidate=>originalQPKeys.includes(candidate)):slot.any.includes(id))).map(p=>p.key);

test('@cards-craft all45 exact contextual recipes preserve full state',async({page},info)=>{
  test.setTimeout(180000);const hash=await openApp(page,appURL,'qp-owned');await destination(page,'dex');
  const before=await snapshot(page),rows=[];
  for(const card of baseline.cards){
    await openMaterial(page,card.id);const toggle=page.locator('#cardCraftToggle');
    await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.locator('#cardCraftChoices')).toBeHidden();
    await toggle.click();await expect(toggle).toBeFocused();await expect(toggle).toHaveAttribute('aria-expanded','true');
    const actual=await page.locator('[data-card-part-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardPartKey));
    expect(actual).toEqual(expectedCardParts(card.id));expect(await snapshot(page)).toEqual(before);
    if(!actual.length)await expect(page.locator('#cardCraftChoices')).toContainText('현재 게임 목록에 없습니다');
    rows.push({id:card.id,expected:expectedCardParts(card.id),actual,state:await snapshot(page)});
    if(card.id==='poo-PHS'){
      await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();
      await expect(page.locator('#cardBox')).toHaveAttribute('data-side','alt');await expect(toggle).toBeVisible();
      expect(await page.locator('[data-card-part-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardPartKey))).toEqual(actual);
      expect(await snapshot(page)).toEqual(before);rows.push({id:card.id,side:'alt',actual,state:await snapshot(page)});
    }
    await toggle.click();await expect(page.locator('#cardCraftChoices')).toBeHidden();await page.keyboard.press('Escape');
    await expect(page.locator(`#dex [data-card-id="${card.id}"]`)).toBeFocused();expect(await snapshot(page)).toEqual(before);
  }
  await capture(info,'card-craft-catalog',{hash,before,rows,after:await snapshot(page)});
});

test('@cards-craft PHS keyboard route cancel and existing exact consumption',async({page},info)=>{
  const hash=await openApp(page,appURL,'crafting-ready');await destination(page,'dex');const before=await snapshot(page);
  await openMaterial(page,'poo-PHS');await page.locator('#cardCraftToggle').focus();await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');await expect(page.locator('[data-card-part-key="bumper"]')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('[data-card-part-key="bpillar"]')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#workshop$/);await expect(page.locator('#cardModal')).toBeHidden();await expect(page.locator('#craftTitle')).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
  await page.keyboard.press('Escape');await expect(page.locator('#parts [data-part-key="bpillar"]')).toBeFocused();await expect(page.locator('#parts [data-part-key="bpillar"]')).toBeInViewport({ratio:1});
  expect(await snapshot(page)).toEqual(before);await page.goBack();await expect(page).toHaveURL(/#dex$/);await expect(page.locator('#title-dex')).toBeFocused();
  await openMaterial(page,'poo-PHS');await page.locator('#cardCraftToggle').click();await page.locator('[data-card-part-key="bpillar"]').click();
  expect(await page.locator('.craft-slot').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectedId))).toEqual(['poo-PHS','ssial-980Y']);
  expect(await snapshot(page)).toEqual(before);await page.locator('#mkBtn').click();const after=await snapshot(page);
  const stock={...before.state.stock,'poo-PHS':before.state.stock['poo-PHS']-1,'ssial-980Y':before.state.stock['ssial-980Y']-1};
  expect(after.state.stock).toEqual(stock);expect(after.state.parts.bpillar.use).toEqual(['poo-PHS','ssial-980Y']);
  expect({...after.state,stock:before.state.stock,parts:before.state.parts}).toEqual(before.state);expect(JSON.parse(after.saved)).toEqual(after.state);
  await page.keyboard.press('Escape');await expect(page.locator('#parts [data-part-key="bpillar"]')).toBeFocused();
  await page.evaluate(saved=>{S=JSON.parse(JSON.stringify(saved));save();refresh();},before.state);await destination(page,'dex');
  const alternativeBefore=await snapshot(page);await openMaterial(page,'poo-PHS');await page.locator('#cardCraftToggle').click();await page.locator('[data-card-part-key="bpillar"]').click();
  await page.locator('.craft-slot').first().locator('summary').click();await page.locator('.craft-slot').first().locator('[data-id="ga-1470H"]').click();
  expect(await page.locator('.craft-slot').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectedId))).toEqual(['ga-1470H','ssial-980Y']);
  expect(await snapshot(page)).toEqual(alternativeBefore);await page.locator('#mkBtn').click();const alternativeAfter=await snapshot(page);
  expect(alternativeAfter.state.stock).toEqual({...alternativeBefore.state.stock,'ga-1470H':alternativeBefore.state.stock['ga-1470H']-1,'ssial-980Y':alternativeBefore.state.stock['ssial-980Y']-1});
  expect(alternativeAfter.state.parts.bpillar.use).toEqual(['ga-1470H','ssial-980Y']);
  expect({...alternativeAfter.state,stock:alternativeBefore.state.stock,parts:alternativeBefore.state.parts}).toEqual(alternativeBefore.state);expect(JSON.parse(alternativeAfter.saved)).toEqual(alternativeAfter.state);
  await capture(info,'card-craft-consumption',{hash,before,after,expectedUse:['poo-PHS','ssial-980Y'],alternativeBefore,alternativeAfter,alternativeUse:['ga-1470H','ssial-980Y']});
});
import { openApp, destination, capture } from './helpers/app.mjs';

const baseline=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
const originalSource=await fs.readFile(`${baselineRoot}/src/app_tpl.html`,'utf8');
const originalFamilies=originalSource.match(/var FAMS = \[([\s\S]*?)\n\];/);
if(!originalFamilies)throw new Error('Original family table is missing');
const familyLabels=Object.fromEntries([...originalFamilies[1].matchAll(/\{ key:"([^"]+)", name:"[^"]+", abbr:"([^"]+)", (?:sh:"[^"]+", )?kind:"([^"]+)"/g)].map(([,key,abbr,kind])=>[key,`${abbr} · ${kind}`]));
if(Object.keys(familyLabels).length!==6)throw new Error('Original family oracle must contain all six families');
const snapshot=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY)}));
const shown=page=>page.locator('#dex [data-card-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardId).sort());
async function record(info,name,value){await capture(info,name,value);await fs.mkdir(evidenceRoot,{recursive:true});await fs.writeFile(path.join(evidenceRoot,name+'.json'),JSON.stringify(value,null,2));}
async function shot(page,name){await page.waitForFunction(()=>{const modal=document.getElementById('cardModal');return !modal.classList.contains('show')||modal.getAnimations({subtree:true}).every(a=>a.playState==='finished');});await page.screenshot({path:path.join(evidenceRoot,name+'.png')});}
async function openMaterial(page,id){await page.locator(`#dex button[data-card-id="${id}"]`).click();await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id',id);await page.locator('#materialImage').evaluate(img=>img.decode());}
async function checkSide(page,card,side){
  const sp=side?card.back:card.spec,view=side?card.alt:card;
  await expect(page.locator('#cardBox')).toHaveAttribute('data-side',side?'alt':'front');
  expect(familyLabels[card.fam]).toBeTruthy();
  await expect(page.locator('.material-family')).toBeVisible();
  await expect(page.locator('.material-family')).toHaveText(familyLabels[card.fam]);
  await expect(page.locator('#cardDescription')).toHaveText(view.t);
  await expect(page.locator('#cardQuote')).toHaveText('“'+view.line+'”');
  await expect(page.locator('#cardTS')).toHaveText(sp.ts+' MPa');
  await expect(page.locator('#cardDuctLabel')).toHaveText(sp.ra?'단면수축률 RA':'연신율 EL');
  await expect(page.locator('#cardDuct')).toHaveText((sp.ra||sp.el)+' %');
  const expected=await page.evaluate(({id,side})=>(side?IMG_ALT:IMG)[id],{id:card.id,side});
  await expect(page.locator('#materialImage')).toHaveAttribute('src',expected);
  expect(await page.locator('#materialImage').evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight];})).toEqual([480,720]);
}

test('@cards-happy all45 IDs and47 image states retain material data',async({page},info)=>{
  test.setTimeout(120000);
  const hash=await openApp(page,appURL,'qp-owned');await destination(page,'dex');const before=await snapshot(page),rows=[];
  expect(await shown(page)).toEqual(baseline.cards.map(c=>c.id).sort());
  await expect(page.locator('#secChars')).toHaveText('44 / 44');
  for(const card of baseline.cards){
    await openMaterial(page,card.id);
    const metadata=await page.evaluate(id=>({use:USE[id]||'—',level:lvOf(findChar(id)),name:LVNAME[lvOf(findChar(id))],stock:stockOf(id)}),card.id);
    await expect(page.locator('#cardIdentity')).toHaveText(card.id);
    await expect(page.locator('#cardLevel')).toHaveText('LV'+metadata.level+' · '+metadata.name);
    await expect(page.locator('#cardUse')).toHaveText(metadata.use);
    await expect(page.locator('#cardStock')).toHaveText(card.id==='qp-1470'?'재고 무소모 · 개발 완료':'재고 '+metadata.stock+'장');
    await checkSide(page,card,0);rows.push({id:card.id,side:'front',family:card.fam,expectedFamily:familyLabels[card.fam],actualFamily:await page.locator('.material-family').innerText(),...metadata});
    if(card.alt){
      await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();await checkSide(page,card,1);
      await expect(page.locator('.material-compare')).toContainText(card.spec.ts+' MPa');
      await expect(page.locator('.material-compare')).toContainText(card.back.ts+' MPa');
      rows.push({id:card.id,side:'alt',family:card.fam,expectedFamily:familyLabels[card.fam],actualFamily:await page.locator('.material-family').innerText(),...metadata});
    }else await expect(page.locator('#cardFlip')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  expect(rows).toHaveLength(47);expect(await snapshot(page)).toEqual(before);await record(info,'cards-all',{hash,rows,before,after:await snapshot(page)});
});

test('@cards-happy filters intersect, family entry resets stale conditions, sameLV differs',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned');await destination(page,'dex');const before=await snapshot(page),cases=[];
  for(const family of ['all',...new Set(baseline.cards.map(c=>c.fam))]){
    await expect(page.locator(`#dexFamily option[value="${family}"]`)).toHaveCount(1);
    for(const level of ['all','1','2','3','4','5']){
      await page.locator('#dexFamily').selectOption(family);await page.locator('#dexLevel').selectOption(level);
      const expected=await page.evaluate(({family,level})=>allChars().filter(c=>(family==='all'||c.fam.key===family)&&(level==='all'||lvOf(c)===Number(level))).map(c=>c.id).sort(),{family,level});
      expect(await shown(page)).toEqual(expected);cases.push({family,level,ids:expected});
    }
  }
  await page.locator('#dexStock').selectOption('zero');
  expect(await page.evaluate(()=>openDexFamily('ssial'))).toBe(true);
  await expect(page.locator('#dexStock')).toHaveValue('all');await expect(page.locator('#dexLevel')).toHaveValue('all');
  for(const id of ['ssial-SEDDQ','ssial-1180Y']){await openMaterial(page,id);await expect(page.locator('#cardLevel')).toHaveText('LV3 · 기술기반전략제품');await checkSide(page,baseline.cards.find(c=>c.id===id),0);await page.keyboard.press('Escape');}
  await page.locator('#dexClear').click();expect(await shown(page)).toHaveLength(45);expect(await snapshot(page)).toEqual(before);await record(info,'filters',{hash,cases,before,after:await snapshot(page)});
});

test('@cards-happy heat comparisons, wireRA9, equipped guarantees and use',async({page},info)=>{
  await page.setViewportSize({width:1280,height:900});const hash=await openApp(page,appURL,'equipped-items');await destination(page,'dex');const before=await snapshot(page),rows=[];
  for(const id of ['poo-PHS','ga-1470H',...baseline.cards.filter(c=>c.fam==='tarae').map(c=>c.id)]){
    const card=baseline.cards.find(c=>c.id===id);await openMaterial(page,id);await checkSide(page,card,0);
    if(card.alt){await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();await checkSide(page,card,1);await expect(page.getByRole('button',{name:'뒷면 선택',exact:true})).toBeFocused();if(id==='poo-PHS')await shot(page,'phs');}
    else{await expect(page.locator('#cardDuctLabel')).toHaveText('단면수축률 RA');if(id==='wr-SWRM')await shot(page,'wire');}
    rows.push({id,duct:await page.locator('#cardDuctLabel').innerText()});await page.keyboard.press('Escape');
  }
  const equipped=await page.evaluate(()=>allChars().filter(c=>itemsOf(c.id).length).map(c=>({id:c.id,tags:itemsOf(c.id).map(it=>it.tag),use:USE[c.id]})));
  for(const card of equipped){await openMaterial(page,card.id);await expect(page.locator('#cardGuarantees')).toHaveText(card.tags.join(' · '));await expect(page.locator('#cardUse')).toHaveText(card.use);await page.keyboard.press('Escape');}
  expect(equipped.reduce((n,c)=>n+c.tags.length,0)).toBe(14);expect(await snapshot(page)).toEqual(before);await record(info,'material-semantics',{hash,rows,equipped,before,after:await snapshot(page)});
});

test('@cards-negative zero stock, empty filters and original locked disclosure',async({page},info)=>{
  const hash=await openApp(page,appURL,'mid-progress');await destination(page,'dex');const before=await snapshot(page);
  await page.locator('#dexStock').selectOption('zero');expect(await shown(page)).toEqual(['ssial-270C']);
  await openMaterial(page,'ssial-270C');await expect(page.locator('#cardStock')).toHaveText('재고 0장');await shot(page,'zero-stock');await page.keyboard.press('Escape');
  await page.locator('#dexFamily').selectOption('poo');await expect(page.getByText('조건에 맞는 소재가 없어요',{exact:true})).toBeVisible();expect(await shown(page)).toEqual([]);
  await page.locator('#dexClear').click();await page.locator('#dexDiscovery').selectOption('locked');
  const locked=await page.locator('#dex .cell.locked').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.cardId,text:n.innerText,image:n.querySelectorAll('img').length,tag:n.tagName})));
  expect(locked).toHaveLength(42);expect(locked.every(c=>c.image===0&&c.tag==='DIV'&&c.text.includes('???'))).toBe(true);
  const unowned=baseline.cards.find(c=>c.id===locked[0].id);expect(locked[0].text).not.toContain(unowned.code);
  await page.evaluate(id=>openCard(id),locked[0].id);await expect(page.locator('#cardModal')).not.toBeVisible();
  await expect(page.locator('#dexFamily option[value="qp"]')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);await record(info,'invalid-states',{hash,locked,before,after:await snapshot(page)});
});

test('@cards-negative QP revealed not developed stays separate and locked',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-ready');await destination(page,'dex');const before=await snapshot(page);
  await expect(page.getByRole('button',{name:'선행개발 과제 열기',exact:true})).toBeVisible();
  await expect(page.locator('#secChars')).toContainText('/ 44');
  await page.evaluate(()=>openCard('qp-1470'));await expect(page.locator('#cardModal')).not.toBeVisible();
  await page.locator('#dexStock').selectOption('available');await expect(page.getByRole('button',{name:'선행개발 과제 열기',exact:true})).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);await record(info,'qp-collection',{hash,before,after:await snapshot(page)});
});

test('@cards-happy new discovery and duplicate labels use draw display result only',async({page},info)=>{
  const hash=await openApp(page,appURL,'new');
  await page.locator('#btnPull').click();await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');
  const id=await page.locator('[data-draw-detail]').first().getAttribute('data-draw-detail');
  await destination(page,'dex');const first=await snapshot(page);
  await expect(page.locator(`#dex [data-card-id="${id}"]`)).toContainText('NEW · 처음 발견');
  await page.locator('#dexStock').selectOption('available');expect(await snapshot(page)).toEqual(first);
  await page.clock.setFixedTime(new Date('2026-11-02T00:00:01+09:00'));await page.evaluate(()=>refresh());
  await destination(page,'workshop');await page.locator('#btnPull').click();await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');await destination(page,'dex');
  const second=await snapshot(page);await expect(page.locator(`#dex [data-card-id="${id}"]`)).toContainText('중복 보유 · 재고 2장');
  expect(Object.keys(second.state).sort()).toEqual(Object.keys(first.state).sort());
  await page.reload();await destination(page,'dex');await expect(page.locator('#dex .is-new')).toHaveCount(0);
  await record(info,'discovery-labels',{hash,id,first,second});
});

test('@cards-negative rapid flip preserves focused controls, no-alt and close reopen',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned');await destination(page,'dex');const before=await snapshot(page);
  await openMaterial(page,'poo-PHS');const flip=page.locator('#cardFlip');await flip.focus();
  for(let i=0;i<7;i++)await page.keyboard.press(i%2?'Space':'Enter');
  await checkSide(page,baseline.cards.find(c=>c.id==='poo-PHS'),1);await expect(flip).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#dex button[data-card-id="poo-PHS"]')).toBeFocused();
  await openMaterial(page,'ssial-270C');await expect(page.locator('#cardFlip')).toHaveCount(0);await checkSide(page,baseline.cards.find(c=>c.id==='ssial-270C'),0);await page.keyboard.press('Escape');
  await openMaterial(page,'poo-PHS');await checkSide(page,baseline.cards.find(c=>c.id==='poo-PHS'),0);
  const learning=page.locator('#cardModal [data-card-learning]');
  const craft=page.locator('#cardCraftToggle');
  await page.locator('#cardFlip').focus();await page.keyboard.press('Tab');await expect(craft).toBeFocused();await expect(craft).toBeInViewport();await page.keyboard.press('Tab');await expect(learning).toBeFocused();await expect(learning).toBeInViewport();
  await page.keyboard.press('Tab');await expect(page.locator('#cardX')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(learning).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(craft).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(flip).toBeFocused();
  expect(await page.evaluate(()=>dialogStack.filter(entry=>entry.el.id==='cardModal').length)).toBe(1);
  await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(before);await record(info,'rapid-flip',{hash,before,after:await snapshot(page)});
});

test('@cards-negative reduced motion and touch have no tilt; pointer bounded6degrees',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned');await destination(page,'dex');await openMaterial(page,'poo-PHS');const before=await snapshot(page),art=page.locator('#materialArt');
  await art.dispatchEvent('pointermove',{pointerType:'mouse',clientX:100000,clientY:-100000});
  const angles=await art.evaluate(el=>['--card-rx','--card-ry'].map(key=>parseFloat(el.style.getPropertyValue(key))||0));expect(angles.every(a=>Math.abs(a)<=6)).toBe(true);
  await art.dispatchEvent('pointermove',{pointerType:'touch',clientX:10,clientY:10});await expect.poll(()=>art.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'뒷면 선택',exact:true}).click();
  await checkSide(page,baseline.cards.find(c=>c.id==='poo-PHS'),1);expect(await page.locator('#materialImage').evaluate(el=>el.getAnimations().length)).toBe(0);
  await art.dispatchEvent('pointermove',{pointerType:'mouse',clientX:100000,clientY:0});expect(await art.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  expect(await snapshot(page)).toEqual(before);await record(info,'card-motion',{hash,angles,before,after:await snapshot(page)});
});

test('@cards-negative touch context and responsive collection preserve reachability',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  try{
    const page=await context.newPage();const hash=await openApp(page,appURL,'qp-owned');await destination(page,'dex');const before=await snapshot(page),widths=[];
    for(const width of [360,390,768,1280]){
      await page.setViewportSize({width,height:width<768?844:1024});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await openMaterial(page,'poo-PHS');
      const art=page.locator('#materialArt');await art.dispatchEvent('pointermove',{pointerType:'touch',clientX:100000,clientY:0});
      expect(await art.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
      await page.getByRole('button',{name:'뒷면 선택',exact:true}).tap();await checkSide(page,baseline.cards.find(c=>c.id==='poo-PHS'),1);
      await page.locator('#cardX').tap();widths.push(width);
    }
    expect(await snapshot(page)).toEqual(before);await record(info,'touch-collection',{hash,widths,before,after:await snapshot(page)});
  }finally{await context.close();}
});
