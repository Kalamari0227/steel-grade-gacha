import {test,expect} from '@playwright/test';
import path from 'node:path';
import {createEngine} from '../src/engine.mjs';
test('ten cards wait for input and replay the saved order including the rare reveal',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{let calls=0;Math.random=()=>calls++<18?0:(calls%2?0.99:0);});
  // 10연에는 스크랩 20이 든다. 새 프로필은 스크랩이 없으므로 한 번만 저장을 심는다.
  const seedRaw=JSON.stringify({...createEngine({storage:{getItem:()=>null,setItem(){}}}).state(),scrap:20});
  await page.addInitScript(raw=>{if(sessionStorage.getItem('scrap-seeded'))return;sessionStorage.setItem('scrap-seeded','1');localStorage.setItem('sgg_game_save_v1',raw);},seedRaw);
  await page.goto('/#ship');
  await page.getByRole('button',{name:/10연 출하/}).click();
  await page.getByRole('button',{name:'봉인 열기'}).click();
  const readSave=()=>page.evaluate(()=>localStorage.getItem('sgg_game_save_v1'));
  const raw=await readSave(),entries=JSON.parse(raw).results.cards;
  const data=await (await page.request.get('/data.json')).json();
  for(let index=0;index<10;index++){
    const card=data.cards.find(c=>c.id===entries[index].id);
    await expect(page.locator('.draw-count')).toHaveText((index+1)+' / 10');
    await expect(page.locator('.draw-caption h2')).toHaveText(card.familyName+' '+card.grade);
    if(index===0){await page.waitForTimeout(2200);await expect(page.locator('.draw-count')).toHaveText('1 / 10');}
    if(index===9){
      await expect(page.locator('.impact-rare .draw-rank')).toContainText('RARE');
      await page.locator('.stage-character img').evaluate(img=>img.decode());
      await page.screenshot({path:path.resolve(info.config.rootDir,'../rare-reveal-'+info.project.name+'.png'),animations:'disabled'});
    }
    await page.getByRole('button',{name:index===9?'열 장 모두 보기':'다음 카드'}).click();
  }
  await expect(page.locator('.result-grid .tile')).toHaveCount(10);
  await page.getByRole('button',{name:'10연 공개 다시 보기'}).click();
  await page.getByRole('button',{name:'봉인 열기'}).click();
  await expect(page.locator('.draw-count')).toHaveText('1 / 10');
  await page.getByRole('button',{name:'건너뛰기'}).click();
  expect(await readSave()).toBe(raw);
});
