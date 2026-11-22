import {deco, el, micro} from './ui.mjs';

// 차량 등록 장면 "출고 검사증"(2026-11-22 사용자 결정: docs/design/game-car-lineoff-2026-11-21-u0 B안).
// 저장(차고 등록)은 이 장면 전에 끝났다. 장면은 보여 주기만 하며 중간에 끊겨도 결과는 같다.
// 차량 등록 음악(4.7초, 0.55초에 한 방)에 맞춰: 검사증이 올라오고 → 한 방에 "합격" 도장 → 부품 묶음에 차례로 체크 → 새 카드 자리로 줄어들며 들어간다.
// 화면 읽기에는 차고의 상태 문구(#car-status)가 이미 알리므로 이 층은 숨긴다. 아무 곳이나 누르거나 아무 키나 누르면 넘어간다.
const HIT = 550, CHECK_AT = 900, CHECK_STEP = 500, END_AT = 3500;

// groups: 제작 화면과 같은 순서의 부품 묶음 [{name, count}] (engine.partList().groups에서 만든다).
export function deliveryScene(data, {car, owned, total, groups, target, onSkip, onEnd}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const timers = [], anims = [];
  let ended = false, leaving = false;
  const parts = groups.reduce((sum, g) => sum + g.count, 0);

  const root = el('div', 'delivery');
  root.setAttribute('aria-hidden', 'true');
  const dim = el('div', 'delivery-dim');
  const sheet = el('div', 'delivery-sheet');
  const head = el('div', 'delivery-head');
  head.append(micro('DELIVERY NOTE · 차량 출고 검사증'), el('b', '', car.tag + ' · ' + car.body));
  const figure = deco(data, 'car:' + car.key, 'delivery-art');
  const stamp = el('div', 'delivery-stamp');
  const ink = el('span', 'delivery-ink');
  ink.append('합격', el('small', '', 'PASSED · ' + parts + '/' + parts));
  stamp.append(ink);
  const list = el('div', 'delivery-checks');
  const rows = groups.map(g => {
    const row = el('div', 'delivery-check');
    row.append(el('span', '', g.name), el('b', '', String(g.count)), el('i', '', '✓'));
    list.append(row);
    return row;
  });
  const sum = el('div', 'delivery-total');
  sum.append(el('span', '', '차고 등록'), el('b', '', owned + ' / ' + total + '종'));
  list.append(sum);
  sheet.append(head, figure, stamp, list, el('span', 'delivery-skip', '눌러서 넘기기'));
  root.append(dim, sheet);

  const animate = (node, frames, options) => { const a = node.animate(frames, {fill: 'both', ...options}); anims.push(a); return a; };
  function cleanup() {
    if (ended) return false;
    ended = true;
    timers.forEach(clearTimeout);
    anims.forEach(a => a.cancel());
    root.removeEventListener('pointerdown', skip);
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    return true;
  }
  // 검사증을 새 카드 자리로 줄여 넣는다. 카드가 화면 밖이면(좁은 화면에서 아래쪽) 제자리에서 줄어들며 사라진다.
  function leave(quick) {
    if (ended || leaving) return;
    leaving = true;
    timers.forEach(clearTimeout);
    rows.forEach(r => r.classList.add('on'));
    anims.forEach(a => a.finish());
    const from = sheet.getBoundingClientRect(), to = target?.isConnected ? target.getBoundingClientRect() : null;
    const visible = to && to.width && to.bottom > 0 && to.top < innerHeight;
    const move = visible
      ? `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px,${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${Math.max(0.12, to.width / from.width)})`
      : 'scale(.9)';
    animate(dim, [{opacity: 0.35}, {opacity: 0}], {duration: quick ? 160 : 500});
    animate(sheet, [{transform: 'none', opacity: 1}, {transform: move, opacity: visible ? 0.25 : 0}], {duration: quick ? 200 : 650, easing: 'cubic-bezier(.5,0,.3,1)'})
      .finished.then(() => { if (cleanup()) onEnd(); }, () => {});
  }
  function skip(event) {
    event?.preventDefault?.();
    if (leaving) return;
    onSkip?.();
    leave(true);
  }
  function onKey(event) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) || event.repeat) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') event.preventDefault();
    skip();
  }

  document.body.append(root);
  root.addEventListener('pointerdown', skip);
  document.addEventListener('keydown', onKey, true);
  animate(dim, [{opacity: 0}, {opacity: 0.35}], {duration: 300});
  animate(sheet, [{transform: 'translateY(110%)'}, {transform: 'translateY(-1.5%)', offset: 0.85}, {transform: 'none'}], {duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)'});
  animate(stamp, [{opacity: 0, transform: 'scale(2) rotate(-24deg)'}, {opacity: 1, transform: 'scale(.92) rotate(-12deg)', offset: 0.7}, {opacity: 1, transform: 'scale(1) rotate(-12deg)'}], {duration: 240, delay: HIT, easing: 'ease-in'});
  anims.push(sheet.animate([{translate: '0 0'}, {translate: '0 4px'}, {translate: '0 -1px'}, {translate: '0 0'}], {duration: 180, delay: HIT}));
  rows.forEach((row, i) => timers.push(setTimeout(() => row.classList.add('on'), CHECK_AT + i * CHECK_STEP)));
  animate(sum, [{opacity: 0}, {opacity: 1}], {duration: 240, delay: CHECK_AT + rows.length * CHECK_STEP});
  timers.push(setTimeout(() => leave(false), END_AT));
  // 화면 이탈(다른 탭으로 이동 등): 정리만 한다. 차고는 호출한 쪽이 다시 그린다.
  return () => { cleanup(); };
}
