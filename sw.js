const CACHE_NAME = "mare-jp-v9";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "site.webmanifest",
  "tides.json",
  "pix-qr.png",
  "favicon.ico",
  "favicon.svg",
  "favicon-96x96.png",
  "apple-touch-icon.png",
  "web-app-manifest-192x192.png",
  "web-app-manifest-512x512.png",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Instalando...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Cacheando assets");
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Ativado");
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
