import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContract,start,advance,move,payInspection,previewMove} from './simulation.mjs';

test('inspection fee clears a stamped cart exactly once', () => {
  const s = createContract(); start(s); advance(s,82000);
  assert.equal(s.cargo[5].stage,'inspection');
  assert.equal(payInspection(s,6),true);
  assert.equal(payInspection(s,6),false);
  assert.equal(s.budget,2);
});
test('protection or inspection in lane B gets cargo through without a fee', () => {
  for (const friend of ['cr','ga']) {
    const s=createContract(); move(s,friend,1); start(s); advance(s,82000);
    assert.equal(s.cargo[5].stage,'road');
    assert.equal(s.budget,3);
  }
});
test('budget and active snail change a move; leaving releases traffic', () => {
  const s=createContract(); start(s); advance(s,140000);
  assert.equal(previewMove(s,'wr',0).cost,2);
  assert.ok(move(s,'wr',0)); advance(s,13000);
  const fast=s.cargo[8].due;
  assert.ok(move(s,'wr',1));
  assert.ok(s.cargo[8].due>fast);
  assert.equal(move(s,'wr',0),false);
  assert.equal(s.budget,0);
  assert.equal(s.friends.wr,1);
  advance(s,27000);
  assert.equal(s.phase,'result');
});
