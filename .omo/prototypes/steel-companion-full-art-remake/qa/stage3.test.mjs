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
