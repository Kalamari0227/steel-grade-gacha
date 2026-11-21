import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {commandSafely} from '../src/shipments.mjs';

// 2단계(차고) 엔진: 부품 35개 진행, 차량 선택·확정, 차고 8종, 저장 계약.
// 새 프로필에는 부품이 없으므로 저장을 미리 심는다(qa/stage1.test.mjs와 같은 방식).
function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []);
  return {getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map};
}
const base = createEngine({storage: memory()}).state();
const rules = createLegacy();
const PARTS = rules.parts, CARS = rules.CARS;
const fullParts = at => Object.fromEntries(PARTS.map(p => [p.key, {at, use: []}]));
const owned = n => CARS.slice(0, n).map((c, i) => ({k: c.key, at: 1000 + i}));
function seeded(extra = {}) { return JSON.stringify({...base, ...extra}); }
function counting(storage) {
  const raw = {writes: 0};
  const set = storage.setItem;
  storage.setItem = (key, value) => { raw.writes++; set(key, value); };
  return raw;
}

test('new profile: garage shows 0/35 parts, 8 locked cars and nothing selectable; reading it does not write', () => {
  const storage = memory(), e = createEngine({storage});
  const g = e.garage();
  assert.deepEqual([g.parts.count, g.parts.total, g.owned, g.total, g.complete, g.selectable], [0, 35, 0, 8, false, false]);
  assert.equal(g.cars.length, 8);
  assert.equal(g.cars.every(c => c.owned === false && c.at === 0 && c.tag && c.body && c.maker && c.line), true);
  assert.deepEqual(g.cars.map(c => c.key), CARS.map(c => c.key));
  e.garage(); e.garage();
  assert.equal(storage.getItem(SAVE_KEY), null);
});

test('garage progress follows the 35 parts and ready count; selectable only when all 35 are done', () => {
  const some = Object.fromEntries(PARTS.slice(0, 10).map(p => [p.key, {at: 5, use: []}]));
  assert.deepEqual(createEngine({storage: memory(seeded({parts: some}))}).garage().parts, {count: 10, total: 35, ready: 0});
  const g = createEngine({storage: memory(seeded({parts: fullParts(5)}))}).garage();
  assert.equal(g.parts.count, 35); assert.equal(g.selectable, true); assert.equal(g.complete, false);
});

test('taking a car adds {k,at}, resets parts, keeps owned/stock/scrap/items and writes exactly once', () => {
  const id = rules.allChars()[0].id;
  const raw = seeded({parts: fullParts(5), owned: {[id]: true}, stock: {[id]: 3}, scrap: 7, extra: 2});
  const storage = memory(raw), writes = counting(storage);
  const e = createEngine({storage, now: () => 424242});
  const before = e.state();
  const out = e.takeCar('h');
  assert.equal(out.ok, true);
  assert.deepEqual(out.car, {key: 'h', tag: CARS.find(c => c.key === 'h').tag, body: CARS.find(c => c.key === 'h').body, at: 424242});
  assert.deepEqual([out.owned, out.total, out.complete], [1, 8, false]);
  const s = e.state();
  assert.deepEqual(s.cars, [{k: 'h', at: 424242}]);
  assert.deepEqual(s.parts, {});
  for (const k of ['owned', 'stock', 'scrap', 'extra', 'items', 'pullAt', 'pullUsed']) assert.deepEqual(s[k], before[k], k);
  assert.equal(writes.writes, 1);
  assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)).cars, [{k: 'h', at: 424242}]);
  // 새로 시작한 상태로 다시 읽어도 같다.
  const again = createEngine({storage});
  assert.equal(again.garage().owned, 1); assert.equal(again.garage().parts.count, 0); assert.equal(again.garage().cars.find(c => c.key === 'h').at, 424242);
});

test('taking a car is refused without any change when parts are incomplete, the car is owned, or all eight are owned', () => {
  const cases = [
    ['incomplete parts', seeded({parts: Object.fromEntries(PARTS.slice(0, 34).map(p => [p.key, {at: 1, use: []}]))}), 'h'],
    ['already owned', seeded({parts: fullParts(5), cars: owned(2)}), CARS[0].key],
    ['all eight owned', seeded({parts: fullParts(5), cars: owned(8)}), 'h']
  ];
  for (const [name, raw, key] of cases) {
    const storage = memory(raw), writes = counting(storage), e = createEngine({storage});
    const before = e.state();
    const out = e.takeCar(key);
    assert.equal(out.ok, false, name);
    assert.equal(out.stale, true, name);
    assert.match(out.error, /상태가 바뀌었어요/);
    assert.deepEqual(e.state(), before, name);
    assert.equal(storage.getItem(SAVE_KEY), raw, name);
    assert.equal(writes.writes, 0, name);
  }
  const e = createEngine({storage: memory(seeded({parts: fullParts(5)}))});
  assert.equal(e.takeCar('nope').ok, false);
  assert.equal(e.takeCar(undefined).ok, false);
});

test('a second confirm of the same or another car right after is refused (parts were reset)', () => {
  const e = createEngine({storage: memory(seeded({parts: fullParts(5)}))});
  assert.equal(e.takeCar('t').ok, true);
  assert.equal(e.takeCar('t').ok, false);
  assert.equal(e.takeCar('b').ok, false);
  assert.equal(e.garage().owned, 1);
});

