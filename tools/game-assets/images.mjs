import fs from 'node:fs/promises';
import {mkdtempSync,writeFileSync,openSync,unlinkSync,rmdirSync,closeSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {requireValue, safePath, sha} from './io.mjs';
export function imageMime(bytes) {
  if(bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  return null;
}
function command(binary,args,input) {
  const directory=mkdtempSync(path.join(os.tmpdir(),'game-image-input-'));
  const file=path.join(directory,'input');
  let fd;
  try {
    writeFileSync(file,input,{flag:'wx',mode:0o600});
    fd=openSync(file,'r');
    // An unlinked regular file avoids the observed macOS synchronous stdin socket stall.
    unlinkSync(file);rmdirSync(directory);
    const result=spawnSync(binary,args,{stdio:[fd,'pipe','pipe'],timeout:15000,killSignal:'SIGKILL',maxBuffer:32*1024*1024,windowsHide:true});
    requireValue(!result.error && result.status===0,'image-decode',`${binary}: ${result.error?.message||result.stderr?.toString().slice(0,250)}; inputSha256=${sha(input)} inputBytes=${input.length} pid=${result.pid} status=${result.status} signal=${result.signal} stdoutBytes=${result.stdout?.length??0} stderrBytes=${result.stderr?.length??0}`);
    return result.stdout;
  } finally {
    if(fd!==undefined)closeSync(fd);
    rmSync(directory,{recursive:true,force:true});
  }
}
export function decodeRaster(bytes) {
  requireValue(imageMime(bytes),'mime','only actual PNG/WebP bytes accepted');
  const meta=JSON.parse(command('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json','-i','pipe:0'],bytes));
  const {width,height}=meta.streams?.[0]||{};
  requireValue(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width*height<=8000000,'image-dimensions','bounded positive raster');
  const rgba=command('ffmpeg',['-v','error','-filter_threads','1','-threads','1','-i','pipe:0','-frames:v','1','-f','rawvideo','-pix_fmt','rgba','-threads','1','pipe:1'],bytes);
  requireValue(rgba.length===width*height*4,'image-decode','incomplete raster');
  return {width,height,rgba};
}
export function decode(bytes) {
  const {width,height,rgba}=decodeRaster(bytes);
  let transparent=0,visible=0,centerTransparent=0,centerTotal=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const alpha=rgba[(y*width+x)*4+3];if(alpha<255)transparent++;if(alpha>0)visible++;
    if(x>=width*.25&&x<width*.75&&y>=height*.25&&y<height*.75){centerTotal++;if(alpha===0)centerTransparent++;}
  }
  return {width,height,transparent,visible,pixels:width*height,centerTransparent,centerTotal};
}
export async function fileBytes(root,relative) {
  const file=await safePath(root,relative),stat=await fs.stat(file);
  requireValue(stat.isFile()&&stat.size>0&&stat.size<=41943040,'file-size',relative);
  return fs.readFile(file);
}
export async function inspectAsset(row,root) {
  const bytes=await fileBytes(root,row.path);
  requireValue(bytes.length===row.bytes,'bytes',row.assetId);
  requireValue(sha(bytes)===row.sha256,'sha256',row.assetId);
  requireValue(imageMime(bytes)===row.mime,'mime',row.assetId);
  const decoded=decode(bytes);
  requireValue(decoded.width===row.dimensions.width&&decoded.height===row.dimensions.height,'dimensions',row.assetId);
  requireValue(decoded.visible>0,'empty-image',row.assetId);
  if(row.alphaRequired)requireValue(decoded.transparent>0,'required-alpha',row.assetId);
  if(row.kind==='frame')requireValue(decoded.centerTransparent===decoded.centerTotal,'frame-center-alpha',row.assetId);
  const master=await fileBytes(root,row.masterPath);
  requireValue(sha(master)===row.masterSha256,'master-sha256',row.assetId);
  requireValue(imageMime(master)==='image/png','master-mime',row.assetId);
  decode(master);
  return {assetId:row.assetId,path:row.path,bytes:bytes.length,sha256:sha(bytes),mime:imageMime(bytes),...decoded};
}
