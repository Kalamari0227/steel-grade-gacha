import {createEngine} from './engine.mjs';
import {shipSafely} from './shipments.mjs';
import {button, el} from './ui.mjs';
import {createCardDialog} from './card.mjs';
import {createSound, reveal} from './reveal.mjs';
import {workshop, results, collection, placeholder, PLACEHOLDER_VIEWS} from './views.mjs';
import {heroReveal} from './hero.mjs';

const main = document.querySelector('#main');
const sound = createSound();
let data, engine, cards, cancelReveal, submitting = false;
let dataRequest = 0;

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
  return ['results','collection',...PLACEHOLDER_VIEWS].includes(value) ? value : 'workshop';
}
function navState(view) {
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === 'results') link.hidden = !engine.state().results;
    if (link.dataset.nav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
function stopReveal() {
  cancelReveal?.();
  cancelReveal = null;
}
function show(view = path(), focus = true) {
  stopReveal();
  navState(view);
  updateNotice();
  const state = engine.state();
  if (view === 'results' && state.results) main.replaceChildren(results(data, state.results, engine.nextGoal(), openCard, go, playResult));
  else if (view === 'collection') main.replaceChildren(collection(data, state, openCard, {status: engine.qpStatus(), develop}));
  else if (PLACEHOLDER_VIEWS.includes(view)) main.replaceChildren(placeholder(view, go));
  else {
    if (view !== 'workshop') return go('workshop', true);
    main.replaceChildren(workshop(data, engine, ship, go, refill));
  }
  document.title = main.querySelector('h1').textContent + ' · 스틸 컴패니언';
  if (focus) { main.focus({preventScroll: true}); window.scrollTo(0, 0); }
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
  window.scrollTo(0, 0);
  cancelReveal = reveal(main, data, result, () => show('results'), sound);
}
function refill() {
  if (submitting) return;
  const outcome = engine.refill();
  updateNotice(outcome.ok ? '' : outcome.error);
  show('workshop', false);
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
      if (suppressBack) { suppressBack = false; return; }
      if (history.state?.cardId) { closedByControl = true; history.back(); }
    });
    document.querySelector('#backup').hidden = false;
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
