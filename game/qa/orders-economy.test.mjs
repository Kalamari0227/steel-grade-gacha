// 고객 요구·보증 장비(3단계) 원본 대조. economy.test·garage-economy.test와 같은 방식이다.
// 원본 app_tpl.html에서 section()으로 뽑은 원문과 이전 게임 모듈 src/game/equipment.js 전체를 vm에서 그대로 실행하고,
// 같은 상태·같은 시각에서 createLegacy() 결과와 비교한다.
//
// vm에 올리는 원본 구간:
//   var IMG = {…}, IMG_ITEM·품종 묶음·ITEMS·ORDERS ('var IMG_ITEM = {' ~ 'var FAMS = ['), FAMS 데이터, POOL 한 줄,
//   PULL_MAX~PROMOS~orderMax~today ('var PULL_MAX = 1;' ~ '/* ── 진행 저장'), allChars~findChar, stockOf 한 줄,
//   주문서 판정 ('/* ── 주문서' ~ 'function renderOrder(){'), 화면 함수 openPick·judge ('function openPick(event){' ~ '/* 2단계'),
//   openPickTarget 한 줄, equipment.js 전체(GAME_EQUIPMENT.open → preview → confirm)
// 스텁: S(케이스마다), Date(주입 시각으로 new Date()까지), document·pickBox·pickModal(가짜 요소: 원본이 만든 보기 버튼과 장착 후보 버튼을 잡아 둠),
//   save·refresh(횟수만 셈), 효과음·그림·대화창 함수(아무 일 안 함).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {section} from '../source.mjs';
import {createLegacy} from '../src/legacy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const template=fs.readFileSync(path.resolve(root,'..','src/app_tpl.html'),'utf8');
const equipment=fs.readFileSync(path.resolve(root,'..','src/game/equipment.js'),'utf8');
const script=new vm.Script([
  section(template,'var IMG = {','/* 열처리 계열은'),
  section(template,'var IMG_ITEM = {','var FAMS = ['),
  section(template,'var FAMS = [','var QUIZ = ['),
  section(template,'var POOL = Object.keys(IMG)','var KEY = GAME_EDITION.save'),
  section(template,'var PULL_MAX = 1;','/* ── 진행 저장'),
  section(template,'function allChars()','/* 확정 뽑기는'),
  section(template,'function stockOf(id){','function partDone('),
  section(template,'/* ── 주문서','function renderOrder(){'),
  section(template,'function openPick(event){','/* 2단계 — 어느 소재에'),
  section(template,'function openPickTarget(key,trigger)','function renderHomeStatus(){'),
  equipment
].join('\n'),{filename:'app_tpl.html#orders'});

const json=v=>JSON.stringify(v), clone=v=>JSON.parse(JSON.stringify(v));
const RealDate=Date;
const DAY=86400000;
// 현지 날짜 경계를 여러 번 지나도록 고른 시각들(23시 59분·0시 1분 포함). today()는 원본처럼 기기 현지 시각이다.
const local=(y,m,d,h,mi)=>new RealDate(y,m,d,h,mi).getTime();
const TIMES=[local(2026,10,15,9,0),local(2026,10,15,23,59),local(2026,10,16,0,1),local(2026,10,17,12,0),local(2026,11,31,23,30),local(2027,0,1,0,30),local(2027,1,28,8,0)];
const lcg=seed=>{let n=seed>>>0;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};

