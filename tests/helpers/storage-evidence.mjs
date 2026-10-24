import fs from 'node:fs/promises';
import {root} from './paths.mjs';
import {capture,sha} from './app.mjs';
export function storageEvidence(test){
  const runs=new WeakMap();
  test.beforeEach(async({page})=>{
    const fingerprints={};for(const name of ['src/app_tpl.html','src/pwa_body.txt','sw.js','index.html'])fingerprints[name]=sha(await fs.readFile(`${root}/${name}`));
    const documents=[];runs.set(page,{fingerprints,documents});
    page.on('response',response=>{if(response.request().resourceType()==='document'&&response.ok())documents.push(response.body().then(bytes=>({url:response.url(),sha256:sha(bytes)}),error=>({url:response.url(),error:error.message})));});
  });
  test.afterEach(async({page},info)=>{
    const run=runs.get(page);if(!run)return;const documents=await Promise.all(run.documents),indexSHA256=run.fingerprints['index.html'];
    const current=documents.filter(row=>row.sha256===indexSHA256).at(-1);
    const after={};for(const name of Object.keys(run.fingerprints))after[name]=sha(await fs.readFile(`${root}/${name}`));
    await capture(info,'final-served',{indexSHA256,servedSHA256:current?.sha256||null,documents,inputs:run.fingerprints,after});
    if(JSON.stringify(after)!==JSON.stringify(run.fingerprints))throw Error('Product inputs changed during case');
  });
}
