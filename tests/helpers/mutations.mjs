import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { root, baselineRoot, evidenceRoot } from './paths.mjs';
import { sha } from './app.mjs';
const mutations=[
  {name:'remove-ten-guarantee',from:'if(!hi){',to:'if(false && !hi){',grep:'current.*ten pull'},
  {name:'remove-quiz-reward',from:'Math.min(S.extra + 1, quizMax())',to:'Math.min(S.extra, quizMax())',grep:'current.*quiz five pass=true initialExtra=0'},
  {name:'double-craft-consumption',from:'if(id !== QP_ID) addStock(id, -1);',to:'if(id !== QP_ID) addStock(id, -2);',grep:'current.*craft every part'},
];
const receipts=[];
async function run(command,args,cwd,env,logPath) {
  let output='';const child=spawn(command,args,{cwd,env});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  await fs.writeFile(logPath,output);return code;
}
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sgg-mutants-'));
try {
  await fs.cp(`${root}/src`,`${temp}/src`,{recursive:true});
  await fs.cp(`${root}/tests/fixtures`,`${temp}/tests/fixtures`,{recursive:true});
  await fs.cp(`${root}/webtoon`,`${temp}/webtoon`,{recursive:true});
  for(const file of ['manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','sw.js'])await fs.copyFile(`${root}/${file}`,`${temp}/${file}`);
  const original=await fs.readFile(`${root}/src/app_tpl.html`,'utf8');
  for(const mutation of mutations) {
    if(original.split(mutation.from).length!==2)throw Error(`Mutation anchor not unique: ${mutation.name}`);
    const source=original.replace(mutation.from,mutation.to);await fs.writeFile(`${temp}/src/app_tpl.html`,source);
    const buildCode=await run('bash',['src/build.sh'],temp,process.env,`${evidenceRoot}/${mutation.name}-build.log`);
    if(buildCode!==0)throw Error('Mutant build failed');
    const env={...process.env,SGG_APP_ROOT:temp,SGG_BASELINE_ROOT:baselineRoot,SGG_REPORT:`${evidenceRoot}/${mutation.name}.json`,SGG_RUN_ID:mutation.name};
    const args=['playwright','test','tests/contracts.spec.mjs','--project=chromium','--grep',mutation.grep];
    const exitCode=await run('npx',args,root,env,`${evidenceRoot}/${mutation.name}.log`);
    const report=JSON.parse(await fs.readFile(env.SGG_REPORT,'utf8'));
    const expected=report.stats.unexpected;
    const messages=[];
    const visit=suite=>{for(const spec of suite.specs||[])for(const test of spec.tests)for(const result of test.results)if(result.error)messages.push(result.error.message);for(const sub of suite.suites||[])visit(sub);};
    report.suites.forEach(visit);
    const errors=messages.some(message=>message.replace(/\u001b\[[0-9;]*m/g,'').includes('expect(received)'));
    const pass=exitCode===1&&expected===1&&report.stats.skipped===0&&errors;
    receipts.push({name:mutation.name,invocation:['npx',...args],exitCode,failedTests:expected,pass,sourceSHA256:sha(source),builtSHA256:sha(await fs.readFile(`${temp}/index.html`)),report:env.SGG_REPORT});
    if(!pass)throw Error(`Mutation not detected by contract assertion: ${mutation.name}`);
  }
}finally {
  await fs.rm(temp,{recursive:true,force:true});
  await fs.writeFile(`${evidenceRoot}/mutations.json`,JSON.stringify({receipts,temp,cleaned:true},null,2));
}
