// ============================================================
// Celengan Digital — Service Worker v4.0
// OFFLINE-FIRST — app bisa dibuka TANPA internet setelah
// pertama kali dikunjungi, termasuk JS/CSS bundle Vite.
// ============================================================

const CACHE_VERSION  = 'v4';
const STATIC_CACHE   = `celengan-static-${CACHE_VERSION}`;   // HTML, manifest, icon
const ASSET_CACHE    = `celengan-assets-${CACHE_VERSION}`;   // JS, CSS bundle (hashed)
const FONT_CACHE     = `celengan-fonts-${CACHE_VERSION}`;    // Google Fonts
const DYNAMIC_CACHE  = `celengan-dynamic-${CACHE_VERSION}`;  // sisanya

const ALL_CACHES = [STATIC_CACHE, ASSET_CACHE, FONT_CACHE, DYNAMIC_CACHE];

// Aset inti yang di-cache saat install (non-hashed, URL stabil)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
];

// ── INSTALL ─────────────────────────────────────────────────
// Pre-cache URL stabil, lalu SW langsung aktif (skipWaiting).
self.addEventListener('install', (event) => {
  console.log('[SW v4] Install — pre-caching aset inti...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        // Satu per satu agar satu gagal tidak blokir yang lain
        await Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' }))
              .catch((e) => console.warn(`[SW] Gagal cache ${url}:`, e))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────────────────────────
// Hapus cache versi lama, klaim semua tab.
self.addEventListener('activate', (event) => {
  console.log('[SW v4] Activate — bersihkan cache lama...');
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !ALL_CACHES.includes(k))
            .map((k) => { console.log('[SW] Delete old cache:', k); return caches.delete(k); })
        )
      )
      .then(() => {
        trimCache(DYNAMIC_CACHE, 40);
        trimCache(FONT_CACHE, 20);
        return self.clients.claim();
      })
  );
});

// ── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan non-GET
  if (request.method !== 'GET') return;

  // ── Google Fonts CSS → Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // ── Google Fonts file (.woff2, dll.) → Cache-First
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // ── Origin lain yang tidak dikenal → lewat (jangan intercept)
  if (url.origin !== self.location.origin) return;

  // ── Navigasi (buka / reload halaman) → Network-First + offline fallback
  //    INI KUNCI OFFLINE: kalau gagal, balik cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // ── JS / CSS bundle Vite (nama file pakai hash, misal /assets/index-Abc.js)
  //    → Cache-First karena hash berubah setiap build baru (aman di-cache selamanya)
  if (url.pathname.startsWith('/assets/') &&
      url.pathname.match(/\.(js|css|mjs)(\?.*)?$/)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // ── Aset statis lokal lain (gambar, font lokal, svg, dll.)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|webp|gif|avif)(\?.*)?$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Semua lainnya → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ============================================================
// STRATEGI CACHING
// ============================================================

/**
 * CACHE-FIRST
 * Cek cache → kalau ada langsung balik (cepat, offline-safe).
 * Kalau tidak ada → fetch dari network & simpan.
 * Dipakai untuk: JS bundle, CSS, gambar — file yang jarang / tidak pernah berubah.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    console.warn('[SW] Cache-First offline & no cache:', request.url);
    return offlinePlaceholder(request);
  }
}

/**
 * NETWORK-FIRST (untuk navigasi)
 * Coba network → update cache → balik response.
 * Gagal (offline) → coba cache persis → fallback index.html → halaman offline.
 */
async function networkFirstNav(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    console.log('[SW] Offline navigasi — coba cache...');

    // 1. Cache persis untuk URL ini
    const exact = await cache.match(request);
    if (exact) return exact;

    // 2. Fallback ke index.html (SPA: semua route → index)
    const index = await cache.match('/index.html') ?? await cache.match('/');
    if (index) {
      console.log('[SW] Serve cached index.html (SPA fallback)');
      return index;
    }

    // 3. Belum pernah online sama sekali → halaman offline built-in
    return offlinePage();
  }
}

