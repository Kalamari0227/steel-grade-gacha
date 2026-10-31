import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
export const mimeTypes={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.css':'text/css','.mp4':'video/mp4','.webm':'video/webm','.md':'text/markdown','.gz':'application/gzip'};
export async function startStatic(directory,preferredPort=0) {
  if([4173,4273,4274].includes(preferredPort))throw Error('Protected port');
  const root=await fs.realpath(directory);
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
      const real=await fs.realpath(file);
      if(!real.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const body=await fs.readFile(real);
      const headers={'cache-control':'no-store','content-type':mimeTypes[path.extname(real)] || 'application/octet-stream','content-length':body.length,'accept-ranges':'bytes'};
      const range=req.headers.range;
      // Ignore malformed, oversized and multipart ranges; serve a single byte range for GET.
      const match=req.method==='GET' && typeof range==='string' && range.length<=128 && /^bytes=(\d*)-(\d*)$/.exec(range);
      if(match && (match[1] || match[2])) {
        const length=BigInt(body.length);
        const start=match[1]?BigInt(match[1]):(BigInt(match[2])>=length?0n:length-BigInt(match[2]));
        const requestedEnd=match[1] && match[2]?BigInt(match[2]):length-1n;
        const end=requestedEnd<length?requestedEnd:length-1n;
        if(start>=length || end<start || (!match[1] && BigInt(match[2])===0n)) {
          res.writeHead(416,{...headers,'content-length':0,'content-range':`bytes */${body.length}`}).end();return;
        }
        const chunk=body.subarray(Number(start),Number(end)+1);
        res.writeHead(206,{...headers,'content-length':chunk.length,'content-range':`bytes ${start}-${end}/${body.length}`}).end(chunk);return;
      }
      res.writeHead(200,headers).end(req.method==='HEAD'?undefined:body);
    } catch(error) {res.writeHead(error.code==='ENOENT'?404:400).end('unavailable');}
  });
  const listen=port=>new Promise((resolve,reject)=>{
    const fail=error=>{server.off('listening',ready);reject(error);};
    const ready=()=>{server.off('error',fail);resolve();};
    server.once('error',fail);server.once('listening',ready);server.listen(port,'127.0.0.1');
  });
  try{await listen(preferredPort);}catch(error){if(error.code!=='EADDRINUSE')throw error;await listen(0);}
  const port=server.address().port;
  if([4173,4273,4274].includes(port)){await new Promise(resolve=>server.close(resolve));throw Error('Protected port allocated');}
  return {port,url:`http://127.0.0.1:${port}`,async close(){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
