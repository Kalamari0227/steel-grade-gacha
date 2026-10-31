import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,root} from './helpers/paths.mjs';
import {openApp,state,capture,destination,settings} from './helpers/app.mjs';
import {storageEvidence} from './helpers/storage-evidence.mjs';
storageEvidence(test);
const sizes=[{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1280,height:900}];
const recipeOracle=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8')).parts;
const cardCraftSnapshot=page=>page.evaluate(()=>({state:JSON.parse(JSON.stringify(S)),saved:localStorage.getItem(KEY)}));
for(const viewport of [...sizes,{width:640,height:450}])test.describe(`card crafting ${viewport.width}`,()=>{
  test.use({viewport,deviceScaleFactor:viewport.width===640?2:1});
  test(`@cards-craft zero stock QP context and accessible controls ${viewport.width}`,async({page},info)=>{
    test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});const rows=[];
    for(const scenario of ['short','alternative','qp','completed']){
      const hash=await openApp(page,appURL,scenario==='qp'?'qp-owned':'crafting-short');
      const fixture=JSON.parse(await fs.readFile(`${root}/tests/fixtures/${scenario==='qp'?'qp-owned':'crafting-short'}.json`,'utf8'));
      await page.evaluate(saved=>{S=JSON.parse(JSON.stringify(saved));save();refresh();},fixture.state);
      if(scenario==='alternative')await page.evaluate(()=>{S.stock['ga-1470H']=2;S.stock['ssial-980Y']=2;save();refresh();});
      if(scenario==='completed')await page.evaluate(()=>{S.parts.bpillar={at:Date.now(),use:['poo-PHS','ssial-980Y']};save();refresh();});
      await destination(page,'dex');const before=await cardCraftSnapshot(page),id=scenario==='qp'?'qp-1470':'poo-PHS';
      const viewportActual=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
      expect(viewportActual).toEqual({...viewport,dpr:viewport.width===640?2:1});
      await page.locator(`#dex [data-card-id="${id}"]`).click();await settle(page);
      const toggle=page.locator('#cardCraftToggle');await activate(page,toggle);await expect(toggle).toBeFocused();
      const keys=await page.locator('[data-card-part-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardPartKey));
      const qpKeys=['ssial-1470M','ga-1470H','poo-PHS'];
      const expected=recipeOracle.filter(p=>p.need.some(slot=>id==='qp-1470'?slot.any.some(x=>qpKeys.includes(x)):slot.any.includes(id))).map(p=>p.key);
      expect(keys).toEqual(expected);expect(await cardCraftSnapshot(page)).toEqual(before);
      const traversals={Tab:[],'Shift+Tab':[]};
      await trap(page,page.locator('#cardModal'),async key=>{const candidate=await page.locator(':focus').getAttribute('data-card-part-key');if(candidate)traversals[key].push(candidate);});
      for(const visited of Object.values(traversals))expect([...new Set(visited)].sort()).toEqual([...expected].sort());
      const target=page.locator('[data-card-part-key="bpillar"]');await tabTo(page,target);const choiceGeometry=await actionVisible(target);await shot(page,info,`card-craft-${scenario}-choices-${viewport.width}`);
      await page.keyboard.press('Enter');await expect(page).toHaveURL(/#craft$/);await expect(page.locator('#cardModal')).toBeHidden();await expect(page.locator('#craftTitle')).toBeFocused();await settle(page);
      const selected=await page.locator('.craft-slot').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectedId));
      if(scenario==='short')await expect(page.locator('#mkBtn')).toBeDisabled();
      if(scenario==='alternative'){expect(selected).toEqual(['ga-1470H','ssial-980Y']);await expect(page.locator('#mkBtn')).toBeEnabled();}
      if(scenario==='qp'){expect(selected).toEqual(['qp-1470','ssial-980Y']);await expect(page.locator('#mkBtn')).toBeEnabled();await expect(page.locator('.craft-slot').first()).toContainText('무소모');}
      if(scenario==='completed'){await expect(page.locator('#mkBtn')).toHaveCount(0);await expect(page.locator('.craft-complete')).toContainText('만들었습니다');}
      expect(await cardCraftSnapshot(page)).toEqual(before);
      const back=page.locator('#craftBack');await tabTo(page,back);const backGeometry=await actionVisible(back);await shot(page,info,`card-craft-${scenario}-detail-${viewport.width}`);await page.keyboard.press('Enter');
      await expect(page.locator('#parts [data-part-key="bpillar"]')).toBeFocused();const returnGeometry=await actionVisible(page.locator('#parts [data-part-key="bpillar"]'));
      expect(await cardCraftSnapshot(page)).toEqual(before);expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
      rows.push({scenario,id,hash,viewportActual,keys,expected,traversals,selected,choiceGeometry,backGeometry,returnGeometry,before,after:await cardCraftSnapshot(page)});
    }
    await capture(info,'card-craft-responsive',{viewport,mechanism:viewport.width===640?'640x450 DPR2 layout-equivalent emulation; not native zoom':'native CSS viewport',rows});
  });
});
const errors=new WeakMap();
const keySequences=new WeakMap();
test.beforeEach(async({page})=>keySequences.set(page,[]));
test.afterEach(async({page},info)=>capture(info,'keyboard-sequences',keySequences.get(page)));
test.afterEach(async({page},info)=>capture(info,'settle-history',await page.evaluate(()=>window.__settleHistory||[])));
test.afterEach(async({page},info)=>capture(info,'focus-scroll-audit',await page.evaluate(()=>window.__focusScrollAudit||[])));
test.afterEach(async({page},info)=>capture(info,'scroll-monitor',await page.evaluate(()=>[...window.__activeScrolls||[]].map(node=>({tag:node.tagName||node.nodeName,id:node.id,connected:node.isConnected,top:node.scrollTop,left:node.scrollLeft,rootY:scrollY,overflow:node.nodeType===1?getComputedStyle(node).overflow:null})))));
test.beforeEach(async({page})=>{const found=[];errors.set(page,found);page.on('pageerror',error=>found.push(error.message));await page.addInitScript(()=>{window.__activeScrolls=new Set();window.__scrollVersion=0;document.addEventListener('scroll',event=>{window.__scrollVersion++;window.__activeScrolls.add(event.target);},true);document.addEventListener('scrollend',event=>window.__activeScrolls.delete(event.target),true);});});
test.afterEach(async({page},info)=>{await capture(info,'pageerrors',errors.get(page));expect(errors.get(page)).toEqual([]);});

