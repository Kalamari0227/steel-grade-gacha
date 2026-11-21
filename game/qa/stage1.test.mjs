import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {commandSafely} from '../src/shipments.mjs';

// 1단계(스크랩과 제작) 엔진 명령: 중복 스크랩, LV3·LV4 확정 교환, 부품 제작.
// 새 프로필에는 스크랩·재고가 없으므로 저장을 미리 심는다(qa/engine.test.mjs와 같은 방식).
function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []);
  return {getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map};
}
const base = createEngine({storage: memory()}).state();
function seeded(extra = {}) { return JSON.stringify({...base, ...extra}); }
function withStock(stock, extra = {}) {
  const owned = {...(extra.owned || {})};
  for (const id of Object.keys(stock)) owned[id] = true;
  return seeded({...extra, stock, owned});
}
const rules = createLegacy();
const PARTS = rules.parts;
const level = id => rules.lvOf(rules.findChar(id));
const ofLevel = lv => rules.allChars().filter(c => rules.lvOf(c) === lv && c.id !== rules.qp.id).map(c => c.id);
// 이 부품을 만들 수 있는 가장 작은 재고(칸마다 첫 후보 한 장씩)
function stockFor(part) {
  const stock = {};
  for (const slot of part.need) stock[slot.any[0]] = (stock[slot.any[0]] || 0) + 1;
  return stock;
}
function counting(storage) {
  const raw = {writes: 0};
  const set = storage.setItem;
  storage.setItem = (key, value) => { raw.writes++; set(key, value); };
  return raw;
}

test('duplicate scrap: stock 2 → 1 and scrap +1; the last copy is never scrapped', () => {
  const id = ofLevel(1)[0];
  const storage = memory(withStock({[id]: 2}, {scrap: 3})), writes = counting(storage);
  const e = createEngine({storage});
  const out = e.scrap(id);
  assert.deepEqual([out.ok, out.stock, out.scrap], [true, 1, 4]);
  assert.equal(e.state().stock[id], 1); assert.equal(e.state().scrap, 4); assert.equal(e.state().owned[id], true);
  assert.equal(writes.writes, 1); assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).scrap, 4);
  const before = e.state(), raw = storage.getItem(SAVE_KEY);
  assert.equal(e.scrap(id).ok, false);
  assert.deepEqual(e.state(), before); assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(writes.writes, 1);
  assert.equal(e.scrap('none-such').ok, false);
  const empty = createEngine({storage: memory(withStock({}, {owned: {[id]: true}}))});
  assert.equal(empty.scrap(id).ok, false);
});

test('exchange LV3 costs 5 and LV4 costs 10, gives one card of that level and records the result', () => {
  for (const [lv, cost] of [[3, 5], [4, 10]]) {
    const storage = memory(seeded({scrap: cost + 2})), writes = counting(storage);
    const e = createEngine({storage, random: () => 0});
    const out = e.exchange(lv);
    assert.equal(out.ok, true);
    assert.equal(e.state().scrap, 2);
    assert.equal(out.result.cards.length, 1); assert.equal(out.result.mode, 'single'); assert.equal(out.result.exchange, lv);
    const id = out.result.cards[0].id;
    assert.equal(level(id), lv); assert.equal(out.result.cards[0].isNew, true);
    assert.equal(e.state().stock[id], 1); assert.equal(e.state().owned[id], true);
    assert.equal(writes.writes, 1);
    const reload = createEngine({storage});
    assert.deepEqual(reload.state(), e.state()); assert.equal(reload.state().results.exchange, lv);
    assert.equal(reload.featured().id, id, 'a newly found exchange card is the lobby candidate');
  }
});

