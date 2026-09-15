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
        if (!targetUser) {
            return new Response(JSON.stringify({ success: false, error: 'Penulis tidak ditemukan.' }), { 
                status: 404, headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Cari atau pastikan akun "Redaksi" ada, atau update artikel author ini agar author_id diset NULL / dialihkan ke Admin/Redaksi
        // Berdasarkan kebijakan musyawarah: artikel diubah kepemilikannya menjadi Redaksi agar tidak terhapus.
        // Kita bisa update articles milik user_id ini menjadi milik admin yang sedang menghapus atau diset null (tergantung skema database Anda).
        // Di sini kita update author_id artikel menjadi milik admin yang menghapus (atau biarkan null jika schema mengizinkan). 
        // Alternatif paling aman: update artikel agar author_id merujuk ke admin yang sedang bertindak atau set NULL.
        await db.prepare("UPDATE articles SET author_id = ? WHERE author_id = ?").bind(admin.id || null, user_id).run();

        // Hapus dari database D1
        await db.prepare("DELETE FROM users WHERE id = ?").bind(user_id).run();

        // Hapus file Markdown penulis dari repositori GitHub jika ada
        if (targetUser && targetUser.email) {
            const rawSlug = targetUser.email.split('@')[0];
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

        return new Response(JSON.stringify({ success: true, message: 'User berhasil dihapus dan artikel dialihkan ke Redaksi.' }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' } 
        });
    }
}