const CACHE_NAME = 'celengan-v1';

self.addEventListener('install', (event) => {
  console.log('SW Installed');
});

self.addEventListener('activate', (event) => {
  console.log('SW Activated');
});

self.addEventListener('fetch', (event) => {
  // basic fetch handler
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const options = {
    body: data.body || 'Waktunya menabung hari ini!',
    icon: 'https://cdn-icons-png.flaticon.com/512/2850/2850358.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/2850/2850358.png',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Celengan Digital', options)
  );
});

// For local reminders (simulated since we don't have a real push server)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { delay, title, body } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2850/2850358.png',
      });
    }, delay);
  }
});