test('exchange prefers cards not yet discovered, and falls back to the whole level once all are found', () => {
  const lv3 = ofLevel(3), missing = lv3[lv3.length - 1];
  const owned = Object.fromEntries(lv3.filter(id => id !== missing).map(id => [id, true]));
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const e = createEngine({storage: memory(seeded({scrap: 5, owned})), random});
    const out = e.exchange(3);
    assert.equal(out.result.cards[0].id, missing); assert.equal(out.result.cards[0].isNew, true);
  }
  const all = Object.fromEntries(lv3.map(id => [id, true]));
  const picks = new Set();
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const out = createEngine({storage: memory(seeded({scrap: 5, owned: all})), random}).exchange(3);
    assert.equal(level(out.result.cards[0].id), 3); assert.equal(out.result.cards[0].isNew, false);
    picks.add(out.result.cards[0].id);
  }
  assert.ok(picks.size > 1);
});

test('exchange with too little scrap changes nothing and writes nothing; pending counts like the original', () => {
  const storage = memory(seeded({scrap: 4})), writes = counting(storage);
  const e = createEngine({storage, random: () => 0});
  const before = e.state(), raw = storage.getItem(SAVE_KEY);
  for (const lv of [3, 4, 5, 0]) assert.equal(e.exchange(lv).ok, false);
  assert.deepEqual(e.state(), before); assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(writes.writes, 0);
  assert.equal(e.status().exchanges[0].can, false);
  // 옛 저장본의 미처리 중복(pending)은 원본 sweepPending()처럼 스크랩 1로 치고 비운다.
  const pending = ofLevel(1)[0];
  const old = createEngine({storage: memory(withStock({[pending]: 1}, {scrap: 4, pending})), random: () => 0});
  assert.equal(old.status().exchanges[0].can, true);
  const out = old.exchange(3);
  assert.equal(out.ok, true); assert.equal(old.state().scrap, 0); assert.equal(old.state().pending, '');
});

test('crafting consumes only the planned stock, records parts[key], keeps the dex and refuses a second time', () => {
  const part = PARTS.find(p => p.need.length === 2);
  const stock = {...stockFor(part)}; const extra = ofLevel(1)[0]; stock[extra] = (stock[extra] || 0) + 1;
  const storage = memory(withStock(stock, {scrap: 7})), writes = counting(storage);
  const e = createEngine({storage, now: () => 1730000000000});
  const detail = e.partDetail(part.key);
  assert.equal(detail.ready, true);
  const before = e.state();
  const out = e.craft(part.key, null, detail.plan);
  assert.equal(out.ok, true);
  const after = e.state();
  assert.deepEqual(after.parts[part.key], {at: 1730000000000, use: detail.plan});
  assert.deepEqual(after.owned, before.owned, 'dex ownership is preserved');
  assert.equal(after.scrap, 7);
  const left = {...before.stock};
  for (const id of detail.plan) { left[id]--; if (!left[id]) delete left[id]; }
  assert.deepEqual(after.stock, left);
  assert.equal(writes.writes, 1);
  const raw = storage.getItem(SAVE_KEY), snapshot = e.state();
  assert.equal(e.craft(part.key).ok, false);
  assert.deepEqual(e.state(), snapshot); assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(writes.writes, 1);
  assert.equal(e.partList().count, 1);
  assert.equal(createEngine({storage}).partList().groups.flatMap(g => g.parts).find(p => p.key === part.key).state, 'done');
});

test('all 35 parts are craftable from their own minimum stock, and not before', () => {
  assert.equal(PARTS.length, 35);
  for (const part of PARTS) {
    const none = createEngine({storage: memory(seeded())});
    assert.equal(none.partDetail(part.key).ready, false, part.key);
    assert.equal(none.craft(part.key).ok, false, part.key);
    const e = createEngine({storage: memory(withStock(stockFor(part)))});
    const row = e.partList().groups.flatMap(g => g.parts).find(p => p.key === part.key);
    assert.equal(row.state, 'ready', part.key);
    const out = e.craft(part.key);
    assert.equal(out.ok, true, part.key);
    assert.equal(Object.keys(e.state().stock).length, 0, part.key);
    assert.equal(e.state().parts[part.key].use.length, part.need.length);
  }
  const groups = createEngine({storage: memory(seeded())}).partList().groups;
  assert.deepEqual(groups.map(g => g.name), ['바디', '프레임', '섀시 · 구동']);
  assert.equal(groups.reduce((n, g) => n + g.parts.length, 0), 35);
});

