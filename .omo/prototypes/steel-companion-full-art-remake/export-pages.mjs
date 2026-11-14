import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sha, check} from './source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
check(process.argv.length === 3, 'Pass the new game-preview output directory');
const destination = path.resolve(process.argv[2]);
check(path.basename(destination) === 'game-preview', 'Output directory must be game-preview');
check(!destination.startsWith(here + path.sep), 'Export outside the source package');
try {
  await fs.access(destination);
  throw new Error('Output already exists');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await fs.cp(path.join(here, 'public'), destination, {recursive: true, errorOnExist: true});
await fs.mkdir(path.join(destination, 'phs-preview'));
for (const name of ['index.html', 'preview.mjs']) {
  await fs.copyFile(path.join(here, 'phs-preview', name), path.join(destination, 'phs-preview', name));
}
const files = [];
async function inventory(directory, prefix = '') {
  for (const entry of (await fs.readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    check(!entry.isSymbolicLink(), 'No symbolic links in Pages output');
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await inventory(path.join(directory, entry.name), relative);
    else {
      const bytes = await fs.readFile(path.join(directory, entry.name));
      files.push({path: relative, bytes: bytes.length, sha256: sha(bytes)});
    }
  }
}
await inventory(destination);
const data = JSON.parse(await fs.readFile(path.join(destination, 'data.json')));
const release = {
  kind: 'steel-companion-prototype',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: here, encoding: 'utf8'}).trim(),
  buildSHA: sha(JSON.stringify(files)),
  artSHA: data.binding.artSHA,
  dialogueSHA: data.binding.dialogueSHA,
  experienceApproved: JSON.parse(await fs.readFile(path.join(here, '../../../current/artwork.json'), 'utf8')).experienceApproved,
  bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  files
};
await fs.writeFile(path.join(destination, 'preview-release.json'), JSON.stringify(release, null, 2));
console.log(JSON.stringify({...release, files: files.length}));
