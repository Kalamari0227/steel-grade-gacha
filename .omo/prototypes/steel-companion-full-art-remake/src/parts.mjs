import {asset, button, cardTitle, el} from './ui.mjs';

// 부품 상세: 도감 상세와 같은 전체 화면 위층. 칸마다 후보와 재고를 고르고, 소모 뒤 재고를 확인한 다음 제작한다.
// 제작 규칙은 엔진(원본 craft/partPlan)이 정하고, 여기서는 보여 주고 고른 값을 넘기기만 한다.
export function createPartDialog(data, engine, {craft, onDismiss}) {
  const dialog = document.querySelector('#part-dialog');
  let key = '', picks = [], busy = false, message = '', justDone = false;
  const cardName = id => {
    const card = data.cards.find(c => c.id === id);
    return card ? cardTitle(card) : id;
  };
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    const closed = key;
    key = '';
    onDismiss(closed);
  });
  function render(focus) {
    const detail = engine.partDetail(key, picks);
    if (!detail) return;
    const close = button('닫기', 'close-button', () => dialog.close());
    close.autofocus = true;
    const head = el('div', 'dialog-head');
    head.append(el('span', '', '부품 제작'), close);
    const layout = el('div', 'detail-layout part-layout');
    const figure = el('div', 'part-figure' + (justDone ? ' just-done' : ''));
    figure.append(asset(data, 'part:' + key, detail.name, 'part-art'));
    const info = el('section', 'detail-info part-info');
    const title = el('h2', '', detail.name);
    title.id = 'part-title';
    info.append(el('p', 'detail-rank', detail.grp + ' · ' + String(detail.no).padStart(2, '0') + '번'), title);
    if (detail.note) info.append(el('p', 'muted part-note', detail.note));
    if (detail.done) {
      const result = el('p', 'part-result', justDone ? detail.name + ' 완성! 창고 재고에서 소재를 썼습니다.' : '완성한 부품입니다.');
      result.setAttribute('role', 'status');
      result.tabIndex = -1;
      info.append(result);
      if (detail.use.length) info.append(el('p', 'muted', '쓴 소재　' + detail.use.map(id => id === detail.qp ? 'QP' : cardName(id)).join(' · ')));
    } else {
      info.append(el('h3', '', '필요한 소재'));
      const slots = el('ol', 'part-slots');
      detail.slots.forEach((slot, index) => {
        const item = el('li', 'part-slot');
        const label = el('p', 'slot-name', slot.name);
        label.id = 'part-slot-' + index;
        const group = el('div', 'part-candidates');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-labelledby', label.id);
        const options = slot.candidates.map(c => ({id: c.id, stock: c.stock, qp: false}));
        if (slot.qpCovers) options.push({id: detail.qp, stock: null, qp: true});
        for (const option of options) {
          const pick = button('', 'cand', () => {
            if (busy) return;
            picks[index] = option.id;
            message = '';
            render('[data-slot="' + index + '"][data-id="' + option.id + '"]');
          });
          pick.dataset.slot = String(index);
          pick.dataset.id = option.id;
          pick.setAttribute('aria-pressed', String(slot.chosen === option.id));
          pick.disabled = !option.qp && option.stock <= 0;
          pick.append(el('strong', '', option.qp ? 'QP로 대신하기' : cardName(option.id)), el('small', '', option.qp ? '카드 소모 없음' : '재고 ' + option.stock + '장'));
          group.append(pick);
        }
        item.append(label, group);
        slots.append(item);
      });
      info.append(slots);
      const after = el('ul', 'part-after');
      after.setAttribute('aria-label', '소모 뒤 남는 재고');
      for (const spend of detail.spent) after.append(el('li', '', cardName(spend.id) + '　재고 ' + spend.before + '장 → ' + spend.after + '장'));
      if (detail.plan && detail.plan.includes(detail.qp)) after.append(el('li', '', 'QP는 닳지 않습니다'));
      if (detail.ready) info.append(el('h3', '', '소모 뒤 남는 재고'), after);
      const note = el('p', 'part-message', detail.ready ? message : (message || '소재가 모자랍니다. 비어 있는 칸의 소재를 출하로 더 모아 보세요.'));
      note.setAttribute('role', message ? 'alert' : 'status');
      const make = button(detail.ready ? '제작하기' : '소재 부족', 'primary craft-button', async () => {
        if (busy) return;
        busy = true;
        make.disabled = true;
        const outcome = await craft(key, picks.some(v => v) ? picks.slice() : null, detail.plan);
        busy = false;
        if (outcome.ok) { justDone = true; picks = []; message = ''; render('.part-result'); justDone = false; }
        else { message = outcome.error; render('.craft-button'); }
      });
      make.disabled = !detail.ready;
      info.append(note, make);
    }
    layout.append(figure, info);
    dialog.replaceChildren(head, layout);
    if (focus) dialog.querySelector(focus)?.focus({preventScroll: true});
  }
  return {
    open(partKey) {
      if (!engine.partDetail(partKey)) return;
      key = partKey; picks = []; message = ''; justDone = false; busy = false;
      render();
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
    },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
