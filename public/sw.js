const CACHE_NAME = 'celengan-v2';
const STATIC_CACHE = 'celengan-static-v2';
const DYNAMIC_CACHE = 'celengan-dynamic-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Celengan SW v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
        return res;
      }).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|css|js)$/) || url.hostname.includes('fonts')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(DYNAMIC_CACHE).then((c) => { c.put(request, clone); trimCache(DYNAMIC_CACHE, 30); });
      }
      return res;
    }).catch(() => caches.match(request))
  );
});

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) { await cache.delete(keys[0]); trimCache(cacheName, maxItems); }
}

self.addEventListener('push', (event) => {
  let data = { title: 'Celengan Digital', body: 'Waktunya menabung untuk masa depanmu! 💰', tag: 'celengan-reminder', data: { url: '/' } };
  if (event.data) { try { Object.assign(data, event.data.json()); } catch { data.body = event.data.text(); } }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: '/icon-192.png', badge: '/icon-192.png',
      tag: data.tag, data: data.data, vibrate: [200, 100, 200],
      actions: [{ action: 'open', title: '💰 Buka App' }, { action: 'dismiss', title: 'Nanti saja' }]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) { if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type } = event.data;

  if (type === 'SCHEDULE_NOTIFICATION') {
    const { delay = 5000, title, body, tag, goalName } = event.data;
    setTimeout(() => {
      const notifBody = body || (goalName ? `Yuk nabung untuk ${goalName}! ` : 'Jangan lupa menabung hari ini!');
      self.registration.showNotification(title || 'Celengan Digital', {
        body: notifBody, icon: '/icon-192.png', badge: '/icon-192.png',
        tag: tag || 'celengan-scheduled', vibrate: [200, 100, 200], data: { url: '/' },
        actions: [{ action: 'open', title: '💰 Buka App' }, { action: 'dismiss', title: 'Nanti saja' }]
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
    self.registration.showNotification('Notifikasi Aktif!', {
      body: 'Pengingat menabung berhasil diaktifkan. Nabung terus ya!',
      icon: '/icon-192.png', badge: '/icon-192.png', tag: 'celengan-test', vibrate: [300, 100, 300], data: { url: '/' }
    });
  }
});

function scheduleDailyNotif(hour, minute, title, body) {
  if (self._reminderInterval) clearInterval(self._reminderInterval);
  function fireIfTime() {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      self.registration.showNotification(title || 'Celengan Digital ', {
        body: body || 'Sudah menabung hari ini? Yuk sisihkan sebagian penghasilan!',
        icon: '/icon-192.png', badge: '/icon-192.png', tag: 'celengan-daily',
        vibrate: [200, 100, 200, 100, 200], data: { url: '/' },
        actions: [{ action: 'open', title: ' Nabung Sekarang' }, { action: 'dismiss', title: 'Besok saja' }]
      });
    }
  }
  self._reminderInterval = setInterval(fireIfTime, 60 * 1000);
  fireIfTime();
}
