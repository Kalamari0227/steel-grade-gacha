import fs from 'node:fs';
import {check,read,sha,json,within,pointer,encode} from './paths.mjs';
export function resolveBundledSource(root,receiptPath,jsonPointer){
  const manifest=json(read(within(root,'source-materials/source-manifest.json')));
  const mapRow=manifest.files.find(row=>row.path==='source-materials/provenance-map.json');
  check(mapRow,'missing provenance map manifest binding');
  const bytes=read(within(root,mapRow.path));check(sha(bytes)===mapRow.sha256,'hash-mismatch: provenance map');
  const map=json(bytes),rows=map.entries.filter(row=>row.receiptPath===receiptPath&&row.jsonPointer===jsonPointer);
  check(rows.length===1,'missing or duplicate source mapping: '+receiptPath+jsonPointer);
  const row=rows[0],receipt=read(within(root,receiptPath));
  const receiptRow=manifest.files.find(r=>r.path===receiptPath);check(receiptRow&&sha(receipt)===receiptRow.sha256,'receipt hash-mismatch');
  check(pointer(json(receipt),jsonPointer)===row.original,'source pointer changed');
  const bound=manifest.files.find(r=>r.path===row.archivedPath);check(bound&&bound.sha256===row.sha256,'unbound source mapping');
  const body=read(within(root,row.archivedPath));check(sha(body)===row.sha256,'hash-mismatch: '+row.archivedPath);
  return {receiptPath,jsonPointer,path:row.archivedPath,sha256:row.sha256,bytes:body.length,role:row.role,sourceClass:row.sourceClass};
}
export function verifyRestored(root){
  const manifest=json(read(within(root,'source-materials/source-manifest.json')));check(manifest.version===1&&manifest.files.length>0,'invalid source manifest');
  check(manifest.inputDigest===sha(encode(manifest.files)),'input digest mismatch');
  const expected=new Set(['source-materials/source-manifest.json']);let bytes=0;
  for(const row of manifest.files){check(!expected.has(row.path),'duplicate payload');expected.add(row.path);const body=read(within(root,row.path));check(body.length===row.bytes&&sha(body)===row.sha256,'hash-mismatch: '+row.path);bytes+=body.length;}
  function visit(dir=''){for(const entry of fs.readdirSync(dir?within(root,dir):root,{withFileTypes:true})){const name=(dir?dir+'/':'')+entry.name;check(!entry.isSymbolicLink(),'restored symlink');if(entry.isDirectory())visit(name);else check(entry.isFile()&&expected.has(name),'unexpected payload: '+name);}}
  visit();const map=json(read(within(root,'source-materials/provenance-map.json')));
  check(Array.isArray(manifest.requiredMappings)&&Array.isArray(map.entries),'invalid source mappings');
  const key=row=>JSON.stringify([row.receiptPath,row.jsonPointer]),required=manifest.requiredMappings.map(key),mapped=map.entries.map(key);
  check(new Set(required).size===required.length&&new Set(mapped).size===mapped.length,'duplicate source mapping requirement');
  check(JSON.stringify(required.sort())===JSON.stringify(mapped.sort()),'incomplete source mappings');
  const resolved=manifest.requiredMappings.map(row=>resolveBundledSource(root,row.receiptPath,row.jsonPointer));
  return {status:'PASS',files:manifest.files.length,bytes,resolved,declaredCounts:manifest.counts,inputDigest:manifest.inputDigest,inputDigestVerified:true};
}
