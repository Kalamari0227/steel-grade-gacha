import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {root,baselineRoot,educationRoot,educationReviewRoot,appURL,baselineURL,fixedTime} from './helpers/paths.mjs';
import {capture,sha} from './helpers/app.mjs';
import {mappings} from './helpers/assets.mjs';
import {captureFinalResponse} from '../tools/final-evidence.mjs';
import {startStatic} from '../tools/game-qa/server.mjs';
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
function reconcileZeroTransfers(urls,network){
  const entries=urls.map(url=>{
    const responses=network.filter(response=>response.url===url);
    const reconciled=responses.length>0&&responses.every(response=>!response.error&&response.status>=200&&response.status<300&&
      Number.isFinite(response.responseBodySize)&&response.responseBodySize>=0&&Number.isFinite(response.responseHeadersSize)&&response.responseHeadersSize>=0&&
      response.responseBodySize+response.responseHeadersSize>0);
    return {url,responses,reconciled};
  });
  return {entries,unreconciled:entries.filter(entry=>!entry.reconciled).map(entry=>entry.url)};
}
async function run(command,args,cwd,environment={}){
  return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env:{...process.env,...environment}});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('close',(exitCode,signal)=>resolve({command,args,cwd,exitCode,signal,output}));});
}
async function frozenInputs(site){
  const template=await fs.readFile(`${site}/src/app_tpl.html`,'utf8');
  const files=[...new Set(['src/build.sh','src/app_tpl.html','src/pwa_head.txt','src/pwa_body.txt','index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png',...(await mappings({edition:'education',source:site})).map(row=>row.path),...template.match(/webtoon\/[A-Za-z0-9_-]+\.webp/g)])];
  for(const optional of ['docs/design/asset-manifest.json','src/uiimg/workshop.webp']){
    try{await fs.access(`${site}/${optional}`);files.push(optional);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return Object.fromEntries(await Promise.all(files.map(async file=>[file,sha(await fs.readFile(`${site}/${file}`))])));
}
function fixDateOnly(time){
  const NativeDate=Date,nativePerformance=performance,nativeNow=performance.now,nativeEntries=performance.getEntriesByType;
  const nativeTimeout=setTimeout,nativeFrame=requestAnimationFrame,nativeEvents=performance.addEventListener;
  function FixedDate(...args){
    if(new.target)return Reflect.construct(NativeDate,args.length?args:[time],new.target);
    return new NativeDate(time).toString();
  }
  Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.prototype=NativeDate.prototype;FixedDate.now=()=>time;
  window.Date=FixedDate;
  window.__clockPreservation=()=>({performance:performance===nativePerformance,now:performance.now===nativeNow,entries:performance.getEntriesByType===nativeEntries,
    timeout:setTimeout===nativeTimeout,animationFrame:requestAnimationFrame===nativeFrame,events:performance.addEventListener===nativeEvents,
    nativePerformance:performance instanceof Performance,eventTarget:performance instanceof EventTarget,fixedDate:Date.now(),constructedDate:new Date().getTime()});
}
function observeReadiness(){
  performance.setResourceTimingBufferSize(10000);
  window.__timingOverflow=false;
  performance.addEventListener('resourcetimingbufferfull',()=>window.__timingOverflow=true);
  window.__readiness=new Promise(resolve=>{
    let finished=false;
    const finish=value=>{if(!finished){finished=true;clearTimeout(deadline);resolve(value);}};
    const deadline=setTimeout(()=>finish({error:'Browser readiness deadline exceeded',at:performance.now()}),30000);
    const visible=el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return el.getClientRects().length&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&style.visibility!=='hidden';};
    const start=async()=>{
      try{
        while(typeof S==='undefined'||saveHold||!document.querySelector('#btnPull')||document.querySelector('#btnPull').disabled){
          if(finished)return;await new Promise(requestAnimationFrame);
        }
        await document.fonts.ready;
        const images=[...document.images].filter(visible);
        await Promise.all(images.map(image=>image.decode()));
        const ready=performance.now();
        finish({ready,clock:window.__clockPreservation(),images:images.map(image=>({src:image.currentSrc.startsWith('data:')?image.currentSrc.slice(0,image.currentSrc.indexOf(',')+1)+'[embedded]':image.currentSrc,width:image.naturalWidth,height:image.naturalHeight})),
          fonts:{status:document.fonts.status,faces:[...document.fonts].map(face=>({family:face.family,status:face.status}))},
          startup:{route:location.hash,modals:[...document.querySelectorAll('.modal.show,.tview.show,.install.show')].map(el=>el.id),pullInert:!!document.querySelector('#btnPull').closest('[inert]'),focus:document.activeElement.id}});
      }catch(error){finish({error:error.message,at:performance.now()});}
    };
    if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
  });
}

test('@assets-happy final104 mappings47 redraw18 preserved comics and hero budgets',async({},info)=>{
  if(!educationRoot||!educationReviewRoot)throw Error('Education reference checks require SGG_EDUCATION_ROOT and SGG_EDUCATION_REVIEW_ROOT');
  const report=info.outputPath('asset-report.json');
  const command=await run(process.execPath,['tools/verify-assets.mjs','--edition','education','--root',educationRoot,'--baseline-root',baselineRoot,'--review-root',educationReviewRoot,'--group','all','--require-redraw','--check-built','--report',report],root);
  await capture(info,'asset-invocation',command);expect(command.exitCode).toBe(0);
  const checked=JSON.parse(await fs.readFile(report,'utf8'));expect(checked.pass).toBe(true);expect(checked.errors).toEqual([]);
  expect(checked.counts.mappings).toBe(104);expect(checked.counts.cards).toBe(47);expect(checked.counts.comics).toBe(18);
  expect(checked.assets.filter(row=>row.path==='src/uiimg/workshop.webp')).toHaveLength(1);
  const baseline=await fs.readFile(`${baselineRoot}/index.html`),current=await fs.readFile(`${educationRoot}/index.html`),hero=await fs.readFile(`${educationRoot}/src/uiimg/workshop.webp`);
  expect(baseline.length).toBe(7989588);expect(current.length).toBeLessThanOrEqual(Math.floor(baseline.length*1.1));expect(hero.length).toBeLessThanOrEqual(240*1024);
  await capture(info,'bundle-budget',{baseline:{bytes:baseline.length,sha:sha(baseline)},current:{bytes:current.length,sha:sha(current)},hero:{bytes:hero.length,sha:sha(hero)},limit:Math.floor(baseline.length*1.1)});
});

test('@assets-negative isolated missing empty corrupt and alternate binding reject with original untouched',async({},info)=>{
  if(!educationRoot||!educationReviewRoot)throw Error('Education reference checks require SGG_EDUCATION_ROOT and SGG_EDUCATION_REVIEW_ROOT');
  test.setTimeout(180000);const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sgg-task21-'));
  const liveTemplate=await fs.readFile(`${educationRoot}/src/app_tpl.html`,'utf8');
  const protectedPaths=[...new Set(['src/build.sh','src/app_tpl.html','src/pwa_head.txt','src/pwa_body.txt','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','index.html','docs/design/asset-manifest.json','src/uiimg/workshop.webp',...(await mappings({edition:'education',source:educationRoot})).map(row=>row.path),...liveTemplate.match(/webtoon\/[A-Za-z0-9_-]+\.webp/g)])];
  const before=Object.fromEntries(await Promise.all(protectedPaths.map(async p=>[p,sha(await fs.readFile(`${educationRoot}/${p}`))]))),receipts=[];
  try{
    for(const name of ['src','webtoon','docs/design'])await fs.cp(`${educationRoot}/${name}`,`${temp}/${name}`,{recursive:true});
    for(const name of ['index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','sw.js'])await fs.copyFile(`${educationRoot}/${name}`,`${temp}/${name}`);
    const editable=await run('chmod',['-R','u+w',temp],root);expect(editable.exitCode).toBe(0);
    const template=await fs.readFile(`${temp}/src/app_tpl.html`,'utf8'),comic=template.match(/webtoon\/[A-Za-z0-9_-]+\.webp/)[0];
    const bin=path.join(temp,'encoding-bin');await fs.mkdir(bin);
    const cases=[['missing-card','src/img/poo.jpg','missing'],['missing-part','src/partimg/roof.png','missing'],['missing-comic',comic,'missing'],['empty-jpeg','src/img/poo.jpg','empty'],['missing-hero','src/uiimg/workshop.webp','missing'],['encoding-failure','src/img/poo.jpg','encoding'],['empty-encoding','src/img/poo.jpg','encoding-empty'],['corrupt-jpeg','src/img/poo.jpg','corrupt'],['alt-swap','src/app_tpl.html','alt']];
    for(const [name,file,mutation] of cases){
      const original=await fs.readFile(`${temp}/${file}`),oldIndex=sha(await fs.readFile(`${temp}/index.html`));
      if(mutation==='missing')await fs.unlink(`${temp}/${file}`);
      else if(mutation==='empty')await fs.writeFile(`${temp}/${file}`,'');
      else if(mutation==='corrupt')await fs.writeFile(`${temp}/${file}`,Buffer.from([255,216,0,1,2,3]));
      else if(mutation==='alt'){expect(template).toContain('__H2__');expect(template).toContain('__H4__');await fs.writeFile(`${temp}/${file}`,template.replaceAll('__H2__','__ALT_SWAP__').replaceAll('__H4__','__H2__').replaceAll('__ALT_SWAP__','__H4__'));}
      else await fs.writeFile(path.join(bin,'base64'),`#!/bin/sh\nexit ${mutation==='encoding'?73:0}\n`,{mode:0o700});
      const verifier=['corrupt','alt'].includes(mutation);
      const report=info.outputPath(`${name}.json`);
      const result=verifier?await run(process.execPath,['tools/verify-assets.mjs','--edition','education','--root',temp,'--baseline-root',baselineRoot,'--review-root',educationReviewRoot,'--group','all','--require-redraw','--check-built','--report',report],root):await run('bash',['src/build.sh'],temp,mutation.startsWith('encoding')?{PATH:`${bin}${path.delimiter}${process.env.PATH}`} : {});
      receipts.push({name,file,mutation,layer:verifier?'VERIFIER':'BUILD',...result,report:verifier?report:null});await capture(info,'negative-builds',receipts);
      expect(result.exitCode).not.toBe(0);expect(result.signal).toBe(null);expect(result.output.length).toBeGreaterThan(0);
      if(verifier){const failure=JSON.parse(await fs.readFile(report,'utf8'));expect(failure.pass).toBe(false);expect(failure.errors.some(row=>mutation==='alt'?/ID\/side to placeholder mapping changed/.test(row.error):row.path===file&&/decode|dimensions/i.test(row.error))).toBe(true);}
      else expect(result.output).toMatch(mutation==='encoding'?/그림 인코딩 실패/:mutation==='encoding-empty'?/빈 그림 인코딩/:name==='missing-comic'?/웹툰 그림이 없다/:name==='missing-hero'?/공방 그림이 없거나 비었습니다/:/필수 그림이 없거나 비었습니다/);
      expect(sha(await fs.readFile(`${temp}/index.html`))).toBe(oldIndex);expect((await fs.readdir(temp)).filter(n=>n.startsWith('.sgg-build.'))).toEqual([]);
      await fs.writeFile(`${temp}/${file}`,original);
    }
  }finally{
    await fs.rm(temp,{recursive:true,force:true});const after=Object.fromEntries(await Promise.all(protectedPaths.map(async p=>[p,sha(await fs.readFile(`${educationRoot}/${p}`))])));
    await capture(info,'negative-cleanup',{temp,removed:await fs.stat(temp).then(()=>false,()=>true),before,after});expect(after).toEqual(before);
  }
});

test('@performance-api native timing Date-only clock and actual resource-buffer overflow',async({browser},info)=>{
  const control=await browser.newContext(),native=await browser.newContext({serviceWorkers:'block'});
  try{
    const mocked=await control.newPage();await mocked.clock.setFixedTime(new Date(fixedTime));
    const shim=await mocked.evaluate(()=>({eventMethod:typeof performance.addEventListener,native:performance instanceof Performance,entries:performance.getEntriesByType('navigation').length}));
    const page=await native.newPage();await page.addInitScript(fixDateOnly,new Date(fixedTime).getTime());const documentResponse=await page.goto(appURL,{waitUntil:'load'});
    const result=await page.evaluate(async()=>{
      const before=performance.now();
      const navigation=performance.getEntriesByType('navigation').map(e=>({name:e.name,transferSize:e.transferSize}));
      performance.clearResourceTimings();performance.setResourceTimingBufferSize(1);
      const overflow=new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error('Native resource buffer did not report overflow')),5000);
        performance.addEventListener('resourcetimingbufferfull',()=>{clearTimeout(timeout);resolve(true);},{once:true});
      });
      await Promise.all([1,2,3].map(i=>fetch('/icon-192.png?timing-api='+i,{cache:'no-store'}).then(r=>r.arrayBuffer())));
      const overflowed=await overflow,after=performance.now();
      return {clock:window.__clockPreservation(),before,after,navigation,overflow:overflowed};
    });
    await capture(info,'native-timing-api',{shim,result});
    for(const [key,value] of Object.entries(result.clock))expect(value,key).toBe(key==='fixedDate'||key==='constructedDate'?new Date(fixedTime).getTime():true);
    expect(result.after).toBeGreaterThan(result.before);expect(result.navigation).toHaveLength(1);expect(result.navigation[0].transferSize).toBeGreaterThan(0);expect(result.overflow).toBe(true);
    await captureFinalResponse(info,documentResponse,{root});
  }finally{await control.close();await native.close();}
});

