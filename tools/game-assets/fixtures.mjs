import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {binding, checkNames} from './reviews.mjs';
import {fingerprint} from './schema.mjs';
import {requireValue, sha} from './io.mjs';
export async function writeFixture(root,relative,value) {
  const file=path.join(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,typeof value==='object'&&!Buffer.isBuffer(value)?JSON.stringify(value,null,2)+'\n':value);
}
export function raster({width=768,height=768,opaque=false,seed=1,mime='webp'}={}) {
  const raw=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const offset=(y*width+x)*4;raw[offset]=seed*21;raw[offset+1]=x%256;raw[offset+2]=y%256;raw[offset+3]=opaque||x>width*.2&&x<width*.8&&y>height*.2&&y<height*.8?255:0;
  }
  const codec=mime==='png'?['-c:v','png']:['-c:v','libwebp','-lossless','1'];
  const result=spawnSync('ffmpeg',['-v','error','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-i','pipe:0','-frames:v','1',...codec,'-f','image2pipe','pipe:1'],{input:raw,maxBuffer:32*1024*1024,timeout:15000});
  requireValue(result.status===0&&!result.error,'fixture-encode',result.stderr?.toString());return result.stdout;
}
export async function fixture(context) {
  const {sourceRoot,root,evidence}=context;
  const manifest=JSON.parse(await fs.readFile(path.join(sourceRoot,'docs/design/game-asset-manifest.json'),'utf8'));
  const group='items-portable',selected=manifest.assets.filter(x=>x.ownerGroup===group);
  const fragment={schemaVersion:2,edition:'game',group,assets:[],faces:[],crops:[],placements:[],optionalDerived:[]};
  const files=[];
  for(let i=0;i<selected.length;i++) {
    const original=selected[i],image=raster({seed:i+1}),master=raster({seed:i+1,mime:'png'});
    const reviewReceipt=`docs/design/game-reviews/${group}/${original.assetId.replace(':','-')}.json`;
    const row={...original,status:'approved',bytes:image.length,sha256:sha(image),masterSha256:sha(master),reviewReceipt};
    const at72=raster({width:72,height:108,seed:i+1,mime:'png'}),proof72=`docs/design/game-reviews/${group}/proof72-${i}.png`;
    await writeFixture(root,proof72,at72);
    const proof=`docs/design/game-reviews/${group}/proof-${i}.png`,generation=`docs/design/game-reviews/${group}/generation-${i}.txt`;
    const generationBytes=Buffer.from('SYNTHETIC TEST FIXTURE ONLY. This is not generated production art or an actual human approval.');
    for(const [p,data] of [[row.path,image],[row.masterPath,master],[row.reference,master],[proof,master],[generation,generationBytes]])await writeFixture(root,p,data);
    const checks=Object.fromEntries(checkNames.map(name=>[name,{result:'pass',observation:'Synthetic fixture checks byte binding only, never artistic approval.',evidence:name==='thumbnail72'?proof72:proof,sha256:sha(name==='thumbnail72'?at72:master),displayWidth:name==='thumbnail72'?72:null}]));
    const receipt={schemaVersion:1,status:'approved',purpose:'production',reviewer:'Synthetic test actor only',reviewedAt:'2026-10-25T00:00:00Z',binding:binding(row),referenceSha256:null,generation:{method:'built-in-imagegen',sourceEvidence:generation,sourceEvidenceSha256:sha(generationBytes)},checks,metadata:{face:null,crop:null}};
    fragment.assets.push({beforeSha256:fingerprint(original),value:row});
    await writeFixture(root,reviewReceipt,receipt);
    const archive=path.join(evidence,`synthetic-${i}.png`);await fs.writeFile(archive,master);files.push({assetId:row.assetId,path:row.path,sha256:row.sha256,masterPath:row.masterPath,masterSha256:row.masterSha256,artifact:archive});
  }
  // All rows share the approved reference path; bind receipts to its final actual bytes.
  for(const {value:row} of fragment.assets) {
    const receipt=JSON.parse(await fs.readFile(path.join(root,row.reviewReceipt),'utf8'));
    receipt.referenceSha256=sha(await fs.readFile(path.join(root,row.reference)));
    await writeFixture(root,row.reviewReceipt,receipt);
  }
  await writeFixture(root,'docs/design/game-asset-manifest.json',manifest);
  await writeFixture(root,`docs/design/game-reviews/${group}/manifest-fragment.json`,fragment);
  return {manifest,fragment,files,group};
}
