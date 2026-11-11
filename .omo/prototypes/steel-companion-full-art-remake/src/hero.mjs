import {button, el} from './ui.mjs';

// LV5 선행개발 성공 연출. feature/draw-fx-src의 흐름을 옮기되 그림은 승인 목록의 QP 원화·배경만 쓴다.
// 개발 거래는 이미 저장된 뒤에 재생되며, 스킵·Esc·화면 이탈은 결과에 영향을 주지 않는다.
const CUES = [[.35,'heart'],[.97,'heart'],[1.59,'heart'],[2,'riser',1.2],[3.1,'crack'],[3.1,'riser',1.3],[4.35,'boom'],[4.8,'sting']];
const LINE_AT = 5600, LINE_STEP = 45, GO_AT = 7900;

function synth() {
  let ctx = null, out = null, noiseBuf = null;
  function open() {
    if (ctx) return ctx;
    ctx = new AudioContext();
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, len);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    out = ctx.createGain();
    out.gain.value = .5;
    out.connect(comp);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  const env = (g, t, a, d, p) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  function tone(f, type, at, a, d, p, f2) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    env(g, t, a, d, p); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + .05);
  }
  function noise(at, dur, ft, f1, f2, p, q, a = .005) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = ft; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, a, dur, p); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + a + dur + .05);
  }
  function chord(fs, at, dur, p = .12) {
    for (const fr of fs) for (const det of [-6, 6]) {
      const t = ctx.currentTime + at, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(2600, t + .06); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
      env(g, t, .02, dur, p); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .1);
    }
  }
  const fx = {
    heart(at) { tone(58, 'sine', at, .008, .22, 1, 40); tone(52, 'sine', at + .2, .008, .3, .75, 36); },
    riser(at, d) { noise(at, d, 'bandpass', 180, 6000, .35, 2, d * .85); tone(90, 'sawtooth', at, d * .9, .1, .06, 700); },
    crack(at) { noise(at, .18, 'highpass', 2500, 7000, .7); tone(2100, 'triangle', at, .002, .25, .18, 900); },
    boom(at) { tone(120, 'sine', at, .004, 1.6, 1, 28); noise(at, 1.4, 'lowpass', 4000, 90, .9); noise(at, .25, 'highpass', 3000, 8000, .3); },
    sting(at) {
      chord([207.65, 261.63, 311.13], at, .22); chord([233.08, 293.66, 349.23], at + .26, .22);
      chord([261.63, 329.63, 392, 523.25], at + .52, 2.4, .14);
      [1047, 1568, 2093].forEach((f, i) => tone(f, 'sine', at + .55 + i * .09, .005, 1.8, .07));
    }
  };
  return {
    on: false,
    start(elapsed) {
      try {
        if (!open()) return false;
        for (const [at, name, arg] of CUES) if (at >= elapsed) fx[name](at - elapsed, arg);
        this.on = true;
      } catch (error) {
        console.warn('선행개발 연출 음향을 켤 수 없습니다.', error.name);
        this.on = false;
      }
      return this.on;
    },
    tick() { if (this.on && ctx) try { tone(1800 + Math.random() * 300, 'square', 0, .002, .02, .025); } catch {} },
    stop() { this.on = false; if (ctx) { ctx.close().catch(() => {}); ctx = null; out = null; } }
  };
}

function image(src, className, alt = '') {
  const img = el('img', className);
  img.src = src; img.alt = alt; img.decoding = 'async';
  return img;
}

