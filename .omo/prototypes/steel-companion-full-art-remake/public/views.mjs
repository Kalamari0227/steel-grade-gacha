import {alignFeet, art, asset, button, cardTitle, deco, el, gradeText, stage, tile} from './ui.mjs';

function nextGoal(data, goal) {
  if (!goal) return el('p', 'goal-empty', '현재 표시할 다음 부품이 없습니다.');
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
  info.append(el('p', 'section-label', caption), el('h2', '', goal.name));
  info.append(el('p', 'muted', goal.ready ? '필요한 소재가 모였습니다.' :
    (families.size ? '더 모을 계열　' + Array.from(families).join(' · ') : '부품에 필요한 소재를 수집하세요.')));
  wrap.append(asset(data, 'part:' + goal.partKey, goal.name, 'goal-art'), info);
  return wrap;
}

// 로비: 밝은 공방에 대표 동료가 서 있고, 다음 제작 목표와 출하소 입구가 있다.
export function lobby(data, engine, go, openCard) {
  const status = engine.status(), pick = engine.featured();
  const card = pick.id ? data.cards.find(c => c.id === pick.id) : null;
  const wrap = el('section', 'lobby');
  wrap.append(el('h1', 'sr', '공방'));
  const hero = el('div', 'lobby-hero');
  const side = el('div', 'lobby-side');
  if (card) {
    const appearance = data.appearances.find(a => a.cardId === card.id && a.side === 'front' && !a.equipmentKeys.length);
    const figure = art(appearance.image, cardTitle(card) + ' 전신', 'lobby-figure');
    alignFeet(figure, appearance);
    hero.append(figure);
    const line = data.dialogue?.find(row => row.cardId === card.id && row.side === 'front');
    if (line?.ko) hero.append(el('p', 'lobby-say', line.ko));
    const name = button('', 'lobby-name', event => openCard(card, event.currentTarget));
    const rank = el('span', 'lobby-rank', gradeText(card));
    if (card.rare) rank.append(el('span', 'lobby-rare', 'RARE'));
    const title = el('span', 'lobby-title', card.familyName + ' ');
    title.append(el('b', '', card.grade));
    name.append(rank, title, el('span', 'sr', ' 카드 열기'));
    side.append(name);
  } else {
    hero.classList.add('empty');
    hero.append(asset(data, 'draw:coil-pack', '출하를 기다리는 코일', 'lobby-coil'));
    side.append(el('p', 'lobby-empty', '아직 동료가 없습니다. 코일을 출하해 첫 동료를 만나 보세요.'));
  }
  const actions = el('div', 'lobby-actions');
  const enter = button('', 'primary lobby-ship', () => go('ship'));
  enter.append(deco(data, 'draw:coil-pack', 'lobby-ship-art'), el('strong', '', '코일 출하'), el('small', '', '남은 출하 ' + status.singleLeft + '회'));
  actions.append(nextGoal(data, engine.nextGoal()), enter);
  side.append(actions);
  wrap.append(hero, side);
  return wrap;
}

// 표시용 등급 확률. 원본 LVRATE(1:45%, 2:35%, 3:15%, 4:5%)와 같은 값이며 추첨에는 쓰지 않는다.
const RATES = [['★5', '5%'], ['★4', '15%'], ['★3', '35%'], ['★2', '45%']];

// 출하소: 코일과 실루엣(미발견 동료를 드러내지 않는다), 확률 띠, 1회·10연 버튼.
export function shipyard(data, engine, ship, go, refill) {
  const status = engine.status();
  const wrap = el('section', 'shipyard');
  const head = el('header', 'ship-head');
  head.append(button('‹ 공방', 'back-link', () => go('workshop')), el('p', 'section-label', '정기 출하'),
    el('h1', '', '코일 출하소'), el('p', '', '봉인을 열고 새로운 동료를 만나세요.'));
  const scene = el('div', 'ship-scene');
  const cast = el('div', 'ship-cast');
  cast.setAttribute('aria-hidden', 'true');
  for (const family of ['ssial', 'poo', 'ga']) cast.append(deco(data, 'silhouette:' + family, 'ship-shade ' + family));
  scene.append(cast, asset(data, 'draw:coil-pack', '출하를 기다리는 코일', 'ship-coil'));
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
    [1,'1회 출하', '남은 출하 ' + status.singleLeft + '회', 'primary', status.singleLeft < 1],
    [10,'10연 출하', '스크랩 20 소모', 'secondary', !status.canTen]
  ]) {
    const control = button('', 'ship-button ' + cls, () => ship(n));
    control.append(el('strong', '', title), el('small', '', sub));
    control.disabled = Boolean(disabled || status.blocked);
    actions.append(control);
  }
  const trial = el('p', 'trial-note', '체험판 시작 지급 · 추가 출하 12회와 스크랩 60');
  if (refill) {
    const more = button('체험용 자원 채우기 (+50회 · 스크랩 +400)', 'trial-refill', refill);
    more.disabled = Boolean(status.blocked);
    trial.append(' ', more);
  }
  side.append(rates, actions, trial);
  wrap.append(head, scene, side);
  return wrap;
}

