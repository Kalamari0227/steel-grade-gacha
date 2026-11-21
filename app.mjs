import {createEngine} from './engine.mjs';
import {createArchiveRow, createArchiveDialog} from './archiveview.mjs';
import {createInstall} from './installview.mjs';
import {startPwa} from './pwa.mjs';
import {commandSafely, shipSafely} from './shipments.mjs';
import {button, el} from './ui.mjs';
import {createCardDialog} from './card.mjs';
import {createPartDialog} from './parts.mjs';
import {createCarDialog} from './car.mjs';
import {createEquipDialog} from './equip.mjs';
import {createQuizDialog} from './quizview.mjs';
import {createToonDialog} from './toonview.mjs';
import {createSound, reveal} from './reveal.mjs';
import {lobby, shipyard, results, collection, crafting, garage, research, toonSheet, VIEWS, shipLeftText, shipNoteText} from './views.mjs';
import {heroReveal} from './hero.mjs';
import {createOps, createOpsDialog, createToast} from './opsview.mjs';

const main = document.querySelector('#main');
const scroller = document.querySelector('#scroller');
const backdrop = document.querySelector('#backdrop');
const hudRes = document.querySelector('#hud-res');
const sound = createSound();
let data, engine, cards, parts, carView, equipView, quizView, toonView, cancelReveal, submitting = false;
let dataRequest = 0;
let lobbyStale = false;
let quizOpening = false;
let opsBand, opsView, toast, opsBusy = false;
let archiveRow, archiveView;

function updateNotice(error = '') {
  const warning = document.querySelector('#warning');
  const message = error || engine.status().warning;
  warning.replaceChildren();
  warning.hidden = !message;
  if (message) {
    // 7단계: 원본 renderStoreWarn처럼 제목과 [진행 백업 · 복원 열기]. 체험판 시절 JSON 파일 받기는 없앴다(사용자 결정 2026-11-20).
    const alert = el('p', '');
    alert.setAttribute('role', 'alert');
    alert.append(el('b', 'warning-title', '진행 저장을 확인해 주세요'), el('span', 'warning-text', message));
    warning.append(alert, button('진행 백업 · 복원 열기', 'secondary', event => openArchive(event.currentTarget)));
  }
}
// ── 진행 보관 (7단계) ──
function openArchive(from) { if (archiveView && !document.querySelector('dialog[open]')) archiveView.open(from); }
function renderArchiveRow() { if (archiveRow && engine) archiveRow.render(engine.backupView()); }
function archiveChanged(kind) {
  if (kind !== 'backup') lobbyStale = true;
  hud(); updateNotice(); renderOps(); renderArchiveRow();
}
function path() {
  const value = location.hash.slice(1);
  return VIEWS.includes(value) ? value : 'workshop';
}
function navState(view) {
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === 'results') link.hidden = !engine.state().results;
    if (link.dataset.nav === (view === 'ship' ? 'workshop' : view)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
    // 새 웹툰이 있으면 연구 탭 라벨에 붉은 점(장식)을 붙이고, 화면 읽기에는 이름(연구)은 그대로 둔 채 설명으로 알린다. 읽으면 사라진다.
    if (link.dataset.nav === 'research') {
      const fresh = engine.toon().hasNew;
      link.dataset.new = String(fresh);
      let note = document.querySelector('#toon-new-desc');
      if (!note) { note = el('span', 'sr', '새 웹툰이 있어요'); note.id = 'toon-new-desc'; link.closest('nav').append(note); }
      if (fresh) link.setAttribute('aria-describedby', note.id); else link.removeAttribute('aria-describedby');
    }
  });
}
// 웹툰 읽음이 바뀌었을 때(회차를 열었거나 다른 탭에서): 연구 탭의 점과 소식지 줄만 제자리에서 고친다.
function toonChanged() {
  if (!engine) return;
  navState(path());
  const note = main.querySelector('#toon-note');
  if (note) note.replaceWith(toonSheet(engine.toon(), researchHandlers));
}
// 껍데기(U1): 화면별 배경과 상단 재화 칩. 표시만 하며 저장·경제를 바꾸지 않는다.
const BACKDROPS = {workshop:'scene:workshop:back', ship:'scene:workshop:back', results:'scene:workshop:back', collection:'scene:collection:back',
  crafting:'scene:crafting:back', garage:'scene:garage:back', research:'scene:research:back'};
