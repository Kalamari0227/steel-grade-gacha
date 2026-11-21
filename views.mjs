import {alignFeet, appearanceFor, art, asset, button, cardTitle, deco, el, gradeText, micro, stage, tile} from './ui.mjs';

// 화면 머리의 큰 진행 숫자. 같은 내용이 머리말 문장에 있으므로 화면 읽기에서는 숨긴다.
function pageCount(label, value, total) {
  const box = el('span', 'page-count');
  box.setAttribute('aria-hidden', 'true');
  const number = el('b', '', String(value));
  number.append(el('small', '', '/' + total));
  box.append(el('span', 'micro', label), number);
  return box;
}
// 로비 목표 옆의 부품 진행 수.
function goalProgress(progress) {
  const box = el('p', 'goal-progress');
  const number = el('b', '', String(progress.count));
  number.append(el('small', '', '/' + progress.total));
  box.append(micro('PARTS'), el('span', 'sr', '완성한 부품 '), number);
  return box;
}

// 출하 버튼 아래 안내. 남은 출하가 없으면 다음 기본 출하까지 남은 시간(원본 fmtWait 표기)을 보여 준다.
export function shipLeftText(status) {
  if (status.singleLeft > 0) return '남은 출하 ' + status.singleLeft + '회';
  return status.wait ? '다음 출하까지 ' + status.wait : '남은 출하 0회';
}
export function shipNoteText(status) {
  return '기본 출하는 24시간에 한 번 · 추가 출하 ' + status.extra + '회 보유';
}
function leftLabel(status) {
  const small = el('small', '', shipLeftText(status));
  small.dataset.shipLeft = '';
  return small;
}

function nextGoal(data, goal, open, progress = null) {
  if (!goal) return el('p', 'goal-empty', '현재 표시할 다음 부품이 없습니다.');
  if (goal.garage) {
    const box = el('section', 'goal');
    const info = el('div'), title = el('h2');
    if (open) {
      const link = button('', 'goal-open', () => open('garage'));
      link.append('자동차를 골라 조립하기', el('span', 'sr', ' · 차고에서 열기'));
      title.append(link);
    } else title.textContent = '자동차를 골라 조립하기';
    info.append(el('p', 'section-label', '부품 35개 완성'), title, el('p', 'muted', '차고에서 완성할 자동차를 선택하고 확정하세요.'));
    box.append(asset(data, 'car:' + goal.carKey, '', 'goal-art'), info);
    if (progress) box.append(goalProgress(progress));
    return box;
  }
  const wrap = el('section', 'goal');
  const info = el('div');
  const families = new Set();
  for (const missing of goal.missing || []) {
    for (const id of missing.ids || []) {
      const card = data.cards.find(c => c.id === id);
      if (card && card.family !== 'qp') families.add(card.familyName);
    }
  }
  const caption = goal.ready ? '제작 가능한 부품' : '다음 제작 목표';
  const title = el('h2');
  if (open) {
    const link = button('', 'goal-open', () => open(goal.partKey));
    link.append(goal.name, el('span', 'sr', ' · 제작 화면에서 열기'));
    title.append(link);
  } else title.textContent = goal.name;
  info.append(el('p', 'section-label', caption), title);
  info.append(el('p', 'muted', goal.ready ? '필요한 소재가 모였습니다.' :
    (families.size ? '더 모을 계열　' + Array.from(families).join(' · ') : '부품에 필요한 소재를 수집하세요.')));
  wrap.append(asset(data, 'part:' + goal.partKey, goal.name, 'goal-art'), info);
  if (progress) wrap.append(goalProgress(progress));
  return wrap;
}

