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

export function snailLane(s) {
  if (s.elapsedMs >= 140000) return 0;
  if (s.elapsedMs >= 8000 && s.elapsedMs < 50000) return 1;
  return null;
}

function route(s,c,from=0.45) {
  const slow = snailLane(s) === c.lane && s.friends.wr !== c.lane;
  const duration = Math.round((1-from)/0.55 * (slow ? 28000 : 16000));
  travel(s,c,'road',duration,from,1);
}

function updateTraffic(s) {
  for (const c of s.cargo) {
    if (c.stage === 'road') route(s,c,position(s,c));
  }
}

export function previewMove(s,friend,lane) {
  const free = s.phase === 'prep';
  const cost = free ? 0 : 1 + Number(lane === snailLane(s));
  const allowed = s.phase !== 'result' && Object.hasOwn(s.friends,friend)
    && [0,1].includes(lane) && s.friends[friend] !== lane && cost <= s.budget;
  return {cost,allowed,breaksPromise:false};
}

export function move(s,friend,lane) {
  const preview = previewMove(s,friend,lane);
  if (!preview.allowed) return false;
  s.budget -= preview.cost;
  s.friends[friend] = lane;
  if (friend === 'wr') updateTraffic(s);
  s.selected = null;
  return true;
}

export function payInspection(s,id) {
  const c = s.cargo.find(cart => cart.id === id);
  if (s.phase !== 'running' || c?.stage !== 'inspection' || s.budget < 1) return false;
  s.budget--;
  route(s,c);
  s.selected = null;
  return true;
}

function handleDue(s,c) {
  switch (c.stage) {
    case 'waiting':
      c.stamped = c.id === 6 && s.friends.ga !== c.lane;
      travel(s,c,'approach',12000,0,0.45);
      break;
    case 'approach':
      if (c.stamped && s.friends.cr !== c.lane) travel(s,c,'inspection',12000,0.45,0.45);
      else route(s,c);
      break;
    case 'inspection': route(s,c); break;
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
    const milestone = [8000,50000,140000].find(t => t > s.elapsedMs);
    const next = Math.min(end,milestone ?? Infinity,...s.cargo.map(c => c.due));
    s.elapsedMs = next;
    for (const c of s.cargo) if (c.due === next) handleDue(s,c);
    if (next === milestone) updateTraffic(s);
    if (shipped(s) === s.cargo.length || next === DEADLINE) s.phase = 'result';
    if (next === end) break;
  }
}
