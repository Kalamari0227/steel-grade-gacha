import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,baselineURL,root} from '../helpers/paths.mjs';
import {capture,state,mirror,settings,sha,openApp,destination} from '../helpers/app.mjs';
import {launch,record} from './import-helpers.mjs';
const mid=JSON.parse(await fs.readFile(root+'/tests/fixtures/mid-progress.json','utf8'));
const allCars=JSON.parse(await fs.readFile(root+'/tests/fixtures/all-cars.json','utf8'));
const encode=(value,edition='game')=>(edition==='game'?'SGG-GAME1.':'SGG1.')+Buffer.from(JSON.stringify(edition==='game'?{version:1,edition:'game',progress:value}:value)).toString('base64url');
const decode=code=>JSON.parse(Buffer.from(code.slice(code.indexOf('.')+1),'base64url').toString());
const compact=()=>({v:1,o:['P270C','-qp-1470'],i:{arrow:'-qp-1470'},s:71,x:2,p:1793458800000,q:1793458800000,u:2,pu:1,od:'2026-11-1',ok:'dagger',on:0,pt:[],st:{P270C:0,'-qp-1470':3},cr:[]});
async function open(page,initial=mid.state){await launch(page,initial?{local:JSON.stringify(initial)}:{});await settings(page);await page.locator('#btnBackup').click();await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state','available');await expect(page.locator('#bkDiag [data-storage-check=copy]')).toBeVisible();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));}
async function snapshot(page){return page.evaluate(async()=>({state:JSON.parse(JSON.stringify(S)),local:rawStorage.get.call(localStorage,KEY),mirror:await new Promise(resolve=>mirrorGet(resolve)),output:document.getElementById('bkOut').value,summary:document.getElementById('bkSummary').textContent,writes:storageAudit.filter(row=>['setItem','removeItem','put','delete','clear'].includes(row.method))}));}
async function proof(page,info,name,before){const after=await snapshot(page);await capture(info,name,{before,after,hashBefore:sha(JSON.stringify(before)),hashAfter:sha(JSON.stringify(after))});return after;}
async function preview(page,code,education=false){await page.locator('#bkIn').fill(code);await page.locator(education?'#bkEducation':'#bkLoad').click();await expect(page.locator('#bkPreview')).toBeVisible();await expect(page.locator('#bkPreviewTitle')).toBeFocused();}
async function confirm(page){await page.locator('#bkConfirm').focus();await page.keyboard.press('Enter');await expect(page.locator('#bkPreview')).toBeHidden();}
async function shot(page,info,name){const path=info.outputPath(name+'.png');await page.screenshot({path,animations:'disabled'});await info.attach(name,{path,contentType:'image/png'});}

for(const owned of [false,true])test(`garage backup restore immediately displays ${owned?'owned car':'empty showroom'} through close reentry and reload`,async({page},info)=>{
 await launch(page,{local:JSON.stringify(allCars.state)});await destination(page,'garage');
 await expect(page.locator('#garageStageTitle')).toBeVisible();await shot(page,info,'garage-before-import');
 await settings(page);await page.locator('#btnBackup').click();
 await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state','available');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const before=await snapshot(page),catalog=await page.evaluate(()=>({ids:POOL.map(idShort),parts:PARTS.map(p=>p.key),car:CARS.find(c=>c.key==='m')}));
 const pack={...compact(),o:catalog.ids,i:{},st:Object.fromEntries(catalog.ids.map(id=>[id,0])),x:0,pt:catalog.parts,cr:owned?[[catalog.car.key,12345]]:[]};
 await preview(page,encode(pack));await confirm(page);await expect(page.locator('#bkRes')).toHaveClass('bkres ok');
 const restored=await proof(page,info,'garage-import-immediate',before);
 const immediate=await page.evaluate(()=>({presentation:GAME_GARAGE.snapshot(),stageCount:document.querySelectorAll('#garageStage .garage-showroom').length,title:document.getElementById('garageStageTitle')?.textContent}));
 await capture(info,'garage-import-stage-immediate',immediate);
 expect(immediate.stageCount,'restore must retain the freshly rendered showroom').toBe(1);
 expect(immediate.presentation).toMatchObject({active:true,busy:false,pendingTimerCount:0,car:owned?catalog.car.key:null});
 expect(decode(restored.output).progress).toEqual(pack);
 await page.locator('#backupX').click();await page.locator('#settingsX').click();
 await expect(page.locator('#garageStageTitle')).toHaveText(owned?catalog.car.tag:'비어 있는 전시대');
 await expect(page.locator('#garageStageTitle')).toBeVisible();await shot(page,info,'garage-after-import');
 await page.clock.runFor(4000);expect(await state(page)).toEqual(restored.state);
 await expect.poll(()=>mirror(page)).toEqual(restored.state);
 await destination(page,'workshop');await destination(page,'garage');
 await expect(page.locator('#garageStage .garage-showroom')).toHaveAttribute('data-car',owned?catalog.car.key:'');
 await page.reload();await page.waitForFunction(()=>!saveHold);
 await expect(page.locator('#garageStageTitle')).toBeVisible();
 await expect(page.locator('#garageStage .garage-showroom')).toHaveAttribute('data-car',owned?catalog.car.key:'');
 expect(await page.evaluate(()=>makePack())).toEqual(pack);
 await record(page,info,'garage-import-reloaded');
});

for(const fresh of [false,true])test(`game export envelope excludes preferences and restores compact progress after reload fresh=${fresh}`,async({page},info)=>{
 await open(page,fresh?null:mid.state);const before=await snapshot(page),code=before.output,envelope=decode(code);
 expect(Object.keys(envelope).sort()).toEqual(['edition','progress','version']);expect(envelope).toMatchObject({version:1,edition:'game'});
 expect(Object.keys(envelope.progress).sort()).toEqual(['v','o','i','s','x','p','q','u','pu','od','ok','on','pt','st','cr'].sort());
 await preview(page,code);expect(await snapshot(page)).toEqual(before);await confirm(page);await expect(page.locator('#bkRes')).toHaveClass('bkres ok');
 expect(decode(await page.locator('#bkOut').inputValue())).toEqual(envelope);expect((await state(page)).stock).toEqual(before.state.stock);
 await expect(page.locator('#bkRecoveryOut')).toHaveValue(code);await expect.poll(()=>mirror(page)).toEqual(await state(page));
 await page.reload();await page.waitForFunction(()=>!saveHold);expect(await page.evaluate(()=>makePack())).toEqual(envelope.progress);
 await record(page,info,'happy-game-reload');
});

for(const legacy of [false,true])test(`explicit education ${legacy?'legacy':'current'} preview cancel and replace retains QP arrow`,async({page},info)=>{
 await open(page);const before=await snapshot(page);const pack=compact();
 const ids=await page.evaluate(()=>({part:PARTS[0].key,car:CARS[0].key}));pack.pt=[ids.part];pack.cr=[[ids.car,12345]];
 if(legacy){delete pack.st;delete pack.pu;delete pack.cr;pack.cs=ids.car;pack.ca=12345;}
 const code=encode(pack,'education');await preview(page,code,true);expect(await snapshot(page)).toEqual(before);
 await expect(page.locator('#bkPrevious')).toContainText('발견 2종');await expect(page.locator('#bkNext')).toContainText('부품 1종 · 자동차 1대 · 스크랩 71장');await expect(page.locator('#bkRecovery')).toHaveValue(before.output);await shot(page,info,'education-preview');
 await page.locator('#bkCancel').click();await expect(page.locator('#bkEducation')).toBeFocused();expect(await proof(page,info,'cancel-hashes',before)).toEqual(before);
 await preview(page,code,true);await confirm(page);await expect(page.locator('#bkRes')).toHaveClass('bkres ok');
 const imported=await state(page);expect(imported.items.arrow).toBe('qp-1470');expect(imported.stock).toEqual(legacy?{'poo-270C':1,'qp-1470':1}:{'poo-270C':0,'qp-1470':3});expect(imported.cars).toEqual([{k:ids.car,at:12345}]);expect(imported.parts[ids.part]).toEqual({at:0,use:[]});expect(imported.pullUsed).toBe(1);
 for(const key of ['bell','belledAt','backupAt','promoSeen','promoDone','noticeSeen','qpSeen'])expect(imported[key]).toEqual(before.state[key]);
 const game=await page.locator('#bkOut').inputValue();await preview(page,game);await confirm(page);expect((await state(page)).stock).toEqual(imported.stock);expect((await state(page)).items).toEqual(imported.items);
 await expect.poll(()=>mirror(page)).toEqual(await state(page));await record(page,info,'happy-education-'+legacy);
});

test('all 45 IDs and 103 valid item relations validate including stock-zero ownership',async({page},info)=>{
 await open(page);const before=await snapshot(page);
 const result=await page.evaluate(()=>{
  const ids=allChars().map(c=>c.id),pairs=[];
  for(const item of ITEMS)for(const id of ids)if(item.fit(findChar(id))){const pack={v:1,o:[idShort(id)],i:{[item.key]:idShort(id)},st:{[idShort(id)]:0}};const parsed=GAME_BACKUP.read(GAME_BACKUP.code(pack),'game',backupCatalog());if(parsed.progress.items[item.key]!==id)throw Error('relation lost');pairs.push([id,item.key]);}
  const pack={v:1,o:ids.map(idShort)};const next=GAME_BACKUP.read(GAME_BACKUP.code(pack),'game',backupCatalog()).progress;
  return {ids,pairs,next};
 });
 expect(result.ids).toHaveLength(45);expect(result.pairs).toHaveLength(103);expect(result.pairs).toContainEqual(['qp-1470','arrow']);expect(Object.keys(result.next.owned)).toHaveLength(45);expect(await snapshot(page)).toEqual(before);await capture(info,'complete-catalog-relations',result);await record(page,info,'happy-catalog');
});

test('legacy defaults and baseline order day quota normalization remain equivalent',async({page},info)=>{
 const cases=[{v:1,o:['P270C']},{...compact(),od:'2020-1-1',on:9,pu:8,u:15},{...compact(),ok:'arrow',on:0},{...compact(),ok:'kettle',on:0}];
 const expected=[];
 for(const pack of cases){await openApp(page,baselineURL,'mid-progress');await page.evaluate(pack=>{applyCode(pack);refresh();},pack);expected.push(await page.evaluate(()=>makeCode()));}
 await open(page);const results=[];
 for(let i=0;i<cases.length;i++){await preview(page,encode(cases[i],'education'),true);await confirm(page);const actual=decode(await page.locator('#bkOut').inputValue()).progress,baseline=decode(expected[i]);
 // Explicit zero stock is retained by the game; baseline omitted zero keys.
 if(cases[i].st)for(const [k,v] of Object.entries(cases[i].st))if(v===0)baseline.st[k]=0;
 expect(actual).toEqual(baseline);results.push({input:cases[i],baseline,actual});}
 await capture(info,'baseline-normalization',results);await record(page,info,'happy-defaults');
});

test('invalid inputs never mutate live state either store or export output',async({page},info)=>{
 await open(page);const before=await snapshot(page),good=compact();
 const invalid=[['base64','SGG-GAME1.%%%'],['utf8','SGG-GAME1._w'],['noncanonical-base64','SGG-GAME1.e31'],['array-root','SGG-GAME1.'+Buffer.from('[]').toString('base64url')],['null-root','SGG-GAME1.'+Buffer.from('null').toString('base64url')],['wrong-envelope',encode(good).replace('SGG-GAME1.','SGG1.')],['cross-edition',encode(good,'education')],['oversize','x'.repeat(256*1024+1)],['multi-byte-oversize','가'.repeat(90000)]];
 const altered=(name,change)=>{const pack=structuredClone(good);change(pack);invalid.push([name,encode(pack)]);};
 altered('version',p=>p.v=2);altered('owned-type',p=>p.o={});altered('owned-entry',p=>p.o=[null]);altered('items-type',p=>p.i=[]);altered('negative',p=>p.s=-1);altered('fraction',p=>p.x=1.1);altered('numeric-string',p=>p.u='3');altered('unsafe',p=>p.s=9007199254740992);altered('timestamp',p=>p.p=8640000000000001);altered('date',p=>p.od='2026-2-30');altered('date-type',p=>p.od=0);altered('order',p=>p.ok='unknown');altered('owned-unknown',p=>p.o.push('-unknown'));altered('owned-duplicate',p=>p.o.push('poo-270C'));altered('part-unknown',p=>p.pt=['unknown']);altered('stock-undiscovered',p=>p.st.C270C=1);altered('stock-negative',p=>p.st.P270C=-1);altered('stock-alias-duplicate',p=>p.st['poo-270C']=0);altered('incompatible-equipment',p=>p.i={shield:'-qp-1470'});altered('undiscovered-equipment',p=>p.i={arrow:'C270C'});altered('item-unknown',p=>p.i={unknown:1});altered('item-type',p=>p.i={arrow:true});altered('stock-type',p=>p.st=[]);altered('car-type',p=>p.cr={});altered('car-unknown',p=>p.cr=[['unknown',0]]);altered('car-time',p=>p.cr=[['unknown',-1]]);altered('legacy-car-type',p=>p.cs=0);altered('unknown-field',p=>p.audio=true);altered('prompt-injection',p=>p.o=['<img src=x onerror="window.injected=true">']);
 const ids=await page.evaluate(()=>({part:PARTS[0].key,car:CARS[0].key}));altered('part-duplicate',p=>p.pt=[ids.part,ids.part]);altered('car-duplicate',p=>p.cr=[[ids.car,0],[ids.car,1]]);altered('car-negative-time',p=>p.cr=[[ids.car,-1]]);
 invalid.push(['nonfinite','SGG-GAME1.'+Buffer.from(JSON.stringify({version:1,edition:'game',progress:good}).replace('"s":71','"s":1e999')).toString('base64url')]);
 invalid.push(['education-reject-game',encode(good),true],['education-invalid-version',encode({...good,v:2},'education'),true],['education-invalid-base64','SGG1.%%%',true]);
 for(const value of [{version:2,edition:'game',progress:good},{version:1,edition:'education',progress:good},{version:1,edition:'game',progress:null}])invalid.push(['envelope-'+invalid.length,'SGG-GAME1.'+Buffer.from(JSON.stringify(value)).toString('base64url')]);
 const observed=[];for(const [name,code,education] of invalid){await page.locator('#bkIn').fill(code);await page.locator(education?'#bkEducation':'#bkLoad').click();await expect(page.locator('#bkRes')).toHaveClass('bkres ng');await expect(page.locator('#bkPreview')).toBeHidden();const after=await snapshot(page);expect(after,name).toEqual(before);observed.push({name,message:await page.locator('#bkRes').innerText(),beforeSHA:sha(JSON.stringify(before)),afterSHA:sha(JSON.stringify(after))});}
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();await capture(info,'negative-matrix',observed);await record(page,info,'negative-invalid');
});

test('stale preview and repeated confirmation cannot overwrite a newer game',async({page},info)=>{
 await open(page);await preview(page,encode(compact()));await page.evaluate(()=>{S.scrap+=1;save();});const before=await snapshot(page);
 await confirm(page);await expect(page.locator('#bkRes')).toContainText('현재 진행이 바뀌었습니다');expect(await proof(page,info,'stale-hashes',before)).toEqual(before);
 await preview(page,encode(compact()));await page.evaluate(()=>{window.applyCount=0;const original=applyCode;applyCode=function(pack){applyCount++;return original(pack);};document.getElementById('bkConfirm').click();document.getElementById('bkConfirm').click();});expect(await page.evaluate(()=>applyCount)).toBe(1);
 await preview(page,encode(compact()));await page.clock.fastForward(86400000);const nextDay=await snapshot(page);await confirm(page);await expect(page.locator('#bkRes')).toContainText('현재 진행이 바뀌었습니다');expect(await proof(page,info,'stale-day-hashes',nextDay)).toEqual(nextDay);
 await record(page,info,'negative-stale');
});

test('edited input and repeated escape close cancel without writes and retain focus',async({page},info)=>{
 await open(page);const before=await snapshot(page);
 for(let i=0;i<3;i++){await preview(page,encode(compact()),false);await page.keyboard.press('Escape');await expect(page.locator('#backupModal')).toBeHidden();await expect(page.locator('#btnBackup')).toBeFocused();await page.locator('#btnBackup').click();await expect(page.locator('#bkDiag [data-storage-check=copy]')).toHaveAttribute('data-state','available');await expect(page.locator('#bkDiag [data-storage-check=copy]')).toBeVisible();const reopened=await snapshot(page);expect({...reopened,writes:before.writes}).toEqual(before);}
 const settled=await snapshot(page);await preview(page,encode(compact()));await page.locator('#bkIn').fill(encode({...compact(),s:999}));await expect(page.locator('#bkPreview')).toBeHidden();expect(await proof(page,info,'edited-cancel-hashes',settled)).toEqual(settled);await record(page,info,'negative-interruption');
});

for(const mode of ['throw','silent'])test(`save ${mode} retains memory warning recovery and immediate copy`,async({page},info)=>{
 await open(page);const before=await snapshot(page);await page.evaluate(mode=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY){if(mode==='throw')throw new DOMException('owned denial','QuotaExceededError');return;}return original.call(this,key,value);};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(value){window.copiedBackup=value;return Promise.resolve();}}});},mode);
 await preview(page,encode(compact()));await confirm(page);await expect(page.locator('#bkRes')).toHaveClass('bkres ng');await expect(page.locator('#bkRes')).toContainText('기기 저장을 확인하지 못했습니다');await expect(page.locator('#bkRecoveryOut')).toHaveValue(before.output);
 expect((await state(page)).scrap).toBe(71);expect((await snapshot(page)).local).toBe(before.local);expect(await page.evaluate(()=>storeWarn)).not.toBe('');await page.locator('#bkRes').scrollIntoViewIfNeeded();await shot(page,info,'save-warning-before-copy');
 const current=await page.locator('#bkOut').inputValue();await page.locator('#bkCopy').click();await expect.poll(()=>page.evaluate(()=>window.copiedBackup)).toBe(current);expect(decode(current).progress.s).toBe(71);await expect(page.locator('#bkRes')).toContainText('기기 저장을 확인하지 못했습니다');await expect(page.locator('#warnGo')).toBeVisible();
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('#warnGo').click();await expect(page.locator('#bkRecoveryOut')).toHaveValue(before.output);await expect(page.locator('#bkRes')).toContainText('기기 저장을 확인하지 못했습니다');await page.locator('#bkRes').scrollIntoViewIfNeeded();await record(page,info,'negative-save-'+mode);
});


