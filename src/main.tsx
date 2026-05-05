import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// SW registration is handled in index.html for reliability,
// but we also handle updates and messaging here.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((reg) => {
    console.log('[App] SW ready:', reg.scope);

    // Re-register daily reminder on app load (SW may have restarted)
    const saved = localStorage.getItem('celengan_settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.reminderActive && settings.notificationsEnabled && settings.reminderTime) {
          const [h, m] = settings.reminderTime.split(':').map(Number);
          reg.active?.postMessage({
            type: 'SCHEDULE_DAILY',
            hour: h,
            minute: m,
            title: 'Celengan Digital 💰',
            body: 'Sudah menabung hari ini? Yuk sisihkan sebagian penghasilanmu!'
          });
          console.log('[App] Daily reminder re-registered for', settings.reminderTime);
        }
      } catch (e) {
        console.warn('[App] Could not re-register reminder:', e);
      }
    }
  });

  // Listen for messages from SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_VERSION') {
      console.log('[App] SW version:', event.data.version);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
