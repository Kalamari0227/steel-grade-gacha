// 6단계: 웹툰 자료·읽음 표시 시험. 원본 원문을 Node vm에서 그대로 실행한 결과와 엔진 결과를 같은 입력에서 비교한다.
// 원본: 웹툰 전용 고정 출처 src/upstream/app_tpl-e5c9673.html(포크 e5c9673, 2026-11-20 사용자 결정). 규칙 템플릿(src/app_tpl.html)의 읽음 판정·기록 원문이 이 출처와 글자까지 같은지도 본다.
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
const source = fs.readFileSync(path.join(root, 'src/upstream/app_tpl-e5c9673.html'), 'utf8');
const rulesTemplate = fs.readFileSync(path.join(root, 'src/app_tpl.html'), 'utf8');
const KEY = 'sgg_game_toon_seen', SAVE = 'sgg_game_save_v1';
const record = JSON.parse(fs.readFileSync(path.join(root, 'current/approval/webtoon/webtoon-art-approval-2026-11-20.json'), 'utf8'));
const SCOPE = ['s00', 'ep01', 'ep02', 'ep03', 'ep04', 'ep05', 'ep06', 'ep07'];

// 원본 원문: 회차 자료(웹툰 출처)·키(규칙 템플릿의 게임판 키 줄. 원본 'var TOON_SEEN = "sgg_toon_seen";'의 키 이름만 게임판 것으로 바꾼 줄)·읽음 판정,
// 그리고 openToonView 안의 기록 문장(함수 껍데기만 테스트가 씌운다).
assert.equal(section(source, 'var TOON_SEEN', '\nvar toonModal'), 'var TOON_SEEN = "sgg_toon_seen";');
const originalScript = new vm.Script([
  section(source, 'var TOON = [', 'var TOON_SEEN'),
  section(rulesTemplate, 'var TOON_SEEN = GAME_EDITION.toon;', '\nvar toonModal'),
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

test('고정 출처: 웹툰 원본 사본은 포크 e5c9673과 같은 바이트, 읽음 판정·기록 원문은 규칙 템플릿과 같다', () => {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), '08a2983b5d936b30398388edfefc29d1e4bdf6cf90d8a14423867f4557a6d1a2');
  assert.equal(section(rulesTemplate, 'function toonSeen(){', 'function renderToonBtn(){'), section(source, 'function toonSeen(){', 'function toonEpCount(){'), '원본이 새로 넣은 toonEpCount(목록 부제의 본편 수, 화면 일)만 사이에 있다');
  assert.equal(section(rulesTemplate, '  if(i > toonSeenIdx()){ try{', '\n  renderToonBtn();'), section(source, '  if(i > toonSeenIdx()){ try{', '\n  renderToonBtn();'));
  // 규칙 템플릿(6784048 기준)의 앞 세 회차와 비교: 원본이 이후에 고친 두 곳만 다르다(타래 소개 글, 2화 끝 각주 삭제 1438387).
  const old = (() => { const c = {}; vm.createContext(c); new vm.Script(section(rulesTemplate, 'var TOON = [', 'var TOON_SEEN') + ';this.T=TOON;').runInContext(c); return JSON.parse(JSON.stringify(c.T)); })();
  const now3 = JSON.parse(JSON.stringify(original(store()).TOON.slice(0, 3)));
  assert.equal(old.length, 3);
  assert.notEqual(old[0].pages[4].cap[1], now3[0].pages[4].cap[1]);
  assert.match(old[2].note, /톤당 100만 원/); assert.equal(now3[2].note, undefined);
  old[0].pages[4].cap[1] = now3[0].pages[4].cap[1]; delete old[2].note;
  assert.deepEqual(old, now3);
});

