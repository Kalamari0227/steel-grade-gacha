// 본 개발 3단계(고객 요구·보증 장비) 엔진 검사. 이 파일은 저장 불러오기 정합성부터 시작한다.
// 회신·장착 명령의 검사는 엔진 명령을 넣을 때 이 파일에 이어 붙인다.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';

function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []);
  return {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k)};
}
const base = createEngine({storage: memory()}).state();
const rules = createLegacy();
function seeded(extra = {}) { return JSON.stringify({...base, ...extra}); }
// 원본 fit 기준의 호환 동료 하나와 비호환 동료 하나를 항목마다 고른다.
const CHARS = rules.allChars();
const fitOf = key => CHARS.filter(c => rules.findItem(key).fit(c)).map(c => c.id);
const unfitOf = key => CHARS.map(c => c.id).filter(id => !fitOf(key).includes(id));

test('a previous-game save keeps items, orderDay, orderKey and orderDone exactly and is not held', () => {
  const shieldCard = fitOf('shield')[0], jominyCard = fitOf('jominy')[0];
  const items = {shield: shieldCard, jominy: jominyCard, arrow: 1, section: 1};
  const raw = seeded({owned: {[shieldCard]: true, [jominyCard]: true}, stock: {[shieldCard]: 1}, items, orderDay: '2026-11-14', orderKey: 'potion', orderDone: 1});
  const storage = memory(raw), e = createEngine({storage});
  assert.equal(e.status().blocked, false);
  const s = e.state();
  assert.deepEqual(s.items, items); assert.equal(s.orderDay, '2026-11-14'); assert.equal(s.orderKey, 'potion'); assert.equal(s.orderDone, 1);
  assert.equal(storage.getItem(SAVE_KEY), raw, 'loading alone writes nothing');
  // 장착한 동료의 재고가 0이어도(도감 발견은 그대로) 장착은 유효하다. 원본 fitOwned는 owned를 본다.
  assert.equal(createEngine({storage: memory(seeded({owned: {[jominyCard]: true}, stock: {}, items: {jominy: jominyCard}}))}).status().blocked, false);
  // 원본 applySaved: 항목이 없거나 null인 옛 저장은 기본값으로 이어받는다.
  const old = createEngine({storage: memory(JSON.stringify({owned: {}, items: null, orderDay: null}))});
  assert.equal(old.status().blocked, false); assert.deepEqual(old.state().items, {}); assert.equal(old.state().orderDay, '');
});

test('items with an unknown key, unknown card, incompatible card or unowned card are held, and nothing is overwritten', () => {
  const card = fitOf('shield')[0], wrong = unfitOf('shield')[0];
  const cases = [
    ['unknown key', {owned: {[card]: true}, items: {tea: 1}}],
    ['unknown card', {owned: {[card]: true}, items: {shield: 'zz-999'}}],
    ['incompatible card', {owned: {[card]: true, [wrong]: true}, items: {shield: wrong}}],
    ['card not owned', {owned: {}, items: {shield: card}}],
    ['value 2', {items: {shield: 2}}],
    ['value 0', {items: {shield: 0}}],
    ['value true', {items: {shield: true}}],
    ['value object', {items: {shield: {id: card}}}],
    ['items array', {items: ['shield']}],
    ['orderKey unknown', {orderKey: 'tea'}],
    ['orderKey number', {orderKey: 3}],
    ['orderDone negative', {orderDone: -1}],
    ['orderDone fraction', {orderDone: 1.5}],
    ['orderDone string', {orderDone: '1'}],
    ['orderDay number', {orderDay: 20261115}]
  ];
  for (const [name, extra] of cases) {
    const raw = seeded(extra), storage = memory(raw), e = createEngine({storage});
    assert.equal(e.status().blocked, true, name);
    assert.equal(e.ship(1).ok, false, name);
    assert.equal(storage.getItem(SAVE_KEY), raw, name + ' keeps the stored save');
    assert.equal(e.backup(), raw, name + ' backup is the raw save');
  }
});

