import {button, el, micro} from './ui.mjs';

// 8단계 홈 화면 설치(2026-11-20, 시안 U0 A안): 공방 맨 아래 "홈 화면에 설치" 줄과 안내 창.
// 판별·문구·흐름은 원본 pwa_body.txt(설치 띠)를 따른다. 원본과 다른 것: 저절로 뜨는 띠가 없고 줄에서만 연다(닫음 기록 sgg_game_install_dismissed는 쓰지 않는다).
// 글은 textContent로만 그린다(innerHTML 없음). 굵은 글은 <b> 요소로 만든다.
const DONE = 'sgg_game_installed';
const flag = k => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const mark = k => { try { localStorage.setItem(k, '1'); } catch { /* 저장소를 못 쓰면 표시만 하지 않는다 */ } };

// 원본과 같은 판별. 아이패드 사파리는 맥인 척하므로 터치 여부로 가린다.
export function detect(nav = navigator, win = window) {
  const ua = nav.userAgent || '';
  let standalone = false;
  try { standalone = win.matchMedia('(display-mode: standalone)').matches || nav.standalone === true; } catch { /* 지원 안 함 */ }
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inApp = /KAKAOTALK|Teams|MSTeams|NAVER|Line\/|band|DaumApps|Instagram|FB_IAB|FBAN|FBAV|everytime/i.test(ua);
  const iosOther = isIOS && /CriOS|FxiOS|EdgiOS|Whale/i.test(ua);
  return {standalone, isIOS, isAndroid, inApp, iosOther};
}

// 문장 조각: 문자열은 글자, ['b', 글]은 굵게.
function line(tag, cls, parts) {
  const node = el(tag, cls);
  for (const part of parts) node.append(Array.isArray(part) ? el('b', '', part[1]) : part);
  return node;
}
function steps(items) {
  const ol = el('ol', 'install-steps');
  for (const parts of items) ol.append(line('li', '', parts));
  return ol;
}
function iosGuide(env) {
  const out = [];
  if (env.iosOther) out.push(line('p', 'install-warn', ['지금 사파리가 아닌 브라우저입니다. ', ['b', '사파리'], '로 열면 가장 확실합니다.']));
  out.push(line('p', 'install-for', [['b', '아이폰 · 아이패드 (사파리)']]),
    steps([['화면 아래 ', ['b', '공유 버튼'], '(네모에 위쪽 화살표)을 누릅니다. 안 보이면 ', ['b', '⋯'], '를 먼저 누릅니다.'],
      ['목록을 내려 ', ['b', '홈 화면에 추가'], '를 누릅니다.'], ['오른쪽 위 ', ['b', '추가'], '를 누르면 끝입니다.']]));
  return out;
}
function androidGuide(canPrompt) {
  if (canPrompt) return [line('p', 'install-for', [['b', '안드로이드']]),
    steps([['위의 ', ['b', '설치'], ' 버튼을 누릅니다.'], ['뜨는 창에서 ', ['b', '설치'], '를 한 번 더 누르면 홈 화면에 아이콘이 생깁니다.']])];
  return [line('p', 'install-for', [['b', '안드로이드 (크롬)']]),
    steps([['오른쪽 위 ', ['b', '메뉴(⋮)'], '를 누릅니다.'], [['b', '앱 설치'], ' 또는 ', ['b', '홈 화면에 추가'], '를 누릅니다.'], [['b', '설치'], '를 누르면 홈 화면에 아이콘이 생깁니다.']]),
    line('p', '', [['b', '삼성 인터넷'], ' — 아래 ', ['b', '메뉴(≡)'], ' → ', ['b', '현재 페이지 추가'], ' → ', ['b', '홈 화면']]),
    el('p', 'install-tip', '메뉴에 설치 항목이 없으면 페이지를 한 번 새로 고친 뒤 다시 열어 보세요.')];
}
function pcGuide() {
  return [line('p', 'install-for', [['b', '컴퓨터 (크롬 · 엣지)']]),
    steps([['주소창 오른쪽 끝의 ', ['b', '설치 아이콘'], '을 누릅니다.'], ['없으면 메뉴(⋮ 또는 ⋯) → ', ['b', '앱 설치'], '를 누릅니다.']])];
}
function inAppGuide() {
  const p = line('p', 'install-warn', [['b', '지금 카카오톡·팀즈 같은 앱 안에서 열려 있습니다.']]);
  for (const parts of [['여기서는 설치가 되지 않습니다. 먼저 브라우저로 옮겨 주세요.'],
    ['· 카카오톡 안드로이드 — 오른쪽 위 ', ['b', '⋮'], ' → ', ['b', '다른 브라우저로 열기']],
    ['· 카카오톡 아이폰 — 오른쪽 아래 ', ['b', '⋯'], ' 또는 공유 → ', ['b', 'Safari로 열기']],
    ['· 팀즈·네이버 등 — 메뉴(⋯ ⋮) → ', ['b', '브라우저로 열기']],
    ['옮긴 화면에서 아래 방법대로 설치하면 됩니다.']]) {
    p.append(el('br'));
    for (const part of parts) p.append(Array.isArray(part) ? el('b', '', part[1]) : part);
  }
  return p;
}

