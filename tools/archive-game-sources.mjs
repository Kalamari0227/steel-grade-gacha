import fs from 'node:fs';
import path from 'node:path';
import {collectInventory,assertFresh} from './game-archive/inventory.mjs';
import {createTar,expandTar,extractTar} from './game-archive/tar.mjs';
import {verifyRestored,resolveBundledSource} from './game-archive/resolver.mjs';
import {openBundle,durable,receiptPath} from './game-archive/publication.mjs';
import {check,checked,within,read,sha,json,encode,digest,fileHash,validateMaster} from './game-archive/paths.mjs';
const executableRoot=path.resolve(import.meta.dirname,'..');
function options(argv){const o={};for(let i=0;i<argv.length;i+=2){const key=argv[i];check(['--root','--out','--verify-extract','--verify-root','--case','--receipt','--pointer','--report','--extract'].includes(key)&&!o[key]&&argv[i+1]&&!argv[i+1].startsWith('--'),'invalid arguments');o[key]=argv[i+1];}return o;}
function separate(root,target){check(target!==root&&!target.startsWith(root+path.sep)&&!root.startsWith(target+path.sep),'input/output collision');}
function snapshot(out,source){return {source:digest(source),archive:fs.existsSync(out)?fileHash(out):null,receipt:fs.existsSync(receiptPath(out))?sha(fs.readFileSync(receiptPath(out))):null};}
async function negative(root,out,kind){
  check(['missing-source','path-escape','hash-mismatch'].includes(kind),'unknown case');
  const manifest=json(read(within(root,'docs/design/game-asset-manifest.json'))),row=manifest.assets.find(r=>r.assetId==='character:poo-270C:front');check(row,'negative master not found');
  const source=within(root,row.masterPath),before=snapshot(out,source),fixture=fs.mkdtempSync(checked(path.join(process.env.TMPDIR||path.dirname(out),'archive-negative-')));
  const input=fixture+'/input',changed=input+'/source.png',sentinel=fixture+'/outside/sentinel.png';let result;
  try{
    fs.mkdirSync(input);fs.mkdirSync(path.dirname(sentinel));fs.writeFileSync(sentinel,'owned outside sentinel');const sentinelBefore=digest(sentinel);
    fs.writeFileSync(changed,read(source));
    if(kind==='missing-source')fs.unlinkSync(changed);
    if(kind==='hash-mismatch'){const b=read(changed);b[b.length-20]^=1;fs.writeFileSync(changed,b);}
    const relative=kind==='path-escape'?'../outside/sentinel.png':'source.png',mutated={...row,masterPath:relative};fs.writeFileSync(input+'/mutated-row.json',encode(mutated));
    let error;const opened=[],originalOpen=fs.openSync;
    fs.openSync=function(file,...args){opened.push(String(file));return originalOpen.call(this,file,...args);};
    try{validateMaster(input,mutated);throw new Error('negative unexpectedly accepted');}catch(e){error=e;}finally{fs.openSync=originalOpen;}
    check(kind==='missing-source'?error.code==='ENOENT':error.message.includes(kind),'wrong negative boundary: '+error.message);
    const after=snapshot(out,source),sentinelAfter=digest(sentinel);check(JSON.stringify(before)===JSON.stringify(after),'negative changed prior archive/source');check(sentinelBefore===sentinelAfter&&!opened.includes(sentinel),'outside sentinel accessed');
    result={status:'FAIL',case:kind,rejected:true,boundary:kind==='path-escape'?'source path containment':'source read/hash',mutation:{fixture,changed,row:mutated},error:error.message,before,after,accessAudit:{openedDuringValidation:opened,sentinel,sentinelBefore,sentinelAfter,outsideOpens:opened.filter(p=>p===sentinel).length}};
  }finally{fs.rmSync(fixture,{recursive:true,force:true});}
  result.cleanup={fixture,absent:!fs.existsSync(fixture)};return result;
}
async function main(){
  const o=options(process.argv.slice(2));
  if(o['--verify-root']){
    const root=checked(path.resolve(o['--verify-root']));
    const result=o['--receipt']?resolveBundledSource(root,o['--receipt'],o['--pointer']):verifyRestored(root);
    if(o['--report']){const report=checked(path.resolve(o['--report']));separate(root,report);fs.writeFileSync(report,encode(result),{flag:'wx'});}
    console.log(JSON.stringify(o['--receipt']?result:{status:result.status,files:result.files,resolved:result.resolved.length,inputDigest:result.inputDigest}));return;
  }
  const root=checked(path.resolve(o['--root']||executableRoot));check(o['--out']||o['--extract'],'--out required');
  if(o['--extract']){
    check(o['--verify-extract'],'--verify-extract required');const target=checked(path.resolve(o['--verify-extract'])),raw=target+'.unpacked-tar';
    separate(root,target);check(!fs.lstatSync(raw,{throwIfNoEntry:false}),'raw extraction output already exists');check(!fs.existsSync(target)||fs.readdirSync(target).length===0,'restore target must be empty');let started=false;
    try{await expandTar(checked(fs.realpathSync(path.resolve(o['--extract']))),raw);started=true;extractTar(raw,target);const result=verifyRestored(target);console.log(JSON.stringify({status:result.status,files:result.files,resolved:result.resolved.length}));}
    catch(error){if(started)fs.rmSync(target,{recursive:true,force:true});throw error;}
    finally{fs.rmSync(raw,{force:true});}return;
  }
  const out=path.resolve(o['--out']);separate(root,out);checked(path.dirname(out));
  if(o['--case']){console.error(JSON.stringify(await negative(root,out,o['--case'])));process.exitCode=1;return;}
  const restore=o['--verify-extract']?checked(path.resolve(o['--verify-extract'])):null;
  if(restore){separate(root,restore);check(out!==restore&&restore!==out+'.bundle'&&!out.startsWith(restore+path.sep)&&!restore.startsWith(out+'.bundle/'),'output/restore collision');check(!fs.existsSync(restore)||fs.readdirSync(restore).length===0,'restore target must be empty');}
  const publication=openBundle(out);let extractionStarted=false;
  try{
    const inventory=collectInventory(root);console.log(JSON.stringify({phase:'inventory',files:inventory.files.length,counts:inventory.counts,mappings:inventory.mappings.length}));
    const staged=publication.stage+'/archive.tar.gz';await createTar(inventory,staged);
    const raw=publication.stage+'/payload.tar',verifyTarget=restore||publication.stage+'/restored';await expandTar(staged,raw);extractionStarted=true;extractTar(raw,verifyTarget);
    const restored=verifyRestored(verifyTarget);fs.rmSync(raw);if(!restore)fs.rmSync(verifyTarget,{recursive:true});
    assertFresh(inventory);
    const receipt={version:1,archive:path.basename(out),archiveSHA:fileHash(staged),archiveBytes:fs.statSync(staged).size,sourceManifestSHA:sha(inventory.manifest),inputDigest:inventory.inputDigest,counts:inventory.counts,files:inventory.files.length,mappedSources:inventory.mappings.length,node:process.version,verification:{extractedFiles:restored.files,resolvedSources:restored.resolved.length},publication:'immutable generation; archive and receipt links share one atomically replaced current pointer'};
    durable(publication.stage+'/receipt.json',encode(receipt));
    const published=await publication.publish();console.log(JSON.stringify({status:'PASS',...receipt,...published}));
  }catch(e){if(restore&&extractionStarted)fs.rmSync(restore,{recursive:true,force:true});throw e;}finally{publication.close();}
}
main().catch(error=>{console.error(JSON.stringify({status:error.committed?'COMMITTED_WITH_DURABILITY_ERROR':'FAIL',error:error.message,committed:!!error.committed}));process.exitCode=1;});
