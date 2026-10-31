var GAME_COLLECTION = (function () {
  'use strict';
  var bridge, mode = 'grid', selected = '', side = 0, view, pointer, motion, neighbors = [];
  function el(id) { return document.getElementById(id); }
  function dispose() {
    if (motion) { motion.cancel(); motion = null; }
    if (view) { view.dispose(); view = null; }
    neighbors.forEach(function (card) { card.dispose(); }); neighbors = [];
  }
  function select(id) { if (selected !== id) { side = 0; el('galleryActionStatus').textContent = ''; } selected = id; }
  function move(delta) {
    var cards = bridge.filteredCards(), index = cards.findIndex(function (c) { return c.id === selected; });
    if (index + delta < 0 || index + delta >= cards.length) return;
    select(cards[index + delta].id); refresh();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      motion = el('galleryArt').animate([{transform:'translateX(' + delta * 24 + 'px)',opacity:.6},{transform:'translateX(0)',opacity:1}],{duration:180,easing:'ease-out'});
    }
  }
  function detail(section, trigger) {
    bridge.openCard(selected,side,trigger);
    if (section) el(section).click();
  }
  function neighbor(node, card) {
    node.replaceChildren();
    if (!card) return;
    node.inert = true;
    if (bridge.getState().owned[card.id]) {
      var hint = GAME_PRESENTATION.render({cardId:card.id,side:'front'});
      neighbors.push(hint); node.append(hint.element);
    } else node.textContent = '미발견';
  }
  function refresh() {
    if (!bridge) return;
    var cards = bridge.filteredCards(), state = bridge.getState();
    if (!cards.some(function (c) { return c.id === selected; })) select((cards.find(function (c) { return state.owned[c.id]; }) || cards[0] || {}).id || '');
    el('dex').hidden = mode !== 'grid'; el('dexGallery').hidden = mode !== 'gallery';
    el('view-dex').dataset.mode = mode;
    ['grid','gallery'].forEach(function (value) { el('dexMode' + (value === 'grid' ? 'Grid' : 'Gallery')).setAttribute('aria-pressed',String(value === mode)); });
    dispose();
    if (mode !== 'gallery' || document.body.dataset.route !== 'dex') return;
    var card = cards.find(function (c) { return c.id === selected; }), index = cards.indexOf(card);
    el('dexGallery').dataset.cardId = selected;
    el('galleryContent').hidden = !card; el('galleryEmpty').hidden = !!card;
    el('galleryPrev').disabled = index <= 0; el('galleryNext').disabled = index < 0 || index >= cards.length - 1;
    el('galleryPosition').textContent = card ? (index + 1) + ' / ' + cards.length : '0 / 0';
    el('galleryArt').replaceChildren(); neighbor(el('galleryBefore'),cards[index - 1]); neighbor(el('galleryAfter'),cards[index + 1]);
    if (!card) return;
    var found = !!state.owned[card.id], canFlip = found && !!card.alt;
    if (!canFlip) side = 0;
    el('dexGallery').dataset.side = side ? 'alt' : 'front';
    el('galleryTitle').textContent = found ? card.fam.name + ' · ' + card.g : card.fam.name + ' · 미발견';
    el('galleryMeta').textContent = found ? card.fam.abbr + ' · ' + card.fam.kind + ' · LV' + bridge.level(card) + ' · ' + bridge.levelName(card) : '발견 후 이름과 물성을 볼 수 있어요.';
    el('galleryStock').textContent = found ? bridge.stockLabel(card.id) : '아직 발견하지 못했어요';
    el('galleryFacts').hidden = !found; el('galleryActions').hidden = !found;
    el('galleryHeat').hidden = !canFlip; el('galleryDevelop').hidden = found || card.id !== 'qp-1470';
    el('galleryLocked').hidden = found;
    if (!found) { el('galleryArt').textContent = '???'; el('galleryLoad').textContent = '미발견 소재'; return; }
    var spec = bridge.spec(card,side), duct = bridge.duct(spec), text = side ? card.alt : card;
    el('galleryTS').textContent = spec.ts + ' MPa'; el('galleryDuctLabel').textContent = duct.k; el('galleryDuct').textContent = duct.v + ' %';
    el('galleryDescription').textContent = text.t; el('galleryQuote').textContent = '“' + text.line + '”'; el('galleryUse').textContent = bridge.use(card.id);
    el('galleryGuarantees').textContent = bridge.itemsOf(card.id).map(function (item) { return item.tag; }).join(' · ') || '장착한 보증이 없습니다';
    el('galleryHeat').querySelectorAll('[data-gallery-side]').forEach(function (button) { button.setAttribute('aria-pressed',String(Number(button.dataset.gallerySide) === side)); });
    el('galleryLoad').textContent = '카드 그림 불러오는 중';
    view = GAME_PRESENTATION.render({cardId:card.id,side:side ? 'alt' : 'front'});
    var current = view; el('galleryArt').append(view.element);
    view.onStatus(function (status) {
      if (view !== current) return;
      current.element.setAttribute('aria-busy',String(status.loading > 0));
      el('galleryLoad').textContent = status.loading ? status.error ? '그림 불러오는 중 · 일부 그림은 다시 시도가 필요해요.' : '카드 그림 불러오는 중' : status.error ? '일부 그림을 불러오지 못했어요. 카드의 다시 시도를 눌러 주세요.' : (canFlip ? side ? '열처리 후' : '열처리 전' : '대표 상태');
    });
  }
  function boot(value) {
    if (bridge) return; bridge = value;
    ['Grid','Gallery'].forEach(function (name) { el('dexMode' + name).addEventListener('click',function () { if (mode === name.toLowerCase()) return; mode = name.toLowerCase(); refresh(); GAME_AV.cue('ui.tab'); }); });
    el('dexFiltersToggle').addEventListener('click',function () {
      var expanded = this.getAttribute('aria-expanded') !== 'true';
      this.setAttribute('aria-expanded',String(expanded)); el('dexFilters').dataset.expanded = String(expanded);
    });
    el('galleryPrev').addEventListener('click',function () { move(-1); }); el('galleryNext').addEventListener('click',function () { move(1); });
    el('galleryHeat').querySelectorAll('[data-gallery-side]').forEach(function (button) { button.addEventListener('click',function () { if (side === Number(button.dataset.gallerySide)) return; side = Number(button.dataset.gallerySide); refresh(); GAME_AV.cue('card.flip'); }); });
    el('galleryDetail').addEventListener('click',function (event) { detail('',event.currentTarget); });
    el('galleryEquipment').addEventListener('click',function (event) { detail('cardEquipmentToggle',event.currentTarget); });
    el('galleryParts').addEventListener('click',function (event) { detail('cardCraftToggle',event.currentTarget); });
    el('galleryRepresentative').addEventListener('click',function () { var saved = GAME_HOME.select('hero',selected); el('galleryActionStatus').textContent = saved ? '공방 대표로 전시했어요.' : '현재 발견 상태를 확인해 주세요.'; if (saved) GAME_AV.cue('ui.confirm'); });
    el('galleryDevelop').addEventListener('click',bridge.openDevelop);
    el('galleryReset').addEventListener('click',function () { el('dexClear').click(); });
    var stage = el('galleryStage');
    stage.addEventListener('keydown',function (event) {
      if (event.target !== stage || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    });
    stage.addEventListener('pointerdown',function (event) {
      pointer = event.isPrimary && !event.target.closest('button') ? {id:event.pointerId,x:event.clientX,y:event.clientY} : null;
    });
    stage.addEventListener('pointerup',function (event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      var x = event.clientX - pointer.x, y = event.clientY - pointer.y; pointer = null;
      if (Math.abs(x) >= 48 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel',function () { pointer = null; });
    refresh();
  }
  return Object.freeze({boot:boot,refresh:refresh,select:select,dispose:dispose});
}());
