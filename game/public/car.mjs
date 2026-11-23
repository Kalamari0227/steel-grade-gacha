import {asset, button, el, micro} from './ui.mjs';
import {MEDAL_TEXT} from './race-store.mjs';

// 자동차 상세: 부품 상세와 같은 전체 화면 위층. 보유 차량은 받은 날, 미보유는 조립 미리보기(원본과 같은 문구).
// 보기만 하며 저장을 바꾸지 않는다.
const stamp = ts => {
  if (!ts) return '—';
  const d = new Date(ts), p = n => (n < 10 ? '0' : '') + n;
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes());
};
// race: {summary(차 키) → 코스별 메달과 가장 빠른 기록, open(차 키) → 주행 시험장을 연 결과}. 보유한 차에만 [시험 주행]을 둔다.
const clock = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
export function createCarDialog(data, engine, {onDismiss, race}) {
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
    if (car.owned) {
      info.append(el('p', 'garage-date', '받은 날 · ' + stamp(car.at)));
      // 확장 A: 코스 네 개의 메달과 가장 빠른 기록, 그리고 이 화면의 주 행동인 [시험 주행].
      const sum = race.summary(key), record = el('p', 'car-race-record'), marks = el('span', 'race-marks');
      for (const m of sum.medals) { const mark = el('span', 'race-mark', m ? MEDAL_TEXT[m] : '–'); mark.dataset.medal = m || 'none'; marks.append(mark); }
      marks.setAttribute('aria-hidden', 'true');
      const won = ['gold', 'silver', 'bronze'].map(m => [m, sum.medals.filter(x => x === m).length]).filter(([, n]) => n).map(([m, n]) => MEDAL_TEXT[m] + ' ' + n).join(' · ');
      record.append(el('span', '', '시험 주행 · ' + (sum.runs ? '가장 빠른 기록 ' + clock(sum.fastest) + ' · 메달 ' + won : '아직 기록이 없어요')), marks);
      const status = el('p', 'car-race-status'); status.setAttribute('role', 'status');
      const start = button('시험 주행', 'primary car-race', async () => {
        start.disabled = true; status.textContent = '';
        const outcome = await race.open(key);
        start.disabled = false;
        if (!outcome.ok) { status.textContent = outcome.error; start.focus({preventScroll: true}); }
      });
      start.id = 'car-race';
      info.append(record, start, status);
    }
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
    // 주행 시험장에서 돌아온 뒤: 기록 줄을 새로 그리고 초점을 [시험 주행]에 돌려준다.
    refresh() { if (dialog.open && key && render()) dialog.querySelector('#car-race')?.focus({preventScroll: true}); },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
