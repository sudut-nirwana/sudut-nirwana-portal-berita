export async function onRequestPost(context) {
    try {
        const { admin_email, user_id } = await context.request.json();
        const db = context.env.DB;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Ambil data user sebelum dihapus dari database untuk mengetahui slug/email file di GitHub
        const targetUser = await db.prepare("SELECT email, name FROM users WHERE id = ?").bind(user_id).first();

        // Hapus dari database D1
        await db.prepare("DELETE FROM users WHERE id = ?").bind(user_id).run();

        // Hapus file Markdown penulis dari repositori GitHub
        if (targetUser) {
            const authorSlug = targetUser.email.split('@')[0];
            const githubToken = context.env.GITHUB_TOKEN;
            const repo = context.env.GITHUB_REPO; // format: username/repo
            const path = `_authors/${authorSlug}.md`;

            // GitHub API memerlukan SHA file untuk proses penghapusan (DELETE)
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

        return new Response(JSON.stringify({ success: true }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}