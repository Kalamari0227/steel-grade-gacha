import {button, cardTitle, deco, el, gradeKey, gradeText, stage} from './ui.mjs';

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

export function createCardDialog(data, onDismiss, feature = null) {
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
    if (feature) {
      const now = feature.current();
      const mine = now.pinned && now.id === current.id;
      const pin = button(mine ? '로비 대표 동료' : '로비 대표로 지정', 'secondary feature-pin', () => {
        if (feature.set(current.id)) render('.feature-pin');
      });
      pin.setAttribute('aria-pressed', String(mine));
      controls.append(pin);
    }
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
    // 장비 슬롯: 승인된 외형 조합만 고를 수 있다 (모든 부분 조합이 승인 목록에 있다). 보기 선택일 뿐 소유·장착이 아니다.
    const full = matches.reduce((best, item) => item.equipmentKeys.length > best.equipmentKeys.length ? item : best, matches[0]);
    if (full?.equipmentKeys.length) {
      const group = el('div', 'slot-group');
      const caption = el('p', 'appearance-label', '장착 외형 미리보기');
      caption.id = 'equipment-label';
      const slots = el('div', 'slots');
      slots.id = 'equipment';
      slots.setAttribute('role', 'group');
      slots.setAttribute('aria-labelledby', 'equipment-label');
      const on = new Set(chosen.equipmentKeys);
      full.equipmentKeys.forEach((key, index) => {
        const slot = button('', 'slot', () => {
          const next = new Set(on);
          if (next.has(key)) next.delete(key); else next.add(key);
          const hit = matches.find(item => item.equipmentKeys.length === next.size && item.equipmentKeys.every(k => next.has(k)));
          if (!hit) return;
          selected.keys = hit.equipmentKeys.join('|');
          render('#equipment [data-key="' + key + '"]');
        });
        slot.dataset.key = key;
        slot.setAttribute('aria-pressed', String(on.has(key)));
        slot.append(deco(data, 'item:' + key, 'slot-art'), el('span', 'slot-name', full.equipment[index]));
        slots.append(slot);
      });
      group.append(caption, slots);
      controls.append(group);
    }
    info.append(controls, el('h3', '', '소재 물성'), properties(selected.side === 'alt' ? current.altSpec : current.spec));
    const description = selected.side === 'alt' ? current.altDescription : current.description;
    if (description || current.use) info.append(el('p', 'detail-description', [description, current.use].filter(Boolean).join(' · ')));
    layout.append(stage(data, current, chosen), info);
    const scenery = deco(data, 'stage:' + (selected.side === 'alt' ? 'heat-awakened' : gradeKey(current)), 'detail-backdrop');
    dialog.replaceChildren(scenery, head, layout);
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