test('a chosen candidate is honoured; an unusable choice is refused without any change', () => {
  const part = PARTS.find(p => p.need.some(sl => sl.any.length >= 2) && p.need.length === 1);
  const [first, second] = part.need[0].any;
  const storage = memory(withStock({[first]: 1, [second]: 1})), writes = counting(storage);
  const e = createEngine({storage});
  const raw = storage.getItem(SAVE_KEY), before = e.state();
  const other = rules.allChars().map(c => c.id).find(id => !part.need[0].any.includes(id) && id !== rules.qp.id);
  assert.equal(e.craft(part.key, [other]).ok, false, 'not a candidate of this slot');
  assert.equal(e.craft(part.key, ['qp-1470']).ok, false, 'QP not developed');
  assert.equal(e.craft(part.key, 'nope').ok, false);
  assert.equal(e.craft(part.key, [first], [second]).ok, false, 'stale plan');
  assert.equal(e.craft('no-such-part').ok, false);
  assert.deepEqual(e.state(), before); assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(writes.writes, 0);
  const chosen = e.craft(part.key, [second], [second]);
  assert.equal(chosen.ok, true); assert.deepEqual(e.state().parts[part.key].use, [second]);
  assert.equal(e.state().stock[first], 1); assert.equal(e.state().stock[second], undefined);
  const empty = createEngine({storage: memory(withStock({[first]: 1}))});
  assert.equal(empty.craft(part.key, [second]).ok, false, 'no stock of the chosen card');
});

test('QP covers 1470-class slots without being consumed or needing card stock', () => {
  const part = PARTS.find(p => p.need.every(sl => sl.any.some(id => rules.qp.keys.includes(id))));
  assert.ok(part, 'a part whose every slot accepts a 1470-class card');
  const qp = rules.qp.id;
  const without = createEngine({storage: memory(seeded())});
  assert.equal(without.partDetail(part.key).ready, false);
  const storage = memory(withStock({[qp]: 1}, {owned: {[qp]: true}})), writes = counting(storage);
  const e = createEngine({storage});
  const detail = e.partDetail(part.key);
  assert.equal(detail.ready, true); assert.ok(detail.plan.every(id => id === qp));
  assert.ok(detail.slots.every(sl => sl.qpCovers));
  const out = e.craft(part.key, null, detail.plan);
  assert.equal(out.ok, true);
  assert.equal(e.state().stock[qp], 1, 'QP is not consumed'); assert.deepEqual(e.state().parts[part.key].use, detail.plan);
  assert.equal(writes.writes, 1);
  // 카드를 고르면 QP 대신 그 카드를 쓴다
  const card = part.need[0].any.find(id => rules.qp.keys.includes(id));
  const mixed = createEngine({storage: memory(withStock({[qp]: 1, [card]: 1}, {owned: {[qp]: true}}))});
  assert.equal(mixed.craft(part.key, [card], [card, ...mixed.partDetail(part.key, [card]).plan.slice(1)]).ok, true);
  assert.equal(mixed.state().stock[card], undefined); assert.equal(mixed.state().stock[qp], 1);
});

