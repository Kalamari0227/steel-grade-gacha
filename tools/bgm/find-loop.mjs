// 이음매 없는 반복 구간 찾기: 특징(크로마 12 + 대역 에너지 16)의 자기 유사도 대각선을 4초 창으로 평균해 가장 닮은 (시작, 길이)를 고른다.
import {execFileSync} from 'node:child_process';
const [file, minS = '45', maxS = '95'] = process.argv.slice(2);
const SR = 22050, N = 2048, HOP = 512, FR = SR / HOP;
const b = execFileSync('ffmpeg', ['-v','error','-i',file,'-ac','1','-ar',String(SR),'-f','f32le','-'], {maxBuffer: 1 << 29});
const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
function fft(re, im) { const n = re.length; for (let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];} }
  for (let len=2; len<=n; len<<=1){ const a=-2*Math.PI/len, wr=Math.cos(a), wi=Math.sin(a); for(let i=0;i<n;i+=len){ let cr=1,ci=0; for(let k=0;k<len/2;k++){ const p=i+k,q=p+len/2, vr=re[q]*cr-im[q]*ci, vi=re[q]*ci+im[q]*cr; re[q]=re[p]-vr; im[q]=im[p]-vi; re[p]+=vr; im[p]+=vi; const t=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=t; } } } }
const win = Float64Array.from({length:N}, (_,i)=>0.5-0.5*Math.cos(2*Math.PI*i/N));
const bandEdges = Array.from({length:17}, (_,i)=>Math.round(40*Math.pow(8000/40, i/16)*N/SR));
const pcOf = new Int8Array(N/2).fill(-1); for (let k=1;k<N/2;k++){ const hz=k*SR/N; if(hz>=60&&hz<=4000) pcOf[k]=((Math.round(69+12*Math.log2(hz/440))%12)+12)%12; }
const D = 28, frames = Math.floor((x.length - N) / HOP), F = new Float32Array(frames * D);
const re = new Float64Array(N), im = new Float64Array(N);
for (let f=0; f<frames; f++) {
  re.fill(0); im.fill(0); for (let i=0;i<N;i++) re[i]=x[f*HOP+i]*win[i]; fft(re,im);
  const v = new Float64Array(D);
  for (let k=1;k<N/2;k++){ const p=re[k]*re[k]+im[k]*im[k]; if(pcOf[k]>=0) v[pcOf[k]]+=p; }
  for (let bnd=0;bnd<16;bnd++){ let e=0; for(let k=bandEdges[bnd];k<Math.max(bandEdges[bnd+1],bandEdges[bnd]+1);k++) e+=re[k]*re[k]+im[k]*im[k]; v[12+bnd]=Math.log1p(e*100); }
  let c=0; for(let i=0;i<12;i++) c+=v[i]; for(let i=0;i<12;i++) v[i]=c?Math.sqrt(v[i]/c):0;   // 크로마는 합 1의 제곱근
  let s=0; for(let i=12;i<D;i++) s+=v[i]; const m=s/16; let n2=0; for(let i=12;i<D;i++){v[i]-=m;n2+=v[i]*v[i];} n2=Math.sqrt(n2)||1; for(let i=12;i<D;i++) v[i]=v[i]/n2*0.8;
  for (let i=0;i<D;i++) F[f*D+i]=v[i];
}
const norm = new Float32Array(frames); for (let f=0;f<frames;f++){ let s=0; for(let i=0;i<D;i++) s+=F[f*D+i]**2; norm[f]=Math.sqrt(s)||1; }
// 끝(조용해지는 엔딩)과 시작(인트로)은 피한다.
const dur = x.length / SR, startMin = Math.round(12*FR), endMax = Math.round((dur - 22)*FR);
const W = Math.round(4*FR);
const best = [];
for (let L = Math.round(+minS*FR); L <= Math.round(+maxS*FR); L++) {
  const n = endMax - L - startMin; if (n <= W) continue;
  const d = new Float64Array(n);
  for (let i=0;i<n;i++){ const a=(startMin+i)*D, c=(startMin+i+L)*D; let s=0; for(let k=0;k<D;k++) s+=F[a+k]*F[c+k]; d[i]=s/(norm[startMin+i]*norm[startMin+i+L]); }
  let run=0; for(let i=0;i<W;i++) run+=d[i];
  for (let i=W; i<n; i++) { const centre = startMin + i - W/2; const score = run / W; best.push([score, centre, L]); run += d[i] - d[i-W]; }
}
best.sort((a,b)=>b[0]-a[0]);
const picked = []; for (const r of best) { if (picked.every(p => Math.abs(p[1]-r[1]) > 3*FR || Math.abs(p[2]-r[2]) > 3*FR)) picked.push(r); if (picked.length >= 6) break; }
console.log(JSON.stringify(picked.map(([s,c,L]) => ({score:+s.toFixed(4), start:+(c/FR).toFixed(3), length:+(L/FR).toFixed(3)}))));
