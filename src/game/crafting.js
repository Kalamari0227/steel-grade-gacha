var GAME_CRAFTING = (function () {
  'use strict';
  let catalog, assets, positions, materialIds, current = null, overview = null, generation = 0;
  const duration = 1100;
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function keys(input) {
    if (!Array.isArray(input) || new Set(input).size !== input.length || input.some(key=>!catalog.has(key))) throw new TypeError('Invalid completed part keys');
    return input.slice();
  }
  function reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function valid(session) { return current === session && session.token === generation && session.host.isConnected; }
  function cue(session, id) {
    if (!valid(session) || session.reduced || document.hidden || session.sound.generation !== GAME_AUDIO.snapshot().cueGeneration) return;
    session.audioOwned = true;
    try {
      Promise.resolve(GAME_AUDIO.play(id)).catch(function () { if (valid(session)) session.audioFailed = true; });
    } catch (error) { session.audioFailed = true; }
  }
  function stop(session) {
    generation++;
    session.timers.forEach(clearTimeout); session.timers.clear();
    if (session.audioOwned) { GAME_AUDIO.cancel(); session.audioOwned = false; }
  }
  function image(owner, host, assetId, label, className) {
    const asset = assets[assetId], wrapper = node('div','craft-art ' + (className || ''));
    const picture = node('img'), fallback = node('div','craft-art-fallback',label + ' 그림을 불러오지 못했어요.');
    const retry = node('button','','그림 다시 시도'); retry.type = 'button'; retry.setAttribute('aria-label',label + ' 그림 다시 시도');
    picture.alt = ''; picture.width = assetId.startsWith('scene:') ? 1440 : 768; picture.height = assetId.startsWith('scene:') ? 960 : 768; picture.draggable = false;
    fallback.append(retry); fallback.hidden = true; wrapper.append(picture); host.append(wrapper); owner.root.append(fallback);
    let attempt = 0, request = null, objectURL = null;
    function releaseURL() { if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; } }
    function load() {
      if (owner.disposed) return;
      if (request) request.abort(); releaseURL();
      const token = ++attempt;
      const active = function () { return !owner.disposed && token === attempt; };
      wrapper.dataset.status = 'loading'; fallback.hidden = true; picture.hidden = false;
      picture.onload = function () { if (active()) { releaseURL(); wrapper.dataset.status = 'ready'; } };
      picture.onerror = function () {
        if (!active()) return;
        releaseURL(); wrapper.dataset.status = 'error'; picture.hidden = true; fallback.hidden = false;
      };
      if (token === 1) { picture.src = asset.url; return; }
      request = new AbortController();
      fetch(asset.url,{cache:'reload',signal:request.signal}).then(function (response) {
        if (!response.ok) throw new Error('Artwork request failed');
        return response.blob();
      }).then(function (blob) {
        if (!active()) return;
        objectURL = URL.createObjectURL(blob); picture.src = objectURL;
      }).catch(function () { if (active()) picture.onerror(); });
    }
    retry.addEventListener('click',load);
    owner.cleanups.push(function () { attempt++; if (request) request.abort(); releaseURL(); picture.onload = picture.onerror = null; picture.removeAttribute('src'); retry.removeEventListener('click',load); });
    load(); return wrapper;
  }
  function dispose(owner) {
    owner.disposed = true; owner.cleanups.forEach(clean=>clean()); owner.cleanups.length = 0;
    owner.root.remove();
  }
  function board(owner, host, completed, selected) {
    const scene = node('figure','craft-assembly-board'); scene.setAttribute('aria-label','만든 부품의 개략 조립 위치');
    host.append(scene);
    image(owner,scene,'scene:crafting:back','제작 작업대','craft-scene-back');
    const map = node('div','craft-assembly-map'); scene.append(map);
    const ordered = completed.slice().sort((a,b)=>positions.get(a).layer-positions.get(b).layer);
    ordered.forEach(function (key) {
      const part = catalog.get(key), row = positions.get(key), slot = node('div','craft-assembly-part');
      slot.dataset.assemblyPart = key; slot.dataset.selected = String(key === selected);
      slot.style.setProperty('--craft-part-width',row.bounds.width*100+'cqw');
      slot.style.setProperty('--craft-part-height',row.bounds.height*100+'cqh');
      Object.assign(slot.style,{left:row.bounds.x*100+'%',top:row.bounds.y*100+'%',width:row.bounds.width*100+'%',height:row.bounds.height*100+'%',zIndex:String(row.layer)});
      if (key === selected) {
        slot.style.setProperty('--craft-focus-scale',Math.min(1.8,.82/Math.max(row.bounds.width,row.bounds.height*.61)));
        slot.style.setProperty('--craft-travel-x',((.5-row.bounds.x-row.bounds.width/2)/row.bounds.width)*100+'%');
        slot.style.setProperty('--craft-travel-y',((.5-row.bounds.y-row.bounds.height/2)/row.bounds.height)*100+'%');
      }
      image(owner,slot,'part:'+key,part.name); map.append(slot);
    });
    image(owner,scene,'scene:crafting:foreground','작업대 도구','craft-scene-front');
    const caption = node('figcaption','craft-assembly-caption');
    caption.append(node('span','','앞'),node('span','','부품 위치도 · 개략 배치'),node('span','','뒤')); scene.append(caption);
    if (!completed.length) scene.append(node('p','craft-assembly-empty','아직 만든 부품이 없어요. 소재를 모아 첫 부품을 만들어 보세요.'));
    return scene;
  }
  function renderOverview(host, completed, selected) {
    if (!catalog) throw new Error('Craft presentation requires boot');
    const done = keys(completed);
    if (selected != null && !catalog.has(selected)) throw new TypeError('Unknown selected part');
    clearOverview();
    const root = node('section','craft-workbench'); const owner = {root:root,cleanups:[],disposed:false}; overview = owner;
    const heading = node('div','craft-workbench-heading');
    heading.append(node('h3','','자동차 한 대를 향해'),node('p','',done.length+' / '+catalog.size+'개 부품 완성'));
    root.append(heading); board(owner,root,done,selected);
    const next = node('a','craft-garage-link',done.length === catalog.size ? '모든 부품 완성 · 차고에서 자동차 선택하기' : '차고에서 조립 진행 보기');
    next.href = '#garage'; root.append(next); host.replaceChildren(root);
  }
  function clearOverview() { if (overview) { dispose(overview); overview = null; } }
  function phase(session, name) {
    if (!valid(session)) return;
    session.phase = name; session.root.dataset.phase = name;
    const text = {material:'선택한 소재를 작업대에 올리고 있어요',form:'소재를 부품으로 성형하고 있어요',place:'완성된 부품을 조립 위치에 놓고 있어요',complete:session.result.name+' 완성 · '+session.result.completed.length+' / '+catalog.size+'개'};
    session.status.textContent = text[name];
  }
  function later(session, delay, callback) {
    const token = session.token;
    const timer = setTimeout(function () {
      session.timers.delete(timer);
      if (valid(session) && token === generation && session.busy && !document.hidden) callback();
    },delay);
    session.timers.add(timer);
  }
  function finish(skip) {
    const session = current;
    if (!session || !session.busy) return;
    if (skip) { stop(session); session.token = generation; }
    else { session.timers.forEach(clearTimeout); session.timers.clear(); }
    session.busy = false; phase(session,'complete');
    const focused = document.activeElement === session.skip;
    session.skip.hidden = true; session.materials.hidden = true;
    if (focused) session.status.focus({preventScroll:true});
    if (!skip) cue(session,'craft.complete');
  }
  function cancel() {
    if (!current) return;
    const session = current; stop(session); current = null; dispose(session);
  }
  function start(host, input) {
    if (!catalog) throw new Error('Craft presentation requires boot');
    if (!input || !catalog.has(input.partKey) || !Array.isArray(input.materials) || input.materials.some(row=>!row || !materialIds.has(row.id) || typeof row.label !== 'string' || typeof row.free !== 'boolean')) throw new TypeError('Invalid craft result snapshot');
    const completed = keys(input.completed);
    if (!completed.includes(input.partKey)) throw new TypeError('Craft result must already contain completed part');
    const result = freeze({partKey:input.partKey,name:catalog.get(input.partKey).name,completed:completed,materials:input.materials.map(row=>({id:row.id,label:row.label,free:row.free}))});
    cancel();
    const root = node('section','craft-assembly-result'); root.dataset.craftResult = result.partKey;
    const session = {root:root,host:host,result:result,cleanups:[],timers:new Set(),disposed:false,token:++generation,busy:true,phase:'material',reduced:reduced(),audioOwned:false,audioFailed:false};
    const sound = GAME_AUDIO.snapshot(); session.sound = {generation:sound.cueGeneration};
    current = session; host.replaceChildren(root);
    session.status = node('p','craft-assembly-status'); session.status.setAttribute('role','status'); session.status.tabIndex = -1;
    const actions = node('div','craft-assembly-actions'); session.skip = node('button','','바로 완성 보기'); session.skip.type = 'button'; session.skip.dataset.craftSkip = '';
    const skip = function () { if (valid(session)) finish(true); };
    session.skip.addEventListener('click',skip); session.cleanups.push(()=>session.skip.removeEventListener('click',skip));
    actions.append(session.status,session.skip); root.append(actions);
    board(session,root,result.completed,result.partKey);
    session.materials = node('ul','craft-assembly-materials');
    result.materials.forEach(function (material) { const row=node('li','',material.label+(material.free?' · QP 무소모':' · 재고 1장 사용')); row.dataset.materialId=material.id; session.materials.append(row); });
    root.append(session.materials); phase(session,'material');
    if (session.reduced || document.hidden) finish(true);
    else {
      cue(session,'craft.material');
      later(session,300,function () { phase(session,'form'); cue(session,'craft.work'); });
      later(session,650,function () { phase(session,'place'); });
      later(session,duration,function () { finish(false); });
    }
    return Object.freeze({skip:function(){if(current===session)finish(true);},dispose:function(){if(current===session)cancel();}});
  }
  function boot(value) {
    if (catalog) return;
    if (!value || !Array.isArray(value.parts) || !Array.isArray(value.assembly) || !Array.isArray(value.cardIds) || !value.assets) throw new TypeError('Craft readonly catalog required');
    const parts = new Map(value.parts.map(part=>[part.key,Object.freeze({key:part.key,name:part.name,grp:part.grp})]));
    const rows = new Map(value.assembly.map(row=>[row.partKey,freeze(JSON.parse(JSON.stringify(row)))]));
    if (parts.size !== 35 || value.parts.length !== 35 || rows.size !== 35 || value.assembly.length !== 35 || [...rows].some(([key,row])=>!parts.has(key) || row.assetId!=='part:'+key || !row.bounds || !['x','y','width','height'].every(field=>Number.isFinite(row.bounds[field])) || row.bounds.x<0 || row.bounds.y<0 || row.bounds.width<=0 || row.bounds.height<=0 || row.bounds.x+row.bounds.width>1 || row.bounds.y+row.bounds.height>1 || !Number.isFinite(row.layer))) throw new TypeError('Invalid craft assembly catalog');
    const ids = [...parts.keys()].map(key=>'part:'+key).concat(['scene:crafting:back','scene:crafting:foreground']);
    if (ids.some(id=>!value.assets[id] || typeof value.assets[id].url!=='string')) throw new TypeError('Missing craft artwork');
    catalog = parts; positions = rows; assets = value.assets; materialIds = new Set(value.cardIds);
    document.addEventListener('visibilitychange',function () { if (document.hidden) cancel(); });
    window.addEventListener('pagehide',cancel);
  }
  function snapshot() {
    return {ready:Boolean(catalog),active:Boolean(current),busy:Boolean(current?.busy),phase:current?.phase || null,generation:generation,partKey:current?.result.partKey || null,pendingTimerCount:current?.timers.size || 0,imageCount:current?.root.querySelectorAll('img').length || 0,cleanupCount:current?.cleanups.length || 0,overviewImageCount:overview?.root.querySelectorAll('img').length || 0,audioFailed:Boolean(current?.audioFailed)};
  }
  return Object.freeze({boot:boot,renderOverview:renderOverview,clearOverview:clearOverview,start:start,finish:finish,cancel:cancel,snapshot:snapshot});
}());
