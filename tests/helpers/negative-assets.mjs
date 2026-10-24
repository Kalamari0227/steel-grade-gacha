import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { root, evidenceRoot } from './paths.mjs';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sgg-assets-'));
try {
  await fs.cp(`${root}/src`,`${temp}/src`,{recursive:true});
  await fs.cp(`${root}/webtoon`,`${temp}/webtoon`,{recursive:true});
  await fs.copyFile(`${root}/index.html`,`${temp}/index.html`);
  await fs.cp(`${root}/docs/design`,`${temp}/docs/design`,{recursive:true});
  const receipts=[];
  const check=async(name,extra=[])=>{
    const args=['tools/verify-assets.mjs','--root',temp,'--group','pilot','--check-built','--report',`${evidenceRoot}/${name}.json`,...extra];
    let output='';const child=spawn(process.execPath,args,{cwd:root});
    child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
    const code=await new Promise(resolve=>child.on('exit',resolve));
    receipts.push({scenario:name,invocation:[process.execPath,...args],exitCode:code,output,pass:code===1});
    if(code!==1)throw Error(`${name} did not fail`);
  };
  await fs.unlink(`${temp}/src/img/poo.jpg`);
  await check('missing-asset');
  await fs.copyFile(`${root}/src/img/poo.jpg`,`${temp}/src/img/poo.jpg`);
  await check('unchanged-redraw',['--require-redraw']);
  const manifestPath=`${temp}/docs/design/asset-manifest.json`;
  const original=await fs.readFile(manifestPath,'utf8');const manifest=JSON.parse(original);
  manifest.cards[0].cardId='wrong-id';await fs.writeFile(manifestPath,JSON.stringify(manifest));
  await check('wrong-manifest-binding');await fs.writeFile(manifestPath,original);
  await fs.copyFile(`${temp}/src/itemimg/shield.png`,`${temp}/src/partimg/roof.png`);
  await check('changed-preserved-image');
  await fs.writeFile(`${evidenceRoot}/negative.json`,JSON.stringify({receipts,pass:receipts.every(r=>r.pass)},null,2));
}finally {
  await fs.rm(temp,{recursive:true,force:true});
  await fs.writeFile(`${evidenceRoot}/negative-cleanup.json`,JSON.stringify({temp,removed:true}));
}
