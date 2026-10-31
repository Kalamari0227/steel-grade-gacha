import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceNames} from '../../tools/game-build/inputs.mjs';

export const inventorySourceNames=sourceNames.filter(name=>['src/app_tpl.html','src/pwa_head.txt','src/pwa_body.txt'].includes(name)||/^src\/game\/[^/]+\.js$/.test(name));
export async function readInventorySource(root){
  const sourceFiles=Object.fromEntries(await Promise.all(inventorySourceNames.map(async name=>[name,await fs.readFile(path.join(root,name),'utf8')])));
  return {sourceFiles,source:inventorySourceNames.map(name=>sourceFiles[name]).join('\n')};
}
export function validateInventory(inventory, {source, sourceFiles, featureMap, runtime}) {
  assert.equal(inventory?.schemaVersion, 1, 'inventory schema');
  assert.equal(inventory.edition, 'game', 'inventory edition');
  assert.deepEqual(Object.keys(sourceFiles||{}).sort(),[...inventorySourceNames].sort(),'complete builder source modules');
  assert.equal(source,inventorySourceNames.map(name=>sourceFiles[name]).join('\n'),'source matches builder module bytes');
  for(const name of inventorySourceNames.filter(name=>name.startsWith('src/game/'))){
    assert.ok(sourceFiles[name].length>0,`empty source module: ${name}`);
    assert.ok(sourceFiles['src/app_tpl.html'].includes(`<!-- GAME_${path.basename(name,'.js').toUpperCase()} -->`),`unbound builder module: ${name}`);
  }
  const routes = ['workshop', 'dex', 'craft', 'research', 'garage'];
  assert.deepEqual(inventory.routes.map(row => row.id), routes, 'five canonical routes');
  assert.deepEqual(inventory.aliases, {learn: 'research', learning: 'research'}, 'legacy aliases');
  assert.equal(inventory.aliasHistory, 'replaceState', 'alias history must not loop');
  for (const route of inventory.routes) {
    assert.equal(route.hash, `#${route.id}`);
    assert.equal(route.settingsReachable, true, `settings reachable: ${route.id}`);
  }
  assert.equal(inventory.settings.scope, 'overlay-on-all-routes');
  assert.equal(inventory.settings.returnPolicy, 'caller-route-control-focus');
  const features = inventory.features;
  assert.ok(Array.isArray(features) && features.length > 0, 'nonempty features');
  assert.equal(new Set(features.map(row => row.id)).size, features.length, 'unique feature IDs');
  assert.equal(new Set(features.map(row => row.controlId)).size, features.length, 'unique controls');
  const existingIds = [...new Set(featureMap.match(/FM\d{3}/g))].sort();
  assert.equal(existingIds.length, 60, 'known education feature-map baseline');
  for (const feature of features) {
    assert.ok(routes.includes(feature.canonicalRoute), `canonical route: ${feature.id}`);
    for (const field of ['entry', 'returnTo']) assert.ok(typeof feature[field] === 'string' && feature[field].length > 3, `${feature.id} ${field}`);
    for (const state of ['success', 'empty', 'loading', 'error', 'disabled']) {
      assert.ok(typeof feature.states?.[state] === 'string' && feature.states[state].length > 8, `${feature.id} ${state}`);
    }
    for (const anchor of [...feature.sourceControls, ...feature.sourceAnchors]) {
      assert.ok(source.includes(anchor), `source anchor absent: ${feature.id}/${anchor}`);
    }
    if (!feature.planned) assert.ok(feature.sourceAnchors.length > 0, `unbound existing feature: ${feature.id}`);
  }
  const mappedControls = new Set(features.flatMap(row => row.sourceControls));
  // Read the actual source's literal buttons, selects and delegated data hooks, including generated markup.
  const literalControls = [...source.matchAll(/<(?:button|select)\b[^>]*?\bid=["']([A-Za-z0-9_-]+)/g)].map(match => match[1]);
  const delegatedControls = [...source.matchAll(/<button\b[^>]*?\b(data-[a-z-]+)/g)].map(match => match[1]);
  for (const control of new Set([...literalControls, ...delegatedControls])) {
    assert.ok(mappedControls.has(control), `unmapped actual source control: ${control}`);
  }
  // These functions are independently observable product features, even when their controls are created by JS.
  for (const anchor of ['openDevelop', 'renderItems', 'openBackup', 'openToon', 'openQuiz', 'openPick', 'craft', 'openCar']) {
    assert.ok(new RegExp(`function ${anchor}\\(`).test(source), `source feature missing: ${anchor}`);
    assert.ok(features.some(row => row.sourceAnchors.includes(anchor)), `unmapped actual source feature: ${anchor}`);
  }
  assert.deepEqual(features.filter(row => /^FM\d{3}$/.test(row.id)).map(row => row.id).sort(), existingIds, 'existing features preserved');
  const additions=features.filter(row=>/^GAME\d{3}$/.test(row.id));
  assert.deepEqual(additions.map(row=>row.id).sort(),Array.from({length:14},(_,i)=>'GAME'+String(i+1).padStart(3,'0')),'current game additions preserved');
  for(const row of additions)assert.equal(row.planned,false,`current game addition source status: ${row.id}`);
  for (const control of inventory.settings.controls) assert.ok(features.some(row => row.controlId === control), `settings control missing: ${control}`);
  for (const id of ['qp-entry', 'qp-material', 'qp-develop', 'craft-qp']) {
    assert.equal(features.find(row => row.controlId === id)?.canonicalRoute, 'research', `QP canonical destination: ${id}`);
  }
  const {catalog, pairs, placements, families} = runtime;
  const observed = {
    pool: catalog.pool.length, materials: catalog.cards.length,
    faces: catalog.cards.reduce((total, card) => total + (card.alt ? 2 : 1), 0),
    parts: catalog.parts.length, cars: catalog.cars.length, guarantees: catalog.items.length,
    orders: catalog.orders.length, quiz: catalog.quiz.length, webtoonEntries: catalog.toon.length,
    webtoonImages: catalog.toon.reduce((total, episode) => total + 1 + episode.pages.length, 0),
    compatiblePairs: pairs.length, placements: placements.length,
  };
  assert.deepEqual(observed, {pool:44,materials:45,faces:47,parts:35,cars:8,guarantees:14,orders:14,quiz:413,webtoonEntries:3,webtoonImages:18,compatiblePairs:103,placements:107}, 'immutable business baseline counts');
  assert.deepEqual(inventory.counts, observed, 'inventory agrees with actual runtime');
  const faces = catalog.cards.flatMap(card => (card.alt ? ['front', 'alt'] : ['front']).map(side => ({cardId: card.id, side})));
  assert.deepEqual(inventory.catalog.faces, faces, 'every actual card face');
  for (const [field, actual] of [['parts', catalog.parts], ['cars', catalog.cars], ['guarantees', catalog.items]]) {
    assert.deepEqual(inventory.catalog[field], actual.map(row => row.key), `complete actual ${field} IDs`);
  }
  assert.ok(pairs.some(row => row.cardId === 'qp-1470' && row.itemKey === 'arrow'), 'QP arrow included beyond POOL');
  assert.deepEqual(placements.filter(row => row.side === 'alt'), [
    {cardId:'poo-PHS',itemKey:'arrow',side:'alt'},
    {cardId:'ga-1470H',itemKey:'arrow',side:'alt'},
    {cardId:'ga-1470H',itemKey:'iron',side:'alt'},
    {cardId:'ga-1470H',itemKey:'spark',side:'alt'},
  ], 'four additional heat treatment placements');
  assert.equal(inventory.families.length, families.length);
  for (const family of families) {
    const described = inventory.families.find(row => row.key === family.key);
    assert.ok(described, `family absent: ${family.key}`);
    assert.equal(described.name, family.name);
    assert.equal(described.abbreviation, family.sh || family.abbr);
    assert.ok(described.emblem.length > 3, `family emblem: ${family.key}`);
    const token = family.c.match(/var\((--\w+)\)/)[1];
    const color = source.match(new RegExp(`${token}:\\s*(#[a-fA-F0-9]{6})`))?.[1];
    assert.equal(described.color.toLowerCase(), color?.toLowerCase(), `original family color: ${family.key}`);
  }
  assert.deepEqual(new Set(inventory.specialFrameIds), new Set([...Object.keys(catalog.rare), 'qp-1470']), 'special frames use actual rare IDs + QP');
  return {features: features.length, sourceControls: new Set([...literalControls, ...delegatedControls]).size, observed};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [inventoryFile, oracleFile, sourceRoot] = process.argv.slice(2);
    assert.ok(inventoryFile && oracleFile && sourceRoot, 'usage: design-inventory-contract.mjs inventory.json runtime-oracle.json source-root');
    const sources=await readInventorySource(sourceRoot);
    const result = validateInventory(JSON.parse(await fs.readFile(inventoryFile, 'utf8')), {
      ...sources, featureMap: await fs.readFile(path.join(sourceRoot, 'docs/feature-map.md'), 'utf8'),
      runtime: JSON.parse(await fs.readFile(oracleFile, 'utf8')),
    });
    console.log(JSON.stringify({status:'PASS', ...result}));
  } catch (error) {
    console.error(JSON.stringify({status:'FAIL', error:error.message}));
    process.exitCode = 1;
  }
}
