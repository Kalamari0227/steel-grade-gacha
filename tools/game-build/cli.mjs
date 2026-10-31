import fs from 'node:fs/promises';
import path from 'node:path';
import {args,boundary,check,exists} from './io.mjs';
import {buildGame} from './build.mjs';
import {packageGame,packageNegative} from './package.mjs';
export async function run(mode){
  try{
    if(process.argv.slice(2).join(' ')==='--help'){console.log(mode==='build'?'build-game [--root DIR] [--out DIR] [--fixture] [--report NEW_JSON]':'package-game --out DIR [--root DIR] [--verify] [--report NEW_JSON] [--case missing-release-entry|hash-mismatch|temp-failure]');return;}
    const options=args(process.argv.slice(2),mode),root=await boundary(path.resolve(options['--root']||path.resolve(import.meta.dirname,'../..')));
    check(mode==='build'||options['--out'],'package output required');
    const out=await boundary(path.resolve(options['--out']||root));
    const report=options['--report']?await boundary(path.resolve(options['--report'])):null;
    if(report){check(!report.startsWith(root+path.sep)&&!report.startsWith(out+path.sep)&&!await exists(report),'report must be new and outside input/output');await fs.mkdir(path.dirname(report),{recursive:true});}
    if(options['--case']){
      const result=await packageNegative({source:root,target:out,name:options['--case']});
      if(report)await fs.writeFile(report,JSON.stringify(result,null,2),{flag:'wx'});
      console.error(JSON.stringify(result));process.exitCode=1;return;
    }
    const result=mode==='build'?await buildGame({root,out,syntheticFixture:!!options['--fixture']}):await packageGame(root,out);
    if(report)await fs.writeFile(report,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
  }catch(error){console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;}
}
