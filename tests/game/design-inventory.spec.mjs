import {test, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root, baselineURL} from '../helpers/paths.mjs';
import {openApp, catalog, capture, sha} from '../helpers/app.mjs';
import {validateInventory,readInventorySource} from './design-inventory-contract.mjs';

const relative = 'docs/design/game-screen-inventory.json';
async function inputs() {
  const sources=await readInventorySource(root);
  const sourceFiles = ['docs/feature-map.md', relative,
    'docs/design/game-system.md', 'docs/design/game-screen-states.md', 'docs/design/game-art-bible.md'];
  const files = {...sources.sourceFiles,...Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, await fs.readFile(path.join(root,file),'utf8')])))};
  return {files, hashes:Object.fromEntries(Object.entries(files).map(([file, text]) => [file, sha(text)])),
    ...sources, featureMap:files['docs/feature-map.md'], inventory:JSON.parse(files[relative])};
}
async function actualRuntime(browser, info) {
  const context = await browser.newContext({timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  try {
    const page = await context.newPage();
    const provenance = await openApp(page, baselineURL, 'qp-owned');
    const runtime = await page.evaluate(() => {
      const pairs = allChars().flatMap(card => ITEMS.filter(item => item.fit(card)).map(item => ({cardId:card.id,itemKey:item.key})));
      return {pairs, placements:pairs.flatMap(pair => (findChar(pair.cardId).alt ? ['front','alt'] : ['front']).map(side => ({...pair,side}))),
        families:FAMS.map(({key,name,abbr,sh,c}) => ({key,name,abbr,sh,c}))};
    });
    runtime.catalog = await page.evaluate(catalog);
    await capture(info,'actual-original-runtime',{url:baselineURL,provenance,runtime});
    return runtime;
  } finally { await context.close(); }
}

test('all documented controls and states bind to actual source and immutable runtime catalog', async ({browser}, info) => {
  const before = await inputs();
  const runtime = await actualRuntime(browser, info);
  const result = validateInventory(before.inventory, {...before,runtime});
  for (const feature of before.inventory.features) {
    expect(before.files['docs/design/game-screen-states.md']).toContain(feature.id);
    expect(before.files['docs/design/game-screen-states.md']).toContain(feature.controlId);
  }
  for (const file of ['game-system.md','game-screen-states.md','game-art-bible.md']) {
    const text = before.files[`docs/design/${file}`];
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain('game-screen-inventory.json');
  }
  expect((await inputs()).hashes).toEqual(before.hashes);
  await capture(info,'source-inventory-cross-reference',{result,inputSHA:before.hashes,authority:'current source literal controls + fresh HTTP original runtime; document is not product implementation proof'});
});

for (const [name, control] of [['QP','qp-develop'],['backup','backup-export'],['guarantee','guarantee-list'],['webtoon','webtoon-open']]) {
  test(`CLI rejects temporary inventory omission: ${name}`, async ({browser}, info) => {
    const before = await inputs();
    const runtime = await actualRuntime(browser, info);
    validateInventory(before.inventory, {...before,runtime});
    const temporary = path.join(process.env.TMPDIR, `design-inventory-${info.workerIndex}-${name}`);
    const fixture = path.join(temporary,'omitted.json'), oracle = path.join(temporary,'runtime.json');
    await capture(info,'temporary-resource-manifest',{temporary,fixture,oracle,plannedBeforeCreation:true,owner:'design-inventory'});
    await fs.mkdir(temporary,{recursive:true});
    let receipt;
    try {
      const altered = structuredClone(before.inventory);
      altered.features = altered.features.filter(row => row.controlId !== control);
      await fs.writeFile(fixture,JSON.stringify(altered));
      await fs.writeFile(oracle,JSON.stringify(runtime));
      const args = [path.join(root,'tests/game/design-inventory-contract.mjs'),fixture,oracle,root];
      const child = spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000,env:process.env});
      receipt = {scenario:`omit ${control}`,command:[process.execPath,...args],exitCode:child.status,signal:child.signal,
        stderr:child.stderr,stdout:child.stdout,fixtureSHA:sha(await fs.readFile(fixture)),inputSHA:before.hashes};
      await capture(info,'rejected-omission',receipt);
      expect(child.status).toBe(1);
      expect(child.signal).toBeNull();
      const structured = child.stderr.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
      expect(structured).toHaveLength(1);
      expect(Object.keys(structured[0]).sort()).toEqual(['error','status']);
      expect(structured[0].status).toBe('FAIL');
      expect(structured[0].error).toMatch(/unmapped actual source (control|feature):/);
      expect(child.stdout).not.toContain('PASS');
    } finally {
      await fs.rm(temporary,{recursive:true,force:true});
      const removed = await fs.stat(temporary).then(()=>false,error=>error.code==='ENOENT');
      expect(removed).toBe(true);
      await capture(info,'cleanup',{temporary,removed,childExitCode:receipt?.exitCode});
    }
    expect((await inputs()).hashes).toEqual(before.hashes);
  });
}

test('malformed states, lost return route and false content counts fail validation', async ({browser},info) => {
  const before = await inputs(), runtime = await actualRuntime(browser,info), outcomes = [];
  validateInventory(before.inventory,{...before,runtime});
  for (const [name, change,expected] of [
    ['malformed root', () => null,/inventory schema/],
    ['missing error state', value => {delete value.features[0].states.error;return value;},/FM001 error/],
    ['lost caller return', value => {value.features.find(row=>row.controlId==='craft-qp').returnTo='';return value;},/GAME002 returnTo/],
    ['false quiz count', value => {value.counts.quiz=412;return value;},/inventory agrees with actual runtime/],
    ['QP arrow face omitted', value => {value.catalog.faces=value.catalog.faces.filter(row=>row.cardId!=='qp-1470');return value;},/every actual card face/],
    ['alias loops', value => {value.aliasHistory='pushState';return value;},/alias history must not loop/],
    ['stale source anchor', value => {value.features[0].sourceAnchors.push('obsolete-control-not-in-source');return value;},/source anchor absent: FM001\/obsolete-control-not-in-source/],
  ]) {
    let error;
    try {validateInventory(change(structuredClone(before.inventory)),{...before,runtime});} catch(failure) {error=failure.message;}
    expect(error, name).toMatch(expected);outcomes.push({name,rejected:true,error});
  }
  const missing={...before.sourceFiles};delete missing['src/game/equipment.js'];
  expect(()=>validateInventory(before.inventory,{...before,sourceFiles:missing,runtime})).toThrow('complete builder source modules');
  outcomes.push({name:'missing builder equipment module',rejected:true,error:'complete builder source modules'});
  expect((await inputs()).hashes).toEqual(before.hashes);
  await capture(info,'malformed-and-stale-contracts',{outcomes,inputSHA:before.hashes});
});
