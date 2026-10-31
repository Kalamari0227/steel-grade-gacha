var GAME_EQUIPMENT = (function () {
  'use strict';
  var selection = null, view = null, unsubscribe = null;
  function el(id) { return document.getElementById(id); }
  function release() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (view) { view.dispose(); view = null; }
  }
  function clear() {
    release(); selection = null; GAME_AUDIO.cancel(); GAME_AV.leaveEquipment();
    pickModal.setAttribute('aria-label','고객 요구 회신');
    pickBox.classList.remove('equipment-dialog');
    delete pickBox.dataset.equipmentStep;
  }
  function available(key, id) { return S.items[key] === 1 && fitOwned(key).includes(id); }
  function stale() {
    release(); selection = null;
    var confirm = el('equipConfirm'); if (confirm) confirm.disabled = true;
    if (el('equipmentArt')) { el('equipmentArt').setAttribute('aria-busy','false'); el('equipmentLoad').textContent = ''; }
    el('pkres').textContent = '장착 또는 보유 상태가 바뀌었어요. 소재를 다시 선택해 주세요.';
    guaranteeFocus(el('pkres')); GAME_AV.cue('ui.unavailable');
  }
  function bind(id, action) { el(id).addEventListener('click', action); }
  function draw() {
    release();
    var current = selection;
    if (!current || !available(current.key,current.id)) { stale(); return; }
    try {
      view = GAME_PRESENTATION.render({cardId:current.id,side:current.side,variant:'stage',previewItem:current.before ? null : current.key});
    } catch (error) { stale(); return; }
    var handle = view;
    el('equipmentArt').style.backgroundImage = 'url("' + GAME_CONFIG.assets['scene:workshop:back'].url + '")';
    el('equipmentArt').replaceChildren(handle.element);
    el('equipmentArt').dataset.mode = current.before ? 'before' : 'preview';
    pickBox.querySelectorAll('[data-equipment-mode]').forEach(function (button) { button.setAttribute('aria-pressed',String((button.dataset.equipmentMode === 'before') === current.before)); });
    pickBox.querySelectorAll('[data-equipment-side]').forEach(function (button) { button.setAttribute('aria-pressed',String(button.dataset.equipmentSide === current.side)); });
    unsubscribe = handle.onStatus(function (status) {
      if (view !== handle || selection !== current) return;
      el('equipmentArt').setAttribute('aria-busy',String(status.loading > 0));
      el('equipmentLoad').textContent = status.loading ? '장비 그림 불러오는 중' : status.error ? '일부 그림을 불러오지 못했어요. 그림의 다시 시도를 눌러 주세요.' : '';
    });
  }
  function preview(key, id) {
    if (!available(key,id)) { stale(); return; }
    release();
    var it = findItem(key), c = findChar(id);
    selection = {key:key,id:id,side:activeCardId === id && cardSide ? 'alt' : 'front',before:false};
    pickBox.classList.add('equipment-dialog'); pickBox.dataset.equipmentStep = 'preview';
    pickBox.innerHTML = '<button class="x" type="button" id="pickX" aria-label="닫기">&times;</button>' +
      '<header class="equipment-heading"><p>장비 장착</p><h3 id="equipmentTitle" tabindex="-1">' + c.fam.name + ' · ' + c.g + '</h3></header>' +
      '<div class="equipment-layout"><div class="equipment-visual"><div class="equipment-modes" role="group" aria-label="장착 전후 비교">' +
      '<button type="button" data-equipment-mode="before">장착 전</button><button type="button" data-equipment-mode="preview">미리보기</button></div>' +
      '<div id="equipmentArt" aria-busy="true"></div><p id="equipmentLoad" role="status"></p>' +
      (c.alt ? '<div class="equipment-sides" role="group" aria-label="열처리 상태"><button type="button" data-equipment-side="front">열처리 전</button><button type="button" data-equipment-side="alt">열처리 후</button></div>' : '') + '</div>' +
      '<div class="equipment-details"><div class="equipment-selection">' + itImg(key) + '<div><h4>' + it.name + ' · ' + it.tag + '</h4><p>재고 ' + stockOf(id) + '장 · 장착 시 무소모</p></div></div>' +
      '<div class="equipment-actions"><button class="guarantee-primary" id="equipConfirm" type="button">' + it.name + ' 장착 확정</button><button class="guarantee-secondary" id="equipCancel" type="button">취소</button></div>' +
      '<section id="pkres" class="guarantee-response" role="status"></section><p class="equipment-meaning">' + it.sub + '</p><p>적용 · ' + it.scope + '</p><p>물성 수치는 바뀌지 않아요. 기존 장비도 함께 표시됩니다.</p>' +
      '<div class="equipment-items" aria-label="이 소재의 보증 장비"></div><button class="guarantee-secondary" id="equipTargets" type="button">다른 소재 선택</button></div></div>';
    ITEMS.filter(function (item) { return item.fit(c) && (S.items[item.key] === 1 || S.items[item.key] === id); }).forEach(function (item) {
      var free = S.items[item.key] === 1, node = document.createElement(free ? 'button' : 'div');
      node.className = 'equipment-item'; node.innerHTML = itImg(item.key) + '<span>' + item.name + (free ? '' : ' · 장착됨') + '</span>';
      if (free) {
        node.type = 'button'; node.dataset.previewItem = item.key; node.setAttribute('aria-pressed',String(item.key === key));
        node.addEventListener('click',function () { if (node.isConnected) preview(item.key,id); });
      }
      pickBox.querySelector('.equipment-items').append(node);
    });
    bind('pickX',closePick); bind('equipCancel',closePick); bind('equipTargets',function () { open(key); });
    bind('equipConfirm',confirm);
    pickBox.querySelectorAll('[data-equipment-mode]').forEach(function (button) { button.addEventListener('click',function () {
      if (!selection || !button.isConnected) return;
      if (selection.before === (button.dataset.equipmentMode === 'before')) return;
      selection.before = button.dataset.equipmentMode === 'before'; draw(); GAME_AV.cue('equip.preview');
    }); });
    pickBox.querySelectorAll('[data-equipment-side]').forEach(function (button) { button.addEventListener('click',function () {
      if (!selection || !button.isConnected) return;
      if (selection.side === button.dataset.equipmentSide) return;
      selection.side = button.dataset.equipmentSide; draw(); GAME_AV.cue('card.flip');
    }); });
    draw(); pickBox.scrollTop = 0; el('equipmentTitle').focus({preventScroll:true}); GAME_AV.cue('equip.select');
  }
  function confirm(event) {
    var current = selection, button = event.currentTarget;
    if (!current || !button.isConnected || button.disabled || !pickModal.classList.contains('show')) return;
    if (!available(current.key,current.id)) { stale(); return; }
    button.disabled = true; selection = null; release();
    S.items[current.key] = current.id;
    save();
    GAME_AV.cue('equip.attach');
    var c = findChar(current.id);
    pickBox.dataset.equipmentStep = 'complete';
    el('equipmentArt').dataset.mode = 'complete';
    pickBox.querySelectorAll('[data-equipment-mode]').forEach(function (node) {
      node.setAttribute('aria-pressed',String(node.dataset.equipmentMode === 'preview'));
      if (node.dataset.equipmentMode === 'preview') node.textContent = '장착 완료';
    });
    pickBox.querySelectorAll('[data-equipment-mode],[data-equipment-side],[data-preview-item]').forEach(function (node) { node.disabled = true; });
    el('equipConfirm').hidden = true; el('equipCancel').hidden = true; el('equipTargets').hidden = true;
    el('pkres').innerHTML = '<h4>' + c.fam.name + ' ' + c.g + '에 걸었습니다</h4><p>도감 카드에도 보증 항목이 표시됩니다. 소재 재고는 그대로예요.</p><button class="guarantee-primary" id="pkDone2" type="button">확인</button>';
    bind('pkDone2',closePick);
    view = GAME_PRESENTATION.render({cardId:current.id,side:current.side,variant:'stage'}); el('equipmentArt').replaceChildren(view.element);
    var handle = view;
    unsubscribe = handle.onStatus(function (status) {
      if (view !== handle) return;
      el('equipmentArt').setAttribute('aria-busy',String(status.loading > 0));
      el('equipmentLoad').textContent = status.loading ? '장비 그림 불러오는 중' : status.error ? '일부 그림을 불러오지 못했어요. 그림의 다시 시도를 눌러 주세요.' : '';
    });
    refresh(); guaranteeReturn(); guaranteeFocus(el('pkres'));
  }
  function open(key, trigger) {
    var it = findItem(key); if (!it || S.items[key] !== 1) return;
    if (pickModal.classList.contains('show') && dialogStack.at(-1)?.el === modal) closeCard();
    clear(); GAME_AV.enterEquipment(); pickModal.setAttribute('aria-label','장비 장착');
    var own = fitOwned(key), alreadyOpen = pickModal.classList.contains('show');
    if (!alreadyOpen) pickLast = trigger || document.activeElement;
    pickBox.classList.add('guarantee-dialog'); delete pickBox.dataset.orderKey; delete pickBox.dataset.orderDay;
    var html = '<button class="x" type="button" id="pickX" aria-label="닫기">&times;</button><p class="guarantee-kicker">2 · 보유 소재 선택</p><h3 id="targetTitle" tabindex="-1">' + it.tag + '</h3><p>' + it.sub + '</p><p>적용 · ' + it.scope + '</p><p>발견한 소재는 재고가 0장이어도 장착할 수 있어요. 선택 후 외형을 미리 확인해 주세요.</p>';
    if (!own.length) html += '<p class="guarantee-empty">현재 호환되는 보유 소재가 없어요. 보증은 미장착 상태로 보관됩니다.</p>';
    else {
      html += '<div class="guarantee-targets">';
      own.forEach(function (id) {
        var c = findChar(id);
        html += '<div class="guarantee-target"><button class="guarantee-material" type="button" data-equip-id="' + id + '" aria-label="' + c.fam.name + ' ' + c.g + '"><img src="' + IMG[id] + '" width="72" height="108" alt=""><strong>' + c.fam.name + ' ' + c.g + '</strong><span>재고 ' + stockOf(id) + '장 · 장착 시 무소모</span></button><button class="guarantee-secondary" type="button" data-guarantee-card="' + id + '">소재 상세</button></div>';
      });
      html += '</div>';
    }
    pickBox.innerHTML = html + '<section class="guarantee-response" id="pkres" aria-live="polite"></section><button class="guarantee-secondary" id="pickLater" type="button">나중에</button>';
    bind('pickX',closePick); bind('pickLater',closePick);
    pickBox.querySelectorAll('[data-guarantee-card]').forEach(function (button) { button.addEventListener('click',function () { if (S.owned[button.dataset.guaranteeCard]) openCard(button.dataset.guaranteeCard,undefined,button); }); });
    pickBox.querySelectorAll('[data-equip-id]').forEach(function (button) { button.addEventListener('click',function () { if (button.isConnected && !button.disabled) preview(key,button.dataset.equipId); }); });
    if (!alreadyOpen) showDialog(pickModal,pickLast);
    pickBox.scrollTop = 0; guaranteeFocus(el('targetTitle'));
  }
  return Object.freeze({open:open,clear:clear});
}());