// 로비: 밝은 공방에 대표 동료가 서 있고, 다음 제작 목표와 출하소 입구가 있다.
export function lobby(data, engine, go, openCard, openGoal) {
  const status = engine.status(), pick = engine.featured();
  const card = pick.id ? data.cards.find(c => c.id === pick.id) : null;
  const wrap = el('section', 'lobby');
  wrap.append(el('h1', 'sr', '공방'));
  const hero = el('div', 'lobby-hero');
  const side = el('div', 'lobby-side');
  if (card) {
    // 대표 동료는 장착한 보증이 있으면 그 조합의 승인 외형으로 선다(앞면). 장착이 없으면 기본 외형.
    const worn = engine.equippedKeys(card.id);
    const appearance = appearanceFor(data, card.id, 'front', worn);
    const figure = art(appearance.image, cardTitle(card) + ' 전신' + (worn.length ? ' · 보증 ' + worn.length + '종 장착' : ''), 'lobby-figure');
    alignFeet(figure, appearance);
    hero.append(figure);
    const line = data.dialogue?.find(row => row.cardId === card.id && row.side === 'front');
    if (line?.ko) hero.append(el('p', 'lobby-say', line.ko));
    wrap.dataset.family = card.family;
    const name = button('', 'lobby-name', event => openCard(card, event.currentTarget));
    const rank = el('span', 'lobby-rank', gradeText(card));
    if (card.rare) rank.append(el('span', 'lobby-rare', 'RARE'));
    const title = el('span', 'lobby-title', card.familyName + ' ');
    title.append(el('b', '', card.grade));
    name.append(micro('FEATURED · 로비 대표'), rank, title, el('span', 'sr', ' 카드 열기'));
    side.append(name);
  } else {
    hero.classList.add('empty');
    hero.append(asset(data, 'draw:coil-pack', '출하를 기다리는 코일', 'lobby-coil'));
    side.append(el('p', 'lobby-empty', '아직 동료가 없습니다. 코일을 출하해 첫 동료를 만나 보세요.'));
  }
  const actions = el('div', 'lobby-actions');
  const enter = button('', 'primary lobby-ship', () => go('ship'));
  enter.append(deco(data, 'draw:coil-pack', 'lobby-ship-art'), el('strong', '', '코일 출하'), leftLabel(status));
  const partList = engine.partList();
  actions.append(nextGoal(data, engine.nextGoal(), openGoal, {count: partList.count, total: partList.total}), enter);
  side.append(actions);
  wrap.append(hero, side);
  return wrap;
}

// 표시용 등급 확률. 원본 LVRATE(1:45%, 2:35%, 3:15%, 4:5%)와 같은 값이며 추첨에는 쓰지 않는다.
const RATES = [['★5', '5%'], ['★4', '15%'], ['★3', '35%'], ['★2', '45%']];

// 출하소: 코일과 실루엣(미발견 동료를 드러내지 않는다), 확률 띠, 1회·10연 버튼.
export function shipyard(data, engine, ship, go, exchange) {
  const status = engine.status();
  const wrap = el('section', 'shipyard');
  const head = el('header', 'ship-head');
  head.append(button('‹ 공방', 'back-link', () => go('workshop')), micro('01 — SHIPMENT'), el('p', 'section-label', '정기 출하'),
    el('h1', '', '코일 출하소'), el('p', '', '봉인을 열고 새로운 동료를 만나세요.'));
  const scene = el('div', 'ship-scene');
  const cast = el('div', 'ship-cast');
  cast.setAttribute('aria-hidden', 'true');
  for (const family of ['ssial', 'poo', 'ga']) cast.append(deco(data, 'silhouette:' + family, 'ship-shade ' + family));
  // 코일 태그: 장식. 실제 수량·확률은 아래 버튼과 확률 띠가 말한다.
  const coilTag = el('div', 'coil-tag');
  coilTag.setAttribute('aria-hidden', 'true');
  coilTag.append(el('span', 'micro', 'COIL TAG'), el('b', '', '정기 출하'), el('span', '', '코일 하나에 동료 한 명'));
  scene.append(cast, asset(data, 'draw:coil-pack', '출하를 기다리는 코일', 'ship-coil'), coilTag);
  const side = el('div', 'ship-side');
  const rates = el('ul', 'ship-rates');
  rates.setAttribute('aria-label', '등급별 등장 확률');
  for (const [star, rate] of RATES) {
    const row = el('li');
    row.append(el('span', '', star), el('b', '', rate));
    rates.append(row);
  }
  const actions = el('div', 'ship-actions');
  for (const [n, title, sub, cls, disabled] of [
    [1,'1회 출하', leftLabel(status), 'primary', status.singleLeft < 1],
    [10,'10연 출하', el('small', '', '스크랩 20 소모'), 'secondary', !status.canTen]
  ]) {
    const control = button('', 'ship-button ' + cls, () => ship(n));
    control.dataset.count = String(n);
    control.append(el('strong', '', title), sub);
    control.disabled = Boolean(disabled || status.blocked);
    actions.append(control);
  }
  const swap = el('div', 'ship-exchange');
  swap.setAttribute('role', 'group');
  swap.setAttribute('aria-label', '스크랩 확정 교환');
  for (const row of status.exchanges) {
    const control = button('', 'ship-button secondary', () => exchange(row.lv));
    control.dataset.exchange = String(row.lv);
    control.append(el('strong', '', 'LV' + row.lv + ' 확정 교환'), el('small', '', '스크랩 ' + row.cost + ' 소모'));
    control.disabled = !row.can;
    swap.append(control);
  }
  const note = el('p', 'ship-note', shipNoteText(status));
  note.dataset.shipNote = '';
  side.append(rates, actions, swap, note);
  wrap.append(head, scene, side);
  return wrap;
}

