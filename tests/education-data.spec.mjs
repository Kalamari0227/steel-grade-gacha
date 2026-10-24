import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {appURL,root,evidenceRoot} from './helpers/paths.mjs';
import {openApp,destination,catalog,capture} from './helpers/app.mjs';
const baseline=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/catalog.json'),'utf8'));
const machine=x=>({
  pool:x.pool,
  cards:x.cards.map(c=>({id:c.id,code:c.code,g:c.g,fam:c.fam,spec:c.spec,back:c.back,alt:!!c.alt})),
  parts:x.parts.map(p=>({key:p.key,no:p.no,need:p.need.map(sl=>sl.any)})),
  cars:x.cars.map(c=>c.key),items:x.items.map(i=>({key:i.key,fit:i.fit})),
  orders:x.orders.map(o=>o.item),quiz:x.quiz.map(q=>({options:q.o,answer:q.a}))
});
async function record(info,name,value){await capture(info,name,value);await fs.mkdir(evidenceRoot,{recursive:true});await fs.writeFile(path.join(evidenceRoot,name+'.json'),JSON.stringify(value,null,2));}

test('@education-data full machine ID value and compatibility parity',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned'),actual=await page.evaluate(catalog);
  expect(machine(actual)).toEqual(machine(baseline));
  expect(actual.pool).toHaveLength(44);expect(actual.pool).not.toContain('qp-1470');
  expect(actual.cards).toHaveLength(45);expect(actual.parts).toHaveLength(35);expect(actual.items).toHaveLength(14);
  expect(actual.cars).toHaveLength(8);expect(actual.quiz).toHaveLength(413);
  expect(actual.cards.reduce((n,c)=>n+1+(c.alt?1:0),0)).toBe(47);
  const wire=actual.cards.filter(c=>c.fam==='tarae');expect(wire).toHaveLength(9);
  for(const c of wire){expect(c.spec.ra).toBeTruthy();expect(c.duct.v).toBe(c.spec.ra);}
  const protectedData=await page.evaluate(()=>({
    qp:{id:QP_ID,reveal:QP_KEY,need:QP_NEED.map(slot=>slot.any),scrap:QP_SCRAP},
    states:allChars().map(c=>({id:c.id,level:lvOf(c),use:USE[c.id]||'—'})),
    eligible:PARTS.flatMap(p=>p.need.flatMap((sl,index)=>sl.any.some(id=>QP_KEY.includes(id))?[{part:p.key,index}]:[]))
  }));
  expect(protectedData.qp).toEqual({id:'qp-1470',reveal:['ssial-1470M','ga-1470H','poo-PHS'],need:[['ssial-1470M'],['ssial-1180Y','ga-1180Y']],scrap:10});
  expect(protectedData.eligible).toHaveLength(5);
  expect(protectedData.states.find(c=>c.id==='ssial-SEDDQ').level).toBe(3);
  expect(protectedData.states.find(c=>c.id==='ssial-1180Y').level).toBe(3);
  await record(info,'data-parity',{hash,counts:{cards:45,states:47,parts:35,items:14,cars:8,quiz:413},protectedData,scientificReviewOfAllQuiz:false});
});

test('@education-data rendered47 numeric value unit and side parity',async({page},info)=>{
  const hash=await openApp(page,appURL,'qp-owned');
  const before=await page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY)}));
  await destination(page,'dex');const rows=[];
  for(const card of baseline.cards){
    await page.locator('#dex button[data-card-id="'+card.id+'"]').click();
    for(const side of card.alt?[0,1]:[0]){
      if(side)await page.locator('#cardFlip').click();
      const sp=side?card.back:card.spec,label=sp.ra?'단면수축률 RA':'연신율 EL';
      await expect(page.locator('#cardBox')).toHaveAttribute('data-card-id',card.id);
      await expect(page.locator('#cardBox')).toHaveAttribute('data-side',side?'alt':'front');
      await expect(page.locator('#cardTS')).toHaveText(sp.ts+' MPa');
      await expect(page.locator('#cardDuctLabel')).toHaveText(label);
      await expect(page.locator('#cardDuct')).toHaveText((sp.ra||sp.el)+' %');
      rows.push({id:card.id,side:side?'alt':'front',ts:sp.ts,tsUnit:'MPa',duct:label,ductValue:sp.ra||sp.el,ductUnit:'%'});
    }
    await page.keyboard.press('Escape');
  }
  expect(rows).toHaveLength(47);
  const after=await page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY)}));expect(after).toEqual(before);
  await record(info,'education-rendered-values',{hash,rows,before,after});
});

