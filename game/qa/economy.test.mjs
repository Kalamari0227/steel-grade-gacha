// 경제 함수(확정 뽑기·부품 조립·중복 스크랩) 원본 대조.
// 원본 app_tpl.html에서 section()으로 뽑은 원문을 vm 컨텍스트에서 그대로 실행하고,
// 같은 입력·같은 주입 난수·같은 시각에서 createLegacy()의 결과(S 전체 JSON, 반환값, 결과·저장 호출)와 비교한다.
//
// vm에 올리는 원본 구간(모두 원본에서 이어진 문장 그대로, createLegacy 청크 경계와 무관하게 뽑음):
//   var IMG = {…}            ('var IMG = {' ~ '/* 열처리 계열은')         — 원본 그림 표(값은 자리표시 문자열)
//   FAMS·PARTS 등 데이터      ('var FAMS = [' ~ 'var QUIZ = [')
//   POOL 한 줄               ('var POOL = Object.keys(IMG)' ~ 'var KEY = GAME_EDITION.save')
//   SCRAP_LV3/4 한 줄         ('var SCRAP_LV3 = 5' ~ 'var PULL_MAX')
//   등급·가중치·missingIn     ('function allChars()' ~ '/* ── 주문서')
//   findPart~QP~창고~craft    ('function findPart(key){' ~ 'function ptImg(')
//   PGRP                     ('var PGRP = [' ~ 'function renderParts(')
//   sweepPending             ('function sweepPending()' ~ 'var drawState =')
//   scrapPull·확정 버튼·#pullBox 클릭 핸들러 ('function scrapPull(lv, cost){' ~ 'var qState = null;')
// 스텁(원본 실행에 꼭 필요한 것만):
//   S            — 원본 init의 var S 대신 케이스마다 넣는 상태 객체
//   Math, Date   — random/now만 주입한 섀도(createLegacy와 같은 방식)
//   document     — getElementById가 돌려주는 가짜 요소: addEventListener로 넘긴 핸들러를 잡아 두고 textContent만 가짐
//                  (btnScrap3/btnScrap4/btnTen/pullBox 리스너 등록, #drawStock 문구 갱신용)
//   drawBusy     — 항상 false(원본은 GAME_DRAW.busy())
//   save, refresh — 호출 횟수만 센다
//   showPull     — (id, isNew, tag)를 기록
//   tenPull      — btnTen 리스너 등록에 이름만 필요(호출하지 않음)
// GAME_DRAW·window·openCard·closeDraw·finishDraw·showToast 등은 이 경로에서 불리지 않아 두지 않았다(불리면 즉시 오류).
//
// POOL 순서: 원본 POOL은 원본 IMG 표의 키 순서다. createLegacy도 같은 표를 section()으로 그대로 추출해(img 청크) 같은 순서의 POOL을 쓴다.
// 그래서 같은 난수에서 scrapPull·weightedPick·tenPull이 원본과 같은 카드를 고른다.
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
const originalSource=[
  section(template,'var IMG = {','/* 열처리 계열은'),
  section(template,'var FAMS = [','var QUIZ = ['),
  section(template,'var POOL = Object.keys(IMG)','var KEY = GAME_EDITION.save'),
  section(template,'var SCRAP_LV3 = 5','var PULL_MAX'),
  section(template,'function allChars()','/* ── 주문서'),
  section(template,'function findPart(key){','function ptImg('),
  section(template,'var PGRP = [','function renderParts('),
  section(template,'function sweepPending()','var drawState ='),
  section(template,'function scrapPull(lv, cost){','var qState = null;')
].join('\n');
const script=new vm.Script(originalSource,{filename:'app_tpl.html#economy'});

const json=v=>JSON.stringify(v), clone=v=>JSON.parse(JSON.stringify(v));
const NOW=Date.UTC(2026,10,20,3,0,0);
// 주입 난수: 고정값 여럿과 시드 기반 LCG(adapter.test와 같은 식)
const lcg=seed=>{let n=seed>>>0;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};
const RNGS={zero:()=>()=>0,half:()=>()=>0.5,top:()=>()=>0.999,seedA:()=>lcg(20261115),seedB:()=>lcg(7)};