function effectiveGeometry(el){
  const r=el.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight},ancestors=[];
  let fixed=getComputedStyle(el).position==='fixed';
  for(let parent=el.parentElement;parent;parent=parent.parentElement){
    const s=getComputedStyle(parent);
    const containing=s.transform!=='none'||s.perspective!=='none'||s.filter!=='none'||/paint|layout|strict|content/.test(s.contain)||/transform|perspective|filter/.test(s.willChange);
    if(fixed&&!containing)continue;
    if(containing)fixed=false;
    if(parent===document.documentElement||parent===document.scrollingElement)continue;
    const b=parent.getBoundingClientRect(),sx=parent.offsetWidth?b.width/parent.offsetWidth:1,sy=parent.offsetHeight?b.height/parent.offsetHeight:1;
    const port={left:b.left+parent.clientLeft*sx,top:b.top+parent.clientTop*sy,right:b.left+(parent.clientLeft+parent.clientWidth)*sx,bottom:b.top+(parent.clientTop+parent.clientHeight)*sy};
    if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,port.left);clip.right=Math.min(clip.right,port.right);}
    if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,port.top);clip.bottom=Math.min(clip.bottom,port.bottom);}
    if(/auto|scroll|hidden|clip/.test(s.overflowX+s.overflowY))ancestors.push({id:parent.id,port,scrollTop:parent.scrollTop,max:parent.scrollHeight-parent.clientHeight});
    if(s.position==='fixed')fixed=true;
  }
  const points=[[.5,.04],[.96,.5],[.5,.96],[.04,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75],[.5,.5]].map(([x,y])=>{
    const px=r.left+r.width*x,py=r.top+r.height*y,hit=document.elementFromPoint(px,py);return {x:px,y:py,hit:!!hit&&(hit===el||el.contains(hit)),blocking:hit?.id||hit?.tagName};
  });
  return {rect:r.toJSON(),clip,ancestors,points,hidden:!!el.closest('[hidden],[inert]')};
}
test('@geometry-harness fixed escape and genuine clipping remain distinct',async({page},info)=>{
  await page.setContent('<style>body{margin:0;height:80px;overflow:hidden}.fixed{position:fixed;top:120px;left:20px;width:200px;height:150px;overflow:auto;background:white}.port{height:60px;overflow:hidden}.target{display:block;width:100px;height:100px;background:blue}#transformed{position:absolute;top:300px;left:0;width:200px;height:50px;overflow:hidden;transform:translateX(0)}#contained{position:fixed;top:20px;left:0;width:100px;height:100px}</style><div class="fixed"><button id="free">Fixed button</button><div class="port"><button class="target" id="clipped">Clipped button</button></div></div><div id="transformed"><button id="contained">Contained fixed</button></div>');
  const free=await actionVisible(page.locator('#free')),clipped=await page.locator('#clipped').evaluate(effectiveGeometry),contained=await page.locator('#contained').evaluate(effectiveGeometry);
  expect(free.ancestors.map(row=>row.id)).not.toContain('body');expect(clipped.rect.bottom).toBeGreaterThan(clipped.clip.bottom);expect(clipped.points.some(row=>!row.hit)).toBe(true);
  expect(contained.ancestors.some(row=>row.id==='transformed')).toBe(true);expect(contained.rect.bottom).toBeGreaterThan(contained.clip.bottom);
  await capture(info,'geometry-synthetic',{free,clipped,contained});
  await page.setContent('<style>body{margin:0;position:relative;overflow-x:hidden;height:2000px}button{position:absolute;top:1200px;left:20px;width:100px;height:44px}</style><button id="rootTarget">Root scroll</button>');
  await page.evaluate(()=>scrollTo(0,1000));
  const rootTarget=await actionVisible(page.locator('#rootTarget'));expect(rootTarget.rect.top).toBe(200);
  await capture(info,'geometry-root',{rootTarget,root:await page.evaluate(()=>({tag:document.scrollingElement.tagName,mode:document.compatMode,scrollY}))});
});
async function settle(page){
  await page.evaluate(async()=>{
    let timer;try{await Promise.race([Promise.all(document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{}))),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('finite animation did not settle')),5000);})]);}finally{clearTimeout(timer);}
    await Promise.all([...document.images].filter(img=>img.getClientRects().length&&img.complete&&img.naturalWidth).map(img=>img.decode()));
  });
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime)).length)).toBe(0);
}
test('@keyboard-platform real Tab and Option Tab focus sequences',async({page,browserName},info)=>{
  const content='<input id="first"><button id="button">Button</button><a href="#link" id="link">Link</a><input id="last">';
  const sequences={};
  for(const key of ['Tab','Alt+Tab']){
    await page.setContent(content);sequences[key]=[];
    for(let i=0;i<4;i++){await page.keyboard.press(key);sequences[key].push(await page.evaluate(()=>document.activeElement.id));}
  }
  if(process.platform==='darwin'&&browserName==='webkit'){
    expect(sequences.Tab.slice(0,2)).toEqual(['first','last']);expect(sequences['Alt+Tab']).toEqual(['first','button','link','last']);
  }else expect(sequences.Tab).toEqual(['first','button','link','last']);
  await capture(info,'platform-keyboard',{platform:process.platform,browserName,sequences,source:'https://github.com/microsoft/playwright/blob/main/tests/page/page-focus.spec.ts'});
});
test('@geometry-harness moving clipped target cannot satisfy action visibility',async({page},info)=>{
  await page.setContent('<div id="port" style="height:100px;overflow:auto"><div style="height:1000px"><button id="target" style="position:relative;top:800px;height:44px">Scrolling target</button></div></div>');
  await page.evaluate(()=>{const port=document.getElementById('port');window.__activeScrolls=new Set([port]);window.__scrollVersion=0;port.addEventListener('scroll',()=>window.__scrollVersion++);window.__motionProbe=setInterval(()=>port.scrollTop=port.scrollTop===20?80:20,10);});
  let rejected=false;try{await actionVisible(page.locator('#target'),400);}catch{rejected=true;}expect(rejected).toBe(true);
  const rejectedHistory=await page.evaluate(()=>window.__settleHistory);
  await page.evaluate(()=>{clearInterval(window.__motionProbe);document.getElementById('port').scrollTop=800;});
  await expect.poll(()=>page.locator('#port').evaluate(el=>el.scrollTop)).toBe(800);await actionVisible(page.locator('#target'));
  await capture(info,'moving-scroll',{rejected,rejectedHistory,history:await page.evaluate(()=>window.__settleHistory)});
});
async function waitGeometry(locator,predicate,timeout=5000){
  let box;const history=[];
  try{await expect.poll(async()=>{box=await locator.evaluate(effectiveGeometry);history.push(box);return predicate(box);},{timeout}).toBe(true);}
  finally{await locator.evaluate((el,history)=>{window.__settleHistory=(window.__settleHistory||[]).concat({target:el.id||el.className,samples:history});},history.slice(-12));}
  return box;
}
async function actionVisible(locator,timeout=5000){
  return waitGeometry(locator,box=>{const r=box.rect,c=box.clip;return !box.hidden&&r.width>0&&r.height>0&&r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1&&r.bottom<=c.bottom+1&&box.points.every(point=>point.hit);},timeout);
}
async function tabTo(page,locator){
  await settle(page);
  await expect(locator).toHaveCount(1);await expect(locator).toBeVisible();
  for(let step=0;step<350;step++){
    if(await locator.evaluate(el=>el===document.activeElement)){
      const box=await locator.evaluate(effectiveGeometry),r=box.rect,c=box.clip;
      const fullyVisible=r.top>=c.top-1&&r.bottom<=c.bottom+1&&r.left>=c.left-1&&r.right<=c.right+1&&box.points.every(point=>point.hit);
      if(step>0||fullyVisible){await actionVisible(locator);return;}
    }
    const key=process.platform==='darwin'&&page.context().browser().browserType().name()==='webkit'&&!await page.locator('.modal.show,.tview.show,[role="dialog"].install.show').count()?'Alt+Tab':'Tab';
    await page.keyboard.press(key);
    if(!keySequences.has(page))keySequences.set(page,[]);
    keySequences.get(page).push({key,target:await locator.getAttribute('id'),focus:await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent.slice(0,80)}))});
    await settle(page);
    expect(await page.evaluate(()=>!!document.activeElement.closest('[hidden],[inert]'))).toBe(false);
    if(await page.locator(':focus').count())await actionVisible(page.locator(':focus'));
  }
  throw Error('Keyboard target unreachable within 350 Tab presses');
}
async function activate(page,locator){await tabTo(page,locator);await page.keyboard.press('Enter');}
async function trap(page,modal,observeFocus){
  await expect(modal).toBeVisible();
  const count=await modal.locator('button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]').count();
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<count+2;i++){
    await page.keyboard.press(key);await settle(page);expect(await modal.evaluate(el=>el.contains(document.activeElement))).toBe(true);await actionVisible(page.locator(':focus'));
    if(observeFocus)await observeFocus(key);
  }
}
async function geometry(page){
  const result=await page.evaluate(()=>{
    const visible=el=>!el.closest('[hidden],[inert]') && el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden';
    const boxes=[...document.querySelectorAll('.modal.show .box,.tview.show,.install.show')].filter(visible).map(el=>({id:el.id,width:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,rect:el.getBoundingClientRect().toJSON(),overflow:getComputedStyle(el).overflowY}));
    const controls=[...document.querySelectorAll('button,select,summary,.destination-nav a')].filter(visible).map(el=>({name:el.getAttribute('aria-label') || el.textContent.trim().slice(0,80),id:el.id,rect:el.getBoundingClientRect().toJSON(),font:getComputedStyle(el).fontSize}));
    return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport?.scale,scrollWidth:document.documentElement.scrollWidth,boxes,controls};
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width+1);
  for(const box of result.boxes){expect(box.scrollWidth).toBeLessThanOrEqual(box.width+1);expect(box.rect.top).toBeGreaterThanOrEqual(-1);expect(box.rect.bottom).toBeLessThanOrEqual(result.height+1);}
  for(const control of result.controls){expect(control.rect.width,control.name).toBeGreaterThanOrEqual(43.5);expect(control.rect.height,control.name).toBeGreaterThanOrEqual(43.5);}
  return result;
}
async function shot(page,info,name){
  await settle(page);
  const layout=await geometry(page);const file=info.outputPath(`${name}.png`);
  await page.screenshot({path:file,scale:'device'});await info.attach(name+'-image',{path:file,contentType:'image/png'});await capture(info,name,{layout,file});
}
async function endReach(page,container,selectors){
  const results=[];
  for(const selector of selectors){
    const target=container.locator(selector).last();await expect(target).toBeVisible();await target.scrollIntoViewIfNeeded();
    await settle(page);const initial=await target.evaluate(effectiveGeometry),box=initial.rect;let top=initial,bottom=initial;
    if(box.height>initial.clip.bottom-initial.clip.top){
      await target.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));top=await waitGeometry(target,b=>b.rect.top>=b.clip.top-1&&b.rect.top<b.clip.bottom);
      expect(top.rect.top).toBeGreaterThanOrEqual(top.clip.top-1);expect(top.rect.top).toBeLessThan(top.clip.bottom);
      await target.evaluate(el=>el.scrollIntoView({block:'end',behavior:'instant'}));bottom=await waitGeometry(target,b=>b.rect.bottom>b.clip.top&&b.rect.bottom<=b.clip.bottom+1);
      expect(bottom.rect.bottom).toBeGreaterThan(bottom.clip.top);expect(bottom.rect.bottom).toBeLessThanOrEqual(bottom.clip.bottom+1);
    }else{top=bottom=await waitGeometry(target,b=>b.rect.top>=b.clip.top-1&&b.rect.bottom<=b.clip.bottom+1);}
    expect(bottom.rect.left).toBeGreaterThanOrEqual(bottom.clip.left-1);expect(bottom.rect.right).toBeLessThanOrEqual(bottom.clip.right+1);
    results.push({selector,box,top,bottom,text:await target.innerText(),scroll:await container.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}))});
  }
  const scroll=await container.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight,height:el.clientHeight,scrollHeight:el.scrollHeight}));
  return {results,scroll};
}

