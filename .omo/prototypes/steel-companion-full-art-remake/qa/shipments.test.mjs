import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,SAVE_KEY} from '../src/engine.mjs';
import {shipSafely} from '../src/shipments.mjs';
test('two concurrent tabs serialize the entire command, stale tab cannot spend or lose reward',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const first=createEngine({storage,random:()=>0}),second=createEngine({storage,random:()=>.99});
  let pending=Promise.resolve();const locks={request:(key,callback)=>{assert.equal(key,SAVE_KEY);const result=pending.then(callback);pending=result.then(()=>{});return result;}};
  const outcomes=await Promise.all([shipSafely(first,10,{locks}),shipSafely(second,10,{locks})]);
  assert.equal(outcomes.filter(r=>r.ok).length,1);
  const final=JSON.parse(storage.getItem(SAVE_KEY));assert.equal(final.scrap,40);
  assert.equal(Object.values(final.stock).reduce((a,b)=>a+b,0),10);
  assert.deepEqual(final.results,outcomes.find(r=>r.ok).result);
});
test('unsupported locking refuses shipping without spending',async()=>{
  const e=createEngine({storage:{getItem:()=>null,setItem:()=>{}}});const before=e.state();
  const result=await shipSafely(e,10,{locks:null});assert.equal(result.ok,false);assert.deepEqual(e.state(),before);
});
