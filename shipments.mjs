import {SAVE_KEY} from './engine.mjs';

// The lock covers validation, legacy command, result snapshot and persistent write.
export async function shipSafely(engine,count,{locks=globalThis.navigator?.locks}={}){
  if(!locks?.request) return {ok:false,error:'이 브라우저에서는 안전한 출하 잠금을 사용할 수 없습니다. 최신 브라우저에서 열어 주세요.'};
  try{return await locks.request(SAVE_KEY,()=>engine.ship(count));}
  catch(error){
    if(error instanceof DOMException) return {ok:false,error:'출하 잠금을 얻지 못했습니다. 진행을 확인하고 다시 시도해 주세요.'};
    throw error;
  }
}
