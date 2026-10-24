/*
  Bizim Ev — service worker
  1) Uygulama kabuğunu önbelleğe alır: uygulama çevrimdışı da açılır ve ana ekrana eklenebilir.
  2) Firebase isteklerine dokunmaz; eşitleme her zaman doğrudan sunucuyla yapılır.
  Yeni sürüm yayınlarken CACHE adını artır.
*/
const CACHE = "bizim-ev-v75";
const SHELL = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/favicon.svg", "./icons/apple-touch-icon.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
// Kitap kapakları ayrı bir önbellekte durur (sürüm değişince silinmez): liste ikinci açılışta beklemeden gelir.
const COVERS = "bizim-ev-kapak";
const COVER_HOSTS = /^(books\.google\.[a-z.]+|books\.googleusercontent\.com|covers\.openlibrary\.org)$/;

self.addEventListener("install", (e) => {
  // cache: "reload" — tarayıcının HTTP önbelleğindeki eski kopyayı değil, sunucudakini al.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== COVERS).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (COVER_HOSTS.test(url.hostname) && req.destination === "image") {
    e.respondWith(
      caches.open(COVERS).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") {
            c.put(req, res.clone());
            c.keys().then((ks) => ks.slice(0, Math.max(0, ks.length - 80)).forEach((k) => c.delete(k)));
          }
          return res;
        }))
      )
    );
    return;
  }
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return; // Firebase ve diğerleri: dokunma

  // Sayfanın kendisi: önce ağ (yeni sürüm gelsin), olmazsa önbellek.
  // GitHub Pages sayfayı 10 dk önbelleğe aldırıyor; "no-cache" ile her açılışta sunucuya sorulur.
  if (req.mode === "navigate" || (sameOrigin && url.pathname.endsWith("/index.html"))) {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
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
