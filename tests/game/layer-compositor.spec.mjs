import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {appURL,root} from '../helpers/paths.mjs';
const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-asset-manifest.json')));
const fragment=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-reviews/placements/manifest-fragment.json')));
const placements=fragment.placements.map(row=>row.value);
const config={assets:Object.fromEntries(manifest.assets.map(row=>[row.assetId,{url:'/'+row.path}])),faces:manifest.faces,placements};
async function record(info,name,value){await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(info.outputPath(name+'.json'),JSON.stringify(value,null,2));}
async function open(page){
 await page.goto(appURL);await page.waitForFunction(()=>typeof S!=='undefined'&&typeof findChar==='function');
 await page.addStyleTag({path:path.join(root,'src/game/game.css')});
 await page.evaluate(config=>{window.GAME_CONFIG=config;window.compositorStateBefore=JSON.stringify(S);document.body.replaceChildren();document.body.style.cssText='margin:0;background:#161b20';},config);
 await page.addScriptTag({path:path.join(root,'src/game/presentation.js')});
 await page.evaluate(()=>GAME_PRESENTATION.boot({findChar,items:ITEMS,itemsOf,fitOwned,getState:()=>S}));
}
async function render(page,face,keys,width=960,previewItem=null){
 return page.evaluate(async({face,keys,width,previewItem})=>{
  const state={owned:{[face.cardId]:true},stock:{[face.cardId]:0},items:Object.fromEntries(keys.map(k=>[k,previewItem===k?1:face.cardId]))};
  const before=JSON.stringify(state),view=GAME_PRESENTATION.render({cardId:face.cardId,side:face.side,state,previewItem});
  document.body.replaceChildren(view.element);view.element.style.width=width+'px';const loaded=await view.ready;
  return {loaded,items:view.items,stateUnchanged:before===JSON.stringify(state),economicUnchanged:window.compositorStateBefore===JSON.stringify(S),layers:[...view.element.children].map(n=>n.dataset.layer)};
 },{face,keys,width,previewItem});
}
async function alpha(page,face,rows){
 const sources=rows.map(row=>{const asset=manifest.assets.find(a=>a.assetId==='item:'+row.itemKey);return {itemKey:row.itemKey,url:'/'+asset.path,width:asset.dimensions.width,height:asset.dimensions.height,sha256:asset.sha256,bytes:asset.bytes,mime:asset.mime};});
 return page.evaluate(async({face,rows,sources})=>{
  const union=new Uint8Array(960*1440),observations=[],evidence={cardId:face.cardId,side:face.side,status:'measuring',rows:[]};
  window.compositorAlphaEvidence=evidence;
  try{
   for(const [index,row] of rows.entries()){
    const source=sources[index],expectedURL=new URL(source.url,location.href).href;
    const owned={itemKey:row.itemKey,source,expectedURL,status:'acquiring',bitmapClosed:false,canvasReleased:false};evidence.rows.push(owned);
    let bitmap=null,c=null;
    try{
     if(typeof createImageBitmap!=='function')throw new Error('ImageBitmap API unavailable');
     const configuredURL=new URL(GAME_CONFIG.assets['item:'+row.itemKey].url,location.href).href;
     if(configuredURL!==expectedURL)throw new Error('Equipment alpha source URL mismatch: '+row.itemKey);
     const response=await fetch(configuredURL);
     if(!response.ok||response.url!==expectedURL)throw new Error('Equipment alpha response mismatch: '+row.itemKey);
     const bytes=await response.arrayBuffer();
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
     if(bytes.byteLength!==source.bytes||digest!==source.sha256)throw new Error('Equipment alpha source bytes mismatch: '+row.itemKey);
     owned.actualSource={url:response.url,bytes:bytes.byteLength,sha256:digest};
     bitmap=await createImageBitmap(new Blob([bytes],{type:source.mime}));
     if(bitmap.width!==source.width||bitmap.height!==source.height||bitmap.width===0||bitmap.height===0)throw new Error('Equipment alpha bitmap dimensions mismatch: '+row.itemKey);
     owned.bitmapDimensions={width:bitmap.width,height:bitmap.height};owned.status='reading';
     c=document.createElement('canvas');c.width=960;c.height=1440;const ctx=c.getContext('2d');
     const r=row.rect,w=r.width*960,h=r.height*1440,px=r.x*960+w*row.pivot.x,py=r.y*1440+h*row.pivot.y;
     ctx.translate(px,py);ctx.rotate(row.rotation*Math.PI/180);ctx.drawImage(bitmap,-w*row.pivot.x,-h*row.pivot.y,w,h);
     const data=ctx.getImageData(0,0,960,1440).data;let visible=0,overlap=0,protectedArea=0;
     for(let y=0;y<1440;y++)for(let x=0;x<960;x++){
      const i=y*960+x,protectedPixel=Object.values(face.safeRects).some(r=>x>=r.x*960&&x<(r.x+r.width)*960&&y>=r.y*1440&&y<(r.y+r.height)*1440);
      if(protectedPixel){protectedArea++;if(data[i*4+3]>0)overlap++;}
      if(data[i*4+3]>0){visible++;union[i]=1;}
     }
     const measured={itemKey:row.itemKey,visiblePixels:visible,protectedIntersectionRatio:overlap/protectedArea,squareAspect:w/h};
     observations.push(measured);owned.firstRead=measured;owned.status='measured';
    }finally{
     try{if(bitmap){bitmap.close();owned.bitmapClosed=true;}}finally{if(c){c.width=0;c.height=0;owned.canvasReleased=true;}}
    }
   }
   let overlap=0,area=0;for(let y=0;y<1440;y++)for(let x=0;x<960;x++)if(Object.values(face.safeRects).some(r=>x>=r.x*960&&x<(r.x+r.width)*960&&y>=r.y*1440&&y<(r.y+r.height)*1440)){area++;overlap+=union[y*960+x];}
   evidence.status='complete';return {items:observations,fullSetProtectedIntersectionRatio:overlap/area,sourceEvidence:evidence};
  }catch(error){evidence.status='failed';evidence.error={name:error.name,message:error.message};throw error;}
 },{face,rows,sources});
}
test('all 47 actual faces and 107 equipment placements decode as separate DOM layers, preserving state',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1000,height:1500});await open(page);const observations=[];
 const pairs=await page.evaluate(()=>allChars().flatMap(c=>ITEMS.filter(i=>i.fit(c)).map(i=>c.id+':'+i.key)));
 expect(pairs).toHaveLength(103);expect(pairs).toContain('qp-1470:arrow');expect(placements).toHaveLength(107);
 for(const face of manifest.faces){
  const rows=placements.filter(r=>r.cardId===face.cardId&&r.side===face.side),keys=rows.map(r=>r.itemKey);
  const result=await render(page,face,keys);expect(result.loaded.every(Boolean)).toBe(true);expect(result.items).toEqual(keys);expect(result.stateUnchanged&&result.economicUnchanged).toBe(true);
  expect(result.layers).toEqual(['background','rear-equipment','plinth','character','front-equipment','frame','foil','text']);
  const measured=await alpha(page,face,rows);await record(info,face.cardId+'-'+face.side+'-alpha',{result,measured});expect(measured.fullSetProtectedIntersectionRatio).toBeLessThanOrEqual(.01);
  for(const row of measured.items){expect(row.visiblePixels).toBeGreaterThan(0);expect(row.protectedIntersectionRatio).toBeLessThanOrEqual(.01);expect(row.squareAspect).toBeCloseTo(1,8);}
  const key=face.cardId+'-'+face.side;
  await page.locator('.game-card').screenshot({path:info.outputPath(key+'-fullset.png')});
  await render(page,face,keys,72);await page.locator('.game-card').screenshot({path:info.outputPath(key+'-fullset-72.png')});
  for(const row of rows){
   await render(page,face,[row.itemKey]);await page.locator('.game-card').screenshot({path:info.outputPath(key+'-'+row.itemKey+'.png')});
   await render(page,face,[row.itemKey],72);await page.locator('.game-card').screenshot({path:info.outputPath(key+'-'+row.itemKey+'-72.png')});
  }
  observations.push({cardId:face.cardId,side:face.side,...result,...measured});
 }
 await record(info,'coverage',{faces:observations.length,pairs:pairs.length,placements:observations.reduce((n,r)=>n+r.items.length,0),observations,productionArt:true,standaloneRuntimeHarness:true});
});
test('preview and cancel are read only, invalid side and unowned incompatible equipment fail closed',async({page},info)=>{
 await open(page);const observed=await page.evaluate(()=>{
  const id='ssial-270E',state={owned:{[id]:true},stock:{[id]:0},items:{shield:1,arrow:id}},before=JSON.stringify(state),snapshot=JSON.stringify(S);
  const preview=GAME_PRESENTATION.render({cardId:id,side:'front',state,previewItem:'shield'}),cancel=GAME_PRESENTATION.render({cardId:id,side:'front',state});
  const invalid=[{side:'alt'},{previewItem:'bath'},{previewItem:'potion'},{state:{owned:{},items:{shield:id}} ,previewItem:'shield'}].map(change=>{try{GAME_PRESENTATION.render({cardId:id,side:'front',state,...change});return false;}catch{return true;}});
  const reassigned={owned:{[id]:true},items:{shield:'ga-270E'}};let rejected=false;try{GAME_PRESENTATION.render({cardId:id,side:'front',state:reassigned,previewItem:'shield'});}catch{rejected=true;}
  let injectionRejected=false;try{GAME_PRESENTATION.render({cardId:'<img src=x onerror=alert(1)>',side:'front',state});}catch{injectionRejected=true;}
  const undiscovered=GAME_PRESENTATION.render({cardId:id,side:'front',state:{owned:{},items:{arrow:id}}});
  return {injectionRejected,preview:preview.items,cancel:cancel.items,invalid,reassignedRejected:rejected,undiscovered:undiscovered.items,stateUnchanged:before===JSON.stringify(state),economicUnchanged:snapshot===JSON.stringify(S)};
 });
 expect(observed).toEqual({injectionRejected:true,preview:['arrow','shield'],cancel:['arrow'],invalid:[true,true,true,true],reassignedRejected:true,undiscovered:[],stateUnchanged:true,economicUnchanged:true});await record(info,'preview-cancel',observed);
});

test.afterEach(async({page},info)=>{
 if(info.status===info.expectedStatus)return;
 let alphaEvidence;
 try{alphaEvidence=await page.evaluate(()=>window.compositorAlphaEvidence||null);}catch(error){alphaEvidence={status:'unavailable',error:{name:error.name,message:error.message}};}
 await record(info,'failure-coverage',{status:info.status,errors:info.errors,alphaEvidence});
});
