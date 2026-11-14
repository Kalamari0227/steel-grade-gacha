import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sha,check,legacyModule} from './source.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(here,'../../../..');
const art=path.join(project,'.omo/artwork/steel-companion-full-art-remake');
const sourceRoot=path.resolve(here,'../../..');
export const catalogPath='review/ga-foundation-review-2026-11-05-r1/back-arrow-axis-r2/current477-candidates.json';
const catalogueSHA='df6a3d818f0a8617db7dda8a58f4365821aa2419b11c3b6c0604957bb445300c';
const dialogueSHA='464d0d12e2280f2c54555b4387a3d215683d5c415db362d973ce574c450158ee';
const templateSHA='63876d918e51103a41b231698301e51613548502ac167f1ea5cbfad6d909cb36';
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
async function checked(file,expected){const bytes=await fs.readFile(file);check(sha(bytes)===expected,`SHA mismatch: ${file}`);return bytes;}

export async function prepare({out=path.join(here,'public'),catalog=path.join(art,catalogPath)}={}){
  check(path.resolve(out)===path.join(here,'public'),'Output must be isolated public directory');
  const readiness=await json(path.join(art,'review/pre-prototype-approval-audit-2026-11-09-r1/approval-readiness.json'));
  check(readiness.status==='approval-material-audit-passed'&&readiness.approvalMaterialBlockers===0,'Approval audit not passed');
  check(readiness.artOwnerApproved===477&&readiness.wordingOwnerApprovedPairs===47&&readiness.equippedDialogueFitOwnerApproved===254,'Incomplete approval scope');
  const selected=JSON.parse(await checked(catalog,catalogueSHA));
  const wording=JSON.parse(await checked(path.join(art,'identity/dialogue-current-selection.json'),dialogueSHA));
  check(selected.counts.total===477&&selected.counts.pending===0&&selected.targets.length===477,'Art selection incomplete');
  check(wording.rows.length===47&&wording.rows.every(r=>r.status==='approved'),'Dialogue incomplete');
  const source=String(await checked(path.join(sourceRoot,'src/app_tpl.html'),templateSHA));
  const experienceApproved=(await json(path.join(sourceRoot,'current/artwork.json'))).experienceApproved;
  check(typeof experienceApproved==='boolean','current/artwork.json experienceApproved must be boolean');
  const legacy=legacyModule(source);
  await fs.mkdir(path.join(here,'src'),{recursive:true});
  await fs.writeFile(path.join(here,'src/legacy.mjs'),legacy.generated);
  const {createLegacy}=await import(pathToFileURL(path.join(here,'src/legacy.mjs')));
  const rules=createLegacy();
  const cards=rules.allChars().map(c=>({id:c.id,family:c.fam.key,familyName:c.fam.name,familyKind:c.fam.kind,grade:c.g,code:c.code,level:rules.lvOf(c),levelName:({1:'일반제품',2:'시장기반전략제품',3:'기술기반전략제품',4:'미래수요제품',5:'선행개발제품'})[rules.lvOf(c)],rare:rules.rareOf(c.id)<1,description:c.t,use:rules.use[c.id]||'',spec:rules.specOf(c,false),...(c.alt?{altSpec:rules.specOf(c,true),altDescription:c.alt.t}:{}),hasAlt:!!c.alt}));
  check(cards.length===45&&rules.pool.length===44,'Legacy pool mismatch');
  const appearances=[],assets={},seen=new Set(),copies=[];
  const allowedKinds=new Set(['appearance','thumbnail','part','item','car','stage','background','frame','scene','silhouette','draw','icon']);
  await fs.mkdir(path.join(out,'art'),{recursive:true});
  for(const row of selected.targets){
    check(row.status==='approved',`Unapproved target ${row.id}`);
    if(!allowedKinds.has(row.kind)) continue;
    const relative=row.full||row.image;
    check(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split('/').includes('..'),'Invalid art path');
    const bytes=await checked(path.join(art,relative),row.outputSHA);
    const name=row.outputSHA+path.extname(relative), image='art/'+name;
    if(!seen.has(name)){
      const destination=path.join(out,image);
      let exists=false;try{exists=sha(await fs.readFile(destination))===row.outputSHA;}catch(error){if(error.code!=='ENOENT') throw error;}
      if(!exists) await fs.writeFile(destination,bytes);
      seen.add(name);copies.push({target:row.id,source:relative,image,sha256:row.outputSHA,bytes:bytes.length});
    }
    if(row.kind==='appearance') appearances.push({id:row.id,cardId:row.cardId,side:row.side,equipmentKeys:[...(row.equipmentKeys||[])].sort(),equipment:row.equipment||[],image,sha256:row.outputSHA});
    else assets[row.id]={image,sha256:row.outputSHA};
  }
  check(appearances.length===301&&appearances.filter(r=>r.equipmentKeys.length===0).length===47,'Appearance scope mismatch');
  const keys=appearances.map(r=>[r.cardId,r.side,r.equipmentKeys.join('+')].join(':'));
  check(new Set(keys).size===301,'Duplicate appearance key');
  for(const row of appearances) check(wording.rows.some(d=>d.cardId===row.cardId&&d.side===row.side),'Unbound dialogue');
  const data={cards,families:rules.allChars().reduce((a,c)=>a.some(f=>f.key===c.fam.key)?a:[...a,{key:c.fam.key,name:c.fam.name,abbr:c.fam.abbr,kind:c.fam.kind}],[]),appearances,dialogue:wording.rows.map(({cardId,side,ko,ja})=>({cardId,side,ko,ja})),assets,parts:rules.parts.map(p=>({key:p.key,name:p.n||p.name,need:p.need})),binding:{artSHA:catalogueSHA,dialogueSHA,templateSHA,approvalAudit:readiness.status,prototypeOwnerAuthorized:'2026-11-09',experienceApproved}};
  await fs.writeFile(path.join(out,'data.json'),JSON.stringify(data));
  await fs.mkdir(path.join(out,'audio'),{recursive:true});
  for(const cue of ['draw.latch','draw.seal','draw.reveal','draw.result']) await fs.copyFile(path.join(sourceRoot,'src/audio/cues',cue+'.wav'),path.join(out,'audio',cue+'.wav'));
  await fs.copyFile(path.join(here,'src/audio/draw.rare-tuning.wav'),path.join(out,'audio/draw.rare-tuning.wav'));
  await fs.mkdir(path.join(out,'fonts'),{recursive:true});
  for(const name of await fs.readdir(path.join(here,'src/fonts'))) if(/\.(woff2|txt)$/.test(name)) await fs.copyFile(path.join(here,'src/fonts',name),path.join(out,'fonts',name));
  for(const name of await fs.readdir(path.join(here,'src'))) if(/\.(html|mjs|css)$/.test(name)) await fs.copyFile(path.join(here,'src',name),path.join(out,name));
  const report={status:'PASS',artSHA:catalogueSHA,dialogueSHA,templateSHA,appearances:301,basic:47,equipped:254,dialogue:47,pool:44,sourceSections:legacy.chunks,copiedFiles:copies.length,copiedBytes:copies.reduce((sum,r)=>sum+r.bytes,0),copies};
  await fs.writeFile(path.join(here,'adapter-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,copies:undefined}));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);check(args.length===0,'No CLI output overrides allowed');await prepare();
}
