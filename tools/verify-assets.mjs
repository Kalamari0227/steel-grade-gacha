import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { evidenceRoot } from '../tests/helpers/paths.mjs';
import { mappings, decode, groupFor } from '../tests/helpers/assets.mjs';
import { sha } from '../tests/helpers/app.mjs';

async function reviewDocument(row,{fs,sha,reviewRoot}){
  if(!/^[a-f0-9]{64}$/.test(row.finalSha256||''))throw Error('Required final manifest SHA256 missing or invalid');
  if(!['reviewed','approved'].includes(row.reviewStatus))throw Error('Asset review is not complete');
  const reference=row.reviewEvidence;
  if(typeof reference!=='string')throw Error('Required review evidence missing');
  // Historical references are workspace-relative .omo or repo-relative ../.omo.
  const relative=reference.startsWith('../.omo/')?reference.slice(3):reference;
  if(!/^\.omo\/evidence\/.+\/task-\d+\/identity-review\.md$/.test(relative)||relative.split('/').includes('..'))throw Error('Unsupported review evidence reference');
  const file=path.resolve(reviewRoot,relative),bytes=await fs.readFile(file);
  if(!bytes.toString('utf8').trim())throw Error('Review evidence is empty');
  return {file,reference,sha256:sha(bytes)};
}

async function verifyCardReview(row,hash,dependencies){
  const evidence=await reviewDocument(row,dependencies);
  if(hash!==row.finalSha256)throw Error('Final manifest hash mismatch');
  const receiptPath=path.join(path.dirname(evidence.file),'export.json');
  const raw=await dependencies.fs.readFile(receiptPath),receipt=JSON.parse(raw);
  const rows=Array.isArray(receipt)?receipt:receipt.rows||receipt.files;
  if(!Array.isArray(rows))throw Error('Unsupported review export receipt');
  const matches=rows.filter(entry=>path.basename(entry.file||entry.path||entry.final||'')===path.basename(row.newPath)&&(entry.finalSha256||entry.sha256)===hash);
  if(matches.length!==1)throw Error('Review export receipt does not bind this final image');
  return {...evidence,exportReceipt:receiptPath,exportReceiptSha256:dependencies.sha(raw),asset:row.newPath,finalSha256:hash};
}

async function verifyHero({root,fs,decode,page,sha,manifest,reviewRoot,reviewDocument}){
  const asset={path:'src/uiimg/workshop.webp',mime:'image/webp',group:'workshop'};
  const row=manifest.workshop;
  if(!row||row.newPath!==asset.path||row.mime!==asset.mime)throw Error('Workshop manifest path/MIME mismatch');
  if(row.maxBytes!==240*1024||row.maxDimensions?.width!==1200||row.maxDimensions?.height!==480)throw Error('Workshop manifest budget mismatch');
  const review=await reviewDocument(row,{fs,sha,reviewRoot});
  const bytes=await fs.readFile(`${root}/${asset.path}`);
  if(sha(bytes)!==row.finalSha256||bytes.length!==row.bytes)throw Error('Workshop final hash/size mismatch');
  if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error('Workshop MIME is not image/webp');
  if(bytes.length>240*1024)throw Error(`Workshop exceeds240KiB: ${bytes.length}`);
  const dimensions=await decode(page,`data:image/webp;base64,${bytes.toString('base64')}`);
  if(!dimensions.width||!dimensions.height||dimensions.width>1200||dimensions.height>480)throw Error(`Workshop dimensions invalid: ${JSON.stringify(dimensions)}`);
  if(dimensions.width!==row.dimensions?.width||dimensions.height!==row.dimensions?.height)throw Error('Workshop manifest dimensions mismatch');
  if(row.productionEvidence!=='docs/design/production/pilot.md')throw Error('Workshop production association missing');
  const production=await fs.readFile(`${root}/${row.productionEvidence}`);
  const expected=[asset.path,row.finalSha256,String(bytes.length)];
  const bound=production.toString('utf8').split('\n').some(line=>{
    const cells=line.split('|').map(cell=>cell.trim()).filter(Boolean);
    return cells.length===3&&cells.every((value,i)=>value===expected[i]);
  });
  if(!bound)throw Error('Workshop production receipt does not bind final bytes');
  return {...asset,...dimensions,bytes:bytes.length,sha256:sha(bytes),review,production:{path:row.productionEvidence,sha256:sha(production)}};
}

