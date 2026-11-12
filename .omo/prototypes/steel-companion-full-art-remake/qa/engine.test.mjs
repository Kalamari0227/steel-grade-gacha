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
function qpReady(extra={}){
  const base=createEngine({storage:memory()}).state();
  const owned={'ssial-1470M':true,'ga-1470H':true,'poo-PHS':true,'ssial-1180Y':true};
  return JSON.stringify(Object.assign(base,{owned,stock:{'ssial-1470M':1,'ga-1470H':1,'poo-PHS':1,'ssial-1180Y':2},scrap:12},extra));
}
test('QP development follows the original transaction once: 2 materials and 10 scrap',()=>{
  const storage=memory(qpReady()), e=createEngine({storage});
  const status=e.qpStatus();
  assert.equal(status.revealed,true); assert.equal(status.ready,true);
  assert.deepEqual(status.slots.map(s=>s.use),['ssial-1470M','ssial-1180Y']);
  const out=e.develop();
  assert.equal(out.ok,true); assert.deepEqual(out.development.used,['ssial-1470M','ssial-1180Y']);
  const s=e.state();
  assert.equal(s.scrap,2); assert.equal(s.owned['qp-1470'],true); assert.equal(s.stock['qp-1470'],1);
  assert.equal(s.stock['ssial-1470M'],undefined); assert.equal(s.stock['ssial-1180Y'],1);
  assert.equal(s.owned['ssial-1470M'],true,'discovery record stays after spending stock');
  assert.equal(s.results,null,'development does not replace the last shipment result');
  assert.deepEqual(createEngine({storage}).state(),s);
  const again=e.develop(); assert.equal(again.ok,false); assert.deepEqual(e.state(),s);
});
test('QP development rejects hidden task, missing material and short scrap without mutation',()=>{
  const hidden=createEngine({storage:memory(qpReady({owned:{'ssial-1470M':true,'ga-1470H':true,'ssial-1180Y':true},stock:{'ssial-1470M':1,'ga-1470H':1,'ssial-1180Y':1}}))});
  const before=hidden.state(); assert.equal(hidden.develop().ok,false); assert.deepEqual(hidden.state(),before);
  const noStock=createEngine({storage:memory(qpReady({stock:{'ga-1470H':1,'poo-PHS':1,'ssial-1180Y':2}}))});
  assert.equal(noStock.qpStatus().ready,false); assert.equal(noStock.develop().ok,false);
  const poor=createEngine({storage:memory(qpReady({scrap:9}))});
  const p=poor.state(); assert.equal(poor.develop().ok,false); assert.deepEqual(poor.state(),p);
});
test('QP development refuses after another tab changed the save',()=>{
  const storage=memory(qpReady()), e=createEngine({storage});
  storage.setItem(SAVE_KEY,qpReady({scrap:40}));
  const out=e.develop(); assert.equal(out.ok,false); assert.equal(e.status().blocked,true);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).scrap,40);
});
test('trial refill adds shipping resources only and is persisted',()=>{
  const storage=memory(), e=createEngine({storage}), before=e.state();
  const out=e.refill(); assert.equal(out.ok,true);
  const after=e.state();
  assert.equal(after.extra,before.extra+50); assert.equal(after.scrap,before.scrap+400);
  assert.deepEqual({...after,extra:0,scrap:0},{...before,extra:0,scrap:0});
  assert.deepEqual(createEngine({storage}).state(),after);
});
