import {button, el, micro} from './ui.mjs';

// 7단계 진행 보관(2026-11-20, 시안 U0 A안): 공방 맨 아래 "진행 보관" 줄과 위층 창(백업 · 복원 · 저장 상태 · 초기화).
// 순서와 문구는 원본 openBackup·btnReset을 따른다. 원본과 다른 것: 교육용 가져오기 없음(사용자 결정), 초기화가 이 창 맨 아래 구역에 있음.
// 글은 모두 textContent로만 그린다(innerHTML 없음).
const RESET_WAIT = 5000;

export function createArchiveRow(root, {open}) {
  // 출하 알림 줄(.ops-bell)과 같은 모양이지만 클래스는 따로 둔다(알림 줄의 조작·시험과 섞이지 않게).
  const row = el('div', 'archive-row');
  const head = el('span', 'archive-rh');
  const label = el('span', 'archive-rl');
  label.append(micro('ARCHIVE'), '진행 보관');
  head.append(label);
  const note = el('p', 'archive-rs');
  note.id = 'archive-when';
  const go = button('열기', 'archive-go', () => open(go));
  go.id = 'archive-open';
  go.setAttribute('aria-label', '진행 보관 열기');
  go.setAttribute('aria-describedby', note.id);
  row.append(head, note, go);
  root.replaceChildren(row);
  return {
    render(view) {
      const text = (view.when ? view.when + ' · ' : '') + '백업 · 복원 · 초기화';
      if (note.textContent !== text) note.textContent = text;
    },
    button: go
  };
}

