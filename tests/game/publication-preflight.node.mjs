import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {openPublication} from '../../tools/game-build/publication.mjs';
import {verifyPackage} from '../../tools/game-build/package.mjs';
import {sha} from '../../tools/game-build/io.mjs';
const E=process.env.SGG_PUBLICATION_EVIDENCE;assert.ok(E&&path.isAbsolute(E),'owned evidence directory required');
for(const edited of [true,false])test(edited?'external output edit after validation is preserved':'unchanged output still publishes a complete package',async()=>{
  const work=E+'/work/preflight-'+edited,out=work+'/output',receipt=E+'/preflight-'+edited+'.json';
  await fs.writeFile(receipt,JSON.stringify({status:'planned',work}));await fs.mkdir(work,{recursive:true});await fs.cp(E+'/baseline-site',out,{recursive:true});
  const tx=openPublication(out);let result;
  try{
    await verifyPackage(out);await fs.cp(E+'/current-site',tx.stage,{recursive:true});const {release}=await verifyPackage(tx.stage);
    const sentinel='UNRELATED USER EDIT AFTER OUTPUT VALIDATION';
    if(edited){await fs.writeFile(out+'/index.html',sentinel);await assert.rejects(tx.publish(release),/output changed during build/);assert.equal(await fs.readFile(out+'/index.html','utf8'),sentinel);result={userEditPreserved:true,rejected:true};}
    else{await tx.publish(release);await verifyPackage(out);assert.equal(sha(await fs.readFile(out+'/index.html')),sha(await fs.readFile(E+'/current-site/index.html')));result={packageValid:true,releaseId:release.releaseId};}
  }finally{tx.close();await fs.rm(work,{recursive:true,force:true});}
  await fs.writeFile(receipt,JSON.stringify({status:'PASS',work,removed:await fs.stat(work).then(()=>false,e=>e.code==='ENOENT'),...result},null,2));
});
