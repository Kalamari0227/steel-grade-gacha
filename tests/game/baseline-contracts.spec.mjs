import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {appURL,baselineURL,root,baselineRoot} from '../helpers/paths.mjs';
import {openApp,capture,catalog,state,mirror,sha} from '../helpers/app.mjs';
import {normalizeCatalog} from './namespaces.mjs';
function compatibility(){
  const pairs=allChars().flatMap(c=>ITEMS.filter(it=>it.fit(c)).map(it=>({cardId:c.id,itemKey:it.key})));
  const placements=pairs.flatMap(p=>findChar(p.cardId).alt?[{...p,side:'front'},{...p,side:'alt'}]:[{...p,side:'front'}]);
  return {pairs,placements};
}
test('original HTTP runtime equals current business catalog and complete compatibility',async({browser},info)=>{
  const observations=[];
  for(const [role,url] of [['original',baselineURL],['current',appURL]]){
    const context=await browser.newContext({timezoneId:'Asia/Seoul',serviceWorkers:'block'});
    try{
      const page=await context.newPage();const opened=await openApp(page,url,'qp-owned');
      const actual=await page.evaluate(catalog),fits=await page.evaluate(compatibility);
      expect(actual.pool).toHaveLength(44);expect(actual.cards).toHaveLength(45);
      expect(actual.quiz).toHaveLength(413);expect(actual.orders).toHaveLength(14);
      expect(actual.items.flatMap(i=>i.fit)).toHaveLength(102);
      expect(fits.pairs).toHaveLength(103);expect(fits.placements).toHaveLength(107);
      expect(fits.pairs).toContainEqual({cardId:'qp-1470',itemKey:'arrow'});
      expect(fits.placements.filter(p=>p.side==='alt')).toEqual([
        {cardId:'poo-PHS',itemKey:'arrow',side:'alt'},
        {cardId:'ga-1470H',itemKey:'arrow',side:'alt'},
        {cardId:'ga-1470H',itemKey:'iron',side:'alt'},
        {cardId:'ga-1470H',itemKey:'spark',side:'alt'},
      ]);
      const saved=await state(page);await expect.poll(()=>mirror(page)).toEqual(saved);
      observations.push({role,url,source:role==='original'?baselineRoot:root,commit:role==='original'?'6784048524c722b7d1057cb28e372b6cce5dc6cf':null,opened,catalog:actual,compatibility:fits,state:saved});
      await page.screenshot({path:info.outputPath(`${role}.png`)});
    }finally{await context.close();}
  }
  const [original,current]=observations;
  expect(normalizeCatalog(current.catalog,process.env.SGG_EDITION || 'education')).toEqual(normalizeCatalog(original.catalog,'education'));
  expect(current.state).toEqual(original.state);expect(current.compatibility).toEqual(original.compatibility);
  const legacy=JSON.parse(await fs.readFile(`${root}/tests/fixtures/catalog.json`,'utf8'));
  expect(original.catalog).toEqual(legacy);
  await capture(info,'runtime-catalog-provenance',{authority:'fresh actual HTTP original runtime; supplemented archive fixture is not runtime proof',observations});
});
test('PWA fixture publishes explicit package files and actual audio MIME on assigned port',async({},info)=>{
  const path=await import('node:path');
  const {startPwaSite}=await import('../helpers/pwa-site.mjs');
  const source=info.outputPath('package-fixture');await fs.mkdir(source,{recursive:true});
  await fs.writeFile(path.join(source,'index.html'),'<title>Owned PWA package fixture</title>');
  await fs.writeFile(path.join(source,'sw.js'),'self.addEventListener("fetch",()=>{});');
  const wave=Buffer.alloc(60);wave.write('RIFF');wave.writeUInt32LE(52,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(16,40);
  await fs.writeFile(path.join(source,'tone.wav'),wave);await fs.writeFile(path.join(source,'unlisted.txt'),'must not publish');
  const manifest={files:['index.html','sw.js','tone.wav']};await fs.writeFile(path.join(source,'package.json'),JSON.stringify(manifest));
  const pkg={root:source,files:JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8')).files};
  for(const name of manifest.files)await fs.chmod(path.join(source,name),0o444);
  const sourceSnapshot=async()=>Promise.all(manifest.files.map(async name=>({name,sha:sha(await fs.readFile(path.join(source,name))),mode:(await fs.stat(path.join(source,name))).mode&0o777})));
  const sourceBefore=await sourceSnapshot();
  const site=await startPwaSite(info,{edition:'game',baseline:pkg,current:pkg});
  try{
    expect((await fetch(site.url+'/index.html')).status).toBe(200);expect((await fetch(site.url+'/sw.js')).status).toBe(200);
    const response=await fetch(site.url+'/tone.wav');expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('audio/wav');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(wave);expect((await fetch(site.url+'/unlisted.txt')).status).toBe(404);
    const published=await site.publishCurrent();expect(published.indexSHA).toBe(site.old.indexSHA);
    const sourceAfter=await sourceSnapshot();expect(sourceAfter).toEqual(sourceBefore);
    await capture(info,'pwa-package',{url:site.url,manifest,audioMime:response.headers.get('content-type'),published,sourceBefore,sourceAfter});
  }finally{await site.close();}
});
