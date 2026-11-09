export function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (tag === 'button' || tag === 'select' || tag === 'summary') node.tabIndex = 0;
  if (className) node.className = className;
  if (content !== '') node.textContent = content;
  return node;
}

export function button(label, className, click) {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', click);
  return node;
}

export function art(url, alt, className = '', lazy = false) {
  const box = el('span', 'art ' + className);
  function load(retry = false) {
    const img = el('img');
    img.alt = alt;
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    function fail() {
      const note = el('span', 'art-error');
      const message = el('span', '', (alt || '배경 그림') + ' 불러오기 실패');
      message.setAttribute('role', 'status');
      const again = button('다시 시도', 'retry', event => {
        event.preventDefault();
        event.stopPropagation();
        load(true);
      });
      note.append(message, again);
      box.replaceChildren(note);
    }
    if (!url) { fail(); return; }
    img.addEventListener('error', fail, {once: true});
    if (retry) {
      const next = new URL(url, document.baseURI);
      next.searchParams.set('retry', Date.now());
      img.src = next.href;
    } else img.src = url;
    box.replaceChildren(img);
  }
  load();
  return box;
}

export function asset(data, key, alt, cls = '', lazy = false) {
  return art(data.assets[key]?.image, alt, cls, lazy);
}

export function cardTitle(card) { return card.familyName + ' ' + card.grade; }
export function gradeKey(card) {
  return card.family === 'qp' ? 'qp-special' : 'star-' + (Number(card.level) + 1);
}
export function gradeText(card) {
  return card.family === 'qp' ? 'QP 선행개발' : '★'.repeat(Number(card.level) + 1);
}

const groundCache = new Map();
function alignFeet(layer, appearance) {
  const align = img => {
    let ground = groundCache.get(appearance.sha256);
    if (ground === undefined) {
      const canvas = document.createElement('canvas');
      canvas.width = 80; canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx || !img.naturalWidth) return;
      const scale = Math.min(80 / img.naturalWidth, 120 / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      ctx.drawImage(img, (80-w)/2, (120-h)/2, w, h);
      const pixels = ctx.getImageData(0,0,80,120).data;
      // Two opaque pixels exclude isolated antialias fringes under the feet.
      for (let y=119; y>=0 && ground===undefined; y--) {
        let opaque=0;
        for (let x=0; x<80; x++) if (pixels[(y*80+x)*4+3]>=128) opaque++;
        if (opaque>=2) ground=(y+1)/120;
      }
      if (ground===undefined) return;
      groundCache.set(appearance.sha256,ground);
    }
    layer.style.setProperty('--foot-shift',(-100*ground)+'%');
  };
  layer.addEventListener('load', event => { if(event.target instanceof HTMLImageElement) align(event.target); }, true);
  const img=layer.querySelector('img');
  if(img?.complete && img.naturalWidth) align(img);
}
export function stage(data, card, appearance) {
  const wrapper = el('div', 'card-stage ' + gradeKey(card));
  const level = gradeKey(card);
  wrapper.dataset.appearance = appearance.id;
  const character=art(appearance.image, cardTitle(card) + ' 전신', 'stage-character');
  alignFeet(character,appearance);
  wrapper.append(
    asset(data, 'stage:' + (appearance.side === 'alt' ? 'heat-awakened' : level), '', 'stage-scenery'),
    character,
    asset(data, 'frame:' + level, '', 'stage-frame'),
    el('span', 'stage-stars', gradeText(card))
  );
  if (card.rare) wrapper.append(el('span', 'rare-mark', 'RARE'));
  return wrapper;
}

// The thumbnail button and artwork are siblings so an image retry is an independent control.
export function tile(data, card, known, onOpen, note = '') {
  const box = el('div', 'tile ' + (known ? 'known' : 'unknown'));
  const imageKey = known ? 'thumbnail:' + card.id + ':front' : 'silhouette:' + card.family;
  const picture = asset(data, imageKey, known ? cardTitle(card) : card.familyName + ' 계열 실루엣', 'tile-art', true);
  if (known) {
    const open = button(cardTitle(card), 'tile-open', event => onOpen(card, event.currentTarget));
    box.dataset.cardId = card.id;
    box.append(picture, el('small', 'tile-grade', gradeText(card)), open);
    if (note) box.append(el('small', 'tile-note', note));
  } else box.append(picture, el('strong', '', card.familyName), el('small', '', '미발견'));
  return box;
}
