export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT slug, views FROM article_views"
        ).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    try {
        const url = new URL(context.request.url);
        let slug = url.searchParams.get('slug');

        if (!slug) {
            try {
                const body = await context.request.json();
                slug = body.slug;
            } catch (e) {}
        }

        if (!slug) {
            return new Response(JSON.stringify({ success: false, error: 'Slug tidak ditemukan' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = context.env.DB;
        const existing = await db.prepare("SELECT views FROM article_views WHERE slug = ?").bind(slug).first();
        
        let currentViews = 1;
        if (existing) {
            currentViews = existing.views + 1;
            await db.prepare("UPDATE article_views SET views = ? WHERE slug = ?").bind(currentViews, slug).run();
        } else {
            await db.prepare("INSERT INTO article_views (slug, views) VALUES (?, 1)").bind(slug).run();
        }

        return new Response(JSON.stringify({ success: true, views: currentViews }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}