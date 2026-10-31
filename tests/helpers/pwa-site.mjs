import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {root,baselineRoot} from './paths.mjs';
import {mappings} from './assets.mjs';
import {mimeTypes} from '../../tools/game-qa/server.mjs';
const educationFiles=['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','webtoon','src/uiimg'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function relativeParts(name){
  if(typeof name!=='string'||path.isAbsolute(name)||name.includes('\\')||name.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe PWA package path');
  return name.split('/');
}
async function checkedRoot(base){
  const stat=await fs.lstat(base);
  if(stat.isSymbolicLink()||!stat.isDirectory()||await fs.realpath(base)!==base)throw Error('PWA directory boundary rejected');
}
async function checkedPath(base,name,kind='file'){
  await checkedRoot(base);
  const parts=relativeParts(name);let target=base;
  for(let i=0;i<parts.length;i++){
    target=path.join(target,parts[i]);const stat=await fs.lstat(target);
    if(stat.isSymbolicLink())throw Error('PWA symbolic link rejected');
    if(i<parts.length-1 && !stat.isDirectory())throw Error('PWA parent must be a directory');
    if(i===parts.length-1 && !(stat.isFile()||(kind==='entry'&&stat.isDirectory())))throw Error('PWA package requires regular files');
  }
  return target;
}
async function readRegular(base,name){
  const target=await checkedPath(base,name);
  const file=await fs.open(target,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{if(!(await file.stat()).isFile())throw Error('PWA package requires regular files');return await file.readFile();}
  finally{await file.close();}
}
async function packageFiles(pkg,mode){
  if(!path.isAbsolute(pkg.root)||!Array.isArray(pkg.files)||!pkg.files.length)throw Error('Invalid PWA package');
  const base=path.resolve(pkg.root);await checkedRoot(base);
  const files=[];
  async function include(name){
    const target=await checkedPath(base,name,mode==='legacy-directory-expansion'?'entry':'file');
    if((await fs.lstat(target)).isDirectory()){
      for(const child of await fs.readdir(target))await include(name+'/'+child);
    }else files.push(name);
  }
  for(const name of pkg.files){
    relativeParts(name);
    try{await include(name);}catch(error){if(mode!=='legacy-directory-expansion'||error.code!=='ENOENT')throw error;}
  }
  return {base,files:[...new Set(files)]};
}
export async function startPwaSite(info,options={edition:'education'}){
  if(!['education','game'].includes(options.edition))throw Error('Explicit PWA edition required');
  if(options.edition==='game' && (!options.baseline || !options.current))throw Error('Game PWA package file lists required');
  const source=Object.hasOwn(options,'source')?options.source:root;
  if(options.edition==='education'){
    await mappings({edition:'education',source:baselineRoot});
    await mappings({edition:'education',source});
  }
  const packages=options.edition==='education'?{baseline:{root:baselineRoot,files:educationFiles},current:{root:source,files:educationFiles}}:options;
  const provenance={edition:options.edition,baselineRoot:packages.baseline.root,initialCurrentRoot:packages.current.root};
  const mode=options.edition==='education'?'legacy-directory-expansion':'regular-files';
  await packageFiles(packages.baseline,mode);await packageFiles(packages.current,mode);
  if(!process.env.TMPDIR) throw Error('Task-specific TMPDIR required');
  const directory=path.join(process.env.TMPDIR,'sgg-upgrade-'+crypto.randomUUID());
  await fs.mkdir(info.outputDir,{recursive:true});
  const resourceFile=info.outputPath('pwa-resources.json');
  await fs.writeFile(resourceFile,JSON.stringify({directory,pid:process.pid,status:'planned',port:options.port || 0,provenance},null,2));
  await fs.mkdir(directory);
  const history=[],responses=new Map(),transport=[];let offline=null;
  let published=new Set(),immutablePublished=new Set();
  async function writeStaged(name,body){
    await checkedRoot(directory);
    const parts=relativeParts(name);let parent=directory;
    for(const part of parts.slice(0,-1)){
      parent=path.join(parent,part);
      try{await fs.mkdir(parent);}catch(error){if(error.code!=='EEXIST')throw error;}
      const stat=await fs.lstat(parent);
      if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('PWA staging parent rejected');
    }
    const target=path.join(parent,parts.at(-1));
    try{await checkedPath(directory,name);}catch(error){if(error.code!=='ENOENT')throw error;}
    const temporary=path.join(parent,'.pwa-'+crypto.randomUUID());
    try{await fs.writeFile(temporary,body,{flag:'wx',mode:0o644});await fs.rename(temporary,target);}
    finally{await fs.rm(temporary,{force:true});}
  }
  async function publish(pkg,failMigration=false){
    const {base:from,files}=await packageFiles(pkg,mode),contents=[];
    for(const name of files)contents.push([name,await readRegular(from,name)]);
    const immutable=[];
    if(options.edition==='game' && files.includes('game-release.json')){
      const release=JSON.parse(contents.find(([name])=>name==='game-release.json')[1]);
      if(!/^[a-f0-9]{64}$/.test(release.releaseId)||!Array.isArray(release.files))throw Error('Invalid PWA release manifest');
      const bodies=new Map(contents);
      for(const row of release.files.filter(row=>row.path.startsWith('assets/game/'))){
        const body=bodies.get(row.path);
        if(!row.path.startsWith(`assets/game/${release.releaseId}/`)||!path.basename(row.path).includes(row.sha256)||!body||body.length!==row.bytes||sha(body)!==row.sha256||mimeTypes[path.extname(row.path)]!==row.mime)throw Error('PWA immutable manifest integrity rejected');
        immutable.push(row.path);
      }
    }
    for(const [name,body] of contents)await writeStaged(name,body);
    if(failMigration){
      const source=(await readRegular(directory,'sw.js')).toString('utf8');
      const fault='\nvar originalPut=Cache.prototype.put;Cache.prototype.put=function(request,response){var url=new URL(typeof request === "string" ? request : request.url,self.registration.scope);if(url.pathname.indexOf("/webtoon/")>=0)return Promise.reject(new DOMException("test quota","QuotaExceededError"));return originalPut.call(this,request,response);};\n';
      await writeStaged('sw.js',source+fault);
    }
    const row={from,edition:options.edition,indexSHA:sha(await readRegular(directory,'index.html')),swSHA:sha(await readRegular(directory,'sw.js'))};
    for(const name of immutable)immutablePublished.add(name);
    published=new Set(options.edition==='game'?[...immutablePublished,...files]:files);history.push(row);return row;
  }
  let old;
  try{old=await publish(packages.baseline);}
  catch(error){await fs.rm(directory,{recursive:true,force:true});await fs.writeFile(resourceFile,JSON.stringify({directory,status:'closed',reason:'package publication failed'},null,2));throw error;}
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    res.once('finish',()=>{if(offline && res.statusCode>=200 && res.statusCode<300)offline.successfulOriginResponses++;});
    if(offline){offline.attempts.push({path:url.pathname,method:req.method});req.socket.destroy();return;}
    if(responses.has(url.pathname)){const fixture=responses.get(url.pathname);if(fixture.disconnect){req.socket.destroy();return;}res.writeHead(fixture.status,{'cache-control':'no-store','content-type':fixture.contentType});res.end(fixture.body);return;}
    try{
      const name=decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1);
      if(!published.has(name)){res.writeHead(404).end('not found');return;}
      const body=await readRegular(directory,name),extension=path.extname(name);
      res.writeHead(200,{'cache-control':'no-store','content-type':mimeTypes[extension] || 'application/octet-stream'});res.end(body);
    }catch{res.writeHead(404,{'content-type':'text/plain'}).end('not found');}
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port || 0,'127.0.0.1',resolve);});}
  catch(error){await fs.rm(directory,{recursive:true,force:true});throw error;}
  const port=server.address().port;
  await fs.writeFile(resourceFile,JSON.stringify({directory,pid:process.pid,status:'running',port,provenance},null,2));
  return {url:`http://127.0.0.1:${port}`,old,setTransportOffline(value){if(value){offline={attempts:[],successfulOriginResponses:0};transport.push(offline);}else offline=null;},setResponse:(pathname,fixture)=>fixture?responses.set(pathname,fixture):responses.delete(pathname),publishCurrent:(failMigration=false)=>publish(packages.current,failMigration),async close(){
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await fs.rm(directory,{recursive:true,force:true});
    await fs.writeFile(resourceFile,JSON.stringify({directory,pid:process.pid,status:'closed',port,provenance},null,2));
    const proof=info.outputPath('staging-cleanup.json');
    await fs.writeFile(proof,JSON.stringify({directory,history,serverClosed:true,stagingRemoved:true,port,provenance},null,2));
    await info.attach('staging-cleanup',{path:proof,contentType:'application/json'});
    if(transport.length){
      const file=info.outputPath('transport-offline.json');await fs.writeFile(file,JSON.stringify({mechanism:'origin transport unavailable; request sockets destroyed before HTTP response',deviceOfflineClaim:false,transport},null,2));
      await info.attach('transport-offline',{path:file,contentType:'application/json'});
      if(transport.some(phase=>!phase.attempts.length||phase.successfulOriginResponses!==0))throw Error('Transport outage lacked failed requests or served a response');
    }
  }};
}
