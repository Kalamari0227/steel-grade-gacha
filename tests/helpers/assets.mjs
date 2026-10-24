import fs from 'node:fs/promises';
import path from 'node:path';
export async function mappings(root) {
  const build=await fs.readFile(path.join(root,'src/build.sh'),'utf8');
  return [...build.matchAll(/^pair\s+(__\w+__)\s+"([^"]+)"\s+(image\/\w+)/gm)].map(([,placeholder,file,mime])=>({placeholder,path:file.replace('$IMG','src/img').replace('$IT','src/itemimg').replace('$PT','src/partimg').replace('$SRC','src'),mime}));
}
export const groupFor = placeholder => /^__P|^__H[12]__/.test(placeholder)?'po':/^__S/.test(placeholder)?'cr':/^__G|^__H[34]__/.test(placeholder)?'ga':'wire-special';
export async function decode(page, uri) {
  return page.evaluate(uri=>new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(Error('Image decode failed'));img.src=uri;
  }),uri);
}
