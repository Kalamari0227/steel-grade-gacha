// 7단계: 저장 완성(백업 코드·복원·IndexedDB 사본·진단·초기화) 시험.
// 원본은 규칙 템플릿(src/app_tpl.html)과 백업 모듈(src/game/backup.js)의 원문을 Node vm에서 그대로 실행해 같은 입력의 결과를 비교한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {section} from '../source.mjs';
import {createEngine, HELD_KEY} from '../src/engine.mjs';
import {createLegacy} from '../src/legacy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const template = fs.readFileSync(path.join(root, 'src/app_tpl.html'), 'utf8');
const backupFile = fs.readFileSync(path.join(root, 'src/game/backup.js'), 'utf8');
const SAVE = 'sgg_game_save_v1', TOON = 'sgg_game_toon_seen';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const DAY0 = new Date(2026, 10, 20, 10, 0, 0).getTime();

function store(initial = {}, {getFails = false, setFails = false} = {}) {
  const map = new Map(Object.entries(initial));
  return {map,
    getItem(k) { if (getFails) throw new Error('blocked'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (setFails) throw new Error('quota'); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }};
}
// 가짜 IndexedDB: open → onupgradeneeded/onsuccess, transaction → objectStore put/get/delete(요청 onsuccess), 거래 oncomplete. 모두 비동기.
function fakeIDB({silent = false, broken = false, deferGet = false, putFails = false} = {}) {
  const data = new Map(), later = f => setTimeout(f, 0), held = [];
  const db = {
    createObjectStore() {},
    transaction() {
      const tx = {};
      let pending = 0;
      const done = () => { if (--pending === 0) later(() => tx.oncomplete && tx.oncomplete()); };
      const req = fn => { pending++; const r = {}; later(() => { r.result = fn(); r.onsuccess && r.onsuccess(); done(); }); return r; };
      tx.objectStore = () => ({
        put: (v, k) => { if (putFails) throw new Error('quota'); return req(() => { data.set(k, v); }); },
        get: k => { if (!deferGet) return req(() => data.get(k)); const r = {}; held.push(() => { r.result = data.get(k); r.onsuccess && r.onsuccess(); }); return r; },
        delete: k => req(() => { data.delete(k); })});
      return tx;
    }
  };
  return {data, flush() { held.splice(0).forEach(f => f()); }, open() {
    const r = {};
    if (broken) throw new Error('blocked');
    if (!silent) later(() => { r.result = db; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); });
    return r;
  }};
}
const env = {navigator: {}, location: {protocol: 'https:', origin: 'https://example.test', pathname: '/'}, window: {matchMedia: () => ({matches: false})}};
const settle = () => new Promise(r => setTimeout(r, 5));
// 비동기 사본 쓰기를 기다린다. 시험을 병렬로 돌리면 5ms로는 모자라 가끔 실패했다(최종 검토 지적). 조건이 맞을 때까지 최대 2초 기다린다.
const until = async (ok, ms = 2000) => { const end = Date.now() + ms; while (!ok()) { if (Date.now() > end) return false; await new Promise(r => setTimeout(r, 5)); } return true; };
function engine({local = store(), idb = fakeIDB(), now = () => DAY0, timers} = {}) {
  return {local, idb, e: createEngine({storage: local, idb, env, now, random: () => 0.42, setTimer: timers || setTimeout})};
}
// 진행이 있는 저장: 실제 출하로 만든다(경제값은 원본 규칙 그대로).
function withProgress(extra = {}) {
  const {e, local} = engine();
  assert.equal(e.ship(1).ok, true);
  const s = JSON.parse(local.getItem(SAVE));
  return JSON.stringify({...s, ...extra});
}

