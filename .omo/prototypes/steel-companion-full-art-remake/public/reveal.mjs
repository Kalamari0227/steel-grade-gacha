import {asset, button, cardTitle, el, gradeKey, gradeText, stage} from './ui.mjs';

const RARE_SEAL_MS = 3000;

export function createSound() {
  let enabled = false;
  let context;
  let generation = 0;
  const playing = new Map();
  const buffers = new Map();
  function stop() {
    generation++;
    for (const [source, release] of playing) {
      try { source.stop(); } catch {}
      release();
    }
    playing.clear();
  }
  function track(source, gain) {
    const release = () => {
      playing.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    playing.set(source, release);
    source.onended = release;
  }
  function buffer(id) {
    if (!buffers.has(id)) {
      const version = id === 'rare-tuning' ? '?v=lower-r2' : '';
      const audioURL = new URL('./audio/draw.' + id + '.wav' + version, import.meta.url);
      const get = url => fetch(url, {signal: AbortSignal.timeout(2500)})
        .then(response => {
          if (!response.ok) throw new Error('효과음을 읽을 수 없습니다.');
          return response.arrayBuffer();
        })
        .then(bytes => context.decodeAudioData(bytes));
      // 특수 봉인 음악(2026-11-21): 출하 음악과 같은 결의 새 곡을 먼저 쓰고, 못 받으면 예전 rare-tuning을 쓴다.
      // 봉인 애니메이션은 음악 시간을 따라가므로 새 곡도 3.0초에 한 방(카드 등장)이 오도록 다듬었다.
      const loading = (id === 'rare-tuning' ? get(new URL('./audio/sfx.rare-theme.mp3', import.meta.url)).catch(() => get(audioURL)) : get(audioURL))
        .catch(error => {
          buffers.delete(id);
          console.warn('출하 효과음을 재생하지 못했습니다.', error.name);
          return null;
        });
      buffers.set(id, loading);
    }
    return buffers.get(id);
  }
  // 출하 연출 효과음 파일(2026-11-20 승인, current/approval/sfx). 소리를 켤 때 한 번 받아 두고 받은 것만 쓴다.
  // 받지 못한 소리는 아래 TIER_SOUND의 원래 합성음이 대신한다(사용자 결정). 재생은 합성음과 같은 버스·같은 정지(stop)를 거친다.
  const SFX_NAMES = ['thud', 'theme', 'ring', 'crack', 'upgrade', 'burst', 'chime-steel', 'chime-silver', 'chime-gold', 'chime-holo', 'chime-rare'];
  const sfx = new Map();
  const THEME_HIT = 4.2; // sfx.theme.mp3에서 한 방이 시작하는 초(원본 후보 6.0초 − 앞 1.8초 자름)
  function loadSfx() {
    for (const name of SFX_NAMES) {
      if (sfx.has(name)) continue;
      sfx.set(name, null);
      fetch(new URL('./audio/sfx.' + name + '.mp3', import.meta.url), {signal: AbortSignal.timeout(4000)})
        .then(response => { if (!response.ok) throw new Error('효과음을 읽을 수 없습니다.'); return response.arrayBuffer(); })
        .then(bytes => context.decodeAudioData(bytes))
        .then(decoded => { sfx.set(name, decoded); })
        .catch(error => { sfx.delete(name); console.warn('출하 효과음 파일을 쓰지 못해 합성음을 냅니다.', name, error.name); });
    }
  }
  // 무게 보정(2026-11-20 사용자 의견 "너무 라이트·날카로움"): 승인 파일은 그대로 두고 재생할 때만
  // 음높이를 낮추고(rate), 2.8kHz 위를 깎고(top dB), 180Hz 아래를 올린다(low dB).
  const WEIGHT = {
    thud: {rate: 0.75, top: -7, low: 7},
    theme: {rate: 1, top: 0, low: 0},
    ring: {rate: 0.5, top: -12, low: 5},
    crack: {rate: 0.62, top: -10, low: 6},
    upgrade: {rate: 0.7, top: -10, low: 6},
    burst: {rate: 0.8, top: -7, low: 6},
    chime: {rate: 0.55, top: -11, low: 8}
  };
  function play(name, at = 0, peak = 1, {offset = 0, fadeIn = 0} = {}) {
    const decoded = sfx.get(name);
    if (!decoded) return false;
    const w = WEIGHT[name] || WEIGHT[name.split('-')[0]] || {rate: 1, top: 0, low: 0};
    const t = context.currentTime + 0.03 + at, source = context.createBufferSource(), gain = context.createGain();
    const low = context.createBiquadFilter(), top = context.createBiquadFilter();
    low.type = 'lowshelf'; low.frequency.value = 180; low.gain.value = w.low;
    top.type = 'highshelf'; top.frequency.value = 2800; top.gain.value = w.top;
    source.buffer = decoded; source.playbackRate.value = w.rate; gain.gain.value = peak;
    if (fadeIn) { gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(peak, t + fadeIn); }
    source.connect(low).connect(top).connect(gain).connect(out());
    track(source, gain);
    source.start(t, offset);
    return gain;
  }
  // 파일 소리 밑에 까는 낮은 쿵(사인파가 from→to Hz로 내려간다). 휴대폰 스피커에도 걸리도록 100Hz대에서 시작한다.
  function sub(at, from, to, decay, peak) { tone(from, 'sine', at, 0.004, decay, peak, to); }
  // 등급별 합성음. 뽑기 연출 데모(archive/draw-fx)의 소리를 옮긴 것으로, 위 효과음 파일이 없을 때 쓴다.
  let bus = null, grain = null;
  function out() {
    if (!bus) {
      const comp = context.createDynamicsCompressor();
      comp.connect(context.destination);
      bus = context.createGain(); bus.gain.value = 0.5; bus.connect(comp);
      const size = context.sampleRate;
      grain = context.createBuffer(1, size, size);
      const data = grain.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    }
    return bus;
  }
  function shape(gain, t, attack, decay, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(freq, type, at, attack, decay, peak, glide = 0) {
    const t = context.currentTime + 0.03 + at, osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + attack + decay);
    shape(gain, t, attack, decay, peak);
    osc.connect(gain).connect(out());
    track(osc, gain);
    osc.start(t); osc.stop(t + attack + decay + 0.05);
  }
  function noise(at, length, kind, from, to, peak, q = 1, attack = 0.005) {
    const target = out(), t = context.currentTime + 0.03 + at;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = grain; source.loop = true; filter.type = kind; filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t); filter.frequency.exponentialRampToValueAtTime(to, t + length);
    shape(gain, t, attack, length, peak);
    source.connect(filter).connect(gain).connect(target);
    track(source, gain);
    source.start(t); source.stop(t + attack + length + 0.05);
  }
  const CHIME = {steel: [880, 1319], silver: [784, 988, 1175], gold: [784, 988, 1175, 1568], holo: [659, 880, 1047, 1319, 1760, 2093], rare: [659, 880, 1047, 1319, 1760, 2093]};
  const TIER_SOUND = {
    // 코일이 받침대에 내려앉는 소리
    thud() { if (play('thud', 0, 0.9)) { sub(0, 100, 32, 0.6, 1); return; } tone(95, 'sine', 0, 0.004, 0.3, 0.9, 38); noise(0, 0.14, 'lowpass', 900, 150, 0.35); tone(420, 'triangle', 0.02, 0.002, 0.35, 0.08, 400); },
    // 출하 음악(2026-11-21, 사용자 의견 "타다다닥 반복이 거슬림, 주목받는 음악으로"): 한 곡을 흔들림부터 카드 화면까지 이어 튼다.
    // 곡의 한 방(THEME_HIT초)이 봉인이 터지는 순간(ms)에 오도록 그만큼 앞에서 시작한다. 한 방 직전에 잠깐 잦아드는 구간이 곡에 들어 있다.
    // ★2·3(lv 1·2)은 한 방 1.5초 뒤 서서히 줄여 흔한 출하가 과하게 축하받지 않게 한다. 파일이 없으면 원래 합성음(덜컹)을 낸다.
    rattle(ms, lv) {
      const len = ms / 1000, hitAt = context.currentTime + 0.03 + len;
      // 10연·레어는 흔들림이 0.7초라 곡이 반 박자쯤 나오다 다음 연출(레어 음악·터짐)에 끊겨 이상하게 들렸다(2026-11-21 사용자 의견).
      // 짧은 흔들림에는 곡 대신 낮게 차오르는 울림만 낸다.
      if (len < 1.5) { sub(0, 45, 90, len, 0.45); return; }
      const gain = sfx.get('theme') && play('theme', Math.max(0, len - THEME_HIT), 0.6 + 0.1 * lv, {offset: Math.max(0, THEME_HIT - len), fadeIn: 0.25});
      if (gain) { if (lv <= 2) gain.gain.setTargetAtTime(0.0001, hitAt + 1.5, 0.5); return; }
      const n = Math.round(ms / 55);
      for (let i = 0; i < n; i++) {
        const at = (i / n) ** 0.8 * ms / 1000;
        noise(at, 0.035, 'bandpass', 1800 + i * 90, 2200 + i * 90, 0.12 + 0.25 * i / n, 6);
        if (lv >= 3 && i % 3 === 0) tone(1400 + i * 40, 'triangle', at, 0.002, 0.08, 0.04);
      }
    },
    crack() { if (play('crack', 0, 0.8)) { sub(0, 110, 36, 0.5, 0.85); return; } noise(0, 0.18, 'highpass', 2500, 7000, 0.7); tone(2100, 'triangle', 0, 0.002, 0.25, 0.18, 900); },
    // 금빛이 무지갯빛으로 뒤집히는 승급음
    upgrade() { if (play('upgrade', 0, 0.7)) { sub(0, 50, 110, 0.8, 0.55); return; } tone(380, 'sawtooth', 0, 0.02, 0.45, 0.08, 1700); noise(0, 0.45, 'bandpass', 600, 6000, 0.18, 3); [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 'triangle', 0.42 + i * 0.05, 0.004, 0.7, 0.12)); },
    // 코일이 터지며 카드가 튀어나오는 소리
    burst(lv) { if (play('burst', 0, 0.9)) { sub(0, 90, 28, 0.8 + 0.1 * lv, 0.9 + 0.05 * lv); return; } noise(0, 0.55, 'bandpass', 300, 5000, 0.5, 0.8); tone(70, 'sine', 0, 0.006, 0.5, 0.8, 30); if (lv >= 3) noise(0.05, 0.9, 'highpass', 5000, 9000, 0.12); },
    // 특수 봉인이 걸리는 소리: 무거운 잠금 쿵 + 낮게 끄는 금속 울림. 이어지는 rare-tuning 음악은 처음이 조용하다.
    sealed() { if (play('thud', 0, 1)) { sub(0, 85, 26, 1.1, 1); play('ring', 0.1, 0.45); return; } tone(80, 'sine', 0, 0.004, 0.6, 0.9, 30); noise(0, 0.2, 'lowpass', 700, 120, 0.4); },
    // 카드가 착지할 때의 종소리. 등급이 오를수록 음이 늘어난다.
    chime(tier) { if (play('chime-' + (CHIME[tier] ? tier : 'steel'), 0.05, 0.7)) { sub(0.05, 80, 34, 0.7, 0.75); return; } (CHIME[tier] || CHIME.steel).forEach((f, i) => { tone(f, 'triangle', 0.05 + i * 0.07, 0.005, 1.3, 0.16); tone(f * 2, 'sine', 0.05 + i * 0.07, 0.005, 0.7, 0.05); }); }
  };
  return {
    enabled: () => enabled,
    tier(name, ...args) {
      if (!enabled || document.hidden || !context || context.state !== 'running' || !TIER_SOUND[name]) return false;
      try { TIER_SOUND[name](...args); return true; }
      catch (error) { console.warn('등급 효과음을 재생하지 못했습니다.', error.name); return false; }
    },
    toggle() {
      enabled = !enabled;
      if (!enabled) stop();
      else {
        try {
          context ??= new AudioContext();
          context.resume().catch(error => console.warn('음향을 켤 수 없습니다.', error.name));
          for (const id of ['result', 'rare-tuning']) buffer(id);
          loadSfx();
        } catch (error) {
          enabled = false;
          console.warn('음향을 켤 수 없습니다.', error.name);
        }
      }
      return enabled;
    },
    stop,
    async cue(id, {offset = 0} = {}) {
      if (!enabled || document.hidden || !context) return null;
      const current = generation;
      try {
        if (context.state !== 'running') {
          const unlocked = await Promise.race([
            context.resume().then(() => true),
            new Promise(resolve => setTimeout(() => resolve(false), 750))
          ]);
          if (!unlocked) return null;
        }
        const decoded = await buffer(id);
        if (!decoded || current !== generation || !enabled || document.hidden) return null;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = decoded;
        gain.gain.value = id === 'rare-tuning' ? 0.65 : 0.45;
        source.connect(gain).connect(context.destination);
        track(source, gain);
        const startAt = context.currentTime + 0.03;
        source.start(startAt, offset);
        return {
          elapsed() {
            const stamp = context.getOutputTimestamp?.();
            const outputTime = stamp?.contextTime > 0 ? stamp.contextTime : context.currentTime - (context.baseLatency || 0);
            return offset + Math.max(0, outputTime - startAt);
          }
        };
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        console.warn('출하 효과음을 재생하지 못했습니다.', error.name);
        return null;
      }
    }
  };
}

