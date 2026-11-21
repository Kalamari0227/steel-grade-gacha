import {button, el, micro} from './ui.mjs';

// 현장 소식지(웹툰): 연구 탭에서 여는 위층 창. 목록(목차) → 회차 지면. 읽음 표시는 엔진(engine.toon·toonOpen)이 한다.
// 글은 모두 textContent로만 그린다(innerHTML 없음). 그림은 승인 범주 webtoon의 18장이며 w·h 비율로 자리를 먼저 잡고 늦게 불러온다.
export function createToonDialog(engine, {onChange, onDismiss}) {
  const dialog = document.querySelector('#toon-dialog');
  let mode = 'list', current = -1, opener = null, retrySerial = 0;
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    const back = opener; mode = 'list'; current = -1; opener = null;
    onDismiss(back);
  });
  // Esc: 지면이면 목록으로, 목록이면 닫는다.
  dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
  function back() {
    if (mode === 'view') { showList(current); return true; }
    dialog.close(); return false;
  }
  function frame(label, title) {
    const close = button('닫기', 'close-button', () => dialog.close());
    const head = el('div', 'dialog-head');
    const tag = el('span', 'dialog-label');
    tag.append(micro(label), title);
    head.append(tag, close);
    return head;
  }
  function stamp() { return el('span', 'toon-stamp', 'NEW'); }
  function showList(focusIndex = -1, quiet = false) {
    mode = 'list'; current = -1;
    const view = engine.toon();
    const sheet = el('section', 'toon-sheet');
    const title = el('h2', 'toon-title', '현장 소식지');
    title.id = 'toon-list-title'; title.tabIndex = -1;
    sheet.setAttribute('aria-labelledby', title.id);
    sheet.append(micro('SITE BULLETIN'), title, el('p', 'toon-meta', '철강 현장의 사보예요 · 4컷 웹툰이 연재돼요'));
    const list = el('ol', 'toon-toc');
    // 노랑(primary)은 이 화면의 한 곳: 가장 앞선 안 읽은 회차의 읽기 버튼.
    const next = view.seenIdx + 1;
    for (const t of view.episodes) {
      const row = el('li', 'toon-row');
      row.dataset.toonId = t.id; row.dataset.seen = String(t.seen);
      const info = el('div', 'toon-info');
      const name = el('span', 'toon-name', t.title);
      info.append(name);
      if (t.isNew) { info.append(' '); info.append(stamp()); }
      info.append(el('span', 'toon-date num', t.date));
      const go = button('읽기', t.index === next ? 'primary' : 'secondary', () => showView(t.index));
      go.setAttribute('aria-label', t.no + ' ' + t.title + ' 읽기' + (t.isNew ? ', 새 회차' : ''));
      go.dataset.toonOpen = t.id;
      row.append(el('span', 'toon-no num', t.no), info, go);
      list.append(row);
    }
    sheet.append(list);
    dialog.replaceChildren(frame('SITE BULLETIN', '현장 소식지'), sheet);
    dialog.scrollTop = 0;
    if (quiet) return;
    (focusIndex >= 0 ? dialog.querySelector('[data-toon-open="' + view.episodes[focusIndex].id + '"]') : title)?.focus({preventScroll: true});
  }
  // 그림 한 쪽: w·h 비율의 자리를 먼저 잡고, 불러오는 중·실패·다시 시도를 칸 안에서 보여 준다.
  function page(t, p, k, eager) {
    const fig = el('figure', 'toon-page');
    const box = el('div', 'toon-frame');
    box.style.aspectRatio = p.w + ' / ' + p.h;
    const img = el('img');
    img.width = p.w; img.height = p.h; img.alt = t.no + ' ' + t.title + ' ' + (k + 1) + '쪽';
    img.decoding = 'async'; img.loading = eager ? 'eager' : 'lazy'; img.draggable = false;
    const status = el('p', 'toon-status'); status.setAttribute('role', 'status');
    const retry = button('그림 다시 불러오기', 'secondary', () => { retrySerial++; set('loading'); img.src = p.img + '?retry=' + retrySerial; });
    retry.hidden = true;
    function set(state) {
      if (!fig.isConnected && state !== 'loading') return;
      fig.dataset.state = state;
      retry.hidden = state !== 'error';
      status.hidden = state === 'ready';
      status.textContent = state === 'error' ? '그림을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.' : state === 'loading' ? '그림 불러오는 중…' : '';
    }
    img.addEventListener('load', () => set('ready'));
    img.addEventListener('error', () => set('error'));
    set('loading'); img.src = p.img;
    box.append(img, status, retry);
    fig.append(box);
    if (p.cap) { const cap = el('figcaption', 'toon-cap'); cap.append(el('b', '', p.cap[0]), ' ', p.cap[1]); fig.append(cap); }
    return fig;
  }
  function showView(index) {
    const res = engine.toonOpen(index);  // 여는 순간 이 회차까지 읽음(원본과 같다). 저장이 안 돼도 조용히 넘어간다.
    if (!res.ok) return;
    mode = 'view'; current = index;
    const view = engine.toon(), t = view.episodes[index];
    const sheet = el('section', 'toon-sheet toon-issue');
    const title = el('h2', 'toon-title', t.no + ' · ' + t.title);
    title.id = 'toon-view-title'; title.tabIndex = -1;
    sheet.setAttribute('aria-labelledby', title.id);
    sheet.append(micro(t.id === 's00' ? 'CREATION NOTICE' : 'ISSUE ' + String(index).padStart(2, '0')), title, el('p', 'toon-meta num', t.date));
    if (t.lead) { const lead = el('div', 'toon-lead'); lead.append(el('b', '', t.lead[0]), el('p', '', t.lead[1])); sheet.append(lead); }
    t.pages.forEach((p, k) => sheet.append(page(t, p, k, k === 0)));
    if (t.note) sheet.append(el('p', 'toon-note-line', t.note));
    const nav = el('div', 'toon-nav');
    const prev = button('‹ 이전 화', 'secondary', () => showView(index - 1)); prev.disabled = index === 0;
    const list = button('목록', 'secondary', () => showList(index));
    const next = button('다음 화 ›', 'primary', () => showView(index + 1)); next.disabled = index === view.episodes.length - 1;
    if (next.disabled) next.className = 'secondary';
    nav.append(prev, list, next);
    sheet.append(nav);
    dialog.replaceChildren(frame(t.id === 's00' ? 'CREATION NOTICE' : 'ISSUE ' + String(index).padStart(2, '0'), t.no + ' · ' + t.title), sheet);
    dialog.scrollTop = 0;
    title.focus({preventScroll: true});
    onChange();
  }
  return {
    open(from) {
      if (dialog.open) return {ok: false};
      opener = from || document.activeElement;
      showList();
      dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector('#toon-list-title')?.focus({preventScroll: true});
      return {ok: true};
    },
    // 뒤로 가기: 지면이면 목록으로(기록을 다시 쌓아야 하면 true), 목록이면 닫는다.
    back,
    // 다른 탭에서 읽음이 바뀌었을 때 목록이 열려 있으면 다시 그린다(지면은 그대로 둔다).
    refresh() { if (dialog.open && mode === 'list') { const top = dialog.scrollTop, at = document.activeElement?.dataset?.toonOpen; showList(-1, true); dialog.scrollTop = top; if (at) dialog.querySelector('[data-toon-open="' + at + '"]')?.focus({preventScroll: true}); } },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