// 원본 원문: 백업 모듈 전체와 템플릿의 백업 코드 구간, 초기화 새 상태.
const originalScript = new vm.Script([
  backupFile,
  'var S;',
  section(template, 'var CPFX = [', '/* ── 24시간 주기'),
  'function resetLiteral(){\n' + section(template, '  S = { owned:{}, stock:{}, last:"", extra:0', '  loadFailed = false; save();') + '  return S;\n}',
  ';this.__api={makePack:makePack, makeCode:makeCode, readCode:readCode, applyCode:applyCode, GAME_BACKUP:GAME_BACKUP, resetLiteral:resetLiteral, set:function(v){S=v;}, get:function(){return S;}};'
].join('\n'), {filename: 'app_tpl.html (backup sections)'});
const rules = createLegacy();
function original(state) {
  const context = {btoa, atob, TextEncoder, escape, unescape, encodeURIComponent, decodeURIComponent, Set, Date, Number, Object, JSON,
    findChar: rules.findChar, findItem: rules.findItem, findOrder: rules.findOrder, findPart: rules.findPart, findCar: rules.findCar, loadFailed: false, save() {}};
  vm.createContext(context); originalScript.runInContext(context);
  context.__api.set(JSON.parse(JSON.stringify(state)));
  return context.__api;
}

test('고정 출처: 백업 모듈 SHA와 생성 모듈이 원문 구간을 그대로 담는다', () => {
  assert.equal(sha(backupFile), 'bba6de0b05fd08d3f6feeb63b1ed2e9504ddb68d8c226f44087c87354d6168c0');
  const legacy = fs.readFileSync(path.join(here, '../src/legacy.mjs'), 'utf8');
  for (const [from, to] of [['var CPFX = [', '/* ── 24시간 주기'], ['/* IndexedDB 사본. 실패해도', '/* localStorage가 비어 있을 때'],
    ['/* IndexedDB에 실제로 써 보고 되읽어 봅니다 */', '/* ── 기간 한정 프로모션 화면'], ['function backupRestoreStatus(){', 'function openBackup(event){'],
    ['  S = { owned:{}, stock:{}, last:"", extra:0', '  loadFailed = false; save();'], ['var needRestore = !loadFailed && !hasProgress();', '\n']])
    assert.ok(legacy.includes(section(template, from, to)), from);
  assert.ok(legacy.includes(section(backupFile, 'var GAME_BACKUP = (function(){', '\n})();')));
  const report = JSON.parse(fs.readFileSync(path.join(here, '../adapter-report.json'), 'utf8'));
  assert.equal(report.backupSHA, sha(backupFile));
});

test('백업 코드는 원본 makeCode와 같은 글자이고 SGG-GAME1.로 시작한다', () => {
  const raw = withProgress({backupAt: 5, bell: true});
  const {e} = engine({local: store({[SAVE]: raw})});
  const code = e.backupView().code;
  assert.match(code, /^SGG-GAME1\.[A-Za-z0-9_-]+$/);
  const state = e.state(); delete state.results;
  assert.equal(code, original(state).makeCode());
  assert.equal(e.backupView().summary, '캐릭터 1장 · 아이템 0종 · 스크랩 0장이 담겨 있습니다.');
});

test('미리보기는 진행·저장을 바꾸지 않고, 교체는 원본 applyCode 결과와 같다(results·featured는 비움, 알림·행사 기록은 유지)', () => {
  const fromRaw = withProgress();
  const code = engine({local: store({[SAVE]: fromRaw})}).e.backupView().code;
  const target = JSON.stringify({...JSON.parse(withProgress()), bell: true, promoSeen: 'P1', noticeSeen: 'N1', featured: JSON.parse(fromRaw).featured});
  const local = store({[SAVE]: target, [TOON]: 'ep03'});
  const {e} = engine({local});
  const r = e.previewRestore(code);
  assert.equal(r.ok, true);
  assert.equal(local.getItem(SAVE), target, '미리보기만으로 저장은 그대로');
  assert.match(r.preview.current, /^발견 \d+종 · 재고/); assert.match(r.preview.recovery, /^SGG-GAME1\./);
  const done = e.applyRestore(r.preview, code);
  assert.equal(done.ok, true); assert.equal(done.saved, true); assert.equal(done.recovery, r.preview.recovery);
  const after = JSON.parse(local.getItem(SAVE)), source = JSON.parse(fromRaw);
  for (const k of ['owned', 'stock', 'scrap', 'extra', 'pullAt', 'pullUsed', 'quizAt', 'quizUsed', 'cars', 'orderDay', 'orderKey', 'orderDone']) assert.deepEqual(after[k], source[k], k);
  assert.equal(after.results, null); assert.equal('featured' in after, false);
  assert.equal(after.bell, true); assert.equal(after.promoSeen, 'P1'); assert.equal(after.noticeSeen, 'N1');
  assert.equal(local.getItem(TOON), 'ep03', '웹툰 읽음은 백업과 별개');
  assert.equal(e.backupView().recovery, r.preview.recovery, '교체 뒤 이전 진행 복구 코드가 남는다');
});

