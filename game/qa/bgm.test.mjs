import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createBgm} from '../src/bgm.mjs';

// 탭별 배경음악(2026-11-22): 승인 기록 ↔ 게임 파일 ↔ data.json ↔ 서비스 워커 뼈대, 그리고 재생기(bgm.mjs)의 줄임·겹침 규칙.
const read = p => fs.readFile(new URL(p, import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const record = JSON.parse(await read('../../current/approval/bgm/bgm-approval-2026-11-22.json'));
const data = JSON.parse(await read('../public/data.json'));

test('승인된 다섯 곡만 public/bgm에 같은 바이트로 있고 data.json의 반복 구간이 기록과 같다', async () => {
  assert.deepEqual(record.files.map(f => f.name), ['workshop', 'crafting', 'garage', 'collection', 'research']);
  assert.deepEqual((await fs.readdir(new URL('../public/bgm/', import.meta.url))).sort(), record.files.map(f => f.name + '.mp3').sort());
  for (const f of record.files) {
    const bytes = await read('../public/bgm/' + f.name + '.mp3');
    assert.equal(sha(bytes), f.sha256);
    assert.equal(bytes.length, f.bytes);
    assert.deepEqual(data.bgm[f.name], {file: 'bgm/' + f.name + '.mp3', loopStart: f.loopStart, loopEnd: f.loopEnd});
    assert.equal(f.loopStart, 1);
    assert.ok(Math.abs(f.loopEnd - 1 - f.loop.length) < 1e-3);
  }
});

test('배경음악은 서비스 워커 뼈대에 들어가지 않는다(탭에 들어갈 때 받는다)', async () => {
  const sw = (await read('../public/sw.mjs')).toString();
  const shell = JSON.parse(sw.match(/const SC_SHELL=(\[.*?\]);\n/)[1]);
  assert.ok(shell.length > 0);
  assert.ok(shell.every(row => !row.path.startsWith('bgm/')));
  assert.ok(shell.some(row => row.path === 'bgm.mjs'));
});

// 가짜 Web Audio: 램프 목표만 기록한다.
function fakeAudio({delay = 0} = {}) {
  const log = {ramps: [], starts: [], stops: [], fetched: [], decoded: [], suspended: 0};
  class Param { constructor(v) { this.value = v; } cancelScheduledValues() {} setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v, t) { log.ramps.push({node: this.node, to: v, at: t}); this.value = v; } }
  class Node { connect(n) { return n; } disconnect() {} }
  class Gain extends Node { constructor(name) { super(); this.gain = new Param(1); this.gain.node = name; } }
  class Source extends Node { start(at, offset) { log.starts.push({key: this.buffer.key, at, offset, loop: this.loop, loopStart: this.loopStart, loopEnd: this.loopEnd}); } stop() { log.stops.push(this.buffer.key); } }
  let gains = 0;
  globalThis.AudioContext = class { constructor() { this.currentTime = 0; this.destination = new Node(); this.state = 'running'; }
    createGain() { return new Gain(['duck', 'master'][gains++] || 'track'); } createBufferSource() { return new Source(); }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; log.suspended++; return Promise.resolve(); }
    decodeAudioData(raw) { const key = new TextDecoder().decode(raw); log.decoded.push(key); return Promise.resolve({key}); } };
  globalThis.fetch = async url => { const key = String(url).match(/bgm\/([a-z]+)\.mp3/)[1]; log.fetched.push(key); if (delay) await new Promise(r => setTimeout(r, delay)); return {ok: true, arrayBuffer: async () => new TextEncoder().encode(key).buffer}; };
  return log;
}
const tick = () => new Promise(r => setTimeout(r, 5));
const TRACKS = Object.fromEntries(['workshop', 'crafting', 'garage', 'collection', 'research'].map(k => [k, {file: 'bgm/' + k + '.mp3', loopStart: 1, loopEnd: 50}]));

test('재생기: 켜면 탭 곡을 반복 구간으로 틀고, 같은 곡 화면끼리는 잇고, 빠르게 바꾸면 마지막 곡만 튼다', async () => {
  const log = fakeAudio();
  const bgm = createBgm(new URL('http://x/'));
  assert.equal(bgm.toggle(), false, '자료가 없으면 켜지지 않는다');
  bgm.setTracks(TRACKS);
  bgm.view('ship');
  assert.equal(bgm.toggle(), true);
  await tick();
  assert.deepEqual(log.starts, [{key: 'workshop', at: 0, offset: 1, loop: true, loopStart: 1, loopEnd: 50}]);
  bgm.view('results'); bgm.view('workshop'); await tick();
  assert.equal(log.starts.length, 1, '공방·출하·출하 결과는 같은 곡');
  bgm.view('garage'); bgm.view('research'); await tick();
  assert.deepEqual(log.starts.map(s => s.key), ['workshop', 'research'], '받는 중에 바뀐 곡(차고)은 틀지 않는다');
  assert.deepEqual(log.stops, ['workshop']);
  assert.ok(log.ramps.some(r => r.node === 'track' && r.to === 1 && r.at === 0.8), '겹쳐 바꾸기 0.8초');
  bgm.view('garage'); bgm.view('research'); await tick();
  assert.deepEqual(log.starts.map(s => s.key), ['workshop', 'research'], '돌아오면 이미 나오던 곡을 그대로 둔다');
  assert.equal(bgm.toggle(), false);
  assert.deepEqual(log.stops, ['workshop', 'research']);
});

test('재생기 A안: 다른 음악이 울리는 동안 0.3초에 줄여 끄고, 모두 끝나면 1.5초에 되돌린다', async () => {
  const log = fakeAudio();
  const bgm = createBgm(new URL('http://x/'));
  bgm.setTracks(TRACKS);
  bgm.toggle(); await tick();
  const duck = () => log.ramps.filter(r => r.node === 'duck').map(r => [r.to, r.at]);
  bgm.hold('scene');
  bgm.hold('cue', 0.02);
  bgm.hold('scene');
  assert.deepEqual(duck(), [[0, 0.3]], '이미 줄인 상태에서 다시 잡아도 한 번만');
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(duck(), [[0, 0.3]], '장면이 남아 있으면 되돌리지 않는다');
  bgm.release('scene');
  assert.deepEqual(duck(), [[0, 0.3], [1, 1.5]]);
  bgm.release('scene');
  assert.equal(duck().length, 2, '잡지 않은 것을 풀어도 아무 일 없다');
  assert.deepEqual(bgm.held(), []);
});

test('재생기: 받는 동안 지나친 탭의 곡은 풀지 않고, 끄면 문맥을 쉬게 한다', async () => {
  const log = fakeAudio({delay: 20});
  const bgm = createBgm(new URL('http://x/'));
  bgm.setTracks(TRACKS);
  bgm.toggle();
  await new Promise(r => setTimeout(r, 40));
  bgm.view('crafting'); bgm.view('garage'); bgm.view('collection'); bgm.view('research');
  await new Promise(r => setTimeout(r, 60));
  assert.deepEqual(log.decoded, ['workshop', 'research'], '지나친 제작·차고·도감은 받기만 하고 풀지 않는다(검토 사소 3)');
  assert.deepEqual(log.starts.map(s => s.key), ['workshop', 'research']);
  bgm.toggle();
  assert.equal(log.suspended, 0);
  await new Promise(r => setTimeout(r, 450));
  assert.equal(log.suspended, 1, '끈 뒤 줄이기가 끝나면 문맥을 쉬게 한다(검토 참고 6)');
});
