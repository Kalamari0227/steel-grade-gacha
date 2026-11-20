/* 스틸 컴패니언 서비스 워커(8단계, 2026-11-20 결정: 뼈대 + 본 그림만).
   prepare.mjs가 SC_BUILD(뼈대 목록의 SHA)·SC_SHELL(경로·바이트·SHA256)·SC_TOON(웹툰 그림 SHA256)을 앞에 붙여 public/sw.mjs로 쓴다.
   - 뼈대(화면 코드·자료·글꼴·소리·아이콘, 수 MB)는 설치 때 무결성을 확인하며 미리 받는다. 하나라도 틀리면 설치하지 않는다(원본과 같다).
   - 그림(art/)은 한 번 본 것만 따로 둔다. 파일 이름이 내용의 SHA256이라 받은 바이트로 확인한 뒤에만 저장한다.
   - 웹툰 그림(webtoon/)은 승인 기록의 SHA256으로 확인한 뒤에만 저장한다.
   - 캐시 이름은 steel-companion-로 시작한다. 이전 게임의 sgg-game-cache-·steel-grade-gacha- 캐시는 읽지도 지우지도 않는다(같은 출처). */
'use strict';
const SHELL_PREFIX = 'steel-companion-shell-';
const SHELL = SHELL_PREFIX + SC_BUILD;
const ART = 'steel-companion-art-v1';
const absolute = name => new URL(name, self.registration.scope).href;
const shellRows = new Map(SC_SHELL.map(row => [absolute(row.path), row]));
const toonRows = new Map(Object.entries(SC_TOON).map(([path, sha]) => [absolute(path), sha]));
async function digest(response) {
  const bytes = await response.clone().arrayBuffer();
  return {bytes: bytes.byteLength, sha: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')};
}
async function verified(response, sha, size) {
  if (!response || !response.ok || response.type === 'opaque') throw Error('Invalid response');
  const d = await digest(response);
  if (d.sha !== sha || (size !== undefined && d.bytes !== size)) throw Error('Integrity mismatch');
  return response;
}
// art/<sha256>.<ext>: 이름이 곧 확인 값이다.
function artSha(url) {
  const m = /\/art\/([a-f0-9]{64})\.(webp|png|jpg)$/.exec(new URL(url).pathname);
  return m ? m[1] : null;
}
async function windows() {
  return (await self.clients.matchAll({type: 'window', includeUncontrolled: true})).filter(c => c.url.startsWith(self.registration.scope));
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL);
  try {
    for (const row of SC_SHELL) {
      const response = await verified(await fetch(absolute(row.path), {cache: 'no-store'}), row.sha256, row.bytes);
      await cache.put(absolute(row.path), response);
    }
  } catch (error) {
    await caches.delete(SHELL);
    throw error;
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith(SHELL_PREFIX) && name !== SHELL) await caches.delete(name);
  await self.clients.claim();
})()));
// 새 버전 적용: 이 창 하나만 열려 있을 때만 바꾼다(다른 창이 옛 화면 코드로 돌고 있으면 섞이지 않게).
// 서비스 워커가 화면을 맡기 전에 이미 받은 그림(첫 방문)은 이 경로를 거치지 않았다. 화면이 그 목록을 보내면 같은 확인을 거쳐 저장한다.
async function remember(href) {
  const url = new URL(href, self.registration.scope), clean = url.origin + url.pathname;
  if (url.origin !== self.location.origin) return;
  const sha = artSha(clean) || toonRows.get(clean);
  if (!sha) return;
  const cache = await caches.open(ART);
  if (await cache.match(clean)) return;
  try { await cache.put(clean, await verified(await fetch(clean), sha)); } catch { /* 연결 끊김·확인 실패는 건너뛴다 */ }
}
self.addEventListener('message', event => {
  if (event.data?.type === 'SC_SEEN' && Array.isArray(event.data.urls)) {
    event.waitUntil(Promise.all(event.data.urls.slice(0, 200).map(remember)));
    return;
  }
  if (event.data?.type !== 'SC_ACTIVATE') return;
  event.waitUntil((async () => {
    const live = await windows();
    const alone = live.length === 1 && live[0].id === event.source?.id;
    event.source?.postMessage({type: alone ? 'SC_UPDATE_ACCEPTED' : 'SC_UPDATE_BUSY'});
    if (alone) await self.skipWaiting();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    // 화면은 뼈대의 index.html로 연다(뼈대와 같은 판). 없으면 네트워크.
    event.respondWith((async () => (await (await caches.open(SHELL)).match(absolute('index.html'))) || fetch(request))());
    return;
  }
  const clean = url.origin + url.pathname;
  if (shellRows.has(clean)) {
    event.respondWith((async () => (await (await caches.open(SHELL)).match(clean)) || fetch(request))());
    return;
  }
  const sha = artSha(clean) || toonRows.get(clean);
  if (!sha) return;
  event.respondWith((async () => {
    const cache = await caches.open(ART), cached = await cache.match(clean);
    if (cached) {
      try { return await verified(cached, sha); } catch { await cache.delete(clean); }
    }
    const response = await fetch(request);
    try { await cache.put(clean, (await verified(response, sha)).clone()); } catch { /* 확인 실패·저장 공간 부족: 이번 응답만 쓰고 저장하지 않는다 */ }
    return response;
  })());
});
