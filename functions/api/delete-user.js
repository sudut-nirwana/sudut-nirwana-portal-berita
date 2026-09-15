export async function onRequestPost(context) {
    try {
        const { admin_email, user_id } = await context.request.json();
        const db = context.env.DB;

        if (!admin_email || !user_id) {
            return new Response(JSON.stringify({ success: false, error: 'Data tidak lengkap' }), { 
                status: 400, headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Verifikasi Otorisasi Admin
        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        // Ambil data user sebelum dihapus dari database
        const targetUser = await db.prepare("SELECT email, name FROM users WHERE id = ?").bind(user_id).first();

        // Hapus dari database D1
        await db.prepare("DELETE FROM users WHERE id = ?").bind(user_id).run();

        // Hapus file Markdown penulis dari repositori GitHub jika ada
        if (targetUser && targetUser.email) {
            const rawSlug = targetUser.email.split('@')[0];
            // Sanitasi Slug Penulis dari Path Traversal
            const authorSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
            
            const githubToken = context.env.GITHUB_TOKEN;
            const repo = context.env.GITHUB_REPO;
            const path = `_authors/${authorSlug}.md`;

            const getFileRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'User-Agent': 'Cloudflare-Worker'
                }
            });

            if (getFileRes.ok) {
                const fileData = await getFileRes.json();
                await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'User-Agent': 'Cloudflare-Worker',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete author profile for ${targetUser.name}`,
                        sha: fileData.sha,
                        branch: 'main'
                    })
                });
            }
        }

        return new Response(JSON.stringify({ success: true, message: 'User dan profil berhasil dihapus.' }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' } 
        });
    }
}