test('회차 자료: 원본에서 승인한 8회차(연재 안내·1~7화), 특별편 제외, 형식과 승인 기록 일치', () => {
  const data = engineFor(store()).toon();
  const all = original(store()).TOON;
  assert.equal(all[all.length - 1].id, 'sp01', '특별편은 원본 맨 끝 회차(빼도 앞 회차의 위치가 같다)');
  const raw = all.filter(t => SCOPE.includes(t.id));
  // 원본과 다른 곳은 연재 안내 lead의 이전 게임 이름 두 곳뿐이다(사용자 결정 2026-11-18).
  const expected = JSON.parse(JSON.stringify(raw).replaceAll('스틸 그레이드 가챠', '스틸 컴패니언').replaceAll('스틸가챠s', '스틸 컴패니언'));
  assert.deepEqual(data.episodes.map(({index, seen, isNew, ...t}) => t), expected);
  assert.deepEqual(data.episodes[0].lead, ['스틸 컴패니언', '스틸 컴패니언의 캐릭터들이 4컷 웹툰으로 찾아옵니다. 출하동과 견본실의 평범한 하루를, 피식 웃을 만큼만 그립니다.']);
  assert.ok(JSON.stringify(data.episodes).indexOf('가챠') < 0, '이전 게임 이름이 남지 않는다');
  assert.deepEqual(data.episodes.map(t => t.id), SCOPE);
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
  assert.deepEqual([...used].sort(), [...approved.keys()].sort(), '쓰는 그림 = 승인한 64장');
  assert.equal(record.files.length, 64);
  assert.ok(record.files.every(f => !/sp01/.test(f.path)), '특별편 그림은 승인 범위 밖');
  // 앞선 승인 기록(2026-11-18)의 18장은 그대로 들어 있다.
  const prev = JSON.parse(fs.readFileSync(path.join(root, 'current/approval/webtoon/webtoon-art-approval-2026-11-18.json'), 'utf8'));
  for (const f of prev.files) assert.deepEqual(approved.get(f.path), f);
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
  assert.equal(v.seenIdx, -1); assert.equal(v.newCount, 8); assert.ok(v.hasNew); assert.ok(v.episodes.every(t => t.isNew && !t.seen));
  assert.deepEqual(e.toonOpen(1), {ok: true, saved: true, seenIdx: 1});
  v = e.toon(); assert.deepEqual(v.episodes.map(t => t.seen), [true, true, false, false, false, false, false, false]); assert.equal(v.newCount, 6);
  assert.equal(s.map.get(KEY), 'ep01');
  e.toonOpen(0); assert.equal(s.map.get(KEY), 'ep01', '되돌리지 않음');
  assert.equal(s.writes.length, 1, '앞 회차는 쓰지도 않는다');
  e.toonOpen(2); assert.equal(s.map.get(KEY), 'ep02'); assert.equal(e.toon().hasNew, true); assert.equal(e.toon().newCount, 5);
  e.toonOpen(7); assert.equal(s.map.get(KEY), 'ep07'); assert.equal(e.toon().hasNew, false);
  assert.deepEqual(e.toonOpen(8), {ok: false, error: '없는 회차입니다.'}, '특별편(원본 8번)은 열 수 없다');
  assert.equal(e.toonOpen(-1).ok, false); assert.equal(e.toonOpen(1.5).ok, false); assert.equal(e.toonOpen('1').ok, false);
});

test('이전 게임의 읽음 기록(같은 키)을 이어받는다', () => {
  const e = engineFor(store({[KEY]: 'ep01'}));
  assert.deepEqual(e.toon().episodes.map(t => t.seen), [true, true, false, false, false, false, false, false]);
});

test('원본 원문과 같은 입력에서 같은 결과(읽기·쓰기·손상·실패)', () => {
  const cases = [
    ['빈 저장', {}, {}], ['s00', {[KEY]: 's00'}, {}], ['ep02', {[KEY]: 'ep02'}, {}], ['ep05', {[KEY]: 'ep05'}, {}], ['ep07', {[KEY]: 'ep07'}, {}],
    ['손상: 모르는 id', {[KEY]: 'zzz'}, {}], ['손상: 빈 문자열', {[KEY]: ''}, {}], ['손상: 객체 문자열', {[KEY]: '{"id":"ep01"}'}, {}],
    ['읽기 실패', {[KEY]: 'ep01'}, {getFails: true}], ['쓰기 실패', {}, {setFails: true}], ['둘 다 실패', {}, {getFails: true, setFails: true}]
  ];
  for (const [name, initial, flags] of cases) {
    const so = store(initial, flags), se = store(initial, flags), o = original(so), e = engineFor(se);
    assert.equal(e.toon().seenIdx, o.toonSeenIdx(), `${name}: 읽음 위치`);
    for (const i of [2, 0, 1, 2, 1, 6, 4, 7, 3]) {
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
  assert.equal(e.toon().newCount, 8);
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

test('알려진 차이: 읽음 키에 특별편 id(sp01)가 있으면 원본은 끝까지 읽음, 게임판은 모르는 값이라 모두 NEW', () => {
  // 게임판 키(sgg_game_toon_seen)는 게임판만 쓰고, 게임판은 특별편을 열 수 없으므로 이 값은 생기지 않는다. 손상 값과 같게 다룬다.
  const o = original(store({[KEY]: 'sp01'})), e = engineFor(store({[KEY]: 'sp01'}));
  assert.equal(o.toonSeenIdx(), 8);
  assert.equal(e.toon().seenIdx, -1); assert.equal(e.toon().newCount, 8);
});
