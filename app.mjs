import {createEngine} from './engine.mjs';
import {shipSafely} from './shipments.mjs';
import {button, el} from './ui.mjs';
import {createCardDialog} from './card.mjs';
import {createSound, reveal} from './reveal.mjs';
import {lobby, shipyard, results, collection, placeholder, PLACEHOLDER_VIEWS} from './views.mjs';
import {heroReveal} from './hero.mjs';

const main = document.querySelector('#main');
const scroller = document.querySelector('#scroller');
const backdrop = document.querySelector('#backdrop');
const hudRes = document.querySelector('#hud-res');
const sound = createSound();
let data, engine, cards, cancelReveal, submitting = false;
let dataRequest = 0;
let lobbyStale = false;

function updateNotice(error = '') {
  const warning = document.querySelector('#warning');
  const message = error || engine.status().warning;
  warning.replaceChildren();
  warning.hidden = !message;
  if (message) {
    const alert = el('p', '', message);
    alert.setAttribute('role', 'alert');
    warning.append(alert, button('진행 백업 받기', 'secondary', backup));
  }
}
function backup() {
  const blob = new Blob([engine.backup()], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '스틸-컴패니언-체험판-백업.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function path() {
  const value = location.hash.slice(1);
  return ['ship','results','collection',...PLACEHOLDER_VIEWS].includes(value) ? value : 'workshop';
}
function navState(view) {
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === 'results') link.hidden = !engine.state().results;
    if (link.dataset.nav === (view === 'ship' ? 'workshop' : view)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
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
function chip(kind, label, value) {
  const box = el('span', 'chip ' + kind);
  const icon = el('span', 'chip-ico');
  icon.setAttribute('aria-hidden', 'true');
  if (kind === 'ship') { const img = decor('draw:coil-pack'); if (img) icon.append(img); }
  box.append(icon, el('span', 'sr', label + ' '), el('b', '', String(value)));
  box.title = label;
  return box;
}
function hud() {
  const state = engine.state(), status = engine.status();
  hudRes.replaceChildren(chip('ship', '남은 출하', status.singleLeft), chip('scrap', '스크랩', state.scrap));
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
  const state = engine.state();
  if (view === 'results' && state.results) main.replaceChildren(results(data, state.results, engine.nextGoal(), openCard, go, playResult));
  else if (view === 'collection') main.replaceChildren(collection(data, state, openCard, {status: engine.qpStatus(), develop}));
  else if (PLACEHOLDER_VIEWS.includes(view)) main.replaceChildren(placeholder(view, go));
  else if (view === 'ship') main.replaceChildren(shipyard(data, engine, ship, go, refill));
  else {
    if (view !== 'workshop') return go('workshop', true);
    lobbyStale = false;
    main.replaceChildren(lobby(data, engine, go, openCard));
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
function refill() {
  if (submitting) return;
  const outcome = engine.refill();
  updateNotice(outcome.ok ? '' : outcome.error);
  show(path(), false);
  main.querySelector('.trial-refill')?.focus({preventScroll: true});
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
async function ship(count) {
  if (submitting) return;
  submitting = true;
  try {
    const outcome = await shipSafely(engine,count);
    if (!outcome.ok) { show(); updateNotice(outcome.error); return; }
    history.pushState({view:'results'}, '', '#results');
    navState('results');
    setBackdrop('results');
    hud();
    updateNotice();
    playResult(outcome.result);
  } finally { submitting = false; }
}

let suppressBack = false;
let closedByControl = false;
window.addEventListener('popstate', () => {
  if (!cards) return;
  if (closedByControl) { closedByControl = false; return; }
  const dialog = document.querySelector('#card-dialog');
  if (dialog.open) {
    suppressBack = true;
    cards.close();
    return;
  }
  show();
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
document.querySelector('#backup').addEventListener('click', backup);
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
      setItem(key, value) { window.localStorage.setItem(key, value); }
    };
    engine = createEngine({storage});
    cards = createCardDialog(data, () => {
      if (lobbyStale && path() === 'workshop') show('workshop');
      if (suppressBack) { suppressBack = false; return; }
      if (history.state?.cardId) { closedByControl = true; history.back(); }
    }, {
      current: () => engine.featured(),
      set: id => {
        const outcome = engine.setFeatured(id);
        updateNotice(outcome.ok ? '' : outcome.error);
        if (outcome.ok) lobbyStale = true;
        return outcome.ok;
      }
    });
    document.querySelector('#backup').hidden = false;
    for (const slot of document.querySelectorAll('[data-ico]')) { const img = decor(slot.dataset.ico); if (img) slot.replaceChildren(img); }
    history.replaceState({view:path()}, '', '#' + path());
    show(path(), false);
  } catch {
    if (attempt !== dataRequest) return;
    const panel = el('section', 'load-error');
    panel.setAttribute('role', 'alert');
    panel.append(el('h1', '', '공방을 열지 못했습니다'), el('p', '', '체험 자료를 불러올 수 없습니다. 연결을 확인하고 다시 시도해 주세요.'), button('다시 시도', 'primary', init));
    main.replaceChildren(panel);
  } finally { clearTimeout(timeout); }
}
init();
import './pages-scope.mjs';
