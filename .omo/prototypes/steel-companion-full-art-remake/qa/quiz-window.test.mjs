// 철강 퀴즈(4단계) 보상 한도의 시간 경계 원본 대조 (Opus 몫).
// quiz-economy.test.mjs와 같은 원본 구간을 vm에서 그대로 실행하고, 같은 시각·같은 상태에서 createLegacy()와 비교한다.
// 원본 한도는 달력 날짜가 아니라 첫 보상 시각(quizAt)부터 24시간 창이다:
//   readyIn(at) = max(0, (at||0) + DAY - now), quizWindowOpen = quizAt && readyIn(quizAt) > 0,
//   quizLeft = 창이 열려 있으면 max(0, quizMax() - quizUsed), 아니면 quizMax(), quizMax = 행사 중이면 PROMO.quizMax(품질 교육 주간 5), 아니면 3.
// 판정 범위: 창이 열리기 전, 창 안 한도 남음·소진, 만료 직전·정각·직후(1ms), 만료 뒤 첫 보상이 새 창을 여는 것, 추가 출하 상한,
//   행사 시작·끝 경계(1ms), 행사 중에 연 창이 행사 뒤까지 이어지는 것, 기기 시계가 뒤로 간 경우(quizAt이 미래), 이상한 저장 값.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {section} from '../source.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {QUIZ} from '../src/quiz.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const template=fs.readFileSync(path.resolve(root,'../../..','src/app_tpl.html'),'utf8');
const RealDate=Date, DAY=86400000;
const json=v=>JSON.stringify(v), clone=v=>JSON.parse(JSON.stringify(v));

const script=new vm.Script([
  section(template,'var IMG = {','/* 열처리 계열은'),
  section(template,'var FAMS = [','var QUIZ = ['),
  section(template,'var QUIZ = [','/* 그림이 들어온 강종만'),
  section(template,'var POOL = Object.keys(IMG)','var KEY = GAME_EDITION.save'),
  section(template,'var PULL_MAX = 1;','/* ── 진행 저장'),
  section(template,'var DAY = 24 * 60','/* 남은 시간은 계속 흘러가니'),
  section(template,'function allChars()','/* 확정 뽑기는'),
  'var qState = null;',
  section(template,'function shuffleQ(q){','document.getElementById("btnQuiz")'),
  section(template,'function quizRelated(q){','function showExp(q,ok){')
].join('\n'),{filename:'app_tpl.html#quiz-window'});

// 시각을 바꿔 가며 쓰는 원본 하나, 엔진 쪽 규칙 하나. S는 그대로 넣는다(원본 화면은 저장을 불러온 뒤의 S를 읽는다).
function pair(){
  let t=0;
  const FakeDate=Object.assign(function(...a){return new RealDate(...(a.length?a:[t]));},{now:()=>t,UTC:RealDate.UTC});
  const el={dataset:{},style:{},handlers:{},children:[],isConnected:true,addEventListener(){},appendChild(){},focus(){},querySelector:()=>el,querySelectorAll:()=>[]};
  const log={save:0};
  const sandbox={Math,Date:FakeDate,GAME_EDITION:{save:'k'},document:{getElementById:()=>el,createElement:()=>el},save(){log.save++;},refresh(){},researchCue(){},fmtWhen:()=>'',closeQuiz(){}};
  vm.createContext(sandbox); script.runInContext(sandbox);
  const legacy=createLegacy({now:()=>t}); legacy.setQuiz(QUIZ);
  return {
    at(v){t=v;},
    // 조회: 화면 요약이 읽는 값 전부
    view(state){
      sandbox.S=structuredClone(state); legacy.setState(structuredClone(state));
      const o=sandbox, l=legacy;
      return [
        {open:o.quizWindowOpen(),left:o.quizLeft(),ready:o.quizReady(),max:o.quizMax(),wait:o.readyIn(o.S.quizAt),promo:o.promoOn()},
        {open:l.quizWindowOpen(),left:l.quizLeft(),ready:l.quizReady(),max:l.quizMax(),wait:l.readyIn(l.state().quizAt),promo:l.promoOn()}
      ];
    },
    // 결과 진입: 원본 renderQ의 보상 처리 그대로 vs settleQuiz
    settle(state,right){
      sandbox.S=clone(state); sandbox.qState={qs:[{},{},{},{},{}],i:5,right}; sandbox.renderQ();
      legacy.setState(clone(state)); const s=legacy.settleQuiz(right===5);
      return [{S:clone(sandbox.S),reward:sandbox.qState.reward,allowed:sandbox.qState.rewardAllowed},{S:clone(legacy.state()),reward:s.reward,allowed:s.rewardAllowed}];
    },
    log
  };
}
const base=(extra,quizAt,quizUsed)=>({owned:{},stock:{},last:'',extra,quizDay:'',items:{},orderDay:'',orderKey:'',scrap:0,pending:'',pullAt:0,quizAt,quizUsed,bell:false,belledAt:-1,backupAt:0,orderDone:0,promoSeen:'',promoDone:'',noticeSeen:'',parts:{},cars:[],pullUsed:0,qpSeen:0});