export function heroReveal(data, card, {soundOn = false, onDone}) {
  const art = data.appearances.find(a => a.cardId === card.id && a.side === 'front' && !a.equipmentKeys.length);
  const background = data.assets['background:' + card.family] || data.assets['stage:qp-special'];
  const line = data.dialogue.find(row => row.cardId === card.id && row.side === 'front') || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ended = false;
  if (reduced || !art) { queueMicrotask(() => onDone()); return () => {}; }

  const timers = [], sound = synth(), started = performance.now();
  const lastFocus = document.activeElement;
  const root = el('div', 'qph');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '선행개발 성공 — ' + card.familyName + ' ' + card.code);
  const stageBox = el('div', 'qph-stage');
  const tape = side => {
    const t = el('div', 'qph-tape ' + side); t.setAttribute('aria-hidden', 'true');
    const run = el('div', 'qph-run');
    for (let i = 0; i < 20; i++) run.append(el('span', '', '⚠ 선행개발 신호 감지'));
    t.append(run); return t;
  };
  const hero = el('div', 'qph-hero');
  const wrap = el('div', 'qph-wrap');
  wrap.append(image(art.image, 'qph-sil'), image(art.image, 'qph-col', card.familyName + ' ' + card.code));
  const quote = el('q', 'qph-line'); quote.lang = 'ko'; quote.setAttribute('role', 'status');
  const ja = el('span', 'qph-ja', line.ja || ''); ja.lang = 'ja';
  const bottom = el('div', 'qph-bar b'); bottom.append(quote, ja);
  const band = el('div', 'qph-band');
  band.append(el('small', '', 'LV5 · 선행개발 성공'), el('b', '', card.familyName), el('span', '', card.code + ' — ' + (card.description || '').split(' · 선행개발')[0]));
  hero.append(background ? image(background.image, 'qph-bg') : el('div', 'qph-bg'), el('div', 'qph-speed'), el('div', 'qph-boom a'), el('div', 'qph-boom b'), el('div', 'qph-boom c'), wrap);
  for (let i = 0; i < 18; i++) {
    const mote = el('i', 'qph-mote');
    mote.style.left = (5 + Math.random() * 90).toFixed(1) + '%';
    mote.style.setProperty('--t', (2.5 + Math.random() * 2).toFixed(2) + 's');
    mote.style.setProperty('--d', (Math.random() * 2).toFixed(2) + 's');
    hero.append(mote);
  }
  hero.append(el('div', 'qph-bar t'), bottom, band);
  const snd = button('', 'qph-snd', () => {
    if (sound.on) sound.stop(); else sound.start((performance.now() - started) / 1000);
    label();
  });
  const label = () => { snd.setAttribute('aria-pressed', String(sound.on)); snd.textContent = sound.on ? '소리 켜짐' : '소리 켜기'; };
  const skip = button('건너뛰기', 'qph-skip', finish);
  const go = button('도감에 등록', 'qph-go', finish);
  stageBox.append(el('div', 'qph-pulse'), tape('a'), tape('b'), el('div', 'qph-pillar'), hero, el('div', 'qph-flash'), el('div', 'qph-flash f2'), snd, skip, go);
  root.append(stageBox);

  function onKey(event) { if (event.key === 'Escape') { event.preventDefault(); finish(); } }
  function cleanup() {
    if (ended) return false;
    ended = true;
    timers.forEach(clearTimeout);
    sound.stop();
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    document.body.style.overflow = overflow;
    return true;
  }
  function finish() { if (cleanup()) onDone(); }

  const overflow = document.body.style.overflow;
  document.body.append(root);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey, true);
  if (soundOn) sound.start(0);
  label();
  skip.focus({preventScroll: true});
  const text = line.ko || '';
  [...text].forEach((ch, k) => timers.push(setTimeout(() => {
    quote.textContent = [...text].slice(0, k + 1).join('');
    if (ch !== ' ') sound.tick();
  }, LINE_AT + k * LINE_STEP)));
  timers.push(setTimeout(() => { if (root.contains(document.activeElement)) go.focus({preventScroll: true}); }, GO_AT + 100));
  // 화면 이탈 시 정리만 하고 결과 화면 전환은 호출한 쪽이 다시 그린다.
  return () => { if (cleanup() && lastFocus?.isConnected) lastFocus.focus({preventScroll: true}); };
}