// 원본 한 벌. 상태·난수·시각은 케이스마다 바꿔 끼운다.
function original(){
  const handlers={}, elements={};
  const el=id=>elements[id]||(elements[id]={id,textContent:'',addEventListener:(type,fn)=>{handlers[id]=fn;}});
  const log={save:0,refresh:0,pulls:[]};
  const math=Object.create(Math), date={now:()=>NOW,UTC:Date.UTC};
  const ctx=vm.createContext({S:null,Math:math,Date:date,document:{getElementById:el},
    drawBusy:()=>false,save:()=>{log.save++;},refresh:()=>{log.refresh++;},showPull:(id,isNew,tag)=>{log.pulls.push({id,isNew,tag});},tenPull:()=>{}});
  script.runInContext(ctx);
  return {ctx,handlers,elements,log,
    reset(S,rng=()=>0,now=NOW){ctx.S=clone(S);math.random=rng;date.now=()=>now;log.save=0;log.refresh=0;log.pulls=[];},
    run:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),
    state:()=>clone(ctx.S)};
}
const O=original();
function mine(S,rng=()=>0,now=NOW){
  const log={save:0,results:[]};
  const L=createLegacy({random:rng,now:()=>now,onSave:()=>{log.save++;},onResult:(ids,fresh)=>{log.results.push({ids:[...ids],fresh:[...fresh]});}});
  L.setState(clone(S)); return {L,log};
}

const base=createLegacy().state();
const L0=createLegacy();
const POOL=L0.pool, PARTS=L0.parts, QP=L0.qp.id;
const lv=id=>L0.lvOf(L0.findChar(id));
const ofLevel=n=>POOL.filter(id=>lv(id)===n);
const pick=(rng,list)=>list[Math.floor(rng()*list.length)];
const subset=(rng,list,p)=>list.filter(()=>rng()<p);
let cases=0;

test('extracted rule data and constants equal the original',()=>{
  assert.equal(json(POOL),json(O.run('POOL')),'same cards in the same order as the original IMG-key-order POOL');
  assert.equal(json(PARTS),json(O.run('PARTS')));
  assert.equal(json(L0.PGRP),json(O.run('PGRP')));
  assert.deepEqual([L0.SCRAP_LV3,L0.SCRAP_LV4],O.run('[SCRAP_LV3,SCRAP_LV4]'));
  assert.deepEqual([L0.SCRAP_LV3,L0.SCRAP_LV4],[5,10]);
  for(const p of PARTS) assert.equal(json(L0.findPart(p.key)),json(O.run('findPart('+json(p.key)+')')));
  assert.equal(L0.findPart('nope'),null); assert.equal(O.run('findPart("nope")'),null);
  cases+=PARTS.length+5;
});

test('missingIn matches the original for every level over random collections',()=>{
  const rng=lcg(11);
  for(let k=0;k<60;k++){
    const p=[0,0.3,0.7,1][k%4], owned=Object.fromEntries(subset(rng,POOL,p).map(id=>[id,true]));
    const S={...base,owned};
    for(const level of [1,2,3,4,5]){
      O.reset(S); const {L}=mine(S);
      const got=L.missingIn(level), want=O.run(`missingIn(${level})`);
      assert.equal(json(got),json(want),`lv${level} k${k}`); cases++;
      const all=ofLevel(level), fresh=all.filter(id=>!owned[id]);
      assert.deepEqual([...got],fresh.length?fresh:all,'undiscovered first, else whole level');
    }
  }
});

// 확정 뽑기 상태 모음: 도감 비움/일부/전부, 스크랩 부족·딱 맞음·여유, 옛 pending 유무
function scrapStates(level,cost){
  const all=ofLevel(level), rng=lcg(level*100+cost), out=[];
  const owneds=[{},Object.fromEntries(all.slice(0,Math.ceil(all.length/2)).map(id=>[id,true])),Object.fromEntries(all.slice(1).map(id=>[id,true])),
    Object.fromEntries(all.map(id=>[id,true])),Object.fromEntries(subset(rng,POOL,0.5).map(id=>[id,true]))];
  for(const owned of owneds) for(const scrap of [0,cost-1,cost,cost+7]) for(const pending of ['','ga-270C']){
    const stock=Object.fromEntries(Object.keys(owned).map(id=>[id,1+Math.floor(rng()*3)]));
    out.push({...base,owned,stock,scrap,pending});
  }
  return out;
}

