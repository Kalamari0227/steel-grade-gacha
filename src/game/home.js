var GAME_HOME = (function () {
  'use strict';
  var bridge, figure, signature = '', heroId = '', carKey = '';
  var preferenceKey = 'sgg_game_preferences_v1', artworkDisposers = new WeakMap();
  function element(id) { return document.getElementById(id); }
  function preferences() {
    try {
      var value = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function owned() {
    var state = bridge.getState();
    return {characters:bridge.allChars().filter(function (c) { return !!state.owned[c.id]; }),cars:bridge.cars.filter(function (c) { return state.cars.some(function (row) { return row.k === c.key; }); })};
  }
  function saveSelection(kind, value) {
    var choices = owned(), allowed = kind === 'hero' ? choices.characters.some(function (c) { return c.id === value; }) : choices.cars.some(function (c) { return c.key === value; });
    if (!allowed) { refresh(); return false; }
    var latest = preferences(), display = latest.display && typeof latest.display === 'object' && !Array.isArray(latest.display) ? latest.display : {};
    latest.display = Object.assign({},display); latest.display[kind] = value;
    try { localStorage.setItem(preferenceKey,JSON.stringify(latest)); element('homePreferenceStatus').textContent = '대표 전시를 저장했어요.'; }
    catch (_) { element('homePreferenceStatus').textContent = '전시 설정을 저장하지 못했습니다. 다시 선택해 주세요.'; return false; }
    refresh(); return true;
  }
  function options(kind, choices, selected) {
    var select = element(kind === 'hero' ? 'homeHeroSelect' : 'homeCarSelect');
    var rows = choices.map(function (c) { return {value:kind === 'hero' ? c.id : c.key,label:kind === 'hero' ? c.fam.abbr + ' ' + c.g : c.body}; });
    var key = JSON.stringify(rows);
    if (select.dataset.options !== key) {
      select.replaceChildren();
      if (!rows.length) rows.push({value:'',label:kind === 'hero' ? '첫 소재를 기다려요' : '아직 완성한 차가 없어요'});
      rows.forEach(function (row) { var option = document.createElement('option'); option.value = row.value; option.textContent = row.label; select.append(option); });
      select.dataset.options = key;
    }
    select.value = selected; select.disabled = !choices.length;
  }
  function clearArtwork(container) {
    var dispose = artworkDisposers.get(container);
    if (dispose) { dispose(); artworkDisposers.delete(container); }
    container.replaceChildren();
  }
  function artwork(container, assetId, label) {
    clearArtwork(container);
    var image = document.createElement('img'), status = document.createElement('span'), retry = document.createElement('button');
    image.alt = label; image.draggable = false; status.className = 'home-art-status'; status.hidden = true;
    status.textContent = label + ' 그림을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. '; retry.type = 'button'; retry.textContent = '그림 다시 불러오기'; status.append(retry);
    var asset = bridge.assets[assetId], attempt = 0, objectURL, request;
    artworkDisposers.set(container,function () { attempt++; if (request) request.abort(); releaseURL(); image.onload = image.onerror = null; });
    function releaseURL() { if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; } }
    image.onerror = function () { releaseURL(); image.hidden = true; status.hidden = false; retry.disabled = false; };
    image.onload = function () { releaseURL(); status.hidden = true; retry.disabled = false; };
    function load(retrying) {
      var generation = ++attempt;
      if (request) request.abort(); releaseURL();
      status.hidden = true; image.hidden = false; retry.disabled = true;
      if (!retrying) { image.src = asset.url; return; }
      request = new AbortController();
      fetch(asset.url,{cache:'reload',signal:request.signal}).then(function (response) {
        if (!response.ok) throw new Error('Artwork request failed');
        return response.blob();
      }).then(function (blob) {
        if (generation !== attempt || !image.isConnected) return;
        releaseURL(); objectURL = URL.createObjectURL(blob); image.src = objectURL;
      }).catch(function () { if (generation === attempt && image.isConnected) image.onerror(); });
    }
    retry.addEventListener('click',function () { load(true); }); container.append(image,status); load(false);
  }
  function refresh() {
    if (!bridge) return;
    var choices = owned(), saved = preferences().display || {}, state = bridge.getState();
    var hero = choices.characters.find(function (c) { return c.id === saved.hero; }) || choices.characters[0];
    var car = choices.cars.find(function (c) { return c.key === saved.car; }) || choices.cars[0];
    heroId = hero ? hero.id : ''; carKey = car ? car.key : '';
    options('hero',choices.characters,heroId); options('car',choices.cars,carKey);
    var next = JSON.stringify([heroId,carKey,heroId ? bridge.itemsOf(heroId) : []]);
    if (signature !== next) {
      signature = next;
      if (figure) { figure.dispose(); figure = null; }
      clearArtwork(element('homeFigure')); element('homeFigure').dataset.hero = heroId;
      if (hero) {
        figure = GAME_PRESENTATION.render({cardId:hero.id,side:'front',variant:'stage',state:state});
        element('homeFigure').append(figure.element);
      } else artwork(element('homeFigure'),'stage:plinth','소재를 기다리는 빈 받침');
      element('homeFigure').classList.toggle('is-empty',!hero);
      element('homeCar').hidden = !car; element('homeCar').dataset.car = carKey;
      if (car) artwork(element('homeCar'),'car:'+car.key,car.body); else clearArtwork(element('homeCar'));
    }
    element('homeHeroName').textContent = hero ? hero.fam.name : '첫 소재를 기다리는 공방';
    element('homeHeroDetail').textContent = hero ? hero.fam.abbr + ' · ' + hero.g + ' · 발견한 소재' : '1회 출하를 눌러 첫 소재를 만나 보세요.';
    element('homeHeroOpen').hidden = !hero;
    element('researchQPButton').disabled = bridge.hasQP() || !bridge.qpRevealed();
    element('researchQPStatus').textContent = bridge.hasQP() ? '개발 완료 · 허용된 부품 슬롯에 무소모로 사용할 수 있어요.' : bridge.qpRevealed() ? '과제 공개 · 소재와 스크랩 비용을 확인하세요.' : '1470M · 1470H · PHS를 발견하면 과제가 열립니다.';
    var ten = element('btnTen'), one = element('btnPull');
    ten.dataset.primary = String(!ten.disabled); one.dataset.primary = String(ten.disabled);
  }
  function boot(value) {
    if (bridge) return; bridge = value;
    element('homeHeroSelect').addEventListener('change',function (event) { if (saveSelection('hero',event.target.value)) GAME_AV.cue('ui.confirm'); });
    element('homeCarSelect').addEventListener('change',function (event) { if (saveSelection('car',event.target.value)) GAME_AV.cue('ui.confirm'); });
    element('homeHeroOpen').addEventListener('click',function (event) { if (heroId) bridge.openCard(heroId,0,event.currentTarget); });
    window.addEventListener('storage',function (event) { if (event.key === preferenceKey) refresh(); });
    refresh();
  }
  return Object.freeze({boot:boot,refresh:refresh,select:saveSelection});
}());
