import test from 'node:test';
import assert from 'node:assert/strict';
import { createContract, start, advance } from './simulation.mjs';

test('preparation freezes time and frame size does not affect the route', () => {
  const a = createContract(),
    b = createContract();
  advance(a, 20000);
  assert.equal(a.elapsedMs, 0);
  start(a);
  start(b);
  advance(a, 20000);
  for (let i = 0; i < 20; i++) advance(b, 1000);
  assert.deepEqual(a, b);
});

test('arrival exactly at deadline counts, one millisecond later does not', () => {
  for (const delay of [0, 1]) {
    const s = createContract();
    start(s);
    const cargo = s.cargo.at(-1);
    cargo.stage = 'bridge';
    cargo.due = 180000 + delay;
    advance(s, 181000);
    assert.equal(cargo.stage === 'shipped', delay === 0);
    assert.equal(s.phase, 'result');
  }
});
