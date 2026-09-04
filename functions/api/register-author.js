export async function onRequestPost(context) {
    try {
        const { admin_email, email, password, name, role } = await context.request.json();
        const db = context.env.DB;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak. Hanya admin.' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!email.endsWith('@sudutnirwana.com')) {
            return new Response(JSON.stringify({ success: false, error: 'Email wajib menggunakan domain @sudutnirwana.com' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!password) {
            return new Response(JSON.stringify({ success: false, error: 'Password wajib diisi' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
        const passwordHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        await db.prepare("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)")
            .bind(email, passwordHash, role || 'author', name)
            .run();

        return new Response(JSON.stringify({ success: true, message: 'Penulis baru berhasil ditambahkan.' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}