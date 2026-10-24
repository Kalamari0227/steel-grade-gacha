import path from 'node:path';
import {hash,fingerprint} from './delivery-files.mjs';
export const projects=['chromium','webkit'];
export function reportCases(report){
 const found=[];
 function visit(suites,ancestry=[]){
  for(const suite of suites||[]){
   const suitePath=[...ancestry,suite.title];
   for(const spec of suite.specs||[])for(const test of spec.tests||[]){
    const identity={specId:spec.id,file:path.resolve(report.config.rootDir,spec.file||suite.file),suitePath,title:spec.title,project:test.projectName,projectId:test.projectId};
    const annotations=[...(test.annotations||[]),...(test.results?.[0]?.annotations||[])];
    found.push({identity,expected:test.expectedStatus,annotations:annotations.filter((row,i)=>annotations.findIndex(other=>other.type===row.type&&other.description===row.description)===i),results:test.results||[]});
   }visit(suite.suites,suitePath);
  }
 }visit(report.suites);return found;
}
export const identityKey=identity=>JSON.stringify(identity&&[identity.specId,identity.file,identity.suitePath,identity.title,identity.project,identity.projectId]);
export function cleanCase(row){
 return row.expected==='passed'&&row.results.length===1&&row.results[0].status==='passed'&&row.results[0].retry===0&&!(row.results[0].errors||[]).length;
}
export function validateFinalSuite({report,inventory,run,files,reportBytes,inventoryBytes}){
 if(run.schema!==1||run.status!=='passed'||!run.runId||run.start?.runId!==run.runId||run.exitCode!==0)throw Error('Final run incomplete');
 if(run.reportSHA256!==hash(reportBytes)||run.inventorySHA256!==hash(inventoryBytes))throw Error('Final report/inventory digest mismatch');
 const finalFingerprint=fingerprint(files);
 if(run.start.fingerprintSHA256!==finalFingerprint||run.end.fingerprintSHA256!==finalFingerprint||
    fingerprint(run.start.files)!==finalFingerprint||fingerprint(run.end.files)!==finalFingerprint)throw Error('Run start/end inputs differ from delivered files');
 if(!Number.isFinite(Date.parse(run.start.at))||!Number.isFinite(Date.parse(run.end.at))||Date.parse(run.end.at)<Date.parse(run.start.at))throw Error('Invalid run interval');
 const expected=reportCases(inventory),actual=reportCases(report);
 const inventoryKeys=expected.map(row=>identityKey(row.identity)).sort(),actualKeys=actual.map(row=>identityKey(row.identity)).sort();
 if(!actual.length||new Set(actualKeys).size!==actual.length||JSON.stringify(inventoryKeys)!==JSON.stringify(actualKeys))throw Error('Incomplete/duplicate final case inventory');
 for(const project of projects){
  if(!expected.some(row=>row.identity.project===project)||!actual.some(row=>row.identity.project===project))throw Error('Both browser inventories required');
 }
 if(actual.some(row=>!projects.includes(row.identity.project)||!cleanCase(row)))throw Error('Final case failed/skipped/retried or unknown project');
 const stats=report.stats;
 if(!stats||stats.expected!==actual.length||stats.unexpected!==0||stats.skipped!==0||stats.flaky!==0||!Array.isArray(report.errors)||report.errors.length)throw Error('Final suite is not clean and complete');
 return {runId:run.runId,fingerprintSHA256:finalFingerprint,cases:actual,projects,counts:Object.fromEntries(projects.map(p=>[p,actual.filter(row=>row.identity.project===p).length]))};
}