function decor(key) {
  const url = data.assets[key]?.image;
  if (!url) return null;
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.addEventListener('error', () => img.remove(), {once: true});
  img.src = url;
  return img;
}
function setBackdrop(view) {
  document.body.dataset.view = view;
  const key = BACKDROPS[view] || BACKDROPS.workshop;
  if (backdrop.dataset.key === key) return;
  backdrop.dataset.key = key;
  const img = decor(key);
  backdrop.replaceChildren(...(img ? [img] : []));
}
function chip(kind, label, value, wait = '') {
  const box = el('span', 'chip ' + kind);
  const icon = el('span', 'chip-ico');
  icon.setAttribute('aria-hidden', 'true');
  if (kind === 'ship') { const img = decor('draw:coil-pack'); if (img) icon.append(img); }
  const tag = el('span', 'chip-tag', kind === 'ship' ? 'COIL' : 'SCRAP');
  tag.setAttribute('aria-hidden', 'true');
  box.append(icon, tag, el('span', 'sr', label + ' '), el('b', '', String(value)));
  if (wait) box.append(el('span', 'sr', ', 다음 출하까지 '), el('small', 'chip-wait', wait));
  box.title = wait ? label + ' ' + value + ' · 다음 출하까지 ' + wait : label;
  return box;
}
let hudKey = '';
function hud() {
  const state = engine.state(), status = engine.status();
  const key = [status.singleLeft, status.wait, state.scrap].join('|');
  if (key === hudKey && hudRes.childElementCount) return;
  hudKey = key;
  hudRes.replaceChildren(chip('ship', '남은 출하', status.singleLeft, status.wait), chip('scrap', '스크랩', state.scrap));
}
// 남은 시간은 계속 흐르므로 출하 안내·버튼·칩만 제자리에서 고친다(화면을 다시 그리지 않아 초점이 유지된다).
function tick() {
  if (!engine) return;
  const status = engine.status();
  hud();
  const left = shipLeftText(status);
  for (const node of main.querySelectorAll('[data-ship-left]')) if (node.textContent !== left) node.textContent = left;
  const note = main.querySelector('[data-ship-note]'), noteText = shipNoteText(status);
  if (note && note.textContent !== noteText) note.textContent = noteText;
  const single = main.querySelector('.ship-button[data-count="1"]');
  if (single) single.disabled = status.singleLeft < 1 || status.blocked;
  // 연구 탭의 퀴즈 시작 버튼: 24시간 창이 끝나 다시 시작할 수 있게 되었거나 그 반대가 되면 안내서만 다시 그린다(다른 창이 열려 있으면 기다린다).
  const start = main.querySelector('#quiz-start');
  if (start && start.disabled === engine.quiz().canStart && !document.querySelector('dialog[open]') && !submitting && !quizOpening) show('research', false);
  opsTick();
}
setInterval(tick, 1000);

