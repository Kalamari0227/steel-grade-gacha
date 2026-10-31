import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { root, baselineRoot, educationRoot, educationReviewRoot, evidenceRoot } from './paths.mjs';
if(!educationRoot||!educationReviewRoot)throw Error('Education negatives require SGG_EDUCATION_ROOT and SGG_EDUCATION_REVIEW_ROOT');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sgg-assets-'));
try {
  await fs.cp(`${educationRoot}/src`,`${temp}/src`,{recursive:true});
  await fs.cp(`${educationRoot}/webtoon`,`${temp}/webtoon`,{recursive:true});
  await fs.copyFile(`${educationRoot}/index.html`,`${temp}/index.html`);
  await fs.cp(`${educationRoot}/docs/design`,`${temp}/docs/design`,{recursive:true});
  execFileSync('chmod',['-R','u+w',temp]);
  const receipts=[];
  const expected={
    'missing-asset':row=>row.path==='src/img/poo.jpg'&&/ENOENT/.test(row.error),
    'unchanged-redraw':row=>row.path==='src/img/poo.jpg'&&/Unchanged original: redraw required|Wrong dimensions/.test(row.error),
    'wrong-manifest-binding':row=>/Manifest ID\/side\/path binding mismatch/.test(row.error),
    'changed-preserved-image':row=>row.path==='src/partimg/roof.png'&&/Preserved image changed/.test(row.error),
  };
  const check=async(name,extra=[])=>{
    const reportPath=`${evidenceRoot}/${name}.json`;
    const args=['tools/verify-assets.mjs','--edition','education','--root',temp,'--baseline-root',baselineRoot,'--review-root',educationReviewRoot,'--group','pilot','--check-built','--report',reportPath,...extra];
    let output='';const child=spawn(process.execPath,args,{cwd:root});
    child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
    const [code,signal]=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve([code,signal]));});
    const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
    const pass=code===1&&signal===null&&report.pass===false&&report.errors.some(expected[name]);
    receipts.push({scenario:name,invocation:[process.execPath,...args],exitCode:code,signal,output,reportPath,pass});
    if(!pass)throw Error(`${name} did not produce its expected asset failure: ${output}`);
  };
  await fs.unlink(`${temp}/src/img/poo.jpg`);
  await check('missing-asset');
  await fs.copyFile(`${baselineRoot}/src/img/poo.jpg`,`${temp}/src/img/poo.jpg`);
  await fs.chmod(`${temp}/src/img/poo.jpg`,0o600);
  await check('unchanged-redraw',['--require-redraw']);
  await fs.copyFile(`${educationRoot}/src/img/poo.jpg`,`${temp}/src/img/poo.jpg`);
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
