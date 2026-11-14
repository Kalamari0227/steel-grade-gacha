import {createHash} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export class PrototypeBuildError extends Error {}
export function check(value,message){if(!value) throw new PrototypeBuildError(message);}
export function section(source,from,to){
  check(source.split(from).length===2,`Ambiguous source start: ${from}`);
  const start=source.indexOf(from), end=source.indexOf(to,start);
  check(end>start,`Missing source end: ${to}`); return source.slice(start,end);
}
export function legacyModule(source){
  const chunks={
    data:section(source,'var FAMS = [','var QUIZ = ['),
    img:section(source,'var IMG = {','var IMG_ALT = {'),
    init:section(source,'var POOL = Object.keys(IMG)','function today()'),
    window:section(source,'var DAY = 24 * 60','/* 남은 시간은 계속 흘러가니'),
    restore:section(source,'function applySaved(p){','function hasProgress(){'),
    random:section(source,'function allChars()','/* 확정 뽑기는'),
    missing:section(source,'function missingIn(lv){','/* ── 주문서'),
    findPart:section(source,'function findPart(key){','/* ── 선행개발'),
    qp:section(source,'var QP_ID  =','/* 열리는 순간'),
    stock:section(source,'function stockOf(','function partDone('),
    parts:section(source,'function partDone(','function ptImg('),
    pgrp:section(source,'var PGRP = [','function renderParts('),
    pending:section(source,'function sweepPending()','var drawState ='),
    single:section(source,'document.getElementById("btnPull").addEventListener("click", function(){','/* ── 10연 출하'),
    ten:section(source,'var SCRAP_TEN = 20, TEN_N = 10;','function showTen('),
    scrapPull:section(source,'function scrapPull(lv, cost){','document.getElementById("btnScrap3")'),
    /* 중복 스크랩은 원본에서 독립 함수가 아니라 #pullBox 클릭 핸들러의 data-draw-scrap 분기 안에 있다.
       그 분기에서 경제 상태만 바꾸는 원문 두 문장('if(stockOf(id) <= 1) return;'부터 DOM을 만지는
       'button.disabled = true;' 직전까지)만 그대로 뽑아 아래에서 function dupScrap(id){…}로 감싼다.
       시작 문자열은 원본에서 한 번만 나온다(section의 split 검사). 버튼 비활성화·문구·#drawStock 갱신은 화면 일이라 뺀다. */
    dupScrap:section(source,'if(stockOf(id) <= 1) return;','button.disabled = true;'),
    /* 차고 조회(hasCar·carAtOf·carsOwned·allCarsDone)는 원본에서 이어진 독립 함수 넷이다. CARS·findCar는 data 청크에 이미 들어 있다. */
    garage:section(source,'function hasCar(k){','function renderGarage(){'),
    /* 차량 확정은 원본에서 독립 함수가 아니라 renderCar 안 #takeCar 클릭 핸들러에 있다.
       takeCarGuard: 그 핸들러의 거절 조건 원문 'if(!carDone() || hasCar(k) || allCarsDone())'(바로 뒤 '{' 직전까지, 원본에서 한 번만 나옴).
       takeCar: 상태를 바꾸는 원문 'S.cars.push({k:k, at:Date.now()}); S.parts = {}; save(); refresh();'(화면 일인 GAME_GARAGE.showStage 직전까지). */
    takeCarGuard:section(source,'if(!carDone() || hasCar(k) || allCarsDone())','{'),
    takeCar:section(source,'S.cars.push({k:k, at:Date.now()});','GAME_GARAGE.showStage(')
  };
  const single=chunks.single.replace('document.getElementById("btnPull").addEventListener("click", function(){','function single(){').replace(/\}\);\s*$/,'}');
  const dupScrap='function dupScrap(id){\n    '+chunks.dupScrap.trimEnd()+'\n}';
  /* 원문이 아닌 줄은 둘뿐이다: 거절 조건 뒤 'return false;'(원본은 거기서 renderCar·안내 문구 후 return — 화면 일이라 뺐다)와
     끝의 'return true;'(확정했음을 알리는 값). 원본처럼 k가 CARS에 있는지는 이 조건이 보지 않는다(원본은 바깥 버튼 핸들러의 findCar 검사가 막는다). */
  const takeCar='function takeCar(k){\n    '+chunks.takeCarGuard+' return false;\n    '+chunks.takeCar.trimEnd()+'\n    return true;\n}';
  const body=[chunks.data,chunks.img,chunks.init,chunks.restore,chunks.window,chunks.random,chunks.missing,chunks.findPart,chunks.qp,chunks.stock,chunks.parts,chunks.pgrp,chunks.pending,single,chunks.ten,chunks.scrapPull,dupScrap,chunks.garage,takeCar].join('\n');
  const generated=`// Exact source sections extracted by prepare.mjs; no legacy UI/assets.\nexport function createLegacy({random=Math.random,now=Date.now,onSave=()=>{},onResult=()=>{}}={}){\nconst Math=Object.create(globalThis.Math); Math.random=random; const Date={now,UTC:globalThis.Date.UTC}; const GAME_EDITION={save:'sgg_game_save_v1'};\n${body}\nvar wasReady=false; function drawBusy(){return false;} function armBell(){} function askPersist(){} function refresh(){} function save(){onSave(S);} function showPull(id,fresh){onResult([id],[fresh]);} function showTen(ids,fresh){onResult(ids,fresh);}\nreturn {state:()=>S,setState:value=>{S=value;},applySaved,single,ten:tenPull,pullsLeft,pullBaseLeft,pullWindowOpen,pullRenewed,readyIn,fmtWait,DAY,tenReady,allChars,findChar,lvOf,specOf,rareOf,partPlan,parts:PARTS,use:USE,pool:POOL,weightedPick,qpRevealed,hasQP,addStock,qp:{id:QP_ID,keys:QP_KEY,need:QP_NEED,scrap:QP_SCRAP},missingIn,scrapPull,dupScrap,findPart,qpCovers,slotOk,partReady,partDone,partCount,partsReadyCount,carDone,craft,stockOf,sweepPending,PGRP,SCRAP_LV3,SCRAP_LV4,CARS,findCar,hasCar,carAtOf,carsOwned,allCarsDone,takeCar};\n}\n`;
  return {generated,chunks:Object.fromEntries(Object.entries(chunks).map(([key,value])=>[key,sha(value)]))};
}
