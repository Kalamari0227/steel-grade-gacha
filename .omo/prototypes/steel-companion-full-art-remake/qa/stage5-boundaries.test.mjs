// 5단계 날짜·시각 경계 판정: 고정 템플릿의 원문 함수(qa/original-ops.mjs, vm에서 그대로 실행)와 엔진을 같은 시각·같은 저장에서 대조한다.
// 원본은 안내가 열리는 순간 기록하고, 이 판은 확인·닫기 때 기록한다. 그래서 "무엇이 뜨는가"는 같은 시각에 비교하고,
// "기록 결과"는 원본(열림 = 기록)과 엔진(뜬 것을 사용자가 확인한 뒤)의 저장값을 비교한다.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {kstRange} from '../src/opsview.mjs';
import {createOriginal} from './original-ops.mjs';

const DAY = 86400000, HOUR = 3600000;
const fresh = createEngine({storage: {getItem: () => null, setItem() {}}}).state();
const OPS = ['noticeSeen', 'promoSeen', 'promoDone', 'bell', 'belledAt'];
const pick = s => Object.fromEntries(OPS.map(k => [k, s[k]]));
function engineAt(t, extra, permission = 'granted') {
  const map = new Map([[SAVE_KEY, JSON.stringify({...fresh, ...extra})]]);
  let now = t;
  const e = createEngine({storage: {getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v))}, now: () => now, notification: permission === 'none' ? undefined : {permission}});
  return {e, set: v => { now = v; }};
}
function originalAt(t, extra, permission = 'granted') {
  let now = t;
  const o = createOriginal({now: () => now, permission});
  o.api.S = JSON.parse(JSON.stringify({...fresh, ...extra}));
  return {o, a: o.api, set: v => { now = v; }};
}
// 원본 한 번의 점검(부팅·20초 갱신·화면 복귀가 모두 같은 순서): checkNotice → checkPromo. 무엇이 떴는지를 하나로 요약한다.
function originalStep(a) {
  a.clear(); a.checkNotice(); a.checkPromo();
  const log = a.log().map(x => x[0]);
  return log.includes('openNotice') ? 'notice' : log.includes('openPromo') ? 'promo' : log.includes('toast') ? 'end' : '';
}
// 이 판의 한 틱(app.mjs checkOps): 공지 → 행사 → 종료 안내 중 하나를 띄우고, 사용자가 확인했다고 보고 기록한다.
function engineStep(e) {
  const o = e.ops();
  if (o.pending.notice) { assert.equal(e.ackNotice(o.notice.key).changed, true); return 'notice'; }
  if (o.pending.promo) { assert.equal(e.ackPromo(o.promo.key).changed, true); return 'promo'; }
  if (o.pending.promoEnd) { assert.equal(e.ackPromoEnd(o.promo.key).changed, true); return 'end'; }
  return '';
}

const {PROMOS, NOTICES} = createOriginal({now: Date.now}).api;
// 경계 시각: 모든 행사·공지의 시작·끝 ±1ms(앞 행사의 끝 = 다음 행사의 시작인 이음매 포함), 예고 구간 가운데, 처음 행사 전, 마지막 행사 뒤(지금).
const TIMES = [...new Set([
  ...PROMOS.flatMap(p => [p.from - 1, p.from, p.from + 1, p.to - 1, p.to, p.to + 1]),
  ...NOTICES.flatMap(n => [n.from - 1, n.from, n.from + 1, n.until - 1, n.until, n.until + 1]),
  ...PROMOS.slice(1).map((p, i) => (PROMOS[i].to + p.from) / 2),
  Date.UTC(2026, 8, 1), Date.UTC(2026, 10, 18, 3), Date.UTC(2027, 0, 1)
])].sort((a, b) => a - b);
const KEYS = [...new Set([...PROMOS.map(p => p.key), ...NOTICES.map(n => n.key)])];
const STATES = [
  {noticeSeen: '', promoSeen: '', promoDone: ''},
  ...KEYS.flatMap(k => [{noticeSeen: k, promoSeen: '', promoDone: ''}, {noticeSeen: '', promoSeen: k, promoDone: ''}, {noticeSeen: k, promoSeen: k, promoDone: ''}, {noticeSeen: k, promoSeen: k, promoDone: k}]),
  {noticeSeen: 5, promoSeen: {x: 1}, promoDone: true}                 // 원본 정규화가 그대로 두는 이상한 값
];

