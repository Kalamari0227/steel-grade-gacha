import {createLegacy} from './legacy.mjs';
// 정식 진행 저장 키. 이전 게임(같은 출처의 /steel-grade-gacha-game/)과 같은 칸을 쓰며, 원본 applySaved()로 이어받는다.
export const SAVE_KEY='sgg_game_save_v1';
// 체험판 시절의 저장 키. 체험용 지급이 섞여 있어 읽지도 지우지도 않는다.
export const TRIAL_KEY='steel_companion_prototype_20261109_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;

// 원본 applySaved()로 정규화한 뒤의 값을 검사한다. 원본이 조용히 받아들이는 잘못된 형식(음수, 없는 ID 등)은
// 덮어쓰지 않고 보류한다. 엔진이 아직 쓰지 않는 항목(퀴즈·주문·아이템·차량 기록)은 형식만 보고 그대로 둔다.
// parts: 부품 기록. 원본 craft()는 {at,use}를 쓰지만 원본 partAt()/partUse()는 숫자(옛 형식)나 use가 없는 객체도 읽는다.
// 그래서 키가 35부품 중 하나이고, 값이 양의 숫자이거나 객체(at이 있으면 0 이상 정수, use가 있으면 그 부품 칸의 후보 또는 QP 목록)이면 받는다.
function validParts(parts,defs,qp){
  return Object.entries(parts).every(([key,v])=>{
    const def=defs.get(key);
    if(!def) return false;
    if(typeof v==='number') return Number.isFinite(v)&&v>0;
    if(!plain(v)) return false;
    if('at' in v&&!nonnegative(v.at)) return false;
    if('use' in v){
      if(!Array.isArray(v.use)) return false;
      const allowed=new Set([...def.need.flatMap(sl=>sl.any),qp]);
      if(!v.use.every(id=>typeof id==='string'&&allowed.has(id))) return false;
    }
    return true;
  });
}
// cars: 원본 S.cars는 [{k,at}]. 모르는 차종·중복·잘못된 시각은 거절한다(원본 hasCar/carAtOf가 읽는 형태만 허용).
function validCars(cars,carKeys){
  const seen=new Set();
  return cars.length<=carKeys.size&&cars.every(c=>{
    if(!plain(c)||typeof c.k!=='string'||!carKeys.has(c.k)||seen.has(c.k)) return false;
    seen.add(c.k);
    return !('at' in c)||nonnegative(c.at);
  });
}
function validState(value,ids,defs,qp,carKeys){
  if(!plain(value)) return false;
  if(typeof value.pending!=='string') return false;
  if(!['owned','stock','items','parts'].every(k=>plain(value[k]))||!Array.isArray(value.cars)) return false;
  if(!['scrap','extra','pullAt','pullUsed'].every(k=>nonnegative(value[k]))) return false;
  if(!Object.entries(value.owned).every(([id,v])=>ids.has(id)&&v===true)) return false;
  if(!Object.entries(value.stock).every(([id,v])=>ids.has(id)&&nonnegative(v)&&v>0&&value.owned[id])) return false;
  if(!validParts(value.parts,defs,qp)||!validCars(value.cars,carKeys)) return false;
  if('featured' in value&&!(typeof value.featured==='string'&&value.owned[value.featured]===true)) return false;
  if(value.results!==null){
    const r=value.results;
    if(!plain(r)||typeof r.id!=='string'||!nonnegative(r.at)||!['single','ten'].includes(r.mode)) return false;
    // exchange: LV3·LV4 확정 교환으로 얻은 1장 결과의 표시(3 또는 4). 없으면 일반 출하.
    if('exchange' in r&&!(r.mode==='single'&&(r.exchange===3||r.exchange===4))) return false;
    if(!Array.isArray(r.cards)||r.cards.length!==(r.mode==='single'?1:10)) return false;
    if(!r.cards.every(c=>plain(c)&&ids.has(c.id)&&value.owned[c.id]&&typeof c.isNew==='boolean'&&nonnegative(c.stock))) return false;
  }
  return true;
}