export function createArchiveDialog(engine, {onChange, onDismiss}) {
  const dialog = document.querySelector('#archive-dialog');
  let opener = null, preview = null, resetTimer = null, serial = 0;
  dialog.addEventListener('close', () => {
    clearTimeout(resetTimer); resetTimer = null;
    preview = null; serial++;
    dialog.replaceChildren();
    const back = opener; opener = null;
    onDismiss(back);
  });

  function section(title, tag, extra = '') {
    const box = el('section', 'archive-sec' + (extra ? ' ' + extra : ''));
    const h = el('h3', 'archive-h');
    h.append(title);
    if (tag) { h.append(' '); h.append(micro(tag)); }
    box.append(h);
    return box;
  }
  function area(id, readOnly, placeholder = '') {
    const t = document.createElement('textarea');
    t.id = id; t.className = 'archive-code'; t.spellcheck = false; t.readOnly = readOnly;
    t.setAttribute('autocomplete', 'off');
    if (placeholder) t.placeholder = placeholder;
    return t;
  }
  function label(forId, text) {
    const l = el('label', 'archive-lab', text);
    l.htmlFor = forId;
    return l;
  }
  function say(node, text, tone = '') {
    node.textContent = text;
    node.dataset.tone = tone;
  }

  function open(from) {
    opener = from || document.activeElement;
    serial++;
    const view = engine.backupView();
    const head = el('div', 'dialog-head');
    const tag = el('span', 'dialog-label');
    tag.append(micro('ARCHIVE'), '진행 백업 · 복원');
    const close = button('닫기', 'close-button', () => dialog.close());
    close.id = 'archive-close';
    head.append(tag, close);

    const sheet = el('div', 'archive-sheet');
    const title = el('h2', 'archive-title', '진행 백업 · 복원');
    title.id = 'archive-title'; title.tabIndex = -1;
    sheet.append(title, el('p', 'archive-lead', '백업 코드를 메모 등에 따로 보관하세요. 이 코드로 백업 당시의 게임 진행을 불러올 수 있습니다. 이후 진행은 포함되지 않습니다.'));

    // 내 백업 코드
    const mine = section('내 백업 코드', 'SGG-GAME1');
    const out = area('bk-out', true);
    out.value = view.code;
    const summary = el('p', 'archive-sum', view.summary);
    summary.id = 'bk-summary';
    const copyRes = el('p', 'archive-res');
    copyRes.id = 'bk-copy-res'; copyRes.setAttribute('role', 'status');
    const copy = button('코드 복사', 'primary', () => copyCode(out, copyRes));
    copy.id = 'bk-copy';
    mine.append(label('bk-out', '내 백업 코드'), out, copy, summary, copyRes);
    mine.querySelector('label').className = 'archive-lab sr-only';

    // 저장 상태
    const store = section('저장 상태');
    const diag = el('div', 'archive-diag');
    diag.id = 'bk-diag'; diag.setAttribute('role', 'status'); diag.setAttribute('aria-busy', 'true');
    diag.append(el('p', 'archive-sum', '저장 상태를 확인하고 있어요.'));
    store.append(diag);

    // 백업 코드 불러오기
    const load = section('백업 코드 불러오기');
    const input = area('bk-in', false, '받아 둔 백업 코드를 붙여 넣으세요');
    const inRes = el('p', 'archive-res');
    inRes.id = 'bk-res'; inRes.setAttribute('role', 'status'); inRes.setAttribute('aria-live', 'polite');
    input.setAttribute('aria-describedby', 'bk-res');
    const previewButton = button('게임용 백업 미리보기', 'secondary', () => prepare());
    previewButton.id = 'bk-load';
    load.append(label('bk-in', '받아 둔 백업 코드'), input, previewButton,
      el('p', 'archive-sum', '게임용 백업은 SGG-GAME1.으로 시작합니다. 미리보기만으로 진행이 바뀌지는 않습니다.'), inRes);
    load.querySelector('label').className = 'archive-lab sr-only';

    const pv = el('section', 'archive-sec archive-preview');
    pv.id = 'bk-preview'; pv.hidden = true; pv.setAttribute('aria-labelledby', 'bk-preview-title');
    const pvTitle = el('h3', 'archive-h', '진행 교체 미리보기');
    pvTitle.id = 'bk-preview-title'; pvTitle.tabIndex = -1;
    const cmp = el('div', 'archive-cmp');
    const before = el('p', 'archive-was'), after = el('p', 'archive-next');
    before.id = 'bk-previous'; after.id = 'bk-next';
    cmp.append(before, after);
    const recovery = area('bk-recovery', true);
    const cancel = button('취소', 'secondary', () => {
      clearPreview(); say(inRes, '취소했습니다. 현재 진행을 유지합니다.');
      previewButton.focus();
    });
    cancel.id = 'bk-cancel';
    const confirm = button('게임용 진행 교체', 'primary', () => apply());
    confirm.id = 'bk-confirm';
    const pvButtons = el('div', 'archive-buttons');
    pvButtons.append(cancel, confirm);
    pv.append(pvTitle, cmp,
      el('p', 'archive-sum', '현재 게임 진행 전체가 바뀌며 두 진행은 합쳐지지 않습니다. 아래 복구 코드를 먼저 따로 보관하세요. 이 화면의 복구 코드는 새로고침하면 사라집니다.'),
      label('bk-recovery', '교체 전 게임용 복구 코드'), recovery, pvButtons);

    const saved = el('section', 'archive-sec');
    saved.id = 'bk-recovery-saved';
    const savedOut = area('bk-recovery-out', true);
    saved.append(label('bk-recovery-out', '이전 게임용 진행 복구 코드'), savedOut,
      el('p', 'archive-sum', '이전 진행으로 돌아가려면 이 코드를 게임용 백업으로 불러오세요. 새로고침 전에 따로 보관하세요.'));
    const showRecovery = code => { saved.hidden = !code; savedOut.value = code || ''; };
    showRecovery(view.recovery);

    // 진행 초기화
    const reset = section('진행 초기화', '', 'archive-danger');
    const resetHelp = el('p', 'archive-sum', '게임 진행 전체를 지웁니다. 되돌리려면 먼저 백업 코드를 보관하세요. 알림 설정·웹툰 읽음 기록은 남습니다.');
    resetHelp.id = 'reset-help';
    const resetStatus = el('p', 'archive-res');
    resetStatus.id = 'reset-status'; resetStatus.setAttribute('role', 'status');
    const resetCancel = button('초기화 취소', 'secondary', () => {
      disarm('초기화를 취소했습니다. 현재 진행을 유지합니다.');
      resetButton.focus();
    });
    resetCancel.id = 'reset-cancel'; resetCancel.hidden = true;
    const resetButton = button('진행 초기화', 'archive-reset', () => resetClick());
    resetButton.id = 'reset-go';
    resetButton.setAttribute('aria-describedby', 'reset-help reset-status');
    const resetButtons = el('div', 'archive-buttons');
    resetButtons.append(resetCancel, resetButton);
    reset.append(resetHelp, resetButtons, resetStatus);

    sheet.append(mine, store, load, pv, saved, reset);
    dialog.replaceChildren(head, sheet);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (!view.status.ok) say(inRes, view.status.text, 'ng');
    close.focus({preventScroll: true});

    const mySerial = serial;
    engine.diagnose().then(d => {
      if (mySerial !== serial || !dialog.open) return;
      const status = engine.backupView().status;
      const primary = el('p', 'archive-sum'), copyLine = el('p', 'archive-sum');
      primary.dataset.storageCheck = 'primary'; copyLine.dataset.storageCheck = 'copy';
      primary.dataset.state = !status.ok ? 'unconfirmed' : d.ls === '정상' ? 'available' : 'unavailable';
      primary.textContent = !status.ok ? status.text : d.ls === '정상'
        ? '브라우저의 저장 기능을 확인했습니다. 백업 코드도 따로 보관하세요.'
        : '기기 저장을 확인하지 못했습니다. 창을 닫기 전에 현재 백업 코드를 따로 보관하세요.';
      copyLine.dataset.state = d.idb === '정상' ? 'available' : 'unavailable';
      copyLine.textContent = d.idb === '정상' ? '추가 저장 사본을 만드는 기능도 사용할 수 있습니다.'
        : '추가 저장 사본을 확인하지 못했습니다. 백업 코드를 보관하세요.';
      diag.setAttribute('aria-busy', 'false');
      diag.replaceChildren(primary, copyLine);
    });

    function clearPreview() { preview = null; pv.hidden = true; input.removeAttribute('aria-invalid'); }
    input.addEventListener('input', clearPreview);
    function prepare() {
      clearPreview();
      const r = engine.previewRestore(input.value);
      if (!r.ok) { input.setAttribute('aria-invalid', 'true'); say(inRes, r.error, 'ng'); return; }
      preview = r.preview;
      before.textContent = '현재 게임 진행: ' + preview.current;
      after.textContent = '불러올 게임 진행: ' + preview.next;
      recovery.value = preview.recovery;
      pv.hidden = false;
      say(inRes, '내용을 확인한 뒤 게임용 진행 교체를 눌러 주세요.');
      pvTitle.focus();
    }
    function apply() {
      const selected = preview;
      clearPreview();
      const r = engine.applyRestore(selected, input.value);
      if (!r.ok) { input.setAttribute('aria-invalid', 'true'); say(inRes, r.error, 'ng'); previewButton.focus(); return; }
      refreshMine();
      showRecovery(r.recovery);
      say(inRes, '진행을 이 창에 적용했습니다. ' + r.status.text, r.status.ok ? 'ok' : 'ng');
      onChange('restore');
      previewButton.focus();
    }
    function refreshMine() {
      const v = engine.backupView();
      out.value = v.code;
      summary.textContent = v.summary;
    }
    function copyCode(area, res) {
      const done = () => {
        const r = engine.markBackup();
        const status = r.status || engine.backupView().status;
        if (status.ok) say(res, '복사했습니다. 메모 등에 붙여 넣어 따로 보관하세요.', 'ok');
        else say(res, '코드를 복사했습니다. ' + status.text, 'ng');
        onChange('backup');
      };
      const fail = () => {
        area.select();
        say(res, '자동 복사를 하지 못했습니다. 코드 전체를 선택해 직접 복사해 주세요.', 'ng');
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(area.value).then(done, fail); return; }
        area.select(); area.setSelectionRange(0, 999999);
        if (document.execCommand('copy')) done(); else fail();
      } catch { fail(); }
    }
    function disarm(message) {
      clearTimeout(resetTimer); resetTimer = null;
      resetButton.classList.remove('arm');
      resetButton.textContent = '진행 초기화';
      resetCancel.hidden = true;
      resetStatus.textContent = typeof message === 'string' ? message : '';
    }
    function resetClick() {
      if (!resetTimer) {
        resetButton.classList.add('arm');
        resetButton.textContent = '5초 안에 다시 누르면 게임 진행 초기화';
        resetCancel.hidden = false;
        resetStatus.textContent = '아직 지우지 않았습니다. 취소하거나 이 화면을 닫으면 현재 진행을 유지합니다.';
        resetTimer = setTimeout(() => disarm('확인 시간이 지났습니다. 현재 진행을 유지합니다.'), RESET_WAIT);
        return;
      }
      disarm();
      const r = engine.resetProgress();
      if (!r.ok) { resetStatus.textContent = r.error; return; }
      refreshMine();
      resetStatus.textContent = '게임 진행을 초기화했습니다. 공방에서 1회 출하로 다시 시작하세요.' + (r.status.ok ? '' : ' ' + r.status.text);
      onChange('reset');
    }
  }
  return {open, get isOpen() { return dialog.open; }};
}
