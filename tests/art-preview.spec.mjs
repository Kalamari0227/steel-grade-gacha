import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { root, appURL } from './helpers/paths.mjs';
import { openApp, capture, destination } from './helpers/app.mjs';
for(const group of ['pilot','po','cr','ga','wire-special'])test(`@art-${group} each card front back and thumbnail decode capture`,async({page},info)=>{
  const manifest=JSON.parse(await fs.readFile(`${root}/docs/design/asset-manifest.json`,'utf8'));
  const cards=manifest.cards.filter(c=>manifest.groups[group].includes(c.newPath));expect(cards.length).toBeGreaterThan(0);
  const hash=await openApp(page,appURL,'qp-owned');const rows=[];
  await destination(page,'dex');
  for(const card of cards) {
    const label=await page.evaluate(id=>{const c=findChar(id);return c.fam.name+' '+c.g;},card.cardId);
    const thumbnail=page.getByRole('button',{name:`${label} 크게 보기`,exact:true});
    const exposure=()=>thumbnail.evaluate(button=>{const rect=button.getBoundingClientRect(),img=button.querySelector('img');return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,inViewport:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth,loading:img.loading,complete:img.complete,naturalWidth:img.naturalWidth};});
    const thumbnailBefore=await exposure();await thumbnail.scrollIntoViewIfNeeded();await expect(thumbnail).toBeVisible();const thumbnailAfter=await exposure();expect(thumbnailAfter.inViewport).toBe(true);
    const thumbSize=await thumbnail.locator('img').first().evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};});
    expect(thumbSize.width).toBeGreaterThan(0);expect(thumbSize.height).toBeGreaterThan(0);
    await thumbnail.click();
    if(card.side==='alt')await page.getByRole('button',{name:/열처리 후|뒤집/}).click();
    const expected=await page.evaluate(({id,side})=>(side==='alt'?IMG_ALT:IMG)[id],{id:card.cardId,side:card.side});
    const imageSelector=process.env.SGG_EDITION==='game'?'#cardBox .game-card-character img':'#cardBox img';
    const image=page.locator(imageSelector).first();await expect(image).toHaveAttribute('src',expected);
    const size=await image.evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};});
    expect(size.width).toBeGreaterThan(0);expect(size.height).toBeGreaterThan(0);
    await page.waitForFunction(imageSelector=>{
      const modal=document.getElementById('cardModal');
      const img=document.querySelector(imageSelector);
      return modal&&img&&getComputedStyle(modal).opacity==='1'&&getComputedStyle(img).opacity==='1'&&
        modal.getAnimations({subtree:true}).every(animation=>animation.playState==='finished');
    },imageSelector);
    const file=info.outputPath(`${card.cardId}-${card.side}.png`);await page.screenshot({path:file});
    rows.push({id:card.cardId,side:card.side,size,thumbSize,thumbnailBefore,thumbnailAfter,screenshot:file});await page.keyboard.press('Escape');
  }
  await capture(info,`art-${group}`,{hash,rows,visualReview:'Screenshots require separate human/agent visual review; decode is not aesthetic approval.'});
});
