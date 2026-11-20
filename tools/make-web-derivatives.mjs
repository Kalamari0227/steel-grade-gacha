// 8단계 점검(2026-11-20, 사용자 결정 "작은 그림 파생본 만들기"): 승인 그림의 웹용 파생본(WebP, 같은 크기, 손실 압축)을 만든다.
// - 원본은 지우거나 바꾸지 않는다. 체험판 public/art의 원본(이름 = 내용 SHA256)을 읽어 SHA를 다시 확인한 뒤 cwebp로 변환한다.
// - 아이콘(manifest가 PNG를 요구)과 200KB 이하 파일은 만들지 않는다. 결과가 원본의 70% 이상이면 쓰지 않는다(이득이 작다).
// - 결과는 game-edition/assets/web-derivatives-2026-11-20/<파생 SHA256>.webp, 목록은 같은 폴더 manifest.json(승인 전 "pending").
// 사용: node tools/make-web-derivatives.mjs  (cwebp 1.6.0 필요, 같은 판·같은 인자면 같은 바이트가 나온다)
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proto = path.join(root, '.omo/prototypes/steel-companion-full-art-remake');
const outDir = path.join(root, 'assets/web-derivatives-2026-11-20');
const ARGS = ['-quiet', '-q', '88', '-alpha_q', '100', '-m', '6', '-metadata', 'none'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const version = execFileSync('cwebp', ['-version'], {encoding: 'utf8'}).split('\n')[0].trim();
if (version !== '1.6.0') throw new Error('cwebp 1.6.0 required, found ' + version);

const data = JSON.parse(await fs.readFile(path.join(proto, 'public/data.json'), 'utf8'));
const targets = new Map();
for (const a of data.appearances) targets.set(a.image, {target: a.id, kind: 'appearance'});
for (const [id, a] of Object.entries(data.assets)) if (!targets.has(a.image)) targets.set(a.image, {target: id, kind: id.split(':')[0]});
await fs.mkdir(outDir, {recursive: true});
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'web-derivatives-'));
const rows = [], skipped = [];
const queue = [...targets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
async function one([image, info]) {
  const source = await fs.readFile(path.join(proto, 'public', image));
  const sourceSHA = path.basename(image).slice(0, 64);
  if (sha(source) !== sourceSHA) throw new Error('Source SHA mismatch: ' + image);
  if (info.kind === 'icon') { skipped.push({image, reason: 'icon'}); return; }
  if (source.length <= 200 * 1024) { skipped.push({image, reason: 'small'}); return; }
  const out = path.join(tmp, sourceSHA + '.webp');
  await run('cwebp', [...ARGS, path.join(proto, 'public', image), '-o', out]);
  const bytes = await fs.readFile(out);
  if (bytes.length >= source.length * 0.7) { skipped.push({image, reason: 'gain<30%'}); return; }
  const derivedSHA = sha(bytes);
  await fs.writeFile(path.join(outDir, derivedSHA + '.webp'), bytes);
  rows.push({target: info.target, kind: info.kind, source: image, sourceSHA, sourceBytes: source.length, derived: 'assets/web-derivatives-2026-11-20/' + derivedSHA + '.webp', derivedSHA, derivedBytes: bytes.length});
}
const workers = Array.from({length: 8}, async () => { while (queue.length) await one(queue.shift()); });
await Promise.all(workers);
await fs.rm(tmp, {recursive: true, force: true});
rows.sort((a, b) => a.source.localeCompare(b.source));
const total = rows.reduce((s, r) => s + r.sourceBytes, 0), after = rows.reduce((s, r) => s + r.derivedBytes, 0);
const manifest = {category: 'web-derivatives', created: '2026-11-20', status: 'pending', tool: 'cwebp ' + version, args: ARGS, rule: '승인 그림 중 아이콘 제외·200KB 초과·결과가 원본의 70% 미만일 때만. 같은 픽셀 크기, 손실 WebP(품질 88, 알파 100).',
  files: rows.length, sourceBytes: total, derivedBytes: after, skipped, rows};
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({files: rows.length, skipped: skipped.length, sourceMB: +(total / 1048576).toFixed(1), derivedMB: +(after / 1048576).toFixed(1)}));
