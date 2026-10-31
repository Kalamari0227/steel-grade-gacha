var GAME_GARAGE = (function () {
  'use strict';
  let assets, cars, stage = null, detail = null, generation = 0;
  const duration = 1500;
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function image(owner, host, assetId) {
    const asset = assets[assetId], wrapper = node('div','garage-art'), picture = node('img');
    const label = assetId.startsWith('car:') ? cars.get(assetId.slice(4)).body : '차고 전시대';
    picture.alt = label; picture.draggable = false;
    const dimensions = assetId.startsWith('car:') ? [1200,800] : assetId === 'stage:plinth' ? [960,320] : [1440,960];
    picture.width = dimensions[0]; picture.height = dimensions[1];
    const fallback = node('p','garage-art-fallback',label+' 그림을 불러오지 못했어요. '), retry = node('button','','그림 다시 시도');
    retry.type = 'button'; retry.setAttribute('aria-label',label+' 그림 다시 시도'); fallback.append(retry); fallback.hidden = true;
    wrapper.dataset.asset = assetId; wrapper.append(picture); host.append(wrapper); owner.root.append(fallback);
    let attempt = 0, request = null, objectURL = null;
    function releaseURL() { if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; } }
    function load() {
      if (owner.disposed) return;
      if (request) request.abort(); releaseURL(); const token = ++attempt;
      const active = ()=>!owner.disposed && token === attempt;
      wrapper.dataset.status = 'loading'; picture.hidden = false; fallback.hidden = true;
      picture.onload = function () { if (active()) { releaseURL(); wrapper.dataset.status = 'ready'; } };
      picture.onerror = function () { if (active()) { releaseURL(); picture.hidden = true; fallback.hidden = false; wrapper.dataset.status = 'error'; } };
      if (token === 1) { picture.src = asset.url; return; }
      request = new AbortController();
      fetch(asset.url,{cache:'reload',signal:request.signal}).then(function (response) {
        if (!response.ok) throw new Error('Car artwork request failed'); return response.blob();
      }).then(function (blob) { if (active()) { objectURL = URL.createObjectURL(blob); picture.src = objectURL; } })
        .catch(function () { if (active()) picture.onerror(); });
    }
    retry.addEventListener('click',load);
    owner.cleanups.push(function () { attempt++; if (request) request.abort(); releaseURL(); picture.onload = picture.onerror = null; picture.removeAttribute('src'); retry.removeEventListener('click',load); });
    load(); return wrapper;
  }
  function dispose(owner) {
    owner.disposed = true; owner.cleanups.forEach(clean=>clean()); owner.cleanups.length = 0; owner.root.remove();
  }
  function clearDetail() { if (detail) { dispose(detail); detail = null; } }
  function showDetail(host, key) {
    if (!cars.has(key)) throw new TypeError('Unknown car');
    clearDetail(); const root = node('div','garage-detail-art'); detail = {root,cleanups:[],disposed:false}; host.append(root); image(detail,root,'car:'+key);
  }
  function stop() {
    if (!stage) return;
    stage.timers.forEach(clearTimeout); stage.timers.clear();
    if (stage.audioOwned && performance.now() < stage.audioUntil) GAME_AUDIO.cancel();
    stage.audioOwned = false;
  }
  function clearStage() { if (stage) { stop(); dispose(stage); stage = null; generation++; } }
  function cancel() { clearStage(); clearDetail(); }
  function cue(session,id) {
    if (stage !== session || session.disposed || document.hidden || session.reduced || session.sound.generation !== GAME_AUDIO.snapshot().cueGeneration) return;
    session.audioOwned = true; session.audioUntil = performance.now()+2400;
    try { Promise.resolve(GAME_AUDIO.play(id)).then(function (played) { if (stage === session && !played) session.audioOwned = false; }).catch(function () { if (stage === session) { session.audioOwned = false; session.audioFailed = true; } }); }
    catch (_) { session.audioOwned = false; session.audioFailed = true; }
  }
  function later(session,delay,action) {
    const token = session.token, timer = setTimeout(function () {
      session.timers.delete(timer);
      if (stage === session && !session.disposed && token === generation && session.root.isConnected && !document.hidden) action();
    },delay); session.timers.add(timer);
  }
  function finish(skip) {
    if (!stage || !stage.busy) return;
    const session = stage;
    if (skip) stop();
    session.busy = false; session.root.dataset.phase = 'complete';
    session.status.textContent = cars.get(session.key).tag+' · 차고에 등록했어요';
    if (document.activeElement === session.skip) session.status.focus({preventScroll:true});
    session.skip.hidden = true;
    if (!skip) {
      cue(session,'garage.complete');
    }
  }
  function showStage(host, key, reveal) {
    if (key != null && !cars.has(key)) throw new TypeError('Unknown car');
    if (stage && stage.key === key && !reveal) return;
    clearStage();
    const root = node('section','garage-showroom');
    const session = {root,key,cleanups:[],timers:new Set(),disposed:false,busy:!!reveal,token:++generation,audioOwned:false,audioFailed:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
    const sound = GAME_AUDIO.snapshot(); session.sound = {generation:sound.cueGeneration};
    stage = session; host.replaceChildren(root); root.dataset.car = key || ''; root.dataset.phase = reveal ? 'light' : 'display';
    const scene = node('figure','garage-scene'); scene.setAttribute('aria-label',key ? cars.get(key).body+' 전시' : '첫 자동차를 기다리는 빈 전시대'); root.append(scene);
    image(session,scene,'scene:garage:back').classList.add('garage-scene-back');
    image(session,scene,'stage:plinth').classList.add('garage-plinth');
    if (key) image(session,scene,'car:'+key).classList.add('garage-scene-car');
    image(session,scene,'scene:garage:foreground').classList.add('garage-scene-front');
    const caption = node('div','garage-scene-caption');
    const title = node('h3','',key ? cars.get(key).tag : '비어 있는 전시대'); title.id = 'garageStageTitle'; title.tabIndex = -1;
    caption.append(node('p','home-eyebrow',key ? '나의 미니어처' : '첫 자동차를 기다리며'),title,node('p','',key ? cars.get(key).body : '35개 부품을 완성하고 나만의 차를 골라 보세요.')); root.append(caption);
    session.status = node('p','garage-reveal-status',reveal ? '조명을 켜고 자동차를 전시하고 있어요' : ''); session.status.setAttribute('role','status'); session.status.tabIndex = -1;
    session.skip = node('button','garage-secondary','바로 완성 보기'); session.skip.type = 'button'; session.skip.dataset.garageSkip = ''; session.skip.hidden = !reveal;
    const skip = ()=>finish(true); session.skip.addEventListener('click',skip); session.cleanups.push(()=>session.skip.removeEventListener('click',skip));
    root.append(session.status,session.skip);
    if (reveal) {
      if (session.reduced || document.hidden) finish(true);
      else {
        cue(session,'garage.assemble');
        later(session,450,function () { root.dataset.phase = 'turntable'; session.status.textContent = '완성한 자동차를 살펴보세요'; });
        later(session,duration,function () { finish(false); });
      }
    }
  }
  function boot(value) {
    if (cars) return;
    cars = new Map(value.cars.map(car=>[car.key,Object.freeze({key:car.key,tag:car.tag,body:car.body})])); assets = value.assets;
    document.addEventListener('visibilitychange',function () { if (document.hidden) cancel(); }); window.addEventListener('pagehide',cancel);
  }
  function snapshot() {
    return {ready:!!cars,active:!!stage,busy:!!stage?.busy,car:stage?.key || null,phase:stage?.root.dataset.phase || null,pendingTimerCount:stage?.timers.size || 0,detailActive:!!detail,imageCount:(stage?.root.querySelectorAll('img').length || 0)+(detail?.root.querySelectorAll('img').length || 0),audioFailed:!!stage?.audioFailed};
  }
  return Object.freeze({boot,showStage,showDetail,clearStage,clearDetail,cancel,finish,snapshot});
}());
