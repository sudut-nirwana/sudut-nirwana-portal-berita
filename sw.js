// Listener untuk menangkap notifikasi push dari server
self.addEventListener('push', function(event) {
    let data = { 
        title: 'Sudut Nirwana', 
        body: 'Ada artikel terbaru yang diterbitkan!', 
        url: 'https://sudutnirwana.com' 
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: data.url || 'https://sudutnirwana.com' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Listener saat pengguna mengklik notifikasi
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = event.notification.data?.url || 'https://sudutnirwana.com';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});