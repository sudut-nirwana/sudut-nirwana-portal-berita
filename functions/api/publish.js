function isDangerousPath(str) {
    if (!str || typeof str !== 'string') return false;
    return str.includes('..') || str.includes('\0');
}

function sanitizeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, 'data-forbidden=');
}

export async function onRequestPost(context) {
    try {
        const rawJson = await context.request.json();
        const { title, slug, description, category, popular, content, image, tags, author_email, user_email } = rawJson;
        
        const activeEmail = (author_email || user_email || '').trim().toLowerCase();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!title || !slug || !content || !category || !activeEmail) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (isDangerousPath(slug) || isDangerousPath(category)) {
            return new Response(JSON.stringify({ success: false, error: 'Input tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        
        const rawCategory = category.split(',')[0].trim().replace(/[^a-zA-Z0-9\s-]/g, '');
        const catSlug = rawCategory.toLowerCase().replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
        const categoryName = rawCategory;

        if (!safeSlug || !catSlug) {
            return new Response(JSON.stringify({ success: false, error: 'Slug atau kategori tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const cleanTitle = sanitizeHtml(title);
        const cleanDescription = sanitizeHtml(description || '');
        const cleanContent = sanitizeHtml(content);

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

        const tagsArray = tags ? tags.split(',').map(t => t.trim().replace(/[^a-zA-Z0-9\s-]/g, '')).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.map(t => JSON.stringify(t)).join(', ')}]\n` : '';
        const tagsStr = tagsArray.join(', ');

        const markdownContent = `---
layout: content
title: ${JSON.stringify(cleanTitle)}
author: ${JSON.stringify(user.slug)}
date: ${dateStr}
categories: [${JSON.stringify(categoryName)}]
${tagsFrontmatter}image: ${JSON.stringify(image || '')}
description: ${JSON.stringify(cleanDescription)}
slug: ${JSON.stringify(safeSlug)}
popular: ${JSON.stringify(popular || 'true')}
---

${cleanContent}`;

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
            body: JSON.stringify({ message: `Publish: ${cleanTitle} in ${catSlug}`, content: contentBase64, branch: 'main' })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

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
        .bind(safeSlug, cleanTitle, cleanDescription, image || '', popular || 'true', tagsStr, categoryId, user.id, cleanContent).run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil dipublikasikan ke subfolder GitHub.' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}