function original(){
  const log={save:0,refresh:0};
  let nowValue=TIMES[0], elements={}, choices=[], targets=[];
  const FakeDate=Object.assign(function(...a){return new RealDate(...(a.length?a:[nowValue]));},{now:()=>nowValue,UTC:RealDate.UTC});
  function element(id){
    const e={id,dataset:{},style:{},hidden:false,disabled:false,isConnected:true,textContent:'',handlers:{},children:[],scrollTop:0,
      classList:{set:new Set(),add(...c){c.forEach(x=>this.set.add(x));},remove(...c){c.forEach(x=>this.set.delete(x));},contains(c){return id==='pickModal'?c==='show':this.set.has(c);}},
      addEventListener(type,fn){e.handlers[type]=fn;},appendChild(child){e.children.push(child);},append(child){e.children.push(child);},
      contains:()=>true,focus(){},setAttribute(){},getAttribute:()=>null,removeAttribute(){},replaceChildren(){},
      querySelector:()=>element('q'),
      querySelectorAll(sel){
        if(sel==='[data-choice]') return choices;
        if(sel==='[data-equip-id]') return targets;
        return [];
      }};
    let html='';
    Object.defineProperty(e,'innerHTML',{get:()=>html,set:v=>{html=v;
      if(id!=='pickBox') return;
      // 대화창 내용을 새로 그리면 그 안의 요소는 새것이 된다. 원본이 그린 장착 후보 버튼(data-equip-id)을 가짜 버튼으로 잡아 둔다.
      elements={pickBox:elements.pickBox,pickModal:elements.pickModal}; choices=[];
      targets=[...v.matchAll(/data-equip-id="([^"]*)"/g)].map(([,cid])=>{const b=element('target');b.dataset.equipId=cid;return b;});
    }});
    return e;
  }
  const el=id=>elements[id]||(elements[id]=element(id));
  elements.pickBox=element('pickBox'); elements.pickModal=element('pickModal');
  const view={element:{},dispose(){},onStatus:()=>()=>{}};
  const ctx=vm.createContext({S:null,Math:Object.create(Math),Date:FakeDate,GAME_EDITION:{save:'sgg_game_save_v1'},
    document:{getElementById:el,createElement:tag=>{const b=element(tag);choices.push(b);return b;}},
    pickBox:elements.pickBox,pickModal:elements.pickModal,pickLast:null,dialogStack:[],modal:{},activeCardId:null,cardSide:false,
    showDialog(){},closePick(){},closeCard(){},openCard(){},researchCue(){},guaranteeReturn(){},guaranteeFocus(){},
    GAME_AV:{cue(){},enterEquipment(){},leaveEquipment(){}},GAME_AUDIO:{cancel(){}},GAME_PRESENTATION:{render:()=>view},
    GAME_CONFIG:{assets:{'scene:workshop:back':{url:''}}},
    save:()=>{log.save++;},refresh:()=>{log.refresh++;}});
  script.runInContext(ctx);
  ctx.pickBox=elements.pickBox; ctx.pickModal=elements.pickModal;
  return {ctx,log,
    reset(S,now=TIMES[0]){ctx.S=clone(S);nowValue=now;log.save=0;log.refresh=0;elements={pickBox:elements.pickBox,pickModal:elements.pickModal};choices=[];targets=[];
      elements.pickBox.dataset={};},
    setNow(now){nowValue=now;},
    run:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),
    state:()=>clone(ctx.S),
    // 실제 화면 흐름: 회신하기(openPick) → 대화창에 요구를 적어 둠. 열리지 않았으면 false.
    open(){choices=[];ctx.openPick({currentTarget:{}});return !!elements.pickBox.dataset.orderKey&&choices.length===14;},
    // 보증 보기 하나를 누른다. 정답이면 '장착'·'나중에' 버튼이 생긴다.
    answer(key){const b=choices.find(x=>x.dataset.choice===key);assert.ok(b,'choice '+key);b.handlers.click();return !!elements.pkEquip;},
    // 정답 직후 '장착'(pkEquip) 또는 보증 목록(openPickTarget)에서 → 후보 버튼 클릭 → (그 사이 상태가 바뀔 수 있음) → 장착 확정.
    equip(id,{fromAnswer=false,key=null,between=null}={}){
      if(fromAnswer) elements.pkEquip.handlers.click(); else ctx.openPickTarget(key);
      const b=targets.find(x=>x.dataset.equipId===id); if(!b) return 'no-option';
      b.handlers.click();
      const confirm=elements.equipConfirm; if(!confirm||!confirm.handlers.click) return 'no-confirm';
      if(between) ctx.S=clone(between);
      log.save=0; confirm.handlers.click({currentTarget:confirm}); return 'confirmed';
    },
    targets:()=>targets.map(b=>b.dataset.equipId)};
}
const O=original();
function mine(S,now=TIMES[0]){
  const log={save:0};
  const L=createLegacy({now:()=>now,onSave:()=>{log.save++;}});
  L.setState(clone(S)); return {L,log};
}