// 출하 결과: 마지막 출하(1회·10연·확정 교환)를 다시 보여 준다. 재고는 저장된 스냅샷이 아니라 지금 재고다.
// 재고가 2장 이상인 카드에만 스크랩 버튼을 둔다(마지막 1장은 보존). 한 번에 한 장씩만 바꾼다.
export function results(data, state, goal, {openCard, go, replay, openGoal, scrap, stock}) {
  const result = state.results;
  const wrap = el('section', 'results');
  const header = el('header', 'page-title');
  const title = el('h1', '', result.exchange ? 'LV' + result.exchange + ' 확정 교환 결과' : '출하 결과');
  const count = result.cards.filter(card => card.isNew).length;
  header.append(micro('RECEIVING REPORT'), title, el('p', 'muted', result.cards.length + (result.exchange ? '장 교환' : '장 출하') + ' · 새 발견 ' + count + '종'));
  wrap.append(header);
  const single = result.cards.length === 1;
  const grid = el('div', single ? 'single-result' : 'tile-grid result-grid');
  const entries = [];
  for (const entry of result.cards) {
    const card = data.cards.find(c => c.id === entry.id);
    const note = el('p', single ? '' : 'tile-note');
    const row = {card, entry, note, host: null, focus: null, control: null, done: null};
    row.text = now => (entry.isNew ? '새 발견' : '재발견') + ' · 재고 ' + (now[card.id] || 0);
    if (single) {
      const appearance = data.appearances.find(a => a.cardId === card.id && a.side === 'front' && !a.equipmentKeys.length);
      const info = el('div');
      const open = button('동료 카드 열기', 'primary', event => openCard(card, event.currentTarget));
      info.append(el('p', 'detail-rank', gradeText(card)), el('h2', '', cardTitle(card)), note, open);
      row.host = info; row.focus = open;
      grid.append(stage(data, card, appearance), info);
    } else {
      const box = tile(data, card, true, openCard, '');
      box.querySelector('.tile-note')?.remove();
      note.className = 'tile-note';
      box.append(note);
      row.host = box; row.focus = box.querySelector('.tile-open');
      grid.append(box);
    }
    entries.push(row);
  }
  let busy = false;
  function sync(clicked) {
    const now = stock();
    for (const row of entries) {
      const left = now[row.card.id] || 0;
      row.note.textContent = row.text(now);
      if (left >= 2) {
        if (!row.control) {
          row.control = button('', 'secondary scrap-button', () => run(row));
          row.control.dataset.scrapId = row.card.id;
          row.host.append(row.control);
        }
        row.control.replaceChildren(el('strong', '', '스크랩 +1'), el('small', '', '재고 ' + left + ' → ' + (left - 1)));
        row.control.setAttribute('aria-label', '스크랩 +1 · ' + cardTitle(row.card) + ' 1장을 바꿉니다, 재고 ' + left + '장에서 ' + (left - 1) + '장');
      } else if (row.control) {
        row.control.remove(); row.control = null;
        if (row === clicked) {
          row.done = el('p', 'scrap-done', '스크랩 +1 · 재고 ' + left + '장');
          row.done.setAttribute('role', 'status');
          row.host.append(row.done);
        }
      }
    }
  }
  async function run(row) {
    if (busy) return;
    busy = true;
    const control = row.control;
    control.disabled = true;
    const outcome = await scrap(row.card.id);
    busy = false;
    if (control.isConnected) control.disabled = false;
    if (!outcome.ok) return;
    const wasFocused = document.activeElement === control || document.activeElement === document.body;
    sync(row);
    if (wasFocused && !row.control) row.focus?.focus({preventScroll: true});
    else if (row.control) row.control.focus({preventScroll: true});
  }
  sync();
  wrap.append(grid, nextGoal(data, goal, openGoal));
  const footer = el('div', 'result-actions');
  if (!single && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    footer.append(button('10연 공개 다시 보기', 'secondary', () => replay(result)));
  }
  footer.append(button('도감에서 보기', 'primary', () => go('collection')), button('공방으로', 'secondary', () => go('workshop')));
  wrap.append(footer);
  return wrap;
}

