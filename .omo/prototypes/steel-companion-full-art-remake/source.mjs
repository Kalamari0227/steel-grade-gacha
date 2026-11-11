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
    init:section(source,'var POOL = Object.keys(IMG)','function today()'),
    window:section(source,'var DAY = 24 * 60','function fmtWait('),
    random:section(source,'function allChars()','/* 확정 뽑기는'),
    qp:section(source,'var QP_ID  =','/* 열리는 순간'),
    stock:section(source,'function stockOf(','function partDone('),
    pending:section(source,'function sweepPending()','var drawState ='),
    single:section(source,'document.getElementById("btnPull").addEventListener("click", function(){','/* ── 10연 출하'),
    ten:section(source,'var SCRAP_TEN = 20, TEN_N = 10;','function showTen(')
  };
  const single=chunks.single.replace('document.getElementById("btnPull").addEventListener("click", function(){','function single(){').replace(/\}\);\s*$/,'}');
  const body=[chunks.data,'var IMG=Object.fromEntries(FAMS.flatMap(f=>f.list.map(c=>[c.id,true])));',chunks.init,chunks.window,chunks.random,chunks.qp,chunks.stock,chunks.pending,single,chunks.ten].join('\n');
  const generated=`// Exact source sections extracted by prepare.mjs; no legacy UI/assets.\nexport function createLegacy({random=Math.random,now=Date.now,onSave=()=>{},onResult=()=>{}}={}){\nconst Math=Object.create(globalThis.Math); Math.random=random; const Date={now,UTC:globalThis.Date.UTC}; const GAME_EDITION={save:'steel_companion_prototype_20261109_v1'};\n${body}\nvar wasReady=false; function drawBusy(){return false;} function armBell(){} function askPersist(){} function refresh(){} function save(){onSave(S);} function showPull(id,fresh){onResult([id],[fresh]);} function showTen(ids,fresh){onResult(ids,fresh);}\nreturn {state:()=>S,setState:value=>{S=value;},single,ten:tenPull,pullsLeft,tenReady,allChars,findChar,lvOf,specOf,rareOf,partPlan,parts:PARTS,use:USE,pool:POOL,weightedPick,qpRevealed,hasQP,addStock,qp:{id:QP_ID,keys:QP_KEY,need:QP_NEED,scrap:QP_SCRAP}};\n}\n`;
  return {generated,chunks:Object.fromEntries(Object.entries(chunks).map(([key,value])=>[key,sha(value)]))};
}
