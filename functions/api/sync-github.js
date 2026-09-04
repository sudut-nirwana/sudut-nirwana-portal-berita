async function getMarkdownFilesFromGithub(url, headers) {
    let filesList = [];
    const res = await fetch(url, { headers });
    if (!res.ok) return filesList;

    const items = await res.json();
    if (!Array.isArray(items)) return filesList;

    for (const item of items) {
        if (item.type === 'file' && item.name.endsWith('.md')) {
            filesList.push(item);
        } else if (item.type === 'dir') {
            const subFiles = await getMarkdownFilesFromGithub(item.url, headers);
            filesList = filesList.concat(subFiles);
        }
    }
    return filesList;
}

export async function onRequestPost(context) {
    try {
        const { admin_email } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        const headers = { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' };
        const mdFiles = await getMarkdownFilesFromGithub(`https://api.github.com/repos/${githubRepo}/contents/_posts`, headers);

        let syncedCount = 0;

        for (const file of mdFiles) {
            const fileRes = await fetch(file.download_url, { headers });
            if (!fileRes.ok) continue;

            const markdownText = await fileRes.text();
            const fmMatch = markdownText.match(/^---\s*([\s\S]*?)\s*---([\s\S]*)$/);
            if (!fmMatch) continue;

            const frontMatterLines = fmMatch[1].split('\n');
            const content = fmMatch[2].trim();

            let title = '';
            let slug = '';
            let description = '';
            let image = '';
            let categoryName = 'Uncategorized';

            frontMatterLines.forEach(line => {
                const parts = line.split(':');
                if (parts.length < 2) return;
                const key = parts[0].trim();
                let val = parts.slice(1).join(':').trim().replace(/^["'](.*)["']$/, '$1');

                if (key === 'title') title = val;
                if (key === 'slug') slug = val;
                if (key === 'description') description = val;
                if (key === 'image') image = val;
                if (key === 'categories') categoryName = val.replace(/[\[\]]/g, '').trim() || 'Uncategorized';
            });

            if (!slug) {
                slug = file.name.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
            }
            if (!title) title = slug;

            const catSlug = categoryName.toLowerCase().replace(/\s+/g, '-');
            let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ?").bind(catSlug).first();
            let categoryId = catRecord ? catRecord.id : (await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING id").bind(categoryName, catSlug).first()).id;

            let author = await db.prepare("SELECT id FROM users LIMIT 1").first();
            let authorId = author ? author.id : 1;

            await db.prepare(`
                INSERT INTO articles (slug, title, description, image, category_id, author_id, content) 
                VALUES (?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(slug) DO UPDATE SET 
                    title=excluded.title, 
                    description=excluded.description, 
                    image=excluded.image, 
                    category_id=excluded.category_id,
                    content=excluded.content
            `).bind(slug, title, description, image, categoryId, authorId, content).run();

            syncedCount++;
        }

        return new Response(JSON.stringify({ success: true, message: `Berhasil menyinkronkan ${syncedCount} artikel dari seluruh subfolder GitHub.` }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}