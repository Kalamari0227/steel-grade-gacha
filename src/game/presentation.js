var GAME_PRESENTATION = (function () {
  'use strict';
  var bridge;
  function fail(message) { throw new Error('Card compositor: ' + message); }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function rect(value) {
    return value && ['x','y','width','height'].every(function (key) { return finite(value[key]); }) && value.x >= 0 && value.y >= 0 && value.width > 0 && value.height > 0 && value.x + value.width <= 1 && value.y + value.height <= 1;
  }
  function placementValid(row, face) {
    return rect(row.rect) && row.pivot && ['x','y'].every(function (key) { return finite(row.pivot[key]) && row.pivot[key] >= 0 && row.pivot[key] <= 1; }) && finite(row.rotation) && Math.abs(row.rotation) <= 180 && [10,40].includes(row.z) && Object.hasOwn(face.anchors,row.anchor) && row.occlusionMask === null;
  }
  function model(input) {
    if (!bridge) fail('boot required');
    if (!input || typeof input.cardId !== 'string' || !['front','alt'].includes(input.side)) fail('explicit cardId and side required');
    var character = bridge.findChar(input.cardId);
    var face = GAME_CONFIG.faces.find(function (row) { return row.cardId === input.cardId && row.side === input.side; });
    if (!character || !face) fail('unknown face');
    var state = input.state || bridge.getState();
    if (!state || !state.owned || !state.items) fail('invalid state');
    var discovered = Boolean(state.owned[input.cardId]);
    var compatible = bridge.items.filter(function (item) { return item.fit(character); });
    var equipped = discovered ? compatible.filter(function (item) { return state.items[item.key] === input.cardId; }) : [];
    if (input.previewItem != null) {
      var preview = compatible.find(function (item) { return item.key === input.previewItem; });
      if (!preview || !discovered || (state.items[preview.key] !== 1 && state.items[preview.key] !== input.cardId)) fail('unavailable preview');
      if (!equipped.some(function (item) { return item.key === preview.key; })) equipped.push(preview);
    }
    var placements = equipped.map(function (item) {
      var row = GAME_CONFIG.placements.find(function (p) { return p.cardId === input.cardId && p.side === input.side && p.itemKey === item.key; });
      if (!row || !placementValid(row,face)) fail('invalid placement: ' + item.key);
      return {item:item,placement:row};
    });
    return {character:character,face:face,discovered:discovered,placements:placements,previewItem:input.previewItem || null};
  }
  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function image(parent, id, label, pending, cleanups, notify) {
    var asset = GAME_CONFIG.assets[id], holder = node('div','game-card-art'), img = node('img');
    holder.dataset.asset = id; img.alt = ''; img.draggable = false;
    var fallback = node('div','game-card-fallback'), message = node('span','',label + ' 그림을 불러오지 못했습니다.'), retry = node('button','','다시 시도');
    retry.type = 'button'; retry.setAttribute('aria-label',label + ' 그림 다시 시도');
    fallback.append(message,retry); fallback.hidden = true; holder.append(img,fallback); parent.append(holder);
    var attempt = 0, disposed = false, settle, request, objectURL;
    function status(value) { holder.dataset.status = value; notify(); }
    function releaseURL() { if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; } }
    cleanups.push(function () {
      disposed = true; attempt++; if (request) request.abort(); releaseURL();
      img.onload = img.onerror = null; img.removeAttribute('src'); retry.removeEventListener('click',load);
      if (settle) settle(false);
    });
    function load() {
      if (disposed) return Promise.resolve(false);
      if (settle) settle(false);
      if (request) request.abort(); releaseURL();
      var generation = ++attempt;
      fallback.hidden = true; img.hidden = false; status('loading');
      return new Promise(function (resolve) {
        settle = resolve;
        function active() { return !disposed && generation === attempt && holder.isConnected; }
        img.onload = function () { if (!active()) { resolve(false); return; } releaseURL(); status('ready'); resolve(true); };
        img.onerror = function () { if (!active()) { resolve(false); return; } releaseURL(); img.hidden = true; fallback.hidden = false; status('error'); resolve(false); };
        if (!asset || !asset.url) { queueMicrotask(function () { if (img.onerror) img.onerror(); }); return; }
        if (generation === 1) { img.src = asset.url; return; }
        request = new AbortController();
        fetch(asset.url,{cache:'reload',signal:request.signal}).then(function (response) {
          if (!response.ok) throw new Error('Artwork request failed');
          return response.blob();
        }).then(function (blob) {
          if (!active()) { resolve(false); return; }
          objectURL = URL.createObjectURL(blob); img.src = objectURL;
        }).catch(function () { if (generation === attempt && img.onerror) img.onerror(); else resolve(false); });
      });
    }
    retry.addEventListener('click',load); pending.push(load()); return holder;
  }
  function render(input) {
    var data = model(input), pending = [], cleanups = [], card = node('figure','game-card');
    var listeners = new Set(), disposed = false;
    function status() {
      var counts = {loading:0,error:0,ready:0};
      card.querySelectorAll('.game-card-art').forEach(function (holder) { counts[holder.dataset.status]++; });
      return Object.freeze(counts);
    }
    function notify() { if (!disposed) { var current = status(); listeners.forEach(function (listener) { listener(current); }); } }
    function onStatus(listener) {
      if (disposed) return function () {};
      listeners.add(listener); listener(status());
      return function () { listeners.delete(listener); };
    }
    var stage = input.variant === 'stage';
    if (input.variant != null && !['card','stage'].includes(input.variant)) fail('unknown variant');
    card.dataset.variant = stage ? 'stage' : 'card';
    card.dataset.cardId = input.cardId; card.dataset.side = input.side; card.dataset.discovered = String(data.discovered);
    card.setAttribute('aria-label',(data.character.name || data.character.code || input.cardId) + (input.side === 'alt' ? ' 열처리 후' : ''));
    var layers = {};
    ['background','rear-equipment','plinth','character','front-equipment','frame','foil','text'].forEach(function (name) {
      var layer = node(name === 'text' ? 'figcaption' : 'div','game-card-layer game-card-' + name); layer.dataset.layer = name; layers[name] = layer; card.append(layer);
    });
    if (!stage) image(layers.background,data.face.background,'계열 배경',pending,cleanups,notify);
    image(layers.plinth,'stage:plinth','받침',pending,cleanups,notify);
    image(layers.character,data.face.character,data.character.name || input.cardId,pending,cleanups,notify);
    data.placements.forEach(function (entry) {
      var p = entry.placement, target = node('div','game-card-equipment'); target.dataset.item = entry.item.key; target.dataset.anchor = p.anchor;
      target.dataset.preview = String(entry.item.key === data.previewItem);
      Object.assign(target.style,{left:p.rect.x*100+'%',top:p.rect.y*100+'%',width:p.rect.width*100+'%',height:p.rect.height*100+'%',transformOrigin:p.pivot.x*100+'% '+p.pivot.y*100+'%',transform:'rotate('+p.rotation+'deg)'});
      layers[p.z === 10 ? 'rear-equipment' : 'front-equipment'].append(target);
      image(target,'item:'+entry.item.key,entry.item.name,pending,cleanups,notify);
    });
    if (!stage) image(layers.frame,data.face.frame,'카드 프레임',pending,cleanups,notify);
    layers.foil.dataset.special = String(data.face.frame === 'frame:special');
    var title = node('strong','game-card-name',data.character.code || input.cardId);
    var detail = node('span','game-card-detail',(data.character.fam && data.character.fam.name || data.face.family) + ' · ' + (data.discovered ? '발견' : '미발견') + (input.side === 'alt' ? ' · 열처리 후' : ''));
    layers.text.append(title,detail);
    var equipmentText = node('span','game-card-accessible',data.placements.map(function (entry) { return entry.item.name; }).join(', ')); layers.text.append(equipmentText);
    return Object.freeze({element:card,ready:Promise.all(pending),onStatus:onStatus,cardId:input.cardId,side:input.side,items:Object.freeze(data.placements.map(function (entry) { return entry.item.key; })),dispose:function () { disposed = true; listeners.clear(); cleanups.forEach(function (clean) { clean(); }); card.remove(); }});
  }
  function boot(value) {
    if (bridge) return;
    if (!value || typeof value.findChar !== 'function' || !Array.isArray(value.items)) fail('readonly catalog bridge required');
    bridge = value;
  }
  return Object.freeze({boot:boot,render:render,model:model});
}());
