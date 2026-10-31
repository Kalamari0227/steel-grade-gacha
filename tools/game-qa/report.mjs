export function verifyReport(report,run) {
  if(run.exitCode!==0) throw Error(`Child failed: ${run.exitCode}`);
  const reportStarted=Date.parse(report.stats?.startTime);
  if(report.config?.metadata?.runId!==run.runId || !Number.isFinite(reportStarted) || reportStarted<run.started-1000) throw Error('Stale report');
  const stats=report.stats;
  if(!stats || !Number.isSafeInteger(stats.expected) || !(stats.expected>0) || stats.unexpected!==0 || stats.skipped!==0 || stats.flaky!==0 || !Array.isArray(report.errors) || report.errors.length) throw Error('Report has zero, failed, skipped, flaky or errored cases');
  const tests=[];
  const visit=suite=>{for(const spec of suite.specs || []) tests.push(...spec.tests);for(const child of suite.suites || [])visit(child);};
  for(const suite of report.suites || [])visit(suite);
  for(const engine of run.engines) {
    const selected=tests.filter(t=>t.projectName===engine);
    if(!selected.length || selected.some(t=>t.status!=='expected' || t.results.length!==1 || t.results[0].status!=='passed' || t.results[0].retry!==0 || !Array.isArray(t.results[0].errors) || t.results[0].errors.length || t.results[0].error!==undefined)) throw Error(`No clean completed cases for ${engine}`);
  }
  if(tests.some(t=>!run.engines.includes(t.projectName)))throw Error('Unknown engine in report');
  if(tests.length!==stats.expected)throw Error('Reported count mismatch');
  return {passed:stats.expected,engines:Object.fromEntries(run.engines.map(e=>[e,tests.filter(t=>t.projectName===e).length]))};
}
