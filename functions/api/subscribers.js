export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM subscribers ORDER BY created_at DESC"
        ).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestDelete(context) {
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        if (!id) return new Response(JSON.stringify({ success: false, error: 'ID tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        await context.env.DB.prepare("DELETE FROM subscribers WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}