const args=process.argv.slice(2);
const reportIndex=args.indexOf('--report');
const reportPath=reportIndex>=0&&args[reportIndex+1]&&!args[reportIndex+1].startsWith('--')?args[reportIndex+1]:`${evidenceRoot}/asset-baseline.json`;
const report={edition:null,root:null,group:null,redraw:false,built:false,assets:[],errors:[]};
let browser;
try {
  const options=new Map();
  const flags=new Set(['--require-redraw','--check-built']);
  const values=new Set(['--edition','--root','--baseline-root','--review-root','--group','--report']);
  for(let i=0;i<args.length;i++){
    const key=args[i];
    if(options.has(key)||(!flags.has(key)&&!values.has(key)))throw Error(`Unknown or duplicate asset option: ${key}`);
    if(flags.has(key)){options.set(key,true);continue;}
    const value=args[++i];
    if(!value||value.startsWith('--'))throw Error(`Missing value for asset option: ${key}`);
    options.set(key,value);
  }
  for(const key of ['--edition','--root','--baseline-root','--review-root'])if(!options.has(key))throw Error(`Required explicit asset option: ${key}`);
  const edition=options.get('--edition');
  if(edition!=='education')throw Error(`Legacy asset verifier only accepts edition education; received ${edition}. Game assets require tools/verify-game-assets.mjs`);
  for(const key of ['--root','--baseline-root','--review-root'])if(!path.isAbsolute(options.get(key)))throw Error(`Asset option must be an absolute path: ${key}`);
  const root=options.get('--root'),baselineRoot=options.get('--baseline-root'),reviewRoot=options.get('--review-root');
  const group=options.get('--group')||'all',redraw=options.has('--require-redraw'),built=options.has('--check-built');
  Object.assign(report,{edition,root,baselineRoot,reviewRoot,group,redraw,built});
  if(!['pilot','po','cr','ga','wire-special','all'].includes(group))throw Error(`Unknown group: ${group}`);
  const map=await mappings({edition,source:root});
  await mappings({edition,source:baselineRoot});
  if(map.length!==104||new Set(map.map(m=>m.placeholder)).size!==104)throw Error(`Expected104 unique mappings got ${map.length}`);
  const cards=map.filter(m=>m.mime==='image/jpeg');
  if(cards.length!==47)throw Error(`Expected47 cards got ${cards.length}`);
  const template=await fs.readFile(`${root}/src/app_tpl.html`,'utf8');
  const comics=[...new Set(template.match(/webtoon\/[A-Za-z0-9_-]+\.webp/g))];
  if(comics.length!==18)throw Error(`Expected18 comics got ${comics.length}`);
  const manifest=JSON.parse(await fs.readFile(`${root}/docs/design/asset-manifest.json`,'utf8'));
  const selected=group==='all'?cards:cards.filter(m=>manifest.groups[group].includes(m.path));
  if(!selected.length)throw Error('No selected cards');
  const html=built?await fs.readFile(`${root}/index.html`,'utf8'):'';
  const associations=text=>Object.fromEntries([...text.matchAll(/var (IMG(?:_ALT|_PART|_CAR|_ITEM)?)\s*=\s*\{([\s\S]*?)\};/g)].flatMap(([,object,body])=>[...body.matchAll(/(?:"([^"]+)"|(\w+))\s*:\s*"([^"]*)"/g)].map(([,quoted,bare,value])=>[`${object}.${quoted||bare}`,value])));
  const sourceAssociations=associations(template);
  const originalAssociations=associations(await fs.readFile(`${baselineRoot}/src/app_tpl.html`,'utf8'));
  const builtAssociations=built?associations(html):{};
  if(JSON.stringify(sourceAssociations)!==JSON.stringify(originalAssociations))throw Error('Image ID/side to placeholder mapping changed');
  if(manifest) {
    if(manifest.cards.length!==47||new Set(manifest.cards.map(c=>`${c.cardId}:${c.side}`)).size!==47||new Set(manifest.cards.map(c=>c.newPath)).size!==47)throw Error('Manifest must contain47 unique cards/sides/paths');
    const expectedCounts={pilot:6,po:9,cr:13,ga:14,'wire-special':11,all:47};
    for(const [name,count] of Object.entries(expectedCounts))if(manifest.groups[name]?.length!==count||new Set(manifest.groups[name]).size!==count||manifest.groups[name].some(p=>!cards.some(c=>c.path===p)))throw Error(`Invalid manifest group ${name}`);
    for(const row of manifest.cards) {
      const object=row.side==='front'?'IMG':row.side==='alt'?'IMG_ALT':null;
      if(!object||row.mappingObject!==object||sourceAssociations[`${object}.${row.cardId}`]!==row.placeholder||!map.some(m=>m.placeholder===row.placeholder&&m.path===row.newPath))throw Error(`Manifest ID/side/path binding mismatch: ${row.cardId}:${row.side}`);
    }
  }
  if(built&&(/__[A-Z]\d+__/.test(html)||/data:image\/\w+;base64,["']/.test(html)))throw Error('Unresolved placeholder or empty data URI');
  browser=await chromium.launch();const page=await browser.newPage();
  for(const asset of [...map,...comics.map(p=>({path:p,mime:'image/webp'}))]) {
    try {
      const bytes=await fs.readFile(`${root}/${asset.path}`);
      const detected=bytes[0]===0xff&&bytes[1]===0xd8?'image/jpeg':bytes.subarray(1,4).toString()==='PNG'?'image/png':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':'unknown';
      if(detected!==asset.mime)throw Error(`MIME ${detected} expected ${asset.mime}`);
      const uri=`data:${asset.mime};base64,${bytes.toString('base64')}`;
      const dimensions=await decode(page,uri);const hash=sha(bytes);let review;
      if(!dimensions.width||!dimensions.height)throw Error('Zero dimensions');
      if(asset.mime==='image/jpeg') {
        const original=await fs.readFile(`${baselineRoot}/${asset.path}`);
        const originalDimensions=await decode(page,`data:image/jpeg;base64,${original.toString('base64')}`);
        const selectedRedraw=redraw&&selected.some(s=>s.path===asset.path);
        const target=hash===sha(original)&&!selectedRedraw?originalDimensions:{width:480,height:720};
        if(dimensions.width!==target.width||dimensions.height!==target.height)throw Error(`Wrong dimensions ${JSON.stringify(dimensions)} expected ${JSON.stringify(target)}`);
        if(redraw&&selected.some(s=>s.path===asset.path)) {
          const row=manifest.cards.find(c=>c.newPath===asset.path);
          if(!row||row.originalSha256!==sha(original))throw Error('Manifest missing or baseline hash mismatch');
          if(hash===row.originalSha256)throw Error('Unchanged original: redraw required');
          review=await verifyCardReview(row,hash,{fs,sha,reviewRoot});
        }
      }
      if(asset.mime!=='image/jpeg'&&hash!==sha(await fs.readFile(`${baselineRoot}/${asset.path}`)))throw Error('Preserved image changed');
      if(built&&asset.placeholder) {
        if(!template.includes(asset.placeholder))throw Error('Build mapping not referenced in template');
        if(!html.includes(uri))throw Error('Built data URI differs from source');
        const keys=Object.keys(sourceAssociations).filter(key=>sourceAssociations[key]===asset.placeholder);
        if(keys.length!==1||builtAssociations[keys[0]]!==uri)throw Error('Built image bound to wrong ID or side');
        const index=html.indexOf(uri);const actual=html.slice(index,index+uri.length);
        await decode(page,actual);
      }
      report.assets.push({...asset,sha256:hash,...dimensions,review,group:asset.mime==='image/jpeg'?groupFor(asset.placeholder):'preserved'});
    }catch(error){report.errors.push({path:asset.path,error:error.message});}
  }
  try{report.assets.push(await verifyHero({root,fs,decode,page,sha,manifest,reviewRoot,reviewDocument}));}
  catch(error){report.errors.push({path:'src/uiimg/workshop.webp',error:error.message});}
  report.counts={mappings:map.length,cards:cards.length,comics:comics.length,selected:selected.length};
  if(report.errors.length)throw Error(`${report.errors.length} invalid assets`);
  report.pass=true;
}catch(error){report.pass=false;report.errors.push({error:error.message});process.exitCode=1;}
finally {
  await browser?.close();await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:report.pass,counts:report.counts,errors:report.errors,reportPath}));
}
