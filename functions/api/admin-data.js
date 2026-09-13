export async function onRequestPost(context) {
    try {
        const { admin_email, user_email } = await context.request.json();
        const activeEmail = user_email || admin_email;
        const db = context.env.DB;

        if (!activeEmail) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validasi identitas dan role pengguna
        const user = await db.prepare("SELECT id, name, email, role, slug, avatar, bio FROM users WHERE email = ?").bind(activeEmail).first();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Pengguna tidak ditemukan.' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        let articlesQuery;
        if (user.role === 'admin') {
            // Admin melihat seluruh artikel
            articlesQuery = await db.prepare(`
                SELECT articles.*, categories.name as category, categories.slug as cat_slug 
                FROM articles 
                LEFT JOIN categories ON articles.category_id = categories.id 
                ORDER BY articles.created_at DESC
            `).all();
        } else {
            // Author HANYA melihat artikel miliknya sendiri
            articlesQuery = await db.prepare(`
                SELECT articles.*, categories.name as category, categories.slug as cat_slug 
                FROM articles 
                LEFT JOIN categories ON articles.category_id = categories.id 
                WHERE articles.author_id = ?
                ORDER BY articles.created_at DESC
            `).bind(user.id).all();
        }

        let usersList = [];
        let commentsList = [];

        // Data sensitif hanya dimuat jika role adalah Admin
        if (user.role === 'admin') {
            const usersQuery = await db.prepare("SELECT id, name, email, role, slug, avatar FROM users").all();
            const commentsQuery = await db.prepare("SELECT id, article_slug, name AS author_name, message AS content, likes, created_at FROM comments").all();
            usersList = usersQuery.results || [];
            commentsList = commentsQuery.results || [];
        }

        return new Response(JSON.stringify({
            success: true,
            user_profile: user,
            articles: articlesQuery.results || [],
            users: usersList,
            comments: commentsList
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}