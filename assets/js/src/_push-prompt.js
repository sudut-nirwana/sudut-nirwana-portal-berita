(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      if (Notification.permission === 'granted' || Notification.permission === 'denied') {
          return;
      }

      const triggerPushPrompt = async () => {
          try {
              const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return;

              const publicKey = 'BABbAwx9bihj77MmLQbrpj4hKha6NU6vtTyhkTUiNfzV-An8a3KZ1MEnXKYdohRZEGu--Qj6Os8mzGt-ur7ETjM';
              const convertedKey = urlBase64ToUint8Array(publicKey);
              const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: convertedKey
              });

              await fetch('/api/save-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(subscription.toJSON())
              });
          } catch (err) {
              console.error('Gagal menginisialisasi push notification:', err);
          }
      };

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