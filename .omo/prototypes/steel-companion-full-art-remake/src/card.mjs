import {button, cardTitle, deco, el, gradeKey, gradeText, micro, stage} from './ui.mjs';

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
    // 장착한 보증은 늘 보이고, 획득했지만 장착하지 않은 보증만 눌러 미리 볼 수 있다. 미획득·다른 동료에 장착된 보증은 잠겨 있다.
    const items = feature?.items ? feature.items(current.id) : [];
    const worn = items.filter(i => i.state === 'equipped').map(i => i.key);
    const free = new Set(items.filter(i => i.state === 'free').map(i => i.key));
    for (const key of [...selected.preview]) if (!free.has(key)) selected.preview.delete(key);
    const shown = new Set([...worn, ...selected.preview]);
    const chosen = matches.find(a => a.equipmentKeys.length === shown.size && a.equipmentKeys.every(k => shown.has(k))) || matches.find(a => !a.equipmentKeys.length);
    const dialogue = data.dialogue.find(row => row.cardId === current.id && row.side === selected.side);
    const close = button('닫기', 'close-button', () => dialog.close());
    close.autofocus = true;
    const head = el('div', 'dialog-head');
    const label = el('span', 'dialog-label');
    label.append(micro('INSPECTION CERTIFICATE'), '동료 카드');
    head.append(label, close);
    dialog.dataset.family = current.family;
    const layout = el('div', 'detail-layout');
    const info = el('section', 'detail-info');
    const title = el('h2', '', cardTitle(current));
    title.id = 'card-title';
    const meta = el('p', 'muted', current.code + ' · ' + current.familyKind);
    const quote = el('blockquote', '', dialogue?.ko || '한국어 대사를 불러올 수 없습니다.');
    quote.lang = 'ko';
    // 검사증명서 머리: 계열과 큰 강종 번호, 검사 도장. 제목과 같은 내용이라 화면 읽기에서는 숨긴다.
    const family = data.families.find(f => f.key === current.family);
    const certId = el('div', 'cert-id');
    certId.setAttribute('aria-hidden', 'true');
    const familyLine = el('span', 'cert-family');
    familyLine.append(el('i', 'fam-dot'), (family?.abbr || '') + ' · ' + current.familyKind);
    const seal = el('span', 'cert-seal');
    seal.append(el('b', '', '검사'), el('b', '', '합격'));
    certId.append(familyLine, el('b', 'cert-code', current.grade), seal);
    info.append(certId, el('p', 'detail-rank', gradeText(current) + '　·　LV' + current.level + ' ' + current.levelName), title, meta);
    const words = [quote];
    if (dialogue?.ja) {
      const japanese = el('p', 'ja-line', dialogue.ja);
      japanese.lang = 'ja';
      words.push(japanese);
    }
    const controls = el('div', 'detail-controls');
    let pinControl = null, sideControl = null, slotControl = null;
    if (feature) {
      const now = feature.current();
      const mine = now.pinned && now.id === current.id;
      const pin = button(mine ? '로비 대표 동료' : '로비 대표로 지정', 'secondary feature-pin', () => {
        if (feature.set(current.id)) render('.feature-pin');
      });
      pin.setAttribute('aria-pressed', String(mine));
      pinControl = pin;
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
      sideControl = pair;
    }
    // 보증 슬롯(3단계): 이 동료가 걸 수 있는 보증 전부. 보이는 조합은 늘 승인된 외형이다(호환 보증의 모든 부분집합이 승인돼 있다).
    if (items.length) {
      const full = matches.reduce((best, item) => item.equipmentKeys.length > best.equipmentKeys.length ? item : best, matches[0]);
      const group = el('div', 'slot-group');
      const caption = el('p', 'appearance-label', '보증 장비 · 장착 ' + worn.length + ' / ' + items.length);
      caption.id = 'equipment-label';
      const slots = el('div', 'slots');
      slots.id = 'equipment';
      slots.setAttribute('role', 'group');
      slots.setAttribute('aria-labelledby', 'equipment-label');
      const STATE = {equipped: '장착', free: '획득 · 미리보기', elsewhere: '다른 소재에 장착', locked: '미획득'};
      for (const item of items) {
        const label = full?.equipment?.[full.equipmentKeys.indexOf(item.key)] || item.name;
        let slot;
        if (item.state === 'free') {
          slot = button('', 'slot free', () => {
            if (selected.preview.has(item.key)) selected.preview.delete(item.key); else selected.preview.add(item.key);
            render('#equipment [data-key="' + item.key + '"]');
          });
          slot.setAttribute('aria-pressed', String(selected.preview.has(item.key)));
        } else {
          slot = el('div', 'slot ' + item.state);
          if (item.state === 'equipped') slot.setAttribute('aria-current', 'true');
        }
        slot.dataset.key = item.key;
        slot.dataset.state = item.state;
        slot.append(deco(data, 'item:' + item.key, 'slot-art'), el('span', 'slot-name', label), el('small', 'slot-state', STATE[item.state]));
        slots.append(slot);
      }
      group.append(caption, slots);
      if (!items.some(i => i.state !== 'locked')) group.append(el('p', 'slot-hint muted', '고객 요구에 답해 보증을 얻으면 이 소재에 장착할 수 있어요.'));
      else if (selected.preview.size) group.append(el('p', 'slot-hint muted', '미리보기입니다. 장착은 연구 탭의 보증서에서 확정해요.'));
      slotControl = group;
    }
    // 읽는 순서: 열처리 상태 → 물성표 → 용도 → 대사 → 장착 외형 → 로비 대표.
    if (sideControl) info.append(sideControl);
    info.append(el('h3', '', '소재 물성'), properties(selected.side === 'alt' ? current.altSpec : current.spec));
    const description = selected.side === 'alt' ? current.altDescription : current.description;
    if (description || current.use) info.append(el('p', 'detail-description', [description, current.use].filter(Boolean).join(' · ')));
    info.append(...words);
    if (slotControl) controls.append(slotControl);
    if (pinControl) controls.append(pinControl);
    info.append(controls);
    layout.append(stage(data, current, chosen), info);
    const scenery = deco(data, 'stage:' + (selected.side === 'alt' ? 'heat-awakened' : gradeKey(current)), 'detail-backdrop');
    dialog.replaceChildren(scenery, head, layout);
    if (focus) dialog.querySelector(focus)?.focus({preventScroll: true});
  }
  return {
    open(card, opener) {
      current = card;
      origin = opener;
      if (!selections.has(card.id)) selections.set(card.id, {side: 'front', preview: new Set()});
      render();
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
    },
    // 열려 있는 동료 카드를 지금 저장 기준으로 다시 그린다(장착 직후). 초점은 그대로 둔다.
    refresh() { if (dialog.open && current) render(); },
    close() { if (dialog.open) dialog.close(); }
  };
}
