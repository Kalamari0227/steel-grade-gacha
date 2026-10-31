import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fork,spawnSync} from 'node:child_process';
import {header,inspectTar,extractTar,createTar,expandTar} from '../../tools/game-archive/tar.mjs';
import {within,encode,sha,read,fileHash} from '../../tools/game-archive/paths.mjs';
import {resolveBundledSource,verifyRestored} from '../../tools/game-archive/resolver.mjs';
import {openBundle,durable} from '../../tools/game-archive/publication.mjs';
const E=process.env.SGG_ARCHIVE_EVIDENCE;assert.ok(E&&path.isAbsolute(E));
const records=[];
async function scenario(name,fn){const directory=fs.mkdtempSync(E+'/work/test-');try{await fn(directory);records.push({name,status:'PASS'});}finally{fs.rmSync(directory,{recursive:true,force:true});fs.writeFileSync(E+'/native-results.json',encode(records));}}
const checksum=h=>{h.fill(32,148,156);h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);return h;};
for(const [name,mutate] of [
 ['traversal',h=>{h.fill(0,0,100);h.write('../escape',0);return checksum(h);}],
 ['absolute',h=>{h.fill(0,0,100);h.write('/tmp/escape',0);return checksum(h);}],
 ['drive',h=>{h.fill(0,0,100);h.write('C:/escape',0);return checksum(h);}],
 ['hardlink',h=>{h[156]=49;return checksum(h);}],['symlink',h=>{h[156]=50;return checksum(h);}],['device',h=>{h[156]=51;return checksum(h);}],
 ['duplicate',h=>Buffer.concat([h,h])],['case-collision',h=>Buffer.concat([h,header('File',0)])]
])test('rejects '+name+' before destination writes',()=>scenario(name,async dir=>{
  // Given an actual malformed tar stream and an untouched destination.
  const raw=dir+'/bad.tar',out=dir+'/out';fs.writeFileSync(raw,Buffer.concat([mutate(header('file',0)),Buffer.alloc(1024)]));
  // When the actual extractor receives it, Then no output is created.
  assert.throws(()=>extractTar(raw,out));assert.equal(fs.existsSync(out),false);
}));
test('rejects symlink parents without accessing outside bytes',()=>scenario('symlink-parent',async dir=>{
 const outside=dir+'/outside',out=dir+'/out';fs.mkdirSync(out);fs.writeFileSync(outside,'sentinel');fs.symlinkSync(outside,out+'/file');
 assert.throws(()=>read(within(out,'file')),/symlink/);assert.equal(fs.readFileSync(outside,'utf8'),'sentinel');
}));
test('extracts exact payload and resolves only bound relative map; missing mapping cannot fallback',()=>scenario('resolver',async dir=>{
 const source=dir+'/source',out=dir+'/out';fs.writeFileSync(source,'owned original');const receipt=encode({source}),data=Buffer.from('owned original');
 const map=encode({entries:[{receiptPath:'receipt.json',jsonPointer:'/source',original:source,archivedPath:'data',sha256:sha(data),role:'reference'}]});
 const files=[['data',data],['receipt.json',receipt],['source-materials/provenance-map.json',map]].map(([name,body])=>({path:name,body,bytes:body.length,sha256:sha(body)}));
 const payload=files.map(({body,...r})=>r),manifest=encode({version:1,inputDigest:sha(encode(payload)),files:payload,requiredMappings:[{receiptPath:'receipt.json',jsonPointer:'/source'}]});
 await createTar({files,manifest},dir+'/a.gz');await expandTar(dir+'/a.gz',dir+'/a.tar');assert.equal(inspectTar(dir+'/a.tar').length,4);extractTar(dir+'/a.tar',out);
 assert.equal(verifyRestored(out).resolved.length,1);assert.equal(resolveBundledSource(out,'receipt.json','/source').sha256,sha(data));
 assert.throws(()=>resolveBundledSource(out,'receipt.json','/missing'),/missing or duplicate/);
 fs.unlinkSync(out+'/data');assert.throws(()=>resolveBundledSource(out,'receipt.json','/source'),/ENOENT/);assert.equal(fs.readFileSync(source,'utf8'),'owned original');
}));
test('a failed staged replacement preserves previous archive and receipt pair',()=>scenario('publication',async dir=>{
 const out=dir+'/sources.tar.gz';
 function stage(tx,body){durable(tx.stage+'/archive.tar.gz',body);durable(tx.stage+'/receipt.json',encode({archiveSHA:sha(body)}));}
 const first=openBundle(out);stage(first,'first');await first.publish();first.close();const before=[fs.readFileSync(out),fs.readFileSync(dir+'/sources.receipt.json')];
 const failure=openBundle(out);stage(failure,'never published');failure.close();assert.deepEqual([fs.readFileSync(out),fs.readFileSync(dir+'/sources.receipt.json')],before);
 const next=openBundle(out);stage(next,'second');await next.publish();next.close();assert.equal(fs.readFileSync(out,'utf8'),'second');assert.equal(JSON.parse(fs.readFileSync(dir+'/sources.receipt.json')).archiveSHA,sha('second'));
}));
test('SIGTERM/SIGINT/repeated interruption and SIGKILL before pointer retain prior pair; resume succeeds',()=>scenario('interruptions',async dir=>{
 const out=dir+'/sources.tar.gz',first=openBundle(out);durable(first.stage+'/archive.tar.gz','previous');durable(first.stage+'/receipt.json',encode({archiveSHA:sha('previous')}));await first.publish();first.close();
 const before=[fs.readFileSync(out),fs.readFileSync(dir+'/sources.receipt.json')],module=path.resolve(import.meta.dirname,'../../tools/game-archive/publication.mjs');
 const hook=dir+'/pause.mjs',runner=dir+'/child.mjs';
 fs.writeFileSync(hook,`import fs from 'node:fs';import timers from 'node:timers/promises';import {syncBuiltinESMExports} from 'node:module';const symlink=fs.symlinkSync;let reached=false;fs.symlinkSync=function(a,b,...r){const result=symlink.call(this,a,b,...r);if(String(b).includes('/next-')){reached=true;process.send({boundary:'before atomic pointer',pid:process.pid});}return result;};const immediate=timers.setImmediate;timers.setImmediate=async function(...a){if(reached)await new Promise(()=>setInterval(()=>{},1000));return immediate(...a);};syncBuiltinESMExports();`);
 fs.writeFileSync(runner,`import {openBundle,durable} from ${JSON.stringify(module)};import {createHash} from 'node:crypto';const t=openBundle(${JSON.stringify(out)});try{durable(t.stage+'/archive.tar.gz','candidate');durable(t.stage+'/receipt.json',JSON.stringify({archiveSHA:createHash('sha256').update('candidate').digest('hex')}));await t.publish();}finally{t.close();}`);
 const cases=[];
 for(const signal of ['SIGTERM','SIGINT','SIGTERM','SIGKILL']){
   const child=fork(runner,{execArgv:['--import',hook],silent:true,env:{...process.env,TMPDIR:E+'/work/tmp',NODE_COMPILE_CACHE:E+'/work/node-cache'}}),logs=[];
   child.stdout.on('data',b=>logs.push(b.toString()));child.stderr.on('data',b=>logs.push(b.toString()));let boundary;
   child.on('message',m=>{boundary=m;child.kill(signal);});const timer=setTimeout(()=>child.kill('SIGKILL'),15000);
   const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});clearTimeout(timer);
   assert.equal(boundary?.boundary,'before atomic pointer');assert.ok(exit.code===143||exit.code===130||exit.signal==='SIGKILL');assert.deepEqual([fs.readFileSync(out),fs.readFileSync(dir+'/sources.receipt.json')],before);
   cases.push({requested:signal,pid:child.pid,boundary,exit,logs,priorPreserved:true});
   // Reacquire the actual abandoned lease after SIGKILL; ordinary publication may proceed.
   const resumed=openBundle(out);resumed.close();
 }
 const resumed=openBundle(out);durable(resumed.stage+'/archive.tar.gz','resumed');durable(resumed.stage+'/receipt.json',encode({archiveSHA:sha('resumed')}));await resumed.publish();resumed.close();assert.equal(fs.readFileSync(out,'utf8'),'resumed');
 fs.writeFileSync(E+'/interruptions.json',encode({cases,resume:'PASS'}));
}));
test('stale source bytes reject before any publication',()=>scenario('stale-input',async dir=>{
 const {assertFresh}=await import('../../tools/game-archive/inventory.mjs'),source=dir+'/source';fs.writeFileSync(source,'before');const inventory={files:[{source,path:'source',sha256:sha('before')}]};fs.writeFileSync(source,'after');assert.throws(()=>assertFresh(inventory),/stale input/);
}));
test('rejects a competing writer and unrelated existing output',()=>scenario('dirty-output',async dir=>{
 const out=dir+'/source.tar.gz',first=openBundle(out);try{assert.throws(()=>openBundle(out),/writer is active/);}finally{first.close();}
 fs.writeFileSync(out,'unrelated work');assert.throws(()=>openBundle(out),/unrelated bundle output/);assert.equal(fs.readFileSync(out,'utf8'),'unrelated work');
}));
test('literal shell metacharacters remain file names and never execute',()=>scenario('inert-path',async dir=>{
 const filename='$(touch sentinel).txt';fs.writeFileSync(within(dir,filename),'inert');assert.equal(read(within(dir,filename)).toString(),'inert');assert.equal(fs.existsSync(dir+'/sentinel'),false);
}));
test('oversized header and file/directory collision reject before writing',()=>scenario('tar-limits',async dir=>{
 for(const [id,headers] of [['oversized',[header('large',128*1024*1024+1)]],['ancestor',[header('a',0),header('a/b',0)]]]){const raw=dir+'/'+id+'.tar',out=dir+'/'+id;fs.writeFileSync(raw,Buffer.concat([...headers,Buffer.alloc(1024)]));assert.throws(()=>extractTar(raw,out));assert.equal(fs.existsSync(out),false);}
}));
test('failed standalone hash verification removes owned extraction target',()=>scenario('extract-rollback',async dir=>{
 const body=Buffer.from('actual'),files=[{path:'data',bytes:body.length,sha256:sha('wrong')}],manifest=encode({version:1,files,inputDigest:sha(encode(files)),requiredMappings:[]});await createTar({files:[{path:'data',body}],manifest},dir+'/bad.gz');
 const result=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../../tools/archive-game-sources.mjs'),'--extract',dir+'/bad.gz','--verify-extract',dir+'/restored'],{encoding:'utf8',timeout:15000});assert.equal(result.status,1);assert.match(result.stderr,/hash-mismatch: data/);assert.equal(fs.existsSync(dir+'/restored'),false);assert.equal(fs.existsSync(dir+'/restored.unpacked-tar'),false);
 fs.writeFileSync(E+'/extract-rollback.json',encode({exit:result.status,stderr:result.stderr,targetAbsent:true,rawAbsent:true}));
}));
test('duplicate required pointers cannot omit a distinct source mapping',()=>scenario('mapping-set',async dir=>{
 const data=Buffer.from('data'),receipt=encode({a:'original',b:'original'}),map=encode({entries:['a','b'].map(k=>({receiptPath:'receipt.json',jsonPointer:'/'+k,original:'original',archivedPath:'data',sha256:sha(data)}))});
 const files=[['data',data],['receipt.json',receipt],['source-materials/provenance-map.json',map]].map(([p,b])=>({path:p,bytes:b.length,sha256:sha(b),body:b}));for(const f of files){fs.mkdirSync(path.dirname(dir+'/'+f.path),{recursive:true});fs.writeFileSync(dir+'/'+f.path,f.body);}
 const payload=files.map(({body,...r})=>r),manifest={version:1,files:payload,inputDigest:sha(encode(payload)),requiredMappings:[{receiptPath:'receipt.json',jsonPointer:'/a'},{receiptPath:'receipt.json',jsonPointer:'/a'}]};fs.writeFileSync(dir+'/source-materials/source-manifest.json',encode(manifest));assert.throws(()=>verifyRestored(dir),/duplicate source mapping requirement/);
 manifest.inputDigest='not a digest';fs.writeFileSync(dir+'/source-materials/source-manifest.json',encode(manifest));assert.throws(()=>verifyRestored(dir),/input digest mismatch/);
}));
test('restore store equality collision is rejected before any output mutation',()=>scenario('store-collision',async dir=>{
 const out=dir+'/bundle.tar.gz',r=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../../tools/archive-game-sources.mjs'),'--out',out,'--verify-extract',out+'.bundle'],{encoding:'utf8',timeout:15000});assert.equal(r.status,1);assert.match(r.stderr,/output\/restore collision/);assert.equal(fs.existsSync(out+'.bundle'),false);assert.equal(fs.existsSync(out+'.bundle.game-build-lock'),false);assert.equal(r.stdout,'');
 fs.writeFileSync(E+'/store-collision.json',encode({exit:r.status,stderr:r.stderr,storeAbsent:true,lockAbsent:true}));
}));
test('post-pointer durability failure explicitly reports committed new pair',()=>scenario('postcommit-durability',async dir=>{
 const out=dir+'/bundle.tar.gz',tx=openBundle(out);durable(tx.stage+'/archive.tar.gz','new');durable(tx.stage+'/receipt.json',encode({archiveSHA:sha('new')}));const original=fs.fsyncSync;let failure;
 fs.fsyncSync=()=>{throw new Error('owned fsync fault');};try{await tx.publish();}catch(error){failure=error;}finally{fs.fsyncSync=original;tx.close();}
 assert.equal(failure.committed,true);assert.match(failure.message,/archive committed; directory fsync failed/);assert.equal(fs.readFileSync(out,'utf8'),'new');assert.equal(JSON.parse(fs.readFileSync(dir+'/bundle.receipt.json')).archiveSHA,sha('new'));
 fs.writeFileSync(E+'/postcommit-durability.json',encode({committed:failure.committed,error:failure.message,newPairHashMatches:true}));
}));
test('preexisting raw extraction staging file is preserved',()=>scenario('raw-collision',async dir=>{
 const target=dir+'/restored';fs.writeFileSync(target+'.unpacked-tar','unrelated data');const r=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../../tools/archive-game-sources.mjs'),'--extract',dir+'/not-needed.gz','--verify-extract',target],{encoding:'utf8',timeout:15000});assert.equal(r.status,1);assert.match(r.stderr,/raw extraction output already exists/);assert.equal(fs.readFileSync(target+'.unpacked-tar','utf8'),'unrelated data');
}));
test('actual production archive extracts all three current operating documents with frozen bytes',()=>scenario('production-documents',async dir=>{
 const {collectInventory,assertFresh}=await import('../../tools/game-archive/inventory.mjs');
 const root=path.resolve(import.meta.dirname,'../..'),inventory=collectInventory(root),documents=['README.md','docs/game-maintenance.md','docs/releases/game-edition.md'];
 const expected=documents.map(name=>({path:name,bytes:fs.statSync(root+'/'+name).size,sha256:sha(read(root+'/'+name))}));
 for(const row of expected){const entry=inventory.files.find(r=>r.path===row.path);assert.ok(entry);assert.equal(entry.role,'production-document');assert.equal(entry.sha256,row.sha256);}
 await createTar(inventory,dir+'/production.tar.gz');await expandTar(dir+'/production.tar.gz',dir+'/production.tar');extractTar(dir+'/production.tar',dir+'/restored');
 const restored=verifyRestored(dir+'/restored');assert.equal(restored.files,inventory.files.length);
 for(const row of expected){const bytes=read(dir+'/restored/'+row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);}
 assertFresh(inventory);fs.writeFileSync(E+'/production-documents.json',encode({sourceRoot:root,inputDigest:inventory.inputDigest,files:restored.files,documents:expected,archiveSHA:fileHash(dir+'/production.tar.gz'),restored:true}));
}));
