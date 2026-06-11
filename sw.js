/* Offline cache for the whole game. Bump VERSION on every release so the
 * new deploy replaces the old cache. Relative paths keep the subpath
 * hosting (github.io/WarGames-/) working. */
const VERSION = "wg-m8-1";
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
  "js/main.js",
  "assets/fonts/GlassTTYVT220.woff2",
  "assets/fonts/IBMVGA8x16.woff2",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(ASSETS))
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

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return res;
        })
    )
  );
});
