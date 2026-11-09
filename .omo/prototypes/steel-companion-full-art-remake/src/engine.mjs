import {createLegacy} from './legacy.mjs';
export const SAVE_KEY='steel_companion_prototype_20261109_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;

function validState(value,ids){
  if(!plain(value)||value.prototypeVersion!==1) return false;
  if(value.pending!=='') return false;
  if(!['owned','stock','items','parts'].every(k=>plain(value[k]))) return false;
  if(!['scrap','extra','pullAt','pullUsed'].every(k=>nonnegative(value[k]))) return false;
  if(!Object.entries(value.owned).every(([id,v])=>ids.has(id)&&v===true)) return false;
  if(!Object.entries(value.stock).every(([id,v])=>ids.has(id)&&nonnegative(v)&&v>0&&value.owned[id])) return false;
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
  Object.assign(legacy.state(),{prototypeVersion:1,extra:12,scrap:60,results:null});
  try{
    lastRaw=storage.getItem(SAVE_KEY);
    if(lastRaw!==null){
      const parsed=JSON.parse(lastRaw);
      if(!validState(parsed,ids)){blocked=true;preserveRawBackup=true;warning='체험판 저장 자료가 손상되어 덮어쓰기를 중단했습니다. 백업을 보관해 주세요.';}
      else legacy.setState(parsed);
    }
  }catch(error){
    if(!(error instanceof Error)) throw error;
    blocked=true;preserveRawBackup=lastRaw!==null;warning=error instanceof SyntaxError?'체험판 저장 자료가 손상되어 출하를 중단했습니다. 기존 자료는 덮어쓰지 않습니다.':'체험판 저장 자료를 읽지 못해 출하를 중단했습니다. 기존 자료는 덮어쓰지 않습니다.';
  }
  const state=()=>clone(legacy.state());
  function save(){
    if(blocked) return false;
    const raw=JSON.stringify(legacy.state());
    try{
      if(storage.getItem(SAVE_KEY)!==lastRaw){blocked=true;warning='다른 탭에서 체험판 진행이 바뀌었습니다. 현재 메모리 결과를 백업한 뒤 새로고침해 주세요.';return false;}
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
      if(storage.getItem(SAVE_KEY)!==lastRaw){blocked=true;warning='다른 탭에서 체험판 진행이 바뀌었습니다. 현재 메모리 결과를 백업한 뒤 새로고침해 주세요.';return {ok:false,error:warning};}
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
  function catalog(){return legacy.allChars().map(c=>({id:c.id,level:legacy.lvOf(c)}));}
  function nextGoal(){
    const s=legacy.state(), remaining=legacy.parts.filter(p=>!s.parts[p.key]);
    const ready=remaining.find(p=>legacy.partPlan(p)); const p=ready||remaining[0];
    if(!p) return null;
    return {ready:!!ready,partKey:p.key,name:p.n||p.name,missing:p.need.filter(sl=>!sl.any.some(id=>(s.stock[id]||0)>0)).map(sl=>({name:sl.n,ids:sl.any.slice()}))};
  }
  return Object.freeze({state,status:()=>({warning,blocked,singleLeft:legacy.pullsLeft(),canTen:!blocked&&legacy.tenReady()}),ship,save,backup:()=>preserveRawBackup&&lastRaw!==null?lastRaw:JSON.stringify(legacy.state(),null,2),nextGoal,catalog});
}
