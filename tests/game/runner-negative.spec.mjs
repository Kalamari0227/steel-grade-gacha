import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {root,appURL,baselineURL} from '../helpers/paths.mjs';
import {openApp,capture,sha} from '../helpers/app.mjs';
import {installFixture} from './namespaces.mjs';
import {controlledFixture} from './fixture-contracts.mjs';
import {startStatic} from '../../tools/game-qa/server.mjs';
import {runPlaywright} from '../../tools/game-qa/child.mjs';
import {verifyReport} from '../../tools/game-qa/report.mjs';
import {startPwaSite} from '../helpers/pwa-site.mjs';
for(const edition of ['education','game'])test(`controlled ${edition} fixture uses actual LS IDB and seen namespaces`,async({page},info)=>{
  await capture(info,'controlled-namespace',await controlledFixture(page,edition));
});
test('wrong edition fixture rejects before any fixture writes',async({page},info)=>{
  await openApp(page,baselineURL);
  const snapshot=()=>page.evaluate(()=>new Promise(resolve=>mirrorGet(value=>resolve({ls:{...localStorage},mirror:value}))));
  const before=await snapshot();
  await expect(installFixture(page,{edition:'game',state:{scrap:999}})).rejects.toThrow('namespace mismatch');
  const after=await snapshot();expect(after).toEqual(before);await capture(info,'wrong-edition',{before,after});
});
test('CLI rejects unknown case and engine and malformed options',async({},info)=>{
  const rows=[];
  for(const args of [['--case','missing'],['--case','baseline-contracts','--engines','firefox'],['--case','baseline-contracts','--engines','chromium,'],['--case','baseline-contracts','--unexpected','true']]){
    const result=spawnSync(process.execPath,['tools/game-qa.mjs',...args],{cwd:root,encoding:'utf8',timeout:10000});
    expect(result.status).toBe(1);expect(result.stdout).not.toContain('"status":"PASS"');rows.push({args,status:result.status,stdout:result.stdout,stderr:result.stderr});
  }
  const list=spawnSync(process.execPath,['tools/game-qa.mjs','--list'],{cwd:root,encoding:'utf8',timeout:10000});
  expect(list.status).toBe(0);expect(JSON.parse(list.stdout).cases).toEqual(expect.arrayContaining(['baseline-contracts','runner-negative']));
  await capture(info,'cli-rejections',{rows,list:list.stdout});
});
for(const probe of ['empty','failure','timeout'])test(`actual ${probe} child cannot become PASS`,async({},info)=>{
  const directory=info.outputPath(probe);await fs.mkdir(directory,{recursive:true});
  let rejected;
  try{await runPlaywright({root,directory,runId:randomUUID(),engines:[info.project.name],testMatch:`probes/${probe}.probe.mjs`,env:{}});}catch(error){rejected=error.message;}
  expect(rejected).toBeTruthy();
  const log=await fs.readFile(path.join(directory,'child.log'),'utf8');
  if(probe==='failure')expect(log).toContain('PASS');
  await capture(info,`${probe}-rejected`,{rejected,directory});
});
test('stale report and false counts cannot authorize success',async({},info)=>{
  const old={config:{metadata:{runId:'previous-run'}},stats:{expected:50,startTime:'2020-01-01T00:00:00Z'}};
  const started=Date.now(),run={runId:randomUUID(),started,exitCode:0,engines:[info.project.name]};
  const fresh={config:{metadata:{runId:run.runId}},stats:{expected:1,unexpected:0,skipped:0,flaky:0,startTime:new Date(started).toISOString(),duration:1},errors:[],suites:[{specs:[{tests:[{projectName:info.project.name,status:'expected',results:[{status:'passed',retry:0,errors:[]}]}]}]}]};
  expect(verifyReport(fresh,run)).toEqual({passed:1,engines:{[info.project.name]:1}});
  const missing=structuredClone(fresh);delete missing.stats.startTime;
  for(const report of [{...fresh,stats:{...fresh.stats,startTime:'invalid-startTime'}},missing])expect(()=>verifyReport(report,run)).toThrow('Stale report');
  const failures=[];
  for(const [label,report,exitCode] of [['stale',old,0],['failed-child',{stats:{expected:50}},1],['empty',{config:{metadata:{runId:'current'}},stats:{expected:0,startTime:new Date().toISOString()}},0]]){
    expect(()=>verifyReport(report,{runId:'current',started:Date.now(),exitCode,engines:[info.project.name]})).toThrow();failures.push(label);
  }
  await capture(info,'report-rejections',{failures});
});
for(const field of ['error fields','retry'])test(`passed single result cannot hide ${field}`,async({},info)=>{
  const started=Date.now(),runId=randomUUID(),engine=info.project.name;
  const run={runId,started,exitCode:0,engines:[engine]};
  const result={workerIndex:0,parallelIndex:0,status:'passed',duration:1,errors:[],stdout:[],stderr:[],retry:0,startTime:new Date(started).toISOString(),annotations:[],attachments:[]};
  const clean={config:{metadata:{runId}},suites:[{title:'native-shaped fixture',specs:[{title:'clean result',ok:true,tests:[{timeout:60000,annotations:[],expectedStatus:'passed',projectId:engine,projectName:engine,results:[result],status:'expected'}]}]}],errors:[],stats:{startTime:new Date(started).toISOString(),duration:1,expected:1,skipped:0,unexpected:0,flaky:0}};
  expect(verifyReport(clean,run)).toEqual({passed:1,engines:{[engine]:1}});
  const mutations=field==='error fields'?
    [['errors',[{message:'result error'}]],['errors',{message:'invalid error collection'}],['errors',{length:0}],['errors',''],['errors',null],['errors',false],['errors',undefined],['error',{message:'singular result error'}],['error','singular result error'],['error',null],['error',false],['error','']]:
    [1,-1,0.5,'0',null,false,undefined].map(value=>['retry',value]);
  const rows=[];
  for(const [key,value] of mutations){
    const report=structuredClone(clean),target=report.suites[0].specs[0].tests[0].results[0];
    if(value===undefined)delete target[key];else target[key]=value;
    let error;try{verifyReport(report,run);}catch(cause){error=cause.message;}
    rows.push({key,value,omitted:value===undefined,rejected:!!error,error});
    expect.soft(error,`${key}=${JSON.stringify(value)}`).toBeTruthy();
  }
  await capture(info,'per-result-report-rejections',{run,clean,rows});
});
test('occupied port retains unrelated server and dirty files',async({},info)=>{
  const directory=info.outputPath('occupied');await fs.mkdir(directory,{recursive:true});
  const sentinel='unrelated-resource';await fs.writeFile(path.join(directory,'index.html'),sentinel);
  const first=await startStatic(directory),second=await startStatic(root,first.port);
  try{
    expect(second.port).not.toBe(first.port);expect(await(await fetch(first.url)).text()).toBe(sentinel);
    expect(await fs.readFile(path.join(directory,'index.html'),'utf8')).toBe(sentinel);
    await capture(info,'occupied-port',{first:first.port,fallback:second.port,unrelatedBody:await(await fetch(first.url)).text(),dirtyFilePreserved:true});
  }finally{await second.close();await first.close();}
});
test('stale served document is rejected before fixture installation',async({page},info)=>{
  await page.route(appURL+'/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'<!-- stale -->'});});
  await expect(openApp(page,appURL)).rejects.toThrow('served main document matches disk');
  await capture(info,'stale-main',{rejected:true,source:'HTTP route altered main bytes; real app response fetched first'});
});

async function packageSnapshot(directory){
  const rows=[];
  async function visit(relative){
    const absolute=path.join(directory,relative),stat=await fs.lstat(absolute);
    const row={path:relative,mode:stat.mode&0o777};
    if(stat.isSymbolicLink())rows.push({...row,link:await fs.readlink(absolute)});
    else if(stat.isDirectory()){rows.push({...row,directory:true});for(const name of (await fs.readdir(absolute)).sort())await visit(path.join(relative,name));}
    else rows.push({...row,sha:sha(await fs.readFile(absolute))});
  }
  await visit('');return rows;
}
test('PWA file manifest rejects directories escapes and links before touching sources',async({},info)=>{
  const fixture=info.outputPath('boundary-fixture'),source=path.join(fixture,'package'),outside=path.join(fixture,'outside');
  await capture(info,'boundary-resources',{fixture,retainedAsEvidence:true});
  await fs.mkdir(path.join(source,'nested'),{recursive:true});await fs.mkdir(outside);
  await fs.writeFile(path.join(source,'index.html'),'<title>Owned package</title>');await fs.writeFile(path.join(source,'sw.js'),'// owned worker');
  await fs.writeFile(path.join(source,'nested/hidden.txt'),'unlisted');await fs.writeFile(path.join(outside,'sentinel.txt'),'OUTSIDE_PACKAGE_SENTINEL');
  await fs.chmod(path.join(outside,'sentinel.txt'),0o444);await fs.chmod(path.join(source,'index.html'),0o444);
  await fs.symlink(path.join(outside,'sentinel.txt'),path.join(source,'linked.txt'));
  await fs.symlink(path.join(source,'index.html'),path.join(source,'internal-link.txt'));
  await fs.symlink(outside,path.join(source,'directory-link'));await fs.symlink(source,path.join(fixture,'root-link'));
  const before=await packageSnapshot(fixture),safe={root:source,files:['index.html','sw.js']},rows=[];
  const malformed=['.','','nested','../outside/sentinel.txt',path.join(outside,'sentinel.txt'),'linked.txt','internal-link.txt','directory-link/sentinel.txt','nested/../index.html','nested//hidden.txt'];
  const packages=malformed.map(name=>({root:source,files:['index.html','sw.js',name]}));packages.push({root:path.join(fixture,'root-link'),files:['index.html','sw.js']});
  for(const role of ['baseline','current'])for(const pkg of packages){
    let site,error;
    try{site=await startPwaSite(info,{edition:'game',baseline:safe,current:safe,[role]:pkg});}
    catch(cause){error=cause.message;}
    finally{if(site)await site.close();}
    expect(error).toMatch(/PWA/);expect(await packageSnapshot(fixture)).toEqual(before);rows.push({role,pkg,rejected:true,error});
  }
  await capture(info,'package-boundary-rejections',{before,after:await packageSnapshot(fixture),rows});
});
for(const intrusion of ['file-link','parent-link','root-link'])test(`PWA staged ${intrusion} cannot expose or modify an outside file`,async({},info)=>{
  const fixture=info.outputPath('stage-fixture'),source=path.join(fixture,'package'),outside=path.join(fixture,'outside');
  await capture(info,'stage-boundary-resources',{fixture,retainedAsEvidence:true});
  await fs.mkdir(path.join(source,'nested'),{recursive:true});await fs.mkdir(outside);
  await fs.writeFile(path.join(source,'index.html'),'<title>Owned staging fixture</title>');await fs.writeFile(path.join(source,'sw.js'),'// owned worker');
  await fs.writeFile(path.join(source,'nested/tone.wav'),'owned fixture bytes');
  await fs.writeFile(path.join(outside,'tone.wav'),'OUTSIDE_STAGING_SENTINEL');await fs.chmod(path.join(outside,'tone.wav'),0o444);
  await fs.mkdir(path.join(outside,'nested'));await fs.writeFile(path.join(outside,'nested/tone.wav'),'OUTSIDE_STAGING_SENTINEL');
  for(const name of ['index.html','sw.js']){await fs.writeFile(path.join(outside,name),'OUTSIDE_STAGING_SENTINEL');await fs.chmod(path.join(outside,name),0o444);}
  const before=await packageSnapshot(fixture),pkg={root:source,files:['index.html','sw.js','nested/tone.wav']};
  const site=await startPwaSite(info,{edition:'game',baseline:pkg,current:pkg});
  try{
    const {directory}=JSON.parse(await fs.readFile(info.outputPath('pwa-resources.json'),'utf8'));
    const target=intrusion==='root-link'?directory:path.join(directory,intrusion==='file-link'?'nested/tone.wav':'nested');
    await fs.rm(target,{recursive:true});await fs.symlink(path.join(outside,intrusion==='file-link'?'tone.wav':''),target);
    const response=await fetch(site.url+'/nested/tone.wav');expect(response.status).toBe(404);expect(await response.text()).not.toContain('OUTSIDE_STAGING_SENTINEL');
    if(intrusion!=='root-link')await fs.writeFile(path.join(directory,'unlisted.txt'),'unlisted staged file');
    expect((await fetch(site.url+'/unlisted.txt')).status).toBe(404);
    await expect(site.publishCurrent()).rejects.toThrow(/PWA.*(symbolic link|staging parent|directory boundary)/);
    const after=await packageSnapshot(fixture);expect(after).toEqual(before);
    await capture(info,'staged-boundary',{intrusion,url:site.url,httpStatus:response.status,publishRejected:true,before,after});
  }finally{await site.close();}
});
test('aggregate error collections absent counters and unknown engines cannot hide behind a passed result',async({},info)=>{
 const started=Date.now(),run={runId:randomUUID(),started,exitCode:0,engines:[info.project.name]};
 const clean={config:{metadata:{runId:run.runId}},stats:{startTime:new Date(started).toISOString(),expected:1,unexpected:0,skipped:0,flaky:0},errors:[],suites:[{specs:[{tests:[{projectName:info.project.name,status:'expected',results:[{status:'passed',retry:0,errors:[]}]}]}]}]};
 expect(verifyReport(clean,run).passed).toBe(1);const rows=[];
 for(const field of ['unexpected','skipped','flaky']){const altered=structuredClone(clean);delete altered.stats[field];expect(()=>verifyReport(altered,run)).toThrow();rows.push({field,rejected:true});}
 for(const value of [undefined,null,false,{},'',{length:0}]){const altered=structuredClone(clean);altered.errors=value;expect(()=>verifyReport(altered,run)).toThrow();rows.push({field:'errors',value,rejected:true});}
 const wrong=structuredClone(clean);wrong.suites[0].specs[0].tests.push({...wrong.suites[0].specs[0].tests[0],projectName:'unregistered-engine'});wrong.stats.expected=2;
 expect(()=>verifyReport(wrong,run)).toThrow('Unknown engine');await capture(info,'aggregate-forgeries',rows);
});
