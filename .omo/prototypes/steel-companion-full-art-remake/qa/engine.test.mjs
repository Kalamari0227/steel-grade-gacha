import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';

function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []);
  return {getItem:key=>map.get(key) ?? null,setItem:(key,value)=>map.set(key,value),map};
}
test('single command commits once and presentation snapshots cannot mutate stock',()=>{
  const storage=memory(), e=createEngine({storage,random:()=>0});
  const before=e.status().singleLeft, out=e.ship(1);
  assert.equal(out.ok,true); assert.equal(out.result.cards.length,1);
  assert.equal(e.status().singleLeft,before-1);
  assert.equal(e.state().stock[out.result.cards[0].id],1);
  out.result.cards[0].stock=999;
  assert.equal(e.state().stock[out.result.cards[0].id],1);
  const reload=createEngine({storage});
  assert.deepEqual(reload.state(),e.state());
  assert.equal(reload.state().results.cards.length,1);
});
test('ten costs 20 scrap, gives exactly ten and guarantees LV3 with low RNG',()=>{
  const e=createEngine({storage:memory(),random:()=>0});
  const before=e.state(), out=e.ship(10);
  assert.equal(out.ok,true); assert.equal(e.state().scrap,before.scrap-20);
  assert.equal(out.result.cards.length,10);
  assert.equal(Object.values(e.state().stock).reduce((a,b)=>a+b,0),10);
  assert.ok(out.result.cards.some(r=>e.catalog().find(c=>c.id===r.id).level>=3));
  assert.ok(out.result.cards.every(r=>r.id!=='qp-1470'));
});
test('exhausted balances reject commands without mutation',()=>{
  const e=createEngine({storage:memory(),random:()=>0});
  for(let i=0;i<13;i++) assert.equal(e.ship(1).ok,true);
  const before=e.state(); assert.equal(e.ship(1).ok,false); assert.deepEqual(e.state(),before);
  for(let i=0;i<3;i++) assert.equal(e.ship(10).ok,true);
  const after=e.state(); assert.equal(e.ship(10).ok,false); assert.deepEqual(e.state(),after);
});
test('corrupt save blocks overwrite; foreign product save is untouched',()=>{
  const storage=memory('{broken'); storage.map.set('sgg_game_save_v1','preserve');
  const e=createEngine({storage}); assert.equal(e.status().blocked,true);
  assert.equal(e.ship(1).ok,false); assert.equal(storage.getItem(SAVE_KEY),'{broken');
  assert.equal(storage.getItem('sgg_game_save_v1'),'preserve');
  assert.equal(e.backup(),'{broken');
});
test('write failure keeps one memory result, warning and backup; no false durable success',()=>{
  const storage=memory(); storage.setItem=()=>{throw new DOMException('full','QuotaExceededError');};
  const e=createEngine({storage,random:()=>0}); assert.equal(e.ship(10).ok,true);
  assert.match(e.status().warning,/저장/); assert.equal(e.state().scrap,40);
  assert.equal(JSON.parse(e.backup()).results.cards.length,10);
});
test('second tab detects stale save before spending and refuses overwrite',()=>{
  const storage=memory(), first=createEngine({storage}), second=createEngine({storage});
  first.ship(1); const saved=storage.getItem(SAVE_KEY);
  assert.equal(second.ship(1).ok,false); assert.equal(storage.getItem(SAVE_KEY),saved);
  assert.match(second.status().warning,/다른/);
});
test('invalid saved values are held instead of reset or spent',()=>{
  const e=createEngine({storage:memory()}); const saved=e.state(); saved.scrap=-1;
  const other=createEngine({storage:memory(JSON.stringify(saved))});
  assert.equal(other.status().blocked,true); assert.equal(other.ship(10).ok,false);
});
test('a command writes once before returning a complete persisted result',()=>{
  const storage=memory(); let writes=0;
  const write=storage.setItem; storage.setItem=(key,value)=>{writes++;write(key,value);};
  const e=createEngine({storage,random:()=>0}); const result=e.ship(10);
  assert.equal(writes,1); assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)).results,result.result);
});
test('malformed legacy pending does not mint scrap or overwrite original',()=>{
  const saved=createEngine({storage:memory()}).state();saved.pending={unexpected:true};
  const raw=JSON.stringify(saved),storage=memory(raw),e=createEngine({storage});
  assert.equal(e.status().blocked,true);assert.equal(e.ship(1).ok,false);
  assert.equal(storage.getItem(SAVE_KEY),raw);assert.equal(e.backup(),raw);
});
test('backup retains unsaved memory reward after another tab saves and makes this tab stale',()=>{
  const storage=memory(),first=createEngine({storage,random:()=>0});first.ship(1);
  const other=createEngine({storage,random:()=>.99}),write=storage.setItem;
  storage.setItem=()=>{throw new DOMException('full','QuotaExceededError');};first.ship(10);
  storage.setItem=write;other.ship(1);assert.equal(first.ship(1).ok,false);
  const backup=JSON.parse(first.backup());assert.equal(backup.scrap,40);assert.equal(backup.results.cards.length,10);
});
