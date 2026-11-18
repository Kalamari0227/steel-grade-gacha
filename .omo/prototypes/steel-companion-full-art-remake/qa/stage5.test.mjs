// 본 개발 5단계(공지·기간 행사·출하 알림) 엔진 검사. 규칙은 원본 추출 구간(source.mjs)이 맡고, 여기서는 엔진이 그것을 어떤 보호 안에서 부르는지 본다.
// 이 단계가 바꾸는 저장 항목은 noticeSeen·promoSeen·promoDone·bell·belledAt뿐이다(경제값 불변).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {kstWhen, kstRange, bandModel, bellModel} from '../src/opsview.mjs';
import {commandSafely} from '../src/shipments.mjs';

const DAY = 86400000, HOUR = 3600000;
const T_PROMO = Date.UTC(2026, 9, 22, 3);       // 2026-10-22 12:00 KST (품질 교육 주간 진행 중)
const T_AFTER = Date.UTC(2026, 10, 18, 3);      // 2026-11-18 (모든 행사가 끝난 지금)
const OPS_KEYS = ['noticeSeen', 'promoSeen', 'promoDone', 'bell', 'belledAt'];
function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []), m = {writes: 0, map, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => { m.writes++; map.set(k, String(v)); }, removeItem: k => map.delete(k)};
  return m;
}
const fresh = () => createEngine({storage: memory()}).state();
const saveWith = (extra = {}) => JSON.stringify({...fresh(), ...extra});
const note = permission => ({permission});
function make({raw, storage = memory(raw), at = T_PROMO, notification = note('granted')} = {}) {
  let t = at; const e = createEngine({storage, now: () => t, notification: notification === 'none' ? undefined : notification});
  return {e, storage, clock: v => { t = v; }, now: () => t};
}
const rest = state => { const s = JSON.parse(JSON.stringify(state)); for (const k of OPS_KEYS) delete s[k]; return s; };
const rules = createLegacy();

// ── 자료 ──
test('data: notices and promos are well formed, ordered, non-overlapping, with only <b> and <br> tags', () => {
  for (const [name, list, end] of [['NOTICES', rules.NOTICES, 'until'], ['PROMOS', rules.PROMOS, 'to']]) {
    assert.equal(new Set(list.map(x => x.key)).size, list.length, name + ' keys unique');
    list.forEach((x, i) => {
      assert.ok(x.from < x[end], name + ' from < ' + end);
      if (i) assert.ok(list[i - 1][end] <= x.from, name + ' sorted and not overlapping');
    });
  }
  const strings = [];
  for (const n of rules.NOTICES) strings.push(n.title, n.lead, ...n.items.flatMap(i => [i.h, i.p]));
  for (const p of rules.PROMOS) strings.push(p.name, p.why);
  for (const s of strings) {
    assert.ok(!/<(?!\/?b>|br>)|(?<!<\/?b|<br)>/.test(s.replace(/<\/?b>|<br>/g, '')), s.slice(0, 40));
    assert.equal((s.match(/<b>/g) || []).length, (s.match(/<\/b>/g) || []).length, 'balanced <b>: ' + s.slice(0, 40));
  }
  // 원본 행사 5건이 글자 그대로 들어 있다(마지막은 품질 교육 주간, 퀴즈 한도 5).
  assert.equal(rules.PROMOS.length, 5);
  assert.equal(rules.PROMOS.at(-1).name, '품질 교육 주간');
  assert.equal(rules.PROMOS.at(-1).quizMax, 5);
  assert.equal(rules.NOTICES.length, 4);
});

test('kstWhen writes Korean time regardless of device timezone', () => {
  assert.equal(kstWhen(Date.UTC(2026, 8, 26, 15)), '9월 27일 00:00');
  assert.equal(kstRange(Date.UTC(2026, 9, 21, 15), Date.UTC(2026, 9, 25, 15)), '10월 22일 00:00 ~ 10월 26일 00:00 (한국 시간)');
});

// ── 조회 ──
test('ops(): the real present (all promos over) is a normal "no event" state with nothing pending', () => {
  const h = make({at: T_AFTER}), o = h.e.ops();
  assert.equal(o.promo.status, 'ended'); assert.equal(o.promo.key, '2026-10-22');
  assert.equal(o.notice.state, 'ended');
  assert.deepEqual(o.pending, {notice: false, promo: false, promoEnd: false});
  assert.equal(bandModel(o).kind, 'none');
  assert.equal(h.storage.writes, 0);
});

test('ops(): promo status and the limit shown match the original limit functions at the same instant', () => {
  const h = make(), oracle = createLegacy({now: () => h.now()});
  for (const t of [T_PROMO, Date.UTC(2026, 9, 21, 15) - 1, Date.UTC(2026, 9, 21, 15), Date.UTC(2026, 9, 25, 15) - 1, Date.UTC(2026, 9, 25, 15), T_AFTER]) {
    h.clock(t);
    const o = h.e.ops(), q = h.e.quiz();
    assert.equal(o.promo.status === 'on', oracle.promoOn(), 'on at ' + t);
    assert.equal(q.max, oracle.quizMax(), 'quiz max at ' + t);
    assert.equal(h.e.status().singleLeft, oracle.pullsLeft() , 'pull left at ' + t);
  }
});

test('queries never write: ops() leaves memory and storage unchanged, even with pending items', () => {
  const h = make(), before = JSON.stringify(h.e.state());
  for (let i = 0; i < 3; i++) assert.equal(h.e.ops().pending.notice, true);
  assert.equal(JSON.stringify(h.e.state()), before);
  assert.equal(h.storage.writes, 0);
});

// ── 확인 기록 ──
test('ackNotice: records noticeSeen (and promoSeen when a promo is on) once; economy untouched; twice writes once', () => {
  const h = make(), before = rest(h.e.state());
  const a = h.e.ackNotice('2026-10-22');
  assert.deepEqual(a, {ok: true, changed: true, saved: true});
  const s = h.e.state();
  assert.equal(s.noticeSeen, '2026-10-22'); assert.equal(s.promoSeen, '2026-10-22'); assert.equal(s.promoDone, '');
  assert.deepEqual(rest(s), before);
  assert.equal(h.storage.writes, 1);
  assert.deepEqual(h.e.ackNotice('2026-10-22'), {ok: true, changed: false});
  assert.equal(h.storage.writes, 1);
  assert.deepEqual(h.e.ops().pending, {notice: false, promo: false, promoEnd: false}, 'the notice already covered the promo guide');
  assert.deepEqual(JSON.parse(h.storage.getItem(SAVE_KEY)).noticeSeen, '2026-10-22');
});

test('ackPromo and ackPromoEnd: each writes only its own field, once, and only for the current key', () => {
  const h = make({at: Date.UTC(2026, 9, 9, 3)});                  // 한글날 연휴 특근 중(공지도 같은 날 열림)
  const o = h.e.ops(); assert.equal(o.promo.key, '2026-10-09');
  assert.deepEqual(h.e.ackPromo('wrong'), {ok: true, changed: false, stale: true}); assert.equal(h.storage.writes, 0);
  assert.equal(h.e.ackPromo('2026-10-09').changed, true);
  assert.equal(h.e.state().promoSeen, '2026-10-09'); assert.equal(h.e.state().noticeSeen, ''); assert.equal(h.e.state().promoDone, '');
  assert.equal(h.e.ackPromo('2026-10-09').changed, false);
  // 원본 curPromo는 "아직 끝나지 않은 첫 행사"를 돌려주므로, 뒤에 다른 행사가 있으면 앞 행사가 끝나는 순간 PROMO가 다음 행사로 넘어간다.
  // 그래서 종료 안내(promoDone)는 마지막 행사가 끝난 뒤에만 뜬다(원본 checkPromo의 동작 그대로). 아래는 마지막 행사로 본다.
  h.clock(Date.UTC(2026, 9, 11, 15));
  assert.equal(h.e.ops().promo.key, '2026-10-15'); assert.equal(h.e.ops().pending.promoEnd, false);
  const last = make({raw: saveWith({promoSeen: '2026-10-22'}), at: Date.UTC(2026, 9, 25, 15) - 1});
  assert.equal(last.e.ops().pending.promoEnd, false, '1ms before the end the promo is still on');
  last.clock(Date.UTC(2026, 9, 25, 15));
  assert.equal(last.e.ops().pending.promoEnd, true);
  assert.equal(last.e.ackPromoEnd('2026-10-22').changed, true);
  assert.equal(last.e.state().promoDone, '2026-10-22'); assert.equal(last.e.state().promoSeen, '2026-10-22');
  assert.equal(last.e.ackPromoEnd('2026-10-22').changed, false);
  assert.equal(last.storage.writes, 1); assert.equal(h.storage.writes, 1);
});

test('the end notice is only for people who saw the promo', () => {
  const h = make({at: T_AFTER});
  assert.equal(h.e.ops().pending.promoEnd, false);
  const seen = make({raw: saveWith({promoSeen: '2026-10-22'}), at: T_AFTER});
  assert.equal(seen.e.ops().pending.promoEnd, true);
  seen.e.ackPromoEnd('2026-10-22'); assert.equal(seen.e.ops().pending.promoEnd, false);
});

// ── 알림 ──
test('enableBell: only with granted permission; denied/default/unsupported never turn bell on and write nothing', () => {
  for (const [permission, reason] of [['denied', 'denied'], ['default', 'default']]) {
    const h = make({notification: note(permission)}), r = h.e.enableBell();
    assert.equal(r.ok, false); assert.equal(r.reason, reason); assert.equal(h.e.state().bell, false); assert.equal(h.storage.writes, 0);
    assert.equal(h.e.ops().bell.on, false);
  }
  const none = make({notification: 'none'}), r = none.e.enableBell();
  assert.equal(r.ok, false); assert.equal(r.reason, 'unsupported'); assert.equal(none.e.ops().bell.supported, false); assert.equal(none.storage.writes, 0);
  assert.equal(bellModel(none.e.ops().bell).go, '');            // 켜진 것처럼 보이지 않는다(버튼도 없다)
});

test('enableBell: grants → bell on and saved; an already-open cycle is not announced; disable turns it off; repeats write nothing', () => {
  const h = make({raw: saveWith({pullAt: 0})});
  const r = h.e.enableBell();
  assert.equal(r.ok, true); assert.equal(r.changed, true); assert.equal(r.readyNow, true);
  assert.equal(h.e.state().bell, true); assert.equal(h.e.ops().bell.on, true); assert.equal(h.storage.writes, 1);
  assert.equal(h.e.enableBell().changed, false); assert.equal(h.storage.writes, 1);
  assert.equal(h.e.disableBell().changed, true); assert.equal(h.e.state().bell, false);
  assert.equal(h.e.disableBell().changed, false);
  // 켜는 순간 이미 열려 있던 주기(pullAt이 있고 24시간이 안 지남이 아니라 몫이 남은 상태)까지 알리지는 않는다.
  const open = make({raw: saveWith({pullAt: T_PROMO - 2 * DAY, pullUsed: 1})});
  open.e.enableBell(); assert.equal(open.e.state().belledAt, T_PROMO - 2 * DAY);
});

test('a stored bell whose permission is granted again: enable runs the original statements (belledAt aligned) and writes once', () => {
  const pullAt = T_PROMO - 2 * DAY, h = make({raw: saveWith({bell: true, belledAt: -1, pullAt, pullUsed: 1})});
  const r = h.e.enableBell();
  assert.equal(r.ok, true); assert.equal(r.changed, true); assert.equal(h.e.state().belledAt, pullAt); assert.equal(h.storage.writes, 1);
  assert.equal(h.e.enableBell().changed, false); assert.equal(h.storage.writes, 1);
});

test('a stored bell with revoked permission shows off and is cleared by disable', () => {
  const h = make({raw: saveWith({bell: true}), notification: note('denied')});
  assert.equal(h.e.ops().bell.stored, true); assert.equal(h.e.ops().bell.on, false);
  assert.equal(h.e.disableBell().changed, true); assert.equal(h.e.state().bell, false);
});

test('fireBell: one notification per cycle (belledAt), never for a save that never shipped, ±1ms at the renewal instant', () => {
  const pullAt = T_PROMO;
  const h = make({raw: saveWith({bell: true, belledAt: -1, pullAt, pullUsed: 1}), at: pullAt + DAY - 1});
  assert.equal(h.e.readyEdge(), false);                              // 닫힘 상태가 처음 관측됨
  assert.deepEqual(h.e.fireBell(), {ok: true, fired: false});         // 아직 갱신 전(−1ms)
  h.clock(pullAt + DAY);                                             // 정확히 갱신 시각
  assert.equal(h.e.readyEdge(), true);                               // 닫힘 → 열림 전이는 한 번
  assert.equal(h.e.readyEdge(), false);
  const first = h.e.fireBell(); assert.equal(first.fired, true); assert.equal(h.e.state().belledAt, pullAt); assert.equal(h.storage.writes, 1);
  assert.deepEqual(h.e.fireBell(), {ok: true, fired: false}); assert.equal(h.storage.writes, 1);
  // pullAt이 0(한 번도 출하하지 않음)이면 알릴 것이 없다.
  const never = make({raw: saveWith({bell: true, pullAt: 0}), at: pullAt + 5 * DAY});
  assert.equal(never.e.fireBell().fired, false); assert.equal(never.storage.writes, 0);
  // 알림이 꺼져 있으면 알리지 않는다.
  const off = make({raw: saveWith({bell: false, pullAt, pullUsed: 1}), at: pullAt + DAY});
  assert.equal(off.e.fireBell().fired, false);
});

test('readyEdge: opening after the renewal gives no edge; a page left open across the renewal gives one', () => {
  const pullAt = T_PROMO, raw = saveWith({bell: true, pullAt, pullUsed: 1});
  const late = make({raw, at: pullAt + DAY + 5 * HOUR});            // 닫았다가 갱신 뒤에 연 경우: 부팅 때 이미 열림
  assert.equal(late.e.readyEdge(), false); assert.equal(late.e.readyEdge(), false);
  const open = make({raw, at: pullAt + DAY - 30000});
  assert.equal(open.e.readyEdge(), false);
  open.clock(pullAt + DAY + 1); assert.equal(open.e.readyEdge(), true);
});

test('a device clock that goes backwards never creates an edge or a second notification', () => {
  const pullAt = T_PROMO, h = make({raw: saveWith({bell: true, belledAt: -1, pullAt, pullUsed: 1}), at: pullAt + DAY + 1});
  assert.equal(h.e.readyEdge(), false);                              // 이미 열린 상태로 시작
  h.clock(pullAt + DAY - 10 * HOUR); assert.equal(h.e.readyEdge(), false);   // 시계가 뒤로 감: 닫힘
  h.clock(pullAt + DAY + 1);         assert.equal(h.e.readyEdge(), true);    // 다시 앞으로: 열림 전이
  assert.equal(h.e.fireBell().fired, true);
  h.clock(pullAt + DAY - 10 * HOUR); h.e.readyEdge(); h.clock(pullAt + DAY + 2); assert.equal(h.e.readyEdge(), true);
  assert.equal(h.e.fireBell().fired, false, 'belledAt already equals pullAt: the same cycle is not announced twice');
});

test('the 5th-stage commands never change an economy value', () => {
  const h = make({raw: saveWith({pullAt: T_PROMO - DAY, pullUsed: 1, extra: 2, scrap: 7, quizAt: T_PROMO - HOUR, quizUsed: 1}), notification: note('granted')});
  const before = rest(h.e.state());
  h.e.ackNotice('2026-10-22'); h.e.ackPromo('2026-10-22'); h.e.enableBell(); h.e.readyEdge(); h.e.fireBell(); h.e.disableBell();
  h.clock(T_AFTER); h.e.ackPromoEnd('2026-10-22');
  assert.deepEqual(rest(h.e.state()), before);
  for (const k of ['owned', 'stock', 'scrap', 'extra', 'pullAt', 'pullUsed', 'quizAt', 'quizUsed', 'items', 'parts', 'cars', 'orderDay', 'orderKey', 'orderDone']) assert.deepEqual(h.e.state()[k], before[k], k);
});

// ── 저장 보호 ──
test('persistence: a stale tab cannot record and keeps the other tab save', () => {
  const h = make(), other = JSON.stringify({...JSON.parse(h.storage.getItem(SAVE_KEY) || JSON.stringify(h.e.state())), scrap: 99});
  h.storage.map.set(SAVE_KEY, other);
  const r = h.e.ackNotice('2026-10-22');
  assert.equal(r.ok, false); assert.match(r.error, /다른 탭/);
  assert.equal(h.storage.getItem(SAVE_KEY), other); assert.equal(h.storage.writes, 0);
  assert.deepEqual(h.e.ops().pending, {notice: false, promo: false, promoEnd: false}, 'blocked: nothing is offered');
  assert.equal(h.e.enableBell().ok, false); assert.equal(h.e.fireBell().ok, false);
});

test('persistence: a corrupt save is held — nothing is pending, nothing is written', () => {
  const raw = '{bad', h = make({raw});
  assert.equal(h.e.status().blocked, true);
  assert.deepEqual(h.e.ops().pending, {notice: false, promo: false, promoEnd: false});
  for (const r of [h.e.ackNotice('2026-10-22'), h.e.ackPromo('2026-10-22'), h.e.enableBell(), h.e.disableBell(), h.e.fireBell()]) assert.equal(r.ok, false);
  assert.equal(h.storage.getItem(SAVE_KEY), raw); assert.equal(h.storage.writes, 0);
});

test('persistence: a write failure keeps the in-memory record, reports it, and the lock wrapper still serialises', async () => {
  const storage = memory(); storage.setItem = () => { throw new Error('quota'); };
  const h = make({storage}), r = h.e.ackNotice('2026-10-22');
  assert.equal(r.ok, true); assert.equal(r.changed, true); assert.equal(r.saved, false); assert.match(r.warning, /저장/);
  assert.equal(h.e.state().noticeSeen, '2026-10-22');
  assert.equal(h.e.ackNotice('2026-10-22').changed, false);
  const order = []; const locks = {request: async (name, run) => { order.push(name); return run(); }};
  const out = await commandSafely(() => h.e.ackPromo('2026-10-22'), {locks});
  assert.equal(out.ok, true); assert.deepEqual(order, [SAVE_KEY]);
});

test('a command running at the same time is refused (commandBusy)', () => {
  const h = make();
  let inner;
  const e2 = h.e; const orig = JSON.stringify;
  JSON.stringify = function (...a) { if (!inner) { inner = e2.ackPromo('2026-10-22'); } return orig.apply(this, a); };
  try { e2.ackNotice('2026-10-22'); } finally { JSON.stringify = orig; }
  assert.equal(inner.ok, false);
});

// ── 이전 게임 저장 이어받기 ──
test('an old save with promoSeen/noticeSeen/promoDone/bell/belledAt is kept as is: nothing already confirmed shows again', () => {
  const raw = saveWith({noticeSeen: '2026-10-22', promoSeen: '2026-10-22', promoDone: '2026-10-22', bell: true, belledAt: 1234567});
  const h = make({raw, at: T_PROMO});
  const s = h.e.state();
  assert.deepEqual(OPS_KEYS.map(k => s[k]), ['2026-10-22', '2026-10-22', '2026-10-22', true, 1234567]);
  assert.deepEqual(h.e.ops().pending, {notice: false, promo: false, promoEnd: false});
  assert.equal(h.storage.writes, 0);
  const done = make({raw, at: T_AFTER});
  assert.deepEqual(done.e.ops().pending, {notice: false, promo: false, promoEnd: false});
});

test('odd stored values are normalized or self-heal like the original: no hold, nothing breaks, nothing shows twice after confirm', () => {
  // 원본 applySaved: bell=!!p.bell, belledAt은 숫자가 아니면 −1, 나머지 셋은 p||"". 이 값들은 비교(===)에만 쓰이므로 어떤 값이어도 오동작하지 않고 한 번 확인하면 정상 값이 된다.
  for (const odd of [{bell: 'yes', belledAt: 'x', noticeSeen: 5, promoSeen: {a: 1}, promoDone: true}, {belledAt: -5.5, noticeSeen: null, promoSeen: false}]) {
    const h = make({raw: saveWith(odd)});
    assert.equal(h.e.status().blocked, false);
    assert.equal(typeof h.e.state().bell, 'boolean'); assert.equal(typeof h.e.state().belledAt, 'number');
    assert.equal(h.e.ops().pending.notice, true);
    assert.equal(h.e.ackNotice('2026-10-22').changed, true);
    assert.deepEqual(h.e.ops().pending, {notice: false, promo: false, promoEnd: false});
  }
});
