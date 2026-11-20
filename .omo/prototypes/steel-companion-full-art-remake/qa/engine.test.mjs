import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createEngine, SAVE_KEY, TRIAL_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {section} from '../source.mjs';

function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []);
  return {getItem:key=>map.get(key) ?? null,setItem:(key,value)=>map.set(key,value),map};
}
// 제품 규칙에서는 새 프로필에 추가 출하·스크랩이 없다. 자원이 필요한 검사는 저장을 미리 심는다(체험판 시절 지급과 같은 양).
const BUDGET={extra:12,scrap:60};
function seeded(extra={}){return JSON.stringify({...createEngine({storage:memory()}).state(),...extra});}
const DAY=24*60*60*1000, T0=Date.UTC(2026,10,20,3,0,0); // 모든 기간 행사(마지막 2026-10-26 종료) 뒤
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const template=()=>fs.readFile(path.resolve(root,'../../..','src/app_tpl.html'),'utf8');
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
  const e=createEngine({storage:memory(seeded(BUDGET)),random:()=>0});
  const before=e.state(), out=e.ship(10);
  assert.equal(out.ok,true); assert.equal(e.state().scrap,before.scrap-20);
  assert.equal(out.result.cards.length,10);
  assert.equal(Object.values(e.state().stock).reduce((a,b)=>a+b,0),10);
  assert.ok(out.result.cards.some(r=>e.catalog().find(c=>c.id===r.id).level>=3));
  assert.ok(out.result.cards.every(r=>r.id!=='qp-1470'));
});
test('exhausted balances reject commands without mutation',()=>{
  const e=createEngine({storage:memory(seeded(BUDGET)),random:()=>0});
  for(let i=0;i<13;i++) assert.equal(e.ship(1).ok,true);
  const before=e.state(); assert.equal(e.ship(1).ok,false); assert.deepEqual(e.state(),before);
  for(let i=0;i<3;i++) assert.equal(e.ship(10).ok,true);
  const after=e.state(); assert.equal(e.ship(10).ok,false); assert.deepEqual(e.state(),after);
});
test('corrupt save blocks overwrite; trial-era save is untouched',()=>{
  const storage=memory('{broken'); storage.map.set(TRIAL_KEY,'preserve');
  const e=createEngine({storage}); assert.equal(e.status().blocked,true);
  assert.equal(e.ship(1).ok,false); assert.equal(storage.getItem(SAVE_KEY),'{broken');
  assert.equal(storage.getItem(TRIAL_KEY),'preserve');
  assert.equal(e.backup(),'{broken');
});
test('write failure keeps one memory result, warning and backup; no false durable success',()=>{
  const storage=memory(seeded(BUDGET)); storage.setItem=()=>{throw new DOMException('full','QuotaExceededError');};
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
  const storage=memory(seeded(BUDGET)); let writes=0;
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
  const storage=memory(seeded(BUDGET)),first=createEngine({storage,random:()=>0});first.ship(1);
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
test('featured companion: latest discovery by default, pin only an owned card, persisted without touching resources',()=>{
  const storage=memory(), e=createEngine({storage,random:()=>0});
  assert.deepEqual(e.featured(),{id:null,pinned:false});
  assert.equal('featured' in e.state(),false);
  const id=e.ship(1).result.cards[0].id;
  assert.deepEqual(e.featured(),{id,pinned:false});
  const before=e.state(), raw=storage.getItem(SAVE_KEY);
  assert.equal(e.setFeatured('qp-1470').ok,false); assert.equal(e.setFeatured('nope').ok,false);
  assert.deepEqual(e.state(),before); assert.equal(storage.getItem(SAVE_KEY),raw);
  assert.equal(e.setFeatured(id).ok,true);
  assert.deepEqual(e.state(),{...before,featured:id});
  assert.deepEqual(createEngine({storage}).featured(),{id,pinned:true});
});
test('featured companion: an unowned id in the save is held, and a stale tab cannot pin',()=>{
  const e=createEngine({storage:memory(),random:()=>0}); e.ship(1);
  const bad={...e.state(),featured:'qp-1470'}, raw=JSON.stringify(bad), storage=memory(raw), held=createEngine({storage});
  assert.equal(held.status().blocked,true); assert.equal(storage.getItem(SAVE_KEY),raw);
  const shared=memory(), first=createEngine({storage:shared,random:()=>0}), second=createEngine({storage:shared,random:()=>0});
  const id=first.ship(1).result.cards[0].id, saved=shared.getItem(SAVE_KEY);
  assert.equal(second.setFeatured(id).ok,false); assert.equal(shared.getItem(SAVE_KEY),saved);
  assert.match(second.status().warning,/다른/);
});

test('new profile starts with the original S defaults: no trial grant, one base shipment',()=>{
  const storage=memory(), e=createEngine({storage});
  assert.deepEqual(e.state(),{...createLegacy().state(),results:null});
  assert.equal(e.state().extra,0); assert.equal(e.state().scrap,0); assert.equal('prototypeVersion' in e.state(),false);
  assert.equal('refill' in e,false);
  assert.deepEqual({...e.status(),warning:undefined},{warning:undefined,blocked:false,holding:false,singleLeft:1,baseLeft:1,extra:0,scrap:0,nextIn:0,wait:'',canTen:false,exchanges:[{lv:3,cost:5,can:false},{lv:4,cost:10,can:false}]});
  assert.equal(e.ship(10).ok,false); assert.equal(storage.getItem(SAVE_KEY),null,'loading and a refused command write nothing');
});
test('base shipment renews 24h after the first base pull: just before, exactly at and after the boundary',()=>{
  let t=T0; const storage=memory(), now=()=>t, e=createEngine({storage,now,random:()=>0});
  assert.equal(e.ship(1).ok,true);
  assert.equal(e.state().pullAt,T0); assert.equal(e.state().pullUsed,1);
  assert.deepEqual([e.status().singleLeft,e.status().nextIn,e.status().wait],[0,DAY,'24시간']);
  const spent=e.state(); assert.equal(e.ship(1).ok,false); assert.deepEqual(e.state(),spent);
  t=T0+DAY-1; assert.deepEqual([e.status().singleLeft,e.status().nextIn,e.status().wait],[0,1,'1분']);
  assert.equal(e.ship(1).ok,false); assert.deepEqual(e.state(),spent);
  assert.equal(createEngine({storage,now}).status().singleLeft,0,'reload inside the window keeps the spent base');
  t=T0+DAY; assert.deepEqual([e.status().singleLeft,e.status().nextIn,e.status().wait],[1,0,'']);
  t=T0+DAY+1; assert.equal(e.ship(1).ok,true);
  assert.equal(e.state().pullAt,T0+DAY+1); assert.equal(e.state().pullUsed,1); assert.equal(e.status().singleLeft,0);
  assert.deepEqual(createEngine({storage,now}).state(),e.state());
});
test('base shipment is spent before extra shipments, extra does not renew',()=>{
  let t=T0; const now=()=>t, e=createEngine({storage:memory(seeded({extra:2})),now,random:()=>0});
  assert.equal(e.status().singleLeft,3);
  e.ship(1); assert.deepEqual([e.state().pullUsed,e.state().extra,e.state().pullAt],[1,2,T0]);
  t=T0+10; e.ship(1); assert.deepEqual([e.state().pullUsed,e.state().extra,e.state().pullAt],[1,1,T0]);
  assert.equal(e.status().nextIn,DAY-10); assert.equal(e.status().wait,'','time is shown only when nothing is left');
  e.ship(1); assert.equal(e.state().extra,0); assert.equal(e.status().singleLeft,0); assert.equal(e.status().wait,'24시간');
  assert.equal(e.ship(1).ok,false);
  t=T0+DAY; e.ship(1); assert.deepEqual([e.state().pullUsed,e.state().extra,e.state().pullAt],[1,0,T0+DAY]);
});
test('engine shipments match the extracted original rules for the same RNG and clock',()=>{
  const seed=()=>{let n=20261115;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};
  let t=T0; const now=()=>t, start=JSON.parse(seeded({extra:3,scrap:45}));
  const e=createEngine({storage:memory(JSON.stringify(start)),now,random:seed()});
  const original=createLegacy({now,random:seed()}); original.applySaved(start);
  const steps=[[1,0],[10,5],[1,9],[1,DAY],[1,DAY+1],[10,DAY+2],[1,DAY+3],[1,2*DAY+3]];
  for(const [count,at] of steps){
    t=T0+at; const ok=count===1?original.pullsLeft()>0:original.tenReady();
    if(count===1) original.single(); else original.ten();
    assert.equal(e.ship(count).ok,ok,`step ${count}@${at}`);
    const {results,...mine}=e.state(); assert.deepEqual(mine,JSON.parse(JSON.stringify(original.state())));
  }
});
test('pull cycle functions agree with the original template source around the 24h boundary',async()=>{
  const source=section(await template(),'var DAY = 24 * 60','function fmtWait(');
  for(const pullAt of [0,T0]) for(const pullUsed of [0,1,2]) for(const extra of [0,3]) for(const at of [-1,0,DAY-1,DAY,DAY+1]){
    const now=T0+Math.max(at,0), S={pullAt,pullUsed,extra,quizAt:0,quizUsed:0};
    const context=vm.createContext({S,Math,Date:{now:()=>now},pullMax:()=>1,quizMax:()=>3});
    vm.runInContext(source+';var out=[readyIn(S.pullAt),pullWindowOpen(),pullBaseLeft(),pullsLeft(),pullRenewed()];',context);
    const mine=createLegacy({now:()=>now}); mine.applySaved({pullAt,pullUsed,extra});
    assert.deepEqual([mine.readyIn(pullAt),mine.pullWindowOpen(),mine.pullBaseLeft(),mine.pullsLeft(),mine.pullRenewed()],Array.from(context.out),JSON.stringify({pullAt,pullUsed,extra,at}));
  }
});
test('formal key round trip; the trial-era key is never read, written or removed',()=>{
  const map=new Map([[TRIAL_KEY,'{"prototypeVersion":1,"extra":12}']]), touched=[];
  const storage={getItem:k=>{touched.push(k);return map.get(k)??null;},setItem:(k,v)=>{touched.push(k);map.set(k,v);},removeItem:k=>{touched.push('remove:'+k);map.delete(k);}};
  const e=createEngine({storage,random:()=>0}); assert.equal(e.state().extra,0,'trial grant is not imported');
  assert.equal(e.ship(1).ok,true);
  const again=createEngine({storage}); assert.deepEqual(again.state(),e.state());
  assert.deepEqual(new Set(touched),new Set([SAVE_KEY]));
  assert.equal(map.get(TRIAL_KEY),'{"prototypeVersion":1,"extra":12}');
  const saved=JSON.parse(map.get(SAVE_KEY)); assert.equal('prototypeVersion' in saved,false); assert.equal('featured' in saved,false);
  assert.equal(saved.results.cards.length,1);
});
// 이전 게임(같은 출처의 /steel-grade-gacha-game/)이 남긴 세이브. 재고·차량 목록·pullUsed가 없는 옛 형식과 results·featured가 없는 형식.
const previousGame={owned:{'poo-270C':true,'ga-1470H':true},last:'ga-1470H',extra:2,quizDay:'2026-11-19',items:{arrow:1},orderDay:'',orderKey:'',
  scrap:7,pending:'',pullAt:T0-1000,quizAt:T0-5000,quizUsed:2,bell:true,belledAt:3,backupAt:0,orderDone:1,promoSeen:'2026-10-22',promoDone:'',noticeSeen:'n1',
  parts:{roof:T0-9000,dooro:{at:T0-8000,use:['ga-340H']}},car:'t',carAt:5,qpSeen:1};
test('a previous-game save is inherited through the original applySaved and only rewritten by a command',async()=>{
  const raw=JSON.stringify(previousGame), storage=memory(raw), e=createEngine({storage,now:()=>T0,random:()=>0});
  assert.equal(e.status().blocked,false);
  const S={owned:{},stock:{},last:'',extra:0,quizDay:'',items:{},orderDay:'',orderKey:'',scrap:0,pending:'',pullAt:0,quizAt:0,quizUsed:0,bell:false,belledAt:-1,backupAt:0,orderDone:0,promoSeen:'',promoDone:'',noticeSeen:'',parts:{},cars:[],pullUsed:0,qpSeen:0};
  const context=vm.createContext({S,p:JSON.parse(raw)});
  vm.runInContext(section(await template(),'function applySaved(p){','function hasProgress(){')+';applySaved(p);',context);
  assert.deepEqual(e.state(),{...JSON.parse(JSON.stringify(context.S)),results:null},'same normalization as the original template');
  assert.deepEqual(e.state().stock,{'poo-270C':1,'ga-1470H':1}); assert.deepEqual(e.state().cars,[{k:'t',at:5}]);
  assert.equal(e.state().pullUsed,1,'an open window without pullUsed counts as one base pull');
  assert.deepEqual([e.status().baseLeft,e.status().singleLeft],[0,2]);
  assert.equal(storage.getItem(SAVE_KEY),raw,'loading does not rewrite the previous-game save');
  assert.equal(e.ship(1).ok,true); const saved=JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(saved.extra,1); assert.deepEqual(saved.items,{arrow:1}); assert.equal(saved.quizDay,'2026-11-19'); assert.deepEqual(saved.parts,previousGame.parts);
  assert.equal('car' in saved,false); assert.equal('prototypeVersion' in saved,false); assert.equal(saved.results.cards.length,1);
});
test('a previous-game save that the original would silently coerce is held instead',()=>{
  for(const bad of [{...previousGame,scrap:-3},{...previousGame,owned:{'not-a-card':true}},{...previousGame,extra:'5'},{...previousGame,featured:'poo-PHS'},[previousGame],'"text"']){
    const raw=typeof bad==='string'?bad:JSON.stringify(bad), storage=memory(raw), e=createEngine({storage,random:()=>0});
    assert.equal(e.status().blocked,true,raw.slice(0,40)); assert.equal(e.ship(1).ok,false);
    assert.equal(storage.getItem(SAVE_KEY),raw); assert.equal(e.backup(),raw);
    assert.deepEqual(e.state(),createEngine({storage:memory()}).state(),'held save is not shown half-applied');
  }
  // 원본이 명시적으로 정한 정규화(배열이 아닌 cars → [])는 보류하지 않고 원본대로 따른다.
  assert.deepEqual(createEngine({storage:memory(JSON.stringify({...previousGame,cars:{k:'k3'}}))}).state().cars,[]);
});
