export async function onRequestPost(context) {
    try {
        const { admin_email, email, password, name, role, slug, avatar, bio } = await context.request.json();
        
        const scriptPattern = /<script|javascript:|onerror\s*=|onload\s*=|onclick\s*=/gi;
        if (scriptPattern.test(name) || scriptPattern.test(bio) || scriptPattern.test(slug) || scriptPattern.test(email)) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const db = context.env.DB;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!email || !email.endsWith('@sudutnirwana.com')) {
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

        // Default Avatar SVG inline jika kosong agar tidak broken image
        const defaultSvgAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='100' height='100' fill='%23cbd5e0'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
        const authorAvatar = avatar || defaultSvgAvatar;

        await db.prepare("INSERT INTO users (email, password_hash, role, name, avatar) VALUES (?, ?, ?, ?, ?)")
            .bind(email, passwordHash, role || 'author', name, authorAvatar)
            .run();

        const authorSlug = (slug || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
        const authorBio = bio || '';

        const markdownContent = `---
layout: author
name: ${JSON.stringify(name || '')}
email: ${JSON.stringify(email || '')}
avatar: ${JSON.stringify(authorAvatar)}
bio: ${JSON.stringify(authorBio)}
---
`;

        const githubToken = context.env.GITHUB_TOKEN;
        const repo = context.env.GITHUB_REPO;
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

        return new Response(JSON.stringify({ success: true, message: 'Penulis baru berhasil ditambahkan.' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}