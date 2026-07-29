const CACHE_NAME = "rere-drum-v3";

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./logo.png",
  "./logo_screen.png",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/images/crash_cymbal.png",
  "./assets/images/ride_cymbal.png",
  "./assets/images/tom_drum.png",
  "./assets/images/snare_drum.png",
  "./assets/images/hi-hat_closed.png",
  "./assets/images/hi-hat_open.png",
  "./assets/images/floor_tom.png",
  "./assets/images/bass_kick.png",
  "./assets/sounds/crash.mp3",
  "./assets/sounds/ride.mp3",
  "./assets/sounds/tom.mp3",
  "./assets/sounds/snare.mp3",
  "./assets/sounds/floor_tom.mp3",
  "./assets/sounds/kick.mp3",
  "./assets/sounds/hihat_open.mp3",
  "./assets/sounds/hihat_closed.mp3"
];

// simpan semua aset ke cache begitu service worker terpasang
self.addEventListener("install", (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>{
      // addAll akan gagal semua kalau ada 1 file yang 404,
      // jadi ditangani satu-satu supaya file lain tetap ke-cache
      return Promise.all(
        urlsToCache.map(url=>
          cache.add(url).catch(err=>console.log("Gagal cache:", url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// bersihkan cache versi lama kalau ada update
self.addEventListener("activate", (event)=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

// file INTI (html/css/js/manifest) -> selalu coba ambil versi TERBARU
// dulu dari internet, biar update kode langsung kepakai. Kalau lagi
// offline, baru fallback ke versi cache.
//
// aset gambar & suara -> cache-first, karena jarang berubah dan
// biar buka lebih cepat + tetap jalan offline.
self.addEventListener("fetch", (event)=>{
  const url = event.request.url;
  const isCoreFile =
    event.request.mode === "navigate" ||
    url.endsWith(".html") ||
    url.endsWith(".css") ||
    url.endsWith(".js") ||
    url.endsWith("manifest.json");

  if(isCoreFile){
    event.respondWith(
      fetch(event.request)
        .then(res=>{
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request, resClone));
          return res;
        })
        .catch(()=>caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached=>cached || fetch(event.request))
    );
  }
});