test('미리보기 뒤 진행·입력·날짜가 바뀌면 교체를 거절하고 아무것도 쓰지 않는다', () => {
  const code = engine({local: store({[SAVE]: withProgress()})}).e.backupView().code;
  let clock = DAY0;
  const local = store();
  const {e} = engine({local, now: () => clock});
  const STALE = '미리보기 후 현재 진행이 바뀌었습니다. 다시 미리보기 해 주세요.';
  let p = e.previewRestore(code).preview;
  assert.deepEqual(e.applyRestore(p, code + 'x'), {ok: false, error: STALE, stale: true});
  assert.equal(e.ship(1).ok, true);
  const raw = local.getItem(SAVE);
  assert.equal(e.applyRestore(p, code).error, STALE, '진행이 바뀜');
  p = e.previewRestore(code).preview;
  clock = new Date(2026, 10, 21, 0, 0, 1).getTime();
  assert.equal(e.applyRestore(p, code).error, STALE, '날짜가 바뀜');
  assert.equal(e.applyRestore(null, code).error, STALE);
  assert.equal(local.getItem(SAVE), raw);
});

test('잘못된 코드: 교육용 코드는 새 문구, 그 밖은 원본 문구이며 진행은 바뀌지 않는다', () => {
  const local = store({[SAVE]: withProgress()}), raw = local.getItem(SAVE);
  const {e} = engine({local});
  assert.equal(e.previewRestore('SGG1.eyJ2IjoxfQ').error, '게임용 백업은 SGG-GAME1.으로 시작합니다. 교육용 SGG1. 코드는 이 게임에서 불러올 수 없습니다.');
  assert.equal(e.previewRestore('SGG-GAME1.@@@').error, '백업 코드를 읽지 못했습니다. 코드 전체를 빠짐없이 붙여 넣어 주세요.');
  assert.equal(e.previewRestore('x'.repeat(300 * 1024)).error, '백업 코드가 너무 깁니다. 다른 내용이 섞이지 않았는지 확인해 주세요.');
  const bad = 'SGG-GAME1.' + Buffer.from(JSON.stringify({version: 1, edition: 'game', progress: {v: 1, o: ['P없는소재']}})).toString('base64url');
  assert.match(e.previewRestore(bad).error, /^발견한 소재 목록 항목이 올바르지 않습니다\. 불러오지 않았으며 현재 진행은 바뀌지 않았습니다/);
  assert.equal(local.getItem(SAVE), raw);
  // 원본 문구 원문에서 바꾼 한 문장이 실제로 원본에 있는지(바꿀 대상이 사라지면 시험이 알린다).
  assert.ok(template.includes('"게임용 백업은 SGG-GAME1.으로 시작합니다. 교육용 SGG1. 코드는 교육용 백업 가져오기를 선택하세요."'));
});

test('손상된 저장은 복원·초기화로만 다시 열리고, 다른 탭 변경으로 멈춘 경우는 거절한다', () => {
  const code = engine({local: store({[SAVE]: withProgress()})}).e.backupView().code;
  const broken = store({[SAVE]: '{broken'});
  const a = engine({local: broken}).e;
  assert.equal(a.status().blocked, true);
  assert.equal(a.markBackup().ok, false);
  const p = a.previewRestore(code).preview;
  assert.equal(a.applyRestore(p, code).ok, true);
  assert.equal(a.status().blocked, false); assert.equal(JSON.parse(broken.getItem(SAVE)).scrap, 0);
  const b = engine({local: store({[SAVE]: '{broken'})});
  assert.equal(b.e.resetProgress().ok, true); assert.equal(JSON.parse(b.local.getItem(SAVE)).results, null);
  const c = engine({local: store()});
  assert.equal(c.e.ship(1).ok, true);
  c.local.setItem(SAVE, withProgress({scrap: 9}));
  assert.equal(c.e.ship(1).ok, false);
  const p2 = c.e.previewRestore(code).preview;
  assert.match(c.e.applyRestore(p2, code).error, /다른 탭에서 진행이 바뀌었습니다/);
  assert.match(c.e.resetProgress().error, /다른 탭에서 진행이 바뀌었습니다/);
  assert.equal(JSON.parse(c.local.getItem(SAVE)).scrap, 9);
});