const PART_STATE = {done: '완성', ready: '제작 가능', short: '소재 부족'};
// 제작 탭: 부품 35를 원본 그룹(바디·프레임·섀시 · 구동)으로 묶어 보여 준다. 그림은 승인된 part:* 만 쓴다.
export function crafting(data, list, openPart) {
  const wrap = el('section', 'crafting');
  const header = el('header', 'page-title');
  header.append(micro('03 — WORK ORDER'), el('h1', '', '제작'), el('p', 'muted', '완성 ' + list.count + ' / ' + list.total + ' · 제작 가능 ' + list.ready), pageCount('PARTS', list.count, list.total));
  // 35칸 눈금: 완성은 먹색, 지금 만들 수 있는 것은 노랑.
  const all = list.groups.flatMap(group => group.parts).sort((a, b) => a.no - b.no);
  const meter = el('div', 'meter');
  meter.setAttribute('aria-hidden', 'true');
  for (const part of all) meter.append(el('i', part.state === 'done' ? 'f' : part.state === 'ready' ? 'r' : ''));
  header.append(meter);
  wrap.append(header);
  // 지금 만들 수 있는 부품을 맨 위에 고정한다. 아래 목록의 같은 부품과 같은 상세를 연다.
  const readyParts = all.filter(part => part.state === 'ready');
  if (readyParts.length) {
    const now = el('section', 'ready-now');
    const nowTitle = el('h2', 'ready-title', '지금 제작 가능 ');
    nowTitle.id = 'ready-now-title';
    nowTitle.append(el('b', '', String(readyParts.length)));
    now.setAttribute('aria-labelledby', nowTitle.id);
    now.append(nowTitle);
    // 고정 목록은 세 개까지만. 나머지는 아래 목록에 노랑 표시로 남는다.
    for (const part of readyParts.slice(0, 3)) {
      const row = button('', 'ready-row', event => openPart(part.key, event.currentTarget));
      row.dataset.readyKey = part.key;
      const text = el('span', 'ready-text');
      text.append(micro('NO. ' + String(part.no).padStart(2, '0')), el('strong', '', part.name));
      row.append(deco(data, 'part:' + part.key, 'ready-art'), text, el('span', 'ready-go', '제작'));
      now.append(row);
    }
    if (readyParts.length > 3) now.append(el('p', 'ready-more', '외 ' + (readyParts.length - 3) + '개는 아래 목록에 노랑으로 표시됩니다.'));
    wrap.append(now);
  }
  for (const group of list.groups) {
    if (!group.parts.length) continue;
    const box = el('section', 'part-group');
    const heading = el('h2', '', group.name);
    heading.id = 'part-group-' + list.groups.indexOf(group);
    box.setAttribute('aria-labelledby', heading.id);
    heading.append(el('span', 'part-group-count', group.parts.filter(p => p.state === 'done').length + ' / ' + group.parts.length));
    const grid = el('div', 'part-grid');
    for (const part of group.parts) {
      const cell = button('', 'pcell ' + part.state, event => openPart(part.key, event.currentTarget));
      cell.dataset.partKey = part.key;
      cell.append(el('span', 'pno', String(part.no).padStart(2, '0')), deco(data, 'part:' + part.key, 'pcell-art', true),
        el('span', 'pnm', part.name), el('span', 'part-state', PART_STATE[part.state]));
      grid.append(cell);
    }
    box.append(heading, grid);
    wrap.append(box);
  }
  return wrap;
}

function qpTask(data, status, develop) {
  const box = el('section', 'qp-task');
  box.setAttribute('aria-labelledby', 'qp-task-title');
  const title = el('h2', '', '선행개발 과제 · 1470 QP');
  title.id = 'qp-task-title';
  const name = id => { const c = data.cards.find(card => card.id === id); return c ? c.familyName + ' ' + c.grade : id; };
  const list = el('ul');
  for (const slot of status.slots) {
    const row = el('li');
    row.append(el('span', '', slot.name), el('b', '', slot.use ? name(slot.use) + ' 1장' : '재고 없음 · ' + slot.ids.map(name).join(' 또는 ')));
    list.append(row);
  }
  const scrap = el('li');
  scrap.append(el('span', '', '스크랩'), el('b', '', status.scrap >= status.scrapNeed ? status.scrap + ' → ' + (status.scrap - status.scrapNeed) + '장' : '보유 ' + status.scrap + ' / 필요 ' + status.scrapNeed + '장'));
  list.append(scrap);
  const note = el('p', '', status.ready ? '담금질로 강도를, 탄소 분배로 연성을 합칩니다. 개발한 QP는 1470급 칸을 소모 없이 채웁니다.' : '소재나 스크랩이 모자랍니다.');
  note.setAttribute('role', 'status');
  const actions = el('div', 'qp-actions');
  const run = button(status.ready ? '개발하기 — 재고 2장 · 스크랩 ' + status.scrapNeed + '장' : '개발 조건 부족', 'primary', event => develop(event.currentTarget));
  run.disabled = !status.ready;
  actions.append(run, note);
  box.append(el('p', 'section-label', '1470급 세 종을 모두 발견해 과제가 열렸습니다'), title, list, actions);
  return box;
}

