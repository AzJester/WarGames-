/* Offline support. The network is tried first so a returning player
 * always gets the current build; the cache answers when the network is
 * down or slow. That way a release can never be stranded behind an old
 * cache, whether or not VERSION was bumped. Bump VERSION anyway when the
 * asset list changes, so the old cache is dropped. Relative paths keep
 * the subpath hosting (github.io/WarGames-/) working. */
const VERSION = "wg-m9-1";
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

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