const NORMAL=Date.UTC(2026,10,15,3,0,0);            // 2026-11-15 12:00 KST, 모든 행사가 끝난 뒤
const PROMO_FROM=Date.UTC(2026,9,21,15,0,0);         // 품질 교육 주간 2026-10-22 00:00 KST (quizMax 5)
const PROMO_TO=Date.UTC(2026,9,25,15,0,0);           // 2026-10-26 00:00 KST
const NOWS=[NORMAL,PROMO_FROM-1,PROMO_FROM,PROMO_FROM+1,PROMO_FROM+DAY/2,PROMO_TO-1,PROMO_TO,PROMO_TO+1];
// quizAt: 0(창이 열린 적 없음) 또는 now 기준 상대 시각. 만료 경계는 at+DAY-now가 1(열림)·0(닫힘)·-1(닫힘).
const AT=[null,-2*DAY,-DAY-1,-DAY,-DAY+1,-DAY/2,-1,0,1,DAY/2,DAY,3*DAY];
const USED=[0,1,2,3,4,5,6];
const EXTRA=[0,1,2,3,4,5,6];

test('every boundary: window open, left, ready, max and wait time equal the original at each instant', () => {
  const p=pair(); let n=0;
  for(const now of NOWS){ p.at(now);
    for(const at of AT) for(const used of USED){
      const [o,l]=p.view(base(0,at===null?0:now+at,used));
      assert.equal(json(l),json(o),json({now,at,used})); n++;
    }
  }
  assert.ok(n>600);
});

test('every boundary: settling five right / four right equals the original (extra, quizAt, quizUsed, reward)', () => {
  const p=pair(); let n=0, rewarded=0, newWindow=0, capOnly=0, shrank=0;
  for(const now of NOWS){ p.at(now);
    for(const at of AT) for(const used of USED) for(const extra of EXTRA) for(const right of [5,4]){
      const state=base(extra,at===null?0:now+at,used);
      const [o,l]=p.settle(state,right);
      assert.equal(json(l),json(o),json({now,at,used,extra,right})); n++;
      if(o.reward>0) rewarded++;
      if(o.allowed&&o.S.quizAt===now&&state.quizAt!==now) newWindow++;
      if(o.allowed&&o.reward===0) capOnly++;
      if(o.reward<0) shrank++;
    }
  }
  // 대조가 빈 경우만 돈 것이 아님을 보인다: 지급·새 창·상한·감소가 모두 실제로 나온다.
  assert.ok(n>8000&&rewarded>0&&newWindow>0&&capOnly>0&&shrank>0,json({n,rewarded,newWindow,capOnly,shrank}));
});

test('24h window, step by step (normal time): three rewards, fourth refused, expiry at exactly quizAt+DAY opens a new window', () => {
  const p=pair(); const t0=NORMAL; let s=base(0,0,0);
  const step=(now,right=5)=>{p.at(now);const [o,l]=p.settle(s,right);assert.equal(json(l),json(o),String(now-t0));s=o.S;return o;};
  // 창이 열리기 전: quizAt 0 → 남은 3회, 오답이 섞이면 아무것도 바뀌지 않는다(창도 열리지 않는다)
  p.at(t0); assert.equal(p.view(s)[0].left,3); assert.equal(p.view(s)[0].open,0);
  let r=step(t0,4); assert.equal(r.reward,0); assert.equal(s.quizAt,0); assert.equal(s.quizUsed,0); assert.equal(s.extra,0);
  // 첫 보상이 창을 연다
  r=step(t0); assert.equal(r.reward,1); assert.equal(s.quizAt,t0); assert.equal(s.quizUsed,1); assert.equal(s.extra,1);
  r=step(t0+3600000); assert.equal(s.quizUsed,2); assert.equal(s.quizAt,t0,'두 번째 보상은 창을 옮기지 않는다');
  r=step(t0+DAY-2); assert.equal(s.quizUsed,3); assert.equal(s.extra,3);
  // 한도 소진: 창 안에서는 다섯 정답이어도 불변
  r=step(t0+DAY-1); assert.equal(r.allowed,false); assert.equal(r.reward,0); assert.equal(s.quizUsed,3); assert.equal(s.extra,3);
  p.at(t0+DAY-1); assert.deepEqual([p.view(s)[0].left,p.view(s)[0].wait],[0,1],'만료 1ms 전: 남은 0회, 1ms 뒤 갱신');
  // 만료 정각(at+DAY): 창이 닫혀 다시 3회
  p.at(t0+DAY); assert.equal(p.view(s)[0].left,3); assert.equal(p.view(s)[0].open,false);
  // 만료 뒤 첫 보상: 새 창(quizAt=지금, quizUsed=0 → 1). extra는 이미 상한 3이라 늘지 않는다.
  r=step(t0+DAY); assert.equal(r.allowed,true); assert.equal(r.reward,0); assert.equal(s.quizAt,t0+DAY); assert.equal(s.quizUsed,1); assert.equal(s.extra,3);
});

