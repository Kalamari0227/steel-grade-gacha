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

// 장식 그림: 실패하면 조용히 비운다. 버튼 안이나 겹쳐 놓는 테두리처럼 다시 시도 버튼을 둘 수 없는 곳에 쓴다.
export function deco(data, key, cls, lazy = false) {
  const box = el('span', cls);
  box.setAttribute('aria-hidden', 'true');
  const url = data.assets[key]?.image;
  if (url) {
    const img = el('img');
    img.alt = '';
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    img.addEventListener('error', () => img.remove(), {once: true});
    img.src = url;
    box.append(img);
  }
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
export function alignFeet(layer, appearance) {
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
// Splits a Japanese line into at most two vertical columns at the punctuation nearest the middle,
// so the engraved plate is only as tall as its text. The text itself is never changed.
function jaColumns(text) {
  const chars = [...text];
  if (chars.length <= 14) return [text];
  const middle = chars.length / 2;
  let cut = -1;
  chars.forEach((ch, i) => {
    if ('。、！？…）'.includes(ch) && i + 1 >= chars.length * 0.3 && i + 1 <= chars.length * 0.72 && (cut < 0 || Math.abs(i + 1 - middle) < Math.abs(cut - middle))) cut = i + 1;
  });
  if (cut < 0) cut = Math.ceil(middle);
  return [chars.slice(0, cut).join(''), chars.slice(cut).join('')];
}

// Approved KO/JA dialogue engraved on the card as a text layer; the artwork stays untouched.
function inscription(data, card, side) {
  const line = data.dialogue?.find(row => row.cardId === card.id && row.side === side);
  if (!line?.ko && !line?.ja) return null;
  const box = el('span', 'stage-inscription');
  box.setAttribute('aria-hidden', 'true');
  if (line.ja) {
    const ja = el('span', 'inscription-ja');
    ja.lang = 'ja';
    for (const part of jaColumns(line.ja)) ja.append(el('span', '', part));
    box.append(ja);
  }
  if (line.ko) {
    const ko = el('span', 'inscription-ko', line.ko);
    ko.lang = 'ko';
    box.append(ko);
  }
  return box;
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
  const words = inscription(data, card, appearance.side);
  if (words) wrapper.append(words);
  if (card.rare) wrapper.append(el('span', 'rare-mark', 'RARE'));
  return wrapper;
}

// The thumbnail button and artwork are siblings so an image retry is an independent control.
export function tile(data, card, known, onOpen, note = '') {
  const box = el('div', 'tile ' + (known ? 'known' : 'unknown'));
  const imageKey = known ? 'thumbnail:' + card.id + ':front' : 'silhouette:' + card.family;
  const picture = asset(data, imageKey, known ? cardTitle(card) : card.familyName + ' 계열 실루엣', 'tile-art', true);
  // 작은 카드: 발견한 동료만 등급색과 승인 프레임을 두른다. 미발견은 등급을 드러내지 않는다.
  const mini = el('span', 'tile-card');
  mini.append(picture);
  if (known) {
    const open = button(cardTitle(card), 'tile-open', event => onOpen(card, event.currentTarget));
    box.dataset.cardId = card.id;
    box.classList.add(gradeKey(card));
    mini.append(deco(data, 'frame:' + gradeKey(card), 'tile-frame', true));
    box.append(mini, el('small', 'tile-grade', gradeText(card)), open);
    if (note) box.append(el('small', 'tile-note', note));
  } else box.append(mini, el('strong', '', card.familyName), el('small', '', '미발견'));
  return box;
}
