const CACHE_NAME = "rere-drum-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",

  // Icon & logo
  "./logo.png",
  "./logo_screen.png",
  "./icon-192.png",
  "./icon-512.png",

  // Images
  "./assets/images/crash_cymbal.png",
  "./assets/images/ride_cymbal.png",
  "./assets/images/tom_drum.png",
  "./assets/images/snare_drum.png",
  "./assets/images/hi-hat_closed.png",
  "./assets/images/hi-hat_open.png",
  "./assets/images/floor_tom.png",
  "./assets/images/bass_kick.png",

  // Sounds
  "./assets/sounds/crash.mp3",
  "./assets/sounds/ride.mp3",
  "./assets/sounds/tom.mp3",
  "./assets/sounds/snare.mp3",
  "./assets/sounds/floor_tom.mp3",
  "./assets/sounds/kick.mp3",
  "./assets/sounds/hihat_open.mp3",
  "./assets/sounds/hihat_closed.mp3"
];


// =====================================================
// INSTALL
// =====================================================

self.addEventListener("install", event => {

  console.log("Rere Drum Service Worker: INSTALL");

  event.waitUntil(

    caches.open(CACHE_NAME).then(async cache => {

      for (const asset of ASSETS) {

        try {

          await cache.add(asset);

          console.log("Berhasil cache:", asset);

        } catch (error) {

          console.warn("Gagal cache:", asset);

        }

      }

    })

  );

  // Langsung aktif tanpa menunggu tab lama ditutup
  self.skipWaiting();

});


// =====================================================
// ACTIVATE
// =====================================================

self.addEventListener("activate", event => {

  console.log("Rere Drum Service Worker: ACTIVATE");

  event.waitUntil(

    caches.keys().then(cacheNames => {

      return Promise.all(

        cacheNames.map(cacheName => {

          if (cacheName !== CACHE_NAME) {

            console.log("Menghapus cache lama:", cacheName);

            return caches.delete(cacheName);

          }

        })

      );

    })

  );

  // Mengambil kontrol halaman yang sedang terbuka
  self.clients.claim();

});


// =====================================================
// FETCH
// =====================================================

self.addEventListener("fetch", event => {

  // Hanya menangani request GET
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(

    fetch(event.request)

      .then(response => {

        // Jika internet berhasil,
        // simpan versi terbaru ke cache.

        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {

          const responseClone = response.clone();

          caches.open(CACHE_NAME).then(cache => {

            cache.put(event.request, responseClone);

          });

        }

        return response;

      })

      .catch(() => {

        // Kalau internet tidak tersedia,
        // ambil dari cache.

        return caches.match(event.request);

      })

  );

});


// =====================================================
// MESSAGE
// =====================================================

self.addEventListener("message", event => {

  if (event.data === "SKIP_WAITING") {

    self.skipWaiting();

  }

});
