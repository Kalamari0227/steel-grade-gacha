/* Detached backup codec. Catalog lookups are supplied by the existing game core. */
var GAME_BACKUP = (function(){
  'use strict';
  var limit = 256 * 1024;
  function fail(field, message){ throw new Error(field + ': ' + message); }
  function object(value, field){
    if(!value || Object.getPrototypeOf(value) !== Object.prototype) fail(field, '객체여야 합니다');
  }
  function integer(value, field, timestamp){
    if(!Number.isSafeInteger(value) || value < 0 || (timestamp && value > 8640000000000000))
      fail(field, '유효한 0 이상의 정수여야 합니다');
  }
  function encode(value){
    return btoa(unescape(encodeURIComponent(JSON.stringify(value))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function code(pack){ return 'SGG-GAME1.' + encode({version:1, edition:'game', progress:pack}); }
  function validate(pack, api){
    object(pack, 'progress');
    var allowed = ['v','o','i','s','x','p','q','u','pu','od','ok','on','pt','st','cr','cs','ca'];
    Object.keys(pack).forEach(function(k){ if(allowed.indexOf(k) < 0) fail(k, '알 수 없는 필드입니다'); });
    if(pack.v !== 1) fail('v', '지원하지 않는 버전입니다');
    var owned = {}, parts = {}, items = {}, stock = {}, cars = [];
    function material(value, field){
      if(typeof value !== 'string' || !api.findChar(api.idLong(value))) fail(field, '알 수 없는 소재입니다');
      return api.idLong(value);
    }
    function uniqueList(value, field, resolve, put){
      if(!Array.isArray(value)) fail(field, '목록이어야 합니다');
      var seen = new Set();
      value.forEach(function(entry, index){
        var key = resolve(entry, field + '[' + index + ']');
        if(seen.has(key)) fail(field, '중복 항목입니다');
        seen.add(key); put(key, entry);
      });
    }
    uniqueList(pack.o, 'o', material, function(id){ owned[id] = true; });
    if(pack.i !== undefined){
      object(pack.i, 'i');
      Object.keys(pack.i).forEach(function(k){
        var item = api.findItem(k), value = pack.i[k];
        if(!item) fail('i.' + k, '알 수 없는 아이템입니다');
        if(value === 1){ items[k] = 1; return; }
        var id = material(value, 'i.' + k);
        if(!owned[id] || !item.fit(api.findChar(id))) fail('i.' + k, '발견한 호환 소재에만 장착할 수 있습니다');
        items[k] = id;
      });
    }
    ['s','x','p','q','u','pu','on','ca'].forEach(function(k){
      if(pack[k] !== undefined) integer(pack[k], k, ['p','q','ca'].indexOf(k) >= 0);
    });
    if(pack.od !== undefined){
      if(typeof pack.od !== 'string') fail('od', '날짜 문자열이어야 합니다');
      if(pack.od){
        var match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(pack.od);
        if(!match) fail('od', '날짜 형식이 잘못되었습니다');
        var date = new Date(Number(match[1]), Number(match[2])-1, Number(match[3]));
        if(date.getFullYear() !== Number(match[1]) || date.getMonth()+1 !== Number(match[2]) || date.getDate() !== Number(match[3])) fail('od', '없는 날짜입니다');
      }
    }
    if(pack.ok !== undefined && (typeof pack.ok !== 'string' || (pack.ok && !api.findOrder(pack.ok)))) fail('ok', '알 수 없는 주문입니다');
    if(pack.pt !== undefined) uniqueList(pack.pt, 'pt', function(k, field){
      if(typeof k !== 'string' || !api.findPart(k)) fail(field, '알 수 없는 부품입니다');
      return k;
    }, function(k){ parts[k] = {at:0, use:[]}; });
    if(pack.st !== undefined){
      object(pack.st, 'st');
      Object.keys(pack.st).forEach(function(k){
        var id = material(k, 'st.' + k);
        if(!owned[id]) fail('st.' + k, '발견하지 않은 소재입니다');
        if(Object.prototype.hasOwnProperty.call(stock,id)) fail('st.' + k, '중복 소재입니다');
        integer(pack.st[k], 'st.' + k); stock[id] = pack.st[k];
      });
    } else Object.keys(owned).forEach(function(k){ stock[k] = 1; });
    function car(k, field){ if(typeof k !== 'string' || !api.findCar(k)) fail(field, '알 수 없는 자동차입니다'); return k; }
    if(pack.cs !== undefined && pack.cs !== '') car(pack.cs, 'cs');
    if(pack.cr !== undefined) uniqueList(pack.cr, 'cr', function(entry, field){
      if(!Array.isArray(entry) || entry.length !== 2) fail(field, '[자동차, 시각]이어야 합니다');
      integer(entry[1], field + '.at', true); return car(entry[0], field);
    }, function(k, entry){ cars.push({k:k, at:entry[1]}); });
    else if(pack.cs) cars.push({k:pack.cs, at:pack.ca || 0});
    return {owned:owned, items:items, stock:stock, parts:parts, cars:cars,
      scrap:pack.s || 0, extra:pack.x || 0, pullAt:pack.p || 0, quizAt:pack.q || 0,
      quizUsed:pack.u || 0, pullUsed:pack.pu === undefined ? (pack.p ? 1 : 0) : pack.pu,
      orderDay:pack.od || '', orderKey:pack.ok || '', orderDone:pack.on || 0, pending:''};
  }
  function read(text, edition, api){
    if(typeof text !== 'string' || new TextEncoder().encode(text).length > limit) fail('code', '코드는 256KiB 이하여야 합니다');
    var prefix = edition === 'education' ? 'SGG1.' : 'SGG-GAME1.';
    var input = text.replace(/\s+/g, '');
    if(input.indexOf(prefix) !== 0) fail('code', edition === 'education' ? '교육용 SGG1. 코드가 필요합니다' : '게임용 SGG-GAME1. 코드가 필요합니다. 교육용 백업 가져오기를 따로 선택하세요');
    var body = input.slice(prefix.length), value;
    if(!/^[A-Za-z0-9_-]+$/.test(body) || body.length % 4 === 1) fail('code', 'base64url 형식이 잘못되었습니다');
    try{
      var bytes = atob(body.replace(/-/g,'+').replace(/_/g,'/'));
      if(btoa(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') !== body) throw 0;
      value = JSON.parse(decodeURIComponent(escape(bytes)));
    }catch(e){ fail('code', 'UTF-8 JSON 코드를 읽지 못했습니다'); }
    object(value, 'code');
    if(edition !== 'education'){
      if(value.version !== 1 || value.edition !== 'game' || Object.keys(value).sort().join(',') !== 'edition,progress,version') fail('code', '게임용 버전과 판별 정보가 잘못되었습니다');
      value = value.progress;
    }
    return {pack:value, progress:validate(value, api)};
  }
  function summary(state){
    return '발견 ' + Object.keys(state.owned).length + '종 · 재고 ' + Object.keys(state.stock).reduce(function(sum,k){ return sum + state.stock[k]; },0) +
      '장 · 아이템 ' + Object.keys(state.items).length + '종 · 부품 ' + Object.keys(state.parts).length + '종 · 자동차 ' + state.cars.length + '대 · 스크랩 ' + state.scrap + '장';
  }
  return Object.freeze({code:code, read:read, validate:validate, summary:summary});
})();