export function collection(data, state, openCard, qp = null) {
  const wrap = el('section', 'collection');
  const available = data.cards.filter(c => c.family !== 'qp' || state.owned[c.id]);
  const header = el('header', 'page-title');
  const found = available.filter(c => state.owned[c.id]).length;
  header.append(micro('02 — INDEX'), el('h1', '', '동료 도감'), el('p', 'muted', '발견 ' + found + ' / ' + available.length + '종'), pageCount('DISCOVERED', found, available.length));
  const filters = el('div', 'filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', '계열 선택');
  // 강종 대장: 계열별로 묶고 자료 순서 그대로 둔다. 빈칸이 제자리에 남아 무엇이 비었는지 보인다.
  const grid = el('div', 'tile-groups');
  const families = data.families.filter(f => available.some(c => c.family === f.key));
  const tally = key => {
    const list = available.filter(c => !key || c.family === key);
    return list.filter(c => state.owned[c.id]).length + '/' + list.length;
  };
  function show(key) {
    for (const option of filters.children) option.setAttribute('aria-pressed', String(option.dataset.family === key));
    grid.replaceChildren(...families.filter(f => !key || f.key === key).map(f => {
      const group = el('section', 'fam-group');
      group.dataset.family = f.key;
      const head = el('h2', 'fam-head');
      const dot = el('i', 'fam-dot');
      dot.setAttribute('aria-hidden', 'true');
      head.append(dot, f.name, micro(f.kind), el('b', '', tally(f.key)));
      const tiles = el('div', 'tile-grid');
      tiles.append(...available.filter(c => c.family === f.key).map(card => tile(data, card, Boolean(state.owned[card.id]), openCard)));
      group.append(head, tiles);
      return group;
    }));
  }
  for (const f of [{key:'', name:'전체'}, ...families]) {
    const choice = button(f.name, '', () => show(f.key));
    choice.dataset.family = f.key;
    const count = el('small', '', tally(f.key));
    count.setAttribute('aria-hidden', 'true');
    choice.append(count);
    filters.append(choice);
  }
  show('');
  wrap.append(header);
  if (qp?.status.revealed && !qp.status.owned) wrap.append(qpTask(data, qp.status, qp.develop));
  wrap.append(filters, grid);
  return wrap;
}

export const VIEWS = ['ship', 'results', 'collection', 'crafting', 'garage', 'research'];

// 연구: 고객 요구서(회신란이 있는 서류)와 보증서 14종. 퀴즈는 4단계에서 같은 탭에 열린다.
// 회신·장착의 판정과 저장은 엔진 명령이 하고, 여기서는 보여 주고 고른 값을 넘기기만 한다.
// h: {reply(key, day, answer) → 결과, openEquip(key, opener), openCard(cardId, opener), refresh(message), fresh: 방금 정답으로 얻은 보증 키 또는 ''}
// 철강 퀴즈 안내서(연구 탭 맨 앞): 보유 추가 출하·보상 잔여·갱신 시각과 시작 버튼. 숫자는 모두 엔진 조회(engine.quiz)다.
function quizSheet(q, h) {
  const sheet = el('section', 'quiz-note');
  const title = el('h2', '', '철강 퀴즈');
  title.id = 'quiz-note-title';
  sheet.setAttribute('aria-labelledby', title.id);
  sheet.append(micro('QUIZ'), title, el('p', 'order-meta', '5문제를 모두 맞추면 추가 출하 1회를 받아요 · 한 판은 5문제'));
  const facts = el('dl', 'quiz-facts');
  const row = (label, value, extra = '') => {
    const box = el('div', extra);
    box.append(el('dt', '', label), el('dd', '', value));
    facts.append(box);
  };
  row('보유 추가 출하', q.extra + '회');
  row('보상 잔여', q.left + ' / ' + q.max + '회');
  if (q.windowOpen) row('갱신', q.renewText);
  sheet.append(facts);
  if (q.promo) sheet.append(el('p', 'order-note', '품질 교육 주간에는 보상 한도가 ' + q.max + '회예요.'));
  // 노랑(primary)은 한 화면에 한 곳이다. 정답 직후의 '보유 소재에 장착'이 이미 그 자리를 쓰고 있으면 먹색 선 버튼이 된다.
  const start = button('퀴즈 시작', h.fresh ? 'secondary' : 'primary', async () => {
    if (start.disabled) return;
    start.disabled = true;
    const outcome = await h.openQuiz(start);
    if (!outcome.ok) { start.disabled = false; if (outcome.error) status.textContent = outcome.error; }
  });
  start.id = 'quiz-start';
  const status = el('p', 'quiz-status');
  status.id = 'quiz-status';
  status.setAttribute('role', 'status');
  if (!q.canStart) {
    start.disabled = true;
    start.setAttribute('aria-describedby', status.id);
    status.textContent = q.blocked ? '저장 상태를 확인할 때까지 퀴즈를 시작할 수 없어요.' : '보상 잔여 횟수를 모두 사용했어요.' + (q.windowOpen ? ' ' + q.renewText + '에 갱신돼요.' : '');
  }
  sheet.append(start, status);
  return sheet;
}

