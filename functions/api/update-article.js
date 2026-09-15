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

// Helper Sanitasi Isi Artikel (content)
function sanitizeArticleContent(rawContent) {
    if (!rawContent) return '';
    return rawContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
        .replace(/\son\w+\s*=\s*[^"\s>]+/gi, '')
        .replace(/href\s*=\s*(["'])javascript:.*?\1/gi, 'href="#"')
        .replace(/src\s*=\s*(["'])javascript:.*?\1/gi, '');
}

// Helper Deteksi Script Injection pada Metadata
function containsScriptPayload(str) {
    if (!str) return false;
    const pattern = /<script|javascript:|onerror\s*=|onload\s*=|onclick\s*=/gi;
    return pattern.test(str);
}

export async function onRequestPost(context) {
    try {
        const { admin_email, user_email, article_id, title, slug, category, popular, description, image, tags, content } = await context.request.json();
        
        // Deteksi Percobaan Injeksi Script di Metadata
        if (containsScriptPayload(title) || containsScriptPayload(slug) || containsScriptPayload(description) || containsScriptPayload(tags)) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const activeEmail = user_email || admin_email;
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        const user = await db.prepare("SELECT id, role, name, slug FROM users WHERE email = ?").bind(activeEmail).first();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        const oldArticle = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(article_id).first();
        if (!oldArticle) {
            return new Response(JSON.stringify({ success: false, error: 'Artikel tidak ditemukan di database' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Proteksi hak akses Author
        if (user.role !== 'admin' && oldArticle.author_id !== user.id) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        let authorSlug = user.slug;
        if (oldArticle.author_id) {
            const originalAuthor = await db.prepare("SELECT slug FROM users WHERE id = ?").bind(oldArticle.author_id).first();
            if (originalAuthor && originalAuthor.slug) {
                authorSlug = originalAuthor.slug;
            }
        }

        const headers = { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' };
        const mdFiles = await getMarkdownFilesFromGithub(`https://api.github.com/repos/${githubRepo}/contents/_posts`, headers);
        
        const targetFile = mdFiles.find(f => f.name.includes(oldArticle.slug));

        if (!targetFile) {
            return new Response(JSON.stringify({ success: false, error: 'File Markdown fisik tidak ditemukan di repository GitHub' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Sanitasi Slug & Kategori
        const cleanSlug = (slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        const rawCategory = (category || '').split(',')[0].trim();
        const catSlug = rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        let catRecord = await db.prepare("SELECT id FROM categories WHERE slug = ? OR name = ?").bind(catSlug, rawCategory).first();
        let categoryId;
        if (catRecord) {
            categoryId = catRecord.id;
        } else {
            const insertRes = await db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET slug=excluded.slug RETURNING id").bind(rawCategory, catSlug).first();
            categoryId = insertRes.id;
        }

        const tagsArray = tags ? tags.split(',').map(t => JSON.stringify(t.trim())).filter(Boolean) : [];
        const tagsFrontmatter = tagsArray.length > 0 ? `tags: [${tagsArray.join(', ')}]\n` : '';

        const dateMatch = targetFile.name.match(/^(\d{4}-\d{2}-\d{2})/);
        const fileDatePrefix = dateMatch ? dateMatch[1] : new Date().toISOString().substring(0, 10);
        const dateStr = fileDatePrefix + ' 00:00:00 +0700';

        // Sanitasi isi artikel & amankan YAML Frontmatter
        const safeContent = sanitizeArticleContent(content);

        const markdownContent = `---
layout: content
title: ${JSON.stringify(title || '')}
author: ${JSON.stringify(authorSlug || '')}
date: ${dateStr}
categories: [${category}]
${tagsFrontmatter}image: ${image || ''}
description: ${JSON.stringify(description || '')}
slug: ${JSON.stringify(cleanSlug)}
popular: "${popular || 'true'}"
---

${safeContent}`;

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

        // Hapus gambar sampul lama jika diganti (Mencegah Path Traversal)
        if (oldArticle.image && image && oldArticle.image !== image && !oldArticle.image.includes('sample.webp')) {
            const cleanOldImgPath = oldArticle.image.replace(/^\/+/, '').replace(/\.\.\//g, '');
            if (cleanOldImgPath.startsWith('assets/images/')) {
                try {
                    const getOldImg = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${cleanOldImgPath}`, { headers });
                    if (getOldImg.ok) {
                        const oldImgData = await getOldImg.json();
                        await fetch(`https://api.github.com/repos/${githubRepo}/contents/${cleanOldImgPath}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function', 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                message: `Delete old cover image: ${cleanOldImgPath}`,
                                sha: oldImgData.sha,
                                branch: 'main'
                            })
                        });
                    }
                } catch (e) {
                    console.error('Gagal menghapus gambar sampul lama:', e);
                }
            }
        }

        await db.prepare("UPDATE articles SET title = ?, slug = ?, category_id = ?, popular = ?, description = ?, image = ?, content = ? WHERE id = ?")
            .bind(title, cleanSlug, categoryId, popular || 'true', description || '', image || '', safeContent, article_id)
            .run();

        return new Response(JSON.stringify({ success: true, message: 'Artikel berhasil diperbarui di GitHub dan Database' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}