test('every compatible pair loads and every incompatible pair is held, for all 14 items and 45 cards', () => {
  let ok = 0, held = 0;
  for (const item of rules.ITEMS) for (const c of CHARS) {
    const e = createEngine({storage: memory(seeded({owned: {[c.id]: true}, items: {[item.key]: c.id}}))});
    const fits = item.fit(c);
    assert.equal(e.status().blocked, !fits, item.key + ' ' + c.id);
    fits ? ok++ : held++;
  }
  assert.equal(ok, 103); assert.equal(held, 14 * 45 - 103);
});

test('confirming a car (stage 2) leaves items and order records unchanged', () => {
  const card = fitOf('shield')[0];
  const parts = Object.fromEntries(rules.parts.map(p => [p.key, {at: 1, use: []}]));
  const storage = memory(seeded({owned: {[card]: true}, items: {shield: card, dagger: 1}, orderDay: '2026-11-15', orderKey: 'dagger', orderDone: 1, parts}));
  const e = createEngine({storage});
  assert.equal(e.takeCar(rules.CARS[0].key).ok, true);
  const saved = JSON.parse(storage.getItem(SAVE_KEY));
  assert.deepEqual(saved.items, {shield: card, dagger: 1}); assert.equal(saved.orderKey, 'dagger'); assert.equal(saved.orderDone, 1); assert.equal(saved.orderDay, '2026-11-15');
});

// ── 엔진 명령: 오늘의 요구·회신·장착 ──────────────────────────────────────────
import {commandSafely} from '../src/shipments.mjs';
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 15, 10, 0).getTime();
function counting(storage) {
  const log = {writes: 0};
  const set = storage.setItem;
  storage.setItem = (key, value) => { log.writes++; set(key, value); };
  return log;
}
// 보유 동료 몇 장으로 시작하는 저장. 요구는 보유 소재에 걸 데가 있는 항목만 들어온다.
function ownedSave(ids, extra = {}) {
  return seeded({owned: Object.fromEntries(ids.map(id => [id, true])), stock: Object.fromEntries(ids.map(id => [id, 2])), ...extra});
}
const SOFT_CARD = fitOf('shield')[0];

test('reading today\'s order never writes: new profile has none, an owned card opens one, a new day picks again in memory only', () => {
  const empty = memory(), emptyWrites = counting(empty), e0 = createEngine({storage: empty, now: () => NOW});
  assert.equal(e0.order().state, 'none'); assert.equal(e0.order().choices.length, 14);
  assert.equal(empty.getItem(SAVE_KEY), null); assert.equal(emptyWrites.writes, 0);
  const raw = ownedSave([SOFT_CARD]), storage = memory(raw), writes = counting(storage);
  const e = createEngine({storage, now: () => NOW});
  const o = e.order();
  assert.equal(o.state, 'open'); assert.equal(o.left, 1); assert.equal(o.max, 1); assert.equal(o.owned, 0); assert.equal(o.total, 14);
  assert.ok(fitOf(o.order.key).includes(SOFT_CARD), 'only items the owned card can carry');
  assert.deepEqual(e.order().order, o.order, 'same request when asked again');
  assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(writes.writes, 0);
  let later = NOW; const e2 = createEngine({storage: memory(raw), now: () => later});
  const day1 = e2.order(); later = NOW + DAY; const day2 = e2.order();
  assert.notEqual(day1.day, day2.day); assert.equal(day2.state, 'open');
  assert.equal(e2.state().orderDay, day2.day, 'normalised in memory');
});

