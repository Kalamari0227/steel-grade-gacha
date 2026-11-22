// 탭별 배경음악(2026-11-22 사용자 결정: docs/design/game-bgm-2026-11-22-u0, 승인 기록 current/approval/bgm).
// 피클송을 Suno로 Cover한 재즈 다섯 곡의 반복 구간을 탭마다 튼다. 파일은 탭에 처음 들어갈 때 받는다(서비스 워커 뼈대에 넣지 않음).
// - 기본은 꺼짐. 소리 창의 "배경음악" 스위치로 켠다(효과음과 따로).
// - 탭을 바꾸면 0.8초 겹쳐 바꾼다. 같은 곡을 쓰는 화면(공방·출하·출하 결과) 사이에서는 이어서 튼다.
// - A안: 출하 연출·차량 등록 장면·제작 음악처럼 다른 음악이 울리는 동안(hold) 0.3초에 줄여 끄고, 모두 끝나면 1.5초에 걸쳐 돌아온다.
// - 화면이 숨으면 멈췄다가(문맥 일시 정지) 돌아오면 이어서 튼다.
// 파일 = [본문 끝 1초] + 본문 + [본문 처음 1초]라서 loopStart·loopEnd(data.json의 bgm)로 돌리면 디코더 지연이 있어도 이음매가 같다.
const VIEW_TRACK = {workshop: 'workshop', ship: 'workshop', results: 'workshop', crafting: 'crafting', garage: 'garage', collection: 'collection', research: 'research'};
const LEVEL = 0.6, CROSSFADE = 0.8, FIRST_FADE = 0.6, DUCK_OUT = 0.3, DUCK_BACK = 1.5;

export function createBgm(base = new URL('./', import.meta.url)) {
  let tracks = null, enabled = false, context = null, master = null, duck = null, view = 'workshop', current = null, token = 0;
  const holds = new Set(), timers = new Map(), files = new Map(), decoded = new Map();
  const trackOf = name => VIEW_TRACK[name] || 'workshop';

  function bytes(key) {
    if (!files.has(key)) {
      const loading = fetch(new URL(tracks[key].file, base), {signal: AbortSignal.timeout(20000)})
        .then(response => { if (!response.ok) throw new Error('배경음악을 받지 못했습니다.'); return response.arrayBuffer(); })
        .catch(error => { files.delete(key); throw error; });
      files.set(key, loading);
    }
    return files.get(key);
  }
  async function load(key) {
    if (!decoded.has(key)) {
      // decodeAudioData는 받은 바이트를 넘겨받아 비우므로 사본을 준다. 풀린 곡은 한 곡에 약 30MB라 지금 곡과 바로 전 곡만 둔다.
      const job = bytes(key).then(raw => context.decodeAudioData(raw.slice(0)));
      decoded.set(key, job);
      job.catch(() => decoded.delete(key));
    }
    const buffer = await decoded.get(key);
    for (const name of [...decoded.keys()]) if (name !== key && name !== current?.key) decoded.delete(name);
    return buffer;
  }
  function ramp(param, value, seconds) {
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }
  function release(track, seconds) {
    if (!track) return;
    ramp(track.gain.gain, 0, seconds);
    try { track.source.stop(context.currentTime + seconds + 0.05); } catch {}
    track.source.onended = () => { track.source.disconnect(); track.gain.disconnect(); };
  }
  async function play(key) {
    // 받는 중이던 다른 곡이 있으면 그 곡은 버린다(같은 곡이 이미 나오고 있으면 그대로 둔다).
    const mine = ++token;
    if (current?.key === key) return;
    let buffer;
    try { buffer = await load(key); }
    catch (error) { console.warn('배경음악을 틀지 못했습니다.', key, error.name); return; }
    if (mine !== token || !enabled || current?.key === key) return;
    const {loopStart, loopEnd} = tracks[key];
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.loop = true; source.loopStart = loopStart; source.loopEnd = loopEnd;
    source.connect(gain).connect(master);
    const fade = current ? CROSSFADE : FIRST_FADE;
    gain.gain.value = 0;
    source.start(context.currentTime, loopStart);
    ramp(gain.gain, 1, fade);
    release(current, fade);
    current = {key, source, gain};
  }
  function applyHolds() {
    if (context) ramp(duck.gain, holds.size ? 0 : 1, holds.size ? DUCK_OUT : DUCK_BACK);
  }
  return {
    // data.json의 bgm: {탭: {file, loopStart, loopEnd}}. 없으면(옛 데이터) 켜지 않는다.
    setTracks(value) { tracks = value && Object.keys(VIEW_TRACK).every(v => value[trackOf(v)]) ? value : null; },
    available: () => !!tracks,
    enabled: () => enabled,
    playing: () => current?.key ?? null,
    toggle() {
      if (!tracks) return false;
      enabled = !enabled;
      if (!enabled) { token++; if (context) release(current, DUCK_OUT); current = null; return false; }
      try {
        if (!context) {
          context = new AudioContext();
          duck = context.createGain(); duck.connect(context.destination);
          master = context.createGain(); master.gain.value = LEVEL; master.connect(duck);
        }
        duck.gain.value = holds.size ? 0 : 1;
        context.resume().catch(error => console.warn('배경음악을 켤 수 없습니다.', error.name));
        play(trackOf(view));
      } catch (error) {
        enabled = false;
        console.warn('배경음악을 켤 수 없습니다.', error.name);
      }
      return enabled;
    },
    // 화면이 바뀔 때마다 부른다. 곡이 같으면 이어서 튼다.
    view(name) {
      view = name;
      if (enabled) play(trackOf(name));
    },
    // 다른 음악이 울리는 동안 줄여 끈다(A안). seconds를 주면 그 시간 뒤 스스로 풀린다.
    hold(reason, seconds = 0) {
      clearTimeout(timers.get(reason));
      timers.delete(reason);
      const quiet = holds.size > 0;
      holds.add(reason);
      if (seconds) timers.set(reason, setTimeout(() => { timers.delete(reason); if (holds.delete(reason) && !holds.size) applyHolds(); }, seconds * 1000));
      if (!quiet) applyHolds();
    },
    release(reason) {
      clearTimeout(timers.get(reason));
      timers.delete(reason);
      if (holds.delete(reason) && !holds.size) applyHolds();
    },
    held: () => [...holds],
    // 화면이 숨으면 멈추고, 돌아오면 이어서 튼다.
    visible(shown) {
      if (!context) return;
      if (shown && enabled) context.resume().catch(() => {});
      else if (!shown) context.suspend().catch(() => {});
    }
  };
}
