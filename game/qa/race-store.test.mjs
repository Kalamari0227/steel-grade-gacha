import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {createRaceStore, RACE_KEY, GOLD, SILVER, medalOf, MEDAL_TEXT} from '../src/race-store.mjs';
import {COURSES} from '../src/race-rules.mjs';

// 확장 A(주행 시험장) 기록 저장: 본편 세이브와 다른 칸, 더 빠를 때만 쓰기, 깨진 값 무시, 본편 세이브 바이트 불변.
const data = JSON.parse(fs.readFileSync(new URL('../public/data.json', import.meta.url), 'utf8'));
const CARS = data.cars.map(c => c.key), KEYS = COURSES.map(c => c.key);
function memory(seed = {}) {
  const map = new Map(Object.entries(seed)), writes = [];
  return {getItem: key => map.get(key) ?? null, setItem: (key, value) => { writes.push(key); map.set(key, value); }, removeItem: key => map.delete(key), map, writes};
}
const store = storage => createRaceStore(storage, {cars: CARS, courses: KEYS});
const ghost = n => Array.from({length: n}, (_, i) => [i * 14.5, 0.1]);

test('keys and medal thresholds', () => {
  assert.equal(RACE_KEY, 'sgg_game_race_v1');
  assert.notEqual(RACE_KEY, SAVE_KEY);
  assert.deepEqual([GOLD, SILVER], [70, 76]);
  assert.deepEqual([69.99, 70, 70.01, 76, 76.01, 200].map(medalOf), ['gold', 'gold', 'silver', 'silver', 'bronze', 'bronze']);
  assert.deepEqual(MEDAL_TEXT, {gold: '금', silver: '은', bronze: '동'});
  assert.deepEqual([CARS.length, KEYS.length], [8, 4]);
});

test('empty store: no best, four empty medals, reading writes nothing', () => {
  const storage = memory(), s = store(storage);
  assert.equal(s.best('t', 'base'), null);
  assert.deepEqual(s.summary('t'), {medals: ['', '', '', ''], fastest: null, runs: 0});
  assert.deepEqual(storage.writes, []);
});

test('record keeps only the fastest run per car and course', () => {
  const storage = memory(), s = store(storage);
  assert.deepEqual(s.record('t', 'base', 70.127, ghost(280)), {ok: true, improved: true, previous: null, medal: 'silver'});
  assert.deepEqual(s.record('t', 'base', 71, ghost(284)), {ok: true, improved: false, previous: 70.13, medal: 'silver'});
  assert.deepEqual(s.record('t', 'base', 70.13, ghost(280)), {ok: true, improved: false, previous: 70.13, medal: 'silver'});
  assert.deepEqual(s.record('t', 'base', 64.2, ghost(257)), {ok: true, improved: true, previous: 70.13, medal: 'gold'});
  assert.deepEqual(s.record('t', 'oval', 80, ghost(320)), {ok: true, improved: true, previous: null, medal: 'bronze'});
  assert.deepEqual(s.record('h', 'base', 99, ghost(3)), {ok: true, improved: true, previous: null, medal: 'bronze'});
  const best = s.best('t', 'base');
  assert.deepEqual([best.t, best.medal, best.ghost.length], [64.2, 'gold', 257]);
  assert.deepEqual(s.summary('t'), {medals: ['gold', '', '', 'bronze'], fastest: 64.2, runs: 2});
  assert.deepEqual(s.summary('h'), {medals: ['bronze', '', '', ''], fastest: 99, runs: 1});
  assert.deepEqual(storage.writes, [RACE_KEY, RACE_KEY, RACE_KEY, RACE_KEY]);
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(RACE_KEY)).best).sort(), ['h:base', 't:base', 't:oval']);
  assert.deepEqual(store(storage).summary('t'), s.summary('t'));
});