test('extra cap: when extra is already quizMax(), a reward still uses one of the window (quizUsed+1) but extra stays', () => {
  const p=pair(); p.at(NORMAL);
  const [o,l]=p.settle(base(3,NORMAL-1000,1),5);
  assert.equal(json(l),json(o));
  assert.deepEqual([o.S.extra,o.S.quizUsed,o.reward,o.allowed],[3,2,0,true]);
});

test('promo quizMax 5 (품질 교육 주간): limit and cap are 5 from PROMO.from to PROMO.to-1; 3 outside', () => {
  const p=pair();
  for(const [now,max] of [[PROMO_FROM-1,3],[PROMO_FROM,5],[PROMO_TO-1,5],[PROMO_TO,3]]){
    p.at(now); const [o,l]=p.view(base(0,0,0)); assert.equal(json(l),json(o)); assert.equal(o.max,max,String(now));
  }
  // 행사 중: 다섯 번째 보상까지 받고 extra가 5까지 오른다
  p.at(PROMO_FROM+1000); let s=base(0,0,0);
  for(let i=1;i<=5;i++){const [o,l]=p.settle(s,5);assert.equal(json(l),json(o));s=o.S;assert.equal(s.extra,i);assert.equal(s.quizUsed,i);}
  const [o6]=p.settle(s,5); assert.equal(o6.allowed,false,'여섯 번째는 거절');
  // 행사 전에 연 창(3회 소진)이 행사 시작을 넘으면 같은 창에서 2회가 더 생긴다
  p.at(PROMO_FROM); assert.equal(p.view(base(0,PROMO_FROM-3600000,3))[0].left,2);
  // 행사 중에 연 창(5회 사용)이 행사 끝을 넘으면 같은 창에서 0회(max(0,3-5))
  p.at(PROMO_TO); assert.equal(p.view(base(5,PROMO_TO-3600000,5))[0].left,0);
});

test('original quirk kept: after the promo, extra above quizMax() SHRINKS to 3 on the next reward (reward is negative)', () => {
  // 원본 보상 문장은 extra = min(extra+1, quizMax())다. 행사 중 5까지 모은 뒤 행사가 끝나고 새 창에서 다섯 정답이면 extra 5 → 3.
  // 원본 결과 문구는 reward>0이 아니고 rewardAllowed이므로 "상한에 도달해 수량은 늘지 않았어요"라고 말한다. 경제 규칙은 바꾸지 않으므로 그대로 둔다(보고 항목).
  const p=pair(); p.at(PROMO_TO+2*DAY);
  const [o,l]=p.settle(base(5,PROMO_TO-3600000,5),5);
  assert.equal(json(l),json(o));
  assert.deepEqual([o.S.extra,o.S.quizUsed,o.reward,o.allowed],[3,1,-2,true]);
});

test('device clock went back (quizAt in the future): the window stays open until quizAt+DAY, as in the original', () => {
  const p=pair(); p.at(NORMAL);
  const ahead=NORMAL+3*DAY;
  const [v]=p.view(base(0,ahead,3));
  assert.deepEqual([v.open,v.left,v.wait],[true,0,4*DAY],'소진 상태가 4일 동안 이어진다');
  const [v2]=p.view(base(0,ahead,1)); assert.equal(v2.left,2,'남은 횟수는 그대로 쓸 수 있다');
  const [o,l]=p.settle(base(0,ahead,1),5); assert.equal(json(l),json(o));
  assert.deepEqual([o.S.quizAt,o.S.quizUsed,o.S.extra],[ahead,2,1],'미래 창은 옮겨지지 않는다');
});

