import {DEADLINE, SHIPMENTS} from './first-contract.mjs';

export function createContract() {
  return {
    phase:'prep', elapsedMs:0, budget:3, selected:null, friends:{cr:0, wr:1, ga:0},
    cargo:SHIPMENTS.map((seconds, index) => ({
      id:index+1, lane:index >= 8 ? 0 : index % 2, marked:index >= 8,
      stage:'waiting', began:0, due:seconds*1000, from:0, to:0
    }))
  };
}

export function position(s, c) {
  if (c.due === Infinity || c.due === c.began) return c.to;
  const fraction = Math.max(0, Math.min(1,(s.elapsedMs-c.began)/(c.due-c.began)));
  return c.from + fraction*(c.to-c.from);
}

function travel(s,c,stage,duration,from,to) {
  Object.assign(c,{stage, began:s.elapsedMs, due:s.elapsedMs+duration, from,to});
}

function handleDue(s,c) {
  switch (c.stage) {
    case 'waiting': travel(s,c,'approach',12000,0,0.45); break;
    case 'approach': travel(s,c,'road',16000,0.45,1); break;
    case 'road':
    case 'bridge': travel(s,c,'shipped',Infinity,1,1); break;
  }
}

export function start(s) {
  if (s.phase !== 'prep' || s.selected) return false;
  s.phase = 'running';
  advance(s,0);
  return true;
}

export function shipped(s) { return s.cargo.filter(c => c.stage === 'shipped').length; }

export function advance(s,ms) {
  if (s.phase !== 'running' || s.selected || !Number.isFinite(ms) || ms < 0) return;
  const end = Math.min(DEADLINE,s.elapsedMs+ms);
  while (s.phase === 'running') {
    const next = Math.min(end,...s.cargo.map(c => c.due));
    s.elapsedMs = next;
    for (const c of s.cargo) if (c.due === next) handleDue(s,c);
    if (shipped(s) === s.cargo.length || next === DEADLINE) s.phase = 'result';
    if (next === end) break;
  }
}
