// 8단계: prepare.mjs가 만든 manifest·서비스 워커와 설치 판별(원본 pwa_body.txt와 같은 정규식) 시험.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {detect} from '../src/installview.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '../public');
const root = path.resolve(here, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sw = fs.readFileSync(path.join(pub, 'sw.mjs'), 'utf8');
function swConstants() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(sw.split('\n').filter(l => /^const SC_(BUILD|SHELL|TOON)=/.test(l)).join('\n') + ';this.out={SC_BUILD,SC_SHELL,SC_TOON};', context);
  return context.out;
}
function files(dir, prefix = '') {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name), prefix + e.name + '/') : [prefix + e.name]);
}

test('manifest: 이름 스틸 컴패니언, 승인 아이콘(icon:192·512)만, 같은 폴더 범위', () => {
  const m = JSON.parse(fs.readFileSync(path.join(pub, 'manifest.json'), 'utf8'));
  assert.equal(m.name, '스틸 컴패니언'); assert.equal(m.short_name, '스틸 컴패니언');
  assert.equal(m.start_url, './'); assert.equal(m.scope, './'); assert.equal(m.display, 'standalone');
  const art = JSON.parse(fs.readFileSync(path.join(root, 'current/artwork.json'), 'utf8'));
  const approved = new Map();
  const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (/^icon:(180|192|512)$/.test(o.id || '') && o.status === 'approved') approved.set(o.id, o.sha256); Object.values(o).forEach(walk); } };
  walk(art);
  assert.deepEqual(m.icons.map(i => i.src), ['art/' + approved.get('icon:192') + '.png', 'art/' + approved.get('icon:512') + '.png']);
  for (const icon of m.icons) assert.equal(sha(fs.readFileSync(path.join(pub, icon.src))), icon.src.slice(4, 68));
  const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  assert.ok(html.includes('href="./art/' + approved.get('icon:180') + '.png"'));
  assert.ok(!html.includes('체험판'));
});

// 2026-11-22: 배경음악(bgm/)은 탭에 들어갈 때 받으므로 뼈대에서 뺀다(사용자 결정, qa/bgm.test.mjs). 기대 목록에서 bgm/만 더 뺐다.
test('서비스 워커 뼈대: art·webtoon·bgm을 뺀 public 파일 전부 + 아이콘 셋, 바이트·SHA가 실제 파일과 같다', () => {
  const {SC_BUILD, SC_SHELL, SC_TOON} = swConstants();
  const expected = files(pub).filter(f => !f.startsWith('art/') && !f.startsWith('webtoon/') && !f.startsWith('bgm/') && f !== 'sw.mjs');
  const listed = SC_SHELL.map(r => r.path);
  for (const f of expected) assert.ok(listed.includes(f), f);
  assert.ok(listed.every(p => !p.startsWith('bgm/')));
  assert.equal(listed.filter(p => p.startsWith('art/')).length, 3);
  for (const r of SC_SHELL) {
    const bytes = fs.readFileSync(path.join(pub, r.path));
    assert.equal(bytes.length, r.bytes, r.path); assert.equal(sha(bytes), r.sha256, r.path);
  }
  assert.equal(SC_BUILD, sha(JSON.stringify(SC_SHELL)));
  const total = SC_SHELL.reduce((s, r) => s + r.bytes, 0);
  assert.ok(total < 8 * 1024 * 1024, '뼈대는 수 MB: ' + total);
  assert.equal(Object.keys(SC_TOON).length, 64);
  for (const [p, h] of Object.entries(SC_TOON)) assert.equal(sha(fs.readFileSync(path.join(pub, p))), h, p);
});

test('서비스 워커는 자기 캐시(steel-companion-)만 지우고 이전 게임 캐시 이름을 다루지 않는다', () => {
  const body = sw.slice(sw.indexOf("'use strict';"));
  assert.ok(body.includes("const SHELL_PREFIX = 'steel-companion-shell-';"));
  assert.ok(body.includes("const ART = 'steel-companion-art-v1';"));
  assert.ok(!/caches\.delete\((?!SHELL\)|name\)|clean\))/.test(body));
  assert.ok(body.includes('if (name.startsWith(SHELL_PREFIX) && name !== SHELL) await caches.delete(name);'));
  assert.ok(!body.includes("sgg-game-cache-'") && !/caches\.open\(['"]sgg/.test(body));
  assert.ok(!sw.includes('innerHTML'));
});

test('설치 판별: 원본과 같은 정규식(아이폰·아이패드 맥 위장·안드로이드·앱 안 브라우저·사파리 아닌 아이폰 브라우저)', () => {
  const tpl = fs.readFileSync(path.join(root, 'src/pwa_body.txt'), 'utf8');
  const mine = fs.readFileSync(path.join(here, '../src/installview.mjs'), 'utf8');
  for (const re of ['/iPad|iPhone|iPod/', '/Android/i', '/KAKAOTALK|Teams|MSTeams|NAVER|Line\\/|band|DaumApps|Instagram|FB_IAB|FBAN|FBAV|everytime/i', '/CriOS|FxiOS|EdgiOS|Whale/i'])
    assert.ok(tpl.includes(re) && mine.includes(re), re);
  const win = standalone => ({matchMedia: q => ({matches: standalone && q.includes('standalone')})});
  const d = (ua, extra = {}, standalone = false) => detect({userAgent: ua, maxTouchPoints: 0, ...extra}, win(standalone));
  assert.deepEqual(d('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1'), {standalone: false, isIOS: true, isAndroid: false, inApp: false, iosOther: false});
  assert.equal(d('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', {maxTouchPoints: 5}).isIOS, true);
  assert.equal(d('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15').isIOS, false);
  assert.equal(d('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) CriOS/124.0').iosOther, true);
  assert.equal(d('Mozilla/5.0 (Linux; Android 14) Chrome/124 KAKAOTALK 10.6.5').inApp, true);
  assert.equal(d('Mozilla/5.0 (Linux; Android 14) Chrome/124').isAndroid, true);
  assert.equal(d('x', {}, true).standalone, true);
  assert.equal(d('x', {standalone: true}).standalone, true);
});
