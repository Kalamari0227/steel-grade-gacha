import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {prepare} from '../prepare.mjs';
import {sha,section} from '../source.mjs';
import {createLegacy} from '../src/legacy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('all301 appearance keys and47 text pairs bind exact approved files',async()=>{
  const data=JSON.parse(await fs.readFile(path.join(root,'public/data.json')));
  assert.equal(data.appearances.length,301);assert.equal(data.dialogue.length,47);
  assert.equal(new Set(data.appearances.map(r=>`${r.cardId}:${r.side}:${r.equipmentKeys.join('+')}`)).size,301);
  for(const row of data.appearances){
    assert.equal(sha(await fs.readFile(path.join(root,'public',row.image))),row.sha256);
    assert.ok(data.dialogue.some(d=>d.cardId===row.cardId&&d.side===row.side));
  }
  assert.equal(data.cards.filter(c=>c.hasAlt).length,2);
  assert.deepEqual([...new Set(data.cards.map(c=>c.family))].sort(),['eg','ga','poo','qp','ssial','tarae']);
});
test('build rejects unapproved or changed catalog, source output collision before writes',async()=>{
  await assert.rejects(prepare({out:path.resolve(root,'../../..')}),/isolated/);
  await assert.rejects(prepare({catalog:path.join(root,'public/data.json')}),/SHA mismatch/);
});
test('1000 weighted picks match original template source exactly with seeded RNG',async()=>{
  const original=await fs.readFile(path.resolve(root,'../../..','src/app_tpl.html'),'utf8');
  const seed=()=>{let n=20261109;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};
  const source=section(original,'var FAMS = [','var QUIZ = [')+'\n'+section(original,'function allChars()','/* 확정 뽑기는');
  const context=vm.createContext({Math:Object.assign(Object.create(Math),{random:seed()}),promoOn:()=>false,PROMO:{pick:''}});
  vm.runInContext(source+'\nvar POOL=FAMS.filter(f=>!f.hidden).flatMap(f=>f.list.map(c=>c.id));var result=Array.from({length:1000},()=>weightedPick());',context);
  const actual=createLegacy({random:seed()});
  assert.deepEqual(Array.from({length:1000},()=>actual.weightedPick()),Array.from(context.result));
});
