import {createLegacy} from './legacy.mjs';
// 정식 진행 저장 키. 이전 게임(같은 출처의 /steel-grade-gacha-game/)과 같은 칸을 쓰며, 원본 applySaved()로 이어받는다.
export const SAVE_KEY='sgg_game_save_v1';
// 체험판 시절의 저장 키. 체험용 지급이 섞여 있어 읽지도 지우지도 않는다.
export const TRIAL_KEY='steel_companion_prototype_20261109_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;

// 원본 applySaved()로 정규화한 뒤의 값을 검사한다. 원본이 조용히 받아들이는 잘못된 형식(음수, 없는 ID 등)은
// 덮어쓰지 않고 보류한다. 엔진이 아직 쓰지 않는 항목(퀴즈 기록)은 형식만 보고 그대로 둔다. 주문·보증(items)은 validOrders가 본다(3단계).
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
// items: 원본 S.items[key]는 1(획득·미장착) 또는 카드 ID(그 동료에 장착)다. 원본 itemsOf·available이 읽는 뜻 그대로만 받는다.
// 키는 ITEMS 14종 중 하나, 카드 ID는 지금 보유하고(owned) 원본 fitOwned(key)가 돌려주는 동료여야 한다.
// 그래야 장착 조합이 언제나 승인 외형 안에 있다(qa/orders-appearance.test.mjs). 모르는 키·모르는 카드·비호환·미보유는 보류한다.
// orderDay(원본 today() 문자열 또는 빈 값)·orderKey(빈 값 또는 ORDERS 항목)·orderDone(0 이상 정수)도 원본이 읽는 형태만 받는다.
function validOrders(value,legacy){
  const keys=new Set(legacy.ITEMS.map(i=>i.key));
  const itemsOk=Object.entries(value.items).every(([key,v])=>keys.has(key)&&(v===1||typeof v==='string'&&value.owned[v]===true&&legacy.fitOwned(key).includes(v)));
  return itemsOk&&typeof value.orderDay==='string'&&typeof value.orderKey==='string'&&(value.orderKey===''||keys.has(value.orderKey))&&nonnegative(value.orderDone);
}
function validState(value,ids,defs,qp,carKeys){
  if(!plain(value)) return false;
  if(typeof value.pending!=='string') return false;
  if(!['owned','stock','items','parts'].every(k=>plain(value[k]))||!Array.isArray(value.cars)) return false;
  // quizAt·quizUsed(4단계): pullAt·pullUsed와 같은 규칙. 원본 '||0'이 0으로 바꾸지 않는 음수·소수·문자열·Infinity는 보류한다
  // (원본은 그런 값으로 한도를 넘기거나 창을 영원히 열어 둔다: qa/quiz-window.test.mjs). 미래 quizAt(기기 시계 역행)과 한도를 넘은 quizUsed는
  // 원본처럼 받아들인다. 창이 quizAt+24시간까지 이어지고 남은 횟수는 0이다. quizDay는 원본이 읽지 않는 필드라 검사하지 않고 그대로 둔다.
  if(!['scrap','extra','pullAt','pullUsed','quizAt','quizUsed'].every(k=>nonnegative(value[k]))) return false;
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

// 7단계: idb는 IndexedDB 사본(원본 mirrorPut·mirrorGet), env는 저장 진단(원본 storeDiag·runMode)이 읽는 navigator·location·window. 시험은 가짜를 넣는다.
export function createEngine({storage=globalThis.localStorage,now=Date.now,random=Math.random,notification=globalThis.Notification,idb=globalThis.indexedDB,env={navigator:globalThis.navigator,location:globalThis.location,window:globalThis.window},setTimer=globalThis.setTimeout}={}){
  // holding: 원본 saveHold. 빈 local에서 사본을 확인하는 동안(최대 2500ms) 아무것도 쓰지 않고 명령도 받지 않는다.
  // loadBlocked: 원본 loadFailed. 기존 진행을 읽지 못해(손상·거부) 덮어쓰기를 멈춘 상태. 이때만 백업 복원·초기화가 저장을 다시 연다(원본 applyCode·초기화의 'loadFailed = false').
  let warning='', blocked=false, preserveRawBackup=false, lastRaw=null, lastResult=null, commandBusy=false, holding=false, loadBlocked=false, recovery='', booting=null;
  const legacy=createLegacy({now,random,notification,storage,idb,env,onSave:()=>{},onResult:(ids,fresh)=>{
    lastResult={id:`${now()}-${++serial}`,mode:ids.length===10?'ten':'single',at:now(),cards:ids.map((id,i)=>({id,isNew:fresh[i],stock:legacy.state().stock[id]}))};
  }});
  const ids=new Set(legacy.allChars().map(c=>c.id)); let serial=0;
  const partDefs=new Map(legacy.parts.map(p=>[p.key,p]));
  const carKeys=new Set(legacy.CARS.map(c=>c.key));
  // 새 프로필은 원본 S의 기본값(추가 출하 0, 스크랩 0)으로 시작한다. results는 마지막 출하 결과(없으면 null).
  legacy.state().results=null;
  const fresh=clone(legacy.state());
  const hold=message=>{blocked=true;loadBlocked=true;preserveRawBackup=true;warning=message;legacy.setState(clone(fresh));};
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
        if(!validState(s,ids,partDefs,legacy.qp.id,carKeys)||!validOrders(s,legacy)) hold('저장 자료가 손상되어 덮어쓰기를 중단했습니다. 백업을 보관해 주세요.');
      }
    }
  }catch(error){
    if(!(error instanceof Error)) throw error;
    blocked=true;loadBlocked=true;preserveRawBackup=lastRaw!==null;legacy.setState(clone(fresh));warning=error instanceof SyntaxError?'저장 자료가 손상되어 출하를 중단했습니다. 기존 자료는 덮어쓰지 않습니다.':'저장 자료를 읽지 못해 출하를 중단했습니다. 기존 자료는 덮어쓰지 않습니다.';
  }
  // 저장에 굳어 있는 요구 기록(orderDay·orderKey·orderDone). 불러온 직후와 저장에 성공할 때마다 갱신한다(pinOrder가 쓴다).
  const orderSig=()=>{const s=legacy.state();return [s.orderDay,s.orderKey,s.orderDone].join('|');};
  let pinnedSig=orderSig();
  const state=()=>clone(legacy.state());
  function save(){
    if(blocked||holding) return false;
    const raw=JSON.stringify(legacy.state());
    let ok=false;
    try{
      if(storage.getItem(SAVE_KEY)!==lastRaw){blocked=true;warning='다른 탭에서 진행이 바뀌었습니다. 현재 메모리 결과를 백업한 뒤 새로고침해 주세요.';return false;}
      storage.setItem(SAVE_KEY,raw);
      if(storage.getItem(SAVE_KEY)!==raw) warning='브라우저가 저장을 받아 주지 않았습니다. 현재 결과는 메모리에만 있으며 백업을 보관해 주세요.';
      else{lastRaw=raw;pinnedSig=orderSig();warning='';ok=true;}
    }catch(error){
      if(!(error instanceof Error)) throw error;
      warning='진행 저장에 실패했습니다. 현재 결과는 메모리에만 있으며 백업을 보관해 주세요.';
    }
    // 원본 save()처럼 local 쓰기 결과와 관계없이 IndexedDB 사본도 쓴다(실패는 조용히 무시). 다른 탭 변경으로 멈춘 경우는 쓰지 않는다.
    legacy.mirrorPut();
    return ok;
  }
  function ship(count){
    if(holding) return {ok:false,error:HOLD};
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
    if(holding) return HOLD;
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
    return {warning,blocked,holding,singleLeft,baseLeft:base,extra:s.extra,scrap:s.scrap,nextIn,wait:singleLeft>0||nextIn===0?'':legacy.fmtWait(nextIn),canTen:!blocked&&legacy.tenReady(),exchanges};
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
  // ── 고객 요구와 보증 장비 (3단계) ──
  // 판정은 모두 원본 함수(todaysOrder·judge·fitOwned·available·장착 확정 문장)다. 요구 조회(order)는 저장을 쓰지 않는다.
  // 화면이 요구를 보여 줄 때 pinOrder()가 그 요구를 한 번 저장해 그날의 요구를 굳힌다(game-persistence.md).
  const itemKeys=new Set(legacy.ITEMS.map(i=>i.key));
  const itemInfo=it=>({key:it.key,name:it.name,tag:it.tag,sub:it.sub,scope:it.scope||''});
  const cardName=id=>{const c=legacy.findChar(id);return c?c.fam.name+' '+c.g:id;};
  const STALE_ORDER='요구 또는 보유 상태가 바뀌었어요. 현재 요구를 다시 확인해 주세요.';
  const STALE_EQUIP='장착 또는 보유 상태가 바뀌었어요. 소재를 다시 선택해 주세요.';
  // 오늘의 요구. state: all(14종 모두 대응) · none(보유 소재로 걸 데가 없음) · open(회신 가능) · limit(오늘 몫을 다 씀) · earned(대응 완료).
  function order(){
    const o=legacy.todaysOrder(), s=legacy.state(), max=legacy.orderMax(), total=legacy.ORDERS.length;
    const base={day:legacy.today(),max,left:Math.max(0,max-s.orderDone),owned:legacy.itemCount(),total,blocked,choices:legacy.ITEMS.map(itemInfo)};
    if(base.owned>=total) return {...base,state:'all'};
    if(!o) return {...base,state:'none'};
    const value=s.items[o.item], it=legacy.findItem(o.item), view={key:o.item,from:o.from,ask:o.ask,item:itemInfo(it)};
    if(value) return {...base,state:'earned',order:{...view,yes:o.yes},equippedTo:value!==1?value:null,candidates:value===1?legacy.fitOwned(o.item):[]};
    return {...base,state:base.left>0?'open':'limit',order:view};
  }
  // 오늘의 요구 굳히기: 요구를 처음 볼 때 그 요구(orderDay·orderKey·orderDone)를 한 번 저장한다. 원본 todaysOrder()가 요구를 본 순간 저장하는 것과 같다.
  // 그래야 같은 날 보유가 바뀌어도(새로고침 뒤 출하 등) 본 요구가 그대로 남는다. 들어온 요구가 없으면(보유 소재로 걸 데가 없음) 쓰지 않는다.
  // 저장된 기록과 같으면 쓰지 않으므로 여러 번 불러도 한 번만 쓴다. 다른 명령과 같은 보호를 거친다.
  function pinOrder(){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    commandBusy=true;
    try{
      legacy.todaysOrder();
      if(!legacy.state().orderKey||orderSig()===pinnedSig) return {ok:true,pinned:false};
      save();
      return {ok:true,pinned:true};
    }finally{commandBusy=false;}
  }
  // 요구 회신: 원본 judge(). 정답이면 items[key]=1·orderDone+1을 저장하고, 오답이면 아무것도 바꾸지 않는다.
  // expected·day는 화면이 보여 준 요구와 날짜다. 그 사이 요구·보유·날짜가 바뀌었으면 거절한다(원본 judge의 같은 검사).
  function reply(expected,day,answer){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(!itemKeys.has(expected)||!itemKeys.has(answer)||typeof day!=='string') return {ok:false,error:STALE_ORDER,stale:true};
    commandBusy=true;
    try{
      const verdict=legacy.judge(expected,day,answer);
      if(verdict===null||verdict===undefined) return {ok:false,error:STALE_ORDER,stale:true};
      if(verdict===false) return {ok:true,correct:false,answer,no:legacy.findOrder(expected).no};
      save();
      return {ok:true,correct:true,item:itemInfo(legacy.findItem(expected)),yes:legacy.findOrder(expected).yes,left:Math.max(0,legacy.orderMax()-legacy.state().orderDone),owned:legacy.itemCount(),candidates:legacy.fitOwned(expected)};
    }finally{commandBusy=false;}
  }
  // 장착: 획득했고 아직 장착하지 않은 보증을 호환되는 보유 동료 한 명에게 건다. 재고는 쓰지 않는다. 해제·재배치는 없다.
  function equip(key,id){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(!itemKeys.has(key)||!ids.has(id)||!legacy.available(key,id)) return {ok:false,error:STALE_EQUIP,stale:true};
    commandBusy=true;
    try{
      if(!legacy.equip(key,id)) return {ok:false,error:STALE_EQUIP,stale:true};
      save();
      return {ok:true,equip:{key,id,card:cardName(id),...itemInfo(legacy.findItem(key))},stock:legacy.stockOf(id)};
    }finally{commandBusy=false;}
  }
  // 보증 14종 목록(원본 renderItems). locked: 미획득 · owned: 획득·미장착(candidates=지금 걸 수 있는 보유 동료) · equipped: 그 동료에 장착. 상태를 바꾸지 않는다.
  function warranties(){
    const s=legacy.state();
    return {owned:legacy.itemCount(),total:legacy.ITEMS.length,blocked,items:legacy.ITEMS.map(it=>{
      const v=s.items[it.key];
      return {...itemInfo(it),state:!v?'locked':v===1?'owned':'equipped',cardId:v&&v!==1?v:null,card:v&&v!==1?cardName(v):'',candidates:v===1?legacy.fitOwned(it.key):[]};
    })};
  }
  // 한 동료가 걸 수 있는 보증과 각각의 상태. free=획득·미장착(미리보기·장착 가능) · equipped=이 동료에 장착 · elsewhere=다른 동료에 장착 · locked=미획득.
  function cardItems(cardId){
    const c=legacy.findChar(cardId), s=legacy.state(); if(!c) return [];
    return legacy.ITEMS.filter(it=>it.fit(c)).map(it=>{
      const v=s.items[it.key];
      return {...itemInfo(it),state:v===cardId?'equipped':v===1?'free':v?'elsewhere':'locked'};
    });
  }
  // 동료에 장착된 보증 키(승인 외형의 equipmentKeys 순서와 같게 정렬). 원본 itemsOf().
  const equippedKeys=cardId=>legacy.itemsOf(cardId).map(i=>i.key).sort();
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
  // ── 철강 퀴즈 (4단계) ──
  // 판정은 모두 원본 함수(quizLeft·quizReady·drawQuiz·settleQuiz)다. 진행 중 세션(문제·고른 답)은 엔진 메모리에만 있고 저장하지 않는다.
  // 정답 채점도 엔진이 한다(화면은 고른 번호만 보낸다). 저장은 보상을 처리한 순간 한 번만 쓴다. 보상이 없는 결과는 저장을 바꾸지 않는다
  // (원본은 결과 화면마다 save()를 부르지만 그때 바뀐 값이 없다). 문항 데이터(413)는 용량 때문에 별도 모듈이라 화면이 처음 열 때 setQuizBank로 넣는다.
  let bank=null, quizSession=null, quizSerial=0;
  const QUIZ_USED_UP='보상 잔여 횟수를 모두 사용했어요.', STALE_QUIZ='퀴즈 진행이 바뀌었어요. 현재 문제를 다시 확인해 주세요.';
  const validQuestion=q=>plain(q)&&typeof q.q==='string'&&q.q!==''&&Array.isArray(q.o)&&q.o.length===4&&q.o.every(t=>typeof t==='string'&&t!=='')&&[0,1,2,3].includes(q.a)&&typeof q.e==='string';
  function setQuizBank(list){
    if(!Array.isArray(list)||list.length<5||!list.every(validQuestion)) return {ok:false,error:'퀴즈 문항을 읽지 못했습니다.'};
    bank=list; legacy.setQuiz(list); return {ok:true,count:list.length};
  }
  // 연구 화면이 읽는 요약. 저장을 쓰지 않는다. 문항 데이터(bank)는 시작 버튼을 누를 때 불러오므로 canStart는 자원·저장 상태만 본다. renewText는 원본 fmtWhen 표기(오늘·내일 HH:MM), 창이 닫혀 있으면 빈 문자열.
  function quiz(){
    const s=legacy.state(), open=!!legacy.quizWindowOpen(), left=legacy.quizLeft();
    return {blocked,ready:bank!==null,max:legacy.quizMax(),left,extra:s.extra,windowOpen:open,renewAt:open?s.quizAt+legacy.DAY:0,renewText:open?legacy.fmtWhen(s.quizAt):'',canStart:!blocked&&left>0,promo:legacy.promoOn(),active:quizSession!==null};
  }
  const related=q=>legacy.quizRelated(q).map(c=>({id:c.id,name:c.fam.name+' '+c.g}));
  // 세션을 화면에 보여 줄 모양으로. 고르기 전에는 정답 번호와 해설을 담지 않는다.
  function quizSnap(){
    const q=quizSession; if(!q) return null;
    const total=q.qs.length, base={id:q.id,total,right:q.right};
    if(q.i>=total){
      const outcome=q.pass?(q.reward>0?'reward':q.rewardAllowed?'cap':'exhausted'):'fail';
      return {...base,phase:'result',pass:q.pass,outcome,reward:q.reward,rewardAllowed:q.rewardAllowed,saveWarning:q.saveWarning||'',quiz:quiz()};
    }
    const item=q.qs[q.i], answered=q.answers[q.i];
    const view={...base,index:q.i,last:q.i>=total-1,question:{q:item.q,o:item.o.slice()}};
    if(answered===undefined) return {...view,phase:'question'};
    return {...view,phase:'explain',chosen:answered,correctIndex:item.a,correct:answered===item.a,explanation:item.e,related:related(item)};
  }
  function quizStart(){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(bank===null) return {ok:false,error:'퀴즈 문항을 읽지 못했습니다.'};
    if(!legacy.quizReady()) return {ok:false,error:QUIZ_USED_UP,exhausted:true};
    // 풀던 퀴즈가 있으면(연타·다시 열기) 새로 뽑지 않고 그대로 이어 준다. 결과까지 본 세션만 새로 뽑는다.
    if(quizSession&&quizSession.i<quizSession.qs.length) return {ok:true,resumed:true,session:quizSnap()};
    quizSession={id:`quiz-${now()}-${++quizSerial}`,qs:legacy.drawQuiz(5),i:0,right:0,answers:{},pass:false,reward:0,rewardAllowed:false};
    return {ok:true,session:quizSnap()};
  }
  const live=id=>quizSession&&quizSession.id===id?quizSession:null;
  function quizAnswer(id,index,choice){
    const q=live(id); if(!q) return {ok:false,error:STALE_QUIZ,stale:true};
    if(index!==q.i||q.i>=q.qs.length) return {ok:false,error:STALE_QUIZ,stale:true,session:quizSnap()};
    if(!Number.isInteger(choice)||choice<0||choice>3) return {ok:false,error:'보기를 다시 골라 주세요.'};
    // 같은 문제에 두 번 답해도 한 번만 센다(원본 session.answers 검사). 두 번째 호출은 처음 고른 답의 화면을 그대로 돌려준다.
    if(q.answers[q.i]===undefined){ q.answers[q.i]=choice; if(choice===q.qs[q.i].a) q.right++; }
    return {ok:true,session:quizSnap()};
  }
  // 다음 문제로, 마지막이면 결과(보상 처리). 보상 처리는 다른 저장 명령과 같은 보호를 거치고, 보상이 있을 때만 저장한다.
  function quizNext(id,index){
    const q=live(id); if(!q) return {ok:false,error:STALE_QUIZ,stale:true};
    if(index!==q.i||q.i>=q.qs.length||q.answers[q.i]===undefined) return {ok:false,error:STALE_QUIZ,stale:true,session:quizSnap()};
    if(q.i<q.qs.length-1){ q.i++; return {ok:true,session:quizSnap()}; }
    const stop=guard(); if(stop) return {ok:false,error:stop};
    commandBusy=true;
    try{
      const settled=legacy.settleQuiz(q.right===q.qs.length);
      q.pass=q.right===q.qs.length; q.reward=settled.reward; q.rewardAllowed=settled.rewardAllowed; q.i++;
      if(q.rewardAllowed&&!save()) q.saveWarning=warning||'진행 저장에 실패했습니다. 현재 결과는 메모리에만 있으며 백업을 보관해 주세요.';
      return {ok:true,session:quizSnap()};
    }finally{commandBusy=false;}
  }
  // 퀴즈를 닫는다(중간에 닫아도 보상은 없고 저장은 그대로). 같은 세션을 두 번 닫아도 같다.
  function quizClose(id){
    if(quizSession&&(id===undefined||quizSession.id===id)) quizSession=null;
    return {ok:true};
  }
  // ── 공지·행사 안내·출하 알림 (5단계) ──
  // 판정은 모두 원본 함수다(source.mjs의 ackNotice·ackPromo·ackPromoEnd·bellDue·readyEdge·bellEnable·bellDisable와 NOTICES·PROMOS).
  // 이 명령들이 바꾸는 것은 noticeSeen·promoSeen·promoDone·bell·belledAt뿐이다. 경제값은 건드리지 않는다.
  // 원본은 안내가 열리는 순간 기록하지만, 이 판은 사용자가 확인·닫기를 누른 때에만 부른다(화면이 부르는 시점만 다르다).
  const OPS_KEYS=['noticeSeen','promoSeen','promoDone','bell','belledAt'];
  // "지금 이 기록 명령을 부르면 바뀌는가"를 원본 함수를 그대로 한 번 돌려 알아낸다. 돌린 뒤 값은 되돌리므로 조회는 저장도 메모리도 바꾸지 않는다.
  function probe(fn){
    const s=legacy.state(), snap=Object.fromEntries(OPS_KEYS.map(k=>[k,s[k]]));
    try{return !!fn();}finally{Object.assign(s,snap);}
  }
  function bell(){
    const s=legacy.state(), supported=legacy.bellOK(), permission=supported?String(notification.permission):'unsupported';
    return {supported,permission,on:!!legacy.bellOn(),stored:!!s.bell,pullReady:legacy.pullReady(),
      nextText:!s.pullAt?'':legacy.pullReady()?'':legacy.fmtWhen(s.pullAt)};
  }
  // 현재 공지·행사 상태와 지금 한 번 안내해야 할 것(pending). 저장을 쓰지 않는다.
  function ops(){
    const s=legacy.state(), t=now();
    const nOn=legacy.noticeOn(), N=legacy.notice();
    const pOn=legacy.promoOn(), soon=legacy.promoSoon(), P=legacy.promo();
    const nx=pOn?legacy.nextPromo():null;
    return {blocked,
      notice:{key:N.key,title:N.title,lead:N.lead,items:N.items.map(i=>({h:i.h,p:i.p})),from:N.from,until:N.until,
        state:nOn?'on':t<N.from?'soon':'ended',seen:s.noticeSeen===N.key},
      promo:{key:P.key,name:P.name,why:P.why,status:pOn?'on':soon?'soon':'ended',from:P.from,to:P.to,pick:P.pick,pickName:P.pick?legacy.famName(P.pick):'',
        pullMax:P.pullMax,quizMax:P.quizMax,orderMax:P.orderMax,rows:legacy.promoRows(),summary:legacy.promoSum(),
        left:pOn?legacy.promoLeft():0,leftText:pOn?legacy.fmtSpan(legacy.promoLeft()):'',inMs:soon?legacy.promoIn():0,inText:soon?legacy.fmtSpan(legacy.promoIn()):'',
        next:nx?{name:nx.name,key:nx.key}:null,seen:s.promoSeen===P.key,done:s.promoDone===P.key,
        base:{pull:legacy.PULL_MAX,quiz:legacy.QUIZ_MAX,order:legacy.ORDER_MAX}},
      pending:{notice:!blocked&&probe(legacy.ackNotice),promo:!blocked&&probe(legacy.ackPromo),promoEnd:!blocked&&probe(legacy.ackPromoEnd)},
      bell:bell()};
  }
  // 확인 기록은 모두 같은 모양이다: 보호 검사 → 지금 그 안내가 맞는지(key) → 원본 기록 함수 → 저장을 먼저 시도하고 결과를 돌려준다.
  // 이미 기록돼 있으면(같은 확인을 두 번) 아무것도 쓰지 않는다.
  function record(current,key,fn){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(current()!==key) return {ok:true,changed:false,stale:true};
    commandBusy=true;
    try{
      if(!fn()) return {ok:true,changed:false};
      const saved=save();
      return saved?{ok:true,changed:true,saved:true}:{ok:true,changed:true,saved:false,warning:warning};
    }finally{commandBusy=false;}
  }
  const ackNotice=key=>record(()=>{legacy.noticeOn();return legacy.notice().key;},key,legacy.ackNotice);
  const ackPromo=key=>record(()=>{legacy.promoOn();return legacy.promo().key;},key,legacy.ackPromo);
  const ackPromoEnd=key=>record(()=>{legacy.promoOn();return legacy.promo().key;},key,legacy.ackPromoEnd);
  // 알림 켜기: 사용자가 알림 버튼을 누른 뒤 화면이 권한을 요청해 허용됐을 때만 부른다. 허용이 아니면 bell을 켜지 않는다.
  const BELL_TEXT={unsupported:'이 브라우저는 알림을 지원하지 않습니다.',denied:'브라우저에서 알림이 막혀 있습니다. 브라우저 설정에서 허용해 주세요.',default:'알림 권한이 허용되지 않았습니다.'};
  function enableBell(){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    const b=bell();
    if(!b.supported||b.permission!=='granted') return {ok:false,reason:b.permission==='granted'?'default':b.permission,error:BELL_TEXT[b.permission]||BELL_TEXT.default};
    // 원본 클릭 처리처럼 허용이면 언제나 켜기 문장을 실행한다(저장이 이미 켜짐이어도 권한을 다시 받은 경우 belledAt을 맞춘다). 바뀐 것이 없으면 쓰지 않는다.
    const s=legacy.state(), before=[s.bell,s.belledAt].join('|');
    commandBusy=true;
    try{
      legacy.bellEnable();
      if([s.bell,s.belledAt].join('|')===before) return {ok:true,changed:false,on:true,readyNow:legacy.pullReady()};
      const saved=save();
      return {ok:true,changed:true,on:true,saved,readyNow:legacy.pullReady(),...(saved?{}:{warning})};
    }finally{commandBusy=false;}
  }
  function disableBell(){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    if(!legacy.state().bell) return {ok:true,changed:false,on:false};
    commandBusy=true;
    try{
      legacy.bellDisable();
      const saved=save();
      return {ok:true,changed:true,on:false,saved,...(saved?{}:{warning})};
    }finally{commandBusy=false;}
  }
  // 출하 갱신 전이(닫힘 → 열림)를 한 번만 알린다. 원본 watchReady의 판정이며 메모리만 바꾼다(저장 없음).
  const readyEdge=()=>!!legacy.readyEdge();
  // 갱신 알림 기록: 알림을 켜 둔 상태에서 이 주기를 아직 알리지 않았을 때만 belledAt을 기록한다(원본 fireBell의 판정).
  // fired가 true일 때만 화면이 시스템 알림을 보낸다.
  function fireBell(){
    const stop=guard(); if(stop) return {ok:false,error:stop};
    commandBusy=true;
    try{
      if(!legacy.bellDue()) return {ok:true,fired:false};
      const saved=save();
      return {ok:true,fired:true,saved,...(saved?{}:{warning})};
    }finally{commandBusy=false;}
  }
  // 웹툰(6단계): 회차 자료와 읽음 표시. 읽음은 진행 저장(SAVE_KEY)과 별개 키(sgg_game_toon_seen)에 가장 멀리 읽은 회차 id 하나만 둔다.
  // 원본처럼 읽기·쓰기 실패는 조용히 무시한다(읽지 못하면 모두 NEW). 진행 저장의 잠금·blocked·다른 탭 확인과 무관하며 경제값을 바꾸지 않는다.
  // 읽음은 매번 저장소에서 다시 읽으므로 다른 탭에서 앞서 읽은 기록이 다음 호출에 그대로 보인다.
  function toon(){
    const seenIdx=legacy.toonSeenIdx();
    // 연재 안내의 글 두 곳에 이전 게임 이름이 들어 있다. 사용자가 정한 대로(2026-11-18, 시안 U0 이름 2안) 낱말만 바꾼다. 그림 속 글자는 바꿀 수 없다.
    const rename=text=>text.replaceAll('스틸 그레이드 가챠','스틸 컴패니언').replaceAll('스틸가챠s','스틸 컴패니언');
    const episodes=clone(legacy.TOON).map((t,i)=>({...t,...(t.lead?{lead:t.lead.map(rename)}:{}),index:i,seen:i<=seenIdx,isNew:i>seenIdx}));
    return {episodes,seenIdx,newCount:episodes.filter(t=>t.isNew).length,hasNew:seenIdx<episodes.length-1};
  }
  // 회차를 여는 순간 그 회차까지 읽음(원본 openToonView). 앞 회차를 다시 열어도 되돌리지 않는다. saved=false면 쓰기가 남지 않았다(화면은 조용히 넘어간다).
  function toonOpen(index){
    if(!Number.isInteger(index)||index<0||index>=legacy.TOON.length) return {ok:false,error:'없는 회차입니다.'};
    const saved=legacy.toonMarkSeen(index);
    return {ok:true,saved,seenIdx:legacy.toonSeenIdx()};
  }
  legacy.bootReady();
  // ── 7단계: 저장 완성 ──
  // 빈 local의 사본 복구: 원본 부팅의 needRestore·bootRestore와 같은 조건과 순서. 사본이 2500ms 안에 답하지 않으면 그대로 시작하고, 늦은 답은 버린다(settled).
  // 원본과 다른 점: 복구하지 않았으면 빈 상태를 local에 쓰지 않는다(첫 명령 때 쓴다). 사본은 원본처럼 끝난 뒤 한 벌 쓴다.
  function boot({timeout=2500}={}){
    if(booting) return booting;
    const need=legacy.restoreNeeded(loadBlocked);
    booting=new Promise(resolve=>{
      if(!need){resolve(false);return;}
      holding=true; let settled=false;
      const release=restored=>{if(settled) return; settled=true; holding=false; if(restored){save();legacy.bootReady();} resolve(restored);};
      setTimer(()=>release(false),timeout);
      legacy.mirrorGet(raw=>{
        if(settled) return;
        let p=null; try{p=raw?JSON.parse(raw):null;}catch{/* 손상된 사본은 무시한다(원본과 같다) */}
        if(!legacy.mirrorUsable(p)||!plain(p)){release(false);return;}
        const before=clone(legacy.state());
        legacy.applySaved(p);
        const s=legacy.state(); s.results='results' in p?p.results:null; if('featured' in p) s.featured=p.featured;
        // 원본은 형식 검사 없이 받아들이지만, 이 판은 불러오기와 같은 검사를 한다. 맞지 않는 사본은 쓰지 않고 그대로 시작한다.
        if(!validState(s,ids,partDefs,legacy.qp.id,carKeys)||!validOrders(s,legacy)){legacy.setState(before);release(false);return;}
        release(true);
      });
    }).then(restored=>{
      if(!loadBlocked&&!blocked) legacy.mirrorPut();
      return {restored,warning};
    });
    return booting;
  }
  const HOLD='저장 사본을 확인 중입니다. 창을 닫지 말고 잠시 기다려 주세요.';
  const STALE='미리보기 후 현재 진행이 바뀌었습니다. 다시 미리보기 해 주세요.';
  // 교육용 가져오기를 뺐으므로(사용자 결정 2026-11-20) 원본 오류 문구 중 그 버튼을 가리키는 한 문장만 바꾼다.
  const EDU_OLD='게임용 백업은 SGG-GAME1.으로 시작합니다. 교육용 SGG1. 코드는 교육용 백업 가져오기를 선택하세요.';
  const EDU_NEW='게임용 백업은 SGG-GAME1.으로 시작합니다. 교육용 SGG1. 코드는 이 게임에서 불러올 수 없습니다.';
  const inputError=error=>{const text=legacy.backupInputError(error,'game');return text===EDU_OLD?EDU_NEW:text;};
  // 백업 화면 상태 문구: 경고가 있으면 그 경고, 없으면 원본 backupRestoreStatus의 정상 문구.
  function storeStatus(){
    if(holding) return {ok:false,text:HOLD};
    if(warning) return {ok:false,text:warning};
    return legacy.backupRestoreStatus();
  }
  // 원본 renderBackupWhen의 문구(진행이 없으면 빈 칸).
  function backupWhen(){
    const s=legacy.state();
    if(!legacy.hasProgress()) return '';
    return s.backupAt?'마지막 백업 '+legacy.fmtDay(s.backupAt):'아직 백업한 적이 없습니다';
  }
  function backupView(){
    return {code:legacy.makeCode(),summary:legacy.backupSummary(),status:storeStatus(),when:backupWhen(),backupAt:legacy.state().backupAt,recovery,hasProgress:legacy.hasProgress()};
  }
  // 코드 복사에 성공했을 때만 부른다(원본: S.backupAt = Date.now(); save()). 저장이 막혀 있으면 기록하지 않는다.
  function markBackup(){
    const stop=guard(); if(stop) return {ok:false,error:stop,status:storeStatus()};
    commandBusy=true;
    try{legacy.state().backupAt=now(); const saved=save(); return {ok:true,saved,status:storeStatus(),when:backupWhen()};}
    finally{commandBusy=false;}
  }
  // 미리보기: 원본 prepare('game'). 현재 진행·날짜·입력과 교체 전 복구 코드를 함께 돌려준다. 진행은 바꾸지 않는다.
  function previewRestore(text){
    if(holding) return {ok:false,error:'저장 사본을 확인 중입니다. 잠시 후 다시 미리보기 해 주세요.'};
    let parsed;
    try{parsed=legacy.GAME_BACKUP.read(text,'game',legacy.backupCatalog());}
    catch(error){return {ok:false,error:inputError(error)};}
    const s=legacy.state();
    return {ok:true,preview:{pack:parsed.pack,snapshot:JSON.stringify(s),day:legacy.today(),input:text,recovery:legacy.makeCode(),
      current:legacy.GAME_BACKUP.summary(s),next:legacy.GAME_BACKUP.summary(parsed.progress)}};
  }
  // 손상·거부로 멈춘 경우만 복원·초기화가 저장을 다시 연다. 다른 탭 변경으로 멈춘 경우는 새로고침이 먼저다.
  function reopen(){
    if(holding) return HOLD;
    if(commandBusy) return '지금 처리할 수 없습니다.';
    if(blocked&&!loadBlocked) return warning;
    if(!loadBlocked){const stop=guard(); if(stop) return stop;}
    return '';
  }
  function unblock(){if(loadBlocked){blocked=false;loadBlocked=false;preserveRawBackup=false;warning='';}}
  // 교체: 원본 bkConfirm. 미리보기 뒤 진행·날짜·입력이 바뀌었으면 거절, 다시 검증한 뒤 applyCode. 원본 코드에 없는 results·featured는 비운다.
  function applyRestore(preview,text){
    if(!preview) return {ok:false,error:STALE,stale:true};
    if(holding||preview.snapshot!==JSON.stringify(legacy.state())||preview.day!==legacy.today()||preview.input!==text) return {ok:false,error:STALE,stale:true};
    const stop=reopen(); if(stop) return {ok:false,error:stop};
    try{legacy.GAME_BACKUP.validate(preview.pack,legacy.backupCatalog());}
    catch(error){return {ok:false,error:inputError(error)};}
    commandBusy=true;
    try{
      unblock();
      legacy.applyCode(preview.pack);
      const s=legacy.state(); s.results=null; delete s.featured; lastResult=null;
      const saved=save(); legacy.bootReady();
      recovery=preview.recovery;
      return {ok:true,saved,recovery,status:storeStatus()};
    }finally{commandBusy=false;}
  }
  // 초기화: 원본 btnReset의 두 번째 클릭. 새 상태는 원문(알림·행사 확인 기록은 남김). 5초 확인은 화면이 한다.
  function resetProgress(){
    const stop=reopen(); if(stop) return {ok:false,error:stop};
    commandBusy=true;
    try{
      unblock();
      legacy.resetProgress();
      legacy.state().results=null; lastResult=null;
      const saved=save();
      return {ok:true,saved,status:storeStatus()};
    }finally{commandBusy=false;}
  }
  function diagnose(){return new Promise(resolve=>legacy.storeDiag(resolve));}
  return Object.freeze({boot,backupView,markBackup,previewRestore,applyRestore,resetProgress,diagnose,toon,toonOpen,ops,ackNotice,ackPromo,ackPromoEnd,enableBell,disableBell,readyEdge,fireBell,state,status,quiz,setQuizBank,quizStart,quizAnswer,quizNext,quizClose,ship,exchange,scrap,craft,partList,partDetail,garage,takeCar,order,pinOrder,reply,equip,warranties,cardItems,equippedKeys,develop,featured,setFeatured,qpStatus,save,backup:()=>preserveRawBackup&&lastRaw!==null?lastRaw:JSON.stringify(legacy.state(),null,2),nextGoal,catalog});
}
