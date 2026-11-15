// 철강 퀴즈(4단계) 원본 대조. economy.test·orders-economy.test와 같은 방식이다.
// 원본 app_tpl.html에서 section()으로 뽑은 원문을 vm에서 그대로 실행하고, 같은 난수 열·같은 상태·같은 시각에서 createLegacy() 결과와 비교한다.
//
// vm에 올리는 원본 구간:
//   var IMG = {…}, FAMS 데이터, POOL 한 줄, PULL_MAX~PROMOS~orderMax~today ('var PULL_MAX = 1;' ~ '/* ── 진행 저장'),
//   24시간 주기 ('var DAY = 24 * 60' ~ '/* 남은 시간은 계속 흘러가니': readyIn·quizWindowOpen·quizLeft·quizReady 포함), allChars~findChar,
//   QUIZ 413문항, shuffleQ·drawQuiz, quizRelated, renderQ 전체 ('function renderQ(){' ~ 'function showExp(q,ok){': 결과 진입의 보상 처리 포함)
// 스텁: S(케이스마다), Math.random(주입 난수), Date(주입 시각), document(가짜 요소: 원본이 그리는 결과 화면의 버튼·초점을 받아 줌),
//   save·refresh·researchCue(횟수만 셈), fmtWhen·closeQuiz(아무 일 안 함).
// 이 파일은 추첨·섞기·관련 소재·보상 처리의 원본 대조다. 시간 경계 전수 판정은 quiz-window.test.mjs가 맡는다.
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
const lcg=seed=>{let n=seed>>>0;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};
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
].join('\n'),{filename:'app_tpl.html#quiz'});

function original({now,random=Math.random}){
  const log={save:0,refresh:0,cue:[]};
  let nowValue=now;
  const FakeDate=Object.assign(function(...a){return new RealDate(...(a.length?a:[nowValue]));},{now:()=>nowValue,UTC:RealDate.UTC});
  const cache={};
  const element=id=>cache[id]||(cache[id]={id,dataset:{},style:{},handlers:{},children:[],innerHTML:'',className:'',textContent:'',isConnected:true,
    addEventListener(type,fn){this.handlers[type]=fn;},appendChild(c){this.children.push(c);},focus(){},querySelector:()=>element('q'),querySelectorAll:()=>[]});
  const fakeMath=Object.create(Math); fakeMath.random=random;
  const sandbox={Math:fakeMath,Date:FakeDate,GAME_EDITION:{save:'k'},document:{getElementById:element,createElement:()=>element('c')},
    save(){log.save++;},refresh(){log.refresh++;},researchCue(id){log.cue.push(id);},fmtWhen:()=>'',closeQuiz(){},console};
  vm.createContext(sandbox); script.runInContext(sandbox);
  return {sandbox,log,setNow:v=>{nowValue=v;}};
}
const baseState=extra=>({owned:{},stock:{},last:'',extra,quizDay:'',items:{},orderDay:'',orderKey:'',scrap:0,pending:'',pullAt:0,quizAt:0,quizUsed:0,bell:false,belledAt:-1,backupAt:0,orderDone:0,promoSeen:'',promoDone:'',noticeSeen:'',parts:{},cars:[],pullUsed:0,qpSeen:0});
function rules(now,random){
  const legacy=createLegacy({random,now:()=>now}); legacy.setQuiz(QUIZ); return legacy;
}

test('QUIZ extracted into quiz.mjs equals the original array: 413 questions, text unchanged', () => {
  const o=original({now:Date.UTC(2026,10,15)});
  assert.equal(QUIZ.length,413);
  assert.equal(json(QUIZ),json(o.sandbox.QUIZ));
});

test('drawQuiz(5) with the same random sequence gives the same 5 questions, option order and answer index as the original source', () => {
  for(let seed=1;seed<=300;seed++){
    const o=original({now:Date.UTC(2026,10,15),random:lcg(seed)}), l=rules(Date.UTC(2026,10,15),lcg(seed));
    const expected=o.sandbox.drawQuiz(5), actual=l.drawQuiz(5);
    assert.equal(json(actual),json(expected),`seed ${seed}`);
    assert.equal(actual.length,5);
    assert.equal(new Set(actual.map(q=>q.q)).size,5,'five distinct questions');
  }
});

