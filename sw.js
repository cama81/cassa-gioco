// Service worker della cassa: precache dell'app e funzionamento offline.
// La versione si cambia in js/version.js (APP_VERSION): ad ogni rilascio
// i dispositivi scaricano la nuova versione.
importScripts("js/version.js");
var CACHE = "cassa-" + APP_VERSION;

var ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/version.js",
  "js/products.js",
  "js/app.js",
  "vendor/jsQR.js",
  "vendor/qrcode.js",
  "fonts/baloo-2-latin-500-normal.woff2",
  "fonts/baloo-2-latin-700-normal.woff2",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache prima (veloce e offline), poi aggiorna la copia in background.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached || caches.match("index.html"); });
      return cached || net;
    })
  );
});