test('a correct reply grants items[key]=1 and orderDone+1 with exactly one write; stock and everything else stay', () => {
  const storage = memory(ownedSave([SOFT_CARD])), writes = counting(storage);
  const e = createEngine({storage, now: () => NOW});
  const o = e.order(), before = e.state();
  const out = e.reply(o.order.key, o.day, o.order.key);
  assert.equal(out.ok, true); assert.equal(out.correct, true); assert.equal(out.item.key, o.order.key); assert.ok(out.yes);
  assert.equal(out.left, 0); assert.equal(out.owned, 1); assert.deepEqual(out.candidates, e.state().owned[SOFT_CARD] ? fitOf(o.order.key).filter(id => before.owned[id]) : []);
  const s = e.state(), saved = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(s.items[o.order.key], 1); assert.equal(s.orderDone, 1);
  assert.deepEqual(saved.items, s.items); assert.equal(saved.orderDone, 1); assert.equal(saved.orderKey, o.order.key); assert.equal(saved.orderDay, o.day);
  assert.equal(writes.writes, 1);
  assert.deepEqual({...s, items: before.items, orderDone: 1, orderDay: s.orderDay, orderKey: s.orderKey}, {...before, orderDone: 1, orderDay: s.orderDay, orderKey: s.orderKey}, 'only items and the order record change');
  assert.deepEqual(s.stock, before.stock);
  const after = e.order(); assert.equal(after.state, 'earned'); assert.equal(after.order.key, o.order.key); assert.equal(after.equippedTo, null); assert.ok(after.order.yes);
});

test('a wrong reply grants nothing and writes nothing; the same correct answer twice, a reply after the daily limit and a stale day are refused', () => {
  const raw = ownedSave([SOFT_CARD]), storage = memory(raw), writes = counting(storage);
  const e = createEngine({storage, now: () => NOW});
  const o = e.order(), wrong = o.choices.map(c => c.key).find(k => k !== o.order.key), before = JSON.stringify(e.state());
  const bad = e.reply(o.order.key, o.day, wrong);
  assert.equal(bad.ok, true); assert.equal(bad.correct, false); assert.ok(bad.no); assert.equal(writes.writes, 0);
  assert.equal(JSON.stringify(e.state()), before); assert.equal(storage.getItem(SAVE_KEY), raw);
  // 어제 날짜로 연 요구에 오늘 답하면 거절
  const yesterday = e.reply(o.order.key, new Date(NOW - DAY).getFullYear() + '-' + (new Date(NOW - DAY).getMonth() + 1) + '-' + new Date(NOW - DAY).getDate(), o.order.key);
  assert.equal(yesterday.ok, false); assert.equal(yesterday.stale, true);
  assert.equal(e.reply('tea', o.day, o.order.key).ok, false); assert.equal(e.reply(o.order.key, o.day, 'tea').ok, false); assert.equal(e.reply(o.order.key, 5, o.order.key).ok, false);
  assert.equal(writes.writes, 0);
  assert.equal(e.reply(o.order.key, o.day, o.order.key).ok, true); assert.equal(writes.writes, 1);
  const again = e.reply(o.order.key, o.day, o.order.key);
  assert.equal(again.ok, false); assert.equal(again.stale, true); assert.equal(writes.writes, 1, 'no second grant');
  assert.equal(e.state().orderDone, 1);
  // 한도(하루 한 건)를 쓴 뒤 다른 항목에 답해도 지급 없음
  const other = e.order(); assert.notEqual(other.state, 'open');
  for (const c of other.choices) assert.equal(e.reply(c.key, other.day, c.key).ok, false);
  assert.equal(writes.writes, 1); assert.equal(Object.keys(e.state().items).length, 1);
  // 다음 날에는 새 요구가 다시 들어온다(보유 소재에 걸 데가 남아 있는 항목만)
  let later = NOW + DAY; const next = createEngine({storage: memory(storage.getItem(SAVE_KEY)), now: () => later}), n = next.order();
  assert.ok(['open', 'none'].includes(n.state)); if (n.state === 'open') { assert.notEqual(n.order.key, o.order.key); assert.equal(n.left, 1); }
});