async function readerAccess(page,info,prefix){
  await destination(page,'research');const before=await state(page);await activate(page,page.locator('#btnToon'));const rows=[];
  for(const index of [0,2]){
    const entry=page.locator(`#toonBox .ep[data-i="${index}"]`);await entry.scrollIntoViewIfNeeded();
    await tabTo(page,entry);const listTop=await page.locator('#toonModal .box').evaluate(el=>el.scrollTop);await page.keyboard.press('Enter');
    const frames=page.locator('#toonScroll .toon-page');
    for(const frame of await frames.all()){const img=frame.locator('img');await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());await expect(frame).toHaveAttribute('data-state','ready');}
    const end=await endReach(page,page.locator('#toonScroll'),index===0?['.vcap','.toon-page:last-of-type']:['.toon-page:last-of-type','.vnote']);
    const previous=page.locator(`#toonScroll [data-go="${index-1}"]`),next=page.locator(`#toonScroll [data-go="${index+1}"]`);
    await page.locator('#toonScroll .vnav').scrollIntoViewIfNeeded();const controls=[];
    for(const control of [previous,page.locator('#toonScroll [data-go="list"]'),next])controls.push(await actionVisible(control));
    await expect(index===0?previous:next).toBeDisabled();await expect(index===0?next:previous).toBeEnabled();
    await shot(page,info,`${prefix}-reader-${index}-end`);
    await activate(page,index===0?next:previous);await expect(page.locator('#toonScroll .toon-page')).toHaveCount(1);
    expect(await page.evaluate(()=>dialogStack.filter(row=>row.el.id==='toonView').length)).toBe(1);
    await activate(page,page.locator(`#toonScroll [data-go="${index}"]`));
    await activate(page,page.locator('#toonScroll [data-go="list"]'));await expect(entry).toBeFocused();await actionVisible(entry);
    await expect.poll(()=>page.locator('#toonModal .box').evaluate(el=>el.scrollTop)).toBeCloseTo(listTop,0);const restored=await page.locator('#toonModal .box').evaluate(el=>el.scrollTop);
    rows.push({index,listTop,restored,end,controls});
  }
  await activate(page,page.locator('#toonBox .ep[data-i="2"]'));await tabTo(page,page.locator('#toonViewX'));const close=await actionVisible(page.locator('#toonViewX'));const seenBeforeClose=await page.evaluate(()=>localStorage.getItem(TOON_SEEN));await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe(seenBeforeClose);
  await expect(page.locator('#btnToon')).toBeFocused();expect(await page.evaluate(()=>dialogStack.length)).toBe(0);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  expect(await state(page)).toEqual(before);return {rows,close,before,after:await state(page),seenBeforeClose,seen:await page.evaluate(()=>localStorage.getItem(TOON_SEEN))};
}

