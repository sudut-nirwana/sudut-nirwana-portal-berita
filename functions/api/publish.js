export async function onRequestPost(context) {
    try {
        const { title, slug, description, category, content, image, tags, author_email } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!title || !slug || !content || !category || !author_email) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const catSlug = category.toLowerCase().replace(/\s+/g, '-');
        let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ?").bind(catSlug).first();
        let categoryId;
        
        if (!catRecord) {
            const catRes = await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING id")
                .bind(category, catSlug).first();
            categoryId = catRes.id;
        } else {
            categoryId = catRecord.id;
        }

        const user = await db.prepare("SELECT id, name FROM users WHERE email = ?").bind(author_email).first();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Penulis tidak ditemukan' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        const now = new Date();
        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' +0700';
        const fileDatePrefix = now.toISOString().substring(0, 10);
        
        const tagsArray = tags ? tags.split(',').map(t => `"${t.trim()}"`).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.join(', ')}]\n` : '';

        const markdownContent = `---
layout: content
title: "${title}"
author: "${user.name}"
date: ${dateStr}
categories: [${catSlug}]
${tagsFrontmatter}image: ${image || ''}
description: "${description || ''}"
slug: "${slug}"
---

${content}`;

        const filePath = `_posts/${fileDatePrefix}-${slug}.md`;
        const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'User-Agent': 'Cloudflare-Pages-Function',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Publish article: ${title}`,
                content: btoa(unescape(encodeURIComponent(markdownContent))),
                branch: 'main'
            })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), {
                status: 502, headers: { 'Content-Type': 'application/json' }
            });
        }

        await db.prepare(`
            INSERT INTO articles (slug, title, description, image, category_id, author_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                image = excluded.image,
                category_id = excluded.category_id
        `).bind(slug, title, description || '', image || '', categoryId, user.id).run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil dipublikasikan.' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}