// 현장 소식지 줄(연구 탭): 가장 새 회차와 NEW 표시, 목록을 여는 버튼. 노랑은 퀴즈 시작이 쓰므로 먹색 선 버튼이다.
export function toonSheet(t, h) {
  const sheet = el('section', 'toon-note');
  sheet.id = 'toon-note';
  const title = el('h2', '', '현장 소식지');
  title.id = 'toon-note-title';
  sheet.setAttribute('aria-labelledby', title.id);
  const last = t.episodes[t.episodes.length - 1];
  const line = el('p', 'order-meta', last.no + ' 「' + last.title + '」 공개 ');
  if (t.hasNew) line.append(el('span', 'toon-stamp', 'NEW'));
  sheet.append(micro('SITE BULLETIN'), title, line);
  const open = button('소식지 보기', 'secondary', () => h.openToon(open));
  open.id = 'toon-open';
  open.setAttribute('aria-label', '현장 소식지 보기' + (t.hasNew ? ', 새 회차 ' + t.newCount + '편' : ''));
  sheet.append(open);
  return sheet;
}

export function research(data, order, ware, h, {go, notice = '', quiz = null, toon = null}) {
  const wrap = el('section', 'research');
  const header = el('header', 'page-title');
  header.append(micro('05 — LAB'), el('h1', '', '연구'), el('p', 'muted', '고객 요구에 답해 보증 장비를 얻어요 · 보증 ' + ware.owned + ' / ' + ware.total + '종'), pageCount('WARRANTY', ware.owned, ware.total));
  wrap.append(header);
  if (quiz) wrap.append(quizSheet(quiz, h));
  if (toon) wrap.append(toonSheet(toon, h));

  const sheet = el('section', 'order-sheet');
  sheet.dataset.state = order.state;
  const title = el('h2', '', '오늘의 고객 요구');
  title.id = 'order-title';
  title.tabIndex = -1;
  sheet.setAttribute('aria-labelledby', title.id);
  const status = el('p', 'order-status', notice);
  status.id = 'order-status';
  status.tabIndex = -1;
  status.setAttribute('role', 'status');
  sheet.append(micro('CUSTOMER REQUEST'), title,
    el('p', 'order-meta', '오늘 회신 잔여 ' + order.left + ' / ' + order.max + '건 · 보유 보증 ' + order.owned + ' / ' + order.total + '종'));
  const name = id => { const c = data.cards.find(card => card.id === id); return c ? c.familyName + ' ' + c.grade : id; };
  if (order.state === 'all') sheet.append(status, el('p', 'order-empty', '고객 요구 ' + order.total + '종에 모두 대응했어요.'));
  else if (order.state === 'none') sheet.append(status, el('p', 'order-empty', '현재 보유 소재로 대응할 수 있는 요구가 없어요. 새로운 소재를 발견하면 다시 확인하세요.'));
  else {
    const o = order.order;
    const ask = el('div', 'order-ask');
    ask.append(el('h3', '', o.from), el('blockquote', '', o.ask));
    sheet.append(ask, status);
    if (order.state === 'earned') {
      const done = el('div', 'order-earned');
      done.append(deco(data, 'item:' + o.key, 'order-item-art'));
      const text = el('div');
      text.append(el('strong', '', o.item.tag + ' · 대응 완료'), el('p', '', o.yes),
        el('p', 'order-fit', order.equippedTo ? '장착 · ' + name(order.equippedTo) : '미장착 · 보유 소재를 선택할 수 있어요'));
      done.append(text);
      sheet.append(done);
      const fresh = h.fresh === o.key && !order.equippedTo;
      if (!order.equippedTo && order.candidates.length) {
        const row = el('div', 'order-actions');
        const equip = button('보유 소재에 장착', fresh ? 'primary' : 'secondary', event => h.openEquip(o.key, event.currentTarget));
        equip.dataset.equipOpen = o.key;
        row.append(equip);
        if (fresh) row.append(button('나중에', 'secondary', () => h.later()));
        sheet.append(row);
      }
    } else if (order.state === 'open') {
      const fieldset = el('fieldset', 'reply-field');
      const legend = el('legend', '', '회신란 · 요구에 맞는 보증 항목을 골라 주세요');
      fieldset.append(legend);
      const choices = el('div', 'reply-choices');
      let busy = false;
      for (const item of order.choices) {
        const choice = button('', 'reply-choice', async () => {
          if (busy || choice.disabled) return;
          busy = true;
          choices.querySelectorAll('button').forEach(b => { b.dataset.wasDisabled = String(b.disabled); b.disabled = true; });
          const outcome = await h.reply(o.key, order.day, item.key);
          busy = false;
          if (!outcome.ok) { h.refresh(outcome.error); return; }
          if (outcome.correct) { h.refresh(null); return; }
          choices.querySelectorAll('button').forEach(b => { b.disabled = b.dataset.wasDisabled === 'true'; });
          choice.disabled = true;
          choice.classList.add('wrong');
          status.replaceChildren(el('strong', '', item.tag + ' · 이 항목은 아니에요'), el('span', '', ' ' + outcome.no));
          status.focus({preventScroll: true});
        });
        choice.dataset.choice = item.key;
        choice.append(el('b', '', item.tag), el('span', '', item.sub));
        choices.append(choice);
      }
      fieldset.append(choices);
      sheet.append(fieldset);
    } else sheet.append(el('p', 'order-empty', '오늘 회신 횟수를 모두 사용했어요. 다음 날 다시 확인하세요.'));
  }
  sheet.append(el('p', 'order-note', '보증은 소재에 장착하는 항목입니다. 제작 재료나 추가 출하 보상이 아니며, 장착해도 소재 재고를 사용하지 않아요.'));
  wrap.append(sheet);

  const list = el('section', 'warranty-list');
  const listTitle = el('h2', '', '보증서 ');
  listTitle.id = 'warranty-title';
  listTitle.append(el('b', '', ware.owned + ' / ' + ware.total));
  list.setAttribute('aria-labelledby', listTitle.id);
  const grid = el('div', 'warranty-grid');
  for (const item of ware.items) {
    const text = item.state === 'equipped' ? '장착 · ' + name(item.cardId) : item.state === 'owned' ? '보유 · 미장착' : '미획득';
    const body = [deco(data, 'item:' + item.key, 'warranty-art'), el('strong', '', item.tag), el('span', '', item.sub),
      ...(item.scope ? [el('span', 'warranty-scope', '적용 · ' + item.scope)] : []), el('small', 'warranty-state', text)];
    let cell;
    if (item.state === 'locked') {
      cell = el('div', 'warranty locked');
      cell.append(...body);
    } else {
      cell = button('', 'warranty ' + item.state, event => {
        if (item.state === 'owned') h.openEquip(item.key, event.currentTarget);
        else h.openCard(item.cardId, event.currentTarget);
      });
      // 이름에 상태와 누르면 열리는 곳을 함께 담는다(화면 읽기에서 미장착·장착이 들리도록).
      cell.setAttribute('aria-label', item.tag + ' · ' + text + (item.state === 'owned' ? ' · 장착할 소재 고르기' : ' · 동료 카드 열기'));
      cell.append(...body);
    }
    cell.dataset.warrantyKey = item.key;
    grid.append(cell);
  }
  list.append(listTitle, grid);
  wrap.append(list);

  wrap.append(button('공방으로', 'secondary', () => go('workshop')));
  return wrap;
}

