// Offline support for the phone (web) version. Two caches:
//  - the shell (pages, scripts, manifest): named for the build, replaced whole on every update;
//  - the art (pictures, fonts, music): one cache kept between builds. Each file is stored under its URL plus its
//    content hash (art-manifest.json, written by tools/build-web.mjs), so an update fetches only the files that
//    changed and the rest stay where they are. Files nothing lists any more are pruned.
// Install fetches the shell and the art the first play needs; the big folders (fight backdrops, townsfolk layers,
// isometric kits) come down in the background when the page asks (message 'offline-start'), a few at a time, and
// pick up where they stopped if the phone loses signal or the page closes.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const ART = 'littletown-art';
const SCOPE = self.registration.scope;

let manifestP = null;
/** The manifest of this build ({ version, art: { path: [hash, bytes, later] } }), from the shell cache. */
const manifest = () =>
  (manifestP ??= caches
    .open(VERSION)
    .then((c) => c.match('art-manifest.json'))
    .then((r) => r.json()));
const keyOf = (path, hash) => `${SCOPE}${path}?h=${hash}`;
const haveKeys = async () => new Set((await (await caches.open(ART)).keys()).map((r) => r.url));

async function fetchArt(cache, path, hash) {
  const res = await fetch(new Request(path, { cache: 'reload' }));
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  await cache.put(keyOf(path, hash), res);
}

/** Fetches the listed files, a few at a time; each one counts when it lands. */
async function fetchAll(paths, art, onEach) {
  const cache = await caches.open(ART);
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const p = paths[next++];
      await fetchArt(cache, p, art[p][0]);
      onEach?.(p);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const shell = await caches.open(VERSION);
      await Promise.all(FILES.map(async (f) => {
        const res = await fetch(new Request(f, { cache: 'reload' }));
        if (!res.ok) throw new Error(`${f}: ${res.status}`);
        await shell.put(f === './' ? SCOPE : new URL(f, SCOPE).href, res);
      }));
      const { art } = await manifest();
      const have = await haveKeys();
      await fetchAll(Object.keys(art).filter((p) => !art[p][2] && !have.has(keyOf(p, art[p][0]))), art);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== VERSION && k !== ART) await caches.delete(k);
      const { art } = await manifest();
      const keep = new Set(Object.keys(art).map((p) => keyOf(p, art[p][0])));
      const cache = await caches.open(ART);
      for (const r of await cache.keys()) if (!keep.has(r.url)) await cache.delete(r);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    (async () => {
      const url = new URL(e.request.url);
      if (url.origin === self.location.origin) {
        const path = url.href.slice(SCOPE.length).split(/[?#]/)[0];
        const entry = (await manifest().catch(() => null))?.art[path];
        if (entry) {
          const hit = await (await caches.open(ART)).match(keyOf(path, entry[0]));
          if (hit) return hit;
        } else {
          const hit = await (await caches.open(VERSION)).match(e.request, { ignoreSearch: true });
          if (hit) return hit;
        }
      }
      return fetch(e.request);
    })(),
  );
});

/* ---- the background download, and the page's view of it */

let running = null;
async function status() {
  const { art } = await manifest();
  const have = await haveKeys();
  let bytes = 0;
  let done = 0;
  const missing = [];
  for (const p of Object.keys(art)) {
    bytes += art[p][1];
    if (have.has(keyOf(p, art[p][0]))) done += art[p][1];
    else missing.push(p);
  }
  return { done, total: bytes, missing, downloading: running !== null };
}
async function tell(extra) {
  const s = await status();
  const msg = { type: 'offline-status', done: s.done, total: s.total, ready: s.missing.length === 0, downloading: running !== null, ...extra };
  for (const c of await self.clients.matchAll()) c.postMessage(msg);
}
function download() {
  if (running) return running;
  running = (async () => {
    try {
      const { art } = await manifest();
      const { missing } = await status();
      let n = 0;
      await fetchAll(missing, art, () => ++n % 8 === 0 && void tell());
    } catch {
      // (no signal: what came down stays, and "Download now" carries on from there)
      setTimeout(() => ((running = null), tell({ failed: true })), 0);
      return;
    }
    setTimeout(() => ((running = null), tell()), 0);
  })();
  return running;
}
self.addEventListener('message', (e) => {
  if (e.data === 'offline-start') e.waitUntil(download());
  else if (e.data === 'offline-status') e.waitUntil(tell());
});