export function createEngine({storage=globalThis.localStorage,now=Date.now,random=Math.random}={}){
  let warning='', blocked=false, preserveRawBackup=false, lastRaw=null, lastResult=null, commandBusy=false;
  const legacy=createLegacy({now,random,onSave:()=>{},onResult:(ids,fresh)=>{
    lastResult={id:`${now()}-${++serial}`,mode:ids.length===10?'ten':'single',at:now(),cards:ids.map((id,i)=>({id,isNew:fresh[i],stock:legacy.state().stock[id]}))};
  }});
  const ids=new Set(legacy.allChars().map(c=>c.id)); let serial=0;
  const partDefs=new Map(legacy.parts.map(p=>[p.key,p]));
  const carKeys=new Set(legacy.CARS.map(c=>c.key));
  // 새 프로필은 원본 S의 기본값(추가 출하 0, 스크랩 0)으로 시작한다. results는 마지막 출하 결과(없으면 null).
  legacy.state().results=null;
  const fresh=clone(legacy.state());
  const hold=message=>{blocked=true;preserveRawBackup=true;warning=message;legacy.setState(clone(fresh));};
  try{
    lastRaw=storage.getItem(SAVE_KEY);
    if(lastRaw!==null){
      const parsed=JSON.parse(lastRaw);
      if(!plain(parsed)) hold('저장 자료가 손상되어 덮어쓰기를 중단했습니다. 백업을 보관해 주세요.');
      else{
        // 원본 정규화: 빠진 항목은 기본값, 옛 재고·차량 형식 이전, pullUsed 추정. 원본에 없는 results·featured는 따로 옮긴다.
        legacy.applySaved(parsed);
        const s=legacy.state();
        s.results='results' in parsed?parsed.results:null;
        if('featured' in parsed) s.featured=parsed.featured;
        if(!validState(s,ids,partDefs,legacy.qp.id,carKeys)) hold('저장 자료가 손상되어 덮어쓰기를 중단했습니다. 백업을 보관해 주세요.');
      }
    }
  }catch(error){
    if(!(error instanceof Error)) throw error;
    blocked=true;preserveRawBackup=lastRaw!==null;legacy.setState(clone(fresh));warning=error instanceof SyntaxError?'저장 자료가 손상되어 출하를 중단했습니다. 기존 자료는 덮어쓰지 않습니다.':'저장 자료를 읽지 못해 출하를 중단했습니다. 기존 자료는 덮어쓰지 않습니다.';
  }
  const state=()=>clone(legacy.state());
  function save(){
    if(blocked) return false;
    const raw=JSON.stringify(legacy.state());
    try{
      if(storage.getItem(SAVE_KEY)!==lastRaw){blocked=true;warning='다른 탭에서 진행이 바뀌었습니다. 현재 메모리 결과를 백업한 뒤 새로고침해 주세요.';return false;}
      storage.setItem(SAVE_KEY,raw);
      if(storage.getItem(SAVE_KEY)!==raw){warning='브라우저가 저장을 받아 주지 않았습니다. 현재 결과는 메모리에만 있으며 백업을 보관해 주세요.';return false;}
      lastRaw=raw;warning='';return true;
    }catch(error){
      if(!(error instanceof Error)) throw error;
      warning='진행 저장에 실패했습니다. 현재 결과는 메모리에만 있으며 백업을 보관해 주세요.';return false;
    }
  }
  function ship(count){
    if(blocked||commandBusy||![1,10].includes(count)) return {ok:false,error:warning||'지금 출하할 수 없습니다.'};
    try{
      if(storage.getItem(SAVE_KEY)!==lastRaw){blocked=true;warning='다른 탭에서 진행이 바뀌었습니다. 현재 메모리 결과를 백업한 뒤 새로고침해 주세요.';return {ok:false,error:warning};}
    }catch(error){
      if(!(error instanceof Error)) throw error;
      warning='저장을 확인할 수 없어 출하를 중단했습니다. 백업을 보관해 주세요.';blocked=true;return {ok:false,error:warning};
    }
    if(count===1&&legacy.pullsLeft()<=0||count===10&&!legacy.tenReady()) return {ok:false,error:'출하 자원이 부족합니다.'};
    commandBusy=true;
    try{
      lastResult=null; if(count===1) legacy.single(); else legacy.ten();
      legacy.state().results=clone(lastResult); save();
      return {ok:true,result:clone(lastResult)};
    }finally{commandBusy=false;}
  }
  function guard(){
    if(blocked||commandBusy) return warning||'지금 처리할 수 없습니다.';
    try{
      if(storage.getItem(SAVE_KEY)!==lastRaw){blocked=true;warning='다른 탭에서 진행이 바뀌었습니다. 현재 메모리 결과를 백업한 뒤 새로고침해 주세요.';return warning;}
    }catch(error){
      if(!(error instanceof Error)) throw error;
      warning='저장을 확인할 수 없어 작업을 중단했습니다. 백업을 보관해 주세요.';blocked=true;return warning;
    }
    return '';
  }
  // 선행개발(QP): 원본 개발 거래와 같은 규칙. 공개 조건·소재 2칸·스크랩 10, 한 번만 지급.
  function qpStatus(){
    const s=legacy.state(), qp=legacy.qp, plan=legacy.partPlan({need:qp.need});
    const owned=legacy.hasQP(), revealed=legacy.qpRevealed(), scrapOk=s.scrap>=qp.scrap;
    return {id:qp.id,revealed,owned,ready:revealed&&!owned&&!!plan&&scrapOk&&!blocked,scrap:s.scrap,scrapNeed:qp.scrap,
      slots:qp.need.map((sl,i)=>({name:sl.n,ids:sl.any.slice(),use:plan?plan[i]:null,have:sl.any.some(id=>(s.stock[id]||0)>0)})),
      keys:qp.keys.map(id=>({id,owned:!!s.owned[id]}))};
  }
  function develop(){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    const qp=legacy.qp, s=legacy.state();
    if(legacy.hasQP()) return {ok:false,error:'이미 개발한 소재입니다.'};
    if(!legacy.qpRevealed()) return {ok:false,error:'선행개발 과제가 아직 열리지 않았습니다.'};
    const use=legacy.partPlan({need:qp.need});
    if(!use||s.scrap<qp.scrap) return {ok:false,error:'개발 소재나 스크랩이 모자랍니다.'};
    commandBusy=true;
    try{
      use.forEach(id=>legacy.addStock(id,-1));
      s.scrap-=qp.scrap; s.owned[qp.id]=true; legacy.addStock(qp.id,1);
      save();
      return {ok:true,development:{id:qp.id,used:use.slice(),scrap:qp.scrap}};
    }finally{commandBusy=false;}
  }
  // 로비 대표 동료: 직접 지정한 동료, 없으면 마지막 출하에서 새로 발견한 동료, 그것도 없으면 가장 높은 등급의 보유 동료.
  // 표시 선택일 뿐 재고·자원을 바꾸지 않는다. 지정하기 전에는 저장에 항목이 없다.
  function featured(){
    const s=legacy.state();
    if(typeof s.featured==='string'&&s.owned[s.featured]) return {id:s.featured,pinned:true};
    const drawn=(s.results?.cards||[]).filter(c=>s.owned[c.id]).reverse();
    const recent=drawn.find(c=>c.isNew)||drawn[0];
    if(recent) return {id:recent.id,pinned:false};
    let best=null, top=-1;
    for(const c of legacy.allChars()){ const lv=legacy.lvOf(c); if(s.owned[c.id]&&lv>top){best=c.id;top=lv;} }
    return {id:best,pinned:false};
  }
  function setFeatured(id){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    const s=legacy.state();
    if(!ids.has(id)||!s.owned[id]) return {ok:false,error:'발견한 동료만 대표로 지정할 수 있습니다.'};
    commandBusy=true;
    try{ s.featured=id; save(); return {ok:true,featured:id}; }
    finally{commandBusy=false;}
  }
  // 출하 주기: 원본 legacy 함수만 쓴다. 남은 출하가 없으면 다음 기본 출하까지 남은 시간(ms)과 원본 표기.
  function status(){
    const s=legacy.state(), singleLeft=legacy.pullsLeft(), base=legacy.pullBaseLeft();
    const nextIn=base>0?0:legacy.readyIn(s.pullAt);
    const exchanges=[[3,legacy.SCRAP_LV3],[4,legacy.SCRAP_LV4]].map(([lv,cost])=>({lv,cost,can:!blocked&&s.scrap+(s.pending?1:0)>=cost&&legacy.missingIn(lv).length>0}));
    return {warning,blocked,singleLeft,baseLeft:base,extra:s.extra,scrap:s.scrap,nextIn,wait:singleLeft>0||nextIn===0?'':legacy.fmtWait(nextIn),canTen:!blocked&&legacy.tenReady(),exchanges};
  }
  // LV3·LV4 확정 교환: 원본 scrapPull()을 그대로 쓴다(스크랩 5·10, 미발견 우선, 다 모았으면 그 등급 전체). 부족하면 아무것도 바꾸지 않는다.
  function exchange(lv){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(lv!==3&&lv!==4) return {ok:false,error:'교환할 수 없는 등급입니다.'};
    const cost=lv===3?legacy.SCRAP_LV3:legacy.SCRAP_LV4, s=legacy.state();
    if(!legacy.missingIn(lv).length) return {ok:false,error:'교환할 소재가 없습니다.'};
    if(s.scrap+(s.pending?1:0)<cost) return {ok:false,error:'스크랩이 모자랍니다.'};
    commandBusy=true;
    try{
      lastResult=null; legacy.scrapPull(lv,cost);
      if(!lastResult) return {ok:false,error:'교환하지 못했습니다.'};
      lastResult.exchange=lv;
      legacy.state().results=clone(lastResult); save();
      return {ok:true,result:clone(lastResult),cost};
    }finally{commandBusy=false;}
  }
  // 중복 스크랩: 재고가 2장 이상일 때만 1장을 스크랩 1로 바꾼다. 마지막 1장은 남긴다(원본 stockOf(id) <= 1 이면 무시).
  function scrap(id){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(!ids.has(id)) return {ok:false,error:'알 수 없는 소재입니다.'};
    if((legacy.state().stock[id]||0)<=1) return {ok:false,error:'마지막 1장은 스크랩할 수 없습니다.'};
    commandBusy=true;
    try{
      legacy.dupScrap(id); save();
      const s=legacy.state();
      return {ok:true,id,scrap:s.scrap,stock:s.stock[id]||0};
    }finally{commandBusy=false;}
  }
  // 부품 목록: 원본 그룹(PGRP) 순서로 완성·제작 가능·부족을 알려 준다. 상태를 바꾸지 않는다.
  function partList(){
    const s=legacy.state();
    const row=p=>({key:p.key,no:p.no,name:p.name,grp:p.grp,state:legacy.partDone(p)?'done':legacy.partReady(p)?'ready':'short'});
    return {groups:legacy.PGRP.map(name=>({name,parts:legacy.parts.filter(p=>p.grp===name).map(row)})),count:legacy.partCount(),total:legacy.parts.length,ready:legacy.partsReadyCount(),blocked,scrap:s.scrap};
  }
  // 부품 상세: 칸별 후보와 재고, picks(사람이 고른 후보)를 반영한 제작 계획과 소모 뒤 재고. 상태를 바꾸지 않는다.
  function partDetail(key,picks=null){
    const p=legacy.findPart(key); if(!p) return null;
    const s=legacy.state(), done=legacy.partDone(p), plan=done?null:legacy.partPlan(p,picks||undefined), qp=legacy.qp.id;
    const spent=new Map(); for(const id of plan||[]) if(id!==qp) spent.set(id,(spent.get(id)||0)+1);
    const record=s.parts[key], use=record&&Array.isArray(record.use)?record.use.slice():[];
    return {key,no:p.no,name:p.name,grp:p.grp,note:p.note||'',done,at:typeof record==='number'?record:(record&&record.at)||0,use,ready:!!plan,plan:plan?plan.slice():null,qp,
      slots:p.need.map((sl,i)=>({name:sl.n,chosen:plan?plan[i]:null,qpCovers:legacy.qpCovers(sl),candidates:sl.any.map(id=>({id,stock:s.stock[id]||0}))})),
      spent:[...spent].map(([id,n])=>({id,count:n,before:s.stock[id]||0,after:(s.stock[id]||0)-n}))};
  }
  // 부품 제작: 원본 craft()를 그대로 쓴다(계획된 재고만 소모, QP는 닳지 않음, parts[key]={at,use}, 도감 owned 유지).
  // picks: 칸마다 사람이 고른 소재(없으면 null). 고른 소재를 쓸 수 없으면 조용히 바꾸지 않고 거절한다.
  // expect: 화면이 보여 준 소모 계획. 그 사이 재고가 바뀌어 계획이 달라졌으면 거절한다.
  function craft(key,picks=null,expect=null){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    const p=legacy.findPart(key); if(!p) return {ok:false,error:'알 수 없는 부품입니다.'};
    if(legacy.partDone(p)) return {ok:false,error:'이미 완성한 부품입니다.'};
    if(picks!==null&&!(Array.isArray(picks)&&picks.length<=p.need.length&&picks.every(v=>v==null||typeof v==='string'))) return {ok:false,error:'소재 선택이 올바르지 않습니다.'};
    const plan=legacy.partPlan(p,picks||undefined);
    if(!plan) return {ok:false,error:'소재가 모자랍니다.'};
    if((picks||[]).some((v,i)=>v!=null&&plan[i]!==v)) return {ok:false,error:'고른 소재를 쓸 수 없습니다. 재고를 다시 확인해 주세요.'};
    if(expect!==null&&!(Array.isArray(expect)&&expect.length===plan.length&&expect.every((v,i)=>v===plan[i]))) return {ok:false,error:'재고가 바뀌었습니다. 다시 확인해 주세요.'};
    commandBusy=true;
    try{
      if(!legacy.craft(key,picks||undefined)) return {ok:false,error:'제작하지 못했습니다.'};
      save();
      return {ok:true,part:{key,name:p.name,use:legacy.state().parts[key].use.slice()}};
    }finally{commandBusy=false;}
  }
  // 차고: 부품 35 진행과 차량 8종의 소유 상태. 상태를 바꾸지 않는다.
  function garage(){
    const s=legacy.state(), total=legacy.CARS.length, full=legacy.carDone(), complete=legacy.allCarsDone();
    return {parts:{count:legacy.partCount(),total:legacy.parts.length,ready:legacy.partsReadyCount()},
      owned:legacy.carsOwned(),total,complete,selectable:full&&!complete&&!blocked,blocked,
      cars:legacy.CARS.map(c=>({key:c.key,tag:c.tag,body:c.body,maker:c.maker,line:c.line,owned:legacy.hasCar(c.key),at:legacy.hasCar(c.key)?legacy.carAtOf(c.key):0}))};
  }
  // 차량 확정: 원본 확정 처리(부품이 다 찼고 미보유이고 8종이 다 차지 않았을 때만 cars 추가·parts 초기화)를 그대로 쓴다.
  // 선택만으로는 아무것도 바뀌지 않으므로 선택 명령은 없다. 상태가 바뀌었으면 거절하고 저장을 건드리지 않는다.
  function takeCar(key){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    const car=legacy.CARS.find(c=>c.key===key); if(!car) return {ok:false,error:'알 수 없는 자동차입니다.'};
    if(!legacy.carDone()||legacy.hasCar(key)||legacy.allCarsDone()) return {ok:false,error:'조립 또는 보유 상태가 바뀌었어요. 현재 상태를 다시 확인해 주세요.',stale:true};
    commandBusy=true;
    try{
      if(!legacy.takeCar(key)) return {ok:false,error:'조립 또는 보유 상태가 바뀌었어요. 현재 상태를 다시 확인해 주세요.',stale:true};
      save();
      return {ok:true,car:{key,tag:car.tag,body:car.body,at:legacy.carAtOf(key)},owned:legacy.carsOwned(),total:legacy.CARS.length,complete:legacy.allCarsDone()};
    }finally{commandBusy=false;}
  }
  function catalog(){return legacy.allChars().map(c=>({id:c.id,level:legacy.lvOf(c)}));}
  function nextGoal(){
    const s=legacy.state(), remaining=legacy.parts.filter(p=>!s.parts[p.key]);
    const ready=remaining.find(p=>legacy.partPlan(p)); const p=ready||remaining[0];
    if(!p){
      // 부품 35개가 다 찼으면 목표는 차량 선택이다. 8종을 다 모았으면 목표가 없다.
      const next=legacy.CARS.find(c=>!legacy.hasCar(c.key));
      return next&&legacy.carDone()?{garage:true,carKey:next.key}:null;
    }
    return {ready:!!ready,partKey:p.key,name:p.n||p.name,missing:p.need.filter(sl=>!sl.any.some(id=>(s.stock[id]||0)>0)).map(sl=>({name:sl.n,ids:sl.any.slice()}))};
  }
  return Object.freeze({state,status,ship,exchange,scrap,craft,partList,partDetail,garage,takeCar,develop,featured,setFeatured,qpStatus,save,backup:()=>preserveRawBackup&&lastRaw!==null?lastRaw:JSON.stringify(legacy.state(),null,2),nextGoal,catalog});
}
