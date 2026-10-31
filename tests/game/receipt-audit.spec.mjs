import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {auditReleaseSet} from '../../tools/suite-evidence.mjs';
import {fileRecord,absoluteInput} from '../../tools/delivery-files.mjs';
import {record} from '../helpers/edition-package-site.mjs';
test('actual final release set binds every task proof and unchanged F package/archive',async({},info)=>{
 const input=await absoluteInput(process.env.SGG_RELEASE_SET,'SGG_RELEASE_SET'),before=await fileRecord(input);
 const result=await auditReleaseSet(input);
 expect(result.set.tasks).toHaveLength(46);expect(result.set.coverage).toHaveLength(22);expect(result.receipt.passed).toBeGreaterThan(0);
 expect(await fileRecord(input)).toEqual(before);
 await record(info,'actual-receipt-audit',{input,before,releaseId:result.binding.releaseId,fingerprintSHA256:result.freeze.fingerprintSHA256,tasks:result.set.tasks,coverage:result.set.coverage,counts:{browser:result.receipt.passed,node:result.receipt.node.map(r=>({name:r.name,passed:r.passed})),separateContracts:result.receipt.contracts.passed}});
});
test('a stale detached release-set is rejected by the same live auditor',async({},info)=>{
 const file=await absoluteInput(process.env.SGG_RELEASE_SET,'SGG_RELEASE_SET'),set=JSON.parse(await fs.readFile(file,'utf8')),mutated=info.outputPath('stale-release-set.json');
 await fs.mkdir(info.outputDir,{recursive:true});set.final40.sha256='0'.repeat(64);await fs.writeFile(mutated,JSON.stringify(set));
 await expect(auditReleaseSet(mutated)).rejects.toThrow('Stale artifact');await record(info,'actual-stale-receipt',{source:file,mutated,rejected:true});
});
