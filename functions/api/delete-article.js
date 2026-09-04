export async function onRequestPost(context) {
    try {
        const { article_id, admin_email } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!article_id || !admin_email) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        const article = await db.prepare(`
            SELECT articles.*, categories.slug as cat_slug 
            FROM articles 
            LEFT JOIN categories ON articles.category_id = categories.id 
            WHERE articles.id = ?
        `).bind(article_id).first();

        if (!article) {
            return new Response(JSON.stringify({ success: false, error: 'Artikel tidak ditemukan' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const fileDatePrefix = article.created_at ? article.created_at.substring(0, 10) : '';
        const filePath = `_posts/${article.cat_slug}/${fileDatePrefix}-${article.slug}.md`;
        const headers = { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function', 'Content-Type': 'application/json' };

        const checkRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, { headers });
        if (checkRes.ok) {
            const fileData = await checkRes.json();
            await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ message: `Delete article: ${article.title}`, sha: fileData.sha, branch: 'main' })
            });
        }

        await db.prepare("DELETE FROM articles WHERE id = ?").bind(article_id).run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil dihapus.' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}