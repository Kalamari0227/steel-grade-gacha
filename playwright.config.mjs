import { defineConfig } from '@playwright/test';
import { appURL, baselineURL, evidenceRoot, root, baselineRoot } from './tests/helpers/paths.mjs';
export default defineConfig({
  testDir: './tests', timeout: 60000, workers: 1, fullyParallel: false,
  outputDir: `${evidenceRoot}/runs/${process.env.SGG_RUN_ID || Date.now()}`,
  reporter: [['list'], ['json', { outputFile: process.env.SGG_REPORT || `${evidenceRoot}/contracts.json` }]],
  use: { viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'block', trace: 'on', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: [
    { command: `python3 -m http.server ${new URL(appURL).port} --bind 127.0.0.1`, cwd: root, url: appURL, reuseExistingServer: false },
    { command: `python3 -m http.server ${new URL(baselineURL).port} --bind 127.0.0.1`, cwd: baselineRoot, url: baselineURL, reuseExistingServer: false },
  ],
});
