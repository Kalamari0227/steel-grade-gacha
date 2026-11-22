import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sha,check,legacyModule} from './source.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(here,'../..');
const art=path.join(project,'.omo/artwork/steel-companion-full-art-remake');
const sourceRoot=path.resolve(here,'..');
export const catalogPath='review/ga-foundation-review-2026-11-05-r1/back-arrow-axis-r2/current477-candidates.json';
const catalogueSHA='df6a3d818f0a8617db7dda8a58f4365821aa2419b11c3b6c0604957bb445300c';
const dialogueSHA='464d0d12e2280f2c54555b4387a3d215683d5c415db362d973ce574c450158ee';
const templateSHA='63876d918e51103a41b231698301e51613548502ac167f1ea5cbfad6d909cb36';
// 원본 장착 확정은 템플릿의 <!-- GAME_EQUIPMENT --> 자리에 들어가는 이전 게임 모듈에 있다(3단계). 같은 방식으로 SHA를 고정한다.
const equipmentSHA='74f8edbc2959d5d8bb22307c3495b69e87c7dbe0ad01d300cc588994c33cae6c';
// 웹툰 회차 자료(6단계)만 읽는 두 번째 고정 출처: 포크 e5c9673의 src/app_tpl.html 사본(git show e5c9673:src/app_tpl.html과 같은 바이트). 규칙은 여기서 읽지 않는다.
// 백업 코드 형식(7단계)은 템플릿의 <!-- GAME_BACKUP --> 자리에 들어가는 이전 게임 모듈에 있다. 장비와 같은 방식으로 SHA를 고정한다.
const backupSHA='bba6de0b05fd08d3f6feeb63b1ed2e9504ddb68d8c226f44087c87354d6168c0';
const toonSourceSHA='08a2983b5d936b30398388edfefc29d1e4bdf6cf90d8a14423867f4557a6d1a2';
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
  const equipmentSource=String(await checked(path.join(sourceRoot,'src/game/equipment.js'),equipmentSHA));
  const toonSource=String(await checked(path.join(sourceRoot,'src/upstream/app_tpl-e5c9673.html'),toonSourceSHA));
  const backupSource=String(await checked(path.join(sourceRoot,'src/game/backup.js'),backupSHA));
  const legacy=legacyModule(source,equipmentSource,toonSource,backupSource);
  await fs.mkdir(path.join(here,'src'),{recursive:true});
  await fs.writeFile(path.join(here,'src/legacy.mjs'),legacy.generated);
  await fs.writeFile(path.join(here,'src/quiz.mjs'),legacy.quiz);
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
  check(rules.CARS.length===8&&new Set(rules.CARS.map(c=>c.key)).size===8&&rules.CARS.every(c=>assets['car:'+c.key]),'Car scope mismatch');
  check(appearances.length===301&&appearances.filter(r=>r.equipmentKeys.length===0).length===47,'Appearance scope mismatch');
  const keys=appearances.map(r=>[r.cardId,r.side,r.equipmentKeys.join('+')].join(':'));
  check(new Set(keys).size===301,'Duplicate appearance key');
  for(const row of appearances) check(wording.rows.some(d=>d.cardId===row.cardId&&d.side===row.side),'Unbound dialogue');
  // 8단계 점검: 웹용 파생본(승인 2026-11-20, current/approval/web-derivatives). 원본 그림은 위에서 그대로 복사해 두고,
  // 화면이 쓰는 경로(image·sha256)만 같은 크기의 손실 WebP 파생본으로 바꾼다. 원본 SHA는 sourceSHA256으로 남긴다.
  const derivedMeta=(await json(path.join(sourceRoot,'current/artwork.json'))).webDerivatives;
  check(derivedMeta&&derivedMeta.approved===true&&derivedMeta.root==='assets/web-derivatives-2026-11-20','Web derivatives not approved');
  const derivedRecord=JSON.parse(await checked(path.join(sourceRoot,derivedMeta.approvalRecord),derivedMeta.approvalSHA256));
  check(derivedRecord.category==='web-derivatives'&&derivedRecord.files.length===derivedMeta.count&&derivedRecord.files.length===345,'Web derivative scope mismatch');
  const derivedBySource=new Map();
  for(const f of derivedRecord.files){
    check(/^assets\/web-derivatives-2026-11-20\/[a-f0-9]{64}\.webp$/.test(f.path)&&f.path.endsWith(f.sha256+'.webp'),'Invalid derivative path');
    const bytes=await checked(path.join(sourceRoot,f.path),f.sha256);check(bytes.length===f.bytes,'Derivative size mismatch: '+f.path);
    const image='art/'+f.sha256+'.webp',destination=path.join(out,image);
    let exists=false;try{exists=sha(await fs.readFile(destination))===f.sha256;}catch(error){if(error.code!=='ENOENT') throw error;}
    if(!exists) await fs.writeFile(destination,bytes);
    derivedBySource.set(f.sourceSHA256,{image,sha256:f.sha256});
  }
  let derivedUsed=0;
  const swap=row=>{const d=derivedBySource.get(row.sha256);if(d){row.sourceSHA256=row.sha256;row.image=d.image;row.sha256=d.sha256;derivedUsed++;}};
  appearances.forEach(swap);Object.values(assets).forEach(swap);
  check(derivedUsed>=derivedBySource.size,'Unused web derivative');
  const data={cards,families:rules.allChars().reduce((a,c)=>a.some(f=>f.key===c.fam.key)?a:[...a,{key:c.fam.key,name:c.fam.name,abbr:c.fam.abbr,kind:c.fam.kind}],[]),appearances,dialogue:wording.rows.map(({cardId,side,ko,ja})=>({cardId,side,ko,ja})),assets,parts:rules.parts.map(p=>({key:p.key,name:p.n||p.name,need:p.need,no:p.no,grp:p.grp,note:p.note})),cars:rules.CARS.map(c=>({key:c.key,tag:c.tag,body:c.body,maker:c.maker,line:c.line})),binding:{artSHA:catalogueSHA,dialogueSHA,templateSHA,approvalAudit:readiness.status,prototypeOwnerAuthorized:'2026-11-09',experienceApproved}};
  // 탭별 배경음악(2026-11-22 승인, current/approval/bgm): 승인 기록의 SHA·바이트와 맞는 파일만 public/bgm/<탭>.mp3로 복사하고,
  // 반복 구간(loopStart·loopEnd)은 data.json의 bgm에 넣는다. 서비스 워커 뼈대에는 넣지 않는다(탭에 들어갈 때 받는다).
  const BGM_NAMES=['workshop','crafting','garage','collection','research'];
  const bgmMeta=(await json(path.join(sourceRoot,'current/artwork.json'))).bgm;
  check(bgmMeta&&bgmMeta.approved===true&&bgmMeta.root==='assets/bgm-2026-11-22','Background music not approved');
  const bgmRecord=JSON.parse(await checked(path.join(sourceRoot,bgmMeta.approvalRecord),bgmMeta.approvalSHA256));
  check(bgmRecord.category==='bgm'&&bgmRecord.files.length===bgmMeta.count&&bgmRecord.files.length===BGM_NAMES.length&&BGM_NAMES.every((n,i)=>bgmRecord.files[i].name===n),'Background music scope mismatch');
  await fs.rm(path.join(out,'bgm'),{recursive:true,force:true});await fs.mkdir(path.join(out,'bgm'),{recursive:true});
  data.bgm={};
  for(const f of bgmRecord.files){
    check(f.path===bgmMeta.root+'/'+f.name+'.mp3'&&f.loopStart===1&&f.loopEnd>f.loopStart+20,'Invalid background music row: '+f.name);
    const bytes=await checked(path.join(sourceRoot,f.path),f.sha256);check(bytes.length===f.bytes,'Background music size mismatch: '+f.path);
    await fs.writeFile(path.join(out,'bgm',f.name+'.mp3'),bytes);
    data.bgm[f.name]={file:'bgm/'+f.name+'.mp3',loopStart:f.loopStart,loopEnd:f.loopEnd};
  }
  await fs.writeFile(path.join(out,'data.json'),JSON.stringify(data));
  await fs.mkdir(path.join(out,'audio'),{recursive:true});
  // 최종 검토 지적: 소리와 글꼴도 지금 쓰는 판의 SHA로 고정한다(바뀌거나 모르는 파일이 섞이면 멈춘다). 바꿀 때는 이 표와 승인 기록을 함께 고친다.
  const soundPins={'draw.latch':'159547c2014de96850a702b488ea0c411fe97759a53342fd4c782742a5d63a53','draw.seal':'f01a78ae9fe7af4af97db8bcb206178583012c8be7f5c1677ca4c8320ee9caca','draw.reveal':'fdd22dcb39b9d2941b1c41dbf7c946567bddba5237c52a202d38bb47225acbda','draw.result':'6d695b1904c3e203d8bb1ed7a6bba3b9f477162a6e0250773ac1a1a1862c3915'};
  for(const [cue,pin] of Object.entries(soundPins)) await fs.writeFile(path.join(out,'audio',cue+'.wav'),await checked(path.join(sourceRoot,'src/audio/cues',cue+'.wav'),pin));
  await fs.writeFile(path.join(out,'audio/draw.rare-tuning.wav'),await checked(path.join(here,'src/audio/draw.rare-tuning.wav'),'1a7401bf24aba16d688b2ea10394de4e829ee403f7d62a8ac2a339180bd910a4'));
  // 출하 연출 효과음(2026-11-20 승인, current/approval/sfx): 승인 기록의 SHA·바이트와 맞는 파일만 public/audio/sfx.<이름>.mp3로 복사한다.
  // 화면(reveal.mjs)은 이 파일을 쓰고, 못 불러오면 원래 합성음을 낸다.
  const sfxMeta=(await json(path.join(sourceRoot,'current/artwork.json'))).sfx;
  check(sfxMeta&&sfxMeta.approved===true&&sfxMeta.root==='assets/sfx-2026-11-20','Sound effects not approved');
  const sfxRecord=JSON.parse(await checked(path.join(sourceRoot,sfxMeta.approvalRecord),sfxMeta.approvalSHA256));
  // 2026-11-21: 덜컹(rattle)은 출하 음악(theme)으로 대체됐다. 기록에는 status:'replaced'로 남고 게임에는 복사하지 않는다.
  const SFX_NAMES=['thud','theme','rare-theme','ring','crack','upgrade','burst','chime-steel','chime-silver','chime-gold','chime-holo','chime-rare','craft','car'];
  const sfxActive=sfxRecord.files.filter(f=>f.status!=='replaced');
  check(sfxRecord.category==='sfx'&&sfxRecord.files.length===sfxMeta.count&&sfxActive.length===sfxMeta.active&&sfxActive.length===SFX_NAMES.length&&SFX_NAMES.every(n=>sfxActive.some(f=>f.name===n)),'Sound effect scope mismatch');
  check(sfxRecord.files.filter(f=>f.status==='replaced').every(f=>f.name==='rattle'&&f.replacedBy==='theme'),'Unexpected replaced sound effect');
  await fs.rm(path.join(out,'audio','sfx.rattle.mp3'),{force:true});
  for(const f of sfxActive){
    check(f.path===sfxMeta.root+'/'+f.name+'.mp3','Invalid sound effect path');
    const bytes=await checked(path.join(sourceRoot,f.path),f.sha256);check(bytes.length===f.bytes,'Sound effect size mismatch: '+f.path);
    await fs.writeFile(path.join(out,'audio','sfx.'+f.name+'.mp3'),bytes);
  }
  await fs.mkdir(path.join(out,'fonts'),{recursive:true});
  const fontPins={'Hahmlet-wght-ko.woff2':'45860f0ba7457e2cb3d211da6d333e69a2e113f573896519defc1b9b153a08e9','barlow-condensed-latin-700-normal.woff2':'8320299532b4b81498d5b3714d49c9d5938883b55f4c2a1efe6f105bf4a942bd',
    'noto-sans-kr-korean-400-normal.woff2':'3ec0886a1a46b186a7b3eb297a06f055797d181dc0ae489d4a8bf08885923442','noto-sans-kr-korean-700-normal.woff2':'81377c518da2995dea04bc99f390f092e5930d3eda816696853d0f6b78edc665','noto-sans-kr-korean-900-normal.woff2':'3e9da83940516c57659942d3e3b6e820d0301815abb59e669470260c2e994784',
    'noto-sans-kr-latin-400-normal.woff2':'f8cdf6f7e142774229f8a70b2d6fe649e4a9bfbf95771518e7f8df52beddd673','noto-sans-kr-latin-700-normal.woff2':'e882826d6e4b00eab7eab9bdd59633dce97f5ba8aacb675711c564b0f4e47867','noto-sans-kr-latin-900-normal.woff2':'f2d1893a80dc64cd74b58318424245f7ac1f1cf5284931d1705ca257538b6827',
    'BarlowCondensed-OFL.txt':'10b0e6bb43166a50fbe7cde2895bd7f703738a5da843acb5c97c95dc9ea26817','Hahmlet-OFL.txt':'ddadb10d28a303e3ef3b1f7ec55d3027903b9ec566d2f87d3ee03f3c87c91711','NotoSansKR-OFL.txt':'aabe359f3ee1cbb90d117481ed34a5f39dcdfe2437407ea1ac7bd597dcdf1fba'};
  const fontFiles=(await fs.readdir(path.join(here,'src/fonts'))).filter(name=>/\.(woff2|txt)$/.test(name));
  check(fontFiles.length===Object.keys(fontPins).length&&fontFiles.every(name=>fontPins[name]),'Unpinned font file in src/fonts');
  for(const name of fontFiles) await fs.writeFile(path.join(out,'fonts',name),await checked(path.join(here,'src/fonts',name),fontPins[name]));
  for(const name of await fs.readdir(path.join(here,'src'))) if(/\.(html|mjs|css)$/.test(name)) await fs.copyFile(path.join(here,'src',name),path.join(out,name));
  // 웹툰 그림(6단계)은 캐릭터 원화 477장과 별개의 승인 범주다. 승인 기록(current/approval/webtoon)의 SHA·바이트와 맞는 파일만 public/webtoon으로 복사한다.
  const webtoonMeta=(await json(path.join(sourceRoot,'current/artwork.json'))).webtoon;
  check(webtoonMeta&&webtoonMeta.approved===true&&webtoonMeta.root==='webtoon','Webtoon category not approved');
  const webtoonRecord=JSON.parse(await checked(path.join(sourceRoot,webtoonMeta.approvalRecord),webtoonMeta.approvalSHA256));
  check(webtoonRecord.category==='webtoon'&&webtoonRecord.files.length===webtoonMeta.count&&webtoonRecord.files.length===64,'Webtoon scope mismatch');
  const webtoonDir=await fs.readdir(path.join(sourceRoot,'webtoon'));
  check(webtoonDir.length===webtoonRecord.files.length&&webtoonRecord.files.every(f=>webtoonDir.includes(path.basename(f.path))),'Unapproved or missing webtoon file');
  await fs.rm(path.join(out,'webtoon'),{recursive:true,force:true});await fs.mkdir(path.join(out,'webtoon'),{recursive:true});
  for(const f of webtoonRecord.files){
    check(/^webtoon\/[a-z0-9-]+\.webp$/.test(f.path),'Invalid webtoon path');
    const bytes=await checked(path.join(sourceRoot,f.path),f.sha256);check(bytes.length===f.bytes,`Webtoon size mismatch: ${f.path}`);
    await fs.writeFile(path.join(out,f.path),bytes);
  }
  // 8단계: 설치용 manifest(앱 이름 '스틸 컴패니언', 승인 아이콘 icon:180·192·512)와 서비스 워커(sw.mjs, 뼈대 + 본 그림만). 사용자 결정 2026-11-20.
  const icons={};
  for(const size of [180,192,512]){const a=data.assets['icon:'+size];check(a&&/^art\/[a-f0-9]{64}\.png$/.test(a.image),`Approved icon missing: icon:${size}`);icons[size]=a.image;}
  const indexHTML=await fs.readFile(path.join(out,'index.html'),'utf8');
  // 미리 불러오기 목록이 실제 정적 import 그래프(app.mjs에서 닿는 모듈)와 같은지 확인한다. 늦게 받는 quiz.mjs는 들어가면 안 된다.
  const graph=new Set(),todo=['app.mjs'];
  while(todo.length){const m=todo.pop();if(graph.has(m))continue;graph.add(m);const code=await fs.readFile(path.join(here,'src',m),'utf8');for(const x of code.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"]\.\/([a-z-]+\.mjs)['"]/g))todo.push(x[1]);}
  const preloaded=new Set([...indexHTML.matchAll(/<link rel="modulepreload" href="\.\/([a-z-]+\.mjs)">/g)].map(x=>x[1]));
  check([...graph].every(m=>preloaded.has(m))&&[...preloaded].every(m=>graph.has(m)),`modulepreload mismatch: graph ${[...graph].sort()} vs ${[...preloaded].sort()}`);
  check(indexHTML.includes('<link rel="preload" href="./data.json" as="fetch" crossorigin="anonymous">'),'data.json preload missing');
  check(indexHTML.includes('./'+icons[192])&&indexHTML.includes('./'+icons[180]),'index.html icons must be the approved icon:192·180');
  const manifest={name:'스틸 컴패니언',short_name:'스틸 컴패니언',id:'./',description:'금속 공방에서 코일을 출하하고 동료 카드를 수집하는 스틸 컴패니언',start_url:'./',scope:'./',display:'standalone',orientation:'portrait',background_color:'#e8eaeb',theme_color:'#e8eaeb',lang:'ko',
    icons:[{src:icons[192],sizes:'192x192',type:'image/png',purpose:'any'},{src:icons[512],sizes:'512x512',type:'image/png',purpose:'any'}]};
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const shell=[];
  async function walk(dir,prefix=''){
    for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((x,y)=>x.name.localeCompare(y.name))){
      const rel=prefix?prefix+'/'+entry.name:entry.name;
      if(entry.isDirectory()){if(rel!=='art'&&rel!=='webtoon'&&rel!=='bgm') await walk(path.join(dir,entry.name),rel);continue;}
      if(rel==='sw.mjs') continue;
      const bytes=await fs.readFile(path.join(dir,entry.name));shell.push({path:rel,bytes:bytes.length,sha256:sha(bytes)});
    }
  }
  await walk(out);
  for(const size of [180,192,512]){const bytes=await fs.readFile(path.join(out,icons[size]));shell.push({path:icons[size],bytes:bytes.length,sha256:sha(bytes)});}
  const swBuild=sha(JSON.stringify(shell));
  const toonMap=Object.fromEntries(webtoonRecord.files.map(f=>[f.path,f.sha256]));
  const swTemplate=await fs.readFile(path.join(here,'src/sw-template.js'),'utf8');
  await fs.writeFile(path.join(out,'sw.mjs'),`// Generated by prepare.mjs from src/sw-template.js. Do not edit.\nconst SC_BUILD=${JSON.stringify(swBuild)};\nconst SC_SHELL=${JSON.stringify(shell)};\nconst SC_TOON=${JSON.stringify(toonMap)};\n${swTemplate}`);
  const report={status:'PASS',artSHA:catalogueSHA,dialogueSHA,templateSHA,toonSourceSHA,backupSHA,appearances:301,basic:47,equipped:254,dialogue:47,pool:44,sourceSections:legacy.chunks,webtoonFiles:webtoonRecord.files.length,derivedFiles:derivedBySource.size,sfxFiles:sfxActive.length,bgmFiles:bgmRecord.files.length,derivedUsed,swBuild,shellFiles:shell.length,shellBytes:shell.reduce((sum,r)=>sum+r.bytes,0),copiedFiles:copies.length,copiedBytes:copies.reduce((sum,r)=>sum+r.bytes,0),copies};
  await fs.writeFile(path.join(here,'adapter-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,copies:undefined}));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);check(args.length===0,'No CLI output overrides allowed');await prepare();
}
