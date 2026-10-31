import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {verifyPackage} from '../../tools/game-build/package.mjs';
export const sha=body=>createHash('sha256').update(body).digest('hex');
const overrideRoot=process.env.SGG_EDITION_EVIDENCE_ROOT;
if(overrideRoot!==undefined){
 if(!path.isAbsolute(overrideRoot))throw Error('SGG_EDITION_EVIDENCE_ROOT must be an absolute existing directory');
 try{if(!(await fs.stat(overrideRoot)).isDirectory())throw Error('not a directory');}catch(error){throw Error('SGG_EDITION_EVIDENCE_ROOT is not an existing directory: '+overrideRoot,{cause:error});}
 if(!process.env.SGG_PACKAGE_ROOT||!path.isAbsolute(process.env.SGG_PACKAGE_ROOT))throw Error('SGG_PACKAGE_ROOT must identify the absolute current package when evidence is overridden');
}
export const evidenceRoot=overrideRoot??path.resolve(import.meta.dirname,'../../../.omo/evidence/game-edition/game-20261025-01a16bac/task-33');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4'};
export async function packages(){
 const list=JSON.parse(await fs.readFile(path.join(evidenceRoot,'packages.json'))),result=[];
 for(const p of list){
  const actual=await verifyPackage(p.root);if(actual.release.syntheticFixture||actual.release.releaseId!==p.release.releaseId||JSON.stringify(actual.release)!==JSON.stringify(p.release)||actual.manifestPath!==p.manifestPath)throw Error('Real package binding failed');
  const expected=[...actual.release.files.map(r=>r.path),'game-release.json',actual.manifestPath].sort(),receipt=p.files.map(r=>r.path).sort();
  if(JSON.stringify(expected)!==JSON.stringify(receipt))throw Error('Receipt omitted or added package files');
  const files=[];for(const name of expected){const body=await fs.readFile(path.join(p.root,name)),row=p.files.find(r=>r.path===name),declared=actual.release.files.find(r=>r.path===name);if(row.sha256!==sha(body)||row.bytes!==body.length)throw Error('Stale package receipt '+name);files.push({path:name,sha256:sha(body),bytes:body.length,mime:declared?.mime||'application/json'});}
  result.push({...p,release:actual.release,manifestPath:actual.manifestPath,files});
 }
 if(overrideRoot!==undefined){
  const a=result.filter(p=>p.variant==='A');if(a.length!==1)throw Error('Override requires exactly one current A package');
  const currentRoot=await fs.realpath(process.env.SGG_PACKAGE_ROOT),actual=await verifyPackage(currentRoot);
  if(await fs.realpath(a[0].root)!==currentRoot||actual.release.syntheticFixture||JSON.stringify(a[0].release)!==JSON.stringify(actual.release))throw Error('Override A does not bind the current nonfixture package');
  const shipping=path.resolve(import.meta.dirname,'../..');
  for(const name of ['game-release.json','index.html','sw.js']){
   const bytes=await fs.readFile(path.join(currentRoot,name));
   if(sha(bytes)!==sha(await fs.readFile(path.join(shipping,name))))throw Error('Override A differs from current compiled shipping: '+name);
  }
 }
 return result;
}
export async function taskInputs(){
 const result={},files=['tests/helpers/edition-package-site.mjs','tests/game/edition-e2e-helpers.mjs','tests/game/edition-e2e.spec.mjs','tests/game/cases/edition-e2e.mjs'];
 const root=path.resolve(import.meta.dirname,'../..');for(const name of files)result[name]=sha(await fs.readFile(path.join(root,name)));
 result['packages.json']=sha(await fs.readFile(path.join(evidenceRoot,'packages.json')));for(const p of await packages())for(const row of p.files)result[p.root+'/'+row.path]=row.sha256;
 return result;
}
export async function cleanup(actions){const results=await Promise.allSettled(actions.map(action=>action()));const errors=results.filter(r=>r.status==='rejected').map(r=>r.reason);if(errors.length)throw new AggregateError(errors,'Owned resource teardown failed');}
export async function record(info,name,data){const file=info.outputPath(name+'.json');await fs.mkdir(info.outputDir,{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2));await info.attach(name,{path:file,contentType:'application/json'});return file;}
export async function portAbsent(port){return new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(false);});s.once('error',()=>resolve(true));s.setTimeout(1000,()=>{s.destroy();resolve(false);});});}
export async function startEditionSite(info,{mounts,name='site'}){
 const resourceFile=info.outputPath(name+'-resources.json');await fs.mkdir(info.outputDir,{recursive:true});
 const resource={pid:process.pid,status:'planned',port:null,profileRoot:process.env.TMPDIR,mounts:mounts.map(m=>({path:m.path,root:m.package?.root||m.education}))};
 await fs.writeFile(resourceFile,JSON.stringify(resource,null,2));
 const entries=new Map(),overrides=new Map(),requests=[],phases=[];let phase=null,totalSuccessfulResponses=0;
 async function publish(mount,pkg){
  const checked=await verifyPackage(pkg.root),names=[...checked.release.files.map(r=>r.path),'game-release.json',checked.manifestPath];
  for(const name of names){const file=path.join(pkg.root,name);if(!(await fs.lstat(file)).isFile())throw Error('Nonregular runtime file');const body=await fs.readFile(file),key=mount+name,old=entries.get(key);if(name.startsWith('assets/')&&old&&sha(old.body)!==sha(body))throw Error('Immutable overwrite');entries.set(key,{body,mime:mime[path.extname(name)],sha256:sha(body),source:file});}
  return {release:checked.release.releaseId,files:names.length};
 }
 for(const m of mounts){
  if(!m.path.startsWith('/')||!m.path.endsWith('/'))throw Error('Explicit mount boundary required');
  if(m.package)await publish(m.path,m.package);
  else{
   async function walk(dir,relative=''){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const n=relative+entry.name;if(entry.isDirectory())await walk(path.join(dir,entry.name),n+'/');else if(entry.isFile()&&(/^(index.html|sw.js|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png)$/.test(n)||n.startsWith('src/uiimg/')||n.startsWith('webtoon/'))){const body=await fs.readFile(path.join(dir,entry.name));entries.set(m.path+n,{body,mime:mime[path.extname(n)]||'application/octet-stream',sha256:sha(body),source:path.join(dir,entry.name)});}}}
   await walk(m.education);
  }
 }
 const sockets=new Set();
 const server=http.createServer((req,res)=>{
  res.once('finish',()=>{if(res.statusCode>=200&&res.statusCode<300){totalSuccessfulResponses++;if(phase)phase.successfulOriginResponses++;}});
  const pathname=new URL(req.url,'http://localhost').pathname;
  const log={path:pathname,method:req.method,time:Date.now(),offline:!!phase};requests.push(log);
  if(phase){phase.attempts.push(pathname);req.socket.destroy();return;}
  const fault=overrides.get(pathname);if(fault?.disconnect){log.disconnected=true;req.socket.destroy();return;}
  let key=pathname;const mount=mounts.find(m=>m.path===pathname);if(mount)key+='index.html';
  const row=entries.get(key),body=fault?.body??row?.body,type=fault?.mime??row?.mime;
  if(body===undefined||req.method!=='GET'){log.status=404;res.writeHead(404,{'content-type':'text/plain'}).end('not found');return;}
  log.status=fault?.status||200;log.sha256=sha(body);log.mime=type;log.bytes=Buffer.byteLength(body);
  res.writeHead(log.status,{'cache-control':'no-store','content-type':type});res.end(body);
 });
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 let port;try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 port=server.address().port;if([4173,4273,4274].includes(port))throw Error('Protected port allocated');
 Object.assign(resource,{status:'running',port});await fs.writeFile(resourceFile,JSON.stringify(resource,null,2));}catch(error){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));throw error;}
 return {url:`http://127.0.0.1:${port}`,port,requests,entries,publish,fault:(name,value)=>value?overrides.set(name,value):overrides.delete(name),offline(value){if(value){phase={attempts:[],successfulOriginResponses:0};phases.push(phase);}else phase=null;},async verifyHttp(mount,pkg){const result=[];for(const row of pkg.files){const r=await fetch(`http://127.0.0.1:${port}${mount}${row.path}`),body=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type');if(r.status!==200||sha(body)!==row.sha256||body.length!==row.bytes||type!==row.mime)throw Error('HTTP package mismatch '+row.path);result.push({path:row.path,status:r.status,mime:type,bytes:body.length,sha256:sha(body)});}return result;},async close(){
  server.closeAllConnections();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));
  Object.assign(resource,{status:'closed',portAbsent:await portAbsent(port)});await fs.writeFile(resourceFile,JSON.stringify(resource,null,2));await record(info,name+'-transport',{requests,phases,totalSuccessfulResponses,resource});if(!resource.portAbsent)throw Error('Listener retained');if(phases.some(p=>p.attempts.length===0||p.successfulOriginResponses!==0))throw Error('Outage did not prove failed origin requests and zero successful responses');
 }};
}
