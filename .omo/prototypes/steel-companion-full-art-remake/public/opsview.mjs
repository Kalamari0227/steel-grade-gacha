import {button, el, micro} from './ui.mjs';

// 5단계 운영 요소: 공방 위의 공지·행사 띠(게시 공문), 안내 창, 출하 알림 줄, 토스트.
// 글은 모두 엔진(원본 NOTICES·PROMOS)이 준 값이다. 이 파일은 그리기만 하며 저장을 바꾸지 않는다(기록은 app.mjs가 엔진 명령으로 한다).
const p2 = n => (n < 10 ? '0' : '') + n;
// 원본 행사 시각은 한국시간 00시를 UTC로 적은 값이다. 기기 시간대와 상관없이 한국시간으로 적는다(원본 promoWhen은 기기 시간대를 따른다).
export const kstWhen = ts => {
  const d = new Date(ts + 9 * 3600000);
  return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
};
export const kstRange = (from, to) => kstWhen(from) + ' ~ ' + kstWhen(to) + ' (한국 시간)';
const docNo = key => key.slice(5);

// 공지 본문의 <b>·<br>만 요소로 만든다(innerHTML을 쓰지 않는다). qa/stage5.test.mjs가 자료 전체의 태그가 이 둘뿐인지 본다.
export function richText(parent, text) {
  let bold = null;
  for (const part of String(text).split(/(<\/?b>|<br>)/)) {
    if (part === '<b>') { bold = el('b'); continue; }
    if (part === '</b>') { if (bold) parent.append(bold); bold = null; continue; }
    if (part === '<br>') { (bold || parent).append(document.createElement('br')); continue; }
    if (part === '') continue;
    (bold || parent).append(document.createTextNode(part));
  }
  if (bold) parent.append(bold);
  return parent;
}

// 띠에 쓸 한 줄. 공지와 행사가 함께 걸리면 행사 내용은 공지 띠에 싣는다(원본 renderPromo와 같다: 띠는 하나).
export function bandModel(o) {
  const {notice: n, promo: p} = o, next = p.next ? ' · 이어서 ' + p.next.name : '';
  if (n.state === 'on') return {kind: 'notice', no: '공고 ' + docNo(n.key), title: n.title, sub: p.status === 'on' ? p.summary + ' · 남은 시간 ' + p.leftText + next : n.lead, go: '자세히 보기', open: 'notice'};
  if (p.status === 'on') return {kind: 'promo', no: '공고 ' + docNo(p.key), title: p.name + ' 진행 중', sub: p.summary + ' · 남은 시간 ' + p.leftText + next, go: '자세히 보기', open: 'promo'};
  if (p.status === 'soon') return {kind: 'soon', no: '공고 ' + docNo(p.key), title: p.name + ' 예고', sub: kstWhen(p.from) + ' 시작 · ' + p.inText + ' 뒤', go: '자세히 보기', open: 'promo'};
  return {kind: 'none', no: '공고 없음', title: '진행 중인 행사가 없습니다', sub: '새 공고가 나오면 여기에 붙습니다.', go: '지난 공지', open: 'past'};
}

// 알림 줄의 상태 문구와 버튼. 지원하지 않거나 막혀 있으면 켜진 것처럼 보이지 않는다.
export function bellModel(b) {
  if (!b.supported) return {state: '없음', text: '이 브라우저는 출하 알림을 지원하지 않습니다. 출하 시각은 공방에서 확인하세요.', go: ''};
  if (b.permission === 'denied') return {state: '차단됨', text: '브라우저에서 알림이 막혀 있습니다. 브라우저 사이트 설정에서 허용해 주세요.', go: ''};
  if (b.on) return {state: '켜짐', text: (!b.nextText ? (b.pullReady ? '지금 출하할 수 있습니다.' : '다음 출하부터 알려 드립니다.') : b.nextText + '에 알려 드립니다.') + ' 이 창이 열려 있을 때만 울립니다.', go: '끄기'};
  return {state: '꺼짐', text: '출하가 열리면 알려 드립니다. 이 창이 열려 있을 때만 울립니다.', go: '켜기'};
}

// root: 공방 위의 띠(진행 중인 공지·행사가 있을 때만 보임). bellRoot: 출하 버튼 아래의 알림 줄(검토 지적 ①: 띠와 알림 줄이 출하 버튼을 첫 화면 밖으로 밀었다).
export function createOps(root, bellRoot, {openOps, toggleBell}) {
  const band = el('div', 'ops-band');
  const no = el('span', 'ops-no'), title = el('span', 'ops-t'), sub = el('span', 'ops-s');
  no.setAttribute('aria-hidden', 'true');
  const go = button('', 'ops-go', () => openOps(go.dataset.open));
  band.append(no, title, sub, go);
  const row = el('div', 'ops-bell');
  const label = el('span', 'ops-bl'), state = el('span', 'ops-sw'), note = el('p', 'ops-bs');
  note.id = 'ops-bell-note';
  note.tabIndex = -1;
  note.setAttribute('role', 'status');
  const toggle = button('', 'ops-bgo', toggleBell);
  label.append(micro('BELL'), '출하 알림');
  const head = el('span', 'ops-bh');
  head.append(label, state);
  row.append(head, note, toggle);
  root.replaceChildren(band);
  bellRoot.replaceChildren(row);
  const set = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  let message = '';
  return {
    // 값이 바뀐 글자만 고친다(다시 그리지 않으므로 초점이 유지된다). message는 방금 한 조작의 결과 문구라 다음 조작 전까지 남는다.
    render(o) {
      const m = bandModel(o);
      band.dataset.kind = m.kind;
      root.hidden = m.kind === 'none';
      // 공방은 화면 높이를 채우도록 최소 높이가 잡혀 있어, 띠가 보이면 그 높이만큼 출하 버튼이 밀린다. 띠 높이를 재서 공방이 그만큼 줄게 한다(prototype.css 5단계 블록의 --ops-h).
      const box = root.hidden ? 0 : Math.ceil(root.getBoundingClientRect().height + (parseFloat(getComputedStyle(root).marginBottom) || 0));
      const value = box + 'px';
      if (document.documentElement.style.getPropertyValue('--ops-h') !== value) document.documentElement.style.setProperty('--ops-h', value);
      set(no, m.no); set(title, m.title); set(sub, m.sub); set(go, m.go);
      go.dataset.open = m.open;
      const b = bellModel(o.bell);
      set(state, b.state);
      state.dataset.state = b.state;
      set(note, message || b.text);
      set(toggle, b.go);
      toggle.hidden = !b.go;
      toggle.setAttribute('aria-label', b.go ? '출하 알림 ' + b.go : '');
    },
    say(text) { message = text; },
    focusNote() { note.focus({preventScroll: true}); },
    toggle
  };
}