for(const viewport of sizes)test(`@layout-happy five destinations and shared dialogs ${viewport.width}`,async({page},info)=>{
  await page.setViewportSize(viewport);await openApp(page,appURL,'crafting-ready');
  for(const route of ['workshop','dex','craft','research','garage']){await destination(page,route);await shot(page,info,route);}
  await destination(page,'dex');await page.locator('#dex [data-card-id="poo-PHS"]').click();
  const cardEnd=await endReach(page,page.locator('#cardBox'),['#cardGuarantees','.note']);await shot(page,info,'card-end');
  await page.locator('#cardX').scrollIntoViewIfNeeded();await actionVisible(page.locator('#cardX'));await page.keyboard.press('Escape');
  await destination(page,'craft');await page.locator('#parts [data-part-key="bpillar"]').click();
  const craftEnd=await endReach(page,page.locator('#partBox'),['#craftBack']);await shot(page,info,'craft-end');await page.keyboard.press('Escape');
  await destination(page,'research');await page.locator('#btnQuiz').click();await shot(page,info,'quiz');await page.keyboard.press('Escape');
  await settings(page);await page.locator('#btnBackup').click();await endReach(page,page.locator('#backupBox'),['#bkLoad']);await shot(page,info,'backup-end');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await settings(page);await page.locator('#btnInstall').click();await shot(page,info,'install');await page.keyboard.press('Escape');
  await capture(info,'bottom-content',{cardEnd,craftEnd});
});

