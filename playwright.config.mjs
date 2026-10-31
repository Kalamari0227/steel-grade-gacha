import {caseBudget} from './tools/game-qa/child.mjs';
import { defineConfig } from '@playwright/test';
import { appURL, baselineURL, evidenceRoot, root, baselineRoot } from './tests/helpers/paths.mjs';
export default defineConfig({
  testDir: './tests', testMatch: process.env.SGG_CASE_MATCH || '*.spec.mjs', testIgnore:['**/game/**','**/game-assets/**'],
  timeout:60000, globalTimeout:['contracts.spec.mjs','accessibility-layout.spec.mjs'].includes(process.env.SGG_CASE_MATCH)?caseBudget(process.env.SGG_CASE_MATCH,(process.env.SGG_CASE_ENGINES||'').split(',')):180000, workers:1, retries:0, forbidOnly:true, fullyParallel:false,
  metadata:{runId:process.env.SGG_RUN_ID},
  outputDir: `${evidenceRoot}/runs/${process.env.SGG_RUN_ID || Date.now()}`,
  reporter: [['list'], ['json', { outputFile: process.env.SGG_REPORT || `${evidenceRoot}/contracts.json` }]],
  use: { viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block', trace: 'on', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: process.env.SGG_EXTERNAL_SERVERS==='1'?[]:[
    { command: `python3 -m http.server ${new URL(appURL).port} --bind 127.0.0.1`, cwd: root, url: appURL, reuseExistingServer: false },
    { command: `python3 -m http.server ${new URL(baselineURL).port} --bind 127.0.0.1`, cwd: baselineRoot, url: baselineURL, reuseExistingServer: false },
  ],
});