export function reveal(host, data, result, finish, sound, {replayFrom = null} = {}) {
  const timers = new Set();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let ended = false;
  function cancel() {
    ended = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    reduce.removeEventListener('change', motionChanged);
    sound.stop();
  }
  function done(auto = false) {
    if (ended) return;
    cancel();
    finish();
    if (auto) sound.cue('result');
  }
  function motionChanged(e) { if (e.matches) done(); }
  if (reduce.matches && replayFrom === null) { done(); return cancel; }
  reduce.addEventListener('change', motionChanged);
  function later(delay, callback) {
    const id = setTimeout(() => { timers.delete(id); if (!ended) callback(); }, delay);
    timers.add(id);
  }
  const cards = result.cards.map(row => data.cards.find(card => card.id === row.id));
  const ten = cards.length > 1;
  const best = cards.reduce((a, b) => a.level >= b.level ? a : b);
  // 봉인을 연 뒤 카드가 나오기까지의 길이. 카드는 자동으로 넘어가지 않고 입력을 기다린다.
  const lead = best.level >= 4 ? 4200 : best.level === 3 ? 3400 : best.level === 2 ? 3000 : 2600;
  const screen = el('section', 'reveal ' + gradeKey(best));
  screen.append(asset(data, 'scene:workshop:back', '', 'scene-bg'));
  const header = el('div', 'reveal-head');
  const title = el('h1', '', ten ? '10연 출하' : '1회 출하');
  const skip = button('건너뛰기', 'quiet-light', () => done());
  header.append(title, skip);
  const theatre = el('div', 'theatre');
  const action = button('봉인 열기', 'seal-action', start);
  const coil = asset(data, 'draw:coil-pack', '봉인된 출하 코일', 'sealed-coil');
  const seam = el('i', 'seam');
  seam.setAttribute('aria-hidden', 'true');
  const label = el('p', 'reveal-label tap-hint', '탭해서 봉인 열기');
  const sealed = el('div', 'sealed-display');
  sealed.append(asset(data, 'stage:plinth', '', 'coil-plinth'), seam, coil);
  theatre.append(sealed, label, action);
  screen.append(header, theatre);
  host.replaceChildren(screen);
  let showing = -1;
  if (replayFrom !== null) {
    showCard(cards[replayFrom], replayFrom);
  } else {
    action.focus({preventScroll: true});
    coil.classList.add('dropping-coil');
    later(430, () => { sound.tier('thud'); shake(screen, 260, 5); });
  }

  const LV = {steel: 1, silver: 2, gold: 3, holo: 4, rare: 4};
  const GLOW = {steel: '#dfe9ee', silver: '#8fc8ff', gold: '#ffcf72', holo: '#ffcf72', rare: '#ffcf72'};
  const tierOf = card => card.rare ? 'rare' : card.level >= 4 ? 'holo' : card.level === 3 ? 'gold' : card.level === 2 ? 'silver' : 'steel';
  function shake(node, ms, amp) {
    const frames = [];
    for (let i = 0; i <= 12; i++) {
      const a = amp * (i / 12);
      frames.push({transform: `translate(${((Math.random() - 0.5) * 2 * a).toFixed(1)}px,${((Math.random() - 0.5) * a).toFixed(1)}px)`});
    }
    frames.push({transform: 'none'});
    node.animate(frames, {duration: ms, easing: 'linear'});
  }
  function shards(count, color) {
    for (let i = 0; i < count; i++) {
      const shard = el('i', 'burst-shard');
      shard.setAttribute('aria-hidden', 'true');
      shard.style.setProperty('--glow', color);
      shard.style.setProperty('--angle', (Math.random() * 360).toFixed(0) + 'deg');
      shard.style.setProperty('--dist', (90 + Math.random() * 150).toFixed(0) + 'px');
      shard.style.setProperty('--time', (600 + Math.random() * 400).toFixed(0) + 'ms');
      sealed.append(shard);
    }
  }
  // 덜컹거림: 코일이 점점 세게 흔들리고 틈새로 등급 색 빛이 샌다.
  function charge(ms, tier) {
    const lv = LV[tier], amp = lv === 1 ? 5 : lv === 2 ? 7 : 9, frames = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) ** 1.6 * amp;
      frames.push({transform: `translateX(${((i % 2 ? 1 : -1) * a).toFixed(1)}px) rotate(${((i % 2 ? -1 : 1) * a * 0.5).toFixed(1)}deg)`});
    }
    frames.push({transform: 'none'});
    coil.animate(frames, {duration: ms, easing: 'linear'});
    seam.style.setProperty('--glow', GLOW[tier]);
    seam.animate([{opacity: 0, transform: 'scale(.5)'}, {opacity: lv === 1 ? 0.5 : 0.95, transform: 'scale(1.05)'}], {duration: ms, easing: 'ease-in', fill: 'forwards'});
    sound.tier('rattle', ms, lv);
  }
  // 승급: 금빛이던 틈새 빛이 무지갯빛으로 뒤집힌다.
  function upgrade() {
    sound.tier('crack');
    later(120, () => sound.tier('upgrade'));
    shake(screen, 220, 8);
    seam.classList.add('holo');
    shards(10, '#9be9ff');
    const call = el('p', 'upgrade-call', '▲ 등급 상승');
    call.setAttribute('aria-hidden', 'true');
    theatre.append(call);
  }
  // 코일이 터지고, 이어서 카드가 그 자리에서 튀어나온다.
  function pop(tier) {
    const lv = LV[tier];
    sound.tier('burst', lv);
    coil.animate([{transform: 'scale(1)', opacity: 1}, {transform: 'scale(1.35)', opacity: 0}], {duration: 280, fill: 'forwards'});
    seam.animate([{opacity: 1}, {opacity: 0, transform: 'scale(1.8)'}], {duration: 420, fill: 'forwards'});
    shards(lv === 1 ? 8 : lv === 2 ? 12 : lv === 3 ? 18 : 28, tier === 'steel' ? '#ffffff' : tier === 'holo' ? '#9be9ff' : GLOW[tier]);
  }

  // The sealed signal belongs to this pull, not to the highest level in the pack.
  function signalRare(card, index) {
    // 특수 봉인 · A안 "출하 정지 — 검사 보류"(2026-11-21 사용자 선택): 조명이 꺼지고 경고 셔터가 닫히며, 코일 틈 빛과 검사선이
    // 음악의 두근거림에 맞춰 맥박 친다. 움직임은 prototype.css의 3초(--seal-time) 타임라인이고, 아래에서 음악 재생 시각에 맞춘다.
    const signal = el('div', 'rare-signal');
    signal.style.setProperty('--seal-time', RARE_SEAL_MS + 'ms');
    const hidden = node => { node.setAttribute('aria-hidden', 'true'); return node; };
    const top = el('div', 'hold-top');
    top.append(el('span', 'signal-count', ten ? (index + 1) + ' / ' + cards.length : ''), hidden(el('span', '', 'LINE STOP · 출하 정지')));
    const call = el('p', 'signal-call');
    call.setAttribute('role', 'status');
    call.append(el('strong', '', '특수 봉인'), el('span', '', '등급 판정 불가 · 정밀 검사 중'));
    const meter = hidden(el('i', 'hold-meter'));
    meter.append(el('b'));
    signal.append(hidden(el('i', 'hold-shutter top')), hidden(el('i', 'hold-shutter bottom')), top,
      asset(data, 'draw:coil-pack', '', 'hold-coil'), hidden(el('i', 'hold-seam')), hidden(el('i', 'hold-scan')),
      call, meter, hidden(el('span', 'hold-stamp', '보류')), hidden(el('i', 'hold-black')));
    screen.classList.add('holding');
    if (theatre.contains(document.activeElement)) skip.focus({preventScroll:true});
    showing = index;
    theatre.replaceChildren(signal);
    sound.stop();
    sound.tier('sealed');
    const animations = signal.getAnimations({subtree: true});
    for (const animation of animations) animation.pause();
    sound.cue('rare-tuning').then(playback => {
      if (ended) return;
      const silentStart = performance.now();
      function synchronize() {
        if (ended) return;
        const seconds = playback ? playback.elapsed() : (performance.now() - silentStart) / 1000;
        for (const animation of animations) animation.currentTime = seconds * 1000;
        if (seconds * 1000 >= RARE_SEAL_MS) cutin(card, index, !!playback);
        else later(16, synchronize);
      }
      synchronize();
    });
  }
  function showCard(card, index) {
    if (card.rare && !reduce.matches) signalRare(card, index);
    else cutin(card, index);
  }
  function cutin(card, index = 0, continuingMusic = false, popped = false) {
    const base = data.appearances.find(a => a.cardId === card.id && a.side === 'front' && !a.equipmentKeys.length);
    const tier = tierOf(card);
    showing = index;
    const fromSignal = screen.classList.contains('holding');
    screen.classList.remove('holding');
    const shot = el('div', 'cutin impact-' + tier);
    const light = el('div', 'reveal-light');
    light.setAttribute('aria-hidden','true');
    if (tier !== 'steel') {
      const count = tier === 'rare' ? 24 : tier === 'holo' ? 20 : tier === 'gold' ? 12 : 6;
      for (let i = 0; i < count; i++) {
        const spark = el('i');
        spark.style.setProperty('--angle', (i * 360 / count) + 'deg');
        light.append(spark);
      }
    }
    const caption = el('div', 'draw-caption');
    caption.setAttribute('role','status');
    caption.append(el('p', 'draw-count', ten ? (index + 1) + ' / ' + cards.length : '1회 출하'),
      el('h2','',cardTitle(card)),
      el('p','draw-rank',gradeText(card) + (card.rare ? '　RARE' : '') + '　·　' + (result.cards[index].isNew ? '새 발견' : '재발견')));
    // 특수 봉인(레어)도 검은 화면 뒤에 흰 섬광으로 카드가 터져 나온다(A안).
    if (tier === 'silver' || tier === 'gold' || tier === 'holo' || (tier === 'rare' && fromSignal)) {
      const flash = el('div', 'reveal-flash'); flash.setAttribute('aria-hidden', 'true');
      const halo = el('div', 'reveal-halo'); halo.setAttribute('aria-hidden', 'true');
      shot.append(flash, halo);
    }
    shot.append(light, stage(data, card, base), caption);
    theatre.replaceChildren(shot);
    if (card.rare) {
      if (!continuingMusic) { sound.stop(); sound.cue('rare-tuning', {offset: RARE_SEAL_MS / 1000}); }
      // 음악이 가장 커지는 순간(카드 등장)에 터지는 소리를 겹치고, 음악이 잦아들 무렵 레어 종을 울린다.
      sound.tier('burst', 4);
      later(1400, () => { if (showing === index) sound.tier('chime', 'rare'); });
    } else {
      // 카드가 튀어나오는 소리 뒤, 착지하는 순간에 등급별 종소리가 울린다.
      if (!popped) { sound.stop(); sound.tier('burst', LV[tier]); }
      later(tier === 'steel' ? 600 : tier === 'holo' ? 1000 : 880, () => {
        if (showing !== index) return;
        sound.tier('chime', tier);
        if (LV[tier] >= 3) shake(screen, 200, LV[tier] * 1.5);
      });
    }
    {
      const last = index === cards.length - 1;
      const next = button(!ten ? '결과 보기' : last ? '열 장 모두 보기' : '다음 카드', 'draw-next', () => {
        if (ended) return;
        if (last) done(true);
        else showCard(cards[index + 1], index + 1);
      });
      shot.append(next);
      next.focus({preventScroll:true});
    }
  }
  function start() {
    if (screen.dataset.opened || ended) return;
    screen.dataset.opened = 'true';
    action.remove();
    skip.focus({preventScroll: true});
    coil.classList.remove('dropping-coil');
    coil.classList.add('opening-coil');
    label.classList.remove('tap-hint');
    if (ten || best.rare) {
      label.textContent = ten ? '첫 번째 동료의 봉인이 풀리고 있습니다' : '봉인이 풀리고 있습니다';
      charge(700, ten ? 'silver' : 'gold');
      later(700, () => ten ? showCard(cards[0], 0) : signalRare(best, 0));
      return;
    }
    // 등급 예고: ★2는 은빛, ★3은 푸른빛, ★4는 금빛. ★5는 금빛으로 시작했다가 무지갯빛으로 승급한다.
    const tier = tierOf(best), first = tier === 'holo' ? 'gold' : tier;
    const POP = 280;
    label.textContent = '봉인이 풀리고 있습니다';
    charge(lead - POP, tier);
    later(lead * (tier === 'holo' ? 0.3 : 0.5), () => {
      theatre.classList.add('lit', 'omen-' + first);
      screen.classList.add('omen-' + first);
      label.textContent = first === 'gold' ? '금빛이 새어 나옵니다 · ' + best.familyName + ' 계열' : first === 'silver' ? '푸른 광택이 비칩니다 · ' + best.familyName + ' 계열' : best.familyName + ' 계열의 빛';
    });
    if (tier === 'holo') later(lead * 0.68, () => {
      theatre.classList.replace('omen-gold', 'omen-holo');
      screen.classList.replace('omen-gold', 'omen-holo');
      theatre.classList.add('surge');
      label.textContent = '★5 미래수요제품 신호!';
      upgrade();
    });
    later(lead - POP, () => pop(tier));
    later(lead, () => { theatre.classList.remove('surge'); cutin(best, 0, false, true); });
  }
  return cancel;
}
