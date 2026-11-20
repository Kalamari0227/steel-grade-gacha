import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: '.',
  testMatch: 'browser.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 40000,
  outputDir: join(tmpdir(), 'steel-contract-defense-tests'),
  use: { baseURL: 'http://127.0.0.1:18765', trace: 'retain-on-failure' },
  webServer: {
    command: 'python3 -m http.server 18765 --bind 127.0.0.1',
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:18765',
    reuseExistingServer: false,
  },
});