test('every command is refused by a stale tab, a held save and a failed write without losing the earlier guards', () => {
  const part = PARTS[0], id = ofLevel(1)[0];
  const state = withStock({...stockFor(part), [id]: 2}, {scrap: 20});
  const storage = memory(state), a = createEngine({storage, random: () => 0}), b = createEngine({storage, random: () => 0});
  assert.equal(a.scrap(id).ok, true);
  const raw = storage.getItem(SAVE_KEY);
  for (const out of [b.scrap(id), b.exchange(3), b.craft(part.key)]) assert.equal(out.ok, false);
  assert.equal(storage.getItem(SAVE_KEY), raw);
  assert.match(b.status().warning, /다른/);
  assert.equal(b.status().exchanges.every(row => row.can === false), true);

  const corrupt = createEngine({storage: memory('{broken')});
  for (const out of [corrupt.scrap(id), corrupt.exchange(3), corrupt.craft(part.key)]) assert.equal(out.ok, false);
  assert.equal(corrupt.status().blocked, true);

  for (const command of [e => e.scrap(id), e => e.exchange(3), e => e.craft(part.key)]) {
    const failing = memory(state); failing.setItem = () => { throw new Error('quota'); };
    const e = createEngine({storage: failing, random: () => 0});
    const out = command(e);
    assert.equal(out.ok, true, 'the in-memory result is still returned');
    assert.match(e.status().warning, /저장/);
    assert.ok(JSON.parse(e.backup()));
  }
});

test('commands behind the shared lock: two tabs crafting the same part produce exactly one part', async () => {
  const part = PARTS[0];
  const storage = memory(withStock(stockFor(part)));
  const first = createEngine({storage}), second = createEngine({storage});
  let pending = Promise.resolve();
  const locks = {request: (key, callback) => { assert.equal(key, SAVE_KEY); const result = pending.then(callback); pending = result.then(() => {}); return result; }};
  const outcomes = await Promise.all([commandSafely(() => first.craft(part.key), {locks}), commandSafely(() => second.craft(part.key), {locks})]);
  assert.equal(outcomes.filter(r => r.ok).length, 1);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).stock[part.need[0].any[0]], undefined);
  assert.equal((await commandSafely(() => first.craft(part.key), {locks: null})).ok, false);
});

test('a previous-game save keeps its parts: number and {at,use} forms read as done; bad ones are held', () => {
  const [a, b] = PARTS;
  const use = b.need.map(sl => sl.any[0]);
  const stock = Object.fromEntries(use.map(id => [id, 1]));
  const ok = createEngine({storage: memory(withStock(stock, {parts: {[a.key]: 1730000000000, [b.key]: {at: 1730000001000, use}}}))});
  assert.equal(ok.status().blocked, false);
  assert.equal(ok.partList().count, 2);
  assert.equal(ok.partDetail(a.key).done, true); assert.deepEqual(ok.partDetail(b.key).use, use);
  assert.equal(ok.craft(a.key).ok, false);
  const foreign = rules.allChars().map(c => c.id).find(id => id !== rules.qp.id && !a.need.some(sl => sl.any.includes(id)));
  for (const parts of [{nope: {at: 1}}, {[a.key]: 'done'}, {[a.key]: {at: -1}}, {[a.key]: {at: 1, use: ['not-a-card']}}, {[a.key]: {at: 1, use: [foreign]}}, {[a.key]: null}]) {
    assert.equal(createEngine({storage: memory(seeded({parts}))}).status().blocked, true, JSON.stringify(parts));
  }
});

test('results.exchange is accepted only as 3 or 4 on a single result', () => {
  const e = createEngine({storage: memory(seeded({scrap: 5})), random: () => 0});
  e.exchange(3);
  const saved = e.state();
  assert.equal(createEngine({storage: memory(JSON.stringify(saved))}).status().blocked, false);
  for (const exchange of [5, 0, '3', null]) {
    const bad = {...saved, results: {...saved.results, exchange}};
    assert.equal(createEngine({storage: memory(JSON.stringify(bad))}).status().blocked, true, String(exchange));
  }
  const ten = {...saved, results: {...saved.results, mode: 'ten'}};
  assert.equal(createEngine({storage: memory(JSON.stringify(ten))}).status().blocked, true);
});
