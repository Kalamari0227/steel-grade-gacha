import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SLOTS, SECTION, COURSES, TIER, materialRoles, judge, carTrait} from '../src/race-rules.mjs';

// 확장 A(주행 시험장) 판정 규칙. 부품 35의 필요 소재 목록·묶음과 카드 계열만 읽는 순수 함수인지,
// 46개 선택(꽂지 않음 + 카드 45) × 3칸 × 8구간 전수가 정의와 같은지 본다.
const here = new URL('.', import.meta.url);
const data = JSON.parse(fs.readFileSync(new URL('../public/data.json', here), 'utf8'));
const source = fs.readFileSync(new URL('../src/race-rules.mjs', here), 'utf8');
const roles = materialRoles(data);
const IDS = ['', ...data.cards.map(c => c.id)];
const KEYS = Object.keys(SECTION);
const QP = data.cards.find(c => c.level === 5).id;
const freeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };

// 시험이 스스로 다시 계산한 단계(규칙 모듈의 계산을 쓰지 않는다).
function expected(secKey, slotKey, id) {
  const sec = SECTION[secKey], slot = SLOTS.find(s => s.key === slotKey), card = data.cards.find(c => c.id === id);
  if (!card) return 0;
  const needs = part => part.need.filter(n => n.any.includes(id));
  const best = data.parts.some(p => sec.parts.includes(p.key) && needs(p).some(n => !sec.need || n.n.includes(sec.need)));
  if (secKey === 'salt') return best ? 2 : card.familyKind.includes('도금') ? 1 : 0;
  if (id === QP) return secKey === 'crash' || secKey === 'side' ? 2 : slot.group === '프레임' ? 1 : 0;
  if (best) return 2;
  return data.parts.some(p => p.grp === slot.group && needs(p).length) ? 1 : 0;
}

test('data has the 45 cards, 35 parts, 8 cars and three part groups the rules read', () => {
  assert.deepEqual([data.cards.length, data.parts.length, data.cars.length], [45, 35, 8]);
  assert.deepEqual([...new Set(data.parts.map(p => p.grp))].sort(), SLOTS.map(s => s.group).sort());
  for (const sec of Object.values(SECTION)) for (const key of sec.parts) assert.ok(data.parts.some(p => p.key === key), sec.key + ' reads a missing part ' + key);
  assert.ok(data.parts.filter(p => ['hood', 'dooro'].includes(p.key)).every(p => p.need.some(n => n.n.includes('소부경화'))));
});

test('slots, eight sections, three tiers and four courses are well formed', () => {
  assert.deepEqual(SLOTS.map(s => s.key), ['body', 'frame', 'chassis']);
  assert.deepEqual(KEYS, ['hail', 'salt', 'crash', 'side', 'twist', 'bumps', 'climb', 'speed']);
  assert.deepEqual(TIER, ['보통', '통함', '최적']);
  for (const sec of Object.values(SECTION)) {
    assert.ok(SLOTS.some(s => s.key === sec.slot) && sec.name && sec.test && sec.focus && sec.text.length === 3 && sec.parts.length > 0, sec.key);
    assert.equal(sec.also !== undefined, sec.key === 'salt');
  }
  assert.deepEqual(COURSES.map(c => c.key), ['base', 'winter', 'safety', 'oval']);
  for (const co of COURSES) { assert.equal(co.secs.length, 4); assert.equal(new Set(co.secs).size, 4); assert.ok(co.secs.every(k => SECTION[k]) && co.name && co.note); }
  assert.deepEqual(COURSES[0].secs, ['hail', 'salt', 'crash', 'bumps']);
});

test('best materials per section are exactly the need lists of the parts that section reads', () => {
  const best = Object.fromEntries(KEYS.map(k => [k, data.cards.filter(c => roles.get(c.id).best[k]).map(c => c.id).sort()]));
  assert.deepEqual(best, {
    hail: ['ga-340H', 'ssial-340H'],
    salt: ['ga-270C', 'ga-270D', 'ga-270E', 'ga-270F', 'ga-340W', 'ga-440W'],
    crash: ['ga-1180Y', 'ga-1470H', 'poo-PHS', 'qp-1470', 'ssial-1180Y', 'ssial-1470M'],
    side: ['ga-1470H', 'ga-980Y', 'poo-PHS', 'qp-1470', 'ssial-1470M', 'ssial-980Y'],
    twist: ['ga-590Y', 'ga-780Y', 'poo-440W', 'poo-590Y', 'poo-780Y', 'ssial-590Y', 'ssial-780Y'],
    bumps: ['poo-PHS', 'wr-SPR'],
    climb: ['wr-CHQ', 'wr-NHT', 'wr-VLV'],
    speed: ['wr-CORD', 'wr-SUJ']
  });
});

test('every single-slot pick (46 × 3 slots × 8 sections) gets the tier the definition gives', () => {
  let n = 0;
  for (const slot of SLOTS) for (const id of IDS) {
    const picks = {body: '', frame: '', chassis: ''}; picks[slot.key] = id;
    const out = judge(data, roles, picks);
    for (const key of KEYS) {
      const sec = SECTION[key], reads = sec.slot === slot.key || sec.also === slot.key;
      assert.equal(out[key].tier, reads ? expected(key, slot.key, id) : 0, key + ' / ' + slot.key + ' / ' + (id || '(없음)'));
      assert.equal(out[key].slot.key, reads && out[key].tier ? slot.key : sec.slot);
      n++;
    }
  }
  assert.equal(n, 46 * 3 * 8);
});