const L0=createLegacy(), base=L0.state(), CHARS=L0.allChars(), IDS=CHARS.map(c=>c.id);
const KEYS=L0.ITEMS.map(i=>i.key);
const fits=Object.fromEntries(KEYS.map(k=>[k,CHARS.filter(c=>L0.findItem(k).fit(c)).map(c=>c.id)]));
// 무작위 상태: 보유 동료 일부, 보증 일부(획득 1 또는 호환 동료에 장착), 요구 날짜·항목·횟수.
function randomState(rng,{now=TIMES[0]}={}){
  const owned={},stock={};
  for(const id of IDS) if(rng()<[0.15,0.4,0.8][Math.floor(rng()*3)]){owned[id]=true;if(rng()<0.8)stock[id]=1+Math.floor(rng()*3);}
  const items={};
  for(const k of KEYS){const r=rng();if(r<0.2)items[k]=1;else if(r<0.35){const c=fits[k].filter(id=>owned[id]);if(c.length)items[k]=c[Math.floor(rng()*c.length)];}}
  const L=createLegacy({now:()=>now});
  const days=['',L.today(),createLegacy({now:()=>now-DAY}).today()];
  return {...base,owned,stock,items,orderDay:days[Math.floor(rng()*3)],orderKey:rng()<0.3?'':KEYS[Math.floor(rng()*KEYS.length)],orderDone:Math.floor(rng()*3)};
}
let cases=0;

test('ITEMS, ORDERS, ORDER_MAX and every fit() verdict equal the original (14 keys, 103 card-item pairs)',()=>{
  assert.equal(json(L0.ITEMS),json(O.run('ITEMS')),'same 14 items in the same order (fit functions compared below)');
  assert.equal(json(L0.ORDERS),json(O.run('ORDERS')));
  assert.deepEqual(KEYS,['shield','dagger','potion','arrow','forge','flange','iron','spark','glass','kettle','loupe','bath','jominy','section']);
  assert.deepEqual(L0.ORDERS.map(o=>o.item).sort(),[...KEYS].sort(),'one order per item');
  assert.equal(L0.ORDER_MAX,1); assert.equal(O.run('ORDER_MAX'),1);
  for(const t of TIMES){O.reset(base,t);const {L}=mine(base,t);assert.equal(L.orderMax(),O.run('orderMax()'));assert.equal(L.orderMax(),1,'all promotions have ended');assert.equal(L.today(),O.run('today()'));cases++;}
  const want=O.run('ITEMS.map(function(i){return allChars().filter(function(c){return i.fit(c);}).map(function(c){return c.id;});})');
  assert.equal(json(KEYS.map(k=>fits[k])),json(want));
  assert.equal(Object.values(fits).reduce((n,a)=>n+a.length,0),103);
  for(const k of [...KEYS,'x','',null]){assert.equal(json(L0.findItem(k)),json(O.run('findItem('+json(k)+')')));assert.equal(json(L0.findOrder(k)),json(O.run('findOrder('+json(k)+')')));}
  cases+=KEYS.length;
});

test('todaysOrder, openOrders, pickOrder, fitOwned, itemsOf, itemCount and dayHash match the original over random states and dates',()=>{
  const rng=lcg(20261115);
  for(let n=0;n<400;n++){
    const now=TIMES[n%TIMES.length], S=randomState(rng,{now});
    O.reset(S,now); const {L,log}=mine(S,now);
    const read=`({hash:dayHash(),open:openOrders().map(function(o){return o.item;}),pick:pickOrder(),fit:ITEMS.map(function(i){return fitOwned(i.key);}),
      of:allChars().map(function(c){return itemsOf(c.id).map(function(i){return i.key;});}),count:itemCount()})`;
    const got={hash:L.dayHash(),open:L.openOrders().map(o=>o.item),pick:L.pickOrder(),fit:KEYS.map(L.fitOwned),of:IDS.map(id=>L.itemsOf(id).map(i=>i.key)),count:L.itemCount()};
    assert.equal(json(got),json(O.run(read)),`read n${n}`);
    const want=O.run('todaysOrder()'), mineOrder=L.todaysOrder();
    assert.equal(json(mineOrder),json(want),`todaysOrder n${n}`);
    assert.equal(json(L.state()),json(O.state()),`state after todaysOrder n${n}`);
    assert.equal(log.save,O.log.save,`save count n${n}`);
    // 아직 답하지 않은 요구는 보유 동료에 걸 데가 있는 항목뿐이다. 이미 답한 요구는 원본처럼 그날 "대응 완료"로 남는다(한도를 다 쓴 날).
    if(mineOrder&&!L.state().items[mineOrder.item]) assert.ok(L.fitOwned(mineOrder.item).length>0);
    if(mineOrder&&L.state().items[mineOrder.item]) assert.ok(L.state().orderDone>=L.orderMax()||L.openOrders().length===0);
    cases++;
  }
});