// 차고: 위쪽은 조립 진행·차량 선택·확정, 아래쪽은 차량 8종. 선택만으로는 저장이 바뀌지 않는다(확정 명령만 바꾼다).
export function garage(data, g, {go, openCar, take, notice = '', taken = ''}) {
  const wrap = el('section', 'garage');
  const header = el('header', 'page-title');
  header.append(micro('04 — GARAGE'), el('h1', '', '차고'), el('p', 'muted', '조립 ' + g.parts.count + ' / ' + g.parts.total + '개 부품 · 수집 ' + g.owned + ' / ' + g.total + '종'), pageCount('CARS', g.owned, g.total));
  const ready = g.parts.count >= g.parts.total, box = el('section', 'garage-assembly');
  const title = el('h2', '', g.complete ? '자동차 ' + g.total + '종을 모두 모았어요' : ready ? '완성할 자동차를 선택하세요' : '다음 자동차를 조립해요');
  title.id = 'car-assembly-title';
  title.tabIndex = -1;
  box.setAttribute('aria-labelledby', title.id);
  const status = el('p', 'car-status', notice);
  status.id = 'car-status';
  status.tabIndex = -1;
  status.setAttribute('role', 'status');
  box.append(title, status);
  if (g.complete) {
    box.append(el('p', '', '모은 자동차와 소재는 계속 살펴볼 수 있어요.'), button('모은 자동차 보기', 'secondary', () => wrap.querySelector('.garage-card.owned')?.focus()));
  } else if (!ready) {
    const bar = el('progress');
    bar.value = g.parts.count;
    bar.max = g.parts.total;
    bar.setAttribute('aria-label', '현재 자동차 부품 조립');
    box.append(bar, el('p', '', '완성까지 부품 ' + (g.parts.total - g.parts.count) + '개 · 지금 제작 가능한 부품 ' + g.parts.ready + '개'),
      button('제작대에서 조립 계속하기', 'primary', () => go('crafting')));
  } else {
    box.append(el('p', '', '선택을 확정하면 현재 부품 ' + g.parts.total + '개가 자동차에 조립됩니다. 다음 자동차는 새 부품을 모아 만들어요.'));
    const options = el('div', 'garage-options');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', '완성할 자동차');
    const confirm = el('div', 'garage-confirm');
    confirm.hidden = true;
    for (const car of g.cars) {
      const option = button('', 'garage-option', () => {
        for (const other of options.children) other.setAttribute('aria-pressed', String(other === option));
        const heading = el('h3', '', car.tag + ' · ' + car.body);
        heading.id = 'car-choice-title';
        heading.tabIndex = -1;
        const go1 = button(car.tag + ' · 조립 확정', 'primary', async () => {
          go1.disabled = true;
          await take(car.key);
        });
        const cancel = button('선택 취소', 'secondary', () => {
          confirm.hidden = true;
          confirm.replaceChildren();
          option.setAttribute('aria-pressed', 'false');
          option.focus({preventScroll: true});
        });
        const delta = el('dl');
        for (const [name, value] of [['현재 조립 부품', g.parts.total + ' → 0개'], ['수집 자동차', g.owned + ' → ' + (g.owned + 1) + ' / ' + g.total + '종']]) {
          const row = el('div');
          row.append(el('dt', '', name), el('dd', '', value));
          delta.append(row);
        }
        confirm.replaceChildren(heading, el('p', '', car.maker), el('p', '', car.line), el('p', 'muted', '미보유 자동차 · 아직 차고에 등록되지 않았어요.'), delta, go1, cancel);
        confirm.hidden = false;
        heading.focus({preventScroll: true});
      });
      option.dataset.k = car.key;
      option.setAttribute('aria-label', car.tag + ' ' + car.body + (car.owned ? ' 보유' : ''));
      option.setAttribute('aria-pressed', 'false');
      option.disabled = car.owned;
      option.append(asset(data, 'car:' + car.key, '', 'garage-art', true), el('strong', '', car.tag), el('span', '', car.body), el('small', '', car.owned ? '보유' : '미보유 · 조립 미리보기'));
      options.append(option);
    }
    box.append(options, confirm);
  }
  const shelf = el('section', 'garage-shelf');
  const shelfTitle = el('h2', '', '모은 자동차');
  shelfTitle.id = 'car-shelf-title';
  shelf.setAttribute('aria-labelledby', shelfTitle.id);
  const grid = el('div', 'garage-grid');
  for (const car of g.cars) {
    const card = button('', 'garage-card ' + (car.owned ? 'owned' : 'waiting') + (taken === car.key ? ' just-done' : ''), event => openCar(car.key, event.currentTarget));
    card.dataset.carKey = car.key;
    card.setAttribute('aria-label', car.tag + (car.owned ? ' 자세히 보기' : ' 미보유 미리보기'));
    if (car.owned) card.append(asset(data, 'car:' + car.key, '', 'garage-art', true));
    else card.append(el('span', 'garage-empty', '미보유 · 미리보기'));
    card.append(el('strong', '', car.tag), el('span', '', car.body), el('small', '', car.owned ? '보유' : '35개 부품으로 완성'));
    grid.append(card);
  }
  shelf.append(shelfTitle, grid);
  wrap.append(header, box, shelf);
  return wrap;
}