export function createInstall(root, {icon}) {
  const env = detect();
  const dialog = document.querySelector('#install-dialog');
  let deferred = null, opener = null, tab = env.isIOS ? 'ios' : env.isAndroid ? 'android' : 'pc', message = '';
  // 줄: 진행 보관 줄과 같은 모양.
  const row = el('div', 'archive-row install-row');
  const head = el('span', 'archive-rh');
  const label = el('span', 'archive-rl');
  label.append(micro('INSTALL'), '홈 화면에 설치');
  head.append(label);
  const note = el('p', 'archive-rs');
  note.id = 'install-note';
  const go = button('', 'archive-go', () => (deferred && !env.inApp ? prompt(go) : open(go)));
  go.id = 'install-open';
  go.setAttribute('aria-describedby', note.id);
  row.append(head, note, go);
  root.replaceChildren(row);

  function headline() {
    if (env.inApp) return {title: '먼저 크롬·사파리로 열어 주세요', sub: '카카오톡·팀즈 안에서는 설치가 되지 않습니다.'};
    if (deferred) return {title: '홈 화면에 설치하기', sub: '설치를 누른 뒤 브라우저의 안내를 확인하세요.'};
    return {title: '홈 화면에 설치하기', sub: env.isIOS ? '사파리 공유 버튼으로 홈 화면에 추가합니다.' : '홈 화면에서 앱처럼 열 수 있습니다.'};
  }
  function render() {
    // 이미 설치된 앱으로 열었거나 설치를 마쳤으면 줄을 감춘다(원본과 같다).
    root.hidden = env.standalone || flag(DONE);
    const h = headline();
    const sub = message || h.sub;
    if (note.textContent !== sub) note.textContent = sub;
    go.textContent = deferred && !env.inApp ? '설치' : '방법 보기';
    go.setAttribute('aria-label', deferred && !env.inApp ? '홈 화면에 설치' : '홈 화면 설치 방법 보기');
    if (dialog.open) { fill(); dialog.querySelector('#install-title')?.focus({preventScroll: true}); }
  }
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    const back = opener && opener.isConnected ? opener : go;
    opener = null;
    back.focus({preventScroll: true});
    setTimeout(() => { if (document.activeElement !== back) back.focus({preventScroll: true}); }, 0);
  });
  function fill(focusTab = '') {
    const h = headline();
    const top = el('div', 'dialog-head');
    const tag = el('span', 'dialog-label');
    tag.append(micro('INSTALL'), h.title);
    const close = button('닫기', 'close-button', () => dialog.close());
    close.id = 'install-close';
    top.append(tag, close);
    const sheet = el('div', 'install-sheet');
    const lead = el('div', 'install-lead');
    const art = el('img', 'install-icon');
    art.src = icon; art.alt = ''; art.width = 48; art.height = 48;
    const words = el('span', 'install-words');
    const title = el('h2', 'install-title', h.title);
    title.id = 'install-title'; title.tabIndex = -1;
    const sub = el('p', 'install-sub', message || h.sub);
    sub.id = 'install-sub'; sub.setAttribute('role', 'status');
    words.append(title, sub);
    lead.append(art, words);
    sheet.append(lead);
    if (deferred && !env.inApp) {
      const now = button('설치', 'primary', () => prompt(now));
      now.id = 'install-go';
      sheet.append(now);
    }
    if (env.inApp) sheet.append(inAppGuide());
    const tabs = el('div', 'install-tabs');
    tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', '설치 안내 플랫폼');
    for (const [key, name] of [['ios', '아이폰'], ['android', '안드로이드'], ['pc', '컴퓨터']]) {
      const b = button(name, key === tab ? 'on' : '', () => { tab = key; fill(key); });
      b.dataset.t = key; b.setAttribute('aria-pressed', String(key === tab));
      tabs.append(b);
    }
    sheet.append(tabs, ...(tab === 'ios' ? iosGuide(env) : tab === 'android' ? androidGuide(!!deferred) : pcGuide()),
      el('p', 'install-tip', '설치 후 기본 화면과 기기에 저장된 콘텐츠를 오프라인으로 이용할 수 있습니다. 처음 보는 그림·소리·웹툰은 인터넷 연결이 필요할 수 있습니다. 설치 항목이 보이지 않으면 이 브라우저에서는 지원하지 않을 수 있습니다. 웹으로 계속 이용할 수 있습니다.'));
    dialog.replaceChildren(top, sheet);
    if (focusTab) dialog.querySelector('[data-t="' + focusTab + '"]')?.focus({preventScroll: true});
  }
  function open(from) {
    if (document.querySelector('dialog[open]')) return;
    opener = from || document.activeElement;
    fill();
    dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('#install-close').focus({preventScroll: true});
  }
  function prompt(trigger) {
    const event = deferred;
    if (!event) { open(trigger); return; }
    trigger.disabled = true;
    message = '브라우저의 설치 안내를 확인해 주세요.'; render();
    const failed = () => {
      deferred = null; trigger.disabled = false;
      message = '설치 안내를 열지 못했습니다. 아래 기기별 설치 방법을 확인해 주세요. 웹으로 계속 이용할 수 있습니다.';
      render();
      if (!dialog.open) open(go);
    };
    try {
      Promise.all([event.prompt(), event.userChoice]).then(([, choice]) => {
        deferred = null; trigger.disabled = false;
        if (choice && choice.outcome === 'accepted') { message = ''; if (dialog.open) dialog.close(); }
        else message = '설치를 취소했습니다. 웹으로 계속 이용할 수 있습니다.';
        render();
      }, failed);
    } catch { failed(); }
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event; message = '';
    render();
  });
  window.addEventListener('appinstalled', () => {
    mark(DONE); deferred = null; message = '';
    if (dialog.open) dialog.close();
    render();
  });
  render();
  return {render, open};
}
