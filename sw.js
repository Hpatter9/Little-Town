// Offline support for the phone (web) version: every file of the game is cached on install, and served from
// the cache first. The build stamps VERSION, so a new build replaces the old cache.
const VERSION = 'littletown-0.2.0-mukc2h8w';
const FILES = ["./","icon-192.png","icon-512.png","index.html","manifest.webmanifest","mobile.js","music/battle.ogg","music/town.ogg","panel.html","panel.js","renderer.js","strip.html","world-map.jpg"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(e.request)));
});
