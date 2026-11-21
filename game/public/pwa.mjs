import {button, el} from './ui.mjs';

// 8단계 서비스 워커 등록과 새 버전 안내(원본 GAME_PWA의 흐름과 문구).
// 새 버전은 저절로 바꾸지 않는다: 준비되면 아래쪽 안내에 [새 버전 적용]을 보이고, 누르면 진행 중인 작업이 없고 이 창 하나만 열려 있을 때 바꾼 뒤 새로고침한다.
export function startPwa({busy}) {
  const note = document.querySelector('#update');
  if (!note || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const text = el('span', 'update-text');
  const apply = button('새 버전 적용', 'secondary', onApply);
  apply.id = 'update-apply';
  note.replaceChildren(text, apply);
  let registration = null, requested = false, refused = false;
  let previous = navigator.serviceWorker.controller;
  function refresh() {
    const available = !!(registration && registration.waiting && navigator.serviceWorker.controller);
    note.hidden = !available;
    if (!available) return;
    const message = refused ? '다른 창을 닫은 뒤 다시 눌러 주세요.' : busy() ? '진행 중인 작업을 마친 뒤 업데이트할 수 있습니다.' : '새 버전이 준비되었습니다. 원할 때 적용해 주세요.';
    if (text.textContent !== message) text.textContent = message;
  }
  function onApply() {
    refused = false;
    if (busy() || !registration || !registration.waiting) { refresh(); return; }
    requested = true;
    registration.waiting.postMessage({type: 'SC_ACTIVATE'});
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SC_UPDATE_BUSY') { requested = false; refused = true; refresh(); }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const had = !!previous; previous = navigator.serviceWorker.controller;
    if (requested) { requested = false; location.reload(); }
    else if (had) refresh();
  });
  // 서비스 워커가 이 화면을 맡게 되면, 그 전에 이미 받은 그림 목록을 넘겨 저장하게 한다(첫 방문에 본 그림도 오프라인에서 보이게).
  function seen() {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    const urls = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => /\/(art|webtoon)\//.test(u)))];
    if (urls.length) worker.postMessage({type: 'SC_SEEN', urls});
  }
  navigator.serviceWorker.addEventListener('controllerchange', seen);
  navigator.serviceWorker.ready.then(() => setTimeout(seen, 0));
  navigator.serviceWorker.register('sw.mjs', {updateViaCache: 'none'}).then(reg => {
    registration = reg; refresh();
    reg.addEventListener('updatefound', () => { reg.installing?.addEventListener('statechange', refresh); });
  }).catch(() => { /* 등록 실패: 웹으로 계속 쓸 수 있다 */ });
  setInterval(refresh, 1000);
}
