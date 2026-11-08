// Service worker for the menu page (scope "/").
// It precaches the menu and the four notebooks, so one home-screen icon opens everything offline.
// Each notebook also has its own service worker; a notebook's own (narrower) scope wins once it is installed.
const PREFIX = "hub-";
const VERSION = "1d3bbd1083b3";
const CACHE = PREFIX + VERSION;
const FONT_CACHE = "study-fonts";
const BOOKS = ["/ai-basics-study/", "/claude-code-study/", "/codex-study/", "/grok-bot-study/"];
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", ...BOOKS];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Cache the notebooks one by one, so a single failure does not block the menu from installing.
      .then((c) => c.addAll(SHELL.filter((u) => !BOOKS.includes(u))).then(() => Promise.all(BOOKS.map((u) => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // Only remove this menu's old caches: the notebooks share the same cache storage.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// "/codex-study/index.html" and "/codex-study/" are the same page.
const pageKey = (url) => url.pathname.replace(/index\.html$/, "");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: network first (to get updates), fall back to the cached copy offline.
  if (req.mode === "navigate") {
    const key = pageKey(url);
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; })
        .catch(() => caches.open(CACHE).then((c) => c.match(key)).then((hit) => hit || caches.match(key)))
    );
    return;
  }

  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)));
});
