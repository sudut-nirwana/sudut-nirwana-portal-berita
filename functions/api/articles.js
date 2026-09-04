export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        
        // Ambil daftar artikel beserta nama kategorinya
        const { results } = await db.prepare(`
            SELECT articles.*, categories.name as category_name 
            FROM articles 
            LEFT JOIN categories ON articles.category_id = categories.id 
            ORDER BY articles.created_at DESC
        `).all();

        return new Response(JSON.stringify({ success: true, articles: results }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}