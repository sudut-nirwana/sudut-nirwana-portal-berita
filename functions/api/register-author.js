export async function onRequestPost(context) {
    try {
        const { admin_email, email, password, name, role, slug, avatar, bio } = await context.request.json();
        const db = context.env.DB;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak. Hanya admin.' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!email.endsWith('@sudutnirwana.com')) {
            return new Response(JSON.stringify({ success: false, error: 'Email wajib menggunakan domain @sudutnirwana.com' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!password) {
            return new Response(JSON.stringify({ success: false, error: 'Password wajib diisi' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
        const passwordHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // Simpan ke database (pastikan tabel users mendukung kolom slug, avatar, bio jika disimpan di DB)
        await db.prepare("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)")
            .bind(email, passwordHash, role || 'author', name)
            .run();

        // Sinkronisasi file profil Markdown ke GitHub (_authors/[slug].md)
        const authorSlug = slug || email.split('@')[0];
        const authorAvatar = avatar || '/assets/images/authors/default.webp';
        const authorBio = bio || '';

        const markdownContent = `---
layout: author
name: "${name}"
email: "${email}"
avatar: "${authorAvatar}"
bio: "${authorBio}"
---
`;

        const githubToken = context.env.GITHUB_TOKEN;
        const repo = context.env.GITHUB_REPO; // format: username/repo
        const path = `_authors/${authorSlug}.md`;

        const githubRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'User-Agent': 'Cloudflare-Worker',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add author profile for ${name}`,
                content: btoa(unescape(encodeURIComponent(markdownContent))),
                branch: 'main'
            })
        });

        if (!githubRes.ok) {
            const errData = await githubRes.json();
            console.error('GitHub API Error:', errData);
        }

        return new Response(JSON.stringify({ success: true, message: 'Penulis baru berhasil ditambahkan dan disinkronkan ke GitHub.' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}