test('초기화: 원본 새 상태와 같고(알림·행사 확인 기록 유지), 웹툰 읽음은 남는다', () => {
  const raw = withProgress({bell: true, belledAt: 7, promoSeen: 'P', promoDone: 'D', noticeSeen: 'N', backupAt: 3, qpSeen: 2});
  const local = store({[SAVE]: raw, [TOON]: 'ep05'});
  const {e} = engine({local});
  const r = e.resetProgress();
  assert.equal(r.ok, true); assert.equal(r.saved, true);
  const after = JSON.parse(local.getItem(SAVE));
  const want = original(JSON.parse(raw)).resetLiteral();
  assert.deepEqual({...after, results: undefined}, {...JSON.parse(JSON.stringify(want)), results: undefined});
  assert.equal(after.results, null); assert.equal(after.bell, true); assert.equal(after.belledAt, -1); assert.equal(after.promoSeen, 'P'); assert.equal(after.noticeSeen, '');
  assert.equal(local.getItem(TOON), 'ep05');
  assert.equal(e.backupView().when, '', '진행이 없으면 백업 날짜 칸은 비어 있다');
});

test('백업 날짜: 복사 성공 때만 backupAt을 기록하고 원본 표기를 쓴다', () => {
  const local = store({[SAVE]: withProgress()});
  const {e} = engine({local, now: () => new Date(2026, 10, 20, 15).getTime()});
  assert.equal(e.backupView().when, '아직 백업한 적이 없습니다');
  const r = e.markBackup();
  assert.equal(r.ok, true); assert.equal(r.when, '마지막 백업 11월 20일');
  assert.equal(JSON.parse(local.getItem(SAVE)).backupAt, new Date(2026, 10, 20, 15).getTime());
});

test('IndexedDB 사본: 저장할 때마다 같은 값을 쓰고, 빈 local이면 사본에서 되살린다', async () => {
  const idb = fakeIDB();
  const first = engine({idb});
  assert.equal(first.e.ship(1).ok, true);
  await until(() => idb.data.get(SAVE) === first.local.getItem(SAVE));
  assert.equal(idb.data.get(SAVE), first.local.getItem(SAVE));
  const local = store();
  const second = createEngine({storage: local, idb, env, now: () => DAY0});
  const r = await second.boot();
  assert.deepEqual(r, {restored: true, warning: ''});
  assert.equal(local.getItem(SAVE), idb.data.get(SAVE));
  assert.deepEqual(second.state().owned, first.e.state().owned);
});

test('사본 복구 조건: 진행이 있으면 읽지 않고, 진행 없는 사본·손상 사본·형식이 틀린 사본은 쓰지 않는다', async () => {
  for (const copy of [JSON.stringify({owned: {}}), '{broken', JSON.stringify({owned: {'없는-소재': true}, stock: {}})]) {
    const idb = fakeIDB(); idb.data.set(SAVE, copy);
    const local = store();
    const e = createEngine({storage: local, idb, env, now: () => DAY0});
    assert.equal((await e.boot()).restored, false, copy);
    assert.equal(local.getItem(SAVE), null, '복구하지 않으면 빈 상태를 쓰지 않는다');
    assert.deepEqual(e.state().owned, {});
  }
  const idb = fakeIDB(); idb.data.set(SAVE, withProgress({scrap: 99}));
  const local = store({[SAVE]: withProgress()});
  const e = createEngine({storage: local, idb, env, now: () => DAY0});
  assert.equal((await e.boot()).restored, false);
  assert.equal(e.state().scrap, 0);
});

