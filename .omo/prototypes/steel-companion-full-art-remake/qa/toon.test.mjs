// 6단계: 웹툰 자료·읽음 표시 시험. 원본(src/app_tpl.html)의 원문을 Node vm에서 그대로 실행한 결과와 엔진 결과를 같은 입력에서 비교한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {section} from '../source.mjs';
import {createEngine} from '../src/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const source = fs.readFileSync(path.join(root, 'src/app_tpl.html'), 'utf8');
const KEY = 'sgg_game_toon_seen', SAVE = 'sgg_game_save_v1';
const record = JSON.parse(fs.readFileSync(path.join(root, 'current/approval/webtoon/webtoon-art-approval-2026-11-18.json'), 'utf8'));

// 원본 원문: 회차 자료·키·읽음 판정, 그리고 openToonView 안의 기록 문장(함수 껍데기만 테스트가 씌운다).
const originalScript = new vm.Script([
  section(source, 'var TOON = [', 'var toonModal'),
  section(source, 'function toonSeen(){', 'function renderToonBtn(){'),
  'function openWrite(i){ var t = TOON[i];\n' + section(source, '  if(i > toonSeenIdx()){ try{', '\n  renderToonBtn();') + '\n}',
  ';this.__api={TOON:TOON, toonSeen:toonSeen, toonSeenIdx:toonSeenIdx, openWrite:openWrite};'
].join('\n'), {filename: 'app_tpl.html (toon sections)'});
const GAME_EDITION = {toon: KEY};
function original(storage) {
  const context = {localStorage: storage, GAME_EDITION};
  vm.createContext(context); originalScript.runInContext(context); return context.__api;
}
function store(initial = {}, {getFails = false, setFails = false} = {}) {
  const map = new Map(Object.entries(initial)), writes = [];
  return {map, writes,
    getItem(k) { if (getFails) throw new Error('blocked'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { writes.push([k, v]); if (setFails) throw new Error('quota'); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }};
}
const engineFor = (storage, now = () => Date.UTC(2026, 10, 18, 3)) => createEngine({storage, now, random: () => 0.5, notification: undefined});

test('회차 자료: 원본과 같은 3회차, 형식과 승인 기록 일치', () => {
  const data = engineFor(store()).toon();
  const raw = original(store()).TOON;
  // 원본과 다른 곳은 연재 안내 lead의 이전 게임 이름 두 곳뿐이다(사용자 결정 2026-11-18).
  const expected = JSON.parse(JSON.stringify(raw).replaceAll('스틸 그레이드 가챠', '스틸 컴패니언').replaceAll('스틸가챠s', '스틸 컴패니언'));
  assert.deepEqual(data.episodes.map(({index, seen, isNew, ...t}) => t), expected);
  assert.deepEqual(data.episodes[0].lead, ['스틸 컴패니언', '스틸 컴패니언의 캐릭터들이 4컷 웹툰으로 찾아옵니다. 출하동과 견본실의 평범한 하루를, 피식 웃을 만큼만 그립니다.']);
  assert.ok(JSON.stringify(data.episodes).indexOf('가챠') < 0, '이전 게임 이름이 남지 않는다');
  assert.deepEqual(data.episodes.map(t => t.id), ['s00', 'ep01', 'ep02']);
  assert.equal(new Set(data.episodes.map(t => t.id)).size, data.episodes.length);
  const dates = data.episodes.map(t => t.date.replaceAll('.', '-'));
  assert.deepEqual(dates, [...dates].sort());
  const approved = new Map(record.files.map(f => [f.path, f]));
  const used = new Set();
  for (const t of data.episodes) {
    assert.ok(t.pages.length > 0);
    for (const p of t.pages) {
      assert.ok(Number.isInteger(p.w) && p.w > 0 && Number.isInteger(p.h) && p.h > 0, `${t.id} 크기`);
      assert.match(p.img, /^webtoon\/[a-z0-9-]+\.webp$/);
      assert.ok(approved.has(p.img), `승인 기록에 없는 그림 ${p.img}`);
      used.add(p.img);
    }
    assert.ok(approved.has(t.thumb)); used.add(t.thumb);
  }
  assert.deepEqual([...used].sort(), [...approved.keys()].sort(), '쓰는 그림 = 승인한 18장');
  assert.equal(record.files.length, 18);
  for (const f of record.files) {
    const bytes = fs.readFileSync(path.join(root, f.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), f.sha256, f.path);
    assert.equal(bytes.length, f.bytes);
    const copy = fs.readFileSync(path.join(here, '../public', f.path));
    assert.equal(crypto.createHash('sha256').update(copy).digest('hex'), f.sha256, 'public 복사본 ' + f.path);
  }
});

test('글에 HTML 태그가 없다(그래도 화면은 textContent로만 그린다)', () => {
  const texts = [];
  const walk = v => { if (typeof v === 'string') texts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(engineFor(store()).toon().episodes.map(({pages, ...t}) => ({...t, caps: pages.map(p => p.cap)})));
  const tags = texts.flatMap(t => t.match(/<[^>]*>/g) || []);
  assert.deepEqual(tags, []);
});

test('읽음: 처음은 모두 NEW, 열면 그 회차까지, 앞 회차를 열어도 되돌리지 않는다', () => {
  const s = store(), e = engineFor(s);
  let v = e.toon();
  assert.equal(v.seenIdx, -1); assert.equal(v.newCount, 3); assert.ok(v.hasNew); assert.ok(v.episodes.every(t => t.isNew && !t.seen));
  assert.deepEqual(e.toonOpen(1), {ok: true, saved: true, seenIdx: 1});
  v = e.toon(); assert.deepEqual(v.episodes.map(t => t.seen), [true, true, false]); assert.equal(v.newCount, 1);
  assert.equal(s.map.get(KEY), 'ep01');
  e.toonOpen(0); assert.equal(s.map.get(KEY), 'ep01', '되돌리지 않음');
  assert.equal(s.writes.length, 1, '앞 회차는 쓰지도 않는다');
  e.toonOpen(2); assert.equal(s.map.get(KEY), 'ep02'); assert.equal(e.toon().hasNew, false);
  assert.deepEqual(e.toonOpen(3), {ok: false, error: '없는 회차입니다.'});
  assert.equal(e.toonOpen(-1).ok, false); assert.equal(e.toonOpen(1.5).ok, false); assert.equal(e.toonOpen('1').ok, false);
});

test('이전 게임의 읽음 기록(같은 키)을 이어받는다', () => {
  const e = engineFor(store({[KEY]: 'ep01'}));
  assert.deepEqual(e.toon().episodes.map(t => t.seen), [true, true, false]);
});

test('원본 원문과 같은 입력에서 같은 결과(읽기·쓰기·손상·실패)', () => {
  const cases = [
    ['빈 저장', {}, {}], ['s00', {[KEY]: 's00'}, {}], ['ep02', {[KEY]: 'ep02'}, {}],
    ['손상: 모르는 id', {[KEY]: 'zzz'}, {}], ['손상: 빈 문자열', {[KEY]: ''}, {}], ['손상: 객체 문자열', {[KEY]: '{"id":"ep01"}'}, {}],
    ['읽기 실패', {[KEY]: 'ep01'}, {getFails: true}], ['쓰기 실패', {}, {setFails: true}], ['둘 다 실패', {}, {getFails: true, setFails: true}]
  ];
  for (const [name, initial, flags] of cases) {
    const so = store(initial, flags), se = store(initial, flags), o = original(so), e = engineFor(se);
    assert.equal(e.toon().seenIdx, o.toonSeenIdx(), `${name}: 읽음 위치`);
    for (const i of [2, 0, 1, 2, 1]) {
      o.openWrite(i); const r = e.toonOpen(i);
      assert.equal(se.map.get(KEY), so.map.get(KEY), `${name}: 열기 ${i} 뒤 저장 값`);
      assert.deepEqual(se.writes, so.writes, `${name}: 쓴 기록`);
      assert.equal(e.toon().seenIdx, o.toonSeenIdx(), `${name}: 열기 ${i} 뒤 위치`);
      assert.equal(r.ok, true);
      assert.equal(r.saved, o.toonSeenIdx() >= i, `${name}: saved는 되읽은 값`);
    }
  }
});

test('쓰기 실패는 조용히 무시하고 NEW가 그대로 남는다(원본과 같다)', () => {
  const e = engineFor(store({}, {setFails: true}));
  assert.deepEqual(e.toonOpen(1), {ok: true, saved: false, seenIdx: -1});
  assert.equal(e.toon().newCount, 3);
});

test('다른 탭이 앞서 읽은 기록은 다음 조회에 보이고, 앞선 기록은 덮어쓰지 않는다', () => {
  const s = store(), e = engineFor(s);
  e.toonOpen(0); s.map.set(KEY, 'ep02'); // 다른 탭이 2화까지 읽음
  assert.equal(e.toon().seenIdx, 2);
  e.toonOpen(1); assert.equal(s.map.get(KEY), 'ep02');
  s.map.set(KEY, 'ep01'); e.toonOpen(0); assert.equal(s.map.get(KEY), 'ep01');
});

test('웹툰은 진행 저장·경제값을 바꾸지 않는다', () => {
  const s = store(), e = engineFor(s), before = JSON.stringify(e.state());
  for (const i of [0, 1, 2]) e.toonOpen(i);
  assert.equal(JSON.stringify(e.state()), before);
  assert.equal(s.map.has(SAVE), false, '진행 저장 키를 쓰지 않는다');
  assert.deepEqual(s.writes.map(w => w[0]), [KEY, KEY, KEY].slice(0, s.writes.length));
  assert.ok(s.writes.every(w => w[0] === KEY));
  // 진행 저장이 막혀 있어도(손상 저장) 읽음 표시는 따로 돈다.
  const bad = store({[SAVE]: '{깨짐'}), eb = engineFor(bad);
  assert.equal(eb.toonOpen(1).saved, true); assert.equal(bad.map.get(SAVE), '{깨짐');
});
