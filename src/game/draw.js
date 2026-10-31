var GAME_DRAW = (function () {
  'use strict';
  let bridge, current = null, generation = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function immutable(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
    return value;
  }
  function active(session) { return current === session && session.token === generation; }
  function busy() { return Boolean(current && current.busy); }
  function changed() { bridge.drawChanged(current ? current.handle : null); }
  function cue(session, id) {
    if (!active(session) || document.hidden || session.sound.generation !== GAME_AUDIO.snapshot().cueGeneration) return;
    session.audioOwned = true;
    try { Promise.resolve(GAME_AUDIO.play(id)).catch(function () { session.audioFailed = true; }); }
    catch (error) { session.audioFailed = true; }
  }
  function halt(session, preserveAudio) {
    session.timers.forEach(clearTimeout); session.timers.clear();
    if (session.audioOwned && !preserveAudio) { GAME_AUDIO.cancel(); session.audioOwned = false; }
  }
  function release(session) {
    session.views.forEach(function (view) { view.unsubscribe(); view.handle.dispose(); });
    session.views.clear();
  }
  function art(session, host, card) {
    const token = session.token, handle = GAME_PRESENTATION.render({cardId:card.id,side:'front',state:session.result.state});
    host.append(handle.element);
    const status = element('p','draw-art-status'); status.setAttribute('role','status'); host.append(status);
    const unsubscribe = handle.onStatus(function (counts) {
      if (!active(session) || token !== generation) return;
      host.setAttribute('aria-busy',String(counts.loading > 0));
      status.textContent = counts.loading ? '소재 그림 불러오는 중' : counts.error ? '그림을 불러오지 못했어요. 다시 시도할 수 있습니다.' : '';
    });
    session.views.add({handle:handle,unsubscribe:unsubscribe});
  }
  function asset(session, host, id, className) {
    const image = element('img',className); image.alt = ''; image.width = 768; image.height = 768; image.draggable = false;
    const fail = function () { if (active(session)) { image.hidden = true; session.opening.dataset.artError = 'true'; } };
    image.addEventListener('error',fail); image.src = GAME_CONFIG.assets[id].url; host.append(image);
    session.images.push({image:image,fail:fail});
  }
  function clearOpening(session) {
    release(session);
    session.images.forEach(function (row) { row.image.removeEventListener('error',row.fail); row.image.removeAttribute('src'); });
    session.images.length = 0; session.opening.replaceChildren();
  }
  function phase(session, name, message) {
    if (!active(session)) return;
    session.phase = name; session.host.dataset.phase = name; session.status.textContent = message;
  }
  function later(session, delay, action) {
    const token = session.token, timer = setTimeout(function () {
      session.timers.delete(timer);
      if (!active(session) || token !== generation || !session.busy || document.hidden) return;
      action();
    },delay);
    session.timers.add(timer);
  }
  function reveal(session, index) {
    clearOpening(session);
    const card = session.result.cards[index]; session.index = index;
    session.opening.dataset.index = String(index);
    phase(session,'card',session.result.mode === 'ten' ? (index + 1) + ' / 10 · ' + card.family.name + ' ' + card.grade : card.family.name + ' ' + card.grade);
    const host = element('div','draw-reveal-card'); session.opening.append(host); art(session,host,card);
    session.opening.append(element('p','draw-reveal-label',card.isNew ? 'NEW · 처음 발견' : '보유 소재 · 재고 +1'));
    if (index === 0) {
      cue(session,session.result.mode === 'development' ? 'qp.complete' : 'draw.reveal');
      if (card.isNew && session.result.mode !== 'development') later(session,120,function () { cue(session,'draw.new'); });
    }
    else if (card.isNew) cue(session,'draw.new');
  }
  function detail(card, multiple) {
    const button = element('button',multiple ? 'tc' : 'draw-art',multiple ? card.family.abbr + ' ' + card.grade + ' · 상세 보기' : '소재 상세 보기');
    button.type = 'button'; button.setAttribute(multiple ? 'data-id' : 'data-draw-detail',card.id);
    button.setAttribute('aria-label',card.family.name + ' ' + card.grade + ' 상세 보기');
    return button;
  }
  function results(session) {
    const multiple = session.result.mode === 'ten', development = session.result.mode === 'development';
    const body = element('div',multiple ? 'draw-result-grid' : 'draw-single');
    session.result.cards.forEach(function (card, index) {
      const row = element('article',multiple ? 'draw-result-tile' : 'draw-single-result'); row.dataset.resultId = card.id; row.dataset.resultIndex = String(index); row.dataset.new = String(card.isNew);
      const portrait = element('div','draw-result-art'); row.append(portrait); body.append(row);
      const copy = element('div','draw-copy'); row.append(copy);
      copy.append(element('span','draw-badge' + (card.isNew ? ' draw-new' : ''),card.isNew ? 'NEW · 처음 발견' : '보유 소재 · 재고 +1'));
      copy.append(element('h3','',card.family.name + ' ' + card.grade));
      copy.append(element('p','draw-meta',card.family.abbr + ' · LV' + card.level + ' ' + card.levelName + (card.pick ? ' · PICK UP' : '')));
      if (!multiple) {
        copy.append(element('p','',card.description),element('p','draw-quote','“' + card.quote + '”'),element('p','draw-use','사용처 · ' + card.use));
        const stock = element('p','draw-stock',development ? '선행개발 소재 등록 · 현재 재고 ' : '입고 +1 · 현재 재고 ');
        const count = element('b','',card.stock + '장'); count.id = 'drawStock'; stock.append(count); copy.append(stock);
      } else copy.append(element('p','draw-stock','입고 +1 · 현재 재고 ' + card.stock + '장'));
      copy.append(detail(card,multiple));
      if (!multiple && card.stock > 1) {
        const scrap = element('button','btn-sub','한 장 스크랩으로'); scrap.id = 'btnScrap'; scrap.type = 'button'; scrap.dataset.drawScrap = card.id; copy.append(scrap);
      } else if (!multiple) copy.append(element('p','draw-meta','마지막 한 장은 스크랩으로 바꿀 수 없습니다.'));
    });
    session.resultHost.replaceChildren(body);
    if (multiple) session.resultHost.append(element('p','draw-summary','새 소재 ' + session.result.cards.filter(card=>card.isNew).length + '장 · LV3 이상 ' + session.result.cards.filter(card=>card.level >= 3).length + '장 · 스크랩 ' + session.result.scrap + '개 남음'));
    session.result.cards.forEach(function (card, index) { art(session,body.children[index].querySelector('.draw-result-art'),card); });
  }
  function finish(focusResult, natural) {
    const session = current;
    if (!session || !session.busy) return;
    const moveFocus = focusResult || session.controls.contains(document.activeElement);
    session.token = ++generation; halt(session,natural); clearOpening(session); session.busy = false;
    phase(session,'ready',session.result.mode === 'development' ? '선행개발 완료' : '입고 완료');
    session.opening.hidden = true; session.controls.hidden = true; session.resultHost.hidden = false; session.resultHost.inert = false;
    results(session); changed();
    if (natural && !session.reduced && session.result.mode !== 'development') cue(session,'draw.result');
    if (moveFocus) session.resultHost.querySelector('[data-draw-detail],.tc').focus({preventScroll:true});
  }
  function close(returnFocus) {
    const session = current;
    if (!session) return;
    generation++; current = null; halt(session); clearOpening(session);
    session.host.classList.remove('show'); session.host.removeAttribute('data-phase'); session.host.replaceChildren(); changed();
    if (returnFocus) {
      const trigger = session.trigger;
      const target = trigger && trigger.isConnected && !trigger.disabled && !trigger.closest('[hidden],[inert]') ? trigger : document.getElementById('title-workshop');
      target.focus({preventScroll:true});
    }
  }
  function mount(session) {
    const host = session.host; host.className = 'pull draw-frame game-draw show'; host.setAttribute('role','region'); host.setAttribute('aria-label',session.result.title + ' 결과');
    const header = element('div','draw-header'), headings = element('div'); headings.append(element('h2','',session.result.title));
    session.status = element('p','draw-status'); session.status.setAttribute('role','status'); headings.append(session.status);
    const closeButton = element('button','draw-close','×'); closeButton.type = 'button'; closeButton.dataset.drawClose = ''; closeButton.setAttribute('aria-label',session.result.mode === 'development' ? '개발 결과 닫기' : '출하 결과 닫기');
    header.append(headings,closeButton); session.opening = element('div','draw-opening');
    session.controls = element('div','draw-controls'); const skip = element('button','',session.result.mode === 'ten' ? '즉시 전체 결과 보기' : session.result.mode === 'development' ? '개발 결과 보기' : '바로 결과 보기');
    skip.type = 'button'; skip.dataset.drawSkip = ''; session.controls.append(skip);
    session.resultHost = element('div','draw-results'); session.resultHost.hidden = true;
    host.replaceChildren(header,session.controls,session.opening,session.resultHost);
  }
  function start(input, options) {
    if (!bridge) throw new Error('Draw presentation requires boot');
    if (!input || !['single','ten','development'].includes(input.mode) || !Array.isArray(input.cards) || input.cards.length !== (input.mode === 'ten' ? 10 : 1) || input.cards.some(card=>!GAME_CONFIG.faces.some(face=>face.cardId === card.id && face.side === 'front'))) throw new TypeError('Invalid draw result snapshot');
    const result = immutable(JSON.parse(JSON.stringify(input)));
    close(false);
    const session = {token:++generation,result:result,trigger:options.trigger,host:document.getElementById('pullBox'),timers:new Set(),views:new Set(),images:[],busy:true,phase:'coil',index:-1,audioOwned:false,audioFailed:false,reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches};
    session.handle = Object.freeze({get busy(){return session.busy;},trigger:session.trigger,development:result.mode === 'development'});
    const sound = GAME_AUDIO.snapshot(); session.sound = {generation:sound.cueGeneration};
    current = session; mount(session); changed();
    if (document.hidden) { close(false); return null; }
    if (session.reduced) finish(options.focusReveal,false);
    else {
      if (options.focusReveal) session.controls.querySelector('button').focus({preventScroll:true});
      switch (result.mode) {
        case 'single':
        case 'ten': {
          phase(session,'coil','코일 봉인을 열고 있어요');
          const coil = element('div','draw-coil'); session.opening.append(coil);
          asset(session,coil,'draw-crop:coil-pack:left','draw-coil-left'); asset(session,coil,'draw-crop:coil-pack:right','draw-coil-right'); asset(session,coil,'draw:seal','draw-seal');
          cue(session,'draw.latch'); later(session,200,function () { cue(session,'draw.coil'); });
          later(session,450,function () {
            phase(session,'family',result.mode === 'ten' ? '열 장의 소재를 확인하고 있어요' : result.cards[0].family.name + ' 소재를 확인하고 있어요'); cue(session,'draw.seal');
            const names = [...new Map(result.cards.map(card=>[card.family.key,card.family])).values()];
            const families = element('div','draw-families'); names.forEach(function (family) { const name = element('span','draw-family',family.name + ' · ' + family.abbr); name.dataset.family = family.key; families.append(name); }); session.opening.append(families);
          });
          if (result.mode === 'single') { later(session,800,function () { reveal(session,0); }); later(session,1450,function () { finish(false,true); }); }
          else {
            result.cards.forEach(function (_, index) { later(session,800 + index * 220,function () { reveal(session,index); }); });
            later(session,3000,function () {
              clearOpening(session); session.opening.hidden = true; session.resultHost.hidden = false; session.resultHost.inert = true;
              results(session); phase(session,'summary','열 장의 입고 내역을 정리하고 있어요');
            });
            later(session,3350,function () { finish(false,true); });
          }
          break;
        }
        case 'development': reveal(session,0); later(session,650,function () { finish(false,true); }); break;
      }
    }
    session.host.scrollIntoView({behavior:'instant',block:'start'}); return session.handle;
  }
  function boot(value) {
    if (bridge) return;
    bridge = Object.freeze({drawChanged:value.drawChanged});
    document.addEventListener('visibilitychange',function () { if (document.hidden) close(false); });
    window.addEventListener('pagehide',function () { close(false); });
  }
  function snapshot() {
    return {active:Boolean(current),busy:busy(),generation:generation,phase:current?.phase || null,mode:current?.result.mode || null,index:current?.index ?? -1,pendingTimerCount:current?.timers.size || 0,handleCount:current?.views.size || 0,audioFailed:current?.audioFailed || false,results:current ? current.result.cards.map(card=>({id:card.id,isNew:card.isNew})) : []};
  }
  return Object.freeze({boot:boot,start:start,finish:finish,close:close,busy:busy,snapshot:snapshot});
}());
