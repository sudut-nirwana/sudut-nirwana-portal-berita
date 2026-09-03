export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });

    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM comments WHERE article_slug = ? ORDER BY created_at DESC"
        ).bind(slug).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    try {
        const { slug, name, message } = await context.request.json();
        if (!slug || !name || !message) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        await context.env.DB.prepare(
            "INSERT INTO comments (article_slug, name, message, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(slug, name, message).run();

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}