test('equip: items[key]=cardId, stock untouched, compatible owned cards only, one write; an equipped or unobtained item stays unchanged', () => {
  const [a, b] = fitOf('shield').slice(0, 2), wrong = unfitOf('shield').find(id => id !== a);
  const storage = memory(ownedSave([a, b, wrong], {items: {shield: 1, iron: 1}})), writes = counting(storage);
  const e = createEngine({storage, now: () => NOW});
  const stock = e.state().stock, w = e.warranties();
  assert.equal(w.total, 14); assert.equal(w.owned, 2);
  assert.deepEqual(w.items.find(i => i.key === 'shield').candidates.sort(), [a, b].sort());
  assert.equal(e.equip('shield', wrong).ok, false); assert.equal(e.equip('shield', 'zz-1').ok, false); assert.equal(e.equip('tea', a).ok, false);
  assert.equal(e.equip('dagger', a).ok, false, 'not obtained');
  assert.equal(writes.writes, 0);
  const out = e.equip('shield', a);
  assert.equal(out.ok, true); assert.equal(out.equip.key, 'shield'); assert.equal(out.equip.id, a); assert.ok(out.equip.card);
  assert.equal(writes.writes, 1); assert.equal(e.state().items.shield, a); assert.deepEqual(e.state().stock, stock);
  assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)).items, {shield: a, iron: 1});
  assert.deepEqual(e.equippedKeys(a), ['shield']); assert.deepEqual(e.equippedKeys(b), []);
  const again = e.equip('shield', b);
  assert.equal(again.ok, false); assert.equal(again.stale, true); assert.equal(writes.writes, 1); assert.equal(e.state().items.shield, a, 'no relocation');
  assert.equal(e.equip('shield', a).ok, false, 'no second equip');
  const wa = e.warranties().items.find(i => i.key === 'shield');
  assert.deepEqual([wa.state, wa.cardId, wa.candidates], ['equipped', a, []]);
  assert.equal(e.warranties().items.find(i => i.key === 'dagger').state, 'locked');
  const states = Object.fromEntries(e.cardItems(a).map(i => [i.key, i.state])), other = Object.fromEntries(e.cardItems(b).map(i => [i.key, i.state]));
  assert.equal(states.shield, 'equipped'); assert.equal(other.shield, 'elsewhere');
  for (const k of Object.keys(states)) if (k !== 'shield' && k !== 'iron') assert.equal(states[k], 'locked');
});

test('every fitting card equips every fitting item together; the combination stays inside the approved looks', () => {
  for (const c of CHARS) {
    const keys = rules.ITEMS.filter(i => i.fit(c)).map(i => i.key); if (!keys.length) continue;
    const storage = memory(ownedSave([c.id], {items: Object.fromEntries(keys.map(k => [k, 1]))})), e = createEngine({storage, now: () => NOW});
    for (const k of keys) assert.equal(e.equip(k, c.id).ok, true, k + ' → ' + c.id);
    assert.deepEqual(e.equippedKeys(c.id), [...keys].sort());
    assert.equal(createEngine({storage, now: () => NOW}).status().blocked, false, 'saved result loads again');
  }
});

