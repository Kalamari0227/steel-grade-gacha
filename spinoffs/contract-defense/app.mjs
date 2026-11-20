import { ART_ROOT, DEADLINE, FRIENDS, LANE_NAMES } from './first-contract.mjs';
import {
  advance,
  cancelSelection,
  createContract,
  move,
  payInspection,
  position,
  previewMove,
  selectFriend,
  shipped,
  snailLane,
  start,
  useBridge,
} from './simulation.mjs';

const el = (id) => document.getElementById(id);
const entries = Object.entries(FRIENDS);
const dialog = el('orders');
dialog.setAttribute('aria-labelledby', 'friend-name');
let game = createContract();
let destination = null;
let last = performance.now();
let lastPaint = -Infinity;

function image(friend) {
  return '<img src="' + ART_ROOT + FRIENDS[friend].art + '" alt="">';
}
function button(action, label) {
  return '<button data-action="' + action + '">' + label + '</button>';
}
function html(node, value) {
  if (node.dataset.rendered !== value) {
    node.innerHTML = value;
    node.dataset.rendered = value;
  }
}
function setText(id, value) {
  const node = el(id);
  if (node.textContent !== String(value)) node.textContent = value;
}

el('portrait').src = ART_ROOT + FRIENDS.ga.art;
el('lanes').innerHTML = LANE_NAMES.map(
  (name, lane) =>
    '<div class="lane"><span class="lane-tag">' +
    name +
    (lane === 0 ? ' · 약속 자리' : '') +
    '</span><span id="hazard-' +
    lane +
    '" class="hazard"></span><div class="track" id="track-' +
    lane +
    '"></div></div>',
).join('');
for (const [id, f] of entries) {
  const station = document.createElement('button');
  station.className = 'lane-friend';
  station.dataset.friend = id;
  station.setAttribute('aria-label', f.name + ' 선택');
  station.style.left = { cr: 22, ga: 46, wr: 67 }[id] + '%';
  station.innerHTML = image(id);
  const crew = document.createElement('button');
  crew.dataset.friend = id;
  crew.className = 'crew';
  crew.setAttribute('aria-label', f.name + ' 선택');
  crew.innerHTML =
    image(id) +
    '<span><span class="mono">' +
    f.code +
    '</span><b>' +
    f.name +
    '</b><small>' +
    f.role +
    ' · <span id="post-' +
    id +
    '"></span></small></span>';
  el('roster').append(crew);
  el('track-' + game.friends[id]).parentElement.append(station);
}
const carts = game.cargo.map((c) => {
  const node = document.createElement('span');
  node.className = 'cart' + (c.marked ? ' marked' : '');
  node.textContent = String(c.id).padStart(2, '0');
  node.title = (c.marked ? '약속 ' : '') + '상자 ' + c.id;
  el('track-' + c.lane).append(node);
  return node;
});

function announcement() {
  const t = game.elapsedMs;
  if (game.phase === 'prep')
    return '운행 예고 · B선 물류비 인상 → B선 반덤핑 관세 → A선 물류비 인상';
  if (game.phase === 'result') return '이번 계약의 운행을 마쳤습니다.';
  const waiting = game.cargo.find((c) => c.stage === 'inspection');
  if (waiting)
    return (
      'B선 · ' +
      waiting.id +
      '번 상자가 재검사 대기 중입니다. ' +
      (game.budget
        ? button('pay', '운송비 1칸으로 즉시 통과')
        : '예산 소진 · 자연 통과를 기다립니다.')
    );
  if (game.promise === 'ready')
    return '도금이가 두 상자를 지켰어요. 출항 전에 강판 다리를 펼칠 수 있습니다.';
  if (game.promise === 'used') return '강판 다리가 연결됐어요. 약속 상자가 부두로 향합니다.';
  if (t >= 140000)
    return '마지막 출하 · A선 물류비 인상. 타래가 길을 열거나 도금이가 다리를 놓을 수 있어요.';
  if (t >= 110000) return '다음 출하 · A선으로 09·10번이 옵니다. 도금이의 자리를 확인하세요.';
  if (t >= 60000)
    return '두 번째 출하 · B선에 붉은 도장 심판관이 옵니다. 씨알이 도장을 제거할 수 있어요.';
  if (t >= 50000) return '다음 출하 · B선 반덤핑 관세 예고. 검사대에 맡길 친구를 골라 보세요.';
  if (t >= 8000)
    return '첫 출하 · B선 물류비 인상. 이 노선에 친구를 보내면 운송비가 1칸 더 들어요.';
  return '곧 B선에 과적 달팽이가 들어옵니다. 타래가 있으면 수레가 앞지를 수 있어요.';
}

