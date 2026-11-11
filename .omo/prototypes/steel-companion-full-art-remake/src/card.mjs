import {button, cardTitle, el, gradeText, stage} from './ui.mjs';

function properties(spec) {
  const wrap = el('div', 'properties');
  for (const [key, label, unit, max] of [['ts','인장강도 TS','MPa',2200],['el','연신율 EL','%',100],['ra','단면수축률 RA','%',100]]) {
    if (spec?.[key] == null) continue;
    const raw = String(spec[key]);
    const row = el('div', 'property');
    const heading = el('p');
    heading.append(el('span', '', label), el('b', '', raw + ' ' + unit));
    row.append(heading);
    const number = Number(raw.match(/[\d.]+/)?.[0]);
    if (Number.isFinite(number)) {
      const bar = el('span', 'property-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('i');
      fill.style.width = Math.min(number / max * 100, 100) + '%';
      bar.append(fill);
      row.append(bar);
    }
    wrap.append(row);
  }
  return wrap;
}

export function createCardDialog(data, onDismiss) {
  const dialog = document.querySelector('#card-dialog');
  const selections = new Map();
  let current, origin;
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    if (origin?.isConnected) origin.focus({preventScroll: true});
    onDismiss();
  });
  function render(focus) {
    const selected = selections.get(current.id);
    const matches = data.appearances.filter(a => a.cardId === current.id && a.side === selected.side);
    const chosen = matches.find(a => a.equipmentKeys.join('|') === selected.keys) || matches.find(a => !a.equipmentKeys.length);
    const dialogue = data.dialogue.find(row => row.cardId === current.id && row.side === selected.side);
    const close = button('닫기', 'close-button', () => dialog.close());
    close.autofocus = true;
    const head = el('div', 'dialog-head');
    head.append(el('span', '', '동료 카드'), close);
    const layout = el('div', 'detail-layout');
    const info = el('section', 'detail-info');
    const title = el('h2', '', cardTitle(current));
    title.id = 'card-title';
    const meta = el('p', 'muted', current.code + ' · ' + current.familyKind);
    const quote = el('blockquote', '', dialogue?.ko || '한국어 대사를 불러올 수 없습니다.');
    quote.lang = 'ko';
    info.append(el('p', 'detail-rank', gradeText(current) + '　·　LV' + current.level + ' ' + current.levelName), title, meta, quote);
    if (dialogue?.ja) {
      const japanese = el('p', 'ja-line', dialogue.ja);
      japanese.lang = 'ja';
      info.append(japanese);
    }
    const controls = el('div', 'detail-controls');
    if (current.hasAlt) {
      const pair = el('div', 'segments');
      pair.setAttribute('role', 'group');
      pair.setAttribute('aria-label', '열처리 상태');
      for (const [side, label] of [['front','열처리 전'],['alt','열처리 후']]) {
        const choice = button(label, '', () => {
          selected.side = side;
          render('[data-side="' + side + '"]');
        });
        choice.dataset.side = side;
        choice.setAttribute('aria-pressed', String(side === selected.side));
        pair.append(choice);
      }
      controls.append(pair);
    }
    if (matches.some(item => item.equipmentKeys.length)) {
      const label = el('label', 'appearance-label', '장착 외형 미리보기');
      const select = el('select');
      select.id = 'equipment';
      for (const item of matches) {
        const option = el('option', '', item.equipment.length ? item.equipment.join(' + ') : '기본 모습');
        option.value = item.equipmentKeys.join('|');
        option.selected = item === chosen;
        select.append(option);
      }
      select.addEventListener('change', () => { selected.keys = select.value; render('#equipment'); });
      label.append(select);
      controls.append(label);
    }
    info.append(controls, el('h3', '', '소재 물성'), properties(selected.side === 'alt' ? current.altSpec : current.spec));
    const description = selected.side === 'alt' ? current.altDescription : current.description;
    if (description || current.use) info.append(el('p', 'detail-description', [description, current.use].filter(Boolean).join(' · ')));
    layout.append(stage(data, current, chosen), info);
    dialog.replaceChildren(head, layout);
    if (focus) dialog.querySelector(focus)?.focus({preventScroll: true});
  }
  return {
    open(card, opener) {
      current = card;
      origin = opener;
      if (!selections.has(card.id)) selections.set(card.id, {side: 'front', keys: ''});
      render();
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
    },
    close() { if (dialog.open) dialog.close(); }
  };
}