test('salt takes the better of the body and chassis slots; other sections read one slot only', () => {
  const pick = (body, chassis) => judge(data, roles, {body, frame: '', chassis}).salt;
  assert.deepEqual([pick('ssial-340H', 'eg-SECC').tier, pick('ssial-340H', 'eg-SECC').slot.key], [1, 'chassis']);
  assert.deepEqual([pick('ga-270E', 'eg-SECC').tier, pick('ga-270E', 'eg-SECC').slot.key], [2, 'body']);
  assert.deepEqual([pick('ga-340H', 'ga-270E').tier, pick('ga-340H', 'ga-270E').slot.key], [2, 'chassis']);
  assert.equal(pick('ssial-340H', 'wr-SUJ').tier, 0);
  const v = judge(data, roles, {body: 'poo-PHS', frame: '', chassis: ''});
  assert.deepEqual([v.crash.tier, v.side.tier, v.bumps.tier], [0, 0, 0]);
});

test('QP is best on both crash sections and passes as a frame material elsewhere in the frame slot', () => {
  const v = judge(data, roles, {body: QP, frame: QP, chassis: QP});
  assert.deepEqual([v.crash.tier, v.side.tier, v.twist.tier], [2, 2, 1]);
  assert.deepEqual([v.hail.tier, v.salt.tier, v.bumps.tier, v.climb.tier, v.speed.tier], [0, 0, 0, 0, 0]);
});

test('reasons are complete Korean sentences that name the card and never leak undefined', () => {
  for (const id of IDS) {
    const out = judge(data, roles, {body: id, frame: id, chassis: id});
    const card = data.cards.find(c => c.id === id);
    for (const key of KEYS) {
      const r = out[key].reason;
      assert.ok(typeof r === 'string' && r.length > 8 && /[.요]$/.test(r) && !/undefined|null|NaN/.test(r), key + ' / ' + id + ': ' + r);
      if (card && out[key].tier) assert.ok(r.includes(card.familyName + ' ' + card.grade), key + ' / ' + id + ': ' + r);
    }
  }
  const none = judge(data, roles, {body: '', frame: '', chassis: ''});
  assert.ok(KEYS.every(k => none[k].tier === 0 && none[k].card === null));
  assert.ok(none.hail.reason.includes('표준 강판'));
});

test('highest material score per course over all 46³ picks: three courses cannot be all-best', () => {
  const tier = {};
  for (const slot of SLOTS) for (const id of IDS) { const p = {body: '', frame: '', chassis: ''}; p[slot.key] = id; const o = judge(data, roles, p); tier[slot.key + id] = Object.fromEntries(KEYS.map(k => [k, o[k].tier])); }
  const top = {};
  for (const co of COURSES) {
    let best = -1, count = 0;
    for (const b of IDS) for (const f of IDS) for (const c of IDS) {
      let score = 0;
      for (const k of co.secs) score += Math.max(tier['body' + b][k], tier['frame' + f][k], tier['chassis' + c][k]);
      if (score > best) { best = score; count = 1; } else if (score === best) count++;
    }
    top[co.key] = [best, count];
  }
  assert.deepEqual(top, {base: [7, 84], winter: [7, 147], safety: [8, 16], oval: [7, 210]});
  const full = judge(data, roles, {body: 'ga-270C', frame: 'poo-PHS', chassis: 'poo-PHS'});
  assert.equal(COURSES[0].secs.reduce((a, k) => a + full[k].tier, 0), 7);
});

test('rules are pure: frozen data survives, the same picks give the same verdict, and the module touches no storage, screen or engine', () => {
  const frozen = freeze(JSON.parse(JSON.stringify(data))), r2 = materialRoles(frozen);
  const picks = {body: 'ga-340H', frame: 'ssial-590Y', chassis: 'eg-SECC'};
  const a = judge(frozen, r2, picks), b = judge(frozen, r2, picks);
  assert.deepEqual(KEYS.map(k => [a[k].tier, a[k].reason]), KEYS.map(k => [b[k].tier, b[k].reason]));
  assert.deepEqual(KEYS.map(k => a[k].tier), [2, 1, 1, 1, 2, 1, 1, 1]);
  assert.deepEqual(picks, {body: 'ga-340H', frame: 'ssial-590Y', chassis: 'eg-SECC'});
  assert.equal(/\bimport\b/.test(source), false);
  for (const word of ['localStorage', 'sessionStorage', 'document', 'window', 'innerHTML', 'Math.random', 'Date.now', 'fetch(']) assert.equal(source.includes(word), false, word);
});

test('car traits: all cars share one speed and differ only in width and shake', () => {
  const traits = data.cars.map(c => carTrait(c.body));
  assert.deepEqual(traits.map(t => t.width), [0.86, 0.74, 0.74, 0.86, 0.62, 0.86, 0.74, 0.62]);
  assert.deepEqual([...new Set(traits.map(t => Object.keys(t).sort().join()))], ['note,shake,width']);
  assert.ok(traits.every(t => t.shake > 0 && t.note));
});
