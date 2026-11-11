/* Offline support. The network is tried first so a returning player
 * always gets the current build; the cache answers when the network is
 * down or slow. That way a release can never be stranded behind an old
 * cache, whether or not VERSION was bumped. Bump VERSION anyway when the
 * asset list changes, so the old cache is dropped. Relative paths keep
 * the subpath hosting (github.io/WarGames-/) working. */
const VERSION = "wg-m9-2";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/crt.css",
  "js/sound.js",
  "js/modern.js",
  "js/terminal.js",
  "js/parser.js",
  "js/geo.js",
  "js/intro.js",
  "js/crisis.js",
  "js/wopr.js",
  "js/games/tictactoe.js",
  "js/games/cards.js",
  "js/games/checkers.js",
  "js/games/chess.js",
  "js/games/maze.js",
  "js/games/gtw.js",
  "js/engine.js",
  "js/ui.js",
  "js/main.js",
  "assets/fonts/GlassTTYVT220.woff2",
  "assets/fonts/IBMVGA8x16.woff2",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

// How long to wait on the network before answering from the cache.
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      // cache: "reload" skips the HTTP cache, so the precache is current.
      .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

// The release before M9 served everything cache-first and never
// revalidated, so a page it had already loaded would keep showing that
// old build until the visit after next. When this worker takes over from
// that one, it reloads the open pages once: players arriving with the
// old build cached are moved to the current one on that same visit.
// From M9 on the worker is network-first, so a page is already current
// when it loads and needs no reload.
const LEGACY_CACHE = "wg-m8-1";

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const fromLegacy = keys.includes(LEGACY_CACHE);
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
      if (!fromLegacy) return;
      const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const page of pages) {
        // Not awaited: a navigation that is refused must not hold up
        // activation, and the next visit is network-first regardless.
        page.navigate(page.url).catch(() => {});
      }
    })()
  );
});

function fromNetwork(request) {
  return fetch(request, { cache: "no-cache" }).then((res) => {
    // Only keep good same-origin responses; never cache an error page.
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(request, copy));
    }
    return res;
  });
}

self.addEventListener("fetch", (e) => {
  const request = e.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      const network = fromNetwork(request);
      if (!cached) return network;
      // Race the network against a timeout; fall back to the cache on
      // failure or delay, and let the late response refresh the cache.
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
      const winner = await Promise.race([network.catch(() => null), timeout]);
      if (winner && winner.ok) return winner;
      network.catch(() => {});
      return cached;
    })()
  );
});
