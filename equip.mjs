import {appearanceFor, asset, button, cardTitle, el, gradeText, micro, stage} from './ui.mjs';

// 보증 장착: 도감 상세와 같은 전체 화면 위층. 획득했지만 아직 걸지 않은 보증 하나를 호환되는 보유 동료 한 명에게 건다.
// 1 · 소재 선택(호환되는 보유 동료만) → 2 · 확인(장착 전/미리보기, 열처리 전후, 재고 무소모) → 3 · 완료.
// 장착 규칙과 저장은 엔진 명령(원본 장착 확정 문장)이 하고, 보이는 모습은 늘 승인된 외형 조합이다. 해제·재배치는 없다.
export function createEquipDialog(data, engine, {equip, openCard, onDismiss}) {
  const dialog = document.querySelector('#equip-dialog');
  let key = '', target = '', before = false, side = 'front', busy = false, message = '', step = 'targets';
  const card = id => data.cards.find(c => c.id === id);
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    const closed = key;
    key = ''; target = ''; before = false; side = 'front'; busy = false; message = ''; step = 'targets';
    onDismiss(closed);
  });
  function frame(label, korean) {
    const close = button('닫기', 'close-button', () => dialog.close());
    close.autofocus = true;
    const head = el('div', 'dialog-head');
    const tag = el('span', 'dialog-label');
    tag.append(micro(label), korean);
    head.append(tag, close);
    return head;
  }
  function targets(w) {
    const layout = el('div', 'detail-layout equip-layout');
    const figure = el('div', 'part-figure equip-figure');
    figure.append(asset(data, 'item:' + key, w.name + ' ' + w.tag, 'part-art'));
    const info = el('section', 'detail-info part-info');
    const title = el('h2', '', w.tag);
    title.id = 'equip-title';
    title.tabIndex = -1;
    info.append(el('p', 'detail-rank', '1 · 보유 소재 선택'), title, el('p', '', w.sub));
    if (w.scope) info.append(el('p', 'muted', '적용 · ' + w.scope));
    const status = el('p', 'equip-status', message);
    status.id = 'equip-status';
    status.setAttribute('role', 'status');
    status.tabIndex = -1;
    info.append(status);
    if (w.state === 'equipped') {
      info.append(el('p', 'equip-empty', '이미 ' + (card(w.cardId) ? cardTitle(card(w.cardId)) : '다른 소재') + '에 장착했어요. 장착한 보증은 다시 쓸 수 없어요.'));
      if (card(w.cardId)) info.append(button('동료 카드 보기', 'secondary', () => { dialog.close(); openCard(w.cardId); }));
    } else if (!w.candidates.length) {
      info.append(el('p', 'equip-empty', '현재 호환되는 보유 소재가 없어요. 보증은 미장착 상태로 보관됩니다.'));
    } else {
      info.append(el('h3', '', '호환되는 보유 소재 ' + w.candidates.length + '종'));
      const list = el('div', 'equip-targets');
      for (const id of w.candidates) {
        const c = card(id);
        const choice = button('', 'equip-target', () => { target = id; side = 'front'; before = false; step = 'preview'; message = ''; render('#equip-title'); });
        choice.dataset.equipId = id;
        choice.dataset.family = c.family;
        choice.setAttribute('aria-label', cardTitle(c));
        const thumb = asset(data, 'thumbnail:' + id + ':front', '', 'equip-thumb', true);
        thumb.setAttribute('aria-hidden', 'true');
        choice.append(thumb, el('strong', '', cardTitle(c)), el('small', '', gradeText(c)));
        list.append(choice);
      }
      info.append(list);
    }
    info.append(button(w.state === 'equipped' || !w.candidates.length ? '닫기' : '나중에', 'secondary', () => dialog.close()));
    layout.append(figure, info);
    return layout;
  }
  function preview(w) {
    const c = card(target), worn = engine.equippedKeys(target);
    const shown = step === 'done' || !before ? [...new Set([...worn, key])] : worn.filter(k => k !== key);
    const layout = el('div', 'detail-layout equip-layout');
    layout.append(stage(data, c, appearanceFor(data, target, side, shown)));
    const info = el('section', 'detail-info equip-info');
    const title = el('h2', '', cardTitle(c));
    title.id = 'equip-title';
    title.tabIndex = -1;
    info.append(el('p', 'detail-rank', step === 'done' ? '3 · 장착 완료' : '2 · 장착 확인'), title);
    if (step === 'preview') {
      const modes = el('div', 'segments');
      modes.setAttribute('role', 'group');
      modes.setAttribute('aria-label', '장착 전후 비교');
      for (const [flag, label] of [[true, '장착 전'], [false, '미리보기']]) {
        const choice = button(label, '', () => { before = flag; render('[data-mode="' + flag + '"]'); });
        choice.dataset.mode = String(flag);
        choice.setAttribute('aria-pressed', String(flag === before));
        modes.append(choice);
      }
      info.append(modes);
    }
    if (c.hasAlt) {
      const sides = el('div', 'segments');
      sides.setAttribute('role', 'group');
      sides.setAttribute('aria-label', '열처리 상태');
      for (const [value, label] of [['front', '열처리 전'], ['alt', '열처리 후']]) {
        const choice = button(label, '', () => { side = value; render('[data-side="' + value + '"]'); });
        choice.dataset.side = value;
        choice.setAttribute('aria-pressed', String(value === side));
        sides.append(choice);
      }
      info.append(sides);
    }
    const stock = engine.state().stock[target] || 0;
    info.append(el('h3', '', w.name + ' · ' + w.tag), el('p', '', w.sub),
      el('p', 'muted', step === 'done' ? '소재 재고는 그대로예요 · ' + stock + '장' : '재고 ' + stock + '장 · 장착해도 재고를 쓰지 않아요'));
    const status = el('p', 'equip-status', step === 'done' ? cardTitle(c) + '에 보증을 걸었습니다 · ' + w.tag + '. 이 동료는 이제 장착 외형으로 보여요.' : message);
    status.id = 'equip-status';
    status.setAttribute('role', 'status');
    status.tabIndex = -1;
    info.append(status);
    const actions = el('div', 'equip-actions');
    if (step === 'done') {
      actions.append(button('확인', 'primary', () => dialog.close()), button('동료 카드 보기', 'secondary', () => { dialog.close(); openCard(target); }));
    } else {
      const confirm = button(w.name + ' 장착 확정', 'primary', async () => {
        if (busy) return;
        busy = true;
        confirm.disabled = true;
        const outcome = await equip(key, target);
        busy = false;
        if (outcome.ok) { step = 'done'; message = ''; render('#equip-status'); return; }
        // 그 사이 상태가 바뀌었으면 거절된 채로 소재 선택으로 돌아간다. 저장은 바뀌지 않았다.
        step = 'targets'; message = outcome.error; render('#equip-status');
      });
      actions.append(confirm, button('취소', 'secondary', () => { step = 'targets'; target = ''; message = ''; render('#equip-title'); }));
    }
    info.append(actions);
    layout.append(info);
    return layout;
  }
  function render(focus) {
    const w = engine.warranties().items.find(i => i.key === key);
    if (!w || w.state === 'locked') return false;
    if (step !== 'targets' && step !== 'done' && !(target && w.state === 'owned' && w.candidates.includes(target))) { step = 'targets'; target = ''; }
    dialog.setAttribute('aria-label', '보증 장착 · ' + w.tag);
    dialog.replaceChildren(frame('WARRANTY CERTIFICATE', '보증 장착'), step === 'targets' ? targets(w) : preview(w));
    if (focus) dialog.querySelector(focus)?.focus({preventScroll: true});
    return true;
  }
  return {
    open(warrantyKey) {
      key = warrantyKey; target = ''; before = false; side = 'front'; busy = false; message = ''; step = 'targets';
      if (!render()) { key = ''; return; }
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector('#equip-title')?.focus({preventScroll: true});
    },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
