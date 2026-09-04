export async function onRequestPost(context) {
    try {
        const { title, slug, description, category, content, image, tags, author_email } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO; // format: user/repo

        if (!title || !slug || !content || !category || !author_email) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const catSlug = category.toLowerCase().replace(/\s+/g, '-');
        let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ?").bind(catSlug).first();
        let categoryId = catRecord ? catRecord.id : (await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING id").bind(category, catSlug).first()).id;

        const user = await db.prepare("SELECT id, name FROM users WHERE email = ?").bind(author_email).first();
        if (!user) return new Response(JSON.stringify({ success: false, error: 'Penulis tidak ditemukan' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

        const now = new Date();
        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' +0700';
        const fileDatePrefix = now.toISOString().substring(0, 10);
        const filePath = `_posts/${fileDatePrefix}-${slug}.md`;
        
        const tagsArray = tags ? tags.split(',').map(t => `"${t.trim()}"`).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.join(', ')}]\n` : '';

        const markdownContent = `---
layout: content
title: "${title.replace(/"/g, '\\"')}"
author: "${user.name}"
date: ${dateStr}
categories: [${catSlug}]
${tagsFrontmatter}image: ${image || ''}
description: "${(description || '').replace(/"/g, '\\"')}"
slug: "${slug}"
---

${content}`;

        // 1. CEK DUPLIKAT DI GITHUB DULU
        const checkRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' }
        });
        if (checkRes.ok) {
            return new Response(JSON.stringify({ success: false, error: `Slug "${slug}" sudah ada untuk tanggal ini.` }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. ENCODE BASE64 YG WORK DI WORKERS
        const contentBase64 = btoa(Array.from(new TextEncoder().encode(markdownContent)).map(b => String.fromCharCode(b)).join(''));

        // 3. PUSH KE GITHUB
        const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Publish: ${title}`, content: contentBase64, branch: 'main' })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        await db.prepare(`INSERT INTO articles (slug, title, description, image, category_id, author_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description, image=excluded.image, category_id=excluded.category_id`)
        .bind(slug, title, description || '', image || '', categoryId, user.id).run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil dipublikasikan.' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}