test('unknown cars or courses, bad times and bad ghosts are refused without writing', () => {
  const storage = memory(), s = store(storage);
  for (const args of [['x', 'base', 70, []], ['t', 'nowhere', 70, []], ['t', 'base', 5, []], ['t', 'base', NaN, []], ['t', 'base', '70', []], ['t', 'base', 4000, []],
    ['t', 'base', 70, 'ghost'], ['t', 'base', 70, [[1]]], ['t', 'base', 70, [[1, 'a']]], ['t', 'base', 70, ghost(2401)], ['t:base', 'base', 70, []]])
    assert.equal(s.record(...args).ok, false, JSON.stringify(args).slice(0, 60));
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.getItem(RACE_KEY), null);
});

test('broken or foreign stored values are ignored row by row and never thrown', () => {
  for (const raw of ['', 'not json', 'null', '[]', '{"v":2,"best":{}}', '{"v":1}', '{"v":1,"best":[]}', '{"v":1,"best":null}']) {
    const s = store(memory({[RACE_KEY]: raw}));
    assert.deepEqual(s.summary('t'), {medals: ['', '', '', ''], fastest: null, runs: 0}, raw);
  }
  const mixed = JSON.stringify({v: 1, best: {'t:base': {t: 66, ghost: [[0, 0]]}, 't:oval': {t: 'fast', ghost: []}, 'zz:base': {t: 60, ghost: []}, 't:winter': {t: 70}, 'h:safety:x': {t: 70, ghost: []}, 'h:safety': null}});
  const storage = memory({[RACE_KEY]: mixed}), s = store(storage);
  assert.deepEqual(s.summary('t'), {medals: ['gold', '', '', ''], fastest: 66, runs: 1});
  assert.deepEqual(s.summary('h').runs, 0);
  // 다음에 쓸 때는 읽을 수 있던 줄만 남는다.
  assert.equal(s.record('h', 'base', 75, []).improved, true);
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(RACE_KEY)).best).sort(), ['h:base', 't:base']);
});

test('storage that throws: reads look empty, a record reports failure, nothing escapes', () => {
  const dead = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }};
  const s = store(dead);
  assert.equal(s.best('t', 'base'), null);
  assert.deepEqual(s.record('t', 'base', 70, []), {ok: false, improved: false, previous: null, medal: 'gold'});
  const full = memory(); full.setItem = () => { throw new Error('full'); };
  assert.equal(store(full).record('t', 'base', 70, []).ok, false);
});

test('economy is untouched: recording races leaves the main save bytes, state and writes exactly as they were', () => {
  const storage = memory(), engine = createEngine({storage});
  const seeded = JSON.stringify({...engine.state(), scrap: 7});
  storage.map.set(SAVE_KEY, seeded);
  const e2 = createEngine({storage}), before = JSON.stringify(e2.state()), garage = JSON.stringify(e2.garage());
  storage.writes.length = 0;
  const s = store(storage);
  for (const car of CARS) for (const course of KEYS) { s.record(car, course, 90, ghost(40)); s.record(car, course, 64, ghost(40)); s.summary(car); s.best(car, course); }
  assert.equal(storage.getItem(SAVE_KEY), seeded);
  assert.equal(JSON.stringify(e2.state()), before);
  assert.equal(JSON.stringify(e2.garage()), garage);
  assert.deepEqual([...new Set(storage.writes)], [RACE_KEY]);
  assert.deepEqual([...storage.map.keys()].sort(), [RACE_KEY, SAVE_KEY].sort());
  assert.equal(JSON.stringify(createEngine({storage}).state()), before);
  assert.deepEqual(s.summary('d'), {medals: ['gold', 'gold', 'gold', 'gold'], fastest: 64, runs: 4});
});

test('the module imports nothing and never names the main save, stock or scrap', () => {
  const source = fs.readFileSync(new URL('../src/race-store.mjs', import.meta.url), 'utf8');
  assert.equal(/^\s*import\b/m.test(source), false);
  for (const word of ['localStorage', 'document', 'window', 'innerHTML', 'removeItem', 'sgg_game_save', 'engine']) assert.equal(source.replace(/\/\/.*$/gm, '').includes(word), false, word);
});
