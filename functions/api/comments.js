export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });

    try {
        const { results } = await context.env.DB.prepare(
            "SELECT id, article_slug, parent_id, name, email_hash, message, likes, created_at FROM comments WHERE article_slug = ? ORDER BY created_at ASC"
        ).bind(slug).all();
        
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    try {
        const { slug, name, email, message, parent_id } = await context.request.json();
        if (!slug || !name || !email || !message) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const cleanEmail = email.trim().toLowerCase();
        
        // Hashing SHA-256 aman via WebCrypto API standar Cloudflare
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(cleanEmail);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const email_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Simpan murni ke tabel comments
        await context.env.DB.prepare(
            "INSERT INTO comments (article_slug, parent_id, name, email_hash, message, likes, created_at) VALUES (?, ?, ?, ?, ?, 0, datetime('now'))"
        ).bind(slug, parent_id || null, name.trim(), email_hash, message.trim()).run();

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPatch(context) {
    try {
        const { id } = await context.request.json();
        if (!id) return new Response(JSON.stringify({ success: false, error: 'ID tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        await context.env.DB.prepare("UPDATE comments SET likes = likes + 1 WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}