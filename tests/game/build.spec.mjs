import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture} from './build-fixture.mjs';
import {buildGame} from '../../tools/game-build/build.mjs';
import {packageGame,verifyPackage,packageFiles} from '../../tools/game-build/package.mjs';
import {sha,canonical,read} from '../../tools/game-build/io.mjs';
import {startStatic} from '../../tools/game-qa/server.mjs';
import {catalog} from '../helpers/app.mjs';
import {normalizeCatalog} from './namespaces.mjs';
const root=path.resolve(import.meta.dirname,'../..'),evidence=process.env.SGG_EVIDENCE_DIR;
test.describe.configure({mode:'serial'});
let temp,input,output,initial;
const record=async(name,data)=>fs.writeFile(path.join(evidence,name+'.json'),JSON.stringify(data,null,2));
const build=()=>buildGame({root:input,out:output,syntheticFixture:true});
const snapshot=async()=>({index:sha(await read(output,'index.html')),release:sha(await read(output,'game-release.json'))});
test.beforeAll(async()=>{
  test.setTimeout(120000);
  temp=path.join(process.env.TMPDIR,'game-build');input=path.join(temp,'input');output=path.join(temp,'output');
  await record('build-resources',{status:'planned',temp,input,output,ports:[],profiles:'Playwright owned browser context',retainedSyntheticFixture:path.join(evidence,'fixture-source')});
  await fixture(root,input);initial=await build();await record('build-initial',initial);
});
test.afterAll(async()=>{await fs.cp(input,path.join(evidence,'fixture-source'),{recursive:true});await fs.rm(temp,{recursive:true,force:true});await record('build-cleanup',{removed:temp,absent:await fs.stat(temp).then(()=>false,e=>e.code==='ENOENT')});});
test('deterministic release, portable package and complete economic catalog survive image failure',async({browser},info)=>{
  test.setTimeout(60000);
  const before=await snapshot(),rebuilt=await build();expect(rebuilt).toEqual(initial);expect(await snapshot()).toEqual(before);
  const packageDir=path.join(evidence,'happy','site');await fs.mkdir(path.dirname(packageDir),{recursive:true});
  const result=await packageGame(output,packageDir);expect(result.releaseId).toBe(initial.releaseId);
  const {release}=await verifyPackage(packageDir);expect(release.files.filter(r=>r.path.startsWith('webtoon/'))).toHaveLength(18);
  expect(release.files.filter(r=>r.path.includes('/audio-'))).toHaveLength(32);
  await record('package-server-resources',{status:'planned',directory:packageDir,port:0});
  const server=await startStatic(packageDir),context=await browser.newContext({serviceWorkers:'block'});
  await record('package-server-resources',{status:'running',directory:packageDir,port:server.port});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(server.url);expect(sha(await response.body())).toBe(before.index);
    await expect.poll(()=>page.evaluate(()=>!!window.fixturePresentationBridge)).toBe(true);
    expect(await page.getAttribute('body','data-game-release')).toBe(initial.releaseId);
    const bridge=await page.evaluate(()=>({same:fixtureAudioBridge===fixturePresentationBridge,frozen:Object.isFrozen(fixtureAudioBridge),sameState:fixtureAudioBridge.getState()===S,pool:POOL.length,ids:Object.keys(IMG).length,fit:allChars().flatMap(c=>ITEMS.filter(i=>i.fit(c))).length,css:getComputedStyle(document.body).getPropertyValue('--fixture-style-applied')}));
    expect(bridge).toEqual({same:true,frozen:true,sameState:true,pool:44,ids:45,fit:103,css:'1'});
    const current=await page.evaluate(catalog),baseline=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/catalog.json'),'utf8'));
    expect(normalizeCatalog(JSON.parse(JSON.stringify(current)),'game')).toEqual(normalizeCatalog(baseline,'education'));
    const originalPage=await context.newPage();await originalPage.goto('http://127.0.0.1:'+process.env.SGG_BASELINE_PORT);
    const drawSequence=async target=>{
      await target.clock.setFixedTime(new Date('2026-10-26T00:00:00+09:00'));
      return target.evaluate(()=>{let seed=20261025;const prior=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);try{return Array.from({length:1000},()=>weightedPick());}finally{Math.random=prior;}});
    };
    const originalDraws=await drawSequence(originalPage),gameDraws=await drawSequence(page);expect(gameDraws).toEqual(originalDraws);expect(gameDraws).not.toContain('qp-1470');
    await record('seeded-draw-sequence',{seed:20261025,count:1000,original:originalDraws,game:gameDraws,same:true});await originalPage.close();
    const images=await page.evaluate(async()=>{const result=[];for(const [id,row] of Object.entries(GAME_CONFIG.assets)){const image=new Image();image.src=row.url;await image.decode();result.push({id,url:row.url,width:image.naturalWidth,height:image.naturalHeight});image.src='';}return result;});
    const artManifest=JSON.parse(await fs.readFile(path.join(input,'docs/design/game-asset-manifest.json'),'utf8'));
    const expectedIds=[...artManifest.assets,...artManifest.optionalDerived].map(row=>row.assetId).sort();
    expect(new Set(images.map(row=>row.id)).size).toBe(images.length);expect(images.map(row=>row.id).sort()).toEqual(expectedIds);expect(images.every(i=>i.width>0&&i.height>0)).toBe(true);
    await page.route('**/assets/game/**',route=>route.abort());await page.reload();
    expect(await page.evaluate(()=>({pool:POOL.length,ids:Object.keys(IMG).length}))).toEqual({pool:44,ids:45});
    expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('package.png')});
    await record('happy-runtime',{url:server.url,releaseId:initial.releaseId,indexSHA:before.index,bridge,images,catalog:current,syntheticFixture:true,errors});
  }finally{await context.close();await server.close();await record('package-server-resources',{status:'closed',directory:packageDir,port:server.port});}
});
test('missing corrupt wrong MIME swapped alt incomplete audio and encoder failures preserve old output',async()=>{
  const before=await snapshot(),manifestFile=path.join(input,'docs/design/game-asset-manifest.json'),originalManifest=await fs.readFile(manifestFile),manifest=JSON.parse(originalManifest);
  const art=manifest.assets[0],artFile=path.join(input,art.path),originalArt=await fs.readFile(artFile),audioFile=path.join(input,'src/audio/manifest.json'),originalAudio=await fs.readFile(audioFile),results=[];
  const reject=async(name,change,restore)=>{try{await change();let error;try{await build();}catch(e){error=e.message;}expect(error,name).toBeTruthy();expect(await snapshot()).toEqual(before);results.push({name,error,before,after:await snapshot(),pass:true});}finally{await restore();}};
  await reject('missing',()=>fs.unlink(artFile),()=>fs.writeFile(artFile,originalArt));
  await reject('corrupt',()=>fs.writeFile(artFile,'broken'),()=>fs.writeFile(artFile,originalArt));
  await reject('wrong MIME',async()=>{const bytes=await fs.readFile(path.join(input,manifest.assets.find(r=>r.mime==='image/png').path));const m=structuredClone(manifest);m.assets[0].sha256=sha(bytes);m.assets[0].bytes=bytes.length;await fs.writeFile(artFile,bytes);await fs.writeFile(manifestFile,canonical(m));},async()=>{await fs.writeFile(artFile,originalArt);await fs.writeFile(manifestFile,originalManifest);});
  await reject('alt swapped',async()=>{const m=structuredClone(manifest),alt=m.faces.find(f=>f.side==='alt');alt.character=`character:${alt.cardId}:front`;await fs.writeFile(manifestFile,canonical(m));},()=>fs.writeFile(manifestFile,originalManifest));
  await reject('incomplete audio',async()=>{const audio=JSON.parse(originalAudio);audio.tracks.pop();await fs.writeFile(audioFile,canonical(audio));},()=>fs.writeFile(audioFile,originalAudio));
  const bin=path.join(temp,'encoder-failure');await fs.mkdir(bin);await fs.writeFile(path.join(bin,'ffprobe'),'#!/bin/sh\necho PASS\nexit 0\n',{mode:0o755});
  const child=spawnSync(process.execPath,['tools/build-game.mjs','--fixture','--root',input,'--out',output],{cwd:root,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH},encoding:'utf8',timeout:30000});
  expect(child.status).toBe(1);expect(await snapshot()).toEqual(before);results.push({name:'misleading-success encoder',exit:child.status,stdout:child.stdout,stderr:child.stderr,before,after:await snapshot(),pass:true});
  await record('negative-content',results);
});
test('production fixture bypass, traversal symlinks reports and stale package are rejected',async()=>{
  const before=await snapshot(),results=[];
  const run=args=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:30000});
  const pendingInput=path.join(temp,'pending-production');await fs.cp(input,pendingInput,{recursive:true});await fs.unlink(path.join(pendingInput,'SYNTHETIC_GAME_BUILD_FIXTURE.json'));
  const pendingManifest=JSON.parse(await fs.readFile(path.join(pendingInput,'docs/design/game-asset-manifest.json'),'utf8'));Object.assign(pendingManifest.assets[0],{status:'pending',bytes:null,sha256:null,masterSha256:null,reviewReceipt:null});await fs.writeFile(path.join(pendingInput,'docs/design/game-asset-manifest.json'),canonical(pendingManifest));
  const actualGameBefore=sha(await read(root,'index.html'));
  for(const [name,args] of [['production pending',['tools/build-game.mjs','--root',pendingInput,'--out',output]],['fixture to production',['tools/build-game.mjs','--root',input,'--out',output]],['unsafe report',['tools/build-game.mjs','--fixture','--root',input,'--out',output,'--report',path.join(input,'src/app_tpl.html')]]]){
    const result=run(args);expect(result.status).toBe(1);if(name==='production pending')expect(result.stderr).toContain('pending assets: 1');expect(sha(await read(root,'index.html'))).toBe(actualGameBefore);expect(await snapshot()).toEqual(before);results.push({name,exit:result.status,stderr:result.stderr});
  }
  const manifestFile=path.join(input,'docs/design/game-asset-manifest.json'),body=await fs.readFile(manifestFile),manifest=JSON.parse(body);
  try{manifest.assets[0].path='../outside';await fs.writeFile(manifestFile,canonical(manifest));await expect(build()).rejects.toThrow();}finally{await fs.writeFile(manifestFile,body);}
  const file=path.join(input,manifest.assets[1].path),art=await fs.readFile(file);
  try{await fs.unlink(file);await fs.symlink(path.join(input,manifest.assets[2].path),file);await expect(build()).rejects.toThrow(/symlink/);}finally{await fs.unlink(file);await fs.writeFile(file,art);}
  const site=path.join(evidence,'happy/site'),indexFile=path.join(output,'index.html'),index=await fs.readFile(indexFile),packageBefore=sha(await read(site,'game-release.json'));
  try{await fs.writeFile(indexFile,'stale PASS');await expect(packageGame(output,site)).rejects.toThrow(/SHA/);expect(sha(await read(site,'game-release.json'))).toBe(packageBefore);}finally{await fs.writeFile(indexFile,index);}
  expect(await snapshot()).toEqual(before);await record('negative-boundaries',{results,traversalRejected:true,symlinkRejected:true,stalePackageRejected:true,before,after:await snapshot()});
});
test('dirty owned source changes release identity while unrelated file does not',async()=>{
  const tpl=path.join(input,'src/app_tpl.html'),body=await fs.readFile(tpl);
  await fs.writeFile(path.join(input,'unrelated-worker.txt'),'preserve sibling');expect((await build()).releaseId).toBe(initial.releaseId);
  try{await fs.appendFile(tpl,'\n<!-- owned fixture dirty source -->\n');const changed=await build();expect(changed.releaseId).not.toBe(initial.releaseId);await record('dirty-source',{original:initial.releaseId,changed:changed.releaseId,unrelatedPreserved:await fs.readFile(path.join(input,'unrelated-worker.txt'),'utf8')});}
  finally{await fs.writeFile(tpl,body);expect((await build()).releaseId).toBe(initial.releaseId);}
});
for(const name of ['missing-release-entry','hash-mismatch','temp-failure'])test('real package CLI '+name+' reaches failure and preserves all prior bytes',async({},info)=>{
 const source=process.env.SGG_PACKAGE_ROOT;expect(source&&path.isAbsolute(source)).toBeTruthy();expect((await verifyPackage(source)).release.syntheticFixture).toBe(false);
 const dir=info.outputPath('normal-negative'),previous=path.join(dir,'previous'),report=path.join(dir,'rejection.json');await fs.mkdir(dir,{recursive:true});await packageGame(source,previous);
 const before=await packageFiles(previous),original=await packageFiles(source);
 const args=['tools/package-game.mjs','--root',source,'--out',previous,'--verify','--case',name,'--report',report];
 const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:30000});
 expect(result.status).toBe(1);expect(result.signal).toBe(null);expect(result.error).toBeUndefined();expect(result.stderr).not.toContain('unknown/duplicate option');
 const rejection=JSON.parse(await fs.readFile(report,'utf8'));
 expect(rejection).toMatchObject({status:'EXPECTED_REJECTION',case:name,reached:true,callerPreserved:true,ownedRemoved:true,residue:[]});
 expect(rejection.after).toEqual(rejection.previous);expect(await packageFiles(previous)).toEqual(before);expect(await packageFiles(source)).toEqual(original);
 expect((await fs.readdir(dir)).some(n=>n.startsWith('.package-negative-')||n.startsWith('.game-package-'))).toBe(false);
 await record('normal-package-negative-'+info.project.name+'-'+name,{args,exit:result.status,stdout:result.stdout,stderr:result.stderr,rejection,before,after:await packageFiles(previous)});
});
