import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicJson, parseArgs, readJson, relativePath, requireValue, safePath, sha} from './io.mjs';
import {applyFragment} from './fragments.mjs';
import {verify} from './verify.mjs';
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function canonicalDestination(file) {
  let ancestor=path.resolve(file);
  const missing=[];
  for (;;) {
    try { await fs.lstat(ancestor); }
    catch(error) {
      if(error.code!=='ENOENT')throw error;
      const parent=path.dirname(ancestor);
      requireValue(parent!==ancestor,'report-path','no existing report ancestor');
      missing.unshift(path.basename(ancestor));ancestor=parent;continue;
    }
    // Resolve outside the ENOENT catch: a dangling symlink is not a missing directory.
    return path.join(await fs.realpath(ancestor),...missing);
  }
}
async function reportDestination(file,protectedPaths) {
  try { const stat=await fs.lstat(file);requireValue(stat.isFile()&&!stat.isSymbolicLink(),'report-path','report destination must be a regular file'); }
  catch(error){if(error.code!=='ENOENT')throw error;}
  const target=await canonicalDestination(file);
  requireValue(protectedPaths.every(prefix=>target!==prefix&&!target.startsWith(prefix+path.sep)),'report-path','report must be outside product source paths');
  return target;
}
export async function run(mode) {
  let reportPath,lockFile,lock,context,report,reportWritten=false;
  try {
    const args=parseArgs(process.argv.slice(2),mode);
    const root=path.resolve(args['--root']||defaultRoot),manifestRelative=relativePath(args['--manifest']||'docs/design/game-asset-manifest.json');
    const reviewRoot=relativePath(args['--review-root']||'docs/design/game-reviews');
    const manifestFile=await safePath(root,manifestRelative);
    const protectedPaths=await Promise.all([manifestFile,...['src','tools','docs'].map(name=>path.join(root,name))].map(canonicalDestination));
    const targetReport=await reportDestination(path.resolve(args['--report']),protectedPaths);
    await fs.mkdir(path.dirname(targetReport),{recursive:true});
    reportPath=await reportDestination(targetReport,protectedPaths);
    context={root,reviewRoot,group:args['--group'],schemaOnly:args['--schema-only']===true,canonical:args['--canonical']===true||(mode==='verify'&&args['--group']==='all')};
    if(args['--case']) {
      if(args['--case']==='car-negative') {
        const {carNegativeScenarios}=await import('./car-negative.mjs');
        report=await carNegativeScenarios({root,evidence:path.dirname(reportPath),group:context.group});
      } else if(args['--case']==='part-negative') {
        const {partNegativeScenarios}=await import('./part-negative.mjs');
        report=await partNegativeScenarios({root,evidence:path.dirname(reportPath),group:context.group});
      } else if(args['--case']==='item-negative') {
        const {itemNegativeScenarios}=await import('./item-negative.mjs');
        report=await itemNegativeScenarios({root,evidence:path.dirname(reportPath),group:context.group});
      } else if(args['--case']==='family-negative') {
        const {familyNegativeScenarios}=await import('./family-negative.mjs');
        report=await familyNegativeScenarios({root,evidence:path.dirname(reportPath),group:context.group});
      } else if(args['--case']==='identity-pilot-negative') {
        const {identityNegativeScenarios}=await import('./identity-negative.mjs');
        report=await identityNegativeScenarios({root,evidence:path.dirname(reportPath)});
      } else if(args['--case']==='environment-negative') {
        const {environmentNegativeScenarios}=await import('./environment-negative.mjs');
        report=await environmentNegativeScenarios({root,evidence:path.dirname(reportPath)});
      } else {
        const {negativeScenarios}=await import('./negative.mjs');
        report=await negativeScenarios({root,evidence:path.dirname(reportPath)});
      }
    } else {
      if(mode==='merge') {
        lockFile=await safePath(root,manifestRelative+'.lock');
        lock=await fs.open(lockFile,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,group:context.group}));
      }
      const original=await fs.readFile(manifestFile),manifest=JSON.parse(original.toString('utf8'));
      const merged=context.group&&!context.canonical?await applyFragment(manifest,context):null;
      report=await verify(merged?.candidate||manifest,context);
      if(['parts-body','parts-frame','parts-chassis'].includes(context.group)) {
        const {verifyPartAssembly}=await import('./part-assembly.mjs');
        report.assembly=await verifyPartAssembly(merged?.candidate||manifest,context);
      }
      Object.assign(report,{manifest:manifestRelative,inputSha256:sha(original),fragment:merged?{path:merged.fragmentPath,sha256:merged.fragmentSha256,changes:merged.changes}:null,mutated:false});
      if(mode==='merge') {
        requireValue(sha(await fs.readFile(manifestFile))===sha(original),'concurrent-manifest-change',manifestRelative);
        Object.assign(report,{mutated:true,outputSha256:sha(JSON.stringify(merged.candidate,null,2)+'\n')});
        // Publish the report before promotion, so an unwritable report cannot mutate the manifest.
        await atomicJson(reportPath,report);
        await atomicJson(manifestFile,merged.candidate);
        reportWritten=true;
      } else report.outputSha256=sha(original);
    }
  } catch(error) {
    report={status:'FAIL',mode,code:error.code||error.name,error:error.message};process.exitCode=1;
  } finally {
    if(lock){await lock.close();await fs.rm(lockFile);}
  }
  if(reportPath&&!reportWritten)await atomicJson(reportPath,report);
  console.log(JSON.stringify(report));
}
