import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {root,baselineRoot} from './paths.mjs';
const files=['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','webtoon','src/uiimg'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function startPwaSite(info){
  if(!process.env.TMPDIR) throw Error('Task-specific TMPDIR required');
  const directory=await fs.mkdtemp(path.join(process.env.TMPDIR,'sgg-upgrade-'));
  const history=[],responses=new Map(),transport=[];let offline=null;
  async function writable(target){
    const stat=await fs.stat(target);await fs.chmod(target,stat.isDirectory()?0o755:0o644);
    if(stat.isDirectory())for(const name of await fs.readdir(target))await writable(path.join(target,name));
  }
  async function publish(from,failMigration=false){
    for(const name of files){
      try{await fs.access(path.join(from,name));}catch{continue;}
      await fs.mkdir(path.dirname(path.join(directory,name)),{recursive:true});
      await fs.cp(path.join(from,name),path.join(directory,name),{recursive:true,force:true});
      await writable(path.join(directory,name));
    }
    if(failMigration){
      const worker=path.join(directory,'sw.js');
      const source=await fs.readFile(worker,'utf8');
      const fault='\nvar originalPut=Cache.prototype.put;Cache.prototype.put=function(request,response){var url=new URL(typeof request === "string" ? request : request.url,self.registration.scope);if(url.pathname.indexOf("/webtoon/")>=0)return Promise.reject(new DOMException("test quota","QuotaExceededError"));return originalPut.call(this,request,response);};\n';
      await fs.writeFile(worker,source+fault);
    }
    const row={from,indexSHA:sha(await fs.readFile(path.join(directory,'index.html'))),swSHA:sha(await fs.readFile(path.join(directory,'sw.js')))};
    history.push(row);return row;
  }
  const old=await publish(baselineRoot);
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1:4280');
    res.once('finish',()=>{if(offline && res.statusCode>=200 && res.statusCode<300)offline.successfulOriginResponses++;});
    if(offline){offline.attempts.push({path:url.pathname,method:req.method});req.socket.destroy();return;}
    if(responses.has(url.pathname)){const fixture=responses.get(url.pathname);res.writeHead(fixture.status,{'cache-control':'no-store','content-type':fixture.contentType});res.end(fixture.body);return;}
    const target=path.resolve(directory,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if(!target.startsWith(directory+path.sep)){res.writeHead(403).end();return;}
    try{
      const body=await fs.readFile(target),extension=path.extname(target);
      res.writeHead(200,{'cache-control':'no-store','content-type':({'.js':'text/javascript','.html':'text/html','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'})[extension] || 'application/octet-stream'});res.end(body);
    }catch{res.writeHead(404,{'content-type':'text/plain'}).end('not found');}
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4280,'127.0.0.1',resolve);});}
  catch(error){await fs.rm(directory,{recursive:true,force:true});throw error;}
  return {url:'http://127.0.0.1:4280',old,setTransportOffline(value){if(value){offline={attempts:[],successfulOriginResponses:0};transport.push(offline);}else offline=null;},setResponse:(pathname,fixture)=>fixture?responses.set(pathname,fixture):responses.delete(pathname),publishCurrent:(failMigration=false)=>publish(root,failMigration),async close(){
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await fs.rm(directory,{recursive:true,force:true});
    const proof=info.outputPath('staging-cleanup.json');
    await fs.writeFile(proof,JSON.stringify({directory,history,serverClosed:true,stagingRemoved:true,port:4280},null,2));
    await info.attach('staging-cleanup',{path:proof,contentType:'application/json'});
    if(transport.length){
      const file=info.outputPath('transport-offline.json');await fs.writeFile(file,JSON.stringify({mechanism:'origin transport unavailable; request sockets destroyed before HTTP response',deviceOfflineClaim:false,transport},null,2));
      await info.attach('transport-offline',{path:file,contentType:'application/json'});
      if(transport.some(phase=>!phase.attempts.length||phase.successfulOriginResponses!==0))throw Error('Transport outage lacked failed requests or served a response');
    }
  }};
}
