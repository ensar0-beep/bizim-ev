/*
  Bizim Ev — service worker
  1) Uygulama kabuğunu önbelleğe alır: uygulama çevrimdışı da açılır ve ana ekrana eklenebilir.
  2) Firebase isteklerine dokunmaz; eşitleme her zaman doğrudan sunucuyla yapılır.
  Yeni sürüm yayınlarken CACHE adını artır.
*/
const CACHE = "bizim-ev-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/favicon.svg", "./icons/apple-touch-icon.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return; // Firebase ve diğerleri: dokunma

  // Sayfanın kendisi: önce ağ (yeni sürüm gelsin), olmazsa önbellek.
  if (req.mode === "navigate" || (sameOrigin && url.pathname.endsWith("/index.html"))) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Simgeler, manifest, yazı tipleri: önce önbellek, arkada güncelle.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