// ── 공지·행사 안내·출하 알림 (5단계) ──
// 안내는 사용자가 확인·닫기를 눌렀을 때만 기록한다(엔진 ackNotice·ackPromo). 열기만으로는 저장하지 않는다.
// 다른 위층 창(동료 카드·부품·장착·퀴즈)이 열려 있거나 출하 연출 중이거나 저장 명령이 도는 동안에는 자동 안내와 토스트를 미루고, 끝나면 다음 틱에 띄운다.
const toastQueue = [];
let bellMessage = '';
const busyForOps = () => !engine || submitting || quizOpening || cancelReveal || opsBusy || document.querySelector('dialog[open]');
function renderOps() { if (opsBand && engine) opsBand.render(engine.ops()); }
function toastNow(message, title) { toastQueue.push([message, title]); flushToast(); }
function flushToast() {
  // 토스트는 하나씩: 떠 있는 토스트가 닫힌 뒤(12초 또는 닫기) 다음 틱에 다음 것을 띄운다(검토 지적 ⑤).
  if (!toast || !toastQueue.length || toast.isOpen() || document.querySelector('dialog[open]') || cancelReveal) return;
  const [message, title] = toastQueue.shift();
  toast.show(message, title);
}
function systemNotify(title, body, tag) {
  try { if (engine.ops().bell.on) new Notification(title, {body, tag, renotify: true}); } catch { /* 지원하지 않거나 거절된 환경 */ }
}
const notified = new Set();
// 기록에 실패한 안내(저장 잠금 미지원·다른 탭·손상 저장 등)는 이번 페이지에서 다시 자동으로 띄우지 않는다(검토 지적 ②). 띠에서는 계속 열 수 있다.
const unrecorded = new Set();
async function recordClose(info) {
  if (!info.due) return;
  const run = info.kind === 'notice' ? () => engine.ackNotice(info.key) : () => engine.ackPromo(info.key);
  const outcome = await commandSafely(run, LOCK_TEXT);
  if (!outcome.ok) unrecorded.add(info.kind + ':' + info.key);
  updateNotice(outcome.ok ? (outcome.saved === false ? outcome.warning : '') : outcome.error);
  renderOps();
}
function openOps(kind, {due = false, from = null} = {}) {
  if (!opsView || document.querySelector('dialog[open]')) return;
  const o = engine.ops();
  history.pushState({view: path(), ops: true}, '', '#' + path());
  opsView.open(o, kind, {due, from});
}
async function checkOps() {
  if (busyForOps()) return;
  opsBusy = true;
  try {
    const o = engine.ops();
    const notice = o.pending.notice && !unrecorded.has('notice:' + o.notice.key);
    // 공지가 아직 확인되지 않았으면(기록 실패로 미룬 경우 포함) 행사 안내는 따로 띄우지 않는다. 공지 창이 행사 내용을 함께 싣는다(원본 checkPromo와 같다).
    const promo = !o.pending.notice && o.pending.promo && !unrecorded.has('promo:' + o.promo.key);
    // 공지·행사 시작의 시스템 알림은 창이 숨겨져 있어도 보낸다(원본과 같다, 검토 지적 ④). 창은 화면에 돌아왔을 때 띄운다.
    if (notice && !notified.has('n' + o.notice.key)) { notified.add('n' + o.notice.key); systemNotify('스틸 컴패니언 · ' + o.notice.title, o.notice.lead.replace(/<[^>]+>/g, ''), 'sc-notice'); }
    if (promo && !notified.has('p' + o.promo.key)) { notified.add('p' + o.promo.key); systemNotify('스틸 컴패니언', o.promo.name + ' 시작. ' + o.promo.summary + '.', 'sc-promo'); }
    if (document.hidden) return;
    if (notice) { opsBusy = false; openOps('notice', {due: true}); return; }
    if (promo) { opsBusy = false; openOps('promo', {due: true}); return; }
    if (o.pending.promoEnd && !unrecorded.has('end:' + o.promo.key)) {
      const outcome = await commandSafely(() => engine.ackPromoEnd(o.promo.key), LOCK_TEXT);
      if (!outcome.ok) unrecorded.add('end:' + o.promo.key);
      updateNotice(outcome.ok ? (outcome.saved === false ? outcome.warning : '') : outcome.error);
      if (outcome.ok && outcome.changed) {
        const p = o.promo;
        toastNow(p.pick ? p.pickName + ' 확률이 평소대로 돌아갑니다.' : '출하 하루 ' + p.base.pull + '회, 퀴즈 ' + p.base.quiz + '회로 돌아갑니다.', '한정 기간이 끝났습니다');
      }
    }
  } finally { opsBusy = false; }
}
// 출하 갱신 전이(닫힘 → 열림)에서만 알린다. 한 주기에 한 번은 엔진 fireBell이 belledAt으로 보장한다.
async function onReady() {
  const outcome = await commandSafely(() => engine.fireBell(), LOCK_TEXT);
  if (outcome.ok && outcome.fired) {
    updateNotice(outcome.saved === false ? outcome.warning : '');
    try { new Notification('스틸 컴패니언', {body: '오늘의 출하가 열렸습니다. 강종 한 장 출하하러 가세요.', tag: 'sc-ship', renotify: true}); } catch { /* 알림을 보낼 수 없는 환경 */ }
  }
  toastNow(engine.ops().bell.on ? '알림을 보냈습니다. 오늘의 출하를 받으세요.' : '오늘의 출하를 받으세요.', '출하 시간이 됐습니다');
  renderOps();
}
function opsTick() {
  if (!engine) return;
  renderOps();
  if (engine.readyEdge()) onReady();
  if (!busyForOps()) { flushToast(); checkOps(); }
}
const requestPermission = () => new Promise((resolve, reject) => {
  let done = false;
  const finish = permission => { if (!done) { done = true; resolve(permission); } };
  try { const r = Notification.requestPermission(finish); if (r && r.then) r.then(finish, reject); } catch (error) { reject(error); }
});
// 알림 버튼을 누른 뒤에만 권한을 요청한다. 허용이 아니면 켜지 않는다(엔진 enableBell이 다시 확인한다).
async function toggleBell() {
  const b = engine.ops().bell;
  bellMessage = '';
  // 켜져 보일 때만 끈다. 저장은 켜짐인데 권한이 다시 '묻기 전'으로 돌아갔으면 꺼짐으로 보이므로 권한부터 묻는다(검토 지적 ③).
  if (b.on) {
    const outcome = await commandSafely(() => engine.disableBell(), LOCK_TEXT);
    if (!outcome.ok) bellMessage = outcome.error;
  } else if (b.supported) {
    let permission = b.permission;
    if (permission === 'default') {
      try { permission = await requestPermission(); }
      catch { bellMessage = '브라우저 설정을 확인한 뒤 다시 시도해 주세요.'; }
    }
    if (!bellMessage) {
      const outcome = await commandSafely(() => engine.enableBell(), LOCK_TEXT);
      if (!outcome.ok) bellMessage = outcome.error;
      else {
        const next = engine.ops().bell;
        toastNow(outcome.readyNow ? '지금은 이미 출하가 열려 있습니다.' : next.nextText + '에 알려 드립니다.', '출하 알림을 켰습니다');
        if (outcome.saved === false) updateNotice(outcome.warning);
      }
    }
  }
  opsBand.say(bellMessage);
  renderOps();
  // 버튼이 사라지는 상태(차단·미지원)가 되면 초점이 갈 곳이 없으니 결과 문구로 옮긴다.
  if (!document.activeElement || document.activeElement === document.body || opsBand.toggle.hidden) opsBand.focusNote();
}
function toTop() { scroller.scrollTop = 0; window.scrollTo(0, 0); }
function stopReveal() {
  cancelReveal?.();
  cancelReveal = null;
}
function show(view = path(), focus = true) {
  stopReveal();
  navState(view);
  setBackdrop(view);
  hud();
  updateNotice();
  renderOps();
  renderArchiveRow();
  const state = engine.state();
  if (view === 'results' && state.results) main.replaceChildren(results(data, state, engine.nextGoal(), {openCard, go, replay: playResult, openGoal, scrap: scrapCard, stock: () => engine.state().stock}));
  else if (view === 'crafting') main.replaceChildren(crafting(data, engine.partList(), openPart));
  else if (view === 'garage') main.replaceChildren(garage(data, engine.garage(), {go, openCar, take: takeCar, notice: garageNotice, taken: garageTaken}));
  else if (view === 'collection') main.replaceChildren(collection(data, state, openCard, {status: engine.qpStatus(), develop}));
  else if (view === 'research') { main.replaceChildren(research(data, engine.order(), engine.warranties(), researchHandlers, {go, notice: researchNotice, quiz: engine.quiz(), toon: engine.toon()})); pinOrder(); }
  else if (view === 'ship') main.replaceChildren(shipyard(data, engine, ship, go, exchange));
  else {
    if (view !== 'workshop') return go('workshop', true);
    lobbyStale = false;
    main.replaceChildren(lobby(data, engine, go, openCard, openGoal));
  }
  document.title = main.querySelector('h1').textContent + ' · 스틸 컴패니언';
  if (focus) { main.focus({preventScroll: true}); toTop(); }
}
function go(view, replace = false) {
  if (!data || !engine) return;
  if (view !== path() || replace) history[replace ? 'replaceState' : 'pushState']({view}, '', '#' + view);
  show(view);
}
function openCard(card, opener) {
  if (!engine.state().owned[card.id]) return;
  history.pushState({view: path(), cardId: card.id}, '', '#' + path());
  cards.open(card, opener);
}
function playResult(result) {
  stopReveal();
  toTop();
  cancelReveal = reveal(main, data, result, () => show('results'), sound);
}
function develop(trigger) {
  if (submitting) return;
  submitting = true;
  try {
    const outcome = engine.develop();
    updateNotice(outcome.ok ? '' : outcome.error);
    if (!outcome.ok) { show('collection', false); return; }
    const card = data.cards.find(c => c.id === outcome.development.id);
    if (trigger?.isConnected) trigger.disabled = true;
    stopReveal();
    // 저장을 먼저 시도한 뒤 연출한다. 스킵·Esc·화면 이탈은 결과를 바꾸지 않는다.
    cancelReveal = heroReveal(data, card, {soundOn: sound.enabled(), onDone: () => {
      cancelReveal = null;
      show('collection');
      openCard(card, main.querySelector('[data-card-id="' + card.id + '"] .tile-open'));
    }});
  } finally { submitting = false; }
}
function playOutcome(outcome) {
  history.pushState({view:'results'}, '', '#results');
  navState('results');
  setBackdrop('results');
  hud();
  updateNotice();
  playResult(outcome.result);
}
async function ship(count) {
  if (submitting) return;
  submitting = true;
  try {
    const outcome = await shipSafely(engine,count);
    if (!outcome.ok) { show(); updateNotice(outcome.error); return; }
    playOutcome(outcome);
  } finally { submitting = false; }
}
// 확정 교환·중복 스크랩·부품 제작은 출하와 같은 저장 잠금 안에서 실행한다.
const LOCK_TEXT = {unsupported: '이 브라우저에서는 안전한 저장 잠금을 사용할 수 없습니다. 최신 브라우저에서 열어 주세요.', failed: '저장 잠금을 얻지 못했습니다. 진행을 확인하고 다시 시도해 주세요.'};
async function exchange(lv) {
  if (submitting) return;
  submitting = true;
  try {
    const outcome = await commandSafely(() => engine.exchange(lv), LOCK_TEXT);
    if (!outcome.ok) { show(); updateNotice(outcome.error); return; }
    playOutcome(outcome);
  } finally { submitting = false; }
}
async function scrapCard(id) {
  if (submitting) return {ok: false, error: '처리 중입니다.'};
  submitting = true;
  try {
    const outcome = await commandSafely(() => engine.scrap(id), LOCK_TEXT);
    updateNotice(outcome.ok ? '' : outcome.error);
    hud();
    return outcome;
  } finally { submitting = false; }
}
async function craftPart(key, picks, expect) {
  if (submitting) return {ok: false, error: '처리 중입니다.'};
  submitting = true;
  try {
    const outcome = await commandSafely(() => engine.craft(key, picks, expect), LOCK_TEXT);
    updateNotice();
    hud();
    return outcome;
  } finally { submitting = false; }
}
function openPart(key) {
  history.pushState({view: 'crafting', partKey: key}, '', '#crafting');
  parts.open(key);
}
function openGoal(key) {
  if (key === 'garage') { go('garage'); return; }
  go('crafting');
  openPart(key);
}

