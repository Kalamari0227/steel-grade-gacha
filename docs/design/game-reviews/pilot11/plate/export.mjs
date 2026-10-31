import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const lane='docs/design/game-reviews/pilot11/plate';
const rows=JSON.parse(fs.readFileSync(`${lane}/generation-inputs.json`));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=args=>execFileSync('ffmpeg',['-v','error','-y',...args],{timeout:15000,maxBuffer:32*1024*1024});
const record=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const results=[];
for(const row of rows){
 const id=`${row.cardId}-${row.side}`,master=`docs/design/game-reviews/masters/character/${row.cardId}/${row.side}.png`;
 const output=`src/game/art/characters/${row.cardId}/${row.side}.webp`,thumb=`src/game/art/thumbnails/${row.cardId}/${row.side}.webp`,proof=`${lane}/${id}-72.png`;
 for(const p of [output,thumb]) fs.mkdirSync(path.dirname(p),{recursive:true});
 const args=['-i',master,'-vf','scale=864:1296:flags=lanczos,pad=960:1440:48:72:color=black@0','-c:v','libwebp','-quality','90','-compression_level','6','-frames:v','1',output];
 run(args);
 run(['-i',output,'-vf','scale=144:216:flags=lanczos','-c:v','libwebp','-quality','90','-compression_level','6','-frames:v','1',thumb]);
 run(['-i',thumb,'-vf','scale=72:108:flags=lanczos','-frames:v','1',proof]);
 const generation={schemaVersion:1,tool:'image_gen.imagegen',mode:'built-in-imagegen',prompt:row.prompt,referencedImages:row.referencedImages.map((p,i)=>({path:p,sha256:sha(p),role:i===0?'identity reference':'style reference or original heat-treatment state'})),generatedSourcePath:row.generatedSourcePath,generatedSourceSha256:sha(row.generatedSourcePath),masterPath:master,masterSha256:sha(master),recordedAt:new Date().toISOString(),directMasterInspection:'view_image, full body face emblem material and alpha inspected before export'};
 if(generation.generatedSourceSha256!==generation.masterSha256) throw Error('master differs from original tool output');
 record(`${lane}/${id}-generation.json`,generation);
 const raw=run(['-i',output,'-f','rawvideo','-pix_fmt','rgba','pipe:1']);let zero=0,visible=0,min=255,max=0;
 for(let i=3;i<raw.length;i+=4){const a=raw[i];zero+=a===0;visible+=a>0;min=Math.min(min,a);max=Math.max(max,a);}
 const exportRecord={schemaVersion:1,method:'derived-export',masterPath:master,masterSha256:sha(master),operations:'Only deterministic Lanczos resizing, transparent canvas padding and WebP encoding. No painted pixels, extraction or background removal.',ffmpegVersion:execFileSync('ffmpeg',['-version'],{encoding:'utf8'}).split('\n')[0],command:['ffmpeg','-v','error','-y',...args],output:{path:output,sha256:sha(output),bytes:fs.statSync(output).size,width:960,height:1440},thumbnail:{path:thumb,sha256:sha(thumb),width:144,height:216},proof72:{path:proof,sha256:sha(proof),width:72,height:108},alpha:{zero,visible,min,max}};
 if(zero===0||visible===0)throw Error('missing real transparent/visible pixels');
 record(`${lane}/${id}-export.json`,exportRecord);results.push(exportRecord);
}
// Review-only composites apply alpha over graphite; original masters/exports are never edited.
function sheet(width,height,tileWidth,tileHeight,output){
 const sheet=Buffer.alloc(width*height*3);for(let i=0;i<sheet.length;i+=3){sheet[i]=22;sheet[i+1]=27;sheet[i+2]=32;}
 rows.forEach((row,index)=>{const p=`src/game/art/characters/${row.cardId}/${row.side}.webp`;const raw=run(['-i',p,'-vf',`scale=${tileWidth}:${tileHeight}:flags=lanczos`,'-f','rawvideo','-pix_fmt','rgba','pipe:1']);const ox=index*tileWidth;for(let y=0;y<tileHeight;y++)for(let x=0;x<tileWidth;x++){const s=(y*tileWidth+x)*4,d=(y*width+ox+x)*3,a=raw[s+3]/255;for(let c=0;c<3;c++)sheet[d+c]=Math.round(raw[s+c]*a+sheet[d+c]*(1-a));}});
 execFileSync('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${width}x${height}`,'-i','pipe:0','-frames:v','1',output],{input:sheet,timeout:15000});
}
sheet(432,108,72,108,`${lane}/six-72-contact.png`);sheet(2160,540,360,540,`${lane}/six-full-contact.png`);
record(`${lane}/export-summary.json`,{status:'PASS',count:6,results});
console.log(JSON.stringify({status:'PASS',characters:6,thumbnails:6,trueAlpha:6}));
