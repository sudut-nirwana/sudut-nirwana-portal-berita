export async function onRequestPost(context) {
    try {
        const { article_id, admin_email, user_email, slug } = await context.request.json();
        const activeEmail = user_email || admin_email;
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!article_id || !activeEmail) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Validasi ketat: HANYA pengguna ber-role Admin yang diizinkan menghapus
        const user = await db.prepare("SELECT role FROM users WHERE email = ?").bind(activeEmail).first();
        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak. Hanya Admin yang dapat menghapus artikel.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
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
        const targetSlug = slug || article.slug;
        const filePath = `_posts/${article.cat_slug}/${fileDatePrefix}-${targetSlug}.md`;
        const headers = { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function', 'Content-Type': 'application/json' };

        // Hapus file Markdown fisik di GitHub
        try {
            const checkRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, { headers });
            if (checkRes.ok) {
                const fileData = await checkRes.json();
                await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify({ message: `Delete article: ${article.title}`, sha: fileData.sha, branch: 'main' })
                });
            }
        } catch (e) {
            console.error('Gagal menghapus file Markdown dari GitHub:', e);
        }

        // Hapus record dari database D1
        await db.prepare("DELETE FROM articles WHERE id = ?").bind(article_id).run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil dihapus dari database dan GitHub.' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}