test('odd values after loading: the original behaviour for each (the engine holds the non-integers; see engine tests)', () => {
  const p=pair(); p.at(NORMAL);
  const cases=[
    // [quizAt, quizUsed]: applySaved 뒤에 남을 수 있는 값(원본 '||0'은 0·NaN·null·''·false·undefined만 0으로 바꾼다)
    [-5,0],[-DAY*10,2],[1.5,0],[NORMAL-0.5,2],[Infinity,0],[-Infinity,0],[String(NORMAL-1000),1],[NORMAL-1000,-1],[NORMAL-1000,2.5],[NORMAL-1000,'2'],[NORMAL-1000,Infinity],[NORMAL-1000,7]
  ];
  const seen={};
  for(const [at,used] of cases){
    const state=base(0,at,used);
    // Infinity·-Infinity는 JSON으로 옮기면 null이 되므로 clone 없이 직접 비교한다
    const [vo,vl]=p.view(state);
    assert.equal(json(vl),json(vo),json([String(at),String(used)]));
    seen[String(at)+'|'+String(used)]=vo;
  }
  // 대표 동작
  assert.equal(seen['-5|0'].open,false,'음수 quizAt: 창이 닫힌 것으로 본다(보상하면 새 창)');
  assert.equal(seen['Infinity|0'].open,true,'Infinity quizAt: 창이 영원히 열려 있다');
  assert.equal(seen[`${NORMAL-1000}|-1`].left,4,'음수 quizUsed: 한도보다 많이 받을 수 있다');
  assert.equal(seen[`${NORMAL-1000}|2.5`].left,0.5,'소수 quizUsed: 남은 횟수가 소수가 된다');
  assert.equal(seen[`${NORMAL-1000}|Infinity`].left,0);
  assert.equal(seen[`${NORMAL-1000}|7`].left,0,'한도를 넘은 quizUsed: 0회(정수이므로 받아들인다)');
});

// ── 불러오기 검사(engine.mjs validState): pullAt·pullUsed(0b단계)와 같은 규칙 ──
import {createEngine,SAVE_KEY} from '../src/engine.mjs';
const memory=raw=>{const map=new Map(raw?[[SAVE_KEY,raw]]:[]);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map};};
const seeded=extra=>JSON.stringify({...createEngine({storage:memory()}).state(),...extra});

test('load: quizAt/quizUsed that are not 0-or-more safe integers are held (nothing overwritten); legitimate odd states load', () => {
  for(const bad of [{quizAt:-5},{quizAt:1.5},{quizAt:String(NORMAL)},{quizAt:'x'},{quizAt:1e300},{quizAt:{}},{quizUsed:-1},{quizUsed:2.5},{quizUsed:'2'},{quizUsed:[]},{quizUsed:true}]){
    const raw=seeded(bad), storage=memory(raw), e=createEngine({storage,now:()=>NORMAL});
    assert.equal(e.status().blocked,true,json(bad)); assert.equal(storage.getItem(SAVE_KEY),raw,'저장은 그대로');
  }
  // 원본 '||0'이 0으로 바꾸는 값(null·''·false·0·없음)은 정상으로 읽는다
  for(const zero of [{quizAt:null},{quizAt:''},{quizAt:false},{quizUsed:null},{quizUsed:0}]){
    const e=createEngine({storage:memory(seeded(zero)),now:()=>NORMAL});
    assert.equal(e.status().blocked,false,json(zero)); assert.equal(e.state().quizAt,0); assert.equal(e.state().quizUsed,0);
  }
  {const raw=JSON.parse(seeded({}));delete raw.quizAt;delete raw.quizUsed;const e=createEngine({storage:memory(JSON.stringify(raw)),now:()=>NORMAL});assert.equal(e.status().blocked,false);assert.deepEqual([e.state().quizAt,e.state().quizUsed],[0,0]);}
  // 받아들이는 이상 상태: 미래 quizAt(시계 역행), 한도를 넘은 quizUsed, 행사 뒤 상한을 넘은 extra, 원본이 읽지 않는 quizDay
  for(const ok of [{quizAt:NORMAL+3*DAY,quizUsed:3},{quizAt:NORMAL-1000,quizUsed:9},{extra:5},{quizDay:'2026-9-1'},{quizDay:7}]){
    const e=createEngine({storage:memory(seeded(ok)),now:()=>NORMAL});
    assert.equal(e.status().blocked,false,json(ok));
    for(const [k,v] of Object.entries(ok)) assert.deepEqual(e.state()[k],v,'값을 바꾸지 않고 보존: '+k);
  }
});