test('successful restore updates same-dialog summary copy backup timestamp and keyboard focus',async({page},info)=>{
 await page.setViewportSize({width:1280,height:900});await open(page);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(value){window.copiedBackup=value;return Promise.resolve();}}}));
 const before=await snapshot(page);await preview(page,encode(compact()));await confirm(page);
 await expect(page.locator('#bkLoad')).toBeFocused();await expect(page.locator('#bkRes')).toHaveClass('bkres ok');
 const restored=await snapshot(page);expect(restored.output).not.toBe(before.output);expect(restored.summary).not.toBe(before.summary);
 expect(restored.summary).toBe(`캐릭터 ${Object.keys(restored.state.owned).length}장 · 아이템 ${Object.keys(restored.state.items).length}종 · 스크랩 ${restored.state.scrap}장이 담겨 있습니다.`);
 await page.locator('#bkCopy').click();await expect.poll(()=>page.evaluate(()=>window.copiedBackup)).toBe(restored.output);
 const copied=await state(page);expect(copied.backupAt).toBeGreaterThan(restored.state.backupAt);expect({...copied,backupAt:restored.state.backupAt}).toEqual(restored.state);
 await expect.poll(()=>mirror(page)).toEqual(copied);await capture(info,'success-copy',{before,restored,copied,clipboard:await page.evaluate(()=>window.copiedBackup)});await record(page,info,'happy-copy-desktop');
});
