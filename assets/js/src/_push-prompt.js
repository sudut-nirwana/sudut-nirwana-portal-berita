(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      if (Notification.permission === 'granted' || Notification.permission === 'denied') {
          return;
      }

      // 1. Daftarkan Service Worker di awal secara background (tidak butuh sentuhan)
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
          console.error('Gagal register SW:', err);
      });

      const triggerPushPrompt = async () => {
          try {
              // 2. Langsung minta izin begitu layar disentuh (tanpa jeda await di atasnya)
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return;

              // 3. Ambil registration yang sudah siap, lalu subscribe
              const registration = await navigator.serviceWorker.ready;
              const publicKey = 'BABbAwx9bihj77MmLQbrpj4hKha6NU6vtTyhkTUiNfzV-An8a3KZ1MEnXKYdohRZEGu--Qj6Os8mzGt-ur7ETjM';
              const convertedKey = urlBase64ToUint8Array(publicKey);
              
              const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: convertedKey
              });

              // 4. Kirim ke database D1
              await fetch('/api/save-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(subscription.toJSON())
              });
          } catch (err) {
              console.error('Gagal menginisialisasi push notification:', err);
          }
      };

      // Picu sekali saja pada sentuhan atau klik pertama di layar
      window.addEventListener('click', triggerPushPrompt, { once: true });
      window.addEventListener('touchstart', triggerPushPrompt, { once: true });
  });

  function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }
})();