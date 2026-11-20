import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createContract,
  start,
  advance,
  selectFriend,
  cancelSelection,
  move,
  previewMove,
  useBridge,
  shipped,
} from './simulation.mjs';

test('pause on 1/2, cancel, then cross the bridge and win', () => {
  const s = createContract();
  start(s);
  advance(s, 152000);
  assert.equal(s.checked, 1);
  selectFriend(s, 'ga');
  assert.ok(previewMove(s, 'ga', 1).breaksPromise);
  const snapshot = structuredClone(s);
  advance(s, 30000);
  assert.deepEqual(s, snapshot);
  cancelSelection(s);
  advance(s, 8000);
  assert.equal(s.promise, 'ready');
  assert.equal(shipped(s), 8);
  selectFriend(s, 'ga');
  assert.ok(useBridge(s));
  assert.equal(useBridge(s), false);
  advance(s, 3000);
  assert.equal(s.phase, 'result');
  assert.equal(shipped(s), 10);
});
test('breaking the promise still allows normal victory', () => {
  const s = createContract();
  move(s, 'wr', 0);
  start(s);
  advance(s, 152000);
  move(s, 'ga', 1);
  assert.equal(s.promise, 'broken');
  advance(s, 28000);
  assert.equal(shipped(s), 10);
});
test('missing a ready bridge means 9/10 at departure', () => {
  const s = createContract();
  start(s);
  advance(s, 200000);
  assert.equal(shipped(s), 9);
  assert.equal(s.elapsedMs, 180000);
  assert.equal(s.cargo[9].stage, 'road');
});
test('late bridge carries only the remaining crate', () => {
  const s = createContract();
  move(s, 'wr', 0);
  start(s);
  advance(s, 160000);
  move(s, 'wr', 1);
  advance(s, 16000);
  assert.equal(shipped(s), 9);
  selectFriend(s, 'ga');
  useBridge(s);
  assert.equal(s.cargo[8].stage, 'shipped');
  advance(s, 3000);
  assert.equal(shipped(s), 10);
});
test('absent guard at wave start loses promise, earlier move can be reversed', () => {
  const s = createContract();
  move(s, 'ga', 1);
  start(s);
  advance(s, 140000);
  assert.equal(s.promise, 'broken');
  const other = createContract();
  move(other, 'ga', 1);
  start(other);
  move(other, 'ga', 0);
  advance(other, 140000);
  assert.equal(other.promise, 'guarding');
});
