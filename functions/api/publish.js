function isDangerousPath(str) {
    if (!str || typeof str !== 'string') return false;
    // Cegah path traversal dan null byte
    return str.includes('..') || str.includes('\0');
}

export async function onRequestPost(context) {
    try {
        const { title, slug, description, category, popular, content, image, tags, author_email, user_email } = await context.request.json();
        const activeEmail = (author_email || user_email || '').trim().toLowerCase();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        // 1. VALIDASI WHITELIST & REQUIREMENT
        if (!title || !slug || !content || !category || !activeEmail) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (isDangerousPath(slug) || isDangerousPath(category)) {
            return new Response(JSON.stringify({ success: false, error: 'Input tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Sanitasi Slug Strict: a-z0-9-
        const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        
        // 3. Sanitasi Kategori
        const rawCategory = category.split(',')[0].trim().replace(/[^a-zA-Z0-9\s-]/g, '');
        const catSlug = rawCategory.toLowerCase().replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
        const categoryName = rawCategory;

        if (!safeSlug || !catSlug) {
            return new Response(JSON.stringify({ success: false, error: 'Slug atau kategori tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ? OR name = ?").bind(catSlug, categoryName).first();
        let categoryId;
        if (catRecord) {
            categoryId = catRecord.id;
        } else {
            const insertRes = await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET slug=excluded.slug RETURNING id").bind(categoryName, catSlug).first();
            categoryId = insertRes.id;
        }

        const user = await db.prepare("SELECT id, name, slug FROM users WHERE email = ?").bind(activeEmail).first();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Penulis tidak ditemukan' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        const now = new Date();
        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' +0700';
        const fileDatePrefix = now.toISOString().substring(0, 10);
        const filePath = `_posts/${catSlug}/${fileDatePrefix}-${safeSlug}.md`;

        // 4. Sanitasi Tags dengan Whitelist
        const tagsArray = tags ? tags.split(',').map(t => t.trim().replace(/[^a-zA-Z0-9\s-]/g, '')).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.map(t => JSON.stringify(t)).join(', ')}]\n` : '';
        const tagsStr = tagsArray.join(', ');

        // 5. YAML Frontmatter dengan JSON.stringify (Aman dari YAML Injection)
        const markdownContent = `---
layout: content
title: ${JSON.stringify(title)}
author: ${JSON.stringify(user.slug)}
date: ${dateStr}
categories: [${JSON.stringify(categoryName)}]
${tagsFrontmatter}image: ${JSON.stringify(image || '')}
description: ${JSON.stringify(description || '')}
slug: ${JSON.stringify(safeSlug)}
popular: ${JSON.stringify(popular || 'true')}
---

${content}`;

        const checkRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' }
        });
        if (checkRes.ok) {
            return new Response(JSON.stringify({ success: false, error: `Slug "${safeSlug}" sudah ada untuk kategori ini.` }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        const contentBase64 = btoa(Array.from(new TextEncoder().encode(markdownContent)).map(b => String.fromCharCode(b)).join(''));

        const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Publish: ${title} in ${catSlug}`, content: contentBase64, branch: 'main' })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        // 6. FIX UTAMA: 9 Placeholder (?) Sesuai Dengan 9 Parameter .bind()
        await db.prepare(`
            INSERT INTO articles (slug, title, description, image, popular, tags, category_id, author_id, content) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
            ON CONFLICT(slug) DO UPDATE SET 
                title=excluded.title, 
                description=excluded.description, 
                image=excluded.image, 
                popular=excluded.popular,
                tags=excluded.tags,
                category_id=excluded.category_id, 
                content=excluded.content
        `)
        .bind(safeSlug, title, description || '', image || '', popular || 'true', tagsStr, categoryId, user.id, content).run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil dipublikasikan ke subfolder GitHub.' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}