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
        const admin = await db.prepare("SELECT id, role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        // Ambil data user sebelum dihapus
        const targetUser = await db.prepare("SELECT email, name FROM users WHERE id = ?").bind(user_id).first();
        if (!targetUser) {
            return new Response(JSON.stringify({ success: false, error: 'Penulis tidak ditemukan.' }), { 
                status: 404, headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Alihkan artikel terikat ke admin (Redaksi) agar aman
        await db.prepare("UPDATE articles SET author_id = ? WHERE author_id = ?").bind(admin.id, user_id).run();

        // Hapus dari database D1
        await db.prepare("DELETE FROM users WHERE id = ?").bind(user_id).run();

        // Bersihkan file Markdown penulis dari GitHub
        if (targetUser && targetUser.email) {
            const githubToken = context.env.GITHUB_TOKEN;
            const repo = context.env.GITHUB_REPO;
            
            const emailPrefix = targetUser.email.split('@')[0].toLowerCase();
            const nameSlug = targetUser.name ? targetUser.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') : '';

            // Daftar kemungkinan nama file .md di folder _authors/
            const possibleSlugs = [
                emailPrefix,
                nameSlug,
                // Tambahkan kombinasi jika dipisah strip atau digabung
            ].filter(Boolean);

            // Hilangkan duplikat jika emailPrefix dan nameSlug bernilai sama
            const uniqueSlugs = [...new Set(possibleSlugs)];

            for (const slug of uniqueSlugs) {
                const path = `_authors/${slug}.md`;
                const getFileRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'User-Agent': 'Cloudflare-Worker'
                    }
                });

                if (getFileRes.ok) {
                    const fileData = await getFileRes.json();
                    const deleteRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
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

                    if (deleteRes.ok) {
                        break; // Berhasil dihapus, keluar dari looping
                    }
                }
            }
        }

        return new Response(JSON.stringify({ success: true, message: 'User berhasil dihapus, artikel dialihkan ke Redaksi, dan file GitHub bersih.' }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' } 
        });
    }
}