test('a reply (right or wrong) matches the original openPick → choice → judge flow, including the second answer and the daily limit',()=>{
  const rng=lcg(4768);
  let rights=0,wrongs=0,closed=0;
  for(let n=0;n<300;n++){
    const now=TIMES[n%TIMES.length], S=randomState(rng,{now});
    O.reset(S,now); const opened=O.open(); const afterOpen=O.state(), opens=O.log.save;
    const {L,log}=mine(S,now); const o=L.todaysOrder();
    assert.equal(json(L.state()),json(afterOpen),`open n${n}`); assert.equal(log.save,opens);
    const canReply=!!o&&!L.state().items[o.item]&&L.state().orderDone<L.orderMax()&&L.fitOwned(o.item).length>0;
    assert.equal(opened,canReply,`dialog opens only for a reply that is still possible n${n}`);
    if(!opened){closed++;cases++;continue;}
    const expected=L.state().orderKey, day=L.state().orderDay;
    // 오답 하나 → 정답 → 같은 보기 다시(이미 비활성) — 원본과 같은 순서
    const wrong=KEYS.filter(k=>k!==expected)[Math.floor(rng()*13)];
    O.log.save=0; O.answer(wrong); log.save=0;
    assert.equal(L.judge(expected,day,wrong),false); wrongs++;
    assert.equal(json(L.state()),json(O.state()),`wrong n${n}`); assert.equal(json(L.state()),json(afterOpen),'wrong answer changes nothing');
    assert.equal(log.save,O.log.save); assert.equal(log.save,0);
    O.answer(expected); assert.equal(L.judge(expected,day,expected),true); rights++;
    assert.equal(json(L.state()),json(O.state()),`right n${n}`); assert.equal(log.save,O.log.save,`right save n${n}`);
    const after=L.state();
    assert.equal(after.items[expected],1); assert.equal(after.orderDone,afterOpen.orderDone+1);
    assert.equal(json({...after,items:afterOpen.items,orderDone:afterOpen.orderDone}),json(afterOpen),'only items[key] and orderDone change');
    // 같은 답을 다시 보내도(다른 탭·중복 클릭) 아무것도 바뀌지 않는다. 원본은 보기 버튼이 비활성이라 판정까지 가지 않는다.
    const again=mine(after,now); assert.equal(again.L.judge(expected,day,expected),null); assert.equal(json(again.L.state()),json(after)); assert.equal(again.log.save,0);
    // 한도를 다 쓴 날에는 다시 열리지 않는다
    O.reset(after,now); assert.equal(O.open(),false,'limit reached'); assert.equal(O.log.save,0);
    cases+=3;
  }
  assert.ok(rights>100&&closed>20,`rights ${rights}, wrongs ${wrongs}, closed ${closed}`);
});

test('stale replies are refused like the original: day change, item gained elsewhere, order replaced, card gone, limit used',()=>{
  const rng=lcg(4774);
  let refused=0;
  for(let n=0;n<200;n++){
    const now=TIMES[n%(TIMES.length-1)], S=randomState(rng,{now});
    O.reset(S,now); if(!O.open()) continue;
    const opened=O.state(), expected=opened.orderKey, day=opened.orderDay;
    const kind=n%5; let between=clone(opened), later=now;
    if(kind===0) later=now+DAY;
    if(kind===1) between.items[expected]=1;
    if(kind===2) between.orderKey=KEYS.find(k=>k!==expected);
    if(kind===3) for(const id of fits[expected]) delete between.owned[id];
    if(kind===4) between.orderDone=1;
    O.ctx.S=clone(between); O.setNow(later); O.log.save=0; O.answer(expected);
    const {L,log}=mine(between,later); const verdict=L.judge(expected,day,expected);
    assert.equal(json(L.state()),json(O.state()),`stale kind ${kind} n${n}`); assert.equal(log.save,O.log.save,`stale save kind ${kind} n${n}`);
    if(kind!==0){assert.equal(verdict,null);assert.equal(json(L.state()),json(between));assert.equal(log.save,0);}
    else assert.equal(verdict,null,'opened yesterday, answered today');
    refused++; cases++;
  }
  assert.ok(refused>60,`refused ${refused}`);
});