// 차량 확정은 출하와 같은 저장 잠금 안에서 실행한다. 성공하면 차고를 다시 그리고 가벼운 완성 표시(문구·강조)만 한다.
let garageNotice = '', garageTaken = '';
async function takeCar(key) {
  if (submitting) return;
  submitting = true;
  try {
    const outcome = await commandSafely(() => engine.takeCar(key), LOCK_TEXT);
    garageNotice = outcome.ok ? outcome.car.tag + '을 차고에 등록했어요. ' + (outcome.complete ? '자동차 수집 완료.' : '다음 자동차의 조립을 시작할 수 있어요.') : outcome.error;
    garageTaken = outcome.ok ? key : '';
    updateNotice();
    show('garage', false);
    garageNotice = ''; garageTaken = '';
    main.querySelector('#car-status')?.focus({preventScroll: true});
  } finally { submitting = false; }
}
// 고객 요구 회신과 보증 장착도 출하와 같은 저장 잠금 안에서 실행한다. 요구를 여는 것(engine.order)은 저장하지 않는다.
let researchNotice = '', researchFresh = '';
// 요구를 보여 준 직후 그 요구를 저장에 굳힌다(같은 저장 잠금). 화면은 이미 같은 요구를 그렸으므로 다시 그리지 않고, 경고만 갱신한다.
async function pinOrder() {
  if (engine.status().blocked) return;
  const outcome = await commandSafely(() => engine.pinOrder(), LOCK_TEXT);
  if (!outcome.ok || outcome.pinned) updateNotice(outcome.ok ? '' : outcome.error);
}
async function replyOrder(expected, day, answer) {
  if (submitting) return {ok: false, error: '처리 중입니다.'};
  submitting = true;
  try {
    const outcome = await commandSafely(() => engine.reply(expected, day, answer), LOCK_TEXT);
    updateNotice();
    if (outcome.ok && outcome.correct) { researchFresh = outcome.item.key; researchNotice = outcome.item.tag + ' 획득 · 요구에 맞는 보증이에요.'; }
    return outcome;
  } finally { submitting = false; }
}
async function equipItem(key, id) {
  if (submitting) return {ok: false, error: '처리 중입니다.'};
  submitting = true;
  try {
    const outcome = await commandSafely(() => engine.equip(key, id), LOCK_TEXT);
    updateNotice();
    if (outcome.ok) { researchFresh = ''; lobbyStale = true; cards.refresh(); }
    return outcome;
  } finally { submitting = false; }
}
function researchShow(focus = '#order-status') {
  show('research', false);
  researchNotice = '';
  main.querySelector(focus)?.focus({preventScroll: true});
}
// 철강 퀴즈. 시작과 결과 처리는 다른 저장 명령과 같은 잠금 안에서 실행한다. 풀이 중(답 고르기·다음 문제)은 저장을 쓰지 않는다.
// 결과 처리가 보상을 저장했으면 상단 칩과 공방 출하 버튼을 바로 고친다.
async function quizCommand(run) {
  if (submitting) return {ok: false, error: '처리 중입니다.'};
  submitting = true;
  try {
    const outcome = await commandSafely(run, LOCK_TEXT);
    updateNotice(outcome.ok ? '' : outcome.error);
    return outcome;
  } finally { submitting = false; }
}
// 브라우저는 한 번 실패한 모듈 주소를 기억해 같은 주소로는 다시 받지 않는다. 실패한 뒤의 재시도는 주소를 바꿔 새로 받는다.
let quizBankTries = 0;
async function loadQuizBank() {
  const url = './quiz.mjs' + (quizBankTries ? '?retry=' + quizBankTries : '');
  quizBankTries++;
  try { return engine.setQuizBank((await import(url)).QUIZ); }
  catch { return {ok: false, error: '퀴즈 문항을 읽지 못했어요. 연결을 확인하고 다시 시도해 주세요.'}; }
}
const quizChange = {
  start: () => quizCommand(() => engine.quizStart()),
  async next(id, index) {
    const outcome = await quizCommand(() => engine.quizNext(id, index));
    if (outcome.ok && outcome.session.phase === 'result' && outcome.session.rewardAllowed) { lobbyStale = true; hud(); tick(); }
    return outcome;
  }
};
const researchHandlers = {
  reply: replyOrder,
  async openQuiz() {
    // 문항을 불러오는 동안에는 tick이 안내서를 다시 그리지 않게 한다(다시 그리면 실패 문구를 쓸 자리가 사라진다).
    quizOpening = true;
    try {
      const outcome = await quizView.open();
      if (outcome.ok) history.pushState({view: 'research', quiz: true}, '', '#research');
      return outcome;
    } finally { quizOpening = false; }
  },
  // 현장 소식지: 열기만으로는 읽음이 바뀌지 않는다(회차를 열 때만). 기록을 하나 쌓아 뒤로 가기가 창을 닫게 한다.
  openToon(opener) {
    const outcome = toonView.open(opener);
    if (outcome.ok) history.pushState({view: 'research', toon: true}, '', '#research');
    return outcome;
  },
  openEquip(key) { history.pushState({view: 'research', equipKey: key}, '', '#research'); equipView.open(key); },
  openCard(id, opener) { const card = data.cards.find(c => c.id === id); if (card) openCard(card, opener); },
  get fresh() { return researchFresh; },
  // message: 문자열이면 그 문구로 다시 그리고(거절), null이면 방금 정답이라 이미 정해 둔 문구로 다시 그린다.
  refresh(message) { if (message !== null) researchNotice = message; researchShow(); },
  later() { researchFresh = ''; researchShow('#order-title'); }
};

