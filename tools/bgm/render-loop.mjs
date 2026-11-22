// 반복 구간 만들기: 끝점을 ±30ms 안에서 파형 상관이 가장 큰 곳으로 맞춘 뒤, 끝 0.12초를 시작 직전 소리와 동일 전력으로 겹쳐 이음매를 없앤다.
// 파일 = [본문 끝 1초] + 본문 + [본문 처음 1초]. 재생은 loopStart=1초, loopEnd=1초+본문 길이로 돌린다(디코더 지연이 있어도 이음매가 같다).
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const [file, startS, lengthS, out, targetLufs = '-16'] = process.argv.slice(2);
const SR = 48000, M = SR, C = Math.round(0.12 * SR);
const raw = execFileSync('ffmpeg', ['-v','error','-i',file,'-ac','2','-ar',String(SR),'-f','f32le','-'], {maxBuffer: 1 << 30});
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), n = x.length / 2;
const mono = i => (x[2*i] + x[2*i+1]) / 2;
const s = Math.round(+startS * SR), L0 = Math.round(+lengthS * SR), HALF = 4096;
function ncc(a, b) { let ab=0, aa=0, bb=0; for (let i=-HALF;i<HALF;i++){ const p=mono(a+i), q=mono(b+i); ab+=p*q; aa+=p*p; bb+=q*q; } return ab / Math.sqrt(aa*bb || 1); }
let bestD = 0, bestC = -2; for (let d = -Math.round(0.03*SR); d <= Math.round(0.03*SR); d++) { const c = ncc(s, s + L0 + d); if (c > bestC) { bestC = c; bestD = d; } }
const L = L0 + bestD, e = s + L;
if (s - C < 0 || e > n) throw new Error('범위 밖');
const body = new Float32Array(L * 2);
for (let i = 0; i < L; i++) for (let ch = 0; ch < 2; ch++) body[2*i+ch] = x[2*(s+i)+ch];
for (let m = 0; m < C; m++) { const t = (m + 0.5) / C, gOut = Math.cos(t * Math.PI / 2), gIn = Math.sin(t * Math.PI / 2);
  for (let ch = 0; ch < 2; ch++) body[2*(L-C+m)+ch] = x[2*(e-C+m)+ch] * gOut + x[2*(s-C+m)+ch] * gIn; }
// 이음매 점검: 본문 끝 → 처음으로 넘어가는 표본 차이를 본문 안 이웃 표본 차이의 분포와 비교한다.
const jump = Math.abs(body[0] - body[2*(L-1)]) + Math.abs(body[1] - body[2*(L-1)+1]);
const diffs = []; for (let i = 1; i < L; i += 97) diffs.push(Math.abs(body[2*i]-body[2*(i-1)]) + Math.abs(body[2*i+1]-body[2*(i-1)+1])); diffs.sort((a,b)=>a-b);
const pct = diffs.findIndex(v => v >= jump) / diffs.length;
const file3 = new Float32Array((L + 2*M) * 2);
file3.set(body.subarray(2*(L-M)), 0); file3.set(body, 2*M); file3.set(body.subarray(0, 2*M), 2*(M+L));
const tmp = out + '.f32'; fs.writeFileSync(tmp, Buffer.from(body.buffer));
const meas = spawnSync('ffmpeg', ['-nostats','-f','f32le','-ar',String(SR),'-ac','2','-i',tmp,'-af','ebur128=peak=true','-f','null','-'], {encoding:'utf8'}).stderr;
const I = +meas.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0], peak = +meas.match(/Peak:\s+(-?[\d.]+) dBFS/g).pop().match(/-?[\d.]+/)[0];
let gainDb = +targetLufs - I; if (peak + gainDb > -1) gainDb = -1 - peak;   // 봉우리는 -1 dBFS 아래로
fs.writeFileSync(tmp, Buffer.from(file3.buffer));
execFileSync('ffmpeg', ['-v','error','-y','-f','f32le','-ar',String(SR),'-ac','2','-i',tmp,'-af','volume='+gainDb.toFixed(2)+'dB','-c:a','libmp3lame','-b:a','160k','-map_metadata','-1',out]);
fs.unlinkSync(tmp);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
console.log(JSON.stringify({source: file.split('/').pop(), sourceSHA256: sha(file), start: +(s/SR).toFixed(4), end: +(e/SR).toFixed(4), length: +(L/SR).toFixed(4), shiftMs: +(bestD/SR*1000).toFixed(2), ncc: +bestC.toFixed(3), seamJumpPercentile: +pct.toFixed(3), measuredLufs: I, gainDb: +gainDb.toFixed(2), loopStart: 1, loopEnd: +(1 + L/SR).toFixed(6), file: out.split('/').pop(), bytes: fs.statSync(out).size, sha256: sha(out)}));
