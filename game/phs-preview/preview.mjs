import {createSound, reveal} from '../reveal.mjs';
import {cardTitle, el, gradeText, stage} from '../ui.mjs';

const screen = document.querySelector('#screen');
const ordinary = document.querySelector('#ordinary');
const sequence = ['poo-270C','ssial-270D','ga-340H','wr-SWRY','poo-590Y','ssial-780Y','ga-270E','wr-CHQ','ssial-1470M','poo-PHS'];
const sounds = [createSound(), createSound()];
const sound = sounds[0];
const soundButton = document.querySelector('#sound');
const dataURL = new URL('../data.json', import.meta.url);
const response = await fetch(dataURL);
if (!response.ok) throw new Error('체험 자료를 읽을 수 없습니다.');
const data = await response.json();
for (const appearance of data.appearances) appearance.image = new URL(appearance.image, dataURL).href;
for (const asset of Object.values(data.assets)) asset.image = new URL(asset.image, dataURL).href;
let cleanups = [];

function result(ids) {
  return {cards: ids.map(id => ({id, isNew:true, stock:1}))};
}
function reset(compare) {
  for (const dispose of cleanups) dispose();
  cleanups = [];
  screen.replaceChildren();
  screen.className = compare ? 'pair' : '';
  document.querySelector('#choice').hidden = !compare;
}
function fixedCard(host,id) {
  const card = data.cards.find(c => c.id === id);
  const base = data.appearances.find(a => a.cardId === id && a.side === 'front' && !a.equipmentKeys.length);
  host.replaceChildren(stage(data,card,base), el('h2','',cardTitle(card)));
}
function compare() {
  reset(true);
  const trigger = document.activeElement;
  for (const [index, id] of [ordinary.value,'poo-PHS'].entries()) {
    const panel = el('section');
    screen.append(panel);
    // Two entries select the game's ten-pull timing. The comparison shows its first reveal.
    cleanups.push(reveal(panel,data,result([id,id]),()=>fixedCard(panel,id),sounds[index]));
    panel.querySelector('.seal-action')?.click();
  }
  if (trigger instanceof HTMLElement) trigger.focus({preventScroll:true});
}
function ten(replayFrom = null) {
  reset(false);
  const finish = () => {
    const list = el('ol','lot');
    for (const id of sequence) {
      const card = data.cards.find(c=>c.id===id), item=el('li'), img=el('img');
      img.alt=''; img.src=data.assets['thumbnail:'+id+':front'].image;
      item.append(img,el('strong','',cardTitle(card)),el('span','',gradeText(card)+(card.rare?' · RARE':'')));
      list.append(item);
    }
    screen.replaceChildren(el('h2','','10연 시연 결과'),list);
  };
  cleanups.push(reveal(screen,data,result(sequence),finish,sound,{replayFrom}));
  screen.querySelector('.seal-action')?.click();
}
document.querySelector('#compare').onclick=()=>{history.replaceState(null,'','#compare');compare();};
document.querySelector('#ten').onclick=()=>{history.replaceState(null,'','#ten');ten();};
document.querySelector('#last-two').onclick=()=>{history.replaceState(null,'','#last-two');ten(8);};
ordinary.onchange=compare;
function openSelection() {
  if (location.hash === '#last-two') ten(8);
  else if (location.hash === '#ten') ten();
  else compare();
}
window.addEventListener('hashchange',openSelection);
soundButton.onclick = () => {
  const enabled = sound.toggle();
  sounds[1].toggle();
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.textContent = enabled ? '소리 켜짐' : '소리 켜기';
  if (enabled) openSelection();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) sounds.forEach(channel => channel.stop()); });
window.addEventListener('pagehide',()=>{cleanups.forEach(dispose=>dispose());sounds.forEach(channel => channel.stop());});
if (new URLSearchParams(location.search).get('against') === '1470M') ordinary.value='ssial-1470M';
openSelection();
import '../pages-scope.mjs';