function openCar(key) {
  history.pushState({view: 'garage', carKey: key}, '', '#garage');
  carView.open(key);
}

let suppressBack = false;
let closedByControl = false;
window.addEventListener('popstate', () => {
  if (!cards) return;
  if (closedByControl) { closedByControl = false; return; }
  if (opsView.isOpen()) {
    suppressBack = true;
    opsView.close();
    return;
  }
  const dialog = document.querySelector('#card-dialog');
  if (dialog.open) {
    suppressBack = true;
    cards.close();
    return;
  }
  if (parts.isOpen()) {
    suppressBack = true;
    parts.close();
    return;
  }
  if (carView.isOpen()) {
    suppressBack = true;
    carView.close();
    return;
  }
  if (equipView.isOpen()) {
    suppressBack = true;
    equipView.close();
    return;
  }
  if (toonView.isOpen()) {
    // 지면이면 목록으로(기록을 다시 쌓는다), 목록이면 닫는다.
    if (toonView.back()) history.pushState({view: 'research', toon: true}, '', '#research');
    else suppressBack = true;
    return;
  }
  if (quizView.isOpen()) {
    // 풀이 중이면 확인을 먼저 띄우고 기록을 다시 쌓는다. 끝났거나 풀기 전이면 닫는다.
    if (quizView.back()) history.pushState({view: 'research', quiz: true}, '', '#research');
    else suppressBack = true;
    return;
  }
  show();
  if (path() === 'research' && history.state?.equipKey) { equipView.open(history.state.equipKey); return; }
  if (path() === 'garage' && history.state?.carKey) { carView.open(history.state.carKey); return; }
  if (path() === 'crafting' && history.state?.partKey) { parts.open(history.state.partKey); return; }
  const detail = data.cards.find(c => c.id === history.state?.cardId);
  if (detail && engine.state().owned[detail.id]) cards.open(detail, main.querySelector('.tile-open'));
});
document.addEventListener('click', event => {
  if(event.target.closest('.skip-link')){event.preventDefault();main.focus({preventScroll:true});return;}
  const link = event.target.closest('a[data-nav]');
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    go(link.dataset.nav);
  }
});
document.querySelector('#sound').addEventListener('click', event => {
  const enabled = sound.toggle();
  event.currentTarget.setAttribute('aria-pressed', String(enabled));
  event.currentTarget.textContent = enabled ? '소리 켜짐' : '소리 꺼짐';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) sound.stop(); });
