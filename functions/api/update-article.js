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
        const { admin_email, article_id, title, slug, category, popular, description, image, tags, content } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        const admin = await db.prepare("SELECT role, name FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        const oldArticle = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(article_id).first();
        if (!oldArticle) {
            return new Response(JSON.stringify({ success: false, error: 'Artikel tidak ditemukan di database' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const headers = { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' };
        const mdFiles = await getMarkdownFilesFromGithub(`https://api.github.com/repos/${githubRepo}/contents/_posts`, headers);
        
        const targetFile = mdFiles.find(f => f.name.includes(oldArticle.slug));

        if (!targetFile) {
            return new Response(JSON.stringify({ success: false, error: 'File Markdown fisik tidak ditemukan di repository GitHub' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const rawCategory = category.split(',')[0].trim();
        const catSlug = rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ? OR name = ?").bind(catSlug, rawCategory).first();
        let categoryId;
        if (catRecord) {
            categoryId = catRecord.id;
        } else {
            const insertRes = await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET slug=excluded.slug RETURNING id").bind(rawCategory, catSlug).first();
            categoryId = insertRes.id;
        }

        const tagsArray = tags ? tags.split(',').map(t => `"${t.trim()}"`).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.join(', ')}]\n` : '';

        const dateMatch = targetFile.name.match(/^(\d{4}-\d{2}-\d{2})/);
        const fileDatePrefix = dateMatch ? dateMatch[1] : new Date().toISOString().substring(0, 10);
        const dateStr = fileDatePrefix + ' 00:00:00 +0700';

        const markdownContent = `---
layout: content
title: "${title.replace(/"/g, '\\"')}"
author: "${admin.name || 'Admin'}"
date: ${dateStr}
categories: [${category}]
${tagsFrontmatter}image: ${image || ''}
description: "${(description || '').replace(/"/g, '\\"')}"
slug: "${slug}"
popular: "${popular || 'true'}"
---

${content}`;

        const contentBase64 = btoa(Array.from(new TextEncoder().encode(markdownContent)).map(b => String.fromCharCode(b)).join(''));

        const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${targetFile.path}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Update article: ${title}`,
                content: contentBase64,
                sha: targetFile.sha,
                branch: 'main'
            })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        await db.prepare("UPDATE articles SET title = ?, slug = ?, category_id = ?, popular = ?, description = ?, image = ?, content = ? WHERE id = ?")
            .bind(title, slug, categoryId, popular || 'true', description || '', image || '', content, article_id)
            .run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil diperbarui di GitHub dan Database' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}