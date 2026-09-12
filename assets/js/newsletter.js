document.addEventListener('DOMContentLoaded', () => {
    const sbForm = document.getElementById('sidebarNewsletterForm');
    const unsubForm = document.getElementById('sidebarUnsubscribeForm');
    const toggleLink = document.getElementById('toggleUnsubscribe');
    const msgEl = document.getElementById('newsletterMsg');

    if (toggleLink) {
        toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (sbForm.style.display !== 'none') {
                sbForm.style.display = 'none';
                unsubForm.style.display = 'flex';
                toggleLink.innerText = 'Kembali ke Berlangganan';
            } else {
                sbForm.style.display = 'flex';
                unsubForm.style.display = 'none';
                toggleLink.innerText = 'Ingin berhenti berlangganan?';
            }
            msgEl.style.display = 'none';
        });
    }

    if (sbForm) {
        sbForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Panggil fungsi push notification di awal klik tombol
            const publicKey = 'BABbAwx9bihj77MmLQbrpj4hKha6NU6vtTyhkTUiNfzV-An8a3KZ1MEnXKYdohRZEGu--Qj6Os8mzGt-ur7ETjM';
            initPushNotification(publicKey);

            const email = document.getElementById('sidebarEmail').value;
            try {
                const res = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                msgEl.style.display = 'block';
                if (data.success) {
                    msgEl.style.color = 'green';
                    msgEl.innerText = 'Berhasil berlangganan email & notifikasi!';
                    sbForm.reset();
                } else {
                    msgEl.style.color = 'red';
                    msgEl.innerText = data.error || 'Gagal mendaftar.';
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    if (unsubForm) {
        unsubForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('sidebarUnsubscribeEmail').value;
            try {
                const res = await fetch('/api/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                msgEl.style.display = 'block';
                if (data.success) {
                    msgEl.style.color = 'green';
                    msgEl.innerText = 'Berhasil berhenti berlangganan.';
                    unsubForm.reset();
                } else {
                    msgEl.style.color = 'red';
                    msgEl.innerText = data.error || 'Gagal memproses.';
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
});

async function initPushNotification(vapidPublicKey) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        // PERBAIKAN UTAMA: Minta izin SEKETIKA di baris paling atas sebelum proses await apa pun
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
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
        console.error('Gagal mendaftarkan push:', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}