window.addEventListener('pagehide', () => { stopReveal(); sound.stop(); });
window.addEventListener('pageshow', event => { if (event.persisted && cards) show(); });

async function init() {
  const attempt = ++dataRequest;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('./data.json', {signal:controller.signal});
    if (!response.ok) throw new Error('자료 응답 오류');
    const next = await response.json();
    if (!next.cards?.length || !next.appearances?.length || !next.assets || !next.dialogue?.length) throw new Error('자료 누락');
    if (attempt !== dataRequest) return;
    data = next;
    // Storage access can throw before a Storage object is returned.
    const storage = {
      getItem(key) { return window.localStorage.getItem(key); },
      setItem(key, value) { window.localStorage.setItem(key, value); },
      removeItem(key) { window.localStorage.removeItem(key); }
    };
    engine = createEngine({storage});
    cards = createCardDialog(data, () => {
      if (lobbyStale && path() === 'workshop') show('workshop');
      if (suppressBack) { suppressBack = false; return; }
      if (history.state?.cardId) { closedByControl = true; history.back(); }
    }, {
      current: () => engine.featured(),
      items: id => engine.cardItems(id),
      set: id => {
        const outcome = engine.setFeatured(id);
        updateNotice(outcome.ok ? '' : outcome.error);
        if (outcome.ok) lobbyStale = true;
        return outcome.ok;
      }
    });
    parts = createPartDialog(data, engine, {craft: craftPart, onDismiss: key => {
      const back = !suppressBack && history.state?.partKey;
      suppressBack = false;
      if (back) { closedByControl = true; history.back(); }
      if (path() === 'crafting') {
        show('crafting', false);
        main.querySelector('[data-part-key="' + key + '"]')?.focus({preventScroll: true});
      }
    }});
    carView = createCarDialog(data, engine, {onDismiss: key => {
      const back = !suppressBack && history.state?.carKey;
      suppressBack = false;
      if (back) { closedByControl = true; history.back(); }
      if (path() === 'garage') {
        show('garage', false);
        main.querySelector('[data-car-key="' + key + '"]')?.focus({preventScroll: true});
      }
    }});
    equipView = createEquipDialog(data, engine, {equip: equipItem,
      // 동료 카드로 넘어갈 때는 장착 창의 기록을 지우고 카드 기록을 쌓는다(되돌아오면 연구 화면).
      openCard: id => { if (history.state?.equipKey) history.replaceState({view: 'research'}, '', '#research'); researchHandlers.openCard(id); },
      onDismiss: key => {
        const back = !suppressBack && history.state?.equipKey;
        suppressBack = false;
        if (back) { closedByControl = true; history.back(); }
        if (path() === 'research') {
          show('research', false);
          (main.querySelector('[data-equip-open="' + key + '"]') || main.querySelector('[data-warranty-key="' + key + '"]') || main.querySelector('#order-title'))?.focus({preventScroll: true});
        }
      }});
    quizView = createQuizDialog(engine, {
      loadBank: loadQuizBank,
      openCard: (id, opener) => researchHandlers.openCard(id, opener),
      goDex() {
        // 퀴즈를 끝내고 소재 도감으로. 퀴즈 기록을 먼저 지워 닫기에서 뒤로 가기가 일어나지 않게 한다.
        if (history.state?.quiz) history.replaceState({view: 'research'}, '', '#research');
        quizView.close();
        go('collection');
      },
      onChange: quizChange,
      onDismiss() {
        const back = !suppressBack && history.state?.quiz;
        suppressBack = false;
        if (back) { closedByControl = true; history.back(); }
        if (path() === 'research') {
          show('research', false);
          // 닫힌 창이 열어 준 쪽(이미 지워진 옛 버튼)으로 초점을 돌려주는 시점이 브라우저마다 달라서(WebKit은 close 이벤트 뒤), 새 버튼에 한 번 더 맞춘다.
          const focusStart = () => { const start = main.querySelector('#quiz-start'); if (start && document.activeElement !== start) start.focus({preventScroll: true}); };
          focusStart();
          setTimeout(focusStart, 0);
        }
      }});
    toonView = createToonDialog(engine, {
      onChange: toonChanged,
      onDismiss(opener) {
        const back = !suppressBack && history.state?.toon;
        suppressBack = false;
        if (back) { closedByControl = true; history.back(); }
        if (path() === 'research') {
          show('research', false);
          const focusOpen = () => { const open = main.querySelector('#toon-open'); if (open && document.activeElement !== open) open.focus({preventScroll: true}); };
          focusOpen();
          setTimeout(focusOpen, 0);
        }
      }});
    opsBand = createOps(document.querySelector('#ops'), document.querySelector('#ops-bell'), {openOps: kind => openOps(kind, {due: engine.ops().pending[kind] === true, from: document.activeElement}), toggleBell});
    opsView = createOpsDialog({onDismiss(info) {
      const back = !suppressBack && history.state?.ops;
      suppressBack = false;
      if (back) { closedByControl = true; history.back(); }
      recordClose(info);
    }});
    toast = createToast(() => main.focus({preventScroll: true}));
    archiveRow = createArchiveRow(document.querySelector('#archive-row'), {open: openArchive});
    // 8단계: 홈 화면 설치 줄(공방 맨 아래, 시안 A안)과 서비스 워커·새 버전 안내.
    createInstall(document.querySelector('#install-row'), {icon: data.assets['icon:192'].image});
    startPwa({busy: () => !!document.querySelector('dialog[open]') || submitting || !!cancelReveal || engine.status().holding});
    archiveView = createArchiveDialog(engine, {
      onChange: archiveChanged,
      onDismiss(back) {
        // 복원·초기화 뒤에는 지금 화면을 새 진행으로 다시 그린다(초점은 아래에서 돌려준다).
        if (lobbyStale) show(path(), false);
        lobbyStale = false;
        const target = back && back.isConnected ? back : document.querySelector('#archive-open');
        const focusBack = () => { if (target && document.activeElement !== target) target.focus({preventScroll: true}); };
        focusBack(); setTimeout(focusBack, 0);
        flushToast();
      }});
    // 빈 local이면 IndexedDB 사본을 확인한다(원본 bootRestore). 확인하는 동안(최대 2.5초) 명령은 "저장 사본을 확인 중입니다"로 거절된다.
    engine.boot().then(({restored, warning: bootWarning}) => {
      if (attempt !== dataRequest) return;
      if (restored) {
        toastNow(bootWarning ? '사본에서 이 창의 진행을 복구했지만 기기 저장은 확인하지 못했습니다. 백업 코드를 보관해 주세요.' : '이 기기의 저장소가 비어 있어 사본에서 되살렸습니다. 백업 코드를 받아 두세요.', '진행을 복구했습니다');
        archiveView.refresh();
        if (!document.querySelector('dialog[open]')) show(path(), false); else lobbyStale = true;
      } else { hud(); updateNotice(); renderArchiveRow(); }
    });
    for (const slot of document.querySelectorAll('[data-ico]')) { const img = decor(slot.dataset.ico); if (img) slot.replaceChildren(img); }
    history.replaceState({view:path()}, '', '#' + path());
    show(path(), false);
  } catch {
    if (attempt !== dataRequest) return;
    const panel = el('section', 'load-error');
    panel.setAttribute('role', 'alert');
    panel.append(el('h1', '', '공방을 열지 못했습니다'), el('p', '', '게임 자료를 불러올 수 없습니다. 연결을 확인하고 다시 시도해 주세요.'), button('다시 시도', 'primary', init));
    main.replaceChildren(panel);
  } finally { clearTimeout(timeout); }
}
// 다른 탭에서 웹툰 읽음 키(sgg_game_toon_seen)가 바뀌면 점과 소식지 줄·열려 있는 목록을 다시 맞춘다. 진행 저장은 건드리지 않는다.
window.addEventListener('storage', event => {
  if (!engine || (event.key !== null && event.key !== 'sgg_game_toon_seen')) return;
  toonChanged();
  toonView?.refresh();
});
init();
import './pages-scope.mjs';