test('equip matches the original GAME_EQUIPMENT open → pick → confirm for every item and every owned card, without touching stock',()=>{
  const rng=lcg(4796);
  let equipped=0,noOption=0;
  for(let n=0;n<120;n++){
    const now=TIMES[n%TIMES.length], S=randomState(rng,{now});
    for(const k of KEYS){
      const T={...clone(S),items:{...S.items,[k]:1}};
      const offered=(O.reset(T,now),O.ctx.openPickTarget(k),O.targets());
      const {L:Lf}=mine(T,now); assert.equal(json(offered),json(Lf.fitOwned(k)),`candidates ${k} n${n}`);
      for(const id of IDS.filter(id=>T.owned[id]||rng()<0.05)){
        O.reset(T,now); const flow=O.equip(id,{key:k});
        const {L,log}=mine(T,now); const ok=L.equip(k,id);
        assert.equal(ok,flow==='confirmed',`${k} → ${id}`);
        assert.equal(json(L.state()),json(O.state()),`${k} → ${id} n${n}`); assert.equal(log.save,O.log.save);
        if(ok){
          equipped++; const after=L.state();
          assert.equal(after.items[k],id); assert.equal(json(after.stock),json(T.stock),'stock unchanged');
          assert.equal(json({...after,items:T.items}),json(T),'only items[key] changes');
          assert.ok(L.itemsOf(id).some(i=>i.key===k)); assert.equal(json(L.itemsOf(id).map(i=>i.key)),json(O.run('itemsOf('+json(id)+').map(function(i){return i.key;})')));
          // 이미 장착된 보증은 다시 쓸 수 없다(원본 open이 S.items[key] !== 1이면 열리지 않음)
          O.reset(after,now); assert.equal(O.equip(id,{key:k}),'no-option');
          for(const other of IDS){assert.equal(L.equip(k,other),false);} assert.equal(json(L.state()),json(after));
        } else {assert.equal(log.save,0);assert.equal(json(L.state()),json(T));noOption++;}
        cases++;
      }
    }
  }
  assert.ok(equipped>500&&noOption>50,`equipped ${equipped}, refused ${noOption}`);
});

test('equip right after a correct reply follows the original pkEquip path; unobtained items and stale picks are refused',()=>{
  const rng=lcg(4105);
  let done=0;
  for(let n=0;n<200&&done<60;n++){
    const now=TIMES[n%TIMES.length], S=randomState(rng,{now});
    O.reset(S,now); if(!O.open()) continue;
    const key=O.state().orderKey; O.answer(key);
    const afterRight=O.state(), id=O.ctx.fitOwned(key)[0];
    const flow=O.equip(id,{fromAnswer:true});
    const {L}=mine(afterRight,now); assert.equal(L.equip(key,id),flow==='confirmed'); assert.equal(flow,'confirmed');
    assert.equal(json(L.state()),json(O.state()));
    // 미획득 보증은 장착되지 않는다
    const fresh=mine({...S,items:{}},now); for(const k of KEYS) for(const cid of fits[k]) assert.equal(fresh.L.equip(k,cid),false);
    assert.equal(fresh.log.save,0);
    // 고른 뒤 확정 전에 다른 탭이 같은 보증을 장착했으면 원본도 거절한다
    const other=O.ctx.fitOwned(key).find(x=>x!==id)||id;
    O.reset(afterRight,now); const between={...afterRight,items:{...afterRight.items,[key]:other}};
    assert.equal(O.equip(id,{key,between}),'confirmed'); assert.equal(json(O.state()),json(between)); assert.equal(O.log.save,0);
    const stale=mine(between,now); assert.equal(stale.L.equip(key,id),false); assert.equal(json(stale.L.state()),json(between));
    done++; cases+=3;
  }
  assert.ok(done>=30,`done ${done}`);
});

test('previous-game saves keep items, orderDay, orderDone and orderKey through applySaved, like the original',()=>{
  const saves=[
    {owned:{'poo-270C':true,'ga-1470H':true},items:{arrow:1},orderDay:'2026-11-14',orderKey:'arrow',orderDone:1},
    {owned:{'ga-270E':true},items:{shield:'ga-270E',dagger:1},orderDay:'2026-11-15',orderKey:'',orderDone:0},
    {items:null,orderDay:null,orderKey:null},
    {orderDone:2,orderDay:'2026-10-02',orderKey:'potion'},
    {}
  ];
  const restore=section(template,'function applySaved(p){','function hasProgress(){');
  for(const p of saves){
    O.reset(base); vm.runInContext(restore+'\napplySaved('+json(p)+')',O.ctx);
    const {L}=mine(base); L.applySaved(clone(p));
    const pick=s=>({items:s.items,orderDay:s.orderDay,orderKey:s.orderKey,orderDone:s.orderDone});
    assert.equal(json(pick(L.state())),json(pick(O.state())),json(p));
    cases++;
  }
});

test('orders comparison volume',()=>{
  assert.ok(cases>1500,`only ${cases} comparisons`);
  console.log(`# orders comparisons: ${cases}`);
});
