// 차고 경제(차량 확정·차고 조회) 원본 대조. economy.test.mjs와 같은 방식이다.
// 원본 app_tpl.html에서 section()으로 뽑은 원문을 vm에서 그대로 실행하고, 같은 상태·같은 시각에서 createLegacy() 결과와 비교한다.
//
// vm에 올리는 원본 구간:
//   var IMG = {…}, FAMS·PARTS·IMG_CAR·CARS·findCar 데이터, POOL 한 줄, 등급·가중치, findPart~QP~창고~craft (economy.test와 같음)
//   applySaved              ('function applySaved(p){' ~ 'function hasProgress(){')  — 옛 저장본 p.car 한 대 형식 포함
//   renderCar + 차고 조회    ('function renderCar(){' ~ 'function renderGarage(){')  — 실제 #takeCar 클릭 핸들러를 돌린다
// 스텁: S(케이스마다), Date(now만 주입), document(가짜 요소: innerHTML의 garage-option 버튼을 읽어 돌려주고 리스너를 잡아 둠),
//   matchMedia(항상 false), GAME_GARAGE.showStage(키만 기록), save·refresh(횟수만 셈).
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
const script=new vm.Script([
  section(template,'var IMG = {','/* 열처리 계열은'),
  section(template,'var FAMS = [','var QUIZ = ['),
  section(template,'var POOL = Object.keys(IMG)','var KEY = GAME_EDITION.save'),
  section(template,'function allChars()','/* ── 주문서'),
  section(template,'function findPart(key){','function ptImg('),
  section(template,'function applySaved(p){','function hasProgress(){'),
  section(template,'function renderCar(){','function renderGarage(){')
].join('\n'),{filename:'app_tpl.html#garage'});

const json=v=>JSON.stringify(v), clone=v=>JSON.parse(JSON.stringify(v));
const NOW=Date.UTC(2026,10,21,9,30,0);
const KEYS=['t','h','n','m','s','z','b','d'];
const lcg=seed=>{let n=seed>>>0;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};

function original(){
  const log={save:0,refresh:0,stage:[]}, elements={};
  const el=id=>elements[id]||(elements[id]=element(id));
  function element(id){
    const e={id,className:'',textContent:'',hidden:false,isConnected:true,handlers:{},buttons:[],
      focus(){},scrollIntoView(){},setAttribute(){},addEventListener(type,fn){e.handlers[type]=fn;},
      querySelectorAll(sel){
        if(sel==='.garage-option') return e.buttons;
        if(sel==='.garage-option:not(:disabled)') return e.buttons.filter(b=>!b.disabled);
        throw new Error('unexpected selector '+sel);
      }};
    let html='';
    Object.defineProperty(e,'innerHTML',{get:()=>html,set:v=>{html=v;
      // 원본이 그린 garage-option 버튼(data-k, disabled)을 그대로 읽어 가짜 버튼으로 만든다
      e.buttons=[...v.matchAll(/<button type="button" class="garage-option" data-k="([^"]*)"[^>]*?( disabled)?>/g)].map(([,k,dis])=>{
        const b={k,disabled:!!dis,isConnected:true,handlers:{},getAttribute:n=>n==='data-k'?k:null,setAttribute(){},focus(){},scrollIntoView(){},
          addEventListener(type,fn){b.handlers[type]=fn;}};
        return b;
      });}});
    return e;
  }
  const date={now:()=>NOW,UTC:Date.UTC};
  const ctx=vm.createContext({S:null,Math:Object.create(Math),Date:date,document:{getElementById:el},
    matchMedia:()=>({matches:false}),GAME_GARAGE:{showStage:(node,k)=>{log.stage.push(k);}},
    save:()=>{log.save++;},refresh:()=>{log.refresh++;}});
  script.runInContext(ctx);
  return {ctx,log,elements,
    reset(S,now=NOW){ctx.S=clone(S);date.now=()=>now;log.save=0;log.refresh=0;log.stage=[];for(const k in elements) delete elements[k];},
    run:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),
    state:()=>clone(ctx.S),
    // 실제 화면 흐름: renderCar → 차종 버튼 클릭 → (그 사이 상태가 바뀔 수 있음) → #takeCar 클릭
    // 차종 버튼이 없거나 막혀 있으면 'no-option', 버튼 핸들러가 거절하면 'no-confirm'
    take(k,between){
      ctx.renderCar();
      const option=el('carBox').buttons.find(b=>b.k===k&&!b.disabled);
      if(!option) return 'no-option';
      delete el('takeCar').handlers.click; option.handlers.click();
      const confirm=el('takeCar').handlers.click; if(!confirm) return 'no-confirm';
      if(between) ctx.S=clone(between);
      log.save=0;log.refresh=0;
      confirm(); return 'confirmed';
    }};
}
const O=original();
function mine(S,now=NOW){
  const log={save:0};
  const L=createLegacy({now:()=>now,onSave:()=>{log.save++;}});
  L.setState(clone(S)); return {L,log};
}