test('reply and equip keep the guards: stale tab, corrupt save, failed write; blocked states grant nothing', () => {
  const raw = ownedSave([SOFT_CARD], {items: {shield: 1}});
  const storage = memory(raw), a = createEngine({storage, now: () => NOW}), b = createEngine({storage, now: () => NOW});
  const oa = a.order(), ob = b.order();
  assert.equal(a.reply(oa.order.key, oa.day, oa.order.key).ok, true);
  const saved = storage.getItem(SAVE_KEY);
  assert.equal(b.reply(ob.order.key, ob.day, ob.order.key).ok, false); assert.equal(b.equip('shield', SOFT_CARD).ok, false);
  assert.equal(storage.getItem(SAVE_KEY), saved); assert.match(b.status().warning, /다른/);

  const corrupt = createEngine({storage: memory('{broken'), now: () => NOW});
  assert.equal(corrupt.reply('shield', corrupt.order().day, 'shield').ok, false); assert.equal(corrupt.equip('shield', SOFT_CARD).ok, false);
  assert.equal(corrupt.status().blocked, true);

  for (const run of [e => { const o = e.order(); return e.reply(o.order.key, o.day, o.order.key); }, e => e.equip('shield', SOFT_CARD)]) {
    const failing = memory(raw); failing.setItem = () => { throw new Error('quota'); };
    const e = createEngine({storage: failing, now: () => NOW});
    assert.equal(run(e).ok, true, 'the in-memory result is still returned');
    assert.match(e.status().warning, /저장/);
    assert.ok(Object.keys(JSON.parse(e.backup()).items).length >= 1);
  }
  // 저장이 받아 주지 않으면(쓴 값이 읽히지 않음) 경고와 백업
  const dropped = memory(raw); dropped.setItem = () => {};
  const d = createEngine({storage: dropped, now: () => NOW}); assert.equal(d.equip('shield', SOFT_CARD).ok, true); assert.match(d.status().warning, /받아 주지/);
});

test('commands behind the shared lock: two tabs answering or equipping produce exactly one grant and one equip', async () => {
  const locks = () => { let pending = Promise.resolve(); return {request: (key, callback) => { assert.equal(key, SAVE_KEY); const result = pending.then(callback); pending = result.then(() => {}); return result; }}; };
  const storage = memory(ownedSave([SOFT_CARD])), first = createEngine({storage, now: () => NOW}), second = createEngine({storage, now: () => NOW});
  const o1 = first.order(), o2 = second.order(), lock = locks();
  const answers = await Promise.all([commandSafely(() => first.reply(o1.order.key, o1.day, o1.order.key), {locks: lock}), commandSafely(() => second.reply(o2.order.key, o2.day, o2.order.key), {locks: lock})]);
  assert.equal(answers.filter(r => r.ok).length, 1);
  const s = JSON.parse(storage.getItem(SAVE_KEY)); assert.equal(s.orderDone, 1); assert.equal(Object.keys(s.items).length, 1);
  const key = o1.order.key, card = fitOf(key).includes(SOFT_CARD) ? SOFT_CARD : fitOf(key)[0];
  const eq = memory(ownedSave([card], {items: {[key]: 1}})), t1 = createEngine({storage: eq, now: () => NOW}), t2 = createEngine({storage: eq, now: () => NOW}), lock2 = locks();
  const equips = await Promise.all([commandSafely(() => t1.equip(key, card), {locks: lock2}), commandSafely(() => t2.equip(key, card), {locks: lock2})]);
  assert.equal(equips.filter(r => r.ok).length, 1); assert.equal(JSON.parse(eq.getItem(SAVE_KEY)).items[key], card);
  assert.equal((await commandSafely(() => t1.equip(key, card), {locks: undefined})).ok, false, 'no lock support refuses');
});

test('all 14 items: answer each one correctly in turn (a new day each time) and equip it; no stock is ever used', () => {
  const every = CHARS.map(c => c.id);
  let day = NOW; const storage = memory(ownedSave(every)), e = createEngine({storage, now: () => day});
  const seen = new Set();
  for (let n = 0; n < 14; n++) {
    const o = e.order(); assert.equal(o.state, 'open', 'day ' + n); assert.ok(!seen.has(o.order.key)); seen.add(o.order.key);
    assert.equal(e.reply(o.order.key, o.day, o.order.key).ok, true);
    const card = fitOf(o.order.key)[0]; assert.equal(e.equip(o.order.key, card).ok, true);
    assert.equal(e.order().state, n === 13 ? 'all' : 'earned');
    day += DAY;
  }
  assert.equal(seen.size, 14); assert.equal(e.warranties().owned, 14); assert.equal(e.order().state, 'all');
  assert.ok(Object.values(e.state().stock).every(v => v === 2), 'stock never changes');
  assert.equal(createEngine({storage, now: () => day}).status().blocked, false);
});
