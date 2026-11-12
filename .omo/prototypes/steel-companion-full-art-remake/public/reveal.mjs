import {asset, button, cardTitle, el, gradeKey, gradeText, stage} from './ui.mjs';

const RARE_SEAL_MS = 3000;
const RARE_PULSES = [0, 0.32, 0.61, 0.86, 1.08, 1.27, 1.43, 1.57, 1.69, 1.8, 1.89, 1.97, 2.04, 2.1, 2.16];

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
      const loading = fetch(audioURL, {signal: AbortSignal.timeout(2500)})
        .then(response => {
          if (!response.ok) throw new Error('효과음을 읽을 수 없습니다.');
          return response.arrayBuffer();
        })
        .then(bytes => context.decodeAudioData(bytes))
        .catch(error => {
          buffers.delete(id);
          console.warn('출하 효과음을 재생하지 못했습니다.', error.name);
          return null;
        });
      buffers.set(id, loading);
    }
    return buffers.get(id);
  }
  // 등급별 합성음. 녹음된 공개음(띠로리)은 ★2 전용으로 두고, 등급이 오를수록 다른 소리를 낸다.
  function voice(type, freq, at, attack, decay, peak, glide = 0) {
    const t = context.currentTime + 0.03 + at, osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + attack + decay);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(gain).connect(context.destination);
    track(osc, gain);
    osc.start(t); osc.stop(t + attack + decay + 0.05);
  }
  function hiss(at, length, from, to, peak) {
    const t = context.currentTime + 0.03 + at, size = Math.ceil(context.sampleRate * (length + 0.1));
    const noise = context.createBuffer(1, size, context.sampleRate), data = noise.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise; filter.type = 'bandpass'; filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(from, t); filter.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + length * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter).connect(gain).connect(context.destination);
    track(source, gain);
    source.start(t); source.stop(t + length + 0.05);
  }
  const chord = (notes, at, decay, peak) => { for (const f of notes) { voice('triangle', f, at, 0.012, decay, peak); voice('sawtooth', f, at, 0.02, decay * 0.7, peak * 0.28); } };
  const TIER_SOUND = {
    // ★3: 맑은 종 두 음
    'reveal-silver'() { voice('sine', 1318.5, 0.10, 0.005, 0.9, 0.16); voice('sine', 1975.5, 0.24, 0.005, 1.1, 0.13); },
    // ★4: 금빛 3단 팡파르
    'omen-gold'(seconds) { voice('sawtooth', 98, 0, seconds * 0.9, 0.15, 0.05, 196); hiss(0, seconds, 300, 2400, 0.05); },
    'reveal-gold'() {
      chord([523.25, 659.25, 783.99], 0, 0.22, 0.11); chord([659.25, 783.99, 1046.5], 0.17, 0.22, 0.11);
      chord([783.99, 1046.5, 1318.5], 0.34, 1.5, 0.12);
      [2093, 2637, 3136].forEach((f, i) => voice('sine', f, 0.42 + i * 0.08, 0.004, 1.2, 0.05));
    },
    // ★5: 심장 박동과 상승음 뒤, 폭발과 긴 화음
    'omen-holo'(seconds) {
      for (let at = 0; at < seconds - 0.3; at += 0.46) { voice('sine', 62, at, 0.008, 0.2, 0.5, 40); voice('sine', 54, at + 0.17, 0.008, 0.26, 0.36, 36); }
      hiss(seconds * 0.5, seconds * 0.5, 200, 7000, 0.14);
      voice('sawtooth', 110, seconds * 0.5, seconds * 0.45, 0.08, 0.05, 880);
    },
    'reveal-holo'() {
      voice('sine', 130, 0, 0.004, 1.5, 0.6, 30); hiss(0, 0.5, 6000, 300, 0.25);
      chord([415.3, 523.25, 622.25], 0.12, 0.24, 0.1); chord([466.16, 587.33, 698.46], 0.38, 0.24, 0.1);
      chord([523.25, 659.25, 783.99, 1046.5], 0.64, 2.6, 0.12);
      [1046.5, 1318.5, 1568, 2093, 2637, 3136, 4186].forEach((f, i) => voice('sine', f, 0.7 + i * 0.09, 0.004, 1.6, 0.045));
    }
  };
  return {
    enabled: () => enabled,
    tier(name, seconds = 0) {
      if (!enabled || document.hidden || !context || context.state !== 'running' || !TIER_SOUND[name]) return false;
      try { TIER_SOUND[name](seconds); return true; }
      catch (error) { console.warn('등급 효과음을 재생하지 못했습니다.', error.name); return false; }
    },
    toggle() {
      enabled = !enabled;
      if (!enabled) stop();
      else {
        try {
          context ??= new AudioContext();
          context.resume().catch(error => console.warn('음향을 켤 수 없습니다.', error.name));
          for (const id of ['latch', 'seal', 'reveal', 'result', 'rare-tuning']) buffer(id);
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
  const label = el('p', 'reveal-label', '코일이 도착했습니다');
  const sealed = el('div', 'sealed-display');
  sealed.append(asset(data, 'stage:plinth', '', 'coil-plinth'), coil);
  theatre.append(sealed, label, action);
  screen.append(header, theatre);
  host.replaceChildren(screen);
  if (replayFrom !== null) {
    showCard(cards[replayFrom], replayFrom);
  } else {
    action.focus({preventScroll: true});
    sound.cue('latch');
  }

  // The sealed signal belongs to this pull, not to the highest level in the pack.
  function signalRare(card, index) {
    const signal = el('div', 'rare-signal');
    const seal = el('div', 'signal-seal');
    seal.setAttribute('aria-hidden', 'true');
    seal.style.setProperty('--seal-time', RARE_SEAL_MS + 'ms');
    seal.append(el('i', 'signal-ring'), el('i', 'signal-orbit'), el('i', 'signal-inner'), el('i', 'signal-core'));
    for (const [index, offset] of RARE_PULSES.entries()) {
      const spark = el('i', 'signal-spark');
      spark.style.setProperty('--angle', (index * 137.5) + 'deg');
      spark.style.setProperty('--delay', offset + 's');
      seal.append(spark);
    }
    const text = el('p', 'signal-call', '특수 봉인 감지');
    text.setAttribute('role', 'status');
    signal.append(el('span', 'signal-count', ten ? (index + 1) + ' / ' + cards.length : '1회 출하'), seal, text);
    if (theatre.contains(document.activeElement)) skip.focus({preventScroll:true});
    theatre.replaceChildren(signal);
    sound.stop();
    const animations = seal.getAnimations({subtree: true});
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
  function cutin(card, index = 0, continuingMusic = false) {
    const base = data.appearances.find(a => a.cardId === card.id && a.side === 'front' && !a.equipmentKeys.length);
    const tier = card.rare ? 'rare' : card.level >= 4 ? 'holo' : card.level === 3 ? 'gold' : card.level === 2 ? 'silver' : 'steel';
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
    if (tier === 'silver' || tier === 'gold' || tier === 'holo') {
      const flash = el('div', 'reveal-flash'); flash.setAttribute('aria-hidden', 'true');
      const halo = el('div', 'reveal-halo'); halo.setAttribute('aria-hidden', 'true');
      shot.append(flash, halo);
    }
    shot.append(light, stage(data, card, base), caption);
    theatre.replaceChildren(shot);
    if (!continuingMusic) {
      sound.stop();
      if (card.rare) sound.cue('rare-tuning', {offset: RARE_SEAL_MS / 1000});
      else if (tier === 'gold' || tier === 'holo') sound.tier('reveal-' + tier) || sound.cue('reveal');
      else { sound.cue('reveal'); if (tier === 'silver') sound.tier('reveal-silver'); }
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
    sound.cue('seal');
    if (ten) {
      coil.classList.add('opening-coil');
      label.textContent = '첫 번째 동료의 봉인이 풀리고 있습니다';
      later(700, () => showCard(cards[0], 0));
    } else {
      coil.classList.add('opening-coil');
      label.textContent = '봉인이 풀리고 있습니다';
      if (best.rare) {
        later(700, () => signalRare(best, 0));
      } else {
        // 등급 예고: ★2–3은 은빛, ★4는 금빛, ★5는 어두워진 공방에서 코일이 떨리며 무지갯빛이 터진다.
        const omen = best.level >= 4 ? 'holo' : best.level === 3 ? 'gold' : best.level === 2 ? 'silver' : 'steel';
        later(lead * (omen === 'holo' ? 0.3 : 0.5), () => {
          theatre.classList.add('lit', 'omen-' + omen);
          screen.classList.add('omen-' + omen);
          label.textContent = omen === 'holo' ? '봉인 틈으로 무지갯빛이 새어 나옵니다' : omen === 'gold' ? '금빛이 새어 나옵니다 · ' + best.familyName + ' 계열' : omen === 'silver' ? '푸른 광택이 비칩니다 · ' + best.familyName + ' 계열' : best.familyName + ' 계열의 빛';
          const rest = lead * (omen === 'holo' ? 0.7 : 0.5) / 1000;
          if (omen === 'gold' || omen === 'holo') sound.tier('omen-' + omen, rest);
        });
        if (omen === 'holo') later(lead * 0.68, () => {
          theatre.classList.add('surge');
          label.textContent = '★5 미래수요제품 신호!';
        });
        later(lead, () => { theatre.classList.remove('surge'); cutin(best); });
      }
    }
  }
  return cancel;
}
