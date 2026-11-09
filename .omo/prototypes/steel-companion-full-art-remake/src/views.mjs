import {asset, button, cardTitle, el, gradeText, stage, tile} from './ui.mjs';

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

export function workshop(data, engine, ship, go) {
  const state = engine.state(), status = engine.status();
  const content = document.createDocumentFragment();
  const hero = el('section', 'workshop-hero');
  const view = el('div', 'workshop-scene');
  view.append(asset(data, 'scene:workshop:back', '햇빛이 들어오는 금속 공방', 'scene-bg'),
    asset(data, 'draw:coil-pack', '출하를 기다리는 코일', 'hero-coil'));
  const heading = el('div', 'hero-title');
  heading.append(el('h1', '', '코일 출하소'), el('p', '', '봉인을 열고 새로운 동료를 만나세요.'));
  view.append(heading);
  const controls = el('div', 'shipping-controls');
  const ledger = el('div', 'resources');
  ledger.append(el('strong', '', '보유 자원'), el('span', '', '추가 출하 ' + state.extra + '회'), el('span', '', '스크랩 ' + state.scrap));
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
  controls.append(ledger, actions);
  hero.append(view, controls);
  content.append(hero);
  const trial = el('p', 'trial-note', '체험판 시작 지급 · 추가 출하 12회와 스크랩 60');
  content.append(trial);
  const shelves = el('div', 'home-shelves');
  shelves.append(nextGoal(data, engine.nextGoal()));
  const collection = el('section', 'collection-link');
  collection.append(asset(data, 'scene:collection:back', '', 'collection-scene'));
  const copy = el('div');
  copy.append(el('p', 'section-label', '동료 도감'), el('h2', '', '발견한 동료 ' + Object.values(state.owned).filter(Boolean).length + '종'));
  collection.append(copy, button('도감 열기', 'quiet-light', () => go('collection')));
  shelves.append(collection);
  content.append(shelves);
  return content;
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

export function collection(data, state, openCard) {
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
  wrap.append(header, filters, grid);
  return wrap;
}
