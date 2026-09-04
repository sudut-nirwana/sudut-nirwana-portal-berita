export async function onRequestPost(context) {
    try {
        const { admin_email } = await context.request.json();
        const db = context.env.DB;

        if (!admin_email) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validasi hak akses admin
        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak. Bukan admin.' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        // AMBIL DATA ARTIKEL BESERTA KATEGORI (BAGIAN INI YANG SEBELUMNYA KURANG)
        const articlesQuery = await db.prepare(`
            SELECT articles.*, categories.name as category, categories.slug as cat_slug 
            FROM articles 
            LEFT JOIN categories ON articles.category_id = categories.id 
            ORDER BY articles.created_at DESC
        `).all();

        // Ambil data users dengan lengkap termasuk id
        const usersQuery = await db.prepare("SELECT id, name, email, role FROM users").all();
        
        // Ambil data comments
        const commentsQuery = await db.prepare("SELECT id, article_slug, name AS author_name, message AS content FROM comments").all();

        return new Response(JSON.stringify({
            success: true,
            articles: articlesQuery.results || [],
            users: usersQuery.results || [],
            comments: commentsQuery.results || []
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}