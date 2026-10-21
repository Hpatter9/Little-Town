## Playing with no connection (the phone's service worker)

The phone version now works fully offline once installed (changes "The phone's worker and snapshots"/web build; the old
one-cache-per-build rule is gone).

- **Two caches** (`src/renderer/mobile/sw.js`): the shell, `littletown-shell-<version>` (pages, scripts, manifest, small
  json; replaced whole each build, older ones deleted on activate), and `littletown-art`, kept between builds. Each art
  file is stored under `<url>?h=<hash>`, so a changed file is a new entry and an unchanged one is never fetched again.
  Activate prunes only art entries the new manifest no longer lists.
- **`art-manifest.json`** (`tools/build-web.mjs`): `{ version, art: { path: [hash, bytes, later] } }`; hash is the first
  10 hex of md5. `SHELL` (regexp) picks shell files; everything else is art. `LATER` = `backdrops/ himeko/ iso/`.
- **Install** fetches the shell and the art the first play needs (not `LATER`), missing or changed ones only. Offline,
  an install fails and the old worker keeps serving, so the update applies next time online.
- **Background download**: the page sends `'offline-start'` after the worker is ready; the worker fetches the missing
  `LATER` files four at a time and posts `{ type: 'offline-status', done, total, ready, downloading, failed? }` to the
  pages. Resumable (presence in the cache is the progress); the page re-asks every 5 s while not ready and re-kicks a
  stalled download when online.
- **Settings line** (`offlineLine()` in `mobile/mobile.ts`, in the ☰ menu above the install hint): "Ready to play
  offline ✓", or "Downloading for offline: N%" (by bytes) with a "Download now" button once it has stopped.
- `register('sw.js')` fails offline, so the status asks go through `serviceWorker.ready`, not the register promise.
- Network audit: the only runtime fetches are the game's own files and the opt-in phone alerts (ntfy, already in
  try/catch, off by default).
- Tested with Playwright at 393x852: loaded, waited for the download (1382 art files, 30.8 MB), went offline, reloaded:
  main menu, town, build panel, isometric view and lazy art (backdrop, himeko, iso) all served with no failed request.
  After a rebuild with two art files changed, an update fetched only those two plus the shell files.
