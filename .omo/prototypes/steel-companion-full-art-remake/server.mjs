import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.SGG_PROTO_PORT||8779);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const url=new URL(req.url,'http://127.0.0.1'),relative=decodeURIComponent(url.pathname).slice(1)||'index.html';
    if(relative.split('/').some(s=>s.startsWith('.')||s==='..')||relative.includes('\\')){res.writeHead(404);res.end();return;}
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
    const real=await fs.realpath(file);
    if(!real.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
    const body=await fs.readFile(real);res.setHeader('Content-Type',mime[path.extname(real)]||'application/octet-stream');res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
  }catch(error){
    if(!(error instanceof Error)) throw error;
    res.writeHead(error.code==='ENOENT'||error.code==='EISDIR'?404:400);res.end('Not available');
  }
}).listen(port,'127.0.0.1',()=>console.log(`Steel Companion prototype http://127.0.0.1:${port}/`));
