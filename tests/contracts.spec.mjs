import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { appURL, baselineURL, root, fixedTime } from './helpers/paths.mjs';
import { openApp, state, mirror, capture, catalog, destination, settings } from './helpers/app.mjs';
import { normalizeCatalog, namespaceFor } from './game/namespaces.mjs';
const currentEdition=process.env.SGG_EDITION || 'education';
const baseline = JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`, 'utf8'));
const pageErrors=new WeakMap();
test.beforeEach(async({page})=>{const errors=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));});
const names = async (page, id) => page.locator(`#${id}`).innerText();
const click = async (page,id) => {
  if(['btnScrap3','btnScrap4'].includes(id)&&new URL(page.url()).origin===new URL(appURL).origin&&currentEdition==='game') await destination(page,'craft');
  if(id==='btnQuiz') await destination(page,new URL(page.url()).origin===new URL(appURL).origin&&currentEdition==='game'?'research':'learn');
  await page.getByRole('button',{name:await names(page,id),exact:true}).click();
};
async function revealProbe(page, name) {
  const snapshots=[];
  await page.exposeFunction('recordRevealEntry',value=>snapshots.push(value));
  await page.evaluate(name=>{
    const original=window[name];
    window[name]=function(...args) {
      window.recordRevealEntry({args,state:JSON.parse(JSON.stringify(S)),saved:JSON.parse(localStorage.getItem(KEY))});
      return original.apply(this,args);
    };
  },name);
  return snapshots;
}
for (const [site,url] of [['baseline',baselineURL],['current',appURL]]) {
  const edition=site==='baseline'?'education':currentEdition;
  test.describe(site,()=>{
    test.afterEach(async ({page},info)=>{
      if(!page.isClosed()) await capture(info,'observed',{url,state:await page.evaluate(()=>typeof S==='undefined'?null:S),saved:await page.evaluate(()=>localStorage.getItem(KEY))});
      expect(pageErrors.get(page),'uncaught page exceptions').toEqual([]);
    });
    test('@education-data catalog IDs candidates quiz answers properties and all item compatibility',async({page},info)=>{
      const hash=await openApp(page,url,'crafting-ready');
      const actual=await page.evaluate(catalog);
      expect(normalizeCatalog(actual,edition)).toEqual(baseline);
      expect(actual.pool).toHaveLength(44); expect(actual.cards).toHaveLength(45);
      expect(actual.pool).not.toContain('qp-1470');
      expect(actual.parts).toHaveLength(35); expect(actual.cars).toHaveLength(8); expect(actual.items).toHaveLength(14);
      expect(actual.cards.filter(c=>c.alt)).toHaveLength(2);
      expect(actual.rates).toEqual({'1':.45,'2':.35,'3':.15,'4':.05});
      expect(Object.values(actual.rare)).toEqual([.5,.5,.5,.5]);
      const keys=namespaceFor(edition);expect(actual.keys).toEqual({save:keys.save,toon:keys.toon});
      const fits=await page.evaluate(()=>Object.fromEntries(ITEMS.map(it=>[it.key,fitOwned(it.key)])));
      expect(fits).toEqual(Object.fromEntries(baseline.items.map(it=>[it.key,it.fit])));
      await capture(info,'catalog-hash',{hash,cards:45,parts:35,cars:8,items:14});
    });
    test('RNG exact grade boundaries rare half weight and pickup cap',async({page},info)=>{
      await openApp(page,url);
      const grades=await page.evaluate(()=>[0,.45,.4500001,.7999999,.8,.8000001,.95,.9500001,.999999].map(r=>{
        let count=0; Math.random=()=>count++===0?r:0; return lvOf(findChar(weightedPick()));
      }));
      expect(grades).toEqual([1,1,2,2,3,3,3,4,4]);
      const rare=await page.evaluate(()=>[.3333333,.3333334].map(r=>{Math.random=()=>r;return pickIn(['poo-PHS','ssial-1470M']);}));
      expect(rare).toEqual(['poo-PHS','ssial-1470M']);
      await page.clock.setFixedTime(new Date('2026-09-27T00:00:00+09:00'));
      const pickup=await page.evaluate(()=>[.949999,.950001].map(r=>{Math.random=()=>r;return pickIn(['poo-270C','ssial-270C']);}));
      expect(pickup).toEqual(['poo-270C','ssial-270C']);
      await capture(info,'rng-boundaries',{grades,rare,pickup});
    });
    test('all promotion boundaries and personal 24 hour windows',async({page},info)=>{
      await openApp(page,url);
      const rows=[];
      for(const promo of baseline.promos) for(const at of [promo.from-1,promo.from,promo.to-1,promo.to]) {
        await page.clock.setFixedTime(new Date(at));
        const active=baseline.promos.find(p=>p.from<=at&&at<p.to);
        const observed=await page.evaluate(()=>({on:promoOn(),pull:pullMax(),quiz:quizMax(),order:orderMax(),pick:pickFam()}));
        expect(observed).toEqual({on:!!active,pull:active?.pullMax??1,quiz:active?.quizMax??3,order:active?.orderMax??1,pick:active?.pick??''});
        rows.push({at,observed});
      }
      await page.clock.setFixedTime(new Date(fixedTime));
      await page.evaluate(()=>{S.pullAt=Date.now()-DAY+1;S.pullUsed=1;S.quizAt=S.pullAt;S.quizUsed=3;});
      expect(await page.evaluate(()=>[pullBaseLeft(),quizLeft(),readyIn(S.pullAt)])).toEqual([0,0,1]);
      await page.clock.setFixedTime(new Date(Date.parse(fixedTime)+1));
      expect(await page.evaluate(()=>[pullBaseLeft(),quizLeft(),readyIn(S.pullAt)])).toEqual([1,3,0]);
      await capture(info,'promo-boundaries',rows);
    });
    test('single pull base priority extra consumption duplicate scrap and last copy protection',async({page})=>{
      await openApp(page,url);
      await page.evaluate(()=>{S.extra=2;save();refresh();});
      const entries=await revealProbe(page,'showPull');
      await click(page,'btnPull');
      await expect.poll(()=>entries.length).toBe(1);
      expect(entries[0].saved).toEqual(entries[0].state);
      expect(entries[0].saved.stock['poo-270C']).toBe(1);
      let s=await state(page); expect(s.pullUsed).toBe(1); expect(s.extra).toBe(2); expect(s.stock['poo-270C']).toBe(1);
      expect(await page.getByRole('button',{name:'한 장 스크랩으로',exact:true}).count()).toBe(0);
      await click(page,'btnPull');
      s=await state(page);expect(s.extra).toBe(1);expect(s.stock['poo-270C']).toBe(2);
      await page.getByRole('button',{name:'한 장 스크랩으로',exact:true}).click();
      s=await state(page);expect(s.stock['poo-270C']).toBe(1);expect(s.scrap).toBe(1);expect(s.owned['poo-270C']).toBe(true);
      await expect(page.getByRole('button',{name:'스크랩 1장 · 창고 1장',exact:true})).toBeDisabled();
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(s);
    });
    test('legacy pending compensation only once and discovered zero stock remains discovered',async({page})=>{
      await openApp(page,url,'discovered-zero-stock');
      expect(await page.evaluate(()=>[!!S.owned['poo-270C'],stockOf('poo-270C')])).toEqual([true,0]);
      await page.evaluate(()=>{S.pending='poo-270C';sweepPending();sweepPending();});
      expect(await page.evaluate(()=>[S.scrap,S.pending,stockOf('poo-270C')])).toEqual([1,'',0]);
    });
    for(const lv of [3,4]) test(`completed-lv${lv} fallback costs ${lv===3?5:10} adds one inventory discovery unchanged`,async({page})=>{
      await openApp(page,url,`completed-lv${lv}`);
      const before=await state(page);
      const chosen=await page.evaluate(lv=>missingIn(lv)[0],lv);
      await click(page,`btnScrap${lv}`);
      const after=await state(page);
      expect(after.scrap).toBe(before.scrap-(lv===3?5:10));expect(after.owned).toEqual(before.owned);
      expect(after.stock).toEqual({...before.stock,[chosen]:(before.stock[chosen]||0)+1});
    });
    test('exchange prefers undiscovered cards and insufficient exchange is unchanged @contract-negative',async({page})=>{
      await openApp(page,url);
      await page.evaluate(()=>{S.owned[missingIn(3)[0]]=true;S.scrap=5;refresh();});
      const chosen=await page.evaluate(()=>missingIn(3)[0]);
      await click(page,'btnScrap3');
      expect((await state(page)).stock[chosen]).toBe(1);expect((await state(page)).scrap).toBe(0);
      const before=await state(page);
      await page.evaluate(()=>scrapPull(4,SCRAP_LV4));
      expect(await state(page)).toEqual(before);
    });
    test('ten pull 20 scrap ten cards LV3 guarantee quotas untouched saved before reveal',async({page})=>{
      await openApp(page,url,'mid-progress');
      const before=await state(page);
      const entries=await revealProbe(page,'showTen');
      await click(page,'btnTen');
      await expect.poll(()=>entries.length).toBe(1);
      expect(entries[0].saved).toEqual(entries[0].state);
      const ids=entries[0].args[0];expect(ids).toHaveLength(10);
      expect(ids.slice(0,9)).toEqual(Array(9).fill('poo-270C'));
      expect(await page.evaluate(id=>lvOf(findChar(id)),ids[9])).toBeGreaterThanOrEqual(3);
      const after=await state(page);
      const expectedStock={...before.stock};for(const id of ids)expectedStock[id]=(expectedStock[id]||0)+1;
      expect(after.stock).toEqual(expectedStock);
      expect(after.scrap).toBe(before.scrap-20);expect(after.pullAt).toBe(before.pullAt);expect(after.pullUsed).toBe(before.pullUsed);expect(after.extra).toBe(before.extra);
      expect(Object.values(after.stock).reduce((a,b)=>a+b,0)-Object.values(before.stock).reduce((a,b)=>a+b,0)).toBe(10);
      expect(await page.evaluate(()=>Object.keys(S.stock).some(id=>lvOf(findChar(id))>=3))).toBe(true);
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)))).toEqual(after);
      await page.reload();expect(await state(page)).toEqual(after);
    });
    test('@contract-negative scrap19 ten pull insufficient craft malformed SGG1 leave full state unchanged',async({page})=>{
      await openApp(page,url,'crafting-short');
      await page.evaluate(()=>{S.scrap=19;save();refresh();});
      const before=await state(page);
      const results=await page.evaluate(()=>{tenPull();return [craft(PARTS[0].key),readCode('SGG1.not-valid'),readCode('notSGG1')];});
      expect(results).toEqual([false,null,null]);expect(await state(page)).toEqual(before);
      await settings(page);
      await page.getByRole('button',{name:'진행 백업 · 복원',exact:true}).click();
      await page.getByPlaceholder('받아 둔 백업 코드를 붙여 넣으세요').fill('SGG1.corrupt!');
      await page.getByRole('button',{name:edition==='game'?'게임용 백업 미리보기':'이 코드로 되돌리기',exact:true}).click();
      await expect(page.locator('#bkRes')).toContainText('코드');expect(await state(page)).toEqual(before);
    });
    test('craft every part explicit picks exact consumption already crafted no mutation',async({page},info)=>{
      await openApp(page,url,'crafting-ready');
      const rows=[];
      for(const part of baseline.parts) {
        await page.evaluate(()=>{S.stock=Object.fromEntries(POOL.map(id=>[id,10]));S.parts={};});
        const before=await state(page);const picks=part.need.map(slot=>slot.any[0]);
        expect(await page.evaluate(({key,picks})=>craft(key,picks),{key:part.key,picks})).toBe(true);
        const expected={...before.stock}; for(const id of picks) expected[id]--;
        const after=await state(page);expect(after.stock).toEqual(expected);expect(after.owned).toEqual(before.owned);expect(after.parts[part.key].use).toEqual(picks);
        expect(await page.evaluate(key=>craft(key),part.key)).toBe(false);expect(await state(page)).toEqual(after);rows.push({part:part.key,picks,stock:after.stock});
      }
      await capture(info,'craft35',rows);
    });
    test('craft preference abundant then low LV duplicate slot reservation @contract-negative',async({page})=>{
      await openApp(page,url,'crafting-short');
      const result=await page.evaluate(()=>{
        S.stock={'poo-270C':2,'poo-PHS':3};
        const p={need:[{any:['poo-PHS','poo-270C']}]};
        const abundant=partPlan(p);S.stock['poo-PHS']=2;const tie=partPlan(p);
        const repeat={need:[{any:['poo-270C']},{any:['poo-270C']},{any:['poo-270C']}]};
        const short=partPlan(repeat);S.stock['poo-270C']=3;const enough=partPlan(repeat);
        return {abundant,tie,short,enough};
      });
      expect(result).toEqual({abundant:['poo-PHS'],tie:['poo-270C'],short:null,enough:['poo-270C','poo-270C','poo-270C']});
    });
    test('QP reveal and one-time development exact cost',async({page})=>{
      await openApp(page,url,'qp-ready');
      expect(await page.evaluate(()=>qpRevealed())).toBe(true);
      await page.evaluate(()=>openDevelop());
      await page.getByRole('button',{name:/^개발 —/}).click();
      const after=await state(page);expect(after.scrap).toBe(0);expect(after.stock['ssial-1470M']).toBeUndefined();expect(after.stock['ssial-1180Y']).toBeUndefined();expect(after.stock['qp-1470']).toBe(1);expect(after.owned['qp-1470']).toBe(true);
      await page.evaluate(()=>openDevelop());expect(await state(page)).toEqual(after);
    });
    test('QP missing discovery ingredient or scrap prevents development @contract-negative',async({page})=>{
      await openApp(page,url,'qp-ready');
      const fixture=await state(page);
      for(const id of ['ssial-1470M','ga-1470H','poo-PHS']) {
        await page.evaluate(({fixture,id})=>{applySaved(structuredClone(fixture));delete S.owned[id];}, {fixture,id});
        expect(await page.evaluate(()=>qpRevealed())).toBe(false);
      }
      for(const patch of [{scrap:9},{stock:{'ssial-1470M':1}}]) {
        await page.evaluate(({fixture,patch})=>{applySaved({...structuredClone(fixture),...patch});refresh();openDevelop();},{fixture,patch});
        const before=await state(page);
        await expect(page.getByRole('button',{name:'소재가 모자랍니다',exact:true})).toBeDisabled();
        await page.keyboard.press('Escape');expect(await state(page)).toEqual(before);
      }
    });
    test('QP covers eligible slots only explicit ordinary consumes inventory @contract-negative',async({page})=>{
      await openApp(page,url,'qp-owned');
      const result=await page.evaluate(()=>{
        const p=PARTS.find(p=>p.need.some(s=>s.any.some(id=>QP_KEY.includes(id))));
        const before=JSON.parse(JSON.stringify(S)); const auto=partPlan(p);craft(p.key);
        const autoAfter=JSON.parse(JSON.stringify(S));applySaved(structuredClone(before));
        const picks=p.need.map(s=>s.any[0]);const explicit=partPlan(p,picks);craft(p.key,picks);
        return {p,before,auto,autoAfter,explicit,after:S,uncovered:qpCovers({any:['poo-270C']})};
      });
      expect(result.uncovered).toBe(false);
      result.p.need.forEach((slot,i)=>{if(slot.any.some(id=>['ssial-1470M','ga-1470H','poo-PHS'].includes(id)))expect(result.auto[i]).toBe('qp-1470');});
      const expected={...result.before.stock};for(const id of result.explicit)if(id!=='qp-1470')expected[id]--;
      expect(result.after.stock).toEqual(expected);
      const freeExpected={...result.before.stock};for(const id of result.auto)if(id!=='qp-1470')freeExpected[id]--;
      expect(result.autoAfter.stock).toEqual(freeExpected);expect(result.autoAfter.stock['qp-1470']).toBe(result.before.stock['qp-1470']);
    });
    test('garage selection cancellation then eighth confirmation consumes all35 parts',async({page})=>{
      await openApp(page,url,'seven-cars');const before=await state(page);const car=baseline.cars[7];
      await destination(page,'garage');
      await page.getByRole('button',{name:`${car.tag} ${car.body}`,exact:true}).click();
      expect(await state(page)).toEqual(before);
      await page.reload();expect(await state(page)).toEqual(before);
      await page.getByRole('button',{name:`${car.tag} ${car.body}`,exact:true}).click();
      await page.getByRole('button',{name:site==='baseline'?`${car.tag} · ${car.body}으로 받기`:`${car.tag} · 조립 확정`,exact:true}).click();
      const after=await state(page);expect(after.parts).toEqual({});expect(after.cars).toHaveLength(8);expect(after.cars[7]).toEqual({k:car.key,at:Date.parse(fixedTime)});
      expect(await page.evaluate(()=>allCarsDone())).toBe(true);
    });
    for(const [pass,extra] of [[true,0],[true,2],[true,3],[false,0],[false,2]]) test(`quiz five pass=${pass} initialExtra=${extra} reward and disabled resubmission`,async({page})=>{
      await openApp(page,url);
      await page.evaluate(extra=>{S.extra=extra;save();refresh();},extra);
      await click(page,'btnQuiz');
      for(let i=0;i<5;i++) {
        const answer=await page.evaluate(pass=>{const q=qState.qs[qState.i];return q.o[pass?q.a:(q.a+1)%q.o.length];},pass);
        const button=page.getByRole('button',{name:answer,exact:true});await button.click();await expect(button).toBeDisabled();
        await page.getByRole('button',{name:i===4?'결과 보기':'다음 문제',exact:true}).click();
      }
      const s=await state(page);expect(s.extra).toBe(pass?Math.min(extra+1,3):extra);expect(s.quizUsed).toBe(pass?1:0);
      await page.getByRole('button',{name:'확인',exact:true}).click();expect(await state(page)).toEqual(s);
    });
    test('quiz exhausted personal quota disables new reward @contract-negative',async({page})=>{
      await openApp(page,url);await page.evaluate(()=>{S.quizAt=Date.now();S.quizUsed=3;refresh();});
      await expect(page.locator('#btnQuiz')).toBeDisabled();const before=await state(page);
      expect(await page.evaluate(()=>quizReady())).toBe(false);expect(await state(page)).toEqual(before);
    });
    test('all14 orders wrong response unchanged correct item and compatible equip',async({page},info)=>{
      await openApp(page,url,'crafting-ready');const rows=[];
      for(const order of baseline.orders) {
        await page.evaluate(item=>{S.items={};S.orderDay=today();S.orderKey=item;S.orderDone=0;refresh();openPick();},order.item);
        const before=await state(page);const wrong=baseline.items.find(it=>it.key!==order.item);const right=baseline.items.find(it=>it.key===order.item);
        await page.getByRole('button',{name:`${wrong.tag} ${wrong.sub}`,exact:true}).click();expect(await state(page)).toEqual(before);
        await page.getByRole('button',{name:`${right.tag} ${right.sub}`,exact:true}).click();expect((await state(page)).items[order.item]).toBe(1);expect((await state(page)).orderDone).toBe(1);
        await page.getByRole('button',{name:'보유 소재에 장착',exact:true}).click();
        const id=right.fit[0];const c=baseline.cards.find(c=>c.id===id);
        const label=await page.evaluate(id=>{const c=findChar(id);return c.fam.name+' '+c.g;},id);
        const acquired=await state(page);
        await page.getByRole('button',{name:label,exact:true}).click();
        if(edition==='game'){expect(await state(page)).toEqual(acquired);await page.locator('#equipConfirm').click();}
        expect((await state(page)).items[order.item]).toBe(id);
        await page.getByRole('button',{name:'확인',exact:true}).click();rows.push({item:order.item,equipped:id,materialGrade:c.g});
      }
      expect(rows).toHaveLength(14);await capture(info,'orders14',rows);
    });
    test('legacy normalization localStorage IDB SGG1 roundtrip excludes separate toon key',async({page},info)=>{
      await openApp(page,url,'legacy-save');
      expect((await state(page)).stock).toEqual({'poo-270C':1});expect((await state(page)).pullUsed).toBe(1);expect((await state(page)).cars).toEqual([{k:baseline.cars[0].key,at:123}]);
      const fixture=JSON.parse(await fs.readFile(`${root}/tests/fixtures/equipped-items.json`,'utf8'));
      await page.evaluate(f=>{applySaved(f.state);localStorage.setItem(TOON_SEEN,'toon-sentinel');save();},fixture);
      const before=await state(page);await expect.poll(()=>mirror(page)).toEqual(before);
      const code=await page.evaluate(()=>makeCode());expect(code).toMatch(edition==='game'?/^SGG-GAME1\./:/^SGG1\./);
      const packed=await page.evaluate(code=>readCode(code),code);expect(Object.keys(packed).sort()).toEqual(['v','o','i','s','x','p','q','u','pu','od','ok','on','pt','st','cr'].sort());
      await page.evaluate(code=>applyCode(readCode(code)),code);
      expect((await state(page)).owned).toEqual(before.owned);expect((await state(page)).items).toEqual(before.items);expect((await state(page)).stock).toEqual(before.stock);
      expect(await page.evaluate(()=>localStorage.getItem(TOON_SEEN))).toBe('toon-sentinel');
      await page.evaluate(()=>localStorage.removeItem(KEY));await page.reload();
      await expect.poll(()=>state(page)).toMatchObject({owned:before.owned,items:before.items,stock:before.stock});
      await capture(info,'storage',{before,packed,code,restored:await state(page)});
    });
    test('save denied reports failure without changing progress @contract-negative',async({page},info)=>{
      await openApp(page,url,'mid-progress');const before=await state(page);
      const result=await page.evaluate(()=>{
        const original=Storage.prototype.setItem;
        Storage.prototype.setItem=function(){throw new DOMException('fixture quota','QuotaExceededError');};
        try {save();return {warn:storeWarn,visible:document.body.innerText.includes(storeWarn)};}
        finally {Storage.prototype.setItem=original;}
      });
      expect(result).toEqual({warn:'저장 공간이 가득 찼습니다',visible:true});
      expect(await state(page)).toEqual(before);await capture(info,'storage-denied',result);
    });
  });
}
