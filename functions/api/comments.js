// Helper Escape HTML untuk Komentar
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    let slug = url.searchParams.get('slug');
    
    if (!slug) {
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Netralkan slug dari karakter aneh
    slug = slug.replace(/[^a-z0-9-/.]/gi, '');

    try {
        const { results } = await context.env.DB.prepare(
            "SELECT id, parent_id, name, message, likes, created_at FROM comments WHERE article_slug = ? ORDER BY created_at ASC"
        ).bind(slug).all();
        
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        let { slug, email, message, parent_id, subscribe } = body;
        
        // Deteksi Script Injection berbahaya di Komentar
        const scriptPattern = /<script|javascript:|onerror\s*=|onload\s*=|onclick\s*=/gi;
        if (scriptPattern.test(message) || scriptPattern.test(email) || scriptPattern.test(slug)) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        if (!slug || slug.includes('{{')) slug = 'home';
        const cleanEmail = email?.trim().toLowerCase();
        const cleanMessage = message?.trim();

        if (!slug || !cleanEmail || !cleanMessage) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return new Response(JSON.stringify({ success: false, error: 'Format email tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        if (cleanMessage.length < 3 || cleanMessage.length > 1000) {
            return new Response(JSON.stringify({ success: false, error: 'Komentar harus 3-1000 karakter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        let rawName = cleanEmail.split('@')[0];
        const cleanName = rawName.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Escape isi pesan sebelum disimpan ke DB demi keamanan Stored XSS 100%
        const safeMessage = escapeHTML(cleanMessage);
        const safeName = escapeHTML(cleanName);

        await context.env.DB.prepare(
            "INSERT INTO comments (article_slug, parent_id, name, message, likes, created_at) VALUES (?, ?, ?, ?, 0, datetime('now'))"
        ).bind(slug, parent_id || null, safeName, safeMessage).run();

        if (subscribe) {
            context.waitUntil(
                context.env.DB.prepare("INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, datetime('now'))").bind(cleanEmail).run()
            );
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPatch(context) {
    try {
        const { id } = await context.request.json();
        if (!id || typeof id !== 'number') {
            return new Response(JSON.stringify({ success: false, error: 'ID tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        await context.env.DB.prepare("UPDATE comments SET likes = likes + 1 WHERE id = ?").bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}