// 안내 창: 공지(항목 목록 + 진행 중인 행사)와 행사 안내(기간·혜택 표). 위층 창이라 뒤의 버튼은 눌리지 않는다.
export function createOpsDialog({onDismiss}) {
  const dialog = document.querySelector('#ops-dialog');
  let info = null, opener = null;
  dialog.addEventListener('close', () => {
    const closed = info, from = opener;
    info = null; opener = null;
    dialog.replaceChildren();
    // 열기 전 위치로 초점을 돌려준다. WebKit은 close 이벤트 뒤에 돌려주는 시점이 달라 한 번 더 맞춘다.
    const back = () => { if (from && from.isConnected && !document.querySelector('dialog[open]') && document.activeElement !== from) from.focus({preventScroll: true}); };
    back();
    setTimeout(back, 0);
    if (closed) onDismiss(closed);
  });
  function noticeBody(o, past) {
    const n = o.notice, frag = [];
    frag.push(el('p', 'detail-rank', past ? '지난 공지' : n.state === 'soon' ? '예정된 공지' : '공지사항'));
    const h = el('h2', '', n.title); h.id = 'ops-title'; h.tabIndex = -1;
    frag.push(h, richText(el('p', 'ops-lead'), n.lead));
    const list = el('ol', 'ops-list');
    for (const it of n.items) {
      const li = el('li'); li.append(el('b', '', it.h)); li.append(richText(el('p'), it.p)); list.append(li);
    }
    frag.push(list);
    if (!past && (o.promo.status === 'on' || o.promo.status === 'soon')) frag.push(promoBox(o, true));
    return frag;
  }
  function promoBox(o, nested) {
    const p = o.promo, box = el('section', 'ops-event');
    box.append(el('span', 'ops-el', p.status === 'on' ? '진행 중' : '예정'), el(nested ? 'h3' : 'h2', '', p.name));
    if (!nested) { box.querySelector('h2').id = 'ops-title'; box.querySelector('h2').tabIndex = -1; }
    box.append(el('p', '', p.why));
    const rows = el('dl', 'ops-terms');
    rows.append(el('dt', '', '기간'), el('dd', '', kstRange(p.from, p.to)));
    for (const r of p.rows) { rows.append(el('dt', '', r.k)); const dd = el('dd'); dd.append(el('i', '', r.was + ' → '), r.now); rows.append(dd); }
    box.append(rows);
    box.append(el('p', 'ops-when', p.status === 'on' ? '남은 시간 ' + p.leftText + ' · 기간이 끝나면 저절로 평소대로 돌아갑니다.' : '아직 시작하지 않았습니다. 시작하면 저절로 적용됩니다.'));
    return box;
  }
  return {
    // kind: 'notice' | 'promo' | 'past'. due는 아직 확인하지 않은 안내라 닫을 때 기록한다.
    open(o, kind, {due = false, from = null} = {}) {
      info = {kind, key: kind === 'promo' ? o.promo.key : o.notice.key, due};
      opener = from || document.activeElement;
      const close = button('닫기', 'close-button', () => dialog.close());
      const head = el('div', 'dialog-head');
      const lab = el('span', 'dialog-label');
      lab.append(micro('NOTICE ' + info.key), '공고');
      head.append(lab, close);
      const body = el('section', 'ops-sheet');
      body.append(...(kind === 'promo' ? [el('p', 'detail-rank', o.promo.status === 'on' ? '진행 중인 안내' : '예정된 안내'), promoBox(o, false)] : noticeBody(o, kind === 'past')));
      const ok = button('확인', 'ops-ok', () => dialog.close());
      ok.id = 'ops-ok';
      dialog.replaceChildren(head, body, ok);
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector('#ops-title')?.focus({preventScroll: true});
    },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}

// 토스트: 12초 뒤 닫힌다. 초점이 안에 있으면 닫지 않는다(원본 showToast). 위층 창이 열려 있으면 app.mjs가 기다렸다가 띄운다.
export function createToast(returnFocus) {
  const root = document.querySelector('#toast');
  const title = el('b'), sub = el('span', 'toast-sub');
  const x = button('닫기', 'toast-x', () => hide(true));
  x.setAttribute('aria-label', '알림 닫기');
  const text = el('span', 'toast-text');
  text.append(title, sub);
  root.replaceChildren(text, x);
  let timer = 0;
  function hide(force) {
    clearTimeout(timer);
    if (!force && root.contains(document.activeElement)) return;
    const had = root.contains(document.activeElement);
    root.hidden = true;
    if (had) returnFocus();
  }
  return {
    show(msg, head) {
      title.textContent = head; sub.textContent = msg || '';
      root.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => hide(false), 12000);
    },
    isOpen: () => !root.hidden
  };
}
