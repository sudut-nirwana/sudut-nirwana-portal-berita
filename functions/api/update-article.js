export async function onRequestPost(context) {
    try {
        const { admin_email, article_id, title, slug, category, description, image, tags, content } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        // Ambil data artikel lama dari database untuk mengetahui slug/tanggal aslinya
        const oldArticle = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(article_id).first();
        if (!oldArticle) {
            return new Response(JSON.stringify({ success: false, error: 'Artikel tidak ditemukan di database' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Cari file .md di folder _posts berdasarkan slug lama atau tanggal lama
        // Kita cari file di GitHub yang mengandung slug tersebut
        const searchRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/_posts`, {
            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' }
        });
        
        if (!searchRes.ok) {
            return new Response(JSON.stringify({ success: false, error: 'Gagal membaca folder _posts di GitHub' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        const files = await searchRes.json();
        const targetFile = files.find(f => f.name.includes(oldArticle.slug));

        if (!targetFile) {
            return new Response(JSON.stringify({ success: false, error: 'File Markdown fisik tidak ditemukan di repository GitHub' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const catSlug = category.toLowerCase().replace(/\s+/g, '-');
        let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ?").bind(catSlug).first();
        let categoryId = catRecord ? catRecord.id : (await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING id").bind(category, catSlug).first()).id;

        const tagsArray = tags ? tags.split(',').map(t => `"${t.trim()}"`).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.join(', ')}]\n` : '';

        // Pertahankan tanggal asli dari nama file atau database
        const markdownContent = `---
layout: content
title: "${title.replace(/"/g, '\\"')}"
author: "${admin.name || 'Admin'}"
date: ${targetFile.name.substring(0, 10)} 00:00:00 +0700
categories: [${catSlug}]
${tagsFrontmatter}image: ${image || ''}
description: "${(description || '').replace(/"/g, '\\"')}"
slug: "${slug}"
---

${content}`;

        const contentBase64 = btoa(Array.from(new TextEncoder().encode(markdownContent)).map(b => String.fromCharCode(b)).join(''));

        // Update file di GitHub (Butuh SHA dari file yang ada)
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

        // Update database lokal D1
        await db.prepare("UPDATE articles SET title = ?, slug = ?, category_id = ?, description = ?, image = ?, content = ? WHERE id = ?")
            .bind(title, slug, categoryId, description || '', image || '', content, article_id)
            .run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil diperbarui di GitHub dan Database' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}