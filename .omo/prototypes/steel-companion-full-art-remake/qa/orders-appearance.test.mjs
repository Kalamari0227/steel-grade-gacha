// 장착 상태와 승인 외형의 정합성(3단계). 원본 호환 판정(ITEMS[].fit, orders-economy.test에서 원본과 같음을 확인)으로 나오는
// 동료–장비 쌍과, 승인 외형(data.json appearances, current477에서 prepare.mjs가 옮김)의 장비 조합을 전수 대조한다.
// 한 동료가 장착할 수 있는 조합은 호환 장비의 모든 부분집합이고, 열처리 전후가 있는 동료는 앞(front)·뒤(alt) 양쪽에 있어야 한다.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLegacy} from '../src/legacy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'public/data.json'),'utf8'));
const L=createLegacy(), CHARS=L.allChars(), KEYS=L.ITEMS.map(i=>i.key);
const keyOf=(cardId,side,keys)=>`${cardId}|${side}|${[...keys].sort().join('+')}`;
const approved=new Set(data.appearances.map(a=>keyOf(a.cardId,a.side,a.equipmentKeys)));
const subsets=ks=>Array.from({length:1<<ks.length},(_,m)=>ks.filter((_,i)=>m>>i&1));
const fitKeys=c=>L.ITEMS.filter(i=>i.fit(c)).map(i=>i.key);
const sides=c=>c.alt?['front','alt']:['front'];

test('every original card–item pair has an approved single-item appearance, and every approved item key is an original item',()=>{
  const pairs=new Set(CHARS.flatMap(c=>fitKeys(c).map(k=>c.id+'|'+k)));
  const shown=new Set(data.appearances.filter(a=>a.equipmentKeys.length===1).map(a=>a.cardId+'|'+a.equipmentKeys[0]));
  assert.equal(pairs.size,103); assert.equal(shown.size,103);
  assert.deepEqual([...pairs].filter(p=>!shown.has(p)),[],'original allows, no approved appearance');
  assert.deepEqual([...shown].filter(p=>!pairs.has(p)),[],'approved appearance, original never allows');
  assert.deepEqual([...new Set(data.appearances.flatMap(a=>a.equipmentKeys))].sort(),[...KEYS].sort());
  assert.ok(CHARS.every(c=>c.id&&L.findChar(c.id)));
});

test('every reachable combination (each subset of fitting items) is approved on both sides, and nothing else is approved',()=>{
  const expected=new Set();
  for(const c of CHARS) for(const side of sides(c)) for(const s of subsets(fitKeys(c))) expected.add(keyOf(c.id,side,s));
  assert.equal(expected.size,301); assert.equal(approved.size,301);
  assert.deepEqual([...expected].filter(k=>!approved.has(k)),[],'reachable combination without approved art');
  assert.deepEqual([...approved].filter(k=>!expected.has(k)),[],'approved combination that cannot be reached');
  for(const a of data.appearances) assert.ok(data.dialogue.some(d=>d.cardId===a.cardId&&d.side===a.side),'dialogue bound '+a.id);
});

test('itemsOf(card) after any sequence of original equips stays inside the approved combinations on every side',()=>{
  let n=0,seed=73;
  const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let round=0;round<200;round++){
    const G=createLegacy();
    const S=G.state(); for(const c of CHARS) if(rng()<0.6) S.owned[c.id]=true;
    for(const k of KEYS) if(rng()<0.8) S.items[k]=1;
    for(let step=0;step<20;step++){
      const k=KEYS[Math.floor(rng()*KEYS.length)], c=CHARS[Math.floor(rng()*CHARS.length)];
      G.equip(k,c.id);
    }
    for(const c of CHARS){
      const keys=G.itemsOf(c.id).map(i=>i.key);
      for(const side of sides(c)){assert.ok(approved.has(keyOf(c.id,side,keys)),keyOf(c.id,side,keys));n++;}
    }
  }
  assert.ok(n>9000);
});