const L0=createLegacy(), base=L0.state(), PARTS=L0.parts;
const fullParts=Object.fromEntries(PARTS.map((p,i)=>[p.key,{at:1000+i,use:['ga-270E']}]));
const carsOf=keys=>keys.map((k,i)=>({k,at:NOW-(i+1)*86400000}));
const extras={owned:{'ga-270E':true,'poo-PHS':true},stock:{'ga-270E':3,'poo-PHS':1},scrap:17,items:{tea:2},pending:'',last:'ga-270E'};
let cases=0;

test('CARS and findCar are the original data, 8 cars in the original order',()=>{
  assert.equal(json(L0.CARS),json(O.run('CARS')));
  assert.deepEqual(L0.CARS.map(c=>c.key),KEYS);
  for(const c of L0.CARS) for(const f of ['key','tag','body','maker','line']) assert.equal(typeof c[f],'string');
  for(const k of [...KEYS,'x','',null]) assert.equal(json(L0.findCar(k)),json(O.run('findCar('+json(k)+')')));
  assert.equal(L0.findCar('x'),null);
  const data=JSON.parse(fs.readFileSync(path.join(root,'public/data.json'),'utf8'));
  assert.equal(json(data.cars),json(O.run('CARS.map(function(c){return {key:c.key,tag:c.tag,body:c.body,maker:c.maker,line:c.line};})')));
  for(const k of KEYS) assert.ok(data.assets['car:'+k],'car art for '+k);
  cases+=KEYS.length+3;
});

test('takeCar matches the original #takeCar handler for every car over every owned subset size',()=>{
  const rng=lcg(4325);
  for(const k of KEYS) for(let n=0;n<=7;n++){
    const others=KEYS.filter(x=>x!==k), prior=others.filter(()=>rng()<n/7).slice(0,n);
    for(const S of [{...base,...extras,parts:clone(fullParts),cars:carsOf(prior)},{...base,parts:clone(fullParts),cars:carsOf(prior)}]){
      const now=NOW+n*7919+KEYS.indexOf(k);
      O.reset(S,now); assert.equal(O.take(k),'confirmed',k);
      const {L,log}=mine(S,now); const ok=L.takeCar(k);
      assert.equal(ok,true);
      assert.equal(json(L.state()),json(O.state()),`${k} after ${json(prior)}`);
      assert.equal(log.save,O.log.save); assert.equal(log.save,1);
      assert.deepEqual(O.log.stage,[k]);
      const after=L.state();
      assert.equal(json(after.cars),json([...S.cars,{k,at:now}]));
      assert.equal(json(after.parts),'{}');
      assert.equal(json({...after,cars:S.cars,parts:S.parts}),json(S),'owned/stock/scrap/items untouched');
      cases++;
    }
  }
});

test('collecting all 8 cars in sequence matches the original, then every further take is refused',()=>{
  let S={...base,...extras,cars:[],parts:{}};
  for(const [i,k] of [...KEYS].reverse().entries()){
    S={...S,parts:clone(fullParts)};
    const now=NOW+i*3600000;
    O.reset(S,now); assert.equal(O.take(k),'confirmed');
    const {L}=mine(S,now); assert.equal(L.takeCar(k),true);
    assert.equal(json(L.state()),json(O.state()));
    assert.equal(L.carsOwned(),i+1); assert.equal(L.carAtOf(k),now); assert.equal(L.allCarsDone(),i===7);
    S=L.state(); cases++;
  }
  S={...S,parts:clone(fullParts)};
  for(const k of [...KEYS,'x']){
    O.reset(S); assert.equal(O.take(k),'no-option');
    const {L,log}=mine(S); assert.equal(L.takeCar(k),false); assert.equal(json(L.state()),json(S)); assert.equal(log.save,0); cases++;
  }
});

