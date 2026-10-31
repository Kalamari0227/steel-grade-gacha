var GAME_AUDIO = (function () {
  'use strict';
  const key = 'sgg_game_preferences_v1';
  const routes = {workshop:'workshop',dex:'collection',research:'collection',learn:'collection',learning:'collection',craft:'craft',garage:'garage'};
  const grand = new Set(['draw.reveal','craft.complete','garage.complete','qp.complete']);
  let bridge, mix, context, master, bgmBus, sfxBus, duckBus, controls, notice;
  let optedIn = false, muted = false, activated = false, hidden = false, recovery = false, unavailable = false;
  let preferenceWarning = false;
  let bgmGain, sfxGain, route = 'workshop', generation = 0, cueGeneration = 0, lastUi = -Infinity;
  const buffers = new Map(), requests = new Map(), tracks = new Set(), voices = new Set();
  const diagnostics = {decoded:[],errors:[],startedCues:0,maxTracks:0,maxVoices:0};
  function prefs() {
    try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch (_) { return {}; }
  }
  function persist() {
    try { localStorage.setItem(key,JSON.stringify({...prefs(),audio:{optedIn,muted,bgmGain,sfxGain}})); preferenceWarning = false; }
    catch (_) { preferenceWarning = true; updateControls(); }
  }
  function gain(value,fallback) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : fallback; }
  function status(message) { if (controls) controls.querySelector('[data-audio-status]').textContent = message; }
  function error(stage,value) {
    diagnostics.errors.push({stage,name:value.name || 'Error',message:String(value.message || value)});
    if (diagnostics.errors.length > 12) diagnostics.errors.shift();
  }
  function usable() { return activated && optedIn && !muted && !hidden && !recovery && context?.state === 'running'; }
  function updateControls() {
    if (!controls) return;
    controls.querySelector('[data-audio-enable]').textContent = recovery ? '소리 다시 켜기' : '소리 켜기';
    controls.querySelector('[data-audio-mute]').checked = muted;
    for (const [name,value] of [['bgm',bgmGain],['sfx',sfxGain]]) {
      controls.querySelector('[data-audio-'+name+']').value = Math.round(value*100);
      controls.querySelector('[data-audio-'+name+'-value]').textContent = Math.round(value*100)+'%';
    }
    const message = recovery ? '소리 다시 켜기를 눌러 주세요.' : unavailable ? '소리를 불러오지 못했습니다. 무음으로 계속할 수 있습니다.'
      : muted ? '전체 무음입니다.' : !usable() ? '소리 켜기를 누르면 들을 수 있습니다.'
      : bgmGain === 0 && sfxGain === 0 ? '배경음과 효과음 음량이 0입니다.'
      : bgmGain === 0 ? '배경음 음량이 0입니다. 효과음은 켜져 있습니다.'
      : sfxGain === 0 ? '효과음 음량이 0입니다. 배경음은 켜져 있습니다.' : '소리 켜짐';
    status((preferenceWarning ? '소리 설정을 기기에 저장하지 못했습니다. 이 창에서는 현재 설정을 유지합니다. ' : '') + message);
  }
  function stopVoice(voice,set) {
    if (!set.delete(voice)) return;
    voice.source.onended = null;
    voice.source.stop(); voice.source.disconnect(); voice.gain?.disconnect();
  }
  function cancel() {
    cueGeneration++;
    for (const voice of voices) stopVoice(voice,voices);
    if (duckBus) { duckBus.gain.cancelScheduledValues(context.currentTime); duckBus.gain.setValueAtTime(1,context.currentTime); }
  }
  function stopAll() {
    generation++; cancel();
    for (const track of tracks) stopVoice(track,tracks);
    for (const request of requests.values()) request.controller.abort();
    requests.clear();
  }
  function loopPoints(buffer,variant) {
    const period = variant.logicalPeriodSeconds ?? variant.loopEnd-variant.loopStart;
    const frames = Math.round(period*buffer.sampleRate);
    const priming = Math.round((variant.decodedPrimingSamples || 0)*buffer.sampleRate/variant.sampleRate);
    const padding = Math.round((variant.trailingPaddingSamples || 0)*buffer.sampleRate/variant.sampleRate);
    const excess = buffer.length-frames;
    const tolerance = 2;
    let start;
    if (Math.abs(excess-priming-padding) <= tolerance) start = Math.max(0,excess-padding);
    else if (Math.abs(excess-priming) <= tolerance) start = Math.max(0,excess);
    else if (Math.abs(excess-padding) <= tolerance || Math.abs(excess) <= tolerance) start = 0;
    else if (!variant.logicalPeriodSeconds && variant.loopEnd <= buffer.duration + tolerance/buffer.sampleRate) start = Math.round(variant.loopStart*buffer.sampleRate);
    else throw new Error('Decoded loop frames differ from logical period and codec priming');
    if (frames <= 0 || start+frames > buffer.length+tolerance) throw new Error('Invalid decoded loop range');
    return {start:start/buffer.sampleRate,end:Math.min(buffer.length,start+frames)/buffer.sampleRate,periodFrames:frames,primingFrames:start};
  }
  async function load(id) {
    if (buffers.has(id)) return buffers.get(id);
    if (requests.has(id)) return requests.get(id).promise;
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(new DOMException('Audio request timed out','TimeoutError')),5000);
    const request = {controller};
    request.promise = (async function () {
      for (const variant of bridge.audio[id] || []) {
        try {
          const response = await fetch(variant.url,{signal:controller.signal});
          if (!response.ok) throw new Error('Audio HTTP '+response.status);
          const encoded = await response.arrayBuffer();
          let buffer = await context.decodeAudioData(encoded.slice(0)), nativeDecodeFallback = false;
          if (controller.signal.aborted) return null;
          const missing = Math.round((variant.logicalPeriodSeconds || 0)*buffer.sampleRate)-buffer.length;
          if (missing > 0 && missing <= 2 && buffer.sampleRate !== variant.sampleRate) {
            const decoder = new OfflineAudioContext(variant.channels || 2,1,variant.sampleRate);
            buffer = await decoder.decodeAudioData(encoded); nativeDecodeFallback = true;
            if (controller.signal.aborted) return null;
          }
          const loop = Object.values(routes).includes(id) ? loopPoints(buffer,variant) : null;
          unavailable = false;
          const decoded = {buffer,loop}; buffers.set(id,decoded);
          diagnostics.decoded.push({id,url:variant.url,mime:variant.mime,sampleRate:buffer.sampleRate,outputSampleRate:context.sampleRate,nativeDecodeFallback,frames:buffer.length,loop});
          return decoded;
        } catch (failure) {
          if (controller.signal.aborted) {
            if (controller.signal.reason?.name !== 'TimeoutError') return null;
            error(id,controller.signal.reason); break;
          }
          error(id,failure);
        }
      }
      unavailable = true; updateControls();
      return null;
    }()).finally(function () { clearTimeout(timeout); if (requests.get(id) === request) requests.delete(id); });
    requests.set(id,request); return request.promise;
  }
  function curve(fadeIn,scale) {
    return Float32Array.from({length:65},(_,i)=>(fadeIn ? Math.sin(i/64*Math.PI/2) : Math.cos(i/64*Math.PI/2))*scale);
  }
  async function music() {
    const token = ++generation, id = route;
    if (!usable() || bgmGain === 0) return;
    const decoded = await load(id);
    if (!decoded || token !== generation || !usable() || bgmGain === 0) return;
    if ([...tracks].some(track=>track.id === id && !track.ending)) return;
    // Finish a previous transition before starting another: never more than two sources.
    for (const track of tracks) if (track.ending) stopVoice(track,tracks);
    const now = context.currentTime, previous = [...tracks][0];
    if (previous) {
      previous.ending = true;
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueCurveAtTime(curve(false,previous.gain.gain.value),now,mix.transitionSeconds);
      previous.source.stop(now+mix.transitionSeconds);
    }
    const source = context.createBufferSource(), node = context.createGain();
    source.buffer = decoded.buffer; source.loop = true;
    source.loopStart = decoded.loop.start; source.loopEnd = decoded.loop.end;
    source.connect(node); node.connect(bgmBus);
    const track = {id,source,gain:node,ending:false}; tracks.add(track);
    node.gain.setValueAtTime(previous ? 0 : 1,now);
    if (previous) node.gain.setValueCurveAtTime(curve(true,1),now,mix.transitionSeconds);
    source.onended = function () { tracks.delete(track); source.disconnect(); node.disconnect(); };
    source.start(now,decoded.loop.start);
    diagnostics.maxTracks = Math.max(diagnostics.maxTracks,tracks.size);
  }
  function duck() {
    const now = context.currentTime, active = [...voices].filter(v=>v.grand);
    const end = Math.max(now,...active.map(v=>v.end));
    duckBus.gain.cancelAndHoldAtTime(now);
    duckBus.gain.linearRampToValueAtTime(active.length ? Math.pow(10,mix.grandDuckDb/20) : 1,now+(active.length ? .15 : .4));
    if (active.length) {
      duckBus.gain.setValueAtTime(Math.pow(10,mix.grandDuckDb/20),Math.max(now+.15,end));
      duckBus.gain.linearRampToValueAtTime(1,Math.max(now+.15,end)+.4);
    }
  }
  async function play(id) {
    if (!usable() || sfxGain === 0 || !Object.hasOwn(bridge.audio,id) || Object.values(routes).includes(id)) return false;
    const started = performance.now(), token = cueGeneration;
    if (id.startsWith('ui.')) { if (started-lastUi < 100) return false; lastUi = started; }
    const decoded = await load(id);
    if (!decoded || token !== cueGeneration || !usable() || sfxGain === 0 || performance.now()-started > 1500) return false;
    if (voices.size >= mix.maxSfxVoices) stopVoice(voices.values().next().value,voices);
    const source = context.createBufferSource(); source.buffer = decoded.buffer; source.connect(sfxBus);
    const voice = {id,source,grand:grand.has(id),end:context.currentTime+decoded.buffer.duration}; voices.add(voice);
    source.onended = function () { voices.delete(voice); source.disconnect(); if (voice.grand) duck(); };
    source.start(); duck(); diagnostics.startedCues++;
    diagnostics.maxVoices = Math.max(diagnostics.maxVoices,voices.size); return true;
  }
  function createContext() {
    context = new (window.AudioContext || window.webkitAudioContext)();
    master = context.createGain(); bgmBus = context.createGain(); sfxBus = context.createGain(); duckBus = context.createGain();
    master.gain.value = mix.masterSafetyGain; bgmBus.gain.value = bgmGain; sfxBus.gain.value = sfxGain;
    bgmBus.connect(duckBus); duckBus.connect(master); sfxBus.connect(master); master.connect(context.destination);
    context.addEventListener('statechange',function () {
      if (context.state !== 'running' && !hidden && !muted) { recovery = true; stopAll(); }
      updateControls();
    });
  }
  async function resume() {
    if (!activated || !optedIn || muted || hidden) return;
    try {
      const pending = context.resume();
      const resumed = await Promise.race([pending.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),1200))]);
      if (!resumed || context.state !== 'running') throw new Error('Audio resume needs a user gesture');
      recovery = false;
      if (!usable()) return;
      await music();
    } catch (failure) { error('resume',failure); recovery = true; }
    updateControls();
  }
  function enable() {
    optedIn = true; muted = false; activated = true;
    try { if (!context) createContext(); }
    catch (failure) { error('context',failure); recovery = true; updateControls(); return; }
    persist(); notice.hidden = true; return resume();
  }
  function setMute(value) {
    muted = Boolean(value); persist();
    if (muted) { stopAll(); if (context) context.suspend().catch(failure=>error('suspend',failure)); }
    else if (activated) resume();
    updateControls();
  }
  function setGain(category,value) {
    if (category === 'bgm') {
      bgmGain = gain(value,bgmGain); if (bgmBus) bgmBus.gain.value = bgmGain;
      if (!bgmGain) { generation++; for (const track of tracks) stopVoice(track,tracks); } else if (usable() && !tracks.size) music();
    } else if (category === 'sfx') { sfxGain = gain(value,sfxGain); if (sfxBus) sfxBus.gain.value = sfxGain; if (!sfxGain) cancel(); }
    else return;
    persist(); updateControls();
  }
  function setRoute(name) {
    route = routes[name] || 'workshop'; cancel(); music();
  }
  function changeRoute() { setRoute(location.hash.slice(1)); }
  function visibility() {
    hidden = document.hidden;
    if (hidden) { stopAll(); if (context) context.suspend().catch(failure=>error('suspend',failure)); }
    else resume();
    updateControls();
  }
  function mount() {
    controls = document.createElement('section'); controls.id = 'gameAudioControls'; controls.setAttribute('aria-label','소리 설정');
    controls.innerHTML = '<h3>소리</h3><button type="button" class="btn-sub" data-audio-enable>소리 켜기</button><label><input type="checkbox" data-audio-mute> 전체 무음</label><p><label>배경음 <input type="range" min="0" max="100" step="1" data-audio-bgm> <output data-audio-bgm-value></output></label></p><p><label>효과음 <input type="range" min="0" max="100" step="1" data-audio-sfx> <output data-audio-sfx-value></output></label></p><p role="status" data-audio-status></p>';
    for (const label of controls.querySelectorAll('label')) {
      Object.assign(label.style,{display:'flex',alignItems:'center',gap:'.5rem',minHeight:'44px'});
    }
    for (const range of controls.querySelectorAll('input[type="range"]')) range.style.height = '44px';
    (document.getElementById('settingsAudioSlot') || document.querySelector('.settings-panel') || document.body).append(controls);
    notice = document.createElement('section'); notice.id = 'gameAudioChoice'; notice.setAttribute('aria-label','소리 선택');
    notice.innerHTML = '<p>소리와 함께 공방을 둘러보세요.</p><button type="button" class="btn-sub" data-audio-enable>소리 켜기</button> <button type="button" class="btn-sub" data-audio-silent>무음으로 계속</button>';
    (document.querySelector('main') || document.body).prepend(notice);
    notice.hidden = optedIn;
    for (const button of document.querySelectorAll('[data-audio-enable]')) button.addEventListener('click',enable);
    notice.querySelector('[data-audio-silent]').addEventListener('click',function () { notice.hidden = true; setMute(true); });
    controls.querySelector('[data-audio-mute]').addEventListener('change',event=>setMute(event.target.checked));
    for (const name of ['bgm','sfx']) controls.querySelector('[data-audio-'+name+']').addEventListener('input',event=>setGain(name,Number(event.target.value)/100));
    updateControls();
  }
  function boot(value) {
    if (bridge) return;
    bridge = Object.freeze({audio:Object.freeze(Object.fromEntries(Object.entries(value.audio).map(([id,variants])=>[id,Object.freeze(variants.map(variant=>Object.freeze({...variant})))])))});
    mix = bridge.audio.workshop[0].mix || {masterSafetyGain:.85,defaultBgmGain:.3,defaultSfxGain:.6,maxSfxVoices:6,transitionSeconds:.4,grandDuckDb:-6};
    const saved = prefs().audio || {};
    optedIn = saved.optedIn === true; muted = saved.muted === true;
    bgmGain = gain(saved.bgmGain,mix.defaultBgmGain); sfxGain = gain(saved.sfxGain,mix.defaultSfxGain);
    hidden = document.hidden; mount(); changeRoute();
    window.addEventListener('hashchange',changeRoute);
    window.addEventListener('popstate',changeRoute);
    document.addEventListener('click',function (event) {
      if (event.target.closest('.destination-nav a[href]') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) changeRoute();
    });
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',function () { hidden = true; stopAll(); if (context) context.suspend().catch(failure=>error('suspend',failure)); });
    window.addEventListener('pageshow',visibility);
  }
  function snapshot() {
    return JSON.parse(JSON.stringify({optedIn,muted,activated,hidden,recovery,bgmGain,sfxGain,route,cueGeneration,state:context?.state || 'uncreated',currentTime:context?.currentTime || 0,sampleRate:context?.sampleRate || null,tracks:[...tracks].map(t=>({id:t.id,ending:t.ending,loopStart:t.source.loopStart,loopEnd:t.source.loopEnd})),voices:[...voices].map(v=>v.id),duckGain:duckBus?.gain.value ?? 1,masterGain:master?.gain.value ?? null,...diagnostics}));
  }
  return Object.freeze({boot,play,cancel,setMute,setGain,setRoute,snapshot});
}());