test('@layout-negative narrow long labels large quantities and 200 percent text resize',async({page},info)=>{
  await page.setViewportSize({width:360,height:800});await openApp(page,appURL,'crafting-ready');
  await page.evaluate(()=>{S.scrap=999999999;S.extra=999999999;Object.keys(S.stock).forEach(id=>S.stock[id]=999999999);refresh();});
  const before=await state(page);
  await shot(page,info,'large-quantities');await destination(page,'dex');await page.locator('#dex [data-card-id="poo-PHS"]').click();
  const original=await page.locator('#materialTitle').innerText();
  await page.locator('#materialTitle').evaluate(el=>el.textContent='긴 소재 이름과 열처리 조건을 함께 확인하는 접근성 검증용 제목 '.repeat(3));
  await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('#cardModal *')];
    const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));
    nodes.forEach((el,i)=>el.style.fontSize=`${sizes[i]*2}px`);
  });
  const bottom=await endReach(page,page.locator('#cardBox'),['#cardUse','#cardGuarantees','.note']);
  await shot(page,info,'text-enlargement-end');await tabTo(page,page.locator('#cardX'));await actionVisible(page.locator('#cardX'));await page.keyboard.press('Enter');
  expect(await state(page)).toEqual(before);
  await capture(info,'text-enlargement',{mechanism:'each initial computed font size doubled once; text-only stress, not native zoom',original,bottom,before,after:await state(page)});
});

test('@layout-negative same modal stages and nested guarantee card retain focus and resources',async({page},info)=>{
  await page.setViewportSize({width:360,height:800});await openApp(page,appURL,'crafting-ready');await destination(page,'research');
  await page.evaluate(()=>{
    window.__focusScrollAudit=[];const record=(kind,data)=>window.__focusScrollAudit.push({kind,time:performance.now(),active:document.activeElement.id,top:document.getElementById('pickBox')?.scrollTop,...data});
    document.addEventListener('focusin',event=>record('focus',{target:event.target.id}),true);
    document.addEventListener('scroll',event=>{if(event.target.id==='pickBox')record('scroll',{target:event.target.id});},true);
    const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(callback){const text=callback.toString().slice(0,200);record('raf-scheduled',{text});return raf.call(window,time=>{record('raf-running',{text});callback.call(window,time);});};
    const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){record('scrollIntoView',{target:this.id,options});return scroll.call(this,options);};
  });
  await page.evaluate(()=>{S.items={};S.orderDay=today();S.orderKey='shield';S.orderDone=0;refresh();});
  await activate(page,page.locator('#btnOrder'));await activate(page,page.locator('[data-choice="shield"]'));
  const acquired=await state(page);await activate(page,page.locator('#pkEquip'));
  expect(await page.evaluate(()=>dialogStack.filter(row=>row.el.id==='pickModal').length)).toBe(1);
  await expect(page.locator('#targetTitle')).toBeFocused();await actionVisible(page.locator('#targetTitle'));
  const card=page.locator('[data-guarantee-card]').first();await activate(page,card);await trap(page,page.locator('#cardModal'));
  await page.keyboard.press('Escape');await expect(card).toBeFocused();await trap(page,page.locator('#pickModal'));await shot(page,info,'same-modal-target');
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>dialogStack.length)).toBe(0);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  expect(await state(page)).toEqual(acquired);await capture(info,'same-modal',{acquired,after:await state(page)});
});

