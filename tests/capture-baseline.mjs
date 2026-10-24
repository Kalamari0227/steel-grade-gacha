import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { root, baselineRoot, baselineURL, evidenceRoot, fixedTime } from './helpers/paths.mjs';
import { startServer } from './helpers/server.mjs';
import { catalog, sha } from './helpers/app.mjs';
await fs.mkdir(evidenceRoot, { recursive: true });
const server = await startServer(baselineRoot, Number(new URL(baselineURL).port));
let browser;
try {
  const html = await fs.readFile(`${baselineRoot}/index.html`);
  if (sha(html) !== '1207e159c272c25fe93033ac35f80b6a8a8337dec8d5ed42cf3ec298fcfc7d5b') throw Error('Immutable baseline hash mismatch');
  browser = await chromium.launch();
  const page = await browser.newPage({ timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await page.clock.setFixedTime(new Date(fixedTime));
  await page.addInitScript(() => { Math.random = () => 0; });
  const response = await page.goto(baselineURL);
  if (sha(await response.body()) !== sha(html)) throw Error('Baseline served hash mismatch');
  await page.waitForFunction(() => typeof S !== 'undefined' && !saveHold);
  const data = await page.evaluate(catalog);
  const fixtures = await page.evaluate(() => {
    const fresh = { owned:{}, stock:{}, last:'', extra:0, quizDay:'', items:{}, orderDay:'', orderKey:'', scrap:0, pending:'', pullAt:0, quizAt:0, quizUsed:0, bell:false, belledAt:-1, backupAt:0, orderDone:0, promoSeen:'', promoDone:'', noticeSeen:'', parts:{}, cars:[], pullUsed:0, qpSeen:0 };
    const make = patch => ({ ...structuredClone(fresh), ...patch });
    const allOwned = Object.fromEntries(POOL.map(id => [id, true]));
    const allStock = Object.fromEntries(POOL.map(id => [id, 5]));
    const allParts = Object.fromEntries(PARTS.map(p => [p.key, { at: Date.now()-1000, use:[] }]));
    const mid = make({ owned: { 'poo-270C':true, 'ssial-270C':true }, stock:{'poo-270C':3,'ssial-270C':0}, extra:2, scrap:25, pullAt:Date.now(), pullUsed:1 });
    const qp = make({ owned:Object.fromEntries([...QP_KEY, 'ssial-1180Y'].map(id=>[id,true])), stock:{'ssial-1470M':1,'ssial-1180Y':1}, scrap:10, qpSeen:1 });
    const fixtures = {
      new:make({}), 'mid-progress':mid,
      'discovered-zero-stock':make({owned:{'poo-270C':true},stock:{}}),
      'legacy-save':{owned:{'poo-270C':true},pullAt:Date.now(),car:CARS[0].key,carAt:123},
      'crafting-ready':make({owned:allOwned,stock:allStock}),
      'crafting-short':make({owned:allOwned,stock:{}}),
      'qp-ready':qp, 'qp-owned':make({owned:{...allOwned,[QP_ID]:true},stock:{...allStock,[QP_ID]:1},qpSeen:1}),
      'all-parts':make({owned:allOwned,parts:allParts}),
      'seven-cars':make({owned:allOwned,parts:allParts,cars:CARS.slice(0,7).map(c=>({k:c.key,at:123}))}),
      'all-cars':make({cars:CARS.map(c=>({k:c.key,at:123}))}),
      'equipped-items':make({owned:allOwned,items:Object.fromEntries(ITEMS.map(it=>[it.key,POOL.find(id=>it.fit(findChar(id)))]))}),
      'promo-boundaries':make({}), 'corrupt-code':make({}),
      'reset-ready':make({...mid,bell:true,promoSeen:'seen-preserve',promoDone:'done-preserve',noticeSeen:'old-notice',parts:allParts,cars:[{k:CARS[0].key,at:123}],qpSeen:1,quizUsed:2,quizAt:Date.now(),backupAt:123,belledAt:123}),
    };
    for(const lv of [3,4]) {
      const ids=POOL.filter(id=>lvOf(findChar(id))===lv);
      fixtures[`completed-lv${lv}`]=make({owned:Object.fromEntries(ids.map(id=>[id,true])),stock:Object.fromEntries(ids.map((id,i)=>[id,i%2])),scrap:20});
    }
    return Object.fromEntries(Object.entries(fixtures).map(([name,state])=>[name,{state,toonSeen:name==='reset-ready'?TOON[1].id:'',source:'6784048524c722b7d1057cb28e372b6cce5dc6cf',intent:name}]));
  });
  await fs.mkdir(`${root}/tests/fixtures`, { recursive: true });
  const hashes = {};
  for (const [name, fixture] of Object.entries(fixtures)) {
    fixture.code = await page.evaluate(state => { applySaved(state); return makeCode(); }, fixture.state);
    const text = JSON.stringify(fixture, null, 2) + '\n';
    const path = `${root}/tests/fixtures/${name}.json`;
    try { if ((await fs.readFile(path,'utf8')) !== text) throw Error(`Refusing to overwrite immutable fixture: ${name}`); }
    catch (e) { if(e.code==='ENOENT') await fs.writeFile(path,text,{flag:'wx'}); else throw e; }
    hashes[name] = sha(text);
  }
  const text = JSON.stringify(data,null,2)+'\n';
  const catPath=`${root}/tests/fixtures/catalog.json`;
  try { if(await fs.readFile(catPath,'utf8')!==text) throw Error('Immutable catalog changed'); }
  catch(e) { if(e.code==='ENOENT') await fs.writeFile(catPath,text,{flag:'wx'}); else throw e; }
  await fs.writeFile(`${evidenceRoot}/baseline-fixtures.json`,JSON.stringify({sourceSHA:'6784048524c722b7d1057cb28e372b6cce5dc6cf',servedSHA256:sha(html),fixedTime,fixtureHashes:hashes,catalogSHA256:sha(text)},null,2));
  console.log(`Captured ${Object.keys(fixtures).length} immutable fixtures and catalog`);
} finally {
  await browser?.close(); await server.stop();
  await fs.writeFile(`${evidenceRoot}/baseline-cleanup.json`,JSON.stringify({serverPID:server.pid,serverStopped:true,browserClosed:true}));
}