test('shuffleQ keeps the answer on the same option text for all 413 questions across many seeds', () => {
  for(let seed=1;seed<=20;seed++){
    const l=rules(Date.UTC(2026,10,15),lcg(seed));
    for(const q of QUIZ){
      const s=l.shuffleQ(q);
      assert.equal(s.o[s.a],q.o[q.a]); assert.deepEqual([...s.o].sort(),[...q.o].sort()); assert.equal(s.q,q.q); assert.equal(s.e,q.e);
    }
  }
});

test('quizRelated: the same owned materials as the original for every question', () => {
  const l=rules(Date.UTC(2026,10,15),Math.random), o=original({now:Date.UTC(2026,10,15)});
  const ids=l.allChars().map(c=>c.id);
  for(const owned of [{},Object.fromEntries(ids.map(id=>[id,1])),Object.fromEntries(ids.filter((_,i)=>i%3===0).map(id=>[id,1]))]){
    const s=baseState(0); s.owned=clone(owned); o.sandbox.S=clone(s); l.setState(clone(s));
    for(const q of QUIZ) assert.equal(json(l.quizRelated(q).map(c=>c.id)),json(o.sandbox.quizRelated(q).map(c=>c.id)));
  }
});

// 원본 renderQ를 결과 단계(session.i >= qs.length)로 불러 보상 처리를 그대로 실행한다. 반환: 처리 뒤 상태와 세션.
function originalSettle({now,state,right,total=5}){
  const o=original({now}); o.sandbox.S=clone(state);
  o.sandbox.qState={qs:new Array(total).fill({}),i:total,right};
  o.sandbox.renderQ();
  return {S:clone(o.sandbox.S),session:o.sandbox.qState,log:o.log};
}
function legacySettle({now,state,right,total=5}){
  const l=rules(now,Math.random); l.setState(clone(state));
  const session=l.settleQuiz(right===total);
  return {S:clone(l.state()),session};
}

test('settleQuiz equals the original renderQ result step: extra, quizAt and quizUsed before and after', () => {
  const now=Date.UTC(2026,10,15,12,0,0);
  const states=[];
  for(const extra of [0,1,2,3,5]) for(const [quizAt,quizUsed] of [[0,0],[now-1000,0],[now-1000,1],[now-1000,2],[now-1000,3],[now-DAY+1,2],[now-DAY,2],[now-DAY-1,3],[now+60000,1],[now-2*DAY,3]]){
    const s=baseState(extra); s.quizAt=quizAt; s.quizUsed=quizUsed; states.push(s);
  }
  for(const state of states) for(const right of [5,4,0]){
    const o=originalSettle({now,state,right}), l=legacySettle({now,state,right});
    const label=json({extra:state.extra,quizAt:state.quizAt-now,quizUsed:state.quizUsed,right});
    assert.equal(l.S.extra,o.S.extra,label); assert.equal(l.S.quizAt,o.S.quizAt,label); assert.equal(l.S.quizUsed,o.S.quizUsed,label);
    assert.equal(l.session.reward,o.session.reward,label); assert.equal(l.session.rewardAllowed,o.session.rewardAllowed,label);
    assert.equal(json({...l.S,extra:0,quizAt:0,quizUsed:0}),json({...o.S,extra:0,quizAt:0,quizUsed:0}),'nothing else changes: '+label);
  }
});

test('the original always saves on the result step (reward or not); the engine write-only-for-a-reward rule is checked in stage4.test.mjs', () => {
  const now=Date.UTC(2026,10,15,12,0,0);
  for(const right of [5,3]){const o=originalSettle({now,state:baseState(0),right}); assert.equal(o.log.save,1,'original save() once');}
});
