// 5단계 대조용: 고정 템플릿(src/app_tpl.html)의 공지·행사·알림 함수를 "고치지 않은 원문 그대로" Node vm에서 실행한다.
// 엔진(source.mjs의 추출·감싼 함수)과 별개 경로다. 화면 함수(창 열기·띠 그리기·토스트·알림 보내기·저장)만 호출 기록을 남기는 가짜로 둔다.
// 원문 구간: 상수·PROMOS·행사 판정(var PULL_MAX ~ today 직전), 출하 창(var DAY ~ 남은 시간 주석 직전), NOTICES·noticeOn,
//            checkNotice 전체, checkPromo 전체, bellOK·bellOn, fireBell·armBell·watchReady 전체, fmtSpan·promoWhen.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {section} from '../source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const templatePath = path.resolve(here, '../../../../src/app_tpl.html');
const source = fs.readFileSync(templatePath, 'utf8');
const parts = [
  section(source, 'var PULL_MAX = 1;', 'function today()'),
  section(source, 'var DAY = 24 * 60', '/* 남은 시간은 계속 흘러가니'),
  section(source, 'var NOTICES = [', '\nfunction renderNotice(){'),
  section(source, 'function checkNotice(){', '/* 알림을 켜 둔 사람에게는 공지가'),
  section(source, 'function checkPromo(){', '\nfunction fmtWhen(at){'),
  section(source, 'function bellOK(){', '\n\nfunction renderBell(){'),
  section(source, 'function fireBell(){', '/* ── 저장이 안 될 때'),
  section(source, 'function fmtSpan(ms){', '\n/* 이번 이벤트가')
];
// 가짜 화면 함수와 상태. openNotice·openPromo는 원본처럼 창이 "열린 상태"를 만든다(checkPromo가 공지 창이 열려 있으면 겹쳐 띄우지 않는 검사를 본다).
const prelude = `
var S = {}; var log = [];
function modal(){ var open=false; return {classList:{contains:function(){return open;}}, set:function(v){open=v;}}; }
var noticeModal = modal(), promoModal = modal();
function save(){ log.push(['save']); }
function openNotice(){ noticeModal.set(true); log.push(['openNotice']); }
function openPromo(){ promoModal.set(true); log.push(['openPromo']); }
function closePromo(){ promoModal.set(false); log.push(['closePromo']); }
function noticeBell(){ log.push(['noticeBell']); }
function promoBell(){ log.push(['promoBell']); }
function renderNotice(){} function renderPromo(){} function renderBell(){}
function showToast(msg,title){ log.push(['toast', title||'', msg||'']); }
function famName(k){ return 'fam:' + k; }
function tick(){}
var navigator = {};
`;
const script = new vm.Script(prelude + parts.join('\n') + '\n;this.__api={get S(){return S;}, set S(v){S=v;}, log:function(){return log;}, clear:function(){log.length=0; noticeModal.set(false); promoModal.set(false);}, ' +
  'checkNotice:checkNotice, checkPromo:checkPromo, fireBell:fireBell, watchReady:watchReady, boot:function(){ wasReady = pullRenewed(); }, ' +
  'pullRenewed:pullRenewed, pullReady:pullReady, promoOn:promoOn, promoSoon:promoSoon, curPromo:curPromo, curNotice:curNotice, noticeOn:noticeOn, ' +
  'quizMax:quizMax, pullMax:pullMax, orderMax:orderMax, promoWhen:promoWhen, fmtSpan:fmtSpan, PROMOS:PROMOS, NOTICES:NOTICES};', {filename: 'app_tpl.html (original sections)'});

// now: 시각 함수. permission: 가짜 Notification의 권한('granted'·'denied'), 'none'이면 Notification이 없다. 보낸 알림은 notes에 쌓인다.
export function createOriginal({now, permission = 'granted'}) {
  const RealDate = globalThis.Date;
  const FakeDate = function (...a) { return a.length ? new RealDate(...a) : new RealDate(now()); };
  FakeDate.now = () => now(); FakeDate.UTC = RealDate.UTC; FakeDate.prototype = RealDate.prototype;
  const notes = [];
  const context = {Date: FakeDate, Math, setTimeout: () => 0, clearTimeout: () => {}, console};
  if (permission !== 'none') context.Notification = class { constructor(title, opt) { notes.push([title, opt && opt.body]); } static permission = permission; };
  vm.createContext(context);
  script.runInContext(context);
  return {api: context.__api, notes};
}
