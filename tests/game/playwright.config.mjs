import {defineConfig} from '@playwright/test';
import path from 'node:path';
import {caseBudget} from '../../tools/game-qa/child.mjs';
export default defineConfig({
  testDir:path.resolve(import.meta.dirname),testMatch:process.env.SGG_CASE_MATCH || '*.spec.mjs',
  testIgnore:process.env.SGG_CASE_MATCH?[]:['**/delivery-links.spec.mjs','**/receipt-audit.spec.mjs'],
  timeout:60000,globalTimeout:caseBudget(process.env.SGG_CASE_MATCH||''),workers:1,retries:0,forbidOnly:true,
  metadata:{runId:process.env.SGG_RUN_ID},
  outputDir:process.env.SGG_OUTPUT_DIR,
  reporter:[['json',{outputFile:process.env.SGG_REPORT}]],
  use:{viewport:{width:390,height:844},timezoneId:'Asia/Seoul',serviceWorkers:'block',trace:'on',screenshot:'only-on-failure'},
  projects:['chromium','webkit'].map(name=>({name,use:{browserName:name}})),
});