/**
 * STALE-WHILE-REVALIDATE
 * Balik dari cache secepatnya, update di background.
 * Kalau cache kosong → fetch langsung.
 * Dipakai untuk: font CSS, request dinamis ringan.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => cached ?? offlinePlaceholder(request));

  return cached ?? networkFetch;
}

// ── Placeholder untuk gambar saat offline ───────────────────
function offlinePlaceholder(request) {
  if (request.destination === 'image') {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
        <rect width="120" height="120" rx="12" fill="#f4f4f5"/>
        <text x="60" y="66" text-anchor="middle" font-family="sans-serif"
              font-size="12" fill="#a1a1aa">Offline</text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  return new Response('Offline', { status: 503 });
}

// ── Halaman offline built-in (first visit offline) ──────────
function offlinePage() {
  return new Response(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Celengan Digital — Offline</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100dvh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #0a0a1e; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      text-align: center; padding: 2rem; gap: 0;
    }
    .emoji {
      font-size: 72px; line-height: 1;
      animation: float 2.8s ease-in-out infinite;
      margin-bottom: 1.5rem;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-14px); }
    }
    h1 {
      font-size: clamp(1.5rem, 5vw, 2rem);
      font-weight: 900; letter-spacing: -0.03em;
      margin-bottom: 0.75rem;
    }
    p {
      font-size: 0.9rem; line-height: 1.7;
      opacity: 0.55; max-width: 300px;
      margin-bottom: 2rem;
    }
    .pill {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.45rem 1.1rem;
      background: rgba(0,220,120,0.12);
      border: 1px solid rgba(0,220,120,0.3);
      border-radius: 999px;
      font-size: 0.75rem; font-weight: 700;
      color: #00dc78; letter-spacing: 0.05em;
      text-transform: uppercase; margin-bottom: 1.25rem;
    }
    .retry {
      padding: 0.8rem 2.2rem;
      background: #00dc78; color: #0a0a1e;
      border: none; border-radius: 999px;
      font-size: 0.9rem; font-weight: 800;
      cursor: pointer; transition: opacity 0.15s, transform 0.1s;
    }
    .retry:hover  { opacity: 0.88; }
    .retry:active { transform: scale(0.96); }
    .hint {
      margin-top: 2rem; font-size: 0.72rem;
      opacity: 0.3; max-width: 260px; line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="emoji">🪙</div>
  <h1>Sedang Offline</h1>
  <p>Kamu tidak terhubung ke internet saat ini. Kunjungi app sekali saat online, lalu data akan tersimpan untuk mode offline.</p>
  <div class="pill">📶 Tidak ada koneksi</div>
  <button class="retry" onclick="location.reload()">Coba Lagi</button>
  <p class="hint">Celengan Digital akan otomatis tersedia offline setelah kamu membukanya pertama kali dengan internet.</p>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ── Trim cache agar tidak bengkak ───────────────────────────
async function trimCache(cacheName, maxItems = 50) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems);
  }
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================

self.addEventListener('push', (event) => {
  let d = { title: 'Celengan Digital', body: 'Waktunya menabung! 💰', tag: 'celengan-push', data: { url: '/' } };
  if (event.data) { try { Object.assign(d, event.data.json()); } catch { d.body = event.data.text(); } }
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body, icon: '/icon-192.png', badge: '/icon-192.png',
      tag: d.tag, data: d.data, vibrate: [200, 100, 200],
      actions: [{ action: 'open', title: '💰 Buka App' }, { action: 'dismiss', title: 'Nanti saja' }],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow?.('/');
    })
  );
});

// ============================================================
// MESSAGE HANDLER (dari app)
// ============================================================

self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type } = event.data;

  if (type === 'SCHEDULE_NOTIFICATION') {
    const { delay = 5000, title, body, tag, goalName } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'Celengan Digital', {
        body: body || (goalName ? `Yuk nabung untuk ${goalName}! 🎯` : 'Jangan lupa menabung hari ini! 💰'),
        icon: '/icon-192.png', badge: '/icon-192.png',
        tag: tag || 'celengan-scheduled', vibrate: [200, 100, 200], data: { url: '/' },
        actions: [{ action: 'open', title: '💰 Buka App' }, { action: 'dismiss', title: 'Nanti' }],
      });
    }, delay);
  }

  if (type === 'SCHEDULE_DAILY') {
    const { hour = 20, minute = 0, title, body } = event.data;
    scheduleDailyNotif(hour, minute, title, body);
  }

  if (type === 'CANCEL_REMINDERS') {
    if (self._reminderInterval) { clearInterval(self._reminderInterval); self._reminderInterval = null; }
  }

  if (type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('🎉 Notifikasi Aktif!', {
      body: 'Pengingat menabung berhasil diaktifkan. Nabung terus ya!',
      icon: '/icon-192.png', badge: '/icon-192.png', tag: 'celengan-test',
      vibrate: [300, 100, 300], data: { url: '/' },
    });
  }

  if (type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: '4.0' });
  }

  if (type === 'CACHE_URLS') {
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled((event.data.urls || []).map((u) => cache.add(u)))
    );
  }
});

function scheduleDailyNotif(hour, minute, title, body) {
  if (self._reminderInterval) clearInterval(self._reminderInterval);
  const fire = () => {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      self.registration.showNotification(title || 'Celengan Digital 💰', {
        body: body || 'Sudah menabung hari ini? Yuk sisihkan sebagian penghasilanmu!',
        icon: '/icon-192.png', badge: '/icon-192.png', tag: 'celengan-daily',
        vibrate: [200, 100, 200, 100, 200], data: { url: '/' },
        actions: [{ action: 'open', title: '💰 Nabung Sekarang' }, { action: 'dismiss', title: 'Besok' }],
      });
    }
  };
  self._reminderInterval = setInterval(fire, 60_000);
  fire();
}