const promiseLabel = {
  waiting: '마지막 출하 대기',
  guarding: '약속을 지키는 중',
  broken: '약속 종료 · 일반 운송',
  used: '강판 다리 사용 완료',
  ready: '다리 준비 완료',
};
function render() {
  const t = game.elapsedMs,
    count = shipped(game),
    phase = game.phase;
  const seconds = Math.ceil((DEADLINE - t) / 1000);
  setText(
    'clock',
    String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'),
  );
  setText('count', count);
  setText('budget', game.budget);
  setText('checked', game.checked + ' / 2');
  setText(
    'phase',
    phase === 'prep'
      ? '출항 준비'
      : phase === 'result'
        ? '운행 종료'
        : game.selected
          ? '작전 정지'
          : (t >= 140000 ? '3' : t >= 60000 ? '2' : '1') + ' / 3 웨이브',
  );
  document.body.dataset.phase = phase;
  for (const [id] of entries) {
    const lane = game.friends[id];
    const station = document.querySelector('.lane-friend[data-friend="' + id + '"]');
    const row = el('track-' + lane).parentElement;
    if (station.parentElement !== row) row.append(station);
    setText('post-' + id, LANE_NAMES[lane]);
    station.disabled = phase === 'result';
    el('roster').querySelector('[data-friend="' + id + '"]').disabled = phase === 'result';
  }
  for (const c of game.cargo) {
    const node = carts[c.id - 1];
    node.hidden = c.stage === 'waiting' || c.stage === 'shipped';
    if (!node.hidden) node.style.left = position(game, c) * 100 + '%';
  }
  for (const lane of [0, 1]) {
    let hazard = '';
    if (phase === 'running' && snailLane(game) === lane)
      hazard = game.friends.wr === lane ? '달팽이 · 타래가 막는 중' : '과적 달팽이 · 지연';
    if (lane === 1 && t >= 60000 && t < 94000) hazard = '반덤핑 관세 · 도장 심판관';
    setText('hazard-' + lane, hazard);
  }
  el('track-0').classList.toggle('bridge', game.promise === 'used');
  html(el('notice'), announcement());
  let primary = '<span class="state-note">' + promiseLabel[game.promise] + '</span>';
  if (phase === 'prep') primary = button('start', '도금이에게 맡기기');
  if (phase === 'running' && game.promise === 'ready')
    primary = button('bridge', '강판 다리 펼치기');
  html(el('primary'), primary);
  const showResult = phase === 'result';
  if (showResult && el('result').hidden) {
    setText('result-title', count === 10 ? '계약 이행 완료' : '출항 시간 종료');
    const left = game.cargo
      .filter((c) => c.stage !== 'shipped')
      .map(
        (c) =>
          c.id +
          '번 · ' +
          LANE_NAMES[c.lane] +
          (c.stage === 'inspection' ? ' 검사대 대기' : ' 운송 중'),
      );
    setText(
      'result-copy',
      '복숭아 캔 ' +
        count +
        '/10상자 선적. ' +
        (count === 10 ? '비피의 복숭아 캔을 실은 배가 떠났어요.' : left.join(', ')),
    );
    el('result').hidden = false;
    el('retry').focus({ preventScroll: true });
    el('result').scrollIntoView({ block: 'nearest' });
  }
  if (!showResult) el('result').hidden = true;
}

function openOrders(id) {
  selectFriend(game, id);
  if (!game.selected) return;
  destination = null;
  const other = 1 - game.friends[id];
  const preview = previewMove(game, id, other);
  setText('friend-name', FRIENDS[id].name);
  setText('friend-role', LANE_NAMES[game.friends[id]] + ' · ' + FRIENDS[id].text);
  setText('dialog-mode', game.phase === 'prep' ? '출발 전 무료 배치' : '운행 일시 정지');
  let choices = button('preview', LANE_NAMES[other] + '으로 이동 미리보기');
  if (id === 'ga' && game.promise === 'ready') choices += button('bridge', '강판 다리 펼치기');
  html(el('destinations'), choices);
  setText('preview', '이동 비용 ' + preview.cost + '칸 · 보유 ' + game.budget + '칸');
  el('confirm').disabled = true;
  dialog.showModal();
  render();
}
function closeOrders() {
  cancelSelection(game);
  destination = null;
  dialog.close();
  last = performance.now();
  render();
}
function previewDestination() {
  const id = game.selected;
  destination = 1 - game.friends[id];
  const p = previewMove(game, id, destination);
  const cost = p.allowed ? '운송비 ' + p.cost + '칸' : '운송비 부족 · 필요 ' + p.cost + '칸';
  const target = game.cargo.filter((c) => c.lane === destination && c.stage !== 'shipped');
  const heading =
    LANE_NAMES[destination] +
    ' · ' +
    (target.length ? target[0].id + '번부터 지원' : '남은 화물 없음');
  setText(
    'preview',
    heading +
      ' · ' +
      cost +
      (p.breaksPromise ? ' · 이동하면 약속이 깨져요 · ' + game.checked + '/2' : ''),
  );
  el('confirm').disabled = !p.allowed;
}
document.addEventListener('click', (event) => {
  const control = event.target.closest('button');
  if (!control) return;
  if (control.dataset.friend) {
    openOrders(control.dataset.friend);
    return;
  }
  switch (control.dataset.action) {
    case 'preview':
      previewDestination();
      return;
    case 'start':
      start(game);
      last = performance.now();
      break;
    case 'pay':
      payInspection(game, game.cargo.find((c) => c.stage === 'inspection')?.id);
      break;
    case 'bridge':
      selectFriend(game, 'ga');
      useBridge(game);
      if (dialog.open) closeOrders();
      break;
    default:
      if (control.id === 'cancel') {
        closeOrders();
        return;
      }
      if (control.id === 'confirm' && move(game, game.selected, destination)) {
        closeOrders();
        return;
      }
      if (control.id === 'retry') {
        game = createContract();
        last = performance.now();
        render();
        el('primary').querySelector('button').focus();
        return;
      }
  }
  render();
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeOrders();
});
document.addEventListener('visibilitychange', () => {
  last = performance.now();
});
function frame(now) {
  const delta = Math.max(0, now - last);
  last = now;
  if (!document.hidden && game.phase === 'running' && !game.selected) {
    advance(game, delta);
    if (now - lastPaint > 45 || game.phase === 'result') {
      render();
      lastPaint = now;
    }
  }
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);
