import {asset, button, el, micro} from './ui.mjs';

// 자동차 상세: 부품 상세와 같은 전체 화면 위층. 보유 차량은 받은 날, 미보유는 조립 미리보기(원본과 같은 문구).
// 보기만 하며 저장을 바꾸지 않는다.
const stamp = ts => {
  if (!ts) return '—';
  const d = new Date(ts), p = n => (n < 10 ? '0' : '') + n;
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes());
};
export function createCarDialog(data, engine, {onDismiss}) {
  const dialog = document.querySelector('#car-dialog');
  let key = '';
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    const closed = key;
    key = '';
    onDismiss(closed);
  });
  function render() {
    const g = engine.garage(), car = g.cars.find(c => c.key === key);
    if (!car) return false;
    const close = button('닫기', 'close-button', () => dialog.close());
    close.autofocus = true;
    const head = el('div', 'dialog-head');
    const label = el('span', 'dialog-label');
    label.append(micro('DELIVERY NOTE'), '자동차');
    head.append(label, close);
    const layout = el('div', 'detail-layout part-layout');
    const figure = el('div', 'part-figure');
    figure.append(asset(data, 'car:' + key, car.tag + ' ' + car.body, 'part-art'));
    const info = el('section', 'detail-info part-info');
    const title = el('h2', '', car.tag);
    title.id = 'car-title';
    title.tabIndex = -1;
    info.append(el('p', 'detail-rank', car.owned ? '나의 자동차' : '미보유 · 조립 미리보기'), title, el('p', '', car.body), el('p', 'part-note', car.line),
      el('h3', '', '어느 회사'), el('p', '', car.maker));
    if (car.owned) info.append(el('p', 'garage-date', '받은 날 · ' + stamp(car.at)));
    else info.append(el('p', 'garage-locked muted', '아직 보유하지 않은 자동차입니다. ' + (g.parts.count >= g.parts.total ? '35개 부품이 준비됐어요. 차고에서 선택 후 확정해 주세요.' : '부품 ' + g.parts.count + ' / ' + g.parts.total + '개 · 제작대에서 조립을 계속하세요.')));
    info.append(button('차고로 돌아가기', 'secondary', () => dialog.close()));
    layout.append(figure, info);
    dialog.replaceChildren(head, layout);
    return true;
  }
  return {
    open(carKey) {
      key = carKey;
      if (!render()) { key = ''; return; }
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector('#car-title')?.focus({preventScroll: true});
    },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