test('사본 확인 중에는 명령을 거절하고, 2500ms 뒤 늦은 사본은 버린다(원본 settled)', async () => {
  const idb = fakeIDB({silent: true});
  let fire;
  const local = store();
  const e = createEngine({storage: local, idb, env, now: () => DAY0, setTimer: (f, ms) => { assert.equal(ms, 2500); fire = f; }});
  const boot = e.boot();
  assert.equal(e.status().holding, true);
  assert.deepEqual(e.ship(1), {ok: false, error: '저장 사본을 확인 중입니다. 창을 닫지 말고 잠시 기다려 주세요.'});
  assert.equal(e.resetProgress().ok, false);
  assert.match(e.previewRestore('x').error, /저장 사본을 확인 중입니다/);
  assert.equal(local.getItem(SAVE), null);
  fire();
  assert.equal((await boot).restored, false);
  assert.equal(e.status().holding, false);
  assert.equal(e.ship(1).ok, true);
});

test('사본을 열 수 없어도 앱은 돌아가고, 진단은 원본 문구로 상태를 알린다', async () => {
  const local = store();
  const blocked = createEngine({storage: local, idb: fakeIDB({broken: true}), env, now: () => DAY0});
  assert.equal((await blocked.boot()).restored, false);
  assert.equal(blocked.ship(1).ok, true);
  const d = await blocked.diagnose();
  assert.equal(d.mode, '브라우저 탭'); assert.equal(d.ls, '정상'); assert.equal(d.idb, '막힘'); assert.equal(d.persist, '지원 안 함');
  assert.equal(local.getItem(SAVE + '_probe'), null, '진단 임시값은 지운다');
  const ok = await engine().e.diagnose();
  assert.equal(ok.idb, '정상');
});

// ── 7단계 통합 검토(2026-11-20) 반영 시험 ──
test('검토: 교체 결과는 원본 applyCode를 실제로 돌린 결과와 모든 항목이 같다(results·featured만 비움)', () => {
  const from = engine({local: store({[SAVE]: withProgress({scrap: 7, extra: 3})})}).e;
  const code = from.backupView().code;
  const target = JSON.parse(withProgress({bell: true, promoSeen: 'P', noticeSeen: 'N', backupAt: 9}));
  const local = store({[SAVE]: JSON.stringify(target)});
  const {e} = engine({local});
  const r = e.previewRestore(code);
  assert.equal(e.applyRestore(r.preview, code).ok, true);
  const o = original({...target});
  o.applyCode(o.readCode(code));
  const want = JSON.parse(JSON.stringify(o.get())); delete want.results; delete want.featured;
  const got = JSON.parse(local.getItem(SAVE)); assert.equal(got.results, null); delete got.results;
  assert.deepEqual(got, want);
});

test('검토: 손상 저장을 복원·초기화로 덮기 직전에 원문을 따로 남긴다', () => {
  const code = engine({local: store({[SAVE]: withProgress()})}).e.backupView().code;
  const a = engine({local: store({[SAVE]: '{broken'})});
  const p = a.e.previewRestore(code).preview;
  assert.equal(a.e.applyRestore(p, code).ok, true);
  assert.equal(a.local.getItem(HELD_KEY), '{broken');
  const bad = JSON.stringify({owned: {'없는-소재': true}});
  const b = engine({local: store({[SAVE]: bad})});
  assert.equal(b.e.resetProgress().ok, true);
  assert.equal(b.local.getItem(HELD_KEY), bad);
  // 정상 저장의 초기화는 따로 남기지 않는다(원본과 같다).
  const c = engine({local: store({[SAVE]: withProgress()})});
  assert.equal(c.e.resetProgress().ok, true);
  assert.equal(c.local.getItem(HELD_KEY), null);
});