export function results(data, result, goal, openCard, go, replay) {
  const wrap = el('section', 'results');
  const header = el('header', 'page-title');
  const title = el('h1', '', '출하 결과');
  const count = result.cards.filter(card => card.isNew).length;
  header.append(title, el('p', 'muted', result.cards.length + '장 출하 · 새 발견 ' + count + '종'));
  wrap.append(header);
  const single = result.cards.length === 1;
  const grid = el('div', single ? 'single-result' : 'tile-grid result-grid');
  for (const entry of result.cards) {
    const card = data.cards.find(c => c.id === entry.id);
    const note = (entry.isNew ? '새 발견' : '재발견') + ' · 재고 ' + entry.stock;
    if (single) {
      const appearance = data.appearances.find(a => a.cardId === card.id && a.side === 'front' && !a.equipmentKeys.length);
      const info = el('div');
      info.append(el('p', 'detail-rank', gradeText(card)), el('h2', '', cardTitle(card)), el('p', '', note),
        button('동료 카드 열기', 'primary', event => openCard(card, event.currentTarget)));
      grid.append(stage(data, card, appearance), info);
    } else grid.append(tile(data, card, true, openCard, note));
  }
  wrap.append(grid, nextGoal(data, goal));
  const footer = el('div', 'result-actions');
  if (!single && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    footer.append(button('10연 공개 다시 보기', 'secondary', () => replay(result)));
  }
  footer.append(button('도감에서 보기', 'primary', () => go('collection')), button('공방으로', 'secondary', () => go('workshop')));
  wrap.append(footer);
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
  header.append(el('h1', '', '동료 도감'), el('p', 'muted', '발견 ' + available.filter(c => state.owned[c.id]).length + ' / ' + available.length + '종'));
  const filters = el('div', 'filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', '계열 선택');
  const grid = el('div', 'tile-grid');
  function show(key) {
    for (const option of filters.children) option.setAttribute('aria-pressed', String(option.dataset.family === key));
    const list = available.filter(c => !key || c.family === key);
    list.sort((a, b) => Number(Boolean(state.owned[b.id])) - Number(Boolean(state.owned[a.id])));
    grid.replaceChildren(...list.map(card => tile(data, card, Boolean(state.owned[card.id]), openCard)));
  }
  for (const f of [{key:'', name:'전체'}, ...data.families.filter(f => available.some(c => c.family === f.key))]) {
    const choice = button(f.name, '', () => show(f.key));
    choice.dataset.family = f.key;
    filters.append(choice);
  }
  show('');
  wrap.append(header);
  if (qp?.status.revealed && !qp.status.owned) wrap.append(qpTask(data, qp.status, qp.develop));
  wrap.append(filters, grid);
  return wrap;
}

const PLACEHOLDERS = {
  crafting: ['제작', '소재를 모아 부품을 만드는 작업대입니다.'],
  garage: ['차고', '완성한 부품으로 차량을 조립하는 곳입니다.'],
  research: ['연구', '퀴즈로 추가 출하를 얻는 연구실입니다.']
};
export const PLACEHOLDER_VIEWS = Object.keys(PLACEHOLDERS);

export function placeholder(key, go) {
  const [name, about] = PLACEHOLDERS[key];
  const wrap = el('section', 'placeholder');
  const header = el('header', 'page-title');
  header.append(el('h1', '', name), el('p', 'muted', about));
  const note = el('p', 'placeholder-note', '준비 중입니다. 이 화면은 이후 단계에서 열립니다.');
  note.setAttribute('role', 'status');
  wrap.append(header, note, button('공방으로', 'secondary', () => go('workshop')));
  return wrap;
}
