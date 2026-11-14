// 체험판 배포: export-pages.mjs 내보내기 → 임시 저장소에서 deploy/game-preview에 새 커밋.
// 사용법: node deploy.mjs [--push] [--allow-dirty]
//   (인자 없음)   내보내고 커밋까지 만든 뒤 푸시 직전에 멈춘다. 임시 저장소 경로를 출력한다.
//   --push        커밋 뒤 origin deploy/game-preview에 일반 푸시한다(강제 푸시 없음).
//   --allow-dirty 커밋하지 않은 변경이 있어도 내보낸다. 점검용이며 --push와 함께 쓸 수 없다.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {check} from './source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BRANCH = 'deploy/game-preview';
const flags = new Set(process.argv.slice(2));
for (const flag of flags) check(['--push', '--allow-dirty'].includes(flag), `알 수 없는 인자: ${flag}`);
const push = flags.has('--push'), allowDirty = flags.has('--allow-dirty');
check(!(push && allowDirty), '--push는 --allow-dirty와 함께 쓸 수 없습니다');

const run = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();

const dirty = run(here, 'status', '--porcelain', '--', '.');
check(allowDirty || !dirty, '커밋하지 않은 변경이 있습니다. 커밋한 뒤 다시 실행하세요.\n' + dirty);
const sourceCommit = run(here, 'rev-parse', 'HEAD');
const remote = run(here, 'remote', 'get-url', 'origin');
const author = {name: run(here, 'config', 'user.name'), email: run(here, 'config', 'user.email')};
check(author.name && author.email, 'git user.name / user.email 설정이 필요합니다');

// 1. 저장소 밖 임시 경로에 내보내기
const base = await fs.mkdtemp(path.join(os.tmpdir(), 'steel-deploy-'));
const exported = path.join(base, 'game-preview');
execFileSync('node', [path.join(here, 'export-pages.mjs'), exported], {stdio: 'inherit'});
await fs.writeFile(path.join(exported, '.nojekyll'), '');
for (const required of ['index.html', 'data.json', 'preview-release.json', '.nojekyll']) {
  await fs.access(path.join(exported, required));
}

// 2. 임시 저장소: 원격 배포 브랜치를 받아 그 위에 새 커밋
const repo = path.join(base, 'repo');
await fs.mkdir(repo);
run(repo, 'init', '-q');
run(repo, 'config', 'user.name', author.name);
run(repo, 'config', 'user.email', author.email);
run(repo, 'remote', 'add', 'origin', remote);
run(repo, 'fetch', '--depth', '1', 'origin', BRANCH);
run(repo, 'checkout', '-q', '-B', BRANCH, 'FETCH_HEAD');
for (const entry of await fs.readdir(repo)) if (entry !== '.git') await fs.rm(path.join(repo, entry), {recursive: true, force: true});
await fs.cp(exported, repo, {recursive: true});
run(repo, 'add', '-A');
if (!run(repo, 'status', '--porcelain')) {
  console.log(JSON.stringify({result: 'no-change', note: '배포 브랜치와 내용이 같습니다', temp: base}));
  process.exit(0);
}
run(repo, 'commit', '-q', '-m', `체험판 GitHub Pages 배포 (source ${sourceCommit.slice(0, 7)})`);
const deployCommit = run(repo, 'rev-parse', 'HEAD');
const summary = {branch: BRANCH, sourceCommit, deployCommit, changed: run(repo, 'show', '--stat', '--format=', 'HEAD').split('\n').pop(), repo};

// 3. 푸시 직전. --push가 있을 때만 올린다.
if (!push) {
  console.log(JSON.stringify({result: 'stopped-before-push', ...summary,
    next: `node deploy.mjs --push (또는 ${repo}에서 git push origin ${BRANCH})`}));
  process.exit(0);
}
run(repo, 'push', 'origin', BRANCH);
console.log(JSON.stringify({result: 'pushed', ...summary}));
await fs.rm(base, {recursive: true, force: true});