async function recordMotion(page){
  await page.evaluate(()=>{
    window.__motionCalls=[];window.__animationCalls=[];window.__drawDispatches=[];window.__drawTimers=[];
    const animate=Element.prototype.animate,start=window.startDraw,timeout=window.setTimeout;let drawing=false;
    Element.prototype.animate=function(frames,options){window.__animationCalls.push({target:this.id,frames,options});return animate.call(this,frames,options);};
    window.setTimeout=function(callback,delay,...args){if(drawing)window.__drawTimers.push(delay);return timeout.call(this,callback,delay,...args);};
    window.startDraw=function(...args){drawing=true;try{return start.apply(this,args);}finally{drawing=false;window.__drawDispatches.push({phase:document.getElementById('pullBox').dataset.phase,busy:drawBusy(),timers:typeof GAME_DRAW!=='undefined'?GAME_DRAW.snapshot().pendingTimerCount:drawState?.timers.length||0});}};
    const scroll=Element.prototype.scrollIntoView,elementScroll=Element.prototype.scrollTo,scrollTo=window.scrollTo;
    Element.prototype.scrollIntoView=function(options){window.__motionCalls.push({method:'scrollIntoView',options,target:this.id});return scroll.call(this,options);};
    Element.prototype.scrollTo=function(...args){window.__motionCalls.push({method:'element.scrollTo',options:args[0],target:this.id});return elementScroll.apply(this,args);};
    window.scrollTo=function(...args){window.__motionCalls.push({method:'window.scrollTo',options:args[0]});return scrollTo.apply(this,args);};
  });
}
async function noMotion(page,label){
  const result=await page.evaluate(()=>({animations:document.getAnimations().filter(a=>a.playState==='running').map(a=>({state:a.playState,timing:a.effect.getComputedTiming()})),invocations:window.__animationCalls,draw:window.__drawDispatches,timers:window.__drawTimers,scroll:window.__motionCalls,position:{window:scrollY,reader:document.querySelector('#toonScroll')?.scrollTop}}));
  expect(result.animations,label).toEqual([]);expect(result.invocations,label).toEqual([]);expect(result.timers,label).toEqual([]);for(const draw of result.draw)expect(draw).toEqual({phase:'ready',busy:false,timers:0});expect(result.scroll.some(row=>row.options?.behavior==='smooth'),label).toBe(false);return {label,...result};
}
test('@reduced-motion no timed draw flip tilt transitions or smooth scrolling',async({page,browser},info)=>{
  test.setTimeout(120000);
  await page.emulateMedia({reducedMotion:'reduce'});await openApp(page,appURL,'crafting-ready');
  await recordMotion(page);const stages=[];
  await activate(page,page.locator('#btnPull'));await expect(page.locator('#pullBox')).toHaveAttribute('data-phase','ready');
  stages.push(await noMotion(page,'draw-dispatch-immediate'));expect(stages[0].draw).toHaveLength(1);
  await expect(page.locator('[data-draw-skip]')).toBeHidden();expect(await page.locator('[data-draw-skip]').evaluate(el=>el.getClientRects().length===0&&el!==document.activeElement)).toBe(true);await page.keyboard.press('Escape');
  await destination(page,'dex');await page.locator('#dex [data-card-id="poo-PHS"]').click();await page.locator('#cardFlip').click();
  await expect(page.locator('[data-card-side="1"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#materialArt').hover();
  stages.push(await noMotion(page,'flip-invocation'));
  const observed=await page.evaluate(()=>({
    animations:document.getAnimations().filter(a=>a.playState==='running').map(a=>({state:a.playState,timing:a.effect.getComputedTiming()})),
    styles:[...document.querySelectorAll('#pullBox,#materialArt,#materialArt .game-card-character img,.material-foil')].map(el=>{const s=getComputedStyle(el);return {id:el.id,animation:s.animationDuration,transition:s.transitionDuration,transform:s.transform};}),
    scroll:window.__motionCalls,
    foil:['::before','::after'].map(pseudo=>{const s=getComputedStyle(document.querySelector('#materialArt'),pseudo);return {pseudo,display:s.display,animation:s.animationDuration,transition:s.transitionDuration};})
  }));
  expect(observed.animations).toEqual([]);
  for(const row of observed.styles){expect(row.animation.split(',').every(v=>parseFloat(v)===0)).toBe(true);expect(row.transition.split(',').every(v=>parseFloat(v)===0)).toBe(true);}
  expect(observed.styles.find(row=>row.id==='materialArt').transform).toBe('none');
  for(const foil of observed.foil){expect(foil.animation.split(',').every(v=>parseFloat(v)===0)).toBe(true);expect(foil.transition.split(',').every(v=>parseFloat(v)===0)).toBe(true);}
  expect(observed.foil.find(row=>row.pseudo==='::after').display).toBe('none');
  expect(observed.scroll.some(row=>row.options?.behavior==='smooth')).toBe(false);
  await shot(page,info,'reduced-motion');await page.keyboard.press('Escape');
  await destination(page,'craft');await activate(page,page.locator('#parts [data-part-key="bpillar"]'));await activate(page,page.locator('#mkBtn'));
  await expect(page.locator('#craftStatus')).toBeFocused();await actionVisible(page.locator('#craftStatus'));stages.push(await noMotion(page,'craft-success'));await page.keyboard.press('Escape');
  await destination(page,'research');
  for(const target of ['btnQuiz','order','items','btnToon']){await activate(page,page.locator(`[data-learning-target="${target}"]`));await expect(page.locator(`#${target}`)).toBeFocused();stages.push(await noMotion(page,`learning-${target}`));}
  await activate(page,page.locator('#btnQuiz'));const answer=await page.evaluate(()=>qState.qs[qState.i].a);await activate(page,page.locator('#opts button').nth(answer));
  await expect(page.locator('#qNext')).toBeFocused();await actionVisible(page.locator('#qNext'));stages.push(await noMotion(page,'quiz-explanation'));await page.keyboard.press('Escape');
  const reader=await readerAccess(page,info,'reduced');stages.push(await noMotion(page,'reader-return'));
  const carContext=await browser.newContext({viewport:{width:640,height:450},deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block',timezoneId:'Asia/Seoul'});let car;
  try{
    const carPage=await carContext.newPage(),failures=[];carPage.on('pageerror',error=>failures.push(error.message));await openApp(carPage,appURL,'all-parts');await recordMotion(carPage);await destination(carPage,'garage');
    await activate(carPage,carPage.locator('#carBox .garage-option').first());const selected=await noMotion(carPage,'car-selection');await actionVisible(carPage.locator('#carChoiceTitle'));
    const before=await state(carPage);await activate(carPage,carPage.locator('#takeCar'));const result=carPage.locator(await carPage.locator('#garageStageTitle').count()?'#garageStageTitle':'#carStatus');await expect(result).toBeFocused();await actionVisible(result);
    expect((await state(carPage)).cars).toHaveLength(before.cars.length+1);expect((await state(carPage)).stock).toEqual(before.stock);expect((await state(carPage)).parts).toEqual({});
    car={selected,confirmed:await noMotion(carPage,'car-confirmation'),before,after:await state(carPage),failures};expect(failures).toEqual([]);
  }finally{await carContext.close();}
  expect(stages.some(stage=>stage.scroll.some(call=>call.method==='scrollIntoView'))).toBe(true);expect(stages.some(stage=>stage.scroll.some(call=>call.method==='window.scrollTo'))).toBe(true);
  await capture(info,'motion',{observed,stages,reader,car});
});

test('@keyboard-happy keyboard only five destinations shipment detail crafting quiz reader settings',async({page},info)=>{
  test.setTimeout(120000);
  await openApp(page,appURL,'crafting-ready');
  for(const route of ['dex','craft','research','garage','workshop']){
    await activate(page,page.locator(`.destination-nav a[href="#${route}"]`));await expect(page.locator(`#title-${route}`)).toBeFocused();
  }
  const beforeStatus=await state(page);await page.evaluate(()=>showToast('출하 상태를 확인했습니다.','상태 안내'));
  await activate(page,page.locator('#toastX'));await expect(page.locator('#toast')).not.toHaveClass(/show/);expect(await state(page)).toEqual(beforeStatus);
  await activate(page,page.locator('.destination-nav a[href="#dex"]'));await tabTo(page,page.locator('#dexFamily'));
  await actionVisible(page.locator('#dexFamily'));await tabTo(page,page.locator('#dexLevel'));await page.keyboard.press('l');await expect(page.locator('#dexLevel')).toHaveValue('1');
  await capture(info,'native-select-keys',{key:'l',mechanism:'native select typeahead; macOS headless popup arrows separately probed',value:await page.locator('#dexLevel').inputValue(),active:await page.evaluate(()=>document.activeElement.id)});expect(await state(page)).toEqual(beforeStatus);
  await activate(page,page.locator('.destination-nav a[href="#workshop"]'));
  await activate(page,page.locator('#btnPull'));await expect(page.locator('[data-draw-skip]')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('.draw-art')).toBeFocused();await page.keyboard.press('Enter');
  await trap(page,page.locator('#cardModal'));await page.keyboard.press('Escape');await expect(page.locator('.draw-art')).toBeFocused();
  await page.keyboard.press('Escape');await activate(page,page.locator('.destination-nav a[href="#craft"]'));await activate(page,page.locator('#parts [data-part-key="bpillar"]'));
  const before=await state(page),plan=await page.evaluate(()=>partPlan(findPart('bpillar')));
  await activate(page,page.locator('#mkBtn'));await expect(page.locator('#craftStatus')).toBeFocused();
  const after=await state(page);expect(after.owned).toEqual(before.owned);expect(after.parts.bpillar.use).toEqual(plan);
  for(const id of new Set(plan.filter(id=>id!== 'qp-1470')))expect(after.stock[id]).toBe(before.stock[id]-plan.filter(value=>value===id).length);
  await page.keyboard.press('Escape');await expect(page.locator('#parts [data-part-key="bpillar"]')).toBeFocused();
  await activate(page,page.locator('.destination-nav a[href="#research"]'));await activate(page,page.locator('#btnQuiz'));
  await trap(page,page.locator('#quizModal'));await page.keyboard.press('Escape');await expect(page.locator('#btnQuiz')).toBeFocused();
  await activate(page,page.locator('#btnToon'));await trap(page,page.locator('#toonModal'));
  await activate(page,page.locator('#toonBox button[data-i]').first());await expect(page.locator('#toonView')).toBeVisible();
  await trap(page,page.locator('#toonView'));await page.keyboard.press('Escape');
  while(await page.locator('#toonModal.show').count())await page.keyboard.press('Escape');
  await activate(page,page.locator('#btnSettings'));await activate(page,page.locator('#btnBackup'));await trap(page,page.locator('#backupModal'));
  await page.keyboard.press('Escape');await expect(page.locator('#btnBackup')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#btnSettings')).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');await capture(info,'keyboard',{before,plan,after,focus:await page.evaluate(()=>document.activeElement.id)});
});

test.describe('200 percent layout equivalent',()=>{
  test.use({viewport:{width:640,height:450},deviceScaleFactor:2});
  test('@layout-happy 200 percent physical1280x900 CSS640x450 modal bottom and close reachable',async({page},info)=>{
    test.setTimeout(120000);
    await openApp(page,appURL,'crafting-ready');await destination(page,'dex');
    const portrait=page.locator('#dex [data-card-id="poo-PHS"]');await tabTo(page,portrait);await actionVisible(portrait);await shot(page,info,'200percent-full-portrait');
    const portraitLayout=await portrait.evaluate(el=>({cell:el.getBoundingClientRect().toJSON(),art:el.querySelector('.dex-art').getBoundingClientRect().toJSON(),image:el.querySelector('.dex-art img').getBoundingClientRect().toJSON(),info:el.querySelector('.dex-cell-info').getBoundingClientRect().toJSON(),fit:getComputedStyle(el.querySelector('.dex-art img')).objectFit,text:el.querySelector('.dex-cell-info').innerText}));
    await capture(info,'portrait-layout',portraitLayout);expect(portraitLayout.fit).toBe('contain');expect(portraitLayout.image.bottom).toBeLessThanOrEqual(portraitLayout.art.bottom+1);expect(portraitLayout.image.top).toBeGreaterThanOrEqual(portraitLayout.art.top-1);expect(portraitLayout.info.top).toBeGreaterThanOrEqual(portraitLayout.art.bottom-1);expect(portraitLayout.info.bottom).toBeLessThanOrEqual(portraitLayout.cell.bottom+1);await page.keyboard.press('Enter');
    expect(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))).toEqual({width:640,height:450,dpr:2});
    const bottom=await endReach(page,page.locator('#cardBox'),['#cardUse','#cardGuarantees','.note']);await geometry(page);
    const file=info.outputPath('200percent-card-bottom.png');await page.screenshot({path:file,scale:'device'});
    const png=await fs.readFile(file);expect(png.readUInt32BE(16)).toBe(1280);expect(png.readUInt32BE(20)).toBe(900);
    await tabTo(page,page.locator('#cardX'));const close=await actionVisible(page.locator('#cardX'));await page.keyboard.press('Enter');
    await destination(page,'craft');await page.locator('#parts [data-part-key="bpillar"]').click();
    await expect(page.locator('#craftStatus')).toHaveAttribute('role','status');
    const craft=await endReach(page,page.locator('#partBox'),['#craftCost','#craftProgress','.craft-keeps','#mkBtn','#craftBack']);
    await tabTo(page,page.locator('#mkBtn'));const craftSubmit=await actionVisible(page.locator('#mkBtn'));await tabTo(page,page.locator('#craftBack'));await actionVisible(page.locator('#craftBack'));
    await shot(page,info,'200percent-craft-bottom');await page.keyboard.press('Enter');
    await destination(page,'dex');const beforeQP=await state(page);await activate(page,page.getByRole('button',{name:'선행개발 과제 열기',exact:true}));
    await expect(page.locator('#qpStatus')).toHaveAttribute('role','status');await expect(page.locator('#qpScrap')).toContainText('10');
    const qp=await endReach(page,page.locator('#partBox'),['.qp-cost-note','#qpScrap','.craft-keeps','#devBtn','#qpBack']);
    await page.locator('#devBtn').scrollIntoViewIfNeeded();const qpSubmit=await actionVisible(page.locator('#devBtn'));await tabTo(page,page.locator('#qpBack'));await actionVisible(page.locator('#qpBack'));await shot(page,info,'200percent-qp-cost');await page.keyboard.press('Enter');expect(await state(page)).toEqual(beforeQP);
    const reader=await readerAccess(page,info,'200percent');
    await activate(page,page.locator('#btnOrder'));const demand=await page.evaluate(()=>S.orderKey);await activate(page,page.locator(`[data-choice="${demand}"]`));await activate(page,page.locator('#pkEquip'));
    const beforeTargets=await state(page),target=page.locator('[data-equip-id]').last();await tabTo(page,target);const targetControl=await actionVisible(target);
    const guarantees=await endReach(page,page.locator('#pickBox'),['[data-equip-id]','#pickLater']);await tabTo(page,page.locator('#pickLater'));await actionVisible(page.locator('#pickLater'));await shot(page,info,'200percent-guarantee-targets');await page.keyboard.press('Enter');expect(await state(page)).toEqual(beforeTargets);
    await settings(page);await page.locator('#btnBackup').click();const backup=await endReach(page,page.locator('#backupBox'),['#bkLoad']);await shot(page,info,'200percent-backup-bottom');
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await settings(page);await activate(page,page.locator('#btnInstall'));
    await activate(page,page.locator('#installSteps [data-t="android"]'));const install=await endReach(page,page.locator('#installBar'),['#installSteps .tip']);await tabTo(page,page.locator('#installX'));const installClose=await actionVisible(page.locator('#installX'));await shot(page,info,'200percent-install');await page.keyboard.press('Enter');await expect(page.locator('#btnSettings')).toBeFocused();
    expect(await page.evaluate(()=>dialogStack.length)).toBe(0);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
    await capture(info,'enlargement',{mechanism:'layout equivalent emulation, not native browser zoom',physical:{width:1280,height:900},css:{width:640,height:450},dpr:await page.evaluate(()=>devicePixelRatio),bottom,close,craft,craftSubmit,qp,qpSubmit,reader,guarantees,targetControl,backup,install,installClose});
  });
  test('@layout-negative 200 percent car confirmation and quiz nested card keyboard access',async({page},info)=>{
    await openApp(page,appURL,'all-parts');await destination(page,'garage');const before=await state(page);
    expect(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))).toEqual({width:640,height:450,dpr:2});
    await activate(page,page.locator('#carBox .garage-option').first());
    await expect(page.locator('#carChoiceTitle')).toBeFocused();
    await page.locator('#carsay p').last().evaluate(el=>el.textContent='자동차 선택 조건과 완성 부품 사용 안내를 끝까지 읽을 수 있어야 합니다. '.repeat(8));
    await tabTo(page,page.locator('#takeCar'));const confirm=await actionVisible(page.locator('#takeCar'));
    await tabTo(page,page.locator('#cancelCar'));await shot(page,info,'200percent-car-confirm');await page.keyboard.press('Enter');expect(await state(page)).toEqual(before);
    await destination(page,'research');await activate(page,page.locator('#btnQuiz'));
    await page.evaluate(()=>{S.owned['ssial-270D']=true;const related=QUIZ.find(q=>q.q.includes('<b>JSC270D</b>'));qState={qs:[related,...QUIZ.slice(0,4)].map(shuffleQ),i:0,right:0};renderQ();});
    const answer=await page.evaluate(()=>qState.qs[0].a);await activate(page,page.locator('#opts button').nth(answer));
    await expect(page.locator('#qNext')).toBeFocused();await settle(page);await actionVisible(page.locator('#qNext'));
    const question=await page.evaluate(()=>structuredClone(qState)),saved=await state(page);
    await activate(page,page.locator('[data-quiz-card="ssial-270D"]'));await trap(page,page.locator('#cardModal'));
    await page.keyboard.press('Escape');await expect(page.locator('[data-quiz-card="ssial-270D"]')).toBeFocused();
    expect(await page.evaluate(()=>structuredClone(qState))).toEqual(question);expect(await state(page)).toEqual(saved);
    await shot(page,info,'200percent-quiz-return');
    const longest=await page.evaluate(()=>{
      const text=html=>{const el=document.createElement('div');el.innerHTML=html;return el.textContent;};
      const source=QUIZ.reduce((best,q)=>text(q.e).length>text(best.e).length?q:best);
      qState={qs:Array.from({length:5},()=>shuffleQ(source)),i:0,right:0};renderQ();return {question:source.q,html:source.e,text:text(source.e),length:text(source.e).length};
    });
    const beforeReward=await state(page),explanations=[];
    for(let i=0;i<5;i++){
      const answer=await page.evaluate(()=>qState.qs[qState.i].a);await activate(page,page.locator('#opts button').nth(answer));await expect(page.locator('.learning-reason')).toHaveText(longest.text);
      const reach=await endReach(page,page.locator('#quizBox'),['.learning-reason','#qNext']);await tabTo(page,page.locator('#qNext'));await actionVisible(page.locator('#qNext'));
      if(i===0)await shot(page,info,'200percent-longest-explanation');explanations.push(reach);await page.keyboard.press('Enter');
    }
    await expect(page.locator('#quizResult')).toHaveText('5 / 5 정답');const rewarded=await state(page);expect(rewarded.extra).toBe(beforeReward.extra+1);expect(rewarded.stock).toEqual(beforeReward.stock);expect(rewarded.owned).toEqual(beforeReward.owned);
    const result=await endReach(page,page.locator('#quizBox'),['#quizResult','#qRetry','#qDone']);await tabTo(page,page.locator('#qRetry'));await actionVisible(page.locator('#qRetry'));await tabTo(page,page.locator('#qDone'));await actionVisible(page.locator('#qDone'));await shot(page,info,'200percent-quiz-result');await page.keyboard.press('Enter');expect(await state(page)).toEqual(rewarded);
    await capture(info,'nested-enlargement',{before,question,saved,confirm,longest,explanations,result,beforeReward,rewarded,mechanism:'CSS640x450 DPR2 layout equivalent; not native zoom'});
  });
});
