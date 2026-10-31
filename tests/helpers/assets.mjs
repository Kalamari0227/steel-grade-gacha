import fs from 'node:fs/promises';
import path from 'node:path';
export async function mappings(context) {
  if(!context||typeof context!=='object'||Array.isArray(context))throw Error('Asset context requires explicit edition and source');
  const {edition,source}=context;
  if(typeof source!=='string'||!path.isAbsolute(source)||!source.trim())throw Error('Asset source must be an explicit absolute directory');
  if(Object.keys(context).some(key=>!['edition','source'].includes(key)))throw Error('Ambiguous asset context: only edition and source are accepted');
  switch(edition){
    case 'education': {
      const build=await fs.readFile(path.join(source,'src/build.sh'),'utf8');
      if(/tools\/build-game\.mjs/.test(build))throw Error('Education asset source is a game build; use the game asset contract');
      const rows=[...build.matchAll(/^pair\s+(__\w+__)\s+"([^"]+)"\s+(image\/\w+)/gm)].map(([,placeholder,file,mime])=>({placeholder,path:file.replace('$IMG','src/img').replace('$IT','src/itemimg').replace('$PT','src/partimg').replace('$SRC','src'),mime}));
      if(!rows.length)throw Error('Education asset source has no inline build mappings');
      return rows;
    }
    case 'game': {
      const file=path.join(source,'docs/design/game-asset-manifest.json');
      const manifest=JSON.parse(await fs.readFile(file,'utf8'));
      if(manifest.edition!=='game'||manifest.schemaVersion!==2||!Array.isArray(manifest.assets)||!manifest.assets.length)throw Error('Game asset source requires a nonempty schemaVersion 2, edition game manifest');
      return manifest.assets.map(row=>{
        if(!row||typeof row.assetId!=='string'||!row.assetId||typeof row.path!=='string'||!row.path||path.isAbsolute(row.path)||row.path.split(/[\\/]/).includes('..')||typeof row.mime!=='string'||!row.mime.startsWith('image/'))throw Error('Invalid game asset mapping: assetId, relative path and image MIME required');
        return {assetId:row.assetId,path:row.path,mime:row.mime};
      });
    }
    default: throw Error(`Unknown asset edition: ${String(edition)}`);
  }
}
export const groupFor = placeholder => /^__P|^__H[12]__/.test(placeholder)?'po':/^__S/.test(placeholder)?'cr':/^__G|^__H[34]__/.test(placeholder)?'ga':'wire-special';
export async function decode(page, uri) {
  return page.evaluate(uri=>new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(Error('Image decode failed'));img.src=uri;
  }),uri);
}