test('scrapPull(3,5) and scrapPull(4,10) match the original button handlers and function',()=>{
  for(const [level,cost,button] of [[3,5,'btnScrap3'],[4,10,'btnScrap4']]) for(const S of scrapStates(level,cost)) for(const [name,make] of Object.entries(RNGS)){
    const label=json({level,name,scrap:S.scrap,pending:S.pending,owned:Object.keys(S.owned).length});
    // 원본 1: 실제 확정 버튼 클릭 핸들러(SCRAP_LV3/SCRAP_LV4를 원본이 고름)
    O.reset(S,make()); O.handlers[button]();
    const {L,log}=mine(S,make()); L.scrapPull(level,level===3?L.SCRAP_LV3:L.SCRAP_LV4);
    assert.equal(json(L.state()),json(O.state()),label);
    assert.equal(log.save,O.log.save,label+' save calls');
    assert.deepEqual(log.results,O.log.pulls.map(r=>({ids:[r.id],fresh:[r.isNew]})),label+' result');
    assert.ok(O.log.pulls.every(r=>r.tag==='LV'+level+' 확정'));
    // 원본 2: scrapPull 직접 호출 — 같은 결과여야 한다
    const viaButton=O.state(); O.reset(S,make()); O.ctx.scrapPull(level,cost);
    assert.equal(json(O.state()),json(viaButton),label+' direct');
    cases+=2;

    // 의미 검사(원본과 같다는 것 위에 규칙 자체를 못 박는다)
    const after=L.state(), swept=S.scrap+(S.pending?1:0);
    assert.equal(after.pending,'',label+' pending swept');
    if(swept<cost){
      assert.equal(json({...after,scrap:S.scrap,pending:S.pending}),json(S),label+' unchanged except sweep');
      assert.equal(after.scrap,swept); assert.equal(log.results.length,0);
      assert.equal(log.save,1,'original saves even when short');
    }else{
      const id=log.results[0].ids[0], all=ofLevel(level), fresh=all.filter(x=>!S.owned[x]);
      assert.equal(after.scrap,swept-cost,label);
      assert.ok((fresh.length?fresh:all).includes(id),label+' picks undiscovered first');
      assert.equal(log.results[0].fresh[0],!S.owned[id]);
      assert.equal(after.stock[id],(S.stock[id]||0)+1); assert.equal(after.owned[id],true);
    }
  }
});

test('scrapPull with no candidates (LV5 has none) returns before sweeping or saving, like the original',()=>{
  const S={...base,scrap:50,pending:'x'};
  O.reset(S); O.ctx.scrapPull(5,5); const {L,log}=mine(S); L.scrapPull(5,5);
  assert.equal(json(L.state()),json(O.state())); assert.equal(json(L.state()),json(S));
  assert.equal(log.save,0); assert.equal(O.log.save,0); cases++;
});

// 재고 패턴 생성: 부품 후보 강종에 0~3장, 가끔 QP 보유, 이미 만든 부품 일부
const partIds=[...new Set(PARTS.flatMap(p=>p.need.flatMap(s=>s.any)))];
function randomState(rng,{qp=rng()<0.3,done=0.2,fill=0.6}={}){
  const stock={}, owned={};
  for(const id of POOL) if(rng()<0.5) owned[id]=true;
  for(const id of partIds) if(rng()<fill){const n=Math.floor(rng()*4); if(n){stock[id]=n;owned[id]=true;}}
  if(qp){owned[QP]=true; if(rng()<0.5) stock[QP]=1;}
  const parts=Object.fromEntries(subset(rng,PARTS,done).map(p=>[p.key,{at:1,use:[]}]));
  return {...base,owned,stock,parts,scrap:Math.floor(rng()*30)};
}
// 사람이 고른 후보: 허용 목록 안·재고 없음·목록 밖·QP 섞어서
function randomPicks(rng,p){
  return p.need.map(sl=>{const r=rng();
    if(r<0.35) return pick(rng,sl.any);
    if(r<0.5) return pick(rng,POOL.filter(id=>!sl.any.includes(id)));
    if(r<0.6) return QP;
    if(r<0.7) return undefined;
    return pick(rng,sl.any);});
}