test('guard refusals leave state unchanged, like the original at the option and at the confirm step',()=>{
  const missingOne=Object.fromEntries(Object.entries(fullParts).slice(1));
  const refusals=[
    // [이름, 버튼 누를 때 상태, 확정 누를 때 상태(바뀌었으면), 차종]
    ['parts incomplete',{...base,...extras,parts:missingOne,cars:carsOf(['t'])},null,'h'],
    ['no parts',{...base,parts:{},cars:[]},null,'t'],
    ['parts falsy value',{...base,parts:{...fullParts,roof:0},cars:[]},null,'t'],
    ['already owned',{...base,...extras,parts:clone(fullParts),cars:carsOf(['t','h'])},null,'h'],
    ['parts lost before confirm',{...base,...extras,parts:clone(fullParts),cars:[]},{...base,...extras,parts:missingOne,cars:[]},'m'],
    ['owned elsewhere before confirm',{...base,...extras,parts:clone(fullParts),cars:carsOf(['t'])},{...base,...extras,parts:clone(fullParts),cars:carsOf(['t','s'])},'s'],
    // 8칸이 찼지만(중복 한 대 포함) k는 아직 없는 상태: allCarsDone만으로 거절
    ['all 8 slots filled',{...base,parts:clone(fullParts),cars:carsOf(['t','h','n','m','s','z','b','b'])},null,'d'],
    ['all 8 filled before confirm',{...base,parts:clone(fullParts),cars:carsOf(['t','h','n','m','s','z','b'])},{...base,parts:clone(fullParts),cars:carsOf(['t','h','n','m','s','z','b','b'])},'d']
  ];
  for(const [name,S,between,k] of refusals){
    O.reset(S); const flow=O.take(k,between);
    const final=between||S;
    if(between) assert.equal(flow,'confirmed',name+' reaches confirm'); else assert.notEqual(flow,'confirmed',name);
    assert.equal(json(O.state()),json(final),name+' original unchanged');
    assert.equal(O.log.save,0); assert.deepEqual(O.log.stage,[]);
    if(between) assert.match(O.elements.carStatus.textContent,/바뀌었어요/);
    const {L,log}=mine(final); assert.equal(L.takeCar(k),false,name);
    assert.equal(json(L.state()),json(final),name); assert.equal(log.save,0);
    cases++;
  }
});

test('hasCar, carAtOf, carsOwned, allCarsDone, carDone, partCount match the original across states',()=>{
  const rng=lcg(4336);
  for(let n=0;n<120;n++){
    const keys=KEYS.filter(()=>rng()<[0,0.3,0.7,1][n%4]);
    const cars=keys.map(k=>rng()<0.2?{k}:{k,at:Math.floor(rng()*NOW)});
    if(n%9===0) cars.push({k:'zz',at:5});
    const parts=Object.fromEntries(PARTS.filter(()=>rng()<[0.3,0.95,1][n%3]).map(p=>[p.key,rng()<0.3?1:{at:2,use:[]}]));
    const S={...base,cars,parts};
    O.reset(S); const {L}=mine(S);
    const probe=[...KEYS,'zz','x'];
    const got={has:probe.map(L.hasCar),at:probe.map(L.carAtOf),owned:L.carsOwned(),all:L.allCarsDone(),done:L.carDone(),count:L.partCount()};
    const want=O.run(`({has:${json(probe)}.map(function(k){return hasCar(k);}),at:${json(probe)}.map(function(k){return carAtOf(k);}),owned:carsOwned(),all:allCarsDone(),done:carDone(),count:partCount()})`);
    assert.equal(json(got),json(want),`n${n}`); cases++;
  }
});

test('previous-game saves (single p.car form) restore through applySaved and read the same as the original',()=>{
  const saves=[
    {owned:{'ga-270E':true},car:'t',carAt:12345},
    {owned:{},car:'h'},
    {car:'z',carAt:0,parts:fullParts},
    {cars:[{k:'n',at:7}],car:'t',carAt:9},
    {cars:'broken',car:'t'},
    {cars:null,car:'m',carAt:44},
    {cars:[{k:'b'},{k:'d',at:3}],parts:{roof:1}},
    {owned:{'poo-PHS':true},stock:{'poo-PHS':2}},
    {car:'s',carAt:1,parts:fullParts,stock:{'ga-270E':1}}
  ];
  for(const p of saves){
    O.reset(base); vm.runInContext('applySaved('+json(p)+')',O.ctx);
    const {L}=mine(base); L.applySaved(clone(p));
    assert.equal(json(L.state()),json(O.state()),json(p));
    const probe=[...KEYS,'x'];
    const read=X=>({has:probe.map(k=>X.hasCar(k)),at:probe.map(k=>X.carAtOf(k)),owned:X.carsOwned(),all:X.allCarsDone(),done:X.carDone()});
    assert.equal(json(read(L)),json(read(O.ctx)),json(p));
    // 옛 한 대 형식은 cars가 없을 때만 [{k,at}]로 옮겨진다
    if(!p.cars&&p.car) assert.equal(json(L.state().cars),json([{k:p.car,at:p.carAt||0}]));
    // 복원한 상태에서 확정도 원본과 같다
    const S=L.state(), k=KEYS.find(x=>!L.hasCar(x));
    O.reset(S); const flow=O.take(k); const m=mine(S); const ok=m.L.takeCar(k);
    assert.equal(ok,flow==='confirmed'); assert.equal(json(m.L.state()),json(O.state()),'take after '+json(p));
    cases+=2;
  }
});

test('garage comparison volume',()=>{
  assert.ok(cases>250,`only ${cases} comparisons`);
  console.log(`# garage comparisons: ${cases}`);
});