test('auto guidance: at every boundary instant and every seen-state, the same thing shows and the same record results as the original', () => {
  let cases = 0;
  for (const t of TIMES) for (const st of STATES) {
    const O = originalAt(t, st), E = engineAt(t, st);
    // 두 번 점검한다: 첫 안내를 확인한 뒤 같은 시각에 이어서 뜨는 것까지(예: 공지는 봤고 행사 안내가 남은 경우).
    for (let round = 0; round < 3; round++) {
      const shown = originalStep(O.a), mine = engineStep(E.e);
      assert.equal(mine, shown, `t=${new Date(t).toISOString()} state=${JSON.stringify(st)} round ${round}`);
      assert.deepEqual(pick(E.e.state()), pick(O.a.S), `record t=${new Date(t).toISOString()} state=${JSON.stringify(st)}`);
    }
    cases++;
  }
  assert.equal(cases, TIMES.length * STATES.length); assert.ok(cases >= 700, 'cases: ' + cases);  // 33 시각 × 22 상태 = 726건, 각 3회 점검
});

test('promo phase and limits at every boundary match the original (on / soon / ended, pull·quiz·order max)', () => {
  for (const t of TIMES) {
    const O = originalAt(t, {}), E = engineAt(t, {}), o = E.e.ops();
    const on = O.a.promoOn(), soon = O.a.promoSoon();
    assert.equal(o.promo.status, on ? 'on' : soon ? 'soon' : 'ended', new Date(t).toISOString());
    assert.equal(o.promo.key, O.a.curPromo().key);
    assert.equal(o.notice.key, O.a.curNotice().key);
    assert.equal(o.notice.state === 'on', O.a.noticeOn());
    assert.equal(E.e.quiz().max, O.a.quizMax());
    assert.equal(E.e.status().baseLeft, O.a.pullMax());
    assert.equal(E.e.order().max, O.a.orderMax());
  }
  // 이음매: 포오 행사가 끝나는 그 ms에 타래 행사가 시작한다. 1ms 전은 포오, 그 시각은 타래.
  const seam = PROMOS[0].to;
  assert.equal(engineAt(seam - 1, {}).e.ops().promo.key, '2026-09-27');
  assert.equal(engineAt(seam, {}).e.ops().promo.key, '2026-10-01');
  assert.equal(engineAt(seam - 1, {}).e.ops().promo.next.key, '2026-10-01');
  // 지금(모든 행사 이후): curPromo는 마지막 행사를 "끝난 행사"로 돌려준다.
  const now = engineAt(Date.UTC(2026, 10, 18, 3), {}).e.ops();
  assert.deepEqual([now.promo.key, now.promo.status, now.notice.key, now.notice.state], ['2026-10-22', 'ended', '2026-10-22', 'ended']);
});

// 출하 알림: 원본은 부팅 때 wasReady = pullRenewed() 후, 20초 갱신·화면 복귀·armBell 타이머마다 watchReady()를 부른다.
// 이 판은 1초 틱마다 readyEdge()를 부르고, 참이면 fireBell()과 토스트. 같은 시각 열에서 "토스트·시스템 알림·belledAt"이 같아야 한다.
function bellTrace(save, times, permission = 'granted') {
  const O = originalAt(times[0], save, permission), E = engineAt(times[0], save, permission);
  O.a.boot();
  const out = [];
  for (const t of times) {
    O.set(t); E.set(t);
    O.a.clear(); const before = O.o.notes.length; O.a.watchReady();
    const oToast = O.a.log().some(x => x[0] === 'toast'), oNote = O.o.notes.length - before;
    const edge = E.e.readyEdge(), fired = edge ? E.e.fireBell().fired : false;
    out.push([t, oToast, oNote]);
    assert.equal(edge, oToast, `toast at ${t - (save.pullAt || 0) - DAY} ms from renewal`);
    assert.equal(fired ? 1 : 0, oNote, `notification at ${t - (save.pullAt || 0) - DAY} ms from renewal`);
    assert.equal(E.e.state().belledAt, O.a.S.belledAt);
  }
  return out;
}
const P = Date.UTC(2026, 10, 17, 3);
const R = P + DAY;
const SHIPPED = {bell: true, belledAt: -1, pullAt: P, pullUsed: 1};

test('bell: page open across the renewal (±1ms) — one toast and one notification, at the renewal instant', () => {
  const out = bellTrace(SHIPPED, [R - 60000, R - 1, R, R + 1, R + 20000, R + HOUR]);
  assert.deepEqual(out.map(x => x[1]), [false, false, true, false, false, false]);
  assert.deepEqual(out.map(x => x[2]), [0, 0, 1, 0, 0, 0]);
});

