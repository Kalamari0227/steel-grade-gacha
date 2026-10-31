import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {sha,canonical} from '../../tools/game-build/io.mjs';
import {verifyPackage} from '../../tools/game-build/package.mjs';
const root=path.resolve(import.meta.dirname,'../..'),E=process.env.SGG_PUBLICATION_EVIDENCE;
assert.ok(E&&path.isAbsolute(E),'owned SGG_PUBLICATION_EVIDENCE required');
const W=E+'/work/publication-tests',input=W+'/input',base=W+'/baseline',expected=W+'/expected',output=W+'/output';
const resource={status:'planned',work:W,processes:[],ports:[]},results=[];
const record=(name,data)=>fs.writeFile(E+'/'+name+'.json',JSON.stringify(data,null,2));
const names=['apple-touch-icon.png','icon-192.png','icon-512.png','manifest.webmanifest','sw.js','game-release.json','index.html'];
const snapshot=async directory=>Object.fromEntries(await Promise.all(names.map(async name=>[name,sha(await fs.readFile(directory+'/'+name))])));
let oldSHA,newSHA,oldModes;
async function run(id,options={}){
  const args=['tools/build-game.mjs','--fixture','--root',input,'--out',output],row={id,args,status:'planned'};resource.processes.push(row);await record('test-resources',resource);
  const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,TMPDIR:E+'/work/tmp',NODE_COMPILE_CACHE:E+'/work/node-cache',BUN_RUNTIME_TRANSPILER_CACHE_PATH:E+'/work/bun-cache',...(options.hook?{NODE_OPTIONS:'--import='+options.hook}:{})},detached:true,stdio:['ignore','pipe','pipe']});row.pid=child.pid;row.status='running';await record('test-resources',resource);
  const chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));
  let observed=false;const poll=options.marker?setInterval(async()=>{if(observed)return;try{await fs.stat(options.marker);observed=true;if(options.onMarker)await options.onMarker();process.kill(-child.pid,options.signal||'SIGTERM');}catch(e){if(e.code!=='ENOENT')throw e;}},20):null;
  const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},90000);
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});clearTimeout(timer);clearInterval(poll);Object.assign(row,{status:'closed',...exit});await record('test-resources',resource);
  const result={id,args,...exit,markerObserved:observed,output:Buffer.concat(chunks).toString()};await record(id,result);return result;
}
async function hook(id,boundary,kind='pause'){
  const marker=W+'/'+id+'.marker',file=W+'/'+id+'.mjs';
  await fs.writeFile(file,`import fs from 'node:fs';import timers from 'node:timers/promises';import {syncBuiltinESMExports} from 'node:module';let fired=false;const rename=fs.renameSync,unlink=fs.unlinkSync,immediate=timers.setImmediate;function hit(){if(fired)return;fired=true;fs.writeFileSync(${JSON.stringify(marker)},'real publication boundary reached');${kind==='kill'?"process.kill(process.pid,'SIGKILL');":kind==='commit'?"process.kill(process.pid,'SIGTERM');":''}}fs.renameSync=function(a,b){const result=rename.call(this,a,b);if(b===${JSON.stringify(output+'/'+boundary)})hit();return result;};${kind==='commit'?`fs.unlinkSync=function(file){const result=unlink.call(this,file);if(file===${JSON.stringify(output+'.game-build-lock/journal.json')})hit();return result;};`:''}timers.setImmediate=async function(...args){if(fired&&${kind==='pause'})await new Promise(()=>setInterval(()=>{},1000));return immediate(...args);};syncBuiltinESMExports();`);
  return {hook:file,marker};
}
async function reset(){await fs.rm(output,{recursive:true,force:true});await fs.cp(base,output,{recursive:true});}
async function preserved(id){assert.deepEqual(await snapshot(output),oldSHA);assert.deepEqual(Object.fromEntries(await Promise.all(names.map(async name=>[name,(await fs.stat(output+'/'+name)).mode&0o777]))),oldModes);await verifyPackage(output);assert.equal(await fs.stat(output+'.game-build-lock').then(()=>true,e=>e.code!=='ENOENT'),false);results.push({id,status:'PASS',before:oldSHA,after:await snapshot(output),packageValid:true,lockAbsent:true,modesPreserved:oldModes});await record('publication-results',results);}
before(async()=>{
  await record('test-resources',resource);await fs.mkdir(E+'/work/tmp',{recursive:true});await fs.mkdir(W,{recursive:true});await fs.cp(process.env.SGG_PUBLICATION_FIXTURE,input,{recursive:true});
  assert.equal((await run('baseline-build')).code,0);await fs.rename(output,base);await fs.chmod(base+'/sw.js',0o444);oldSHA=await snapshot(base);oldModes=Object.fromEntries(await Promise.all(names.map(async name=>[name,(await fs.stat(base+'/'+name)).mode&0o777])));
  const manifestFile=input+'/docs/design/game-asset-manifest.json',manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
  for(const row of manifest.assets.filter(r=>r.kind==='icon')){
    const file=input+'/'+row.path,result=spawnSync('ffmpeg',['-v','error','-i',file,'-vf','hue=h=90','-frames:v','1','-c:v','png','-f','image2pipe','pipe:1'],{maxBuffer:2000000,timeout:15000});assert.equal(result.status,0);await fs.writeFile(file,result.stdout);row.bytes=result.stdout.length;row.sha256=sha(result.stdout);
  }
  await fs.writeFile(manifestFile,canonical(manifest));await fs.appendFile(input+'/src/app_tpl.html','\n<!-- publication regression fixture -->\n');
  const pwa=JSON.parse(await fs.readFile(input+'/manifest.webmanifest','utf8'));pwa.description+=' synthetic publication variant';await fs.writeFile(input+'/manifest.webmanifest',JSON.stringify(pwa));
  assert.equal((await run('reference-build')).code,0);await fs.rename(output,expected);newSHA=await snapshot(expected);assert.ok(names.every(n=>oldSHA[n]!==newSHA[n]));
},{timeout:180000});
for(const name of names)test('SIGTERM and SIGINT after '+name+' preserve old package; ordinary resume succeeds',async()=>{
  await reset();
  for(const signal of ['SIGTERM','SIGINT']){
    const id='cancel-'+name.replaceAll('.','-')+'-'+signal,probe=await hook(id,name),result=await run(id,{...probe,signal});
    assert.ok(result.markerObserved);assert.equal(result.code,signal==='SIGTERM'?143:130);await preserved(id);
  }
  const resumed=await run('resume-'+name.replaceAll('.','-'));assert.equal(resumed.code,0);assert.deepEqual(await snapshot(output),newSHA);await verifyPackage(output);results.push({id:resumed.id,status:'PASS',after:await snapshot(output),packageValid:true});await record('publication-results',results);
},{timeout:180000});
test('SIGKILL leaves journal and ordinary build recovers before package validation',async()=>{
  await reset();const probe=await hook('hard-kill','sw.js','kill'),killed=await run('hard-kill',{hook:probe.hook});assert.equal(killed.signal,'SIGKILL');await assert.rejects(verifyPackage(output));
  const beforeRecovery=await snapshot(output);assert.equal((await run('hard-kill-resume')).code,0);assert.deepEqual(await snapshot(output),newSHA);await verifyPackage(output);results.push({id:'SIGKILL-recovery',status:'PASS',beforeRecovery,after:await snapshot(output),immediateConsistencyClaim:false});await record('publication-results',results);
},{timeout:180000});
test('post-commit SIGTERM retains complete new package',async()=>{
  await reset();const probe=await hook('post-commit','never','commit'),result=await run('post-commit',{hook:probe.hook});assert.equal(await fs.readFile(probe.marker,'utf8'),'real publication boundary reached');assert.ok([0,143].includes(result.code)||result.signal==='SIGTERM');assert.deepEqual(await snapshot(output),newSHA);await verifyPackage(output);results.push({id:'post-commit',status:'PASS',after:await snapshot(output)});await record('publication-results',results);
},{timeout:120000});
test('another writer cannot enter active output lease',async()=>{
  await reset();const probe=await hook('writer-lock','sw.js');let second;
  const result=await run('writer-lock',{...probe,onMarker:async()=>{second=await run('competing-writer');assert.equal(second.code,1);assert.match(second.output,/writer is active/);}});assert.equal(result.code,143);await preserved('writer-lock');await record('competing-writer-proof',{first:result,second});
},{timeout:120000});
after(async()=>{resource.status='closed';await record('test-resources',resource);await fs.cp(expected,E+'/current-site',{recursive:true});await fs.rm(W,{recursive:true,force:true});await record('test-cleanup',{work:W,absent:await fs.stat(W).then(()=>false,e=>e.code==='ENOENT')});});