test('partPlan candidate choice matches the original over many stock patterns',()=>{
  const rng=lcg(2026);
  for(let k=0;k<80;k++){
    const S=randomState(rng);
    O.reset(S); const {L}=mine(S);
    PARTS.forEach((p,i)=>{
      for(const picks of [undefined,randomPicks(rng,p),randomPicks(rng,p)]){
        const arg=picks===undefined?'':','+json(picks);
        assert.equal(json(L.partPlan(p,picks)),json(O.run(`partPlan(PARTS[${i}]${arg})`)),`k${k} ${p.key} ${json(picks)}`); cases++;
      }
    });
  }
});

test('craft over all 35 parts with ample stock consumes like the original and keeps owned',()=>{
  for(const qp of [false,true]) for(const [name,make] of Object.entries(RNGS)){
    const stock=Object.fromEntries(partIds.map(id=>[id,9])), owned=Object.fromEntries(partIds.map(id=>[id,true]));
    if(qp) owned[QP]=true;
    const S={...base,owned,stock};
    O.reset(S,make()); const {L}=mine(S,make());
    PARTS.forEach((p,i)=>{
      const now=NOW+i*1000; O.reset(O.state(),make(),now); const L2=mine(L.state(),make(),now);
      const ok=L2.L.craft(p.key), want=O.run(`craft(${json(p.key)})`);
      assert.equal(ok,want); assert.equal(ok,true,p.key);
      assert.equal(json(L2.L.state()),json(O.state()),`${name} qp${qp} ${p.key}`);
      assert.equal(L2.log.save,O.log.save);
      assert.deepEqual(L2.L.state().parts[p.key].at,now);
      L.setState(L2.L.state()); cases++;
    });
    const end=L.state();
    assert.equal(json(end.owned),json(owned),'owned is never consumed');
    assert.equal(L.carDone(),true); assert.equal(O.run('carDone()'),true);
    assert.equal(L.partCount(),PARTS.length);
    if(qp){
      assert.equal(end.stock[QP],undefined); assert.equal(end.owned[QP],true);
      for(const key of ['bumper','apillar','bpillar','impact','stabil']) assert.ok(end.parts[key].use.includes(QP),key+' uses QP');
    }
  }
});

test('craft refusals (short stock, already built, unknown key) leave state unchanged like the original',()=>{
  const short={...base,owned:{'ga-270E':true},stock:{'ga-270E':1}};
  const built={...base,stock:Object.fromEntries(partIds.map(id=>[id,5])),parts:{roof:{at:1,use:['ga-270E']}}};
  for(const S of [short,built]) for(const p of PARTS) for(const picks of [undefined,p.need.map(sl=>sl.any[0])]){
    O.reset(S); const {L,log}=mine(S);
    const arg=picks?','+json(picks):'';
    const ok=L.craft(p.key,picks), want=O.run(`craft(${json(p.key)}${arg})`);
    assert.equal(ok,want,p.key);
    if(!ok){assert.equal(json(L.state()),json(S));assert.equal(log.save,0);}
    assert.equal(json(L.state()),json(O.state()),p.key); cases++;
  }
  O.reset(base); const {L}=mine(base);
  assert.equal(L.craft('nope'),false); assert.equal(O.run('craft("nope")'),false); assert.equal(json(L.state()),json(base));
  // 이미 만든 부품은 재고가 넉넉해도 false
  O.reset(built); const b=mine(built); assert.equal(b.L.craft('roof'),false); assert.equal(O.run('craft("roof")'),false);
  assert.equal(json(b.L.state()),json(built)); cases+=2;
});

test('craft with human picks, invalid picks and QP across random states matches the original',()=>{
  const rng=lcg(515);
  for(let k=0;k<60;k++){
    const S=randomState(rng,{fill:0.8,done:0.1});
    let O_S=S, L_S=S;
    PARTS.forEach((p,i)=>{
      const picks=rng()<0.7?randomPicks(rng,p):undefined, now=NOW+k*99991+i;
      O.reset(O_S,()=>0,now); const {L,log}=mine(L_S,()=>0,now);
      const arg=picks===undefined?'':','+json(picks);
      const ok=L.craft(p.key,picks), want=O.run(`craft(${json(p.key)}${arg})`);
      assert.equal(ok,want,`k${k} ${p.key}`);
      assert.equal(json(L.state()),json(O.state()),`k${k} ${p.key} ${json(picks)}`);
      assert.equal(log.save,O.log.save);
      if(!ok) assert.equal(json(L.state()),json(L_S));
      else for(const [a,b] of Object.entries(L_S.owned)) assert.equal(L.state().owned[a],b);
      O_S=O.state(); L_S=L.state(); cases++;
    });
  }
});

test('QP fills 1470-class slots without being consumed; explicit human picks win when stocked',()=>{
  const S={...base,owned:{[QP]:true,'ssial-1470M':true},stock:{'ssial-1470M':3,'ga-1470H':2,'poo-PHS':1}};
  for(const p of PARTS.filter(p=>p.need.some(sl=>L0.qp.keys.some(k=>sl.any.includes(k))))){
    for(const picks of [undefined,p.need.map(sl=>sl.any.find(id=>L0.qp.keys.includes(id))),p.need.map(()=>QP)]){
      O.reset(S); const {L}=mine(S);
      const arg=picks===undefined?'':','+json(picks);
      const ok=L.craft(p.key,picks), want=O.run(`craft(${json(p.key)}${arg})`);
      assert.equal(ok,want); assert.equal(json(L.state()),json(O.state()),p.key+json(picks));
      assert.equal(L.state().owned[QP],true); cases++;
    }
  }
});

test('dupScrap matches the original #pullBox data-draw-scrap handler',()=>{
  for(const n of [0,1,2,3,7]) for(const scrap of [0,4]){
    const id='ga-590Y', S={...base,owned:{[id]:true},stock:n?{[id]:n,'poo-270C':1}:{'poo-270C':1},scrap};
    const button={disabled:false,textContent:'',hasAttribute:()=>false,getAttribute:name=>name==='data-draw-scrap'?id:null};
    O.reset(S); O.handlers.pullBox({target:{closest:sel=>sel==='button'?button:null}});
    const {L,log}=mine(S); L.dupScrap(id);
    assert.equal(json(L.state()),json(O.state()),`stock ${n}`);
    assert.equal(log.save,O.log.save);
    const after=L.state();
    if(n<=1){assert.equal(json(after),json(S));assert.equal(log.save,0);assert.equal(button.disabled,false);}
    else{assert.equal(after.stock[id],n-1);assert.equal(after.scrap,scrap+1);assert.equal(button.disabled,true);}
    cases++;
  }
});

test('sweepPending matches the original',()=>{
  for(const pending of ['','poo-270C',{x:1}]) for(const scrap of [0,3]){
    const S={...base,pending,scrap}; O.reset(S); O.ctx.sweepPending(); const {L}=mine(S); L.sweepPending();
    assert.equal(json(L.state()),json(O.state())); cases++;
  }
});

test('slotOk, partReady, partDone, partCount, partsReadyCount, carDone, stockOf, qpCovers match the original',()=>{
  const rng=lcg(99);
  for(let k=0;k<80;k++){
    const S=randomState(rng,{done:[0,0.2,0.9,1][k%4],fill:[0.2,0.6,1][k%3]});
    O.reset(S); const {L}=mine(S);
    const got={count:L.partCount(),ready:L.partsReadyCount(),car:L.carDone(),
      parts:PARTS.map(p=>[L.partReady(p),L.partDone(p),p.need.map(sl=>[L.slotOk(sl),L.qpCovers(sl)])]),
      stock:partIds.map(id=>L.stockOf(id))};
    const want=O.run(`({count:partCount(),ready:partsReadyCount(),car:carDone(),
      parts:PARTS.map(function(p){return [partReady(p),partDone(p),p.need.map(function(sl){return [slotOk(sl),qpCovers(sl)];})];}),
      stock:${json(partIds)}.map(stockOf)})`);
    assert.equal(json(got),json(want),`k${k}`); cases++;
  }
});

test('economy comparison volume',()=>{
  // 위 대조가 실제로 돌았는지(실수로 루프가 비지 않았는지) 확인
  assert.ok(cases>10000,`only ${cases} comparisons`);
  console.log(`# economy comparisons: ${cases}`);
});