test('@performance three cold runs per version initial transfer and visible readiness median',async({browser},info)=>{
  if(!educationRoot)throw Error('Education performance reference requires SGG_EDUCATION_ROOT');
  info.annotations.push({type:'education-reference',description:'Original versus preserved education-v1 timing; current game budgets are covered by game/performance.spec.mjs'});
  test.setTimeout(180000);const runs=[],before={baseline:await frozenInputs(baselineRoot),current:await frozenInputs(educationRoot)};let finalDocument,referenceSite;
  await capture(info,'education-reference-source',{source:educationRoot,indexSHA256:before.current['index.html'],currentGameCoverage:'tests/game/performance.spec.mjs'});
  await capture(info,'frozen-inputs-before',before);
  try{
  referenceSite=await startStatic(educationRoot);
  await capture(info,'education-reference-server',{source:educationRoot,url:referenceSite.url,port:referenceSite.port,status:'running'});
  for(let round=0;round<3;round++)for(const variant of (round%2?['current','baseline']:['baseline','current'])){
    const url=variant==='current'?referenceSite.url:baselineURL;
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    try{
      const page=await context.newPage(),failures=[],httpErrors=[],pageErrors=[],requested=new Set(),completed=new Set(),sizeJobs=[];
      page.on('request',request=>{if(/^https?:/.test(request.url()))requested.add(request);});
      page.on('requestfinished',request=>{
        if(!/^https?:/.test(request.url()))return;
        completed.add(request);
        sizeJobs.push((async()=>({url:request.url(),type:request.resourceType(),status:(await request.response())?.status(),...await request.sizes()}))()
          .catch(error=>({url:request.url(),error:error.message})));
      });
      page.on('requestfailed',request=>failures.push({url:request.url(),failure:request.failure()}));
      page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
      page.on('pageerror',error=>pageErrors.push(error.message));
      await page.addInitScript(fixDateOnly,new Date(fixedTime).getTime());await page.addInitScript(()=>{Math.random=()=>0;localStorage.clear();sessionStorage.clear();});
      await page.addInitScript(observeReadiness);
      const response=await page.goto(url,{waitUntil:'load'});
      const readiness=await page.evaluate(()=>window.__readiness);
      const documentBytes=await response.body(),servedSHA=sha(documentBytes);
      if(variant==='current')finalDocument={bytes:documentBytes,url:response.url(),status:response.status()};
      await capture(info,`readiness-${round}-${variant}`,{readiness,servedSHA,failures,httpErrors,pageErrors});
      expect(servedSHA).toBe(before[variant]['index.html']);expect(readiness.error).toBeUndefined();
      for(const [key,value] of Object.entries(readiness.clock))expect(value,key).toBe(key==='fixedDate'||key==='constructedDate'?new Date(fixedTime).getTime():true);
      const ready=readiness.ready;await page.waitForLoadState('networkidle');
      const measured=await page.evaluate(()=>{const entries=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].filter(e=>/^https?:/.test(e.name));return {entries:entries.map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration})),unmeasurable:entries.filter(e=>!e.name.startsWith(location.origin)&&!e.transferSize).map(e=>e.name),transfer:entries.reduce((sum,e)=>sum+e.transferSize,0)};});
      const timingOverflow=await page.evaluate(()=>window.__timingOverflow);
      const network=await Promise.all(sizeJobs),timingURLs=new Set(measured.entries.map(e=>e.name)),networkURLs=new Set(network.map(r=>r.url));
      const missingFromResourceTiming=network.filter(r=>!timingURLs.has(r.url)).map(r=>r.url);
      const transfer=network.reduce((sum,r)=>sum+r.responseBodySize+r.responseHeadersSize,0);
      const zeroTransferReconciliation=reconcileZeroTransfers(measured.entries.filter(entry=>entry.transferSize===0).map(entry=>entry.name),network);
      runs.push({round,variant,ready,readiness,servedSHA,failures,httpErrors,pageErrors,timingOverflow,...measured,resourceTimingTransfer:measured.transfer,transfer,network,missingFromResourceTiming,zeroTransferReconciliation,requested:requested.size,completed:completed.size});await capture(info,'timing-runs',runs);
      expect(completed.size).toBe(requested.size);expect(network).toHaveLength(requested.size);
      for(const response of network){
        expect(response.error).toBeUndefined();
        expect(Number.isFinite(response.responseBodySize)&&response.responseBodySize>=0).toBe(true);
        expect(Number.isFinite(response.responseHeadersSize)&&response.responseHeadersSize>=0).toBe(true);
        expect(response.responseBodySize+response.responseHeadersSize).toBeGreaterThan(0);
      }
      expect(measured.entries.filter(e=>!networkURLs.has(e.name))).toEqual([]);
      expect(zeroTransferReconciliation.unreconciled).toEqual([]);expect(timingOverflow).toBe(false);
      expect(failures).toEqual([]);expect(httpErrors).toEqual([]);expect(pageErrors).toEqual([]);
      expect(readiness.fonts.faces.filter(face=>face.status==='error')).toEqual([]);
      expect(transfer).toBeGreaterThan(0);
    }finally{await context.close();}
  }
  expect(runs).toHaveLength(6);for(const variant of ['baseline','current'])expect(runs.filter(row=>row.variant===variant)).toHaveLength(3);
  const metrics=Object.fromEntries(['baseline','current'].map(key=>[key,{ready:median(runs.filter(r=>r.variant===key).map(r=>r.ready)),transfer:median(runs.filter(r=>r.variant===key).map(r=>r.transfer))}]));
  await capture(info,'timing-median',{conditions:'same browser/machine390x844, alternating six fresh contexts, SW blocked, empty storage/context cache; Date-only wall clock fixed, native performance/timers/events preserved and checked; browser load observer records monotonic timestamp when DOM/saveHold/enabled btnPull/fonts/visible image decode complete independently of later host response hashing; startup dialogs/font faces/request failures recorded; every HTTP requestfinished response encoded body plus response header bytes via Request.sizes after network idle; ResourceTiming retained for diagnostic comparison and overflow protection, omitted font URLs explicitly reconciled; every zeroed ResourceTiming entry is retained and reconciled to successful same-URL Request.sizes responses with finite nonnegative sizes and positive totals; browser-process DNS/connection/OS caches not reset',runs,metrics});
  expect(metrics.current.transfer).toBeLessThanOrEqual(metrics.baseline.transfer*1.1+240*1024);expect(metrics.current.ready).toBeLessThan(metrics.baseline.ready*1.25);
  if(!finalDocument)throw Error('Missing measured current document');
  await captureFinalResponse(info,{ok:()=>finalDocument.status>=200&&finalDocument.status<300,url:()=>finalDocument.url,status:()=>finalDocument.status,body:async()=>finalDocument.bytes},{root,kind:'education-reference'});
  }finally{
    if(referenceSite){await referenceSite.close();await capture(info,'education-reference-server-closed',{source:educationRoot,url:referenceSite.url,port:referenceSite.port,status:'closed'});}
    const after={baseline:await frozenInputs(baselineRoot),current:await frozenInputs(educationRoot)};
    await capture(info,'frozen-inputs-after',{before,after});expect(after).toEqual(before);
  }
});
