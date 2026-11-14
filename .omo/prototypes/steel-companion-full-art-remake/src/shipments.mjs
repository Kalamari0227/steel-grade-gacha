import {SAVE_KEY} from './engine.mjs';

// 저장을 바꾸는 명령은 모두 같은 잠금(SAVE_KEY) 안에서 실행한다. 잠금이 검증·원본 명령·결과 스냅샷·영구 쓰기 전체를 덮는다.
export async function commandSafely(run,{locks=globalThis.navigator?.locks,unsupported='이 브라우저에서는 안전한 저장 잠금을 사용할 수 없습니다. 최신 브라우저에서 열어 주세요.',failed='저장 잠금을 얻지 못했습니다. 진행을 확인하고 다시 시도해 주세요.'}={}){
  if(!locks?.request) return {ok:false,error:unsupported};
  try{return await locks.request(SAVE_KEY,()=>run());}
  catch(error){
    if(error instanceof DOMException) return {ok:false,error:failed};
    throw error;
  }
}
export function shipSafely(engine,count,{locks}={}){
  return commandSafely(()=>engine.ship(count),{locks,unsupported:'이 브라우저에서는 안전한 출하 잠금을 사용할 수 없습니다. 최신 브라우저에서 열어 주세요.',failed:'출하 잠금을 얻지 못했습니다. 진행을 확인하고 다시 시도해 주세요.'});
}
