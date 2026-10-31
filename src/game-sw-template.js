/* Authored source. Build supplies the release ID and integrity-bound runtime entries. */
'use strict';
const PREFIX = 'sgg-game-cache-';
const CACHE = PREFIX + GAME_RELEASE_ID;
const META = new URL('__game_cache_complete__', self.registration.scope).href;
const absolute = name => new URL(name, self.registration.scope).href;
const owned = name => /^sgg-game-cache-[a-f0-9]{64}$/.test(name);
const entries = new Map(GAME_RELEASE_ASSETS.map(row => [absolute(row.path), row]));
async function verified(response, row) {
  if (!response || !response.ok || response.type === 'opaque' || response.headers.get('content-type')?.split(';')[0].trim() !== row.mime) throw Error('Invalid asset response');
  const bytes = await response.clone().arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (bytes.byteLength !== row.bytes || digest !== row.sha256) throw Error('Asset integrity mismatch');
  return response;
}
async function metadata(name) {
  try { return await (await (await caches.open(name)).match(META)).json(); } catch { return null; }
}
async function inventory() {
  const result = [];
  for (const name of (await caches.keys()).filter(owned)) {
    const meta = await metadata(name);
    if (meta?.releaseId === name.slice(PREFIX.length) && Array.isArray(meta.files)) result.push({name, ...meta});
  }
  return result;
}
async function windows() {
  const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
  return clients.filter(client => client.url.startsWith(self.registration.scope));
}
function inspect(client) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1500);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      const data = event.data;
      resolve(data?.type === 'GAME_CLIENT_STATE' && /^[a-f0-9]{64}$/.test(data.releaseId) ? data : null);
    };
    client.postMessage({type:'GAME_QUERY_STATE'}, [channel.port2]);
  });
}
async function prune() {
  const live = await windows(), states = await Promise.all(live.map(inspect));
  // Unresponsive/old documents may still request any previous release.
  if (states.some(state => !state)) return;
  const releases = (await inventory()).sort((a,b) => b.completed - a.completed);
  const keep = new Set([CACHE, ...states.map(state => PREFIX + state.releaseId)]);
  const previous = releases.find(row => row.name !== CACHE);
  if (previous) keep.add(previous.name);
  for (const row of releases) if (!keep.has(row.name)) await caches.delete(row.name);
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    for (const row of GAME_RELEASE_ASSETS.filter(row => row.classification === 'critical')) {
      const response = await verified(await fetch(absolute(row.path), {cache:'no-store'}), row);
      await cache.put(absolute(row.path), response);
    }
    // Only exact original comic URLs are candidates; never remove the source cache.
    const comics = GAME_RELEASE_ASSETS.filter(row => row.path.startsWith('webtoon/'));
    for (const name of await caches.keys()) {
      if (name === CACHE || !(owned(name) || /^steel-grade-gacha-v\d+$/.test(name))) continue;
      const old = await caches.open(name);
      for (const row of comics) {
        const response = await old.match(absolute(row.path));
        if (response) try { await cache.put(absolute(row.path), await verified(response, row)); } catch { /* Optional migration must not invalidate a playable shell. */ }
      }
    }
    await cache.put(META, new Response(JSON.stringify({releaseId:GAME_RELEASE_ID, completed:Date.now(), files:GAME_RELEASE_ASSETS}), {headers:{'content-type':'application/json'}}));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  if (!(await metadata(CACHE))) throw Error('Incomplete release');
  await self.clients.claim();
  await prune();
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'GAME_ACTIVATE') return;
  event.waitUntil((async () => {
    const live = await windows();
    if (!live.some(client => client.id === event.source?.id)) return;
    const states = await Promise.all(live.map(inspect));
    const ready = states.length > 0 && states.every(state => state && state.idle === true);
    event.source.postMessage({type:ready ? 'GAME_UPDATE_ACCEPTED' : 'GAME_UPDATE_BUSY', releaseId:GAME_RELEASE_ID});
    if (ready) await self.skipWaiting();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(absolute('index.html'))) || fetch(request))());
    return;
  }
  event.respondWith((async () => {
    let row = entries.get(url.href), cacheName = CACHE;
    if (!row && url.pathname.includes('/assets/game/')) {
      for (const release of await inventory()) {
        const candidate = release.files.find(file => absolute(file.path) === url.href);
        if (candidate) { row = candidate; cacheName = release.name; break; }
      }
    }
    if (!row) {
      // A missing optional resource must never receive the HTML shell.
      if (url.pathname.includes('/assets/game/') || url.pathname.includes('/webtoon/')) return new Response('Not found', {status:404, headers:{'content-type':'text/plain'}});
      return fetch(request);
    }
    const cache = await caches.open(cacheName), cached = await cache.match(url.href);
    if (cached) {
      try { return await verified(cached, row); } catch { await cache.delete(url.href); }
    }
    const response = await verified(await fetch(request), row);
    try { await cache.put(url.href, response.clone()); } catch { /* Optional quota failure still permits this network response. */ }
    return response;
  })());
});