test('the full cycle: eight rounds of 35 parts give eight distinct cars, then it is complete and refuses more', () => {
  const storage = memory(seeded({parts: fullParts(5)}));
  let e = createEngine({storage}), n = 0;
  for (const car of CARS) {
    assert.equal(e.garage().selectable, true, car.key);
    assert.equal(e.takeCar(car.key).ok, true, car.key);
    n++;
    assert.equal(e.garage().owned, n);
    if (n < CARS.length) {
      assert.equal(e.garage().selectable, false);
      // 다음 차를 위해 부품을 다시 35개 채운다(저장에 직접 쓴다).
      const next = JSON.parse(storage.getItem(SAVE_KEY)); next.parts = fullParts(5);
      storage.setItem(SAVE_KEY, JSON.stringify(next));
      e = createEngine({storage});
    }
  }
  const g = e.garage();
  assert.deepEqual([g.owned, g.complete, g.selectable], [8, true, false]);
  assert.equal(new Set(e.state().cars.map(c => c.k)).size, 8);
  const next = JSON.parse(storage.getItem(SAVE_KEY)); next.parts = fullParts(5);
  storage.setItem(SAVE_KEY, JSON.stringify(next));
  assert.equal(createEngine({storage}).takeCar('t').ok, false);
});

test('choosing alone changes nothing: garage() and partList() are read-only', () => {
  const raw = seeded({parts: fullParts(5), cars: owned(2)});
  const storage = memory(raw), writes = counting(storage), e = createEngine({storage});
  const before = JSON.stringify(e.state());
  for (let i = 0; i < 3; i++) { e.garage(); e.partList(); e.nextGoal(); }
  assert.equal(JSON.stringify(e.state()), before);
  assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(writes.writes, 0);
});

test('lobby goal moves to the garage when all 35 parts are done, and is gone once all eight cars are owned', () => {
  const full = createEngine({storage: memory(seeded({parts: fullParts(5), cars: owned(3)}))});
  const goal = full.nextGoal();
  assert.equal(goal.garage, true);
  assert.equal(goal.carKey, CARS[3].key);
  assert.equal(createEngine({storage: memory(seeded({parts: fullParts(5), cars: owned(8)}))}).nextGoal(), null);
  const partial = createEngine({storage: memory(seeded({parts: {[PARTS[0].key]: {at: 1, use: []}}}))}).nextGoal();
  assert.equal(partial.garage, undefined); assert.ok(partial.partKey);
});

test('a stale tab, a corrupt save and a failed write do not lose the earlier guards for takeCar', () => {
  const raw = seeded({parts: fullParts(5)});
  const storage = memory(raw), a = createEngine({storage}), b = createEngine({storage});
  assert.equal(a.takeCar('t').ok, true);
  const saved = storage.getItem(SAVE_KEY);
  assert.equal(b.takeCar('h').ok, false);
  assert.equal(storage.getItem(SAVE_KEY), saved);
  assert.match(b.status().warning, /다른/);
  assert.equal(b.garage().selectable, false);

  const corrupt = createEngine({storage: memory('{broken')});
  assert.equal(corrupt.takeCar('t').ok, false);
  assert.equal(corrupt.status().blocked, true);
  assert.equal(corrupt.garage().selectable, false);

  const failing = memory(raw); failing.setItem = () => { throw new Error('quota'); };
  const e = createEngine({storage: failing});
  const out = e.takeCar('t');
  assert.equal(out.ok, true, 'the in-memory result is still returned');
  assert.match(e.status().warning, /저장/);
  assert.equal(JSON.parse(e.backup()).cars.length, 1);
});

test('commands behind the shared lock: two tabs confirming a car produce exactly one car', async () => {
  const storage = memory(seeded({parts: fullParts(5)}));
  const first = createEngine({storage}), second = createEngine({storage});
  let pending = Promise.resolve();
  const locks = {request: (key, callback) => { assert.equal(key, SAVE_KEY); const result = pending.then(callback); pending = result.then(() => {}); return result; }};
  const outcomes = await Promise.all([commandSafely(() => first.takeCar('t'), {locks}), commandSafely(() => second.takeCar('t'), {locks})]);
  assert.equal(outcomes.filter(r => r.ok).length, 1);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).cars.length, 1);
});

test('a previous-game save keeps its cars; unknown, duplicate or malformed cars are held', () => {
  const ok = createEngine({storage: memory(seeded({cars: [{k: 't', at: 5}, {k: 'd', at: 0}]}))});
  assert.equal(ok.status().blocked, false);
  assert.deepEqual(ok.garage().cars.filter(c => c.owned).map(c => c.key), ['t', 'd']);
  assert.equal(ok.garage().cars.find(c => c.key === 't').at, 5);
  // 원본 applySaved: 예전 단일 차 필드(car, carAt)도 이어받는다.
  const legacySingle = createEngine({storage: memory(JSON.stringify({...base, cars: undefined, car: 'b', carAt: 77}))});
  if (!legacySingle.status().blocked) assert.deepEqual(legacySingle.state().cars, [{k: 'b', at: 77}]);
  for (const cars of [[{k: 'zzz', at: 1}], [{k: 't', at: 1}, {k: 't', at: 2}], [{k: 't', at: -1}], [{k: 't', at: 'x'}], [null], ['t'], [{at: 1}], owned(8).concat([{k: 'extra', at: 1}])]) {
    const e = createEngine({storage: memory(seeded({cars}))});
    assert.equal(e.status().blocked, true, JSON.stringify(cars));
  }
});
