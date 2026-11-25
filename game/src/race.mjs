// 주행 시험장(확장 A 관문 4). 차 상세의 [시험 주행]에서 여는 전체 화면 위층: 준비(코스·보강 소재) → 주행 → 성적서.
// 주행 부분(코스·한 걸음·그리기·도트 그림)은 시제품 v4(docs/design/game-racing-2026-11-22-u0/template.html)에서 옮겼다.
// 처음 열 때만 받는다(app.mjs의 동적 import). 본편 저장·재고·스크랩을 읽거나 쓰지 않는다: 가진 카드 목록만 받아 쓰고,
// 기록은 race-store.mjs의 별도 칸에 남긴다. 화면 글자는 textContent로만 쓴다. 그림은 전부 코드 도트이고 새 그림 파일은 없다.
import {SLOTS, SECTION, COURSES, TIER, materialRoles, judge, carTrait} from './race-rules.mjs';
import {GOLD, MEDAL_TEXT, medalOf} from './race-store.mjs';
import {button, el, micro} from './ui.mjs';

// 시험용 손잡이(화면에는 드러나지 않는다): 지금 주행의 요약과, 정해진 시간만큼 고정 간격으로 앞으로 돌리기.
// auto가 참이면 자동 조향으로 달리고 그 판의 기록은 저장하지 않는다.
export const raceProbe = {state: () => null, advance: () => null};

