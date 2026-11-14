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
function validState(value,ids){
  if(!plain(value)) return false;
  if(typeof value.pending!=='string') return false;
  if(!['owned','stock','items','parts'].every(k=>plain(value[k]))||!Array.isArray(value.cars)) return false;
  if(!['scrap','extra','pullAt','pullUsed'].every(k=>nonnegative(value[k]))) return false;
  if(!Object.entries(value.owned).every(([id,v])=>ids.has(id)&&v===true)) return false;
  if(!Object.entries(value.stock).every(([id,v])=>ids.has(id)&&nonnegative(v)&&v>0&&value.owned[id])) return false;
  if('featured' in value&&!(typeof value.featured==='string'&&value.owned[value.featured]===true)) return false;
  if(value.results!==null){
    const r=value.results;
    if(!plain(r)||typeof r.id!=='string'||!nonnegative(r.at)||!['single','ten'].includes(r.mode)) return false;
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
        if(!validState(s,ids)) hold('저장 자료가 손상되어 덮어쓰기를 중단했습니다. 백업을 보관해 주세요.');
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
    return {warning,blocked,singleLeft,baseLeft:base,extra:s.extra,nextIn,wait:singleLeft>0||nextIn===0?'':legacy.fmtWait(nextIn),canTen:!blocked&&legacy.tenReady()};
  }
  function catalog(){return legacy.allChars().map(c=>({id:c.id,level:legacy.lvOf(c)}));}
  function nextGoal(){
    const s=legacy.state(), remaining=legacy.parts.filter(p=>!s.parts[p.key]);
    const ready=remaining.find(p=>legacy.partPlan(p)); const p=ready||remaining[0];
    if(!p) return null;
    return {ready:!!ready,partKey:p.key,name:p.n||p.name,missing:p.need.filter(sl=>!sl.any.some(id=>(s.stock[id]||0)>0)).map(sl=>({name:sl.n,ids:sl.any.slice()}))};
  }
  return Object.freeze({state,status,ship,develop,featured,setFeatured,qpStatus,save,backup:()=>preserveRawBackup&&lastRaw!==null?lastRaw:JSON.stringify(legacy.state(),null,2),nextGoal,catalog});
}
