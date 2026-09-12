export async function onRequestPost(context) {
    try {
        const subscription = await context.request.json();
        const db = context.env.DB;

        // Validasi struktur data dari browser PushManager
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Data subscription tidak lengkap' 
            }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Simpan ke D1 (jika endpoint sudah ada, perbarui kuncinya)
        await db.prepare(`
            INSERT INTO push_subscriptions (endpoint, p256dh, auth) 
            VALUES (?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET 
                p256dh = excluded.p256dh, 
                auth = excluded.auth
        `).bind(
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth
        ).run();

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Berhasil menyimpan langganan notifikasi!' 
        }), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (err) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: err.message 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}