test('bell: opened after the renewal — no toast, no notification (original boots with wasReady = renewed)', () => {
  const out = bellTrace(SHIPPED, [R + 5 * HOUR, R + 6 * HOUR, R + 2 * DAY]);
  assert.ok(out.every(x => !x[1] && x[2] === 0));
});

test('bell: never shipped (pullAt 0), bell off, permission denied, and unsupported — never a notification', () => {
  bellTrace({...SHIPPED, pullAt: 0, pullUsed: 0}, [R - 1, R, R + 1]);
  for (const [save, perm] of [[{...SHIPPED, bell: false}, 'granted'], [SHIPPED, 'denied'], [SHIPPED, 'none']]) {
    const out = bellTrace(save, [R - 1, R, R + 1], perm);
    assert.deepEqual(out.map(x => x[2]), [0, 0, 0]);
    assert.deepEqual(out.map(x => x[1]), [false, true, false], 'the in-page toast still shows once');
  }
});

test('bell: one per cycle — a cycle already announced (belledAt = pullAt) toasts again but never notifies again', () => {
  const out = bellTrace({...SHIPPED, belledAt: P}, [R - 1, R, R + 1]);
  assert.deepEqual(out.map(x => x[2]), [0, 0, 0]);
  assert.deepEqual(out.map(x => x[1]), [false, true, false]);
});

test('bell: a device clock going backwards and forwards — same toasts and notifications as the original, at most one notification per pullAt', () => {
  const out = bellTrace(SHIPPED, [R + 1, R - 10 * HOUR, R + 2, R - HOUR, R + 3, R + 4]);
  assert.deepEqual(out.map(x => x[1]), [false, false, true, false, true, false]);
  assert.deepEqual(out.map(x => x[2]), [0, 0, 1, 0, 0, 0]);
  // pullAt이 미래(기기 시계가 저장 때보다 뒤에 있음): 창이 닫혀 있다가 pullAt+24시간에 한 번.
  const future = {...SHIPPED, pullAt: R};
  const f = bellTrace(future, [R - HOUR, R, R + DAY - 1, R + DAY]);
  assert.deepEqual(f.map(x => x[2]), [0, 0, 0, 1]);
});

test('timezone: the original period text follows the device timezone; this edition always writes Korean time', () => {
  const p = PROMOS.at(-1), probe = `import {createOriginal} from ${JSON.stringify(new URL('./original-ops.mjs', import.meta.url).href)};` +
    `const {api}=createOriginal({now:()=>${p.from + HOUR}}); process.stdout.write(api.promoWhen());`;
  const run = tz => execFileSync(process.execPath, ['--input-type=module', '-e', probe], {env: {...process.env, TZ: tz}, encoding: 'utf8'});
  const mine = kstRange(p.from, p.to);
  assert.equal(run('Asia/Seoul') + ' (한국 시간)', mine);
  assert.equal(run('UTC'), '10월 21일 15:00 ~ 10월 25일 15:00');
  assert.equal(run('America/Los_Angeles'), '10월 21일 08:00 ~ 10월 25일 08:00');
  assert.equal(mine, '10월 22일 00:00 ~ 10월 26일 00:00 (한국 시간)');
});

test('odd stored values: the original neither crashes nor loops on them, and settles to the same record as the engine', () => {
  const odd = [{bell: 'yes', belledAt: 'x', noticeSeen: 5, promoSeen: {a: 1}, promoDone: true}, {bell: 1, belledAt: -5.5, noticeSeen: null, promoSeen: false, promoDone: 0}, {belledAt: 1e300}];
  for (const raw of odd) for (const t of [PROMOS.at(-1).from + HOUR, Date.UTC(2026, 10, 18, 3)]) {
    // 원본 applySaved가 고친 값(엔진이 불러온 값)에서 원본을 돌린다. 두 번째 점검부터는 아무것도 뜨지 않는다.
    const E = engineAt(t, raw), O = originalAt(t, E.e.state());
    assert.equal(E.e.status().blocked, false);
    for (let round = 0; round < 3; round++) assert.equal(engineStep(E.e), originalStep(O.a));
    assert.deepEqual(pick(E.e.state()), pick(O.a.S));
    assert.equal(engineStep(E.e), ''); assert.equal(originalStep(O.a), '');
  }
});