test('검토: 원문을 남기지 못하면 복원·초기화를 멈추고 손상 저장을 그대로 둔다', () => {
  const code = engine({local: store({[SAVE]: withProgress()})}).e.backupView().code;
  const local = store({[SAVE]: '{broken'});
  const set = local.setItem;
  local.setItem = (k, v) => { if (k === HELD_KEY) throw new Error('quota'); set(k, v); };
  const {e} = engine({local});
  const p = e.previewRestore(code).preview;
  const r = e.applyRestore(p, code);
  assert.equal(r.ok, false); assert.match(r.error, /손상된 기존 저장을 따로 남기지 못해 중단했습니다/);
  assert.equal(e.resetProgress().ok, false);
  assert.equal(local.getItem(SAVE), '{broken'); assert.equal(e.status().blocked, true);
});

test('검토: 손상 저장 탭도 그사이 다른 탭이 쓴 저장은 덮지 않는다', () => {
  const code = engine({local: store({[SAVE]: withProgress()})}).e.backupView().code;
  const local = store({[SAVE]: '{broken'});
  const {e} = engine({local});
  const p = e.previewRestore(code).preview;
  const other = withProgress({scrap: 5});
  local.setItem(SAVE, other);
  assert.match(e.applyRestore(p, code).error, /다른 탭에서 진행이 바뀌었습니다/);
  assert.match(e.resetProgress().error, /다른 탭에서 진행이 바뀌었습니다/);
  assert.equal(local.getItem(SAVE), other); assert.equal(local.getItem(HELD_KEY), null);
});

test('검토: 제한 시간 뒤 늦게 온 사본은 버리고, 그 사본을 빈 진행으로 덮지도 않는다', async () => {
  const idb = fakeIDB({deferGet: true});
  const copy = withProgress(); idb.data.set(SAVE, copy);
  let fire;
  const local = store();
  const e = createEngine({storage: local, idb, env, now: () => DAY0, setTimer: f => { fire = f; }});
  const boot = e.boot();
  await settle();
  fire();
  assert.equal((await boot).restored, false);
  idb.flush(); await settle();
  assert.deepEqual(e.state().owned, {}, '늦은 사본은 적용하지 않는다');
  assert.equal(idb.data.get(SAVE), copy, '사본은 그대로 남아 다음 시작에 되살릴 수 있다');
  assert.equal(local.getItem(SAVE), null);
});

test('검토: 두 탭이 같은 사본에서 동시에 되살리면 나중 탭은 다른 탭 변경으로 멈춘다', async () => {
  const idb = fakeIDB(); idb.data.set(SAVE, withProgress());
  const local = store();
  const a = createEngine({storage: local, idb, env, now: () => DAY0});
  const b = createEngine({storage: local, idb, env, now: () => DAY0});
  const [ra, rb] = await Promise.all([a.boot(), b.boot()]);
  assert.equal(ra.restored && rb.restored, true);
  assert.equal(a.status().blocked, false);
  assert.equal(b.status().blocked, true);
  assert.match(b.status().warning, /다른 탭에서 진행이 바뀌었습니다/);
  assert.equal(local.getItem(SAVE), idb.data.get(SAVE));
});

test('검토: 사본 쓰기 실패는 저장을 막지 않고, 다른 탭 변경으로 멈추면 사본도 쓰지 않는다', async () => {
  const broken = engine({idb: fakeIDB({putFails: true})});
  assert.equal(broken.e.ship(1).ok, true);
  assert.equal(broken.e.status().warning, '');
  const idb = fakeIDB();
  const {e, local} = engine({idb});
  assert.equal(e.ship(1).ok, true); await until(() => idb.data.get(SAVE) === local.getItem(SAVE));
  const before = idb.data.get(SAVE);
  local.setItem(SAVE, withProgress({scrap: 3}));
  assert.equal(e.markBackup().ok, false);
  await settle();
  assert.equal(idb.data.get(SAVE), before);
});

test('검토: 사본 확인 중에는 백업 날짜도 기록하지 않는다', async () => {
  let fire;
  const local = store();
  const e = createEngine({storage: local, idb: fakeIDB({silent: true}), env, now: () => DAY0, setTimer: f => { fire = f; }});
  const boot = e.boot();
  const r = e.markBackup();
  assert.equal(r.ok, false); assert.equal(r.status.text, '저장 사본을 확인 중입니다. 창을 닫지 말고 잠시 기다려 주세요.');
  fire(); await boot;
  assert.equal(local.getItem(SAVE), null);
});
