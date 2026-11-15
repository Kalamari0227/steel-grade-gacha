// 본 개발 4단계(철강 퀴즈) 엔진 명령 검사: 추첨·채점·보상 한 번·저장 보호·시간 창·옛 저장.
// 규칙 자체(원본 대조)는 quiz-economy.test·quiz-window.test가 맡는다. 여기서는 엔진이 그 규칙을 어떤 보호 안에서 부르는지 본다.
// 정답 번호는 답하기 전에는 화면에 나가지 않으므로, 같은 난수 열로 원본 drawQuiz를 따로 돌려 정답을 안다(엔진은 drawQuiz만 난수를 쓴다).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, SAVE_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';
import {QUIZ} from '../src/quiz.mjs';
import {commandSafely} from '../src/shipments.mjs';

const DAY = 86400000, NOW = Date.UTC(2026, 10, 15, 3), PROMO = Date.UTC(2026, 9, 22, 3);
function memory(raw) {
  const map = new Map(raw ? [[SAVE_KEY, raw]] : []), m = {writes: 0, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => { m.writes++; map.set(k, String(v)); }, removeItem: k => map.delete(k)};
  return m;
}
const lcg = seed => { let n = seed >>> 0; return () => ((n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296); };
function make({raw, storage = memory(raw), at = NOW, seed = 7} = {}) {
  let t = at; const e = createEngine({storage, now: () => t, random: lcg(seed)});
  const oracle = createLegacy({random: lcg(seed), now: () => t}); oracle.setQuiz(QUIZ);
  assert.equal(e.setQuizBank(QUIZ).ok, true);
  return {e, storage, oracle, clock: v => { t = v; }};
}
const saveWith = (extra = {}) => JSON.stringify({...createEngine({storage: memory()}).state(), ...extra});
// 한 판: wrong개를 틀리고 푼다(앞에서부터). 결과 세션을 돌려준다.
function play(h, wrong = 0) {
  const started = h.e.quizStart(); assert.equal(started.ok, true, started.error);
  const truth = h.oracle.drawQuiz(5); let s = started.session;
  for (let i = 0; i < s.total; i++) {
    assert.equal(s.question.q, truth[i].q); assert.deepEqual(s.question.o, truth[i].o);
    const choice = i < wrong ? (truth[i].a + 1) % 4 : truth[i].a;
    const answered = h.e.quizAnswer(s.id, i, choice); assert.equal(answered.ok, true);
    assert.equal(answered.session.correct, i >= wrong); assert.equal(answered.session.correctIndex, truth[i].a);
    const next = h.e.quizNext(s.id, i); assert.equal(next.ok, true, next.error); s = next.session;
  }
  return s;
}

test('summary before the window opens: cap shown as left, nothing written by reading', () => {
  const h = make(), q = h.e.quiz();
  assert.deepEqual({max: q.max, left: q.left, extra: q.extra, windowOpen: q.windowOpen, renewText: q.renewText, canStart: q.canStart, active: q.active, promo: q.promo}, {max: 3, left: 3, extra: 0, windowOpen: false, renewText: '', canStart: true, active: false, promo: false});
  assert.equal(h.storage.writes, 0);
});

test('starting draws 5 distinct questions from the original, hides answer and explanation, writes nothing, and is resumable', () => {
  const h = make(), truth = h.oracle.drawQuiz(5), r = h.e.quizStart(), s = r.session;
  assert.equal(r.ok, true); assert.equal(s.phase, 'question'); assert.equal(s.total, 5); assert.equal(s.index, 0);
  assert.equal(s.question.q, truth[0].q); assert.deepEqual(s.question.o, truth[0].o);
  assert.ok(!('correctIndex' in s) && !('explanation' in s) && !('chosen' in s), 'answer is not sent before answering');
  assert.equal(h.storage.writes, 0);
  const again = h.e.quizStart(); assert.equal(again.resumed, true); assert.equal(again.session.id, s.id); assert.deepEqual(again.session.question, s.question);
  assert.equal(new Set(truth.map(q => q.q)).size, 5);
});

test('grading is the engine: only the first answer counts, stale index/session/choice are refused', () => {
  const h = make(), truth = h.oracle.drawQuiz(5), s = h.e.quizStart().session;
  const wrong = (truth[0].a + 1) % 4;
  const first = h.e.quizAnswer(s.id, 0, wrong).session;
  assert.equal(first.correct, false); assert.equal(first.right, 0); assert.equal(first.chosen, wrong); assert.equal(first.correctIndex, truth[0].a);
  const again = h.e.quizAnswer(s.id, 0, truth[0].a).session;
  assert.equal(again.chosen, wrong, 'second answer ignored'); assert.equal(again.right, 0); assert.equal(again.correct, false);
  assert.equal(h.e.quizAnswer(s.id, 1, 0).stale, true, 'not the current question');
  assert.equal(h.e.quizAnswer('other', 0, 0).stale, true);
  assert.equal(h.e.quizNext(s.id, 1).stale, true);
  assert.equal(h.e.quizNext(s.id, 0).session.index, 1);
  assert.equal(h.e.quizNext(s.id, 0).stale, true, 'double next moves once');
  for (const bad of [-1, 4, 1.5, '1', null]) assert.equal(h.e.quizAnswer(s.id, 1, bad).ok, false);
  assert.equal(h.e.quizNext(s.id, 1).stale, true, 'cannot skip an unanswered question');
});

test('5/5 gives +1 extra exactly once with one write; double next and double settle do not repeat it; nothing else changes', () => {
  const h = make({raw: saveWith({scrap: 4, owned: {}, orderDay: '2026-11-14', orderKey: '', orderDone: 1})}), before = h.e.state();
  const result = play(h);
  assert.equal(result.phase, 'result'); assert.equal(result.outcome, 'reward'); assert.equal(result.reward, 1); assert.equal(result.right, 5);
  assert.equal(h.storage.writes, 1);
  const after = h.e.state();
  assert.equal(after.extra, 1); assert.equal(after.quizAt, NOW); assert.equal(after.quizUsed, 1);
  assert.deepEqual({...after, extra: 0, quizAt: 0, quizUsed: 0}, {...before, extra: 0, quizAt: 0, quizUsed: 0}, 'items/stock/scrap/order record/parts/cars/results untouched');
  assert.equal(h.e.quizNext(result.id, 5).stale, true); assert.equal(h.e.quizNext(result.id, 4).stale, true);
  assert.equal(h.storage.writes, 1); assert.equal(h.e.state().extra, 1);
  assert.equal(JSON.parse(h.storage.getItem(SAVE_KEY)).extra, 1);
  const q = h.e.quiz(); assert.equal(q.left, 2); assert.equal(q.windowOpen, true); assert.ok(q.renewText.length > 0); assert.equal(q.renewAt, NOW + DAY);
});

test('4/5 or fewer changes nothing and writes nothing', () => {
  for (const wrong of [1, 3, 5]) {
    const h = make(), before = JSON.stringify(h.e.state()), result = play(h, wrong);
    assert.equal(result.outcome, 'fail'); assert.equal(result.reward, 0); assert.equal(result.pass, false); assert.equal(result.right, 5 - wrong);
    assert.equal(h.storage.writes, 0); assert.equal(JSON.stringify(h.e.state()), before);
  }
});

test('the quiz extra can be shipped: singleLeft grows by 1 and one ship uses it', () => {
  const h = make(); h.e.state(); const before = h.e.status();
  play(h); const after = h.e.status();
  assert.equal(after.extra, before.extra + 1); assert.equal(after.singleLeft, before.singleLeft + 1);
  const shipped = h.e.ship(1); assert.equal(shipped.ok, true);
});

test('three rewards fill the window; the fourth start is refused with the renew time; after 24h it opens again', () => {
  const h = make();
  for (let i = 0; i < 3; i++) { const r = play(h); assert.equal(r.outcome, 'reward'); }
  assert.equal(h.e.state().extra, 3); assert.equal(h.e.state().quizUsed, 3);
  const q = h.e.quiz(); assert.equal(q.left, 0); assert.equal(q.canStart, false); assert.ok(q.renewText);
  const refused = h.e.quizStart(); assert.equal(refused.ok, false); assert.equal(refused.exhausted, true);
  h.clock(NOW + DAY - 1); assert.equal(h.e.quiz().left, 0);
  h.clock(NOW + DAY); assert.equal(h.e.quiz().left, 3); assert.equal(h.e.quizStart().ok, true);
});

test('extra at the cap: the reward only spends quizUsed, extra stays, outcome is cap, one write', () => {
  const h = make({raw: saveWith({extra: 3})}), result = play(h);
  assert.equal(result.outcome, 'cap'); assert.equal(result.reward, 0); assert.equal(result.rewardAllowed, true);
  assert.equal(h.e.state().extra, 3); assert.equal(h.e.state().quizUsed, 1); assert.equal(h.storage.writes, 1);
});

test('the window closes for rewards while the quiz is being played (promo ends): outcome exhausted, no grant, no write', () => {
  const end = Date.UTC(2026, 9, 25, 15), h = make({at: end - 1, raw: saveWith({quizAt: end - 1000, quizUsed: 3})});
  assert.equal(h.e.quiz().left, 2);
  const truth = h.oracle.drawQuiz(5), s = h.e.quizStart().session;
  h.clock(end);
  assert.equal(h.e.quiz().left, 0);
  let view = s;
  for (let i = 0; i < 5; i++) { h.e.quizAnswer(s.id, i, truth[i].a); view = h.e.quizNext(s.id, i).session; }
  assert.equal(view.outcome, 'exhausted'); assert.equal(view.pass, true); assert.equal(view.reward, 0); assert.equal(view.rewardAllowed, false);
  assert.equal(h.e.state().extra, 0); assert.equal(h.storage.writes, 0);
});

test('promo window: inside 품질 교육 주간 the cap is 5 (summary and fifth reward)', () => {
  const h = make({at: PROMO}); assert.equal(h.e.quiz().max, 5); assert.equal(h.e.quiz().promo, true); assert.equal(h.e.quiz().left, 5);
  for (let i = 0; i < 5; i++) assert.equal(play(h).outcome, 'reward');
  assert.equal(h.e.state().extra, 5); assert.equal(h.e.quizStart().ok, false);
});

test('closing keeps the save unchanged and unwritten; a closed session cannot be answered or settled', () => {
  const h = make(), s = h.e.quizStart().session; h.e.quizAnswer(s.id, 0, 0);
  const before = JSON.stringify(h.e.state());
  assert.equal(h.e.quizClose(s.id).ok, true); assert.equal(h.e.quizClose(s.id).ok, true);
  assert.equal(h.e.quizAnswer(s.id, 0, 0).stale, true); assert.equal(h.e.quizNext(s.id, 0).stale, true);
  assert.equal(JSON.stringify(h.e.state()), before); assert.equal(h.storage.writes, 0); assert.equal(h.e.quiz().active, false);
  assert.notEqual(h.e.quizStart().session.id, s.id, 'a new quiz is a new session');
});

test('protections: another tab changed the save, a corrupt save, a rejected write, and the shared lock', async () => {
  // 다른 탭이 저장을 바꿨다: 결과 처리(보상)를 거절하고 아무것도 쓰지 않는다. 시작도 거절한다.
  const storage = memory(), a = make({storage}), truth = a.oracle.drawQuiz(5), s = a.e.quizStart().session;
  for (let i = 0; i < 4; i++) { a.e.quizAnswer(s.id, i, truth[i].a); a.e.quizNext(s.id, i); }
  a.e.quizAnswer(s.id, 4, truth[4].a);
  storage.setItem(SAVE_KEY, saveWith({scrap: 9})); const writes = storage.writes;
  const stopped = a.e.quizNext(s.id, 4); assert.equal(stopped.ok, false); assert.match(stopped.error, /다른 탭/);
  assert.equal(storage.writes, writes); assert.equal(a.e.state().extra, 0, 'memory is not granted either'); assert.equal(a.e.quizStart().ok, false);
  // 손상된 저장: 보류하고 퀴즈를 시작하지 못한다.
  const corrupt = memory('{not json'), c = make({storage: corrupt});
  assert.equal(c.e.quizStart().ok, false); assert.equal(corrupt.getItem(SAVE_KEY), '{not json'); assert.equal(corrupt.writes, 0);
  // 쓰기가 받아들여지지 않음: 메모리 결과는 남고 경고가 뜬다.
  const dropped = memory(); dropped.setItem = () => {}; const d = make({storage: dropped}); const r = play(d);
  assert.equal(r.outcome, 'reward'); assert.match(d.e.status().warning, /받아 주지/);
  assert.match(r.saveWarning, /받아 주지/, 'the result carries the save warning so the modal can show it');
  assert.equal(play(make({storage: memory()})).saveWarning, '');
  // 두 탭이 같은 잠금 안에서 5/5를 끝낸다: 보상은 한 번만.
  const locks = () => { let pending = Promise.resolve(); return {request: (key, callback) => { assert.equal(key, SAVE_KEY); const result = pending.then(callback); pending = result.then(() => {}); return result; }}; };
  const shared = memory(), one = make({storage: shared, seed: 3}), two = make({storage: shared, seed: 9}), lock = locks();
  const prep = h => { const t = h.oracle.drawQuiz(5), ss = h.e.quizStart().session; for (let i = 0; i < 4; i++) { h.e.quizAnswer(ss.id, i, t[i].a); h.e.quizNext(ss.id, i); } h.e.quizAnswer(ss.id, 4, t[4].a); return ss.id; };
  const id1 = prep(one), id2 = prep(two);
  const done = await Promise.all([commandSafely(() => one.e.quizNext(id1, 4), {locks: lock}), commandSafely(() => two.e.quizNext(id2, 4), {locks: lock})]);
  assert.equal(done.filter(r => r.ok).length, 1); assert.equal(JSON.parse(shared.getItem(SAVE_KEY)).extra, 1); assert.equal(shared.writes, 1);
  assert.equal((await commandSafely(() => one.e.quizStart(), {locks: null})).ok, false, 'no lock support refuses');
});

test('related materials: owned ones named in the question are offered, from the original quizRelated', () => {
  const ids = createLegacy().allChars().map(c => c.id), owned = Object.fromEntries(ids.map(id => [id, true]));
  const h = make({raw: saveWith({owned, stock: {}})}), truth = h.oracle.drawQuiz(5);
  h.oracle.setState(h.e.state());
  const s = h.e.quizStart().session; const view = h.e.quizAnswer(s.id, 0, truth[0].a).session;
  assert.deepEqual(view.related.map(c => c.id), h.oracle.quizRelated(truth[0]).map(c => c.id));
});

test('old saves keep extra, quizAt, quizUsed and quizDay; quiz bank must be valid', () => {
  const raw = saveWith({extra: 2, quizAt: NOW - 1000, quizUsed: 2, quizDay: '2026-11-14'}), h = make({raw});
  const q = h.e.quiz(); assert.equal(q.extra, 2); assert.equal(q.left, 1); assert.equal(q.windowOpen, true);
  const r = play(h); assert.equal(r.outcome, 'reward'); const s = h.e.state();
  assert.equal(s.extra, 3); assert.equal(s.quizUsed, 3); assert.equal(s.quizAt, NOW - 1000); assert.equal(s.quizDay, '2026-11-14');
  const bare = createEngine({storage: memory()}); assert.equal(bare.quizStart().ok, false, 'no bank');
  assert.equal(bare.setQuizBank([]).ok, false); assert.equal(bare.setQuizBank(QUIZ.slice(0, 5).map(q => ({...q, a: 4}))).ok, false);
  assert.equal(bare.setQuizBank(QUIZ.slice(0, 5).map(q => ({...q, o: q.o.slice(1)}))).ok, false);
});

test('data: 413 questions x 4 options, answer index 0-3, no empty text, only <b></b> tags, no entities, richText renders without innerHTML', async () => {
  assert.equal(QUIZ.length, 413);
  const tags = new Set();
  for (const [i, q] of QUIZ.entries()) {
    assert.equal(q.o.length, 4, 'question ' + i); assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a <= 3, 'answer ' + i);
    for (const t of [q.q, q.e, ...q.o]) { assert.ok(typeof t === 'string' && t.trim() !== '', 'empty text in ' + i); for (const m of t.matchAll(/<[^>]*>/g)) tags.add(m[0]); assert.ok(!/&[#\w]+;/.test(t), 'entity in ' + i); }
    for (const t of [q.q, q.e, ...q.o]) assert.equal((t.match(/<b>/g) || []).length, (t.match(/<\/b>/g) || []).length, 'unbalanced <b> in ' + i);
    assert.equal(new Set(q.o).size, 4, 'duplicate options in ' + i);
    for (const t of [q.e, ...q.o]) assert.ok(!/<[^>]*>/.test(t), 'tag outside the question text in ' + i);
  }
  assert.deepEqual([...tags].sort(), ['</b>', '<b>']);
});

test('the rendered question text without tags equals the data (every question) and tags other than <b> stay as plain text', async () => {
  // 화면의 richText와 같은 분해 규칙을 DOM 없이 검사한다: <b> 안과 밖을 합치면 원문에서 <b>·</b>만 뺀 글이 된다.
  const pieces = text => text.split(/(<\/?b>)/).filter(p => p !== '' && p !== '<b>' && p !== '</b>').join('');
  for (const q of QUIZ) assert.equal(pieces(q.q), q.q.replace(/<\/?b>/g, ''));
  assert.equal(pieces('<i>x</i> <b>y</b>'), '<i>x</i> y', 'unknown tags are kept as text, never turned into elements');
});