// owned(): 지금 도감에 있는 카드 ID → true. store: race-store. sfx(이름들): 켜져 있으면 본편 효과음을 낸다. onDismiss(차 키): 닫힌 뒤.
export function createRace(data, {owned, store, sfx: playSfx, onDismiss}) {
  const dialog = document.querySelector('#race-dialog');
  const roles = materialRoles(data);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cache = new Map();
  const $ = id => { let n = cache.get(id); if (!n) { n = dialog.querySelector('[data-r="' + id + '"]'); if (n) cache.set(id, n); } return n; };
  const tagged = (node, id) => { node.dataset.r = id; return node; };
  const label = c => c ? c.familyName + ' ' + c.grade : '표준 강판';
  const thumb = id => data.assets['thumbnail:' + id + ':front']?.image || '';
  const carImg = key => data.assets['car:' + key]?.image || '';
  const PICKS = {body: '', frame: '', chassis: ''};
  let COURSE = COURSES[0], SECS = COURSE.secs.map(k => SECTION[k]);
  let carKey = '', reduced = false, built = false, picking = '';
  const lastSfx = {};
  // 본편 효과음(쿵·종·차량)만 쓴다. 작은 소리는 내지 않고, 같은 소리는 0.25초에 한 번만.
  function sfx(name, gain = 0.6) {
    if (name === 'thud' ? gain < 0.4 : name === 'chime' ? gain < 0.3 : false) return;
    const now = performance.now(); if (now - (lastSfx[name] || 0) < 250) return; lastSfx[name] = now;
    if (name === 'chime') playSfx('chime', 'silver'); else playSfx(name);
  }

  // ── 도로: 구간(segment)을 이어 붙인 유사 3D 도로. 화면은 320×200 도트로 그려 키운다. ──
  const W = 320, H = 200, SEG = 200, DRAW = 220, ROAD = 1200, CAM_H = 1000, DEPTH = 1 / Math.tan(50 * Math.PI / 180), PZ = CAM_H * DEPTH;
  const PER = 60, MAX = SEG * PER;          // 최고 속도에서 1초에 60구간
  const LEAD = 2, SEC_T = 16, SEC_N = SEC_T * PER;
  const STEER = 2.4, CENT = 0.45, LANES = [-0.62, 0, 0.62];
  const RIVAL_GAP = [48, 121, 193, 266, 339], RIVAL_V = 0.89;   // 경쟁 차 다섯 대가 앞서 있는 거리(구간)와 속도. 도착 약 74.3·72.9·71.6·70.2·68.9초(메달 기준 금 70·은 76에 맞춰 0.93에서 늦춤)
  const TCW = 0.22, TWW = TCW * 2 * 1200, BAR = 3, BOOST_T = 2.2, REC = 0.25;   // 시험 차량 반폭·그림 폭, 게이지 칸, 부스트 길이, 고스트 기록 간격
  const LAYOUT = {                          // [들어가기, 유지, 빠지기, 굽음, 높이]
    hail: [[40, 120, 40, 2, 0], [40, 100, 40, -2, 15], [40, 120, 40, 3, -15], [40, 100, 40, -2, 0]],
    salt: [[30, 90, 30, 4, 0], [30, 90, 30, -4, 10], [30, 80, 30, 4, -10], [30, 90, 30, -4, 0], [20, 60, 20, 3, 0]],
    crash: [[40, 160, 40, 0, 0], [30, 100, 30, -2, 0], [30, 160, 30, 0, 0], [30, 100, 30, 2, 0]],
    bumps: [[40, 80, 40, 0, 40], [40, 80, 40, 1, -40], [40, 80, 40, -1, 50], [40, 80, 40, 2, -50], [40, 80, 40, 0, 0]],
    side: [[40, 160, 40, 0, 0], [30, 100, 30, 2, 0], [30, 160, 30, 0, 0], [30, 100, 30, -2, 0], [30, 90, 30, 1, 0]],
    twist: [[25, 70, 25, 5, 0], [25, 70, 25, -5, 8], [25, 70, 25, 5, -8], [25, 70, 25, -6, 0], [25, 70, 25, 5, 8], [25, 70, 25, -5, -8], [25, 70, 25, 6, 0], [20, 60, 20, -3, 0]],
    climb: [[40, 100, 40, 0, 70], [40, 60, 40, 1, -30], [40, 100, 40, -1, 80], [40, 60, 40, 0, -40], [40, 100, 40, 1, 60], [30, 40, 30, 0, -140]],
    speed: [[50, 180, 50, 1.5, 0], [40, 140, 40, 0, 0], [50, 180, 50, -1.5, 0], [30, 50, 30, 0, 0]]
  };
  const THEME = {
    lead: {sky: ['#6fa8d6', '#d6ebf5'], far: '#8fa7b8', hill: '#7d9a86', grass: ['#8aa37a', '#839c73'], road: ['#6d7378', '#686e73'], rumble: ['#14181d', '#f5b700'], lane: '#e8eaeb', fog: '#d6ebf5'},
    hail: {sky: ['#4f5963', '#9ea9b1'], far: '#6c7780', hill: '#5f7262', grass: ['#6f8a6a', '#69845f'], road: ['#5d6368', '#595f64'], rumble: ['#14181d', '#e8eaeb'], lane: '#d4d8da', fog: '#9ea9b1'},
    salt: {sky: ['#a9bfcf', '#eef3f6'], far: '#c7d3dc', hill: '#dfe7ec', grass: ['#f1f4f6', '#e6ebee'], road: ['#9aa2a8', '#959da3'], rumble: ['#b3261e', '#f8f8f5'], lane: '#f8f8f5', fog: '#eef3f6'},
    crash: {sky: ['#7fb3dd', '#e6f1f8'], far: '#9db0bf', hill: '#a9b2a6', grass: ['#bfc3bb', '#b7bbb3'], road: ['#6d7378', '#686e73'], rumble: ['#14181d', '#f5b700'], lane: '#f5b700', fog: '#e6f1f8'},
    bumps: {sky: ['#e07a43', '#f7d79c'], far: '#b96d4c', hill: '#9a7a4f', grass: ['#a08c58', '#97834f'], road: ['#7a6e66', '#74685f'], rumble: ['#14181d', '#f8f8f5'], lane: '#f6e7c4', fog: '#f7d79c'},
    side: {sky: ['#8fa9c4', '#e3ebf2'], far: '#8d99a5', hill: '#9aa39c', grass: ['#c9cbc4', '#c1c3bc'], road: ['#5f656a', '#5a6065'], rumble: ['#b3261e', '#f8f8f5'], lane: '#f8f8f5', fog: '#e3ebf2'},
    twist: {sky: ['#3f7fb8', '#bfe0ee'], far: '#6f8f9a', hill: '#4f7f5a', grass: ['#5f9a5c', '#589254'], road: ['#666c71', '#61676c'], rumble: ['#14181d', '#f8f8f5'], lane: '#e8eaeb', fog: '#bfe0ee'},
    climb: {sky: ['#5a6fa8', '#d9d3e6'], far: '#7d7fa3', hill: '#6a7a8a', grass: ['#7f9488', '#788d81'], road: ['#6a6f78', '#656a73'], rumble: ['#14181d', '#f5b700'], lane: '#e8eaeb', fog: '#d9d3e6'},
    speed: {sky: ['#2f8fd6', '#cfeaf7'], far: '#8fb0c2', hill: '#86a878', grass: ['#93b37c', '#8cac75'], road: ['#565c61', '#51575c'], rumble: ['#1963ae', '#f8f8f5'], lane: '#f8f8f5', fog: '#cfeaf7'},
    tail: null
  };

  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const easeIn = (a, b, p) => a + (b - a) * p * p, easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

  // ── 도트 그림(코드로 그림, 새 그림 아님) ──
  function sprite(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); paint(x, w, h); return c; }
  const INK = '#14181d', YEL = '#f5b700';
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }
  // ── 배경·길가 물체·장애물(코드 도트, 관문 3 A안 2026-11-23). 새 그림 파일 없음. ──
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const mix = (a, b, k) => { const p = rgb(a), q = rgb(b); return 'rgb(' + p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',') + ')'; };
  const disc = (g, cx, cy, r, col) => { g.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const half = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1); } };
  const wrap = (v, m) => ((v % m) + m) % m;
  const DUSK = {hail: 1, bumps: 1, climb: 1};
  const NEAR = {salt: 'snow', crash: 'wall', side: 'wall'};
  function cloudA(g, cx, cy, s, top, under) { for (const [dx, dy, r] of [[-9, 2, 5], [-2, -1, 7], [7, 1, 6], [14, 3, 4]]) disc(g, cx + dx * s, cy + dy * s + 2, Math.round(r * s), under); for (const [dx, dy, r] of [[-9, 2, 5], [-2, -1, 7], [7, 1, 6], [14, 3, 4]]) disc(g, cx + dx * s, cy + dy * s, Math.round(r * s), top); }
  function drawBg(g, th, key, skyX, hillX, horizon, t) {
    // 하늘: 일곱 띠와 띠 사이 점묘
    const N = 7, bh = Math.ceil(horizon / N);
    for (let i = 0; i < N; i++) {
      g.fillStyle = mix(th.sky[0], th.sky[1], i / (N - 1)); g.fillRect(0, i * bh, W, bh + 1);
      if (i < N - 1) { g.fillStyle = mix(th.sky[0], th.sky[1], (i + 1) / (N - 1)); const y = (i + 1) * bh - 2; for (let x = i % 2; x < W; x += 2) g.fillRect(x, y, 1, 1); for (let x = (i + 1) % 2; x < W; x += 2) g.fillRect(x, y + 1, 1, 1); }
    }
    // 구간마다 다른 하늘
    if (key === 'bumps') { disc(g, W * 0.7, horizon - 24, 17, '#fff0c4'); disc(g, W * 0.7, horizon - 24, 14, '#ffe08a'); g.fillStyle = mix(th.sky[0], th.sky[1], 0.8); for (let i = 0; i < 5; i++) g.fillRect(W * 0.7 - 18, horizon - 22 + i * 5, 37, 1 + (i >> 1)); }
    if (key === 'salt') { disc(g, W * 0.3, horizon - 40, 12, '#ffffff'); disc(g, W * 0.3, horizon - 40, 8, '#fffbe8'); }
    if (key === 'climb') { disc(g, W * 0.78, 22, 7, '#f3eefc'); disc(g, W * 0.78 + 3, 20, 6, mix(th.sky[0], th.sky[1], 0.15)); }
    if (key === 'hail') for (let i = 0; i < 6; i++) cloudA(g, wrap(i * 83 - skyX * 0.3 - t * 6, 440) - 60, 12 + (i % 3) * 13, 1 + (i % 2) * 0.5, '#3d454d', '#5c6670');
    if (key === 'twist' || key === 'lead' || key === 'speed') for (let i = 0; i < 4; i++) cloudA(g, wrap(i * 117 - skyX * 0.25 - t * 3, 440) - 60, 16 + (i % 2) * 18, 1 + (i % 2) * 0.4, '#ffffff', mix(th.sky[1], '#8fb0c8', 0.5));
    if (key === 'speed' || key === 'crash' || key === 'side') { g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) { const x = wrap(i * 150 - skyX * 0.2, 400) - 40; for (let k = 0; k < 34; k++) g.fillRect(x + k, 14 + i * 9 - (k >> 3), 1, 1); } }
    // 먼 산(가장 느리게 흐른다)
    const far2 = mix(th.sky[1], th.far, 0.45);
    for (let x = 0; x < W; x++) { const u = x + skyX * 0.15, hgt = 10 + Math.abs(wrap(u, 90) - 45) * 0.34 + Math.abs(wrap(u * 1.7 + 30, 62) - 31) * 0.22; const y = Math.round(horizon - hgt); g.fillStyle = far2; g.fillRect(x, y, 1, horizon - y); if (key === 'climb' || key === 'salt') { g.fillStyle = '#f8fbff'; g.fillRect(x, y, 1, Math.max(0, Math.round((hgt - 20) * 0.6))); } }
    // 공장 지붕선: 밝은 면·어두운 면, 창 불빛, 굴뚝 연기, 크레인 가새
    const lit = mix(th.far, '#ffffff', 0.22), dark = mix(th.far, '#000000', 0.22), win = DUSK[key] ? '#ffe9a8' : lit;
    for (const s of SKYLINE) for (const base of [0, 640]) {
      const x = Math.round(wrap(s.x - skyX * 0.4, 640) + base - 640 + 160), y = horizon, w = Math.round(s.w), h = Math.round(s.h);
      if (x > W || x + w < 0) continue;
      const box = (bx, by, bw, bhh) => { g.fillStyle = th.far; g.fillRect(bx, by, bw, bhh); g.fillStyle = lit; g.fillRect(bx, by, 1, bhh); g.fillRect(bx, by, bw, 1); g.fillStyle = dark; g.fillRect(bx + bw - 1, by + 1, 1, bhh - 1); };
      if (s.type === 'furnace') {
        box(x + 3, y - h, w - 6, h); box(x, y - Math.round(h * 0.45), w, Math.round(h * 0.45)); box(x + (w >> 1) - 1, y - h - 8, 3, 8);
        g.fillStyle = dark; for (let k = 0; k < 14; k++) g.fillRect(x + (w >> 1) + 2 + k, y - h - 6 + k, 2, 1);          // 비스듬한 관
        g.fillStyle = win; g.fillRect(x + 5, y - Math.round(h * 0.7), 2, 2); g.fillRect(x + w - 8, y - Math.round(h * 0.3), 2, 2);
      } else if (s.type === 'stack') {
        box(x + 4, y - h, 5, h); box(x, y - 8, 14, 8); g.fillStyle = '#d7261e'; g.fillRect(x + 4, y - h + 2, 5, 2); g.fillStyle = '#f8f8f5'; g.fillRect(x + 4, y - h + 5, 5, 2);
        if (!reduced) for (let k = 0; k < 3; k++) disc(g, x + 8 + k * 5 + Math.sin(t * 0.8 + s.x + k) * 2, y - h - 5 - k * 4, 3 + k, 'rgba(255,255,255,' + (0.4 - k * 0.1) + ')');
      } else if (s.type === 'crane') {
        box(x, y - h, 3, h); box(x + w - 3, y - h, 3, h); box(x - 4, y - h, w + 8, 3);
        g.fillStyle = dark; for (let k = 0; k < 6; k++) { g.fillRect(x + 3 + k, y - h + 3 + k, 1, 1); g.fillRect(x + w - 4 - k, y - h + 3 + k, 1, 1); }      // 모서리 가새
        const tx = x + 6 + Math.round((Math.sin(t * 0.3 + s.x) * 0.5 + 0.5) * (w - 16)); g.fillStyle = dark; g.fillRect(tx, y - h + 3, 4, 2); g.fillRect(tx + 1, y - h + 5, 1, 8); g.fillStyle = '#f5b700'; g.fillRect(tx, y - h + 13, 3, 2);
      } else {
        box(x, y - h, w, h); g.fillStyle = th.far; for (let k = 0; k + 6 <= w; k += 6) for (let r = 0; r < 3; r++) g.fillRect(x + k + r, y - h - 3 + r, 6 - r * 2, 1);     // 톱날 지붕
        g.fillStyle = win; for (let k = 3; k + 2 < w; k += 5) g.fillRect(x + k, y - Math.round(h * 0.5), 2, 1);
      }
    }
    // 가까운 층
    const near = NEAR[key] || 'trees', hill = th.hill, hillD = mix(th.hill, '#000000', 0.18), hillL = mix(th.hill, '#ffffff', 0.2);
    if (near === 'wall') {                                   // 시험장 담: 기둥과 노랑·먹 띠
      g.fillStyle = hill; g.fillRect(0, horizon - 7, W, 8); g.fillStyle = hillL; g.fillRect(0, horizon - 7, W, 1);
      for (let x = -wrap(hillX, 24); x < W; x += 24) { g.fillStyle = hillD; g.fillRect(Math.round(x), horizon - 9, 2, 10); }
      for (let x = -wrap(hillX, 8); x < W; x += 8) { g.fillStyle = '#14181d'; g.fillRect(Math.round(x), horizon - 2, 4, 2); g.fillStyle = '#f5b700'; g.fillRect(Math.round(x) + 4, horizon - 2, 4, 2); }
    } else {
      g.fillStyle = hill; g.beginPath(); g.moveTo(0, horizon + 1);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, horizon - 6 - Math.sin((x + hillX) / 37) * 4 - Math.sin((x + hillX) / 13) * 1.5);
      g.lineTo(W, horizon + 1); g.fill();
      for (let x = -wrap(hillX, 9); x < W + 9; x += 9) {
        const u = Math.round(x + hillX), top = horizon - 7 - Math.sin((x + hillX) / 37) * 4, r = 3 + wrap(u * 7, 3);
        if (near === 'snow') { if (wrap(u, 27) < 9) { g.fillStyle = '#3c6450'; for (let k = 0; k < 6; k++) g.fillRect(Math.round(x) - (k >> 1), Math.round(top) - 6 + k, 1 + (k >> 1) * 2, 1); g.fillStyle = '#f8f8f5'; g.fillRect(Math.round(x), Math.round(top) - 6, 1, 2); } }
        else { disc(g, x, top + 1, r, hillD); disc(g, x - 1, top, r - 1, hill); g.fillStyle = hillL; g.fillRect(Math.round(x) - 2, Math.round(top) - r + 1, 2, 1); }
      }
    }
  }
  // 길가 물체·장애물(더 큰 도트에 명암)
  const SPR = {
    lamp: sprite(15, 64, x => { x.fillStyle = '#3a4149'; x.fillRect(7, 6, 3, 58); x.fillStyle = '#6a737c'; x.fillRect(7, 6, 1, 58); x.fillStyle = '#3a4149'; x.fillRect(1, 3, 9, 3); x.fillRect(5, 60, 7, 4); x.fillStyle = '#fff4c2'; x.fillRect(0, 6, 5, 3); x.fillStyle = 'rgba(255,244,194,.35)'; x.fillRect(0, 9, 5, 4); x.fillRect(1, 13, 3, 3); }),
    chevR: sprite(22, 36, x => { x.fillStyle = '#3a4149'; x.fillRect(10, 18, 3, 18); x.fillStyle = '#6a737c'; x.fillRect(10, 18, 1, 18); x.fillStyle = INK; x.fillRect(0, 0, 22, 19); x.fillStyle = YEL; x.fillRect(1, 1, 20, 17); x.fillStyle = '#ffd95a'; x.fillRect(1, 1, 20, 1); x.fillStyle = INK; for (const o of [3, 11]) for (let k = 0; k < 7; k++) { x.fillRect(o + k, 3 + k, 3, 1); x.fillRect(o + k, 15 - k, 3, 1); } }),
    chevL: null,
    pine: sprite(28, 46, x => { x.fillStyle = '#4a3828'; x.fillRect(12, 36, 4, 10); x.fillStyle = '#6b523a'; x.fillRect(12, 36, 1, 10); for (let i = 0; i < 4; i++) { const y0 = 1 + i * 9, hh = 13, wd = 8 + i * 6; for (let k = 0; k < hh; k++) { const half = Math.max(1, Math.round(wd * (k + 1) / hh / 2)); x.fillStyle = '#23492f'; x.fillRect(14 - half, y0 + k, half * 2, 1); x.fillStyle = '#3f7a50'; x.fillRect(14 - half, y0 + k, Math.max(1, half - 1), 1); } x.fillStyle = '#5c9a6b'; x.fillRect(13, y0, 1, 3); } }),
    snowpine: sprite(28, 46, x => { x.fillStyle = '#4a3828'; x.fillRect(12, 36, 4, 10); for (let i = 0; i < 4; i++) { const y0 = 1 + i * 9, hh = 13, wd = 8 + i * 6; for (let k = 0; k < hh; k++) { const half = Math.max(1, Math.round(wd * (k + 1) / hh / 2)); x.fillStyle = '#2f5546'; x.fillRect(14 - half, y0 + k, half * 2, 1); x.fillStyle = k < 5 ? '#ffffff' : '#44705c'; x.fillRect(14 - half, y0 + k, k < 5 ? half * 2 : Math.max(1, half - 1), 1); } x.fillStyle = '#dfe9ee'; x.fillRect(14 - 2, y0 + 5, 5, 1); } }),
    coils: sprite(46, 34, x => { const coil = (cx, cy, r) => { for (let dy = -r; dy <= r; dy++) { const half = Math.round(Math.sqrt(r * r - dy * dy)); x.fillStyle = dy < -r * 0.3 ? '#aab5bf' : dy > r * 0.4 ? '#4a525b' : '#7a848e'; x.fillRect(cx - half, cy + dy, half * 2 + 1, 1); } for (let k = r - 2; k > 3; k -= 2) for (let a = 0; a < 40; a++) { const an = a / 40 * 6.283; x.fillStyle = Math.sin(an) < -0.2 ? '#c9d2da' : '#5d6570'; x.fillRect(Math.round(cx + Math.cos(an) * k), Math.round(cy + Math.sin(an) * k), 1, 1); } for (let dy = -3; dy <= 3; dy++) { const half = Math.round(Math.sqrt(9 - dy * dy)); x.fillStyle = '#1f2429'; x.fillRect(cx - half, cy + dy, half * 2 + 1, 1); } x.fillStyle = YEL; x.fillRect(cx - 1, cy - r, 3, 2); }; x.fillStyle = '#6b4e2e'; x.fillRect(0, 30, 46, 4); x.fillStyle = '#8a6b45'; x.fillRect(0, 30, 46, 1); coil(11, 20, 10); coil(34, 20, 10); coil(23, 9, 8); }),
    tires: sprite(20, 28, x => { for (let i = 0; i < 4; i++) { const y = 21 - i * 7; x.fillStyle = INK; x.fillRect(1, y, 18, 7); x.fillRect(2, y - 1, 16, 1); x.fillStyle = '#3a4149'; x.fillRect(2, y + 1, 16, 1); x.fillStyle = i % 2 ? YEL : '#e8eaeb'; x.fillRect(3, y + 3, 14, 2); x.fillStyle = INK; for (let k = 5; k < 16; k += 4) x.fillRect(k, y + 3, 1, 2); } }),
    hangar: sprite(62, 36, x => { x.fillStyle = '#b9bfc4'; x.fillRect(0, 9, 62, 27); x.fillStyle = '#d3d8dc'; for (let k = 0; k < 62; k += 4) x.fillRect(k, 9, 1, 27); x.fillStyle = '#8f979d'; x.fillRect(0, 5, 62, 4); x.fillStyle = '#a7aeb4'; x.fillRect(0, 5, 62, 1); x.fillStyle = YEL; x.fillRect(0, 10, 62, 2); x.fillStyle = '#2a2f35'; x.fillRect(20, 16, 22, 20); x.fillStyle = '#4a5157'; for (let k = 18; k < 36; k += 3) x.fillRect(20, k, 22, 1); x.fillStyle = '#fff4c2'; x.fillRect(6, 16, 5, 3); x.fillRect(51, 16, 5, 3); x.fillStyle = INK; x.fillRect(0, 35, 62, 1); }),
    cone: sprite(14, 20, x => { for (let k = 0; k < 15; k++) { const half = 1 + Math.round(k * 0.3); x.fillStyle = k % 6 > 3 ? '#f8f8f5' : '#f08a1c'; x.fillRect(7 - half, k + 1, half * 2, 1); x.fillStyle = k % 6 > 3 ? '#c9ced2' : '#c96a0c'; x.fillRect(7 + half - 1, k + 1, 1, 1); } x.fillStyle = INK; x.fillRect(0, 16, 14, 3); x.fillStyle = '#3a4149'; x.fillRect(0, 16, 14, 1); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(1, 19, 12, 1); }),
    barrel: sprite(16, 22, x => { x.fillStyle = INK; x.fillRect(1, 1, 14, 20); x.fillRect(2, 0, 12, 22); for (const y of [2, 9, 16]) { x.fillStyle = YEL; x.fillRect(2, y, 12, 4); x.fillStyle = '#ffd95a'; x.fillRect(3, y, 3, 4); x.fillStyle = '#b98a00'; x.fillRect(12, y, 2, 4); } x.fillStyle = '#3a4149'; x.fillRect(2, 7, 12, 1); x.fillRect(2, 14, 12, 1); }),
    ice: sprite(24, 16, x => { const rows = [[9, 5], [6, 11], [4, 15], [2, 19], [1, 21], [1, 22], [1, 22], [0, 24], [0, 24], [0, 24], [1, 23], [1, 22], [2, 21], [3, 19]]; rows.forEach(([a, b], y) => { x.fillStyle = '#4d6f84'; x.fillRect(a, y + 1, b, 1); x.fillStyle = y < 4 ? '#ffffff' : y < 9 ? '#d9eef7' : '#a9cfe0'; x.fillRect(a + 1, y + 1, b - 2, 1); }); x.fillStyle = '#ffffff'; x.fillRect(8, 4, 4, 2); x.fillStyle = '#7fb2c9'; for (let k = 0; k < 7; k++) x.fillRect(13 + k, 5 + k, 1, 1); }),
    cart: sprite(30, 20, x => { x.fillStyle = INK; x.fillRect(3, 15, 6, 5); x.fillRect(21, 15, 6, 5); x.fillStyle = '#3a4149'; x.fillRect(4, 16, 4, 3); x.fillRect(22, 16, 4, 3); x.fillStyle = '#6a737c'; x.fillRect(0, 9, 30, 8); x.fillStyle = '#8f979d'; x.fillRect(0, 9, 30, 1); x.fillStyle = '#4a5157'; x.fillRect(0, 16, 30, 1); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? INK : YEL; x.fillRect(1 + i * 3.5, 2, 4, 7); } x.fillStyle = INK; x.fillRect(0, 1, 30, 1); x.fillStyle = '#d7261e'; x.fillRect(13, 0, 4, 2); x.fillStyle = '#ff9a8a'; x.fillRect(14, 0, 2, 1); }),
    stone: sprite(8, 8, x => { disc(x, 4, 4, 3, '#e8f3f8'); x.fillStyle = '#ffffff'; x.fillRect(2, 2, 2, 2); x.fillStyle = '#9fb8c6'; x.fillRect(4, 5, 3, 2); })
  };
  SPR.chevL = sprite(22, 36, x => { x.translate(22, 0); x.scale(-1, 1); x.drawImage(SPR.chevR, 0, 0); });

  // 차 뒷모습(코드 도트): 차급에 따라 폭·높이, 색은 승인된 차 그림에서 뽑는다.
  function carColor(img) {
    try {
      const c = sprite(32, 20, x => x.drawImage(img, 0, 0, 32, 20)), d = c.getContext('2d').getImageData(0, 0, 32, 20).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (d[i + 3] < 200 || mx > 235 && mn > 215 || mx < 40) continue; const wgt = 1 + (mx - mn) / 20; r += d[i] * wgt; g += d[i + 1] * wgt; b += d[i + 2] * wgt; n += wgt; }
      if (n < 10) return '#c9ced2';
      const hx = v => Math.round(v / n).toString(16).padStart(2, '0'); return '#' + hx(r) + hx(g) + hx(b);
    } catch { return '#c9ced2'; }
  }
  // ── 차 뒷모습(코드 도트, 관문 3 A안 2026-11-23): 차급마다 따로 그린다. 화면 해상도 그대로 줄 단위로 채운다. 색은 승인된 차 그림에서 뽑는다. ──
  // hw 반폭 비율(차급 폭), h 높이/폭, roof 지붕 반폭, cab 창 아래 반폭, belt 창 아래선 높이, lamp 후미등 모양, 그 밖은 꾸밈.
  const SPEC = {
    '대형 미니밴': {h: 0.80, roof: 0.82, cab: 0.94, belt: 0.50, lamp: 'tall', glass: 0.86, spoiler: 1, ride: 0.10},
    '3열 SUV': {h: 0.80, roof: 0.78, cab: 0.92, belt: 0.46, lamp: 'tall', glass: 0.80, rails: 1, ride: 0.15, skid: 1},
    '크로스오버 SUV': {h: 0.72, roof: 0.70, cab: 0.90, belt: 0.44, lamp: 'bar', glass: 0.74, spoiler: 1, ride: 0.14, skid: 1},
    '중형 세단': {h: 0.60, roof: 0.60, cab: 0.84, belt: 0.42, lamp: 'split', glass: 0.74, trunk: 1, ride: 0.08, pipes: 2},
    '소형 해치백': {h: 0.68, roof: 0.70, cab: 0.90, belt: 0.44, lamp: 'split', glass: 0.78, spoiler: 1, ride: 0.09, wiper: 1},
    '경형 크로스오버': {h: 0.84, roof: 0.80, cab: 0.94, belt: 0.46, lamp: 'round', glass: 0.80, rails: 1, ride: 0.15, skid: 1},
    '경형 로드스터': {h: 0.56, roof: 0, cab: 0.80, belt: 0.40, lamp: 'round', open: 1, trunk: 1, ride: 0.07, pipes: 2}
  };
  function paintRear(x, w, col, spec, o = {}) {
    const R = Math.round, h = R(w * spec.h), cx = w / 2, lean = o.lean || 0;
    const body = o.flash ? '#f8f8f5' : col, hi = shade(body, 0.28), lo = shade(body, -0.28), deep = shade(body, -0.5);
    const tyre = R(w * 0.13), ride = Math.max(2, R(h * spec.ride)), sill = h - ride - 1, belt = R(h * spec.belt), bump = sill - Math.max(3, R(h * 0.14));
    const span = (y, half, c, dx = 0) => { x.fillStyle = c; x.fillRect(R(cx - half + dx), y, R(half * 2), 1); };
    // 그림자와 바퀴
    x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(2, h - 2, w - 4, 2);
    x.fillStyle = INK; x.fillRect(1, sill - 3, tyre, h - sill + 2); x.fillRect(w - 1 - tyre, sill - 3, tyre, h - sill + 2);
    x.fillStyle = '#3a4149'; x.fillRect(2, h - 2, tyre - 2, 1); x.fillRect(w - tyre, h - 2, tyre - 2, 1);
    // 차체: 어깨는 둥글게, 위는 밝고 아래는 어둡다
    for (let y = belt; y <= sill; y++) {
      const t = (y - belt) / (sill - belt), round = y - belt < 2 ? 2 - (y - belt) : sill - y < 1 ? 1 : 0;
      span(y, cx - round, y >= bump ? (y === bump ? deep : '#2a2f35') : t < 0.16 ? hi : t > 0.62 ? lo : body);
    }
    x.fillStyle = INK; x.fillRect(0, belt + 2, 1, bump - belt - 2); x.fillRect(w - 1, belt + 2, 1, bump - belt - 2);
    // 지붕과 뒷유리(조향하면 지붕이 옆으로 쏠린다)
    if (!spec.open) {
      const top = 1, rw = spec.roof * cx, cw = spec.cab * cx;
      for (let y = top; y < belt; y++) { const t = (y - top) / (belt - top), half = rw + (cw - rw) * Math.pow(t, 0.8) - (y - top < 2 ? 2 - (y - top) : 0); span(y, half, y - top < 2 ? hi : t > 0.85 ? lo : shade(body, 0.1), lean * (1 - t)); }
      const gt = top + 3, gb = belt - 2;
      for (let y = gt; y <= gb; y++) { const t = (y - top) / (belt - top), half = (rw + (cw - rw) * Math.pow(t, 0.8)) * spec.glass - (y === gt || y === gb ? 1 : 0); span(y, half, y - gt < 2 ? '#3d586c' : '#22313d', lean * (1 - t)); }
      x.fillStyle = '#7fa0b6'; for (let i = 0; i < R((gb - gt) * 0.7); i++) x.fillRect(R(cx - rw * 0.5 + lean) - i, gt + 1 + i, 2, 1);
      if (spec.wiper) { x.fillStyle = INK; x.fillRect(R(cx) - 4, gb - 1, 9, 1); }
      if (spec.spoiler) { span(top, rw + 1, deep, lean); span(top + 1, rw, INK, lean); }
      if (spec.rails) { x.fillStyle = '#c9ced2'; x.fillRect(R(cx - rw + 2 + lean), 0, 2, 2); x.fillRect(R(cx + rw - 4 + lean), 0, 2, 2); }
      x.fillStyle = INK; x.fillRect(R(cx - cw) - 2, belt - 3, 2, 2); x.fillRect(R(cx + cw), belt - 3, 2, 2);          // 거울
    } else {                                                                     // 로드스터: 앞유리 틀, 롤 후프 둘, 머리 받침
      const fw = cx * 0.62;
      x.fillStyle = '#3d586c'; x.fillRect(R(cx - fw + lean), belt - 9, R(fw * 2), 6); x.fillStyle = INK; x.fillRect(R(cx - fw + lean), belt - 10, R(fw * 2), 1);
      for (const s of [-1, 1]) { const hx = R(cx + s * fw * 0.5 - 4 + lean * 0.5); x.fillStyle = '#c9ced2'; x.fillRect(hx, belt - 7, 8, 1); x.fillRect(hx, belt - 7, 1, 7); x.fillRect(hx + 7, belt - 7, 1, 7); x.fillStyle = '#2a2f35'; x.fillRect(hx + 2, belt - 5, 4, 5); }
      span(belt - 1, cx - 3, deep);
    }
    if (spec.trunk) span(belt + 1, cx * 0.7, shade(body, 0.4));                   // 트렁크 끝 밝은 선
    // 후미등
    const red = o.brake ? '#ff5a4a' : '#d7261e', glow = '#ff9a8a', ly = belt + 3;
    if (spec.lamp === 'bar') { x.fillStyle = red; x.fillRect(2, ly, w - 4, 2); x.fillStyle = glow; x.fillRect(3, ly, R(w * 0.18), 1); x.fillRect(w - 3 - R(w * 0.18), ly, R(w * 0.18), 1); }
    else if (spec.lamp === 'tall') { for (const s of [0, 1]) { const lx = s ? w - 5 : 2; x.fillStyle = red; x.fillRect(lx, belt - 5, 3, 11); x.fillStyle = glow; x.fillRect(lx + (s ? 0 : 1), belt - 4, 1, 5); } }
    else if (spec.lamp === 'round') { for (const s of [0, 1]) { const lx = s ? w - 8 : 3; x.fillStyle = red; x.fillRect(lx, ly, 5, 3); x.fillRect(lx + 1, ly - 1, 3, 5); x.fillStyle = glow; x.fillRect(lx + 1, ly, 2, 1); } }
    else { const lw = R(w * 0.24); for (const s of [0, 1]) { const lx = s ? w - 2 - lw : 2; x.fillStyle = red; x.fillRect(lx, ly, lw, 3); x.fillStyle = glow; x.fillRect(lx + (s ? lw - 4 : 1), ly, 3, 1); x.fillStyle = '#f8f8f5'; x.fillRect(s ? lx : lx + lw - 2, ly + 1, 2, 1); } }
    // 번호판(글자 없음), 범퍼 아래, 배기구
    x.fillStyle = '#f8f8f5'; x.fillRect(R(cx) - 5, bump - 5, 10, 4); x.fillStyle = '#9aa2a8'; x.fillRect(R(cx) - 5, bump - 2, 10, 1);
    if (spec.skid) { x.fillStyle = '#9aa2a8'; x.fillRect(R(cx - w * 0.2), sill - 1, R(w * 0.4), 1); }
    x.fillStyle = '#c9ced2'; if (spec.pipes === 2) { x.fillRect(R(w * 0.2), sill - 1, 3, 2); x.fillRect(R(w * 0.8) - 3, sill - 1, 3, 2); } else x.fillRect(R(w * 0.24), sill - 1, 3, 2);
    // 우박 자국, 부스트 불꽃
    x.fillStyle = 'rgba(20,24,29,.5)'; for (let i = 0; i < (o.dents || 0); i++) { const dx = R(w * (0.14 + (i * 0.37) % 0.72)), dy = R(belt + 6 + (i * 5) % Math.max(1, bump - belt - 12)); x.fillRect(dx, dy, 3, 1); x.fillRect(dx + 1, dy + 1, 1, 1); }
    if (o.boost) for (const px of spec.pipes === 2 ? [R(w * 0.2), R(w * 0.8) - 3] : [R(w * 0.24)]) { x.fillStyle = YEL; x.fillRect(px, sill + 1, 3, 2); x.fillStyle = '#ff7a1a'; x.fillRect(px, sill + 3, 3, 1); x.fillStyle = '#fff4c2'; x.fillRect(px + 1, sill + 1, 1, 1); }
    return h;
  }
  const specOf = body => SPEC[body] || SPEC['중형 세단'];
  const rearSprite = (w, col, body, o) => { const spec = specOf(body); return sprite(w, Math.round(w * spec.h) + 4, x => paintRear(x, w, col, spec, o)); };
  // 경쟁 차 다섯(선명한 색, 차급도 다름. 회색 작업 차와 헷갈리지 않게 흰색 대신 노랑)과 작업 차량 둘(회색 승합·SUV)
  const TSPR = [['#2f7fd1', '중형 세단'], ['#2e9e5b', '소형 해치백'], ['#e8792b', '크로스오버 SUV'], ['#8a4fc7', '경형 로드스터'], ['#f5b700', '중형 세단'], ['#7d8a96', '대형 미니밴'], ['#9aa2a8', '3열 SUV']].map(([col, body]) => rearSprite(44, col, body));
  const BLINK = sprite(44, 20, x => { x.fillStyle = '#ff9a1a'; x.fillRect(0, 5, 6, 5); x.fillStyle = '#fff4c2'; x.fillRect(1, 6, 3, 2); });

  // ── 코스: 같은 씨앗으로 매번 같은 코스(기록 비교용) ──
  let SEGS = [], STARTS = [], GOAL = 0, START_LINE = 5, WALL = -1, BUILT = '';
  function buildCourse() {
    const r = rng(20261122 + COURSES.indexOf(COURSE) * 101), segs = [];
    const lastY = () => segs.length ? segs[segs.length - 1].p2.wy : 0;
    const add = (curve, y, sec) => { const i = segs.length; segs.push({i, curve, sec, p1: {wy: lastY(), wz: i * SEG}, p2: {wy: y, wz: (i + 1) * SEG}, sprites: [], obs: [], clip: 0}); };
    const road = (sec, [enter, hold, leave, curve, height]) => {
      const y0 = lastY(), y1 = y0 + height * SEG, total = enter + hold + leave;
      for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / total), sec);
      for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n) / total), sec);
      for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / total), sec);
    };
    const block = (sec, n, pieces) => { const start = segs.length; for (const p of pieces) road(sec, p); while (segs.length < start + n) add(0, lastY(), sec); return start; };
    block('lead', LEAD * PER, []);
    const starts = SECS.map(s => block(s.key, SEC_N, LAYOUT[s.key]));
    const goal = segs.length + PER;
    THEME.tail = THEME[SECS[SECS.length - 1].key];
    block('tail', PER * 3 + DRAW + 20, []);
    // 길가: 가로등, 굽은 길의 갈매기 표지, 구간마다 다른 풍경
    const deco = {lead: ['coils', 'hangar'], hail: ['pine', 'coils'], salt: ['snowpine', 'snowpine'], crash: ['tires', 'hangar'], bumps: ['pine', 'coils'], side: ['tires', 'hangar'], twist: ['pine', 'pine'], climb: ['pine', 'coils'], speed: ['hangar', 'coils'], tail: ['coils', 'hangar']};
    const WW = {lamp: 140, chevR: 300, chevL: 300, pine: 620, snowpine: 620, coils: 720, tires: 300, hangar: 1500, cone: 150, barrel: 170, ice: 260, cart: 360};
    const put = (s, name, off) => s.sprites.push({img: SPR[name], off, ww: WW[name]});
    for (const s of segs) {
      if (s.i % 12 === 0) { put(s, 'lamp', -1.18); put(s, 'lamp', 1.18); }
      if (s.curve && s.i % 10 === 5) put(s, s.curve > 0 ? 'chevR' : 'chevL', s.curve > 0 ? -1.3 : 1.3);
      if (s.i % 9 === 3) { const kinds = deco[s.sec]; put(s, kinds[Math.floor(r() * kinds.length)], (r() < 0.5 ? -1 : 1) * (1.6 + r() * 2.2)); }
    }
    // 장애물과 우박
    const shuffle = a => a.map(v => [r(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    const KIND = {hail: ['ice'], salt: ['cone', 'slush'], crash: ['cone', 'barrel'], bumps: ['pothole', 'tires'], side: ['cone'], twist: ['cone', 'tires'], climb: ['barrel', 'pothole'], speed: ['cone']};
    SECS.forEach((sec, k) => {
      const start = starts[k], end = start + SEC_N - (sec.key === 'crash' ? 150 : 90);
      for (let i = start + 70; i < end;) {
        const two = r() < (sec.key === 'crash' ? 0.3 : 0.2);
        for (const lane of shuffle([0, 1, 2]).slice(0, two ? 2 : 1)) {
          const kind = KIND[sec.key][Math.floor(r() * KIND[sec.key].length)];
          segs[i].obs.push({kind, off: LANES[lane] + (r() - 0.5) * 0.12, ww: kind === 'slush' || kind === 'pothole' ? 330 : WW[kind] || 300, hit: false});
        }
        i += Math.round(sec.key === 'crash' ? 50 + r() * 30 : sec.key === 'hail' ? 100 + r() * 40 : sec.key === 'speed' || sec.key === 'side' ? 110 + r() * 50 : 72 + r() * 40);   // v3: 시험 차량이 생겨 고정 장애물은 성기게
      }
      if (sec.key === 'hail') for (let i = start + 50; i < start + SEC_N - 60; i += Math.round(42 + r() * 26)) segs[i].obs.push({kind: 'drop', off: (r() * 2 - 1) * 0.78, ww: 300, hit: false});
      // 측면 충돌: 갓길에 선 대차가 내가 다가오면 차선으로 튀어나온다
      if (sec.key === 'side') for (let i = start + 90; i < start + SEC_N - 100; i += Math.round(46 + r() * 28)) { const from = r() < 0.5 ? -1.5 : 1.5; segs[i].obs.push({kind: 'cart', off: from, from, to: LANES[Math.floor(r() * 3)], ww: WW.cart, hit: false}); }
      if (sec.key === 'crash') segs[start + SEC_N - 70].wall = {broken: false};
      segs[start + SEC_N - 1].gate = k;
    });
    segs[START_LINE].line = true; segs[goal].line = true; segs[goal].gate = 'goal';
    return {segs, starts, goal};
  }
  function useCourse() { if (BUILT === COURSE.key) return; ({segs: SEGS, starts: STARTS, goal: GOAL} = buildCourse()); WALL = SEGS.findIndex(s => s.wall); BUILT = COURSE.key; }
  const SKYLINE = (() => { const r = rng(77), out = []; let x = 0; while (x < 640) { const type = ['furnace', 'stack', 'crane', 'shed', 'shed'][Math.floor(r() * 5)]; const w = type === 'shed' ? 26 + r() * 30 : type === 'crane' ? 34 : 14 + r() * 8; out.push({x, w, h: type === 'stack' ? 30 + r() * 14 : type === 'furnace' ? 34 + r() * 10 : type === 'crane' ? 26 : 10 + r() * 10, type}); x += w + 6 + r() * 24; } return out; })();

  // ── 주행 상태 ──
  let cv = null, g = null;
  const carCv = document.createElement('canvas'), carG = carCv.getContext('2d');
  let state = null, raf = 0;
  const keys = {left: false, right: false}, touches = new Map();
  const pickCard = id => data.cards.find(c => c.id === id) || null;
  function newRun() {
    const car = data.cars.find(c => c.key === carKey), trait = carTrait(car.body), p = {...PICKS}, verdict = judge(data, roles, p);
    useCourse();
    for (const s of SEGS) { for (const o of s.obs) { o.hit = false; o.fly = 0; if (o.kind === 'cart') o.off = o.from; } if (s.wall) s.wall.broken = false; }
    // 시험 차량: 같은 씨앗으로 같은 자리·속도. 나보다 느려서 차례로 따라잡는다.
    const tr = rng(4242), traffic = [];
    const mk = (z, lane, v, spr, rival) => traffic.push({z: z * SEG, lane, off: LANES[lane], target: LANES[lane], v, spr, rival, swap: 3 + tr() * 7, blink: 0, dir: 0, passed: false, counted: false, bumpT: 0, gone: false});
    for (let i = 0; i < 8; i++) mk(240 + i * 165 + tr() * 80, Math.floor(tr() * 3), MAX * (0.5 + tr() * 0.14), 5 + i % 2, false);
    RIVAL_GAP.forEach((d, i) => mk(PZ / SEG + d, [1, 0, 2, 1, 0][i], MAX * RIVAL_V, i, true));      // 경쟁 차: 먼저 출발해 일정한 속도로 달린다
    const best = store.best(car.key, COURSE.key);
    const goalPos = GOAL - PZ / SEG, ghost = best?.ghost || Array.from({length: Math.ceil(GOLD / REC) + 2}, (_, i) => [Math.min(goalPos, goalPos * i * REC / GOLD), 0]);
    const img = new Image(); img.src = carImg(car.key);
    const st = {car, trait, verdict, picks: p, color: '#c9ced2', cw: 0.243 * trait.width,
      pos: 0, x: 0, vx: 0, speed: 0, time: 0, lastIdx: Math.floor(PZ / SEG), phase: 'count', countT: 0, paused: false, last: 0,
      gauge: 1, rank: RIVAL_GAP.length + 1, boosts: 0, boostT: 0, surge: 0, traffic, passes: 0, grazes: 0, draftT: 0, drafted: 0, launch: null, launched: false, spin: 0, goShow: 0, lift: 0, popT: 0,
      ghost, ghostMine: !!best?.ghost, gi: 0, rec: [], best, gapT: 0, hitT: 0, hits: 0, sideHits: 0, bounced: 0, dents: 0, drops: 0, offT: 0, shakeT: 0, wall: null,
      entered: [false, false, false, false], gated: [false, false, false, false], results: [], banner: 0, cut: 0,
      skyX: 0, hillX: 0, horizon: H / 2, parts: [], fx: [], steer: 0, bot: false};
    img.decode().then(() => { st.color = carColor(img); }).catch(() => {});
    st.carW = Math.round(st.cw * (ROAD * W / 2) / CAM_H); st.spec = specOf(car.body); st.fw = st.carW * 2; st.fh = Math.round(st.fw * st.spec.h); st.carH = Math.round(st.fh / 2);
    carCv.width = st.fw; carCv.height = st.fh + 4;
    st.gspr = sprite(st.fw, st.fh + 4, x => { paintRear(x, st.fw, '#f8f8f5', st.spec); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#f8f8f5'; x.fillRect(0, 0, st.fw, st.fh + 4); });   // 고스트: 내 차 모양의 흰 그림자
    return st;
  }
  const CLS = ['fair', 'ok', 'pass'];
  const FORECAST = {        // [보통, 통함, 최적]
    hail: ['외판 소재가 아니라 깊게 패여요 · 그림자를 피하세요', '바디 소재라 얕게 패여요 · 그림자를 피하세요', '소부경화 외판이라 우박을 튕겨 내요'],
    salt: ['도금재가 없어 미끄러워요 · 미리 꺾으세요', '도금재라 조금만 미끄러워요', '바닥용 도금재라 눈길에서도 잘 잡혀요'],
    crash: ['프레임 소재가 아니라 벽에서 멈칫해요', '프레임 소재라 벽은 넘지만 느려져요', '범퍼 빔 소재라 시험 벽을 뚫고 가속해요'],
    side: ['프레임 소재가 아니라 받히면 크게 밀려요 · 대차를 피하세요', '프레임 소재라 받히면 조금 밀려요 · 대차를 피하세요', 'B 필러 소재라 대차를 튕겨 내요'],
    twist: ['차체가 뒤틀려 굽은 길에서 크게 밀려요', '프레임 소재라 굽은 길에서 조금만 밀려요', '크로스멤버 소재라 굽은 길에서도 단단해요'],
    bumps: ['섀시 소재가 아니라 크게 흔들려요', '섀시 소재라 조금만 흔들려요', '스프링 소재라 요철에도 안정적이에요'],
    climb: ['섀시 소재가 아니라 오르막에서 힘이 빠져요', '섀시 소재라 오르막에서 조금 처져요', '엔진 부품 소재라 오르막도 힘차게 올라요'],
    speed: ['섀시 소재가 아니라 바퀴가 떨려 속도가 안 나요', '섀시 소재라 속도가 조금 덜 나요', '타이어·베어링 소재라 최고 속도가 올라요']
  };
  function cutin(k) {
    const s = state, sec = SECS[k], r = s.verdict[sec.key], c = r.card;
    $('cut-img').hidden = !c; if (c) $('cut-img').src = thumb(c.id);
    $('cut-tag').textContent = sec.name + ' · ' + r.slot.name + ' 칸 · ' + TIER[r.tier];
    $('cut-title').textContent = label(c);
    $('cut-line').textContent = FORECAST[sec.key][r.tier];
    $('cutin').className = 'race-cutin ' + CLS[r.tier]; $('cutin').hidden = false; s.cut = 2.6;
  }
  function banner(text, sub, cls, t = 1.6) { const b = $('banner'); b.replaceChildren(text, el('small', '', sub)); b.className = 'race-banner ' + cls; b.hidden = false; state.banner = t; }
  function burst(x, y, col, n, spread = 60) { if (reduced) return; for (let i = 0; i < n; i++) state.fx.push({x, y, vx: (Math.random() - 0.5) * spread * 2, vy: -Math.random() * spread - 10, life: 0.5 + Math.random() * 0.4, col, sz: 1 + Math.random() * 2}); }
  function laneBlocked(ci, lane, from, to) { for (let i = ci + from; i < ci + to && i < SEGS.length; i++) for (const o of SEGS[i].obs) if (o.kind !== 'drop' && o.kind !== 'slush' && o.kind !== 'pothole' && Math.abs(o.off - LANES[lane]) < 0.36) return true; return false; }
  const mine = (c, lane) => { const s = state, d = (c.z - s.pos - PZ) / SEG; return d > -6 && d < 12 && Math.abs(s.x - LANES[lane]) < s.cw + TCW + 0.12; };
  function pop(text) { const p = $('pop'); p.textContent = text; p.hidden = false; state.popT = 0.8; }
  function gain(n) { state.gauge = clamp(state.gauge + n, 0, BAR); }
  function graze() { const s = state; s.grazes++; gain(0.22); pop('스침! 게이지 +'); sfx('chime', 0.18); }
  function rocket() { const s = state; s.launched = true; s.speed = MAX * 0.7; s.surge = 0.9; pop('로켓 출발!'); sfx('chime', 0.5); }
  const fmt = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');

  function botSteer(s, idx) {
    // 시험용 자동 조향(사람 기록 아님): 앞쪽 60구간에 장애물·우박이 없는 차선을 고르고 굽음을 상쇄한다.
    // 차선마다 '부딪히기까지 남은 시간'이 짧을수록 나쁘다. 고정 장애물은 내 속도로, 차는 속도 차이로 다가온다.
    const busy = [0, 0, 0], vs = Math.max(10, s.speed / SEG), pz = (s.pos + PZ) / SEG, bad = (k, tti, w) => { if (tti < 1.4) busy[k] += (1.4 - tti) * w; };
    for (let i = idx; i < idx + 90 && i < SEGS.length; i++) for (const o of SEGS[i].obs) if (!o.hit && o.kind !== 'slush') LANES.forEach((l, k) => { if (Math.abs(l - o.off) < s.cw + 0.22 || o.kind === 'cart' && Math.abs(l - o.to) < s.cw + 0.3) bad(k, (i - idx) / vs, 100); });
    for (const c of s.traffic) { if (c.gone) continue; const d = c.z / SEG - pz, rel = vs - c.v / SEG; if (d < -1 || d > 60 || rel < 1 && d > 3) continue; LANES.forEach((l, k) => { if (Math.abs(l - c.off) < s.cw + TCW + 0.12 || Math.abs(l - c.target) < s.cw + TCW + 0.12) bad(k, d / Math.max(1, rel), 60); }); }
    if (s.gauge >= 1 && s.boostT <= 0 && s.phase === 'go' && Math.abs(SEGS[idx].curve) < 2.5) boost();
    let best = 1, score = Infinity; LANES.forEach((l, k) => { const v = busy[k] * 3 + Math.abs(l - s.x) * 40; if (v < score) { score = v; best = k; } });
    const pct = s.speed / MAX, drift = pct * pct * SEGS[idx].curve * CENT;
    return clamp(((LANES[best] - s.x) * 5 + drift * 1.1) / (STEER * Math.max(0.3, pct)), -1, 1);
  }

  function step(dt) {
    const s = state;
    if (s.phase === 'count') {
      s.countT += dt; const left = 3 - Math.floor(s.countT);
      $('count').textContent = left > 0 ? String(left) : '출발';
      if (s.countT < 3) return;
      s.phase = 'go'; s.goShow = 0.6;
      if (s.launch != null) { if (3 - s.launch <= 0.3) rocket(); else { s.spin = 1.2; pop('헛바퀴…'); } }
    }
    if (s.goShow > 0 && (s.goShow -= dt) <= 0) $('count').textContent = '';
    if (s.phase === 'go') s.time += dt;
    const idx = Math.floor((s.pos + PZ) / SEG), seg = SEGS[idx], key = seg.sec, k = SECS.findIndex(x => x.key === key);
    const pct = s.speed / MAX, v = s.verdict, tier = k < 0 ? 2 : v[key].tier;
    // 조향: 염수 눈길에서 도금재가 없으면 접지가 낮아 늦게 들고 바깥으로 더 밀린다.
    const want = s.bot ? botSteer(s, idx) : (keys.left || [...touches.values()].includes(-1) ? -1 : 0) + (keys.right || [...touches.values()].includes(1) ? 1 : 0);
    s.steer = want;
    const grip = key === 'salt' ? [2.6, 5, 16][tier] : 16, slide = key === 'salt' ? [1.3, 1.2, 1][tier] : key === 'twist' ? [1.45, 1.3, 1][tier] : 1;
    s.vx += (want * STEER * Math.min(1, pct * 1.5) - s.vx) * Math.min(1, grip * dt);
    s.x += s.vx * dt - dt * pct * pct * seg.curve * CENT * slide;
    s.x = clamp(s.x, -2.3, 2.3);
    const off = Math.abs(s.x) > 1 + s.cw * 0.4;
    if (off) s.offT += dt;
    // 속도: 출발하면 자동 가속. 부스트·벽 돌파는 위로, 길 밖·요철(섀시 소재 없음)은 아래로.
    s.boostT = Math.max(0, s.boostT - dt); s.surge = Math.max(0, s.surge - dt);
    let cap = s.phase === 'go' ? MAX : 0;
    const slope = clamp((seg.p2.wy - seg.p1.wy) / SEG, -0.45, 0.45);
    cap *= 1 - slope * (key === 'climb' && slope > 0 ? [1, 0.7, 0.1][tier] : 0.2);   // 급경사 언덕: 구동 소재가 아니면 오르막에서 힘이 빠진다
    if (key === 'speed') cap *= [0.87, 0.97, 1.08][tier];
    if (key === 'twist') cap *= [0.93, 0.95, 1.03][tier];          // 오르막은 조금 느리고 내리막은 조금 빠르다
    // 시험 차량: 추월·스침·슬립스트림·추돌
    const pz = s.pos + PZ; let draft = 0, ahead = s.traffic.filter(c => c.rival && c.gone).length;
    for (const c of s.traffic) {
      if (c.gone) continue;
      const ci = Math.floor(c.z / SEG); if (ci >= SEGS.length - 3) { c.gone = true; continue; }
      if (c.rival && c.z > pz) ahead++;
      const toWall = WALL < 0 ? 1e9 : WALL - ci;
      if (toWall > 0 && toWall < 150) { c.target = c.off < 0 ? -1.7 : 1.7; c.blink = 0; }       // 시험 벽 앞에서는 갓길로 비킨다
      else if (toWall <= 0 && toWall > -40) c.target = LANES[c.lane];
      else if (c.blink > 0) { if ((c.blink -= dt) <= 0) { c.lane = clamp(c.lane + c.dir, 0, 2); c.target = LANES[c.lane]; } }
      else if (laneBlocked(ci, c.lane, 4, 90)) { const opts = [c.lane - 1, c.lane + 1].filter(l => l >= 0 && l <= 2 && !laneBlocked(ci, l, 0, 120) && !mine(c, l)); if (opts.length) { c.dir = opts[ci % opts.length] - c.lane; c.blink = 0.3; } else c.swap = 2; }
      else if (!c.rival && (c.swap -= dt) <= 0) { c.swap = 5 + (ci * 7 % 5); c.dir = c.lane === 0 ? 1 : c.lane === 2 ? -1 : (ci % 2 ? 1 : -1); if (mine(c, c.lane + c.dir)) c.swap = 1; else c.blink = 1; }
      for (const o of SEGS[ci].obs) if (!o.hit && o.kind !== 'drop' && o.kind !== 'slush' && o.kind !== 'pothole' && Math.abs(o.off - c.off) < TCW + 0.08) { o.hit = true; o.fly = 0.001; c.slowT = 0.8; }
      c.slowT = Math.max(0, (c.slowT || 0) - dt);
      c.off += clamp(c.target - c.off, -0.55 * dt, 0.55 * dt);
      c.bumpT = Math.max(0, c.bumpT - dt); c.z += c.v * dt * (c.bumpT > 0 ? 1.3 : c.slowT > 0 ? 0.75 : 1);
      const d = (c.z - pz) / SEG, gapX = Math.abs(s.x - c.off), touch = s.cw + TCW;
      if (c.passed) { if (d > 1.6) c.passed = false; continue; }
      if (d < 1.5 && d > -1.2 && gapX < touch * 0.9) { s.speed = Math.min(s.speed, c.v * 0.8); c.z += SEG * 2.5; c.bumpT = 0.7; s.hits++; s.hitT = 0.6; s.shakeT = 0.25; gain(-0.3); burst(W / 2, H - s.carH * 2, '#f8f8f5', 10); sfx('thud', 0.7); }
      else if (d <= -1.2) { c.passed = true; if (!c.counted) { c.counted = true; s.passes++; gain(0.15); if (gapX < touch + 0.1) graze(); else if (!c.rival) pop('작업 차 통과'); } }
      else if (d > 2 && d < 30 && gapX < 0.2) draft = Math.max(draft, 1 - d / 30);
    }
    // 경쟁 차마다 지금 순위(번호표)와, 바로 앞 순위 차까지의 거리. 1구간 ≈ 0.86m(최고 속도 60구간/초 = 186km/h).
    { const done = s.traffic.filter(c => c.rival && c.gone).length, live = s.traffic.filter(c => c.rival && !c.gone); let near = Infinity;
      for (const c of live) { c.rank = 1 + done + live.filter(o => o.z > c.z).length + (pz > c.z ? 1 : 0); if (c.z > pz) near = Math.min(near, c.z - pz); }
      const text = s.phase !== 'go' ? '' : ahead === 0 ? '선두' : near === Infinity ? ahead + '위 차 도착' : ahead + '위 차까지 ' + Math.max(5, Math.round(near / SEG * 186 / 216 / 5) * 5) + 'm';
      if (text !== s.nextText) { s.nextText = text; $('next').textContent = text; } }
    if (s.phase === 'go' && ahead + 1 !== s.rank) { if (ahead + 1 < s.rank) { pop((ahead + 1) + '위로!'); sfx('chime', 0.3); } s.rank = ahead + 1; $('rank').replaceChildren(String(s.rank), el('small', '', '위/' + (RIVAL_GAP.length + 1))); }
    if (draft > 0 && s.phase === 'go') { cap *= 1 + 0.1 * draft; gain(0.35 * dt); if (s.draftT < 0.4 && s.draftT + dt >= 0.4) { s.drafted++; pop('슬립스트림'); } s.draftT += dt; } else s.draftT = 0;
    if (s.phase === 'go' && pct > 0.9) gain(0.03 * dt);
    s.spin = Math.max(0, s.spin - dt);
    if (s.boostT > 0 || s.surge > 0) cap *= 1.3;
    if (key === 'bumps') cap *= [0.82, 0.91, 1.03][tier];
    if (off) cap = Math.min(cap, MAX * 0.5);
    s.speed = s.speed < cap ? Math.min(cap, s.speed + MAX / (s.boostT > 0 ? 1.5 : s.spin > 0 ? 9 : 3.6) * dt) : Math.max(cap, s.speed - MAX * 0.9 * dt);
    s.pos += s.speed * dt;
    s.skyX += seg.curve * pct * dt * 60; s.hillX += seg.curve * pct * dt * 110;
    s.hitT = Math.max(0, s.hitT - dt); s.shakeT = Math.max(0, s.shakeT - dt);
    // 지나간 구간의 장애물·우박·벽 판정
    const nIdx = Math.floor((s.pos + PZ) / SEG);
    for (let i = s.lastIdx + 1; i <= nIdx && i < SEGS.length; i++) {
      const sg = SEGS[i];
      for (const o of sg.obs) {
        if (o.hit) continue;
        const near = Math.abs(s.x - o.off) < s.cw + o.ww / ROAD / 2 * 0.8;
        if (o.kind === 'drop') {
          o.hit = true; s.drops++;
          if (Math.abs(s.x - o.off) < s.cw + 0.16) {
            if (v.hail.tier === 2) { s.bounced++; gain(0.1); burst(W / 2, H - s.carH * 2, '#e8f3f8', 8, 50); sfx('chime', 0.12); }
            else { s.dents++; s.speed *= v.hail.tier ? 0.8 : 0.6; s.hitT = v.hail.tier ? 0.2 : 0.35; burst(W / 2, H - s.carH * 2, '#e8f3f8', 6, 30); sfx('thud', 0.45); }
          } else o.splash = 0.4;
          continue;
        }
        if (!near) { if (o.kind !== 'slush' && o.kind !== 'pothole' && Math.abs(s.x - o.off) < s.cw + o.ww / ROAD / 2 * 0.8 + 0.13) { o.hit = true; graze(); } continue; }
        o.hit = true; o.fly = 0.001;
        if (o.kind === 'cart') { const tr2 = v.side.tier; s.sideHits++; s.hitT = 0.5;
          if (tr2 === 2) { s.speed *= 0.96; gain(0.2); burst(W / 2, H - s.carH, YEL, 14, 90); sfx('chime', 0.3); pop('대차를 튕겨 냈어요'); }
          else { s.speed *= tr2 ? 0.65 : 0.35; s.vx += (o.from < 0 ? 1 : -1) * (tr2 ? 1.4 : 2.2); s.shakeT = tr2 ? 0.3 : 0.6; s.hits++; gain(-0.3); burst(W / 2, H - s.carH, YEL, 10); sfx('thud', 0.8); }
          continue; }
        if (o.kind === 'slush') { s.speed *= 0.82; burst(W / 2, H - 8, '#c9d4da', 10, 40); }
        else if (o.kind === 'pothole') { s.speed *= 0.72; s.shakeT = 0.3; sfx('thud', 0.35); }
        else { s.speed *= 0.45; s.hits++; s.hitT = 0.6; gain(-0.3); burst(W / 2, H - s.carH, YEL, 10); sfx('thud', 0.7); }
      }
      if (sg.wall && !sg.wall.broken) {
        sg.wall.broken = true;
        if (v.crash.tier === 2) { s.speed = Math.max(s.speed, MAX * 1.1); s.surge = 1.6; s.wall = 'pass'; gain(0.5); burst(W / 2, H * 0.6, YEL, 24, 120); burst(W / 2, H * 0.6, INK, 12, 100); sfx('chime', 0.6); banner('시험 벽 돌파', '실내 공간이 버텼어요 · 가속', 'pass', 1.4); }
        else if (v.crash.tier === 1) { s.speed = Math.min(s.speed, MAX * 0.4); s.shakeT = 0.4; s.hitT = 0.4; s.wall = 'ok'; burst(W / 2, H * 0.6, YEL, 18, 90); sfx('thud', 0.7); banner('시험 벽 통과', '앞이 찌그러져 느려졌어요', 'ok', 1.4); }
        else { s.speed = MAX * 0.12; s.shakeT = 0.6; s.hitT = 0.8; s.wall = 'fair'; burst(W / 2, H * 0.6, YEL, 14, 70); sfx('thud', 0.9); banner('시험 벽에서 멈칫', '실내가 밀렸어요', 'fair', 1.4); }
      }
    }
    s.lastIdx = nIdx;
    // 구간 들어서기(컷인)와 검사 게이트
    STARTS.forEach((st, k2) => {
      if (!s.entered[k2] && nIdx >= st + 6) { s.entered[k2] = true; cutin(k2); }
      if (!s.gated[k2] && nIdx >= st + SEC_N - 1) {
        s.gated[k2] = true; const sec = SECS[k2], r = s.verdict[sec.key];
        s.results.push({sec, ...r}); $('bar').children[k2].className = CLS[r.tier];
        if (!(sec.key === 'crash')) banner(sec.name + ' 검사 · ' + TIER[r.tier], sec.test, CLS[r.tier]);
        gain([0, 0.1, 0.5][r.tier]);
        sfx(r.tier ? 'chime' : 'thud', [0.3, 0.3, 0.5][r.tier]);
      }
    });
    if (s.banner > 0 && (s.banner -= dt) <= 0) $('banner').hidden = true;
    if (s.cut > 0 && (s.cut -= dt) <= 0) $('cutin').hidden = true;
    // 화면 입자: 우박 줄기, 눈송이, 부스트 속도선
    if (!reduced) {
      if (key === 'hail' && Math.random() < dt * 60) s.parts.push({kind: 'hail', x: Math.random() * W, y: -6, v: 260 + Math.random() * 120});
      if (key === 'salt' && Math.random() < dt * 30) s.parts.push({kind: 'snow', x: Math.random() * W, y: -4, v: 30 + Math.random() * 30, ph: Math.random() * 6});
      if ((s.boostT > 0 || s.surge > 0 ? Math.random() < dt * 50 : s.draftT > 0.2 ? Math.random() < dt * 24 : pct > 1.03 && Math.random() < dt * 10)) { const a = Math.random() * Math.PI * 2; s.parts.push({kind: 'line', a, r: 20, v: 400}); }
    }
    s.parts = s.parts.filter(p => { if (p.kind === 'line') { p.r += p.v * dt; return p.r < 220; } p.y += p.v * dt; if (p.kind === 'snow') p.x += Math.sin(s.time * 2 + p.ph) * 12 * dt - s.vx * 20 * dt; return p.y < H; });
    s.fx = s.fx.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; return (p.life -= dt) > 0; });
    for (const sg of SEGS.slice(nIdx - 2, nIdx + DRAW)) for (const o of sg.obs) { if (o.kind === 'cart' && !o.hit && sg.i - nIdx < 95) o.off += clamp(o.to - o.off, -1.5 * dt, 1.5 * dt); if (o.fly) o.fly += dt; if (o.splash) o.splash = Math.max(0, o.splash - dt); }
    // 머리줄
    const ki = clamp(k, 0, 3);
    for (let i = 0; i < 4; i++) { const b = $('bar').children[i]; if (!b.classList.contains('pass') && !b.classList.contains('fair') && !b.classList.contains('ok')) b.className = i === ki && key !== 'lead' ? 'on' : ''; }
    $('clock').textContent = fmt(s.time);
    const where = key === 'lead' ? '출발' : key === 'tail' ? '도착' : SECS[k].name + ' · ' + SECS[k].test;
    if ($('where').textContent !== where) $('where').textContent = where;
    $('spd').textContent = Math.round(s.speed / MAX * 186);
    const full = Math.floor(s.gauge + 1e-6), btn = '부스트 ' + '■'.repeat(full) + '□'.repeat(BAR - full);
    if ($('boost').textContent !== btn) $('boost').textContent = btn;
    $('boost').disabled = !(s.phase === 'count' || s.phase === 'go' && s.gauge >= 1 && s.boostT <= 0);
    if (s.popT > 0 && (s.popT -= dt) <= 0) $('pop').hidden = true;
    s.lift += ((s.boostT > 0 || s.surge > 0 ? 4 : s.draftT > 0.2 ? 2 : s.hitT > 0 ? -3 : 0) - s.lift) * Math.min(1, dt * 8);
    if (s.phase === 'go') {
      const my = s.pos / SEG; while (s.rec.length * REC <= s.time) s.rec.push([+my.toFixed(1), +s.x.toFixed(2)]);
      const gh = s.ghost; while (s.gi < gh.length - 2 && gh[s.gi + 1][0] <= my) s.gi++;
      if ((s.gapT -= dt) <= 0) { s.gapT = 0.1; const a = gh[s.gi][0], b = gh[s.gi + 1][0], tg = (s.gi + (b > a ? clamp((my - a) / (b - a), 0, 1) : 0)) * REC, gap = s.time - tg;
        $('gap').textContent = (gap <= 0 ? '−' : '+') + Math.abs(gap).toFixed(1); $('gap').parentNode.className = 'race-gap ' + (gap <= 0 ? 'ahead' : 'behind'); }
    }
    if (nIdx >= GOAL && s.phase === 'go') finish();
  }

  function project(p, camX, camY, camZ) {
    const cz = p.wz - camZ; p.cz = cz; p.scale = DEPTH / cz;
    p.sx = Math.round(W / 2 - p.scale * camX * W / 2); p.sy = Math.round(H / 2 - p.scale * (p.wy - camY) * H / 2); p.sw = Math.round(p.scale * ROAD * W / 2);
  }
  function quad(col, x1, y1, w1, x2, y2, w2) { g.fillStyle = col; g.beginPath(); g.moveTo(x1 - w1, y1); g.lineTo(x2 - w2, y2); g.lineTo(x2 + w2, y2); g.lineTo(x1 + w1, y1); g.fill(); }
  function drawSprite(img, scale, x, y, ww, offX, clipY, lift = 0) {
    const dw = ww * scale * W / 2, dh = dw * img.height / img.width; if (dw < 0.6 || dw > W * 3) return;
    const dx = x + dw * offX, dy = y - dh - lift * scale * W / 2;
    const cut = clipY ? Math.max(0, dy + dh - clipY) : 0; if (cut >= dh) return;
    g.drawImage(img, 0, 0, img.width, img.height * (1 - cut / dh), Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh - cut));
  }
  function draw() {
    const s = state, base = Math.floor(s.pos / SEG), basePct = (s.pos % SEG) / SEG;
    const pIdx = Math.floor((s.pos + PZ) / SEG), pSeg = SEGS[pIdx], pPct = ((s.pos + PZ) % SEG) / SEG;
    const playerY = pSeg.p1.wy + (pSeg.p2.wy - pSeg.p1.wy) * pPct, th = THEME[pSeg.sec];
    // 요철: 섀시 소재가 맞으면 잔잔하게, 아니면 크게 흔들린다(차급의 흔들림 배율 포함).
    let shakeY = 0, shakeX = 0;
    if (!reduced) {
      if (pSeg.sec === 'bumps') { const amp = [2.8, 1.5, 0.7][s.verdict.bumps.tier] * s.trait.shake * (s.speed / MAX); shakeY = Math.sin(s.time * 38) * amp + Math.sin(s.time * 23) * amp * 0.5; }
      if (pSeg.sec === 'speed' && s.verdict.speed.tier === 0) shakeY += Math.sin(s.time * 60) * 1.2 * (s.speed / MAX);
      if (pSeg.sec === 'twist' && s.verdict.twist.tier === 0) shakeX += Math.sin(s.time * 9) * 1.5 * (s.speed / MAX);
      if (s.shakeT > 0) { shakeX = (Math.random() - 0.5) * 6 * s.shakeT / 0.6; shakeY += (Math.random() - 0.5) * 4; }
      if (Math.abs(s.x) > 1 + s.cw * 0.4 && s.speed > 0) shakeY += (Math.random() - 0.5) * 2;
    }
    g.save(); g.translate(Math.round(shakeX), Math.round(shakeY));
    drawBg(g, th, pSeg.sec === 'tail' ? SECS[SECS.length - 1].key : pSeg.sec, s.skyX, s.hillX, s.horizon, s.time);
    g.fillStyle = th.grass[0]; g.fillRect(-8, s.horizon, W + 16, H - s.horizon + 8);
    let maxy = H, x = 0, dx = -(SEGS[base].curve * basePct), top = H;
    for (let n = 0; n < DRAW; n++) {
      const sg = SEGS[base + n]; if (!sg) break;
      sg.clip = maxy;
      project(sg.p1, s.x * ROAD - x, playerY + CAM_H, s.pos);
      project(sg.p2, s.x * ROAD - x - dx, playerY + CAM_H, s.pos);
      x += dx; dx += sg.curve;
      sg.vis = !(sg.p1.cz <= DEPTH || sg.p2.sy >= sg.p1.sy || sg.p2.sy >= maxy);
      if (!sg.vis) continue;
      const t = THEME[sg.sec], alt = Math.floor(sg.i / 3) % 2, p1 = sg.p1, p2 = sg.p2;
      g.fillStyle = t.grass[alt]; g.fillRect(-8, p2.sy, W + 16, p1.sy - p2.sy);
      const r1 = p1.sw / 6, r2 = p2.sw / 6;
      quad(t.rumble[alt], p1.sx - p1.sw - r1 / 2, p1.sy, r1 / 2, p2.sx - p2.sw - r2 / 2, p2.sy, r2 / 2);
      quad(t.rumble[alt], p1.sx + p1.sw + r1 / 2, p1.sy, r1 / 2, p2.sx + p2.sw + r2 / 2, p2.sy, r2 / 2);
      quad(t.road[alt], p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw);
      if (sg.line) for (let c = 0; c < 8; c++) { // 출발·도착 체크무늬
        const a = -1 + c / 4, b = a + 0.25; g.fillStyle = c % 2 === alt ? '#f8f8f5' : INK; g.beginPath();
        g.moveTo(p1.sx + a * p1.sw, p1.sy); g.lineTo(p2.sx + a * p2.sw, p2.sy); g.lineTo(p2.sx + b * p2.sw, p2.sy); g.lineTo(p1.sx + b * p1.sw, p1.sy); g.fill();
      } else if (alt) for (const l of [-1 / 3, 1 / 3]) { const lw1 = Math.max(0.5, p1.sw / 40), lw2 = Math.max(0.5, p2.sw / 40); quad(t.lane, p1.sx + l * p1.sw, p1.sy, lw1, p2.sx + l * p2.sw, p2.sy, lw2); }
      if (sg.sec === 'bumps' && sg.i % 6 === 0) quad('rgba(20,24,29,.25)', p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw);
      const fog = Math.min(0.85, (n / DRAW) ** 2 * 1.4); if (fog > 0.02) { g.globalAlpha = fog; g.fillStyle = t.fog; g.fillRect(-8, p2.sy, W + 16, p1.sy - p2.sy); g.globalAlpha = 1; }
      maxy = p2.sy; top = Math.min(top, p2.sy);
    }
    s.horizon += (clamp(top, H * 0.3, H * 0.62) - s.horizon) * 0.2;
    // 움직이는 차(시험 차량·고스트)를 구간별로 모은다
    const movers = new Map(), late = [];
    const mover = (z, off, img, alpha, blink, tag) => { const i = Math.floor(z / SEG) - base; if (i < 0 || i >= DRAW - 1) return; (movers.get(i) || movers.set(i, []).get(i)).push({cz: z - s.pos, off, img, alpha, blink, tag}); };
    for (const c of s.traffic) if (!c.gone) mover(c.z, c.off, TSPR[c.spr], 1, c.blink > 0 && Math.floor(s.time * 6) % 2 ? c.dir : 0, c.rival && c.rank && s.phase === 'go' ? c.rank + '위' : '');
    if (s.phase === 'go') { const gt = s.time / REC, a = s.ghost[Math.min(s.ghost.length - 1, Math.floor(gt))], b = s.ghost[Math.min(s.ghost.length - 1, Math.floor(gt) + 1)], f = gt % 1; mover((a[0] + (b[0] - a[0]) * f) * SEG + PZ, a[1] + (b[1] - a[1]) * f, s.gspr, 0.5, 0); }
    const drawMover = (sg, m) => {
      const sc = DEPTH / m.cz, u = clamp((sc - sg.p1.scale) / ((sg.p2.scale - sg.p1.scale) || 1), 0, 1), sx = sg.p1.sx + (sg.p2.sx - sg.p1.sx) * u, sy = sg.p1.sy + (sg.p2.sy - sg.p1.sy) * u, ox = sx + sc * m.off * ROAD * W / 2;
      g.globalAlpha = m.alpha; drawSprite(m.img, sc, ox, sy, TWW, -0.5, sg.clip);
      if (m.blink) { g.save(); if (m.blink > 0) { g.translate(Math.round(ox) * 2, 0); g.scale(-1, 1); } drawSprite(BLINK, sc, ox, sy, TWW, -0.5, sg.clip); g.restore(); }
      g.globalAlpha = 1;
      // 순위에 들어가는 경쟁 차에만 번호표. 너무 멀어 글자가 뭉개지는 크기에서는 그리지 않는다.
      if (m.tag) { const dw = TWW * sc * W / 2, ty = Math.round(sy - dw * m.img.height / m.img.width) - 11; if (dw >= 9 && ty > 0 && !(sg.clip && ty + 9 > sg.clip)) { g.font = '700 8px "Noto Sans KR",system-ui,sans-serif'; const tw = Math.round(g.measureText(m.tag).width) + 5, tx = Math.round(ox - tw / 2); g.fillStyle = INK; g.fillRect(tx, ty, tw, 9); g.fillStyle = '#f8f8f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.tag, tx + tw / 2, ty + 5); } }
    };
    // 먼 것부터 가까운 것 순으로 길가 물체·장애물·게이트
    for (let n = DRAW - 1; n > 0; n--) {
      const sg = SEGS[base + n]; if (!sg || sg.p1.cz <= DEPTH) continue;
      const p = sg.p1, sc = p.scale, rx = off => p.sx + sc * off * ROAD * W / 2;
      for (const sp of sg.sprites) drawSprite(sp.img, sc, rx(sp.off), p.sy, sp.ww, sp.off < 0 ? -1 : 0, sg.clip);
      for (const o of sg.obs) {
        const ox = rx(o.off);
        if (o.kind === 'drop') { // 우박: 길 위 그림자가 짙어지고, 가까워지면 얼음덩이가 떨어진다
          if (o.hit) { if (o.splash && sg.vis) { g.fillStyle = 'rgba(232,243,248,.8)'; g.fillRect(Math.round(ox - 4), p.sy - 2, 8, 2); } continue; }
          if (!sg.vis) continue;
          const near = clamp(1 - (n - 4) / 70, 0, 1), rw = Math.max(1, sc * o.ww * W / 4);
          g.fillStyle = 'rgba(20,24,29,' + (0.15 + near * 0.45).toFixed(2) + ')'; g.beginPath(); g.ellipse(ox, p.sy, rw, Math.max(0.6, rw * 0.28), 0, 0, 7); g.fill();
          if (n < 60) drawSprite(SPR.stone, sc, ox, p.sy, 240, -0.5, 0, n * 70);
          continue;
        }
        if (o.kind === 'slush' || o.kind === 'pothole') {
          if (!sg.vis) continue; const rw = Math.max(1, sc * o.ww * W / 4);
          g.fillStyle = o.kind === 'slush' ? 'rgba(120,138,150,.75)' : 'rgba(30,26,22,.8)'; g.beginPath(); g.ellipse(ox, p.sy, rw, Math.max(0.6, rw * 0.3), 0, 0, 7); g.fill();
          continue;
        }
        if (o.fly) { if (o.fly < 0.5) drawSprite(SPR[o.kind], sc, ox + (o.off > s.x ? 1 : -1) * o.fly * 260, p.sy, o.ww, -0.5, 0, o.fly * 3000); continue; }
        drawSprite(SPR[o.kind], sc, ox, p.sy, o.ww, -0.5, sg.clip);
      }
      for (const m of movers.get(n) || []) { if (m.cz < PZ) late.push([sg, m]); else if (m.cz > DEPTH * 40) drawMover(sg, m); }
      if (sg.wall && !sg.wall.broken) { // 충돌 시험 벽: 노랑·먹 줄무늬 판
        const wl = p.sx - p.sw * 1.05, wr = p.sx + p.sw * 1.05, wh = sc * 520 * W / 2, top2 = p.sy - wh, st = Math.max(2, (wr - wl) / 14);
        for (let xx = wl, i = 0; xx < wr; xx += st, i++) { g.fillStyle = i % 2 ? INK : YEL; g.fillRect(Math.round(xx), Math.round(top2), Math.ceil(st), Math.round(Math.min(wh, sg.clip - top2))); }
      }
      if (sg.gate != null) { // 검사 게이트: 양쪽 기둥과 줄무늬 띠, 구간 이름
        const lx = p.sx - p.sw * 1.12, rx2 = p.sx + p.sw * 1.12, ph = sc * 1500 * W / 2, pw = Math.max(1, sc * 90 * W / 2), bh = Math.max(1, sc * 260 * W / 2), by = p.sy - ph;
        if (by < sg.clip) {
          g.fillStyle = INK; g.fillRect(Math.round(lx - pw), Math.round(by), Math.round(pw), Math.round(Math.min(ph, sg.clip - by))); g.fillRect(Math.round(rx2), Math.round(by), Math.round(pw), Math.round(Math.min(ph, sg.clip - by)));
          const st = Math.max(2, (rx2 - lx) / 20); for (let xx = lx, i = 0; xx < rx2; xx += st, i++) { g.fillStyle = i % 2 ? INK : YEL; g.fillRect(Math.round(xx), Math.round(by), Math.ceil(st), Math.round(bh)); }
          if (bh >= 9) { const name = sg.gate === 'goal' ? '도착' : SECS[sg.gate].name + ' 검사'; g.font = '700 ' + Math.min(14, Math.round(bh * 0.7)) + 'px "Noto Sans KR",system-ui,sans-serif'; const tw = g.measureText(name).width + 8; g.fillStyle = '#f8f8f5'; g.fillRect(Math.round(p.sx - tw / 2), Math.round(by), Math.round(tw), Math.round(bh)); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, p.sx, by + bh / 2 + 1); }
        }
      }
    }
    // 내 차
    const lean = s.steer > 0.2 ? 1 : s.steer < -0.2 ? -1 : 0, flash = s.hitT > 0 && Math.floor(s.time * 16) % 2 === 0;
    carG.clearRect(0, 0, carCv.width, carCv.height); paintRear(carG, s.fw, s.color, s.spec, {lean: lean * 2, dents: Math.min(8, s.dents), flash, boost: s.boostT > 0 || s.surge > 0});
    const bounce = !reduced && pSeg.sec === 'bumps' ? Math.round(Math.abs(Math.sin(s.time * 19)) * [2, 1.2, 0.6][s.verdict.bumps.tier] * s.trait.shake) : 0;
    g.drawImage(carCv, Math.round(W / 2 - s.carW), H - s.fh - 6 - bounce - Math.round(reduced ? 0 : s.lift));
    for (const [sg, m] of late) if (m.cz > PZ * 0.45 && m.alpha === 1) drawMover(sg, m);       // 방금 추월한 차는 내 차보다 앞(화면 쪽)에 그린다
    // 입자
    for (const p of s.parts) {
      if (p.kind === 'hail') { g.fillStyle = 'rgba(240,248,252,.85)'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 4); }
      else if (p.kind === 'snow') { g.fillStyle = '#ffffff'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
      else { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2 + Math.cos(p.a) * p.r, H * 0.45 + Math.sin(p.a) * p.r * 0.6); g.lineTo(W / 2 + Math.cos(p.a) * (p.r + 18), H * 0.45 + Math.sin(p.a) * (p.r + 18) * 0.6); g.stroke(); }
    }
    for (const p of s.fx) { g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.sz), Math.ceil(p.sz)); }
    if (s.hitT > 0 && pSeg.sec === 'hail' && !reduced) { g.fillStyle = 'rgba(255,255,255,' + (s.hitT * 0.5).toFixed(2) + ')'; g.fillRect(0, 0, W, H); }
    g.restore();
    // 부스트 게이지(세 칸)
    for (let i = 0; i < BAR; i++) { const x0 = 6 + i * 17, f = clamp(s.gauge - i, 0, 1); g.fillStyle = INK; g.fillRect(x0, H - 11, 16, 7); g.fillStyle = '#3a4149'; g.fillRect(x0 + 1, H - 10, 14, 5); g.fillStyle = f >= 1 ? YEL : '#b98a00'; g.fillRect(x0 + 1, H - 10, Math.round(14 * f), 5); }
  }
  function loop(now) {
    const s = state; if (!s) return;
    const dt = Math.min(0.05, s.last ? (now - s.last) / 1000 : 0); s.last = now;
    if (!s.paused) step(dt);
    if (state) draw();
    if (state && state.phase !== 'done') raf = requestAnimationFrame(loop);
  }
  function boost() {
    const s = state; if (!s || s.paused) return;
    if (s.phase === 'count') { if (s.launch == null) s.launch = s.countT; return; }     // 출발 신호에 맞추면 로켓 출발, 너무 이르면 헛바퀴
    if (s.phase !== 'go') return;
    if (s.time < 0.3 && !s.launched && s.launch == null) { s.launch = 3; rocket(); return; }
    if (s.gauge < 1 || s.boostT > 0) return;
    s.gauge -= 1; s.boosts++; s.boostT = BOOST_T; sfx('chime', 0.35);
  }
  const DID = {
    hail: (s, t) => t === 2 ? '우박 ' + s.bounced + '번을 맞고도 모두 튕겨 냈어요.' : s.dents ? '우박에 ' + s.dents + '번 패여 그때마다 ' + (t ? '조금 ' : '') + '느려졌어요.' : '우박 그림자를 모두 피해 패인 곳이 없어요.',
    salt: (s, t) => ['접지가 낮아 핸들이 늦게 들고 바깥으로 밀렸어요.', '핸들이 조금 늦게 들었어요.', '눈길에서도 핸들이 바로 들었어요.'][t],
    crash: s => s.wall === 'pass' ? '시험 벽을 뚫고 나가며 다시 가속했어요.' : s.wall === 'ok' ? '시험 벽을 넘었지만 속도가 줄었어요.' : '시험 벽 앞에서 거의 멈췄다가 다시 출발했어요.',
    side: (s, t) => !s.sideHits ? '튀어나온 대차를 모두 피했어요.' : t === 2 ? '대차에 ' + s.sideHits + '번 받히고도 튕겨 냈어요.' : '대차에 ' + s.sideHits + '번 받혀 ' + (t ? '조금' : '크게') + ' 밀렸어요.',
    twist: (s, t) => ['굽은 길마다 바깥으로 크게 밀렸어요.', '굽은 길에서 밀려 속도를 조금 잃었어요.', '굽은 길을 단단하게 돌며 속도를 3% 더 냈어요.'][t],
    bumps: (s, t) => ['흔들림이 커서 최고 속도를 82%까지만 냈어요.', '조금 흔들려 최고 속도를 91%까지 냈어요.', '요철에서도 흔들림이 적고 최고 속도를 3% 더 냈어요.'][t],
    climb: (s, t) => ['오르막마다 속도가 크게 떨어졌어요.', '오르막에서 속도가 조금 떨어졌어요.', '오르막에서도 속도를 지켰어요.'][t],
    speed: (s, t) => ['바퀴가 떨려 최고 속도를 87%까지만 냈어요.', '최고 속도를 97%까지 냈어요.', '최고 속도를 8% 더 냈어요.'][t]
  };

  // ── 주행 시작·멈춤·끝 ──
  function showPane(name) { for (const id of ['setup', 'run', 'result']) $(id).hidden = id !== name; dialog.dataset.pane = name; }
  function start() {
    cancelAnimationFrame(raf);
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    state = newRun();
    $('hud-car').src = carImg(state.car.key);
    for (const b of $('bar').children) b.className = '';
    $('banner').hidden = true; $('paused').hidden = true; $('cutin').hidden = true; $('pop').hidden = true; $('count').textContent = '';
    $('rank').replaceChildren(String(state.rank), el('small', '', '위/' + (RIVAL_GAP.length + 1)));
    $('gap').textContent = '±0.0'; $('gap').parentNode.className = 'race-gap'; $('gap-of').textContent = state.ghostMine ? '내 최고 기록' : '금 페이스';
    $('where').textContent = '출발 준비';
    showPane('run');
    $('stage').focus({preventScroll: true});
    raf = requestAnimationFrame(loop);
  }
  function pause(on) {
    const s = state; if (!s || s.phase === 'done') return;
    s.paused = on; s.last = 0; $('paused').hidden = !on; touches.clear(); keys.left = keys.right = false;
    if (on) $('resume').focus({preventScroll: true}); else $('stage').focus({preventScroll: true});
  }
  function finish() {
    const s = state; s.phase = 'done'; cancelAnimationFrame(raf);
    const total = s.time, medal = medalOf(total);
    s.rec.push([+(s.pos / SEG).toFixed(1), +s.x.toFixed(2)]);
    const saved = s.bot ? null : store.record(s.car.key, COURSE.key, total, s.rec);
    const before = s.best?.t ?? null;
    $('pop').hidden = true;
    $('sheet-title').textContent = COURSE.name + ' · ' + s.car.tag + ' · ' + s.car.body;
    $('total').textContent = fmt(total);
    $('detail').textContent = '순위 ' + s.rank + '위/' + (RIVAL_GAP.length + 1) + '대 · 추월 ' + s.passes + '대 · 스침 ' + s.grazes + '번 · 슬립스트림 ' + s.drafted + '번 · 부스트 ' + s.boosts + '번' + (s.launched ? ' · 로켓 출발' : '') + ' · 부딪힘 ' + s.hits + '번 · 길 밖 ' + s.offT.toFixed(1) + '초';
    $('medal').replaceChildren(MEDAL_TEXT[medal], el('small', '', medal.toUpperCase() + ' · 소재 ' + s.results.reduce((a, r) => a + r.tier, 0) + '/8'));
    $('medal').dataset.medal = medal;
    $('lines').replaceChildren(...s.results.map(r => { const li = el('li'); li.append(el('b', '', r.sec.name + ' — ' + r.sec.test), el('i', CLS[r.tier], TIER[r.tier]), el('p', 'did', DID[r.sec.key](s, r.tier)), el('p', '', r.reason)); return li; }));
    $('best').textContent = s.bot ? '자동 조향 기록은 저장하지 않습니다.'
      : !saved.ok ? '기록을 저장하지 못했어요. 이 기기의 저장 공간을 확인해 주세요.'
      : before == null ? '이 차로 이 코스를 달린 첫 기록입니다.'
      : saved.improved ? '최고 기록을 ' + (before - total).toFixed(1) + '초 줄였어요. (이전 ' + fmt(before) + ')'
      : '이 차의 이 코스 최고 기록: ' + fmt(before);
    showPane('result'); $('sheet-title').focus({preventScroll: true});
    sfx('car', 0.7);
  }
  function toSetup(focus) { cancelAnimationFrame(raf); state = null; renderSetup(); showPane('setup'); (focus ? $(focus) : $('start')).focus({preventScroll: true}); }

  // ── 준비 화면: 코스와 보강 소재 ──
  const slotName = sec => SLOTS.find(s => s.key === sec.slot).name + (sec.also ? '·' + SLOTS.find(s => s.key === sec.also).name : '');
  const slotTests = key => SECS.filter(s => s.slot === key || s.also === key).map(s => s.name).join(' · ') || '이 코스에서는 쉬어요';
  const mark = medal => { const m = el('span', 'race-mark', medal ? MEDAL_TEXT[medal] : '–'); m.dataset.medal = medal || 'none'; return m; };
  function renderSetup() {
    const car = data.cars.find(c => c.key === carKey), have = owned();
    for (const s of SLOTS) if (PICKS[s.key] && !have[PICKS[s.key]]) PICKS[s.key] = '';       // 더는 도감에 없는 카드는 뺀다(진행 초기화 뒤)
    $('car-art').src = carImg(carKey);
    $('title').textContent = car.tag + ' · ' + car.body;
    $('trait').textContent = carTrait(car.body).note;
    $('courses').replaceChildren(...COURSES.map(co => {
      const best = store.best(carKey, co.key), on = co === COURSE;
      const b = button('', 'race-course', () => { COURSE = co; SECS = co.secs.map(k => SECTION[k]); renderSetup(); $('courses').querySelector('[aria-checked="true"]').focus({preventScroll: true}); });
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.dataset.course = co.key;
      const list = el('span', 'race-secs'); for (const k of co.secs) { const chip = el('span', '', SECTION[k].name); chip.append(el('i', '', slotName(SECTION[k]))); list.append(chip); }
      const rec = el('span', 'race-rec'); rec.append(mark(best ? best.medal : ''), el('span', '', best ? fmt(best.t) : '기록 없음'));
      b.append(el('strong', '', co.name), el('small', '', co.note), list, rec);
      b.setAttribute('aria-label', co.name + ' · ' + co.secs.map(k => SECTION[k].name).join(', ') + ' · ' + (best ? '최고 기록 ' + fmt(best.t) + ' ' + MEDAL_TEXT[best.medal] + '메달' : '기록 없음'));
      return b;
    }));
    $('slots').replaceChildren(...SLOTS.map(slot => {
      const c = pickCard(PICKS[slot.key]), row = el('div', 'race-slot'), text = el('div');
      const pic = el('span', 'race-thumb'); if (c) { const im = el('img'); im.alt = ''; im.src = thumb(c.id); pic.append(im); }
      text.append(el('b', '', slot.name + ' 칸 · ' + label(c)), el('span', '', slotTests(slot.key)));
      const pick = tagged(button(c ? '바꾸기' : '고르기', 'secondary race-pick', () => openPicker(slot.key)), 'pick-' + slot.key);
      pick.setAttribute('aria-label', slot.name + ' 칸 소재 ' + (c ? '바꾸기 · 지금 ' + label(c) : '고르기 · 지금 표준 강판'));
      row.append(pic, text, pick); return row;
    }));
    cache.delete('pick-body'); cache.delete('pick-frame'); cache.delete('pick-chassis');
  }
  function openPicker(slotKey) {
    picking = slotKey;
    const slot = SLOTS.find(s => s.key === slotKey), have = owned(), box = $('picker'), inner = el('div', 'race-picker-body');
    const cards = data.cards.filter(c => c.family !== 'qp' || have[c.id]), count = cards.filter(c => have[c.id]).length;
    const title = el('h3', '', slot.name + ' 칸에 꽂을 소재'); title.tabIndex = -1; title.id = 'race-picker-title';
    inner.append(title, el('p', 'muted', slotTests(slotKey) + ' · 도감에 있는 소재 ' + count + '종 가운데 고릅니다. 재고는 쓰지 않습니다.'));
    for (const fam of [...new Set(cards.map(c => c.family))]) {
      const group = cards.filter(c => c.family === fam), grid = el('div', 'race-tiles');
      inner.append(el('h4', '', group[0].familyName + ' · ' + group[0].familyKind));
      for (const c of group) {
        const has = !!have[c.id], b = button('', 'race-tile' + (PICKS[slotKey] === c.id ? ' on' : ''), () => { if (!has) return; PICKS[slotKey] = c.id; closePicker(); });
        if (has) { const im = el('img'); im.alt = ''; im.loading = 'lazy'; im.src = thumb(c.id); b.append(im, el('span', '', c.grade)); b.setAttribute('aria-label', label(c) + ' · ' + c.use + (PICKS[slotKey] === c.id ? ' · 지금 꽂은 소재' : '')); b.dataset.card = c.id; }
        else { b.append(el('span', 'race-unknown', '?'), el('span', '', '미발견')); b.setAttribute('aria-label', '아직 발견하지 않은 소재'); b.setAttribute('aria-disabled', 'true'); b.classList.add('locked'); }
        grid.append(b);
      }
      inner.append(grid);
    }
    const acts = el('div', 'race-picker-acts');
    acts.append(button('표준 강판으로 (꽂지 않음)', 'secondary', () => { PICKS[slotKey] = ''; closePicker(); }), button('돌아가기', 'secondary', () => closePicker()));
    box.replaceChildren(inner, acts); box.hidden = false; $('setup').inert = true;
    title.focus({preventScroll: true});
  }
  function closePicker() {
    const slotKey = picking; picking = '';
    $('picker').hidden = true; $('picker').replaceChildren(); $('setup').inert = false;
    renderSetup(); $('pick-' + slotKey)?.focus({preventScroll: true});
  }

  // ── 창 만들기(한 번) ──
  function build() {
    const close = button('닫기', 'close-button', () => dialog.close());
    const head = el('div', 'dialog-head'), lab = el('span', 'dialog-label'); lab.append(micro('ROAD TEST'), '주행 시험장'); head.append(lab, close);
    // 준비
    const setup = tagged(el('section', 'race-setup'), 'setup');
    const top = el('div', 'race-car'), carArt = tagged(el('img'), 'car-art'), names = el('div'); carArt.alt = '';
    const title = tagged(el('h2'), 'title'); title.id = 'race-title'; title.tabIndex = -1;
    names.append(el('p', 'section-label', '시험할 차'), title, tagged(el('p', 'muted'), 'trait')); top.append(carArt, names);
    const courses = tagged(el('div', 'race-courses'), 'courses'); courses.setAttribute('role', 'radiogroup'); courses.setAttribute('aria-label', '코스');
    const go = el('div', 'race-go'); go.append(tagged(button('출발', 'primary', start), 'start'), el('p', 'muted', '조향: ← → 또는 A·D, 화면 왼쪽·오른쪽을 누르고 있기. 부스트: 스페이스·↑·W(게이지 한 칸). 멈춤: Esc·P. "출발"에 맞춰 부스트를 누르면 로켓 출발.'));
    setup.append(top, el('h3', '', '코스'), courses, el('h3', '', '보강 소재'), el('p', 'muted', '칸마다 도감에 있는 소재 한 장을 꽂습니다. 재고는 쓰지 않습니다. 구간에 들어서면 그 칸의 소재가 최적 · 통함 · 보통 가운데 무엇인지 알려 줍니다.'), tagged(el('div', 'race-slots'), 'slots'), go);
    const picker = tagged(el('section', 'race-picker'), 'picker'); picker.hidden = true; picker.setAttribute('aria-labelledby', 'race-picker-title');
    // 주행
    const run = tagged(el('section', 'race-run'), 'run'); run.hidden = true; run.setAttribute('aria-label', '주행');
    const hud = el('div', 'race-hud'), hudCar = tagged(el('img'), 'hud-car'), now = el('p', 'race-now'), gap = el('p', 'race-gap'), spd = el('p', 'race-spd'); hudCar.alt = '';
    const where = tagged(el('span', '', '출발 준비'), 'where'); where.setAttribute('role', 'status');
    now.append(tagged(el('b', '', '0:00.0'), 'clock'), where);
    gap.setAttribute('aria-hidden', 'true'); gap.append(tagged(el('b', '', '±0.0'), 'gap'), tagged(el('small', '', '금 페이스'), 'gap-of'));
    spd.setAttribute('aria-hidden', 'true'); spd.append(tagged(el('b', '', '0'), 'spd'), el('small', '', 'KM/H'));
    const pauseBtn = tagged(button('Ⅱ', 'secondary race-pause', () => pause(true)), 'pause'); pauseBtn.setAttribute('aria-label', '멈춤');
    hud.append(hudCar, now, gap, spd, pauseBtn);
    const bar = tagged(el('div', 'race-bar'), 'bar'); bar.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 4; i++) bar.append(el('i'));
    const stage = tagged(el('div', 'race-stage'), 'stage'); stage.tabIndex = -1;
    cv = tagged(el('canvas'), 'cv'); cv.width = W; cv.height = H; cv.setAttribute('aria-label', '뒤에서 따라가는 도로. 좌우로 조향해 장애물을 피하고 앞차를 추월합니다.'); cv.setAttribute('role', 'img');
    g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const cut = tagged(el('div', 'race-cutin'), 'cutin'), cutImg = tagged(el('img'), 'cut-img'), cutText = el('p'); cut.hidden = true; cut.setAttribute('role', 'status'); cutImg.alt = '';
    cutText.append(tagged(el('em'), 'cut-tag'), tagged(el('b'), 'cut-title'), tagged(el('span'), 'cut-line')); cut.append(cutImg, cutText);
    const rank = tagged(el('p', 'race-rank'), 'rank'), next = tagged(el('p', 'race-next'), 'next'), popN = tagged(el('p', 'race-pop'), 'pop'), count = tagged(el('p', 'race-count'), 'count'), ban = tagged(el('p', 'race-banner'), 'banner');
    rank.setAttribute('aria-hidden', 'true'); next.setAttribute('aria-hidden', 'true'); popN.setAttribute('aria-hidden', 'true'); popN.hidden = true; count.setAttribute('aria-live', 'assertive'); ban.hidden = true; ban.setAttribute('role', 'status');
    const paused = tagged(el('div', 'race-paused'), 'paused'); paused.hidden = true;
    paused.append(el('b', '', '멈춤'), tagged(button('계속 달리기', 'primary', () => pause(false)), 'resume'), button('처음부터', 'secondary', start), button('준비 화면으로', 'secondary', () => toSetup()));
    stage.append(cv, cut, rank, next, popN, count, ban, paused);
    const pads = el('div', 'race-pads'), left = tagged(button('◀', 'secondary', () => {}), 'left'), right = tagged(button('▶', 'secondary', () => {}), 'right'), boostBtn = tagged(button('부스트', 'primary', boost), 'boost');
    left.setAttribute('aria-label', '왼쪽으로 조향(누르고 있기)'); right.setAttribute('aria-label', '오른쪽으로 조향(누르고 있기)');
    pads.append(left, boostBtn, right);
    run.append(hud, bar, stage, pads);
    // 성적서
    const result = tagged(el('section', 'race-result'), 'result'); result.hidden = true; result.setAttribute('aria-labelledby', 'race-sheet-title');
    const sheet = el('div', 'race-sheet'), sh = el('header'), st = tagged(el('b'), 'sheet-title'); st.id = 'race-sheet-title'; st.tabIndex = -1;
    sh.append(micro('ROAD TEST REPORT'), el('span', 'race-sheet-label', '주행 시험 성적서'), st);
    const time = el('div', 'race-time'); time.append(tagged(el('b'), 'total'), tagged(el('span'), 'detail'));
    const acts = el('div', 'race-acts');
    acts.append(tagged(button('다시 달리기', 'primary', start), 'again'), button('코스·소재 바꾸기', 'secondary', () => toSetup()), button('차 상세로', 'secondary', () => dialog.close()));
    sheet.append(sh, tagged(el('div', 'race-medal'), 'medal'), time, tagged(el('ul', 'race-lines'), 'lines'), tagged(el('p', 'race-best'), 'best'), acts);
    result.append(sheet);
    dialog.replaceChildren(head, setup, picker, run, result);
    // 누르고 있는 동안 조향: 버튼·화면 반쪽 모두 손가락(pointerId)마다 방향을 기억한다.
    const hold = (node, dirOf) => {
      node.addEventListener('pointerdown', e => { e.preventDefault(); touches.set(e.pointerId, dirOf(e)); node.setPointerCapture?.(e.pointerId); if (node.tagName === 'BUTTON') node.classList.add('down'); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(ev, e => { touches.delete(e.pointerId); node.classList.remove('down'); });
      node.addEventListener('contextmenu', e => e.preventDefault());
    };
    hold(left, () => -1); hold(right, () => 1);
    hold(cv, e => { const r = cv.getBoundingClientRect(); return e.clientX - r.left < r.width / 2 ? -1 : 1; });
    built = true;
  }
  const running = () => !!state && state.phase !== 'done' && dialog.dataset.pane === 'run';
  const KEYMAP = {ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right'};
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape' && picking) { e.preventDefault(); closePicker(); return; }
    if (!running()) return;
    if (KEYMAP[e.key]) { e.preventDefault(); keys[KEYMAP[e.key]] = true; }
    else if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key) && e.target.tagName !== 'BUTTON') { e.preventDefault(); boost(); }
    else if (['Escape', 'p', 'P'].includes(e.key)) { e.preventDefault(); pause(!state.paused); }
  });
  dialog.addEventListener('keyup', e => { if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false; });
  // Esc가 창을 닫으려 할 때: 소재 창이 열려 있으면 그것만 닫고, 달리는 중이면 닫지 않고 멈춘다.
  dialog.addEventListener('cancel', e => { if (picking) { e.preventDefault(); closePicker(); } else if (running()) { e.preventDefault(); if (!state.paused) pause(true); } });
  dialog.addEventListener('close', () => {
    cancelAnimationFrame(raf); state = null; picking = '';
    const closed = carKey; carKey = '';
    if (built) { $('picker').hidden = true; $('setup').inert = false; }
    onDismiss(closed);
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; touches.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running() && !state.paused) pause(true); });

  raceProbe.state = () => state && {course: COURSE.key, car: state.car.key, phase: state.phase, paused: state.paused, time: state.time, idx: Math.floor((state.pos + PZ) / SEG), goal: GOAL, x: state.x, speed: state.speed / MAX,
    gauge: state.gauge, rank: state.rank, next: state.nextText, rivals: state.traffic.filter(c => c.rival).map(c => c.gone ? 0 : c.rank), passes: state.passes, hits: state.hits, boosts: state.boosts, tiers: SECS.map(sec => state.verdict[sec.key].tier), results: state.results.map(r => r.tier), bot: state.bot};
  raceProbe.advance = (sec = 1, {auto = false} = {}) => {
    if (!state) return null;
    if (auto) state.bot = true;
    state.paused = false; $('paused').hidden = true;
    for (let i = 0; i < sec * 60 && state && state.phase !== 'done'; i++) step(1 / 60);
    if (state && state.phase !== 'done') draw();
    return raceProbe.state();
  };

  return {
    // 보유한 차만 연다. 열면 준비 화면부터.
    open(key) {
      if (!data.cars.some(c => c.key === key)) return false;
      if (!built) build();
      carKey = key; state = null;
      renderSetup(); showPane('setup');
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      $('title').focus({preventScroll: true});
      return true;
    },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
