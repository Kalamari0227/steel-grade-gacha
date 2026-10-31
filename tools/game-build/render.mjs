import {check,canonical} from './io.mjs';
const encode=value=>canonical(value).replaceAll('<','\\u003c');
function once(text,marker,value){check(text.split(marker).length===2,`build marker: ${marker}`);return text.replace(marker,()=>value);}
export function render(input){
  const {source,manifest,assetMap,audioMap,releaseId,syntheticFixture}=input;
  let html=source['src/app_tpl.html'];
  const maps={IMG:{},IMG_ALT:{},IMG_ITEM:{},IMG_PART:{},IMG_CAR:{}};
  for(const face of manifest.faces)maps[face.side==='alt'?'IMG_ALT':'IMG'][face.cardId]=assetMap[face.character].url;
  for(const row of manifest.assets){
    const name={item:'IMG_ITEM',part:'IMG_PART',car:'IMG_CAR'}[row.kind];
    if(name)maps[name][row.assetId.split(':')[1]]=assetMap[row.assetId].url;
  }
  for(const [name,map] of Object.entries(maps)){
    const pattern=new RegExp(`var ${name} = \\{[\\s\\S]*?\\n\\};`,'g');
    const declarations=[...html.matchAll(pattern)];check(declarations.length===1,`map declaration: ${name}`);
    const keys=[...declarations[0][0].matchAll(/(?:"([^"]+)"|(\w+))\s*:\s*"__\w+__"/g)].map(m=>m[1]||m[2]);
    check(keys.length===Object.keys(map).length&&keys.every(k=>map[k]),`map keys: ${name}`);
    const ordered=Object.fromEntries(keys.map(k=>[k,map[k]]));
    html=html.replace(pattern,()=>`var ${name} = Object.freeze(${JSON.stringify(ordered)});`);
  }
  check(Object.keys(maps.IMG).length===45&&Object.keys(maps.IMG_ALT).length===2&&Object.keys(maps.IMG_ITEM).length===14&&Object.keys(maps.IMG_PART).length===35&&Object.keys(maps.IMG_CAR).length===8,'complete maps');
  html=once(html,'src/uiimg/workshop.webp',assetMap['scene:workshop:back'].url);
  html=once(html,'<!-- GAME_CSS -->',`<style data-game-style>\n${source['src/game/game.css']}\n</style>`);
  const assembly=['parts-body','parts-frame','parts-chassis'].flatMap(group=>JSON.parse(source['docs/design/game-reviews/'+group+'/assembly-metadata.json']).parts.map(({partKey,assetId,anchor,bounds,layer})=>({partKey,assetId,anchor,bounds,layer})));
  const config={assembly,edition:'game',releaseId,syntheticFixture,assets:assetMap,audio:audioMap,faces:manifest.faces,placements:manifest.placements};
  html=once(html,'<!-- GAME_CONFIG -->',`<script>var GAME_CONFIG = Object.freeze(${encode(config)});</script>`);
  for(const name of ['edition','backup','audio','audiovisual','presentation','home','collection','equipment','draw','crafting','garage']){
    const script=source[`src/game/${name}.js`];check(!/<\/script/i.test(script),'unsafe inline script');
    html=once(html,`<!-- GAME_${name.toUpperCase()} -->`,`<script>\n${script}\n</script>`);
  }
  html=once(html,'<!-- GAME_BRIDGE -->',`<script>
var GAME_BOOT = (function(){
  var started = false;
  return Object.freeze({start:function(bridge){
    if(started) return; started = true;
    Object.freeze(bridge);
    GAME_AUDIO.boot(bridge);
    GAME_PRESENTATION.boot(bridge);
    GAME_HOME.boot(bridge);
    GAME_COLLECTION.boot(bridge);
    GAME_DRAW.boot(bridge);
    GAME_CRAFTING.boot({parts:bridge.parts,cardIds:bridge.allChars().map(function(c){return c.id;}),assets:bridge.assets,assembly:GAME_CONFIG.assembly});
    renderCraftWorkbench();
    GAME_GARAGE.boot({cars:bridge.cars,assets:bridge.assets});
    GAME_AV.boot();
    document.body.dataset.gameRelease = GAME_CONFIG.releaseId;
    document.body.dataset.gameFixture = String(GAME_CONFIG.syntheticFixture);
  }});
}());
</script>`);
  html=once(html,'/* GAME_BOOT */','GAME_BOOT.start({getState:function(){return S;},drawChanged:function(value){drawState=value;syncDrawButtons();},allChars:allChars,findChar:findChar,cars:CARS,parts:PARTS,openCard:openCard,openDevelop:openDevelop,filteredCards:function(){return allChars().filter(function(c){return (!c.fam.hidden||qpRevealed()||hasQP())&&dexMatches(c,c.fam);});},level:lvOf,levelName:function(c){return LVNAME[lvOf(c)];},spec:specOf,duct:ductRow,use:function(id){return USE[id]||"—";},stockLabel:function(id){return id===QP_ID?"재고 무소모 · 개발 완료":"재고 "+stockOf(id)+"장";},qpRevealed:qpRevealed,hasQP:hasQP,items:ITEMS,itemsOf:itemsOf,fitOwned:fitOwned,partPlan:partPlan,craft:craft,save:save,refresh:refresh,assets:GAME_CONFIG.assets,audio:GAME_CONFIG.audio});');
  // The legacy fragment has no explicit body; the first markup after its styles starts it.
  const styleEnd=html.indexOf('</style>',html.indexOf('<style data-game-style>'))+8;
  html=html.slice(0,styleEnd)+`</head><body data-game-release="${releaseId}" data-game-fixture="${syntheticFixture}">`+html.slice(styleEnd);
  html='<!doctype html><html lang="ko"><head>'+source['src/pwa_head.txt']+html+source['src/pwa_body.txt']+'</body></html>';
  check(!/__\w+__/.test(html)&&!html.includes('src/uiimg/')&&!/data:image\/[^;]+;base64,/.test(html),'unresolved/inline artwork');
  check(!/file:\/\/\/|\/Users\/|\/home\//.test(html),'source absolute path');
  check(Buffer.byteLength(html)<=1048576,'index budget');
  return html;
}
