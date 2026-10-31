import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export async function inputHashes(root){
  const files=['index.html','src/app_tpl.html','tools/game-qa.mjs','tests/helpers/app.mjs','tests/helpers/paths.mjs','tests/helpers/pwa-site.mjs','tests/fixtures/catalog.json','package.json','package-lock.json'];
  async function collect(relative){for(const row of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const child=path.join(relative,row.name);if(row.isDirectory())await collect(child);else files.push(child);}}
  await collect('tests/game');await collect('tools/game-qa');
  const output={};for(const file of files.sort())output[file]=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
  return output;
}
