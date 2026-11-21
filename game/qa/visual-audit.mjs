import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '/Users/ethanlee/Desktop/steel-grade-gatcha/game-edition/node_modules/playwright/index.mjs';
import {collectPageSnapshot,STYLE_PROPS,lintSnapshot,hasFailures} from '/Users/ethanlee/.codex/plugins/cache/sisyphuslabs/omo/5.1.65/skills/frontend/scripts/detect/index.ts';
import {SCRIPT_ERROR_PROBE} from '/Users/ethanlee/.codex/plugins/cache/sisyphuslabs/omo/5.1.65/skills/frontend/scripts/detect/snapshot/collect.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch();
const rows=[];
try{
  for(const width of [390,1280]) for(const colorScheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.addInitScript(SCRIPT_ERROR_PROBE);
    await page.goto('http://127.0.0.1:8779/');await page.locator('.ship-button').first().waitFor();
    const capture=async state=>{
      await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('img:not([loading=lazy])')].map(img=>img.decode().catch(error=>{if(!(error instanceof DOMException)) throw error;})));await document.fonts.ready;});
      const snapshot=await page.evaluate(`(${collectPageSnapshot.toString()})(${JSON.stringify(STYLE_PROPS)},20000)`);
      const findings=lintSnapshot(snapshot,{config:{allowFonts:['system-ui','-apple-system','BlinkMacSystemFont','Apple SD Gothic Neo','Malgun Gothic','AppleMyungjo','Batang','serif','sans-serif']}});
      const file=`visual-${width}-${colorScheme}-${state}.png`;
      await page.screenshot({path:path.join(root,file)});rows.push({width,colorScheme,state,file,findings});
    };
    await capture('workshop');
    await page.getByRole('button',{name:/10연 출하/}).click();await page.locator('.result-grid').waitFor();await capture('ten');
    await page.locator('.tile-open').first().click();await capture('detail');
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'도감에서 보기'}).click();await capture('collection');
    await context.close();
  }
}finally{await browser.close();}
await fs.writeFile(path.join(root,'visual-audit.json'),JSON.stringify({rows,failed:rows.some(r=>hasFailures(r.findings))},null,2));
console.log(JSON.stringify(rows.map(({width,colorScheme,state,findings})=>({width,colorScheme,state,findings:findings.map(f=>({rule:f.ruleId,severity:f.severity,message:f.message,location:f.location}))})),null,2));
