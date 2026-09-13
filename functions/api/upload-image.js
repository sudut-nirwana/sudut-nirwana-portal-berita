export async function onRequestPost(context) {
    try {
        const { admin_email, user_email, filename, imageBase64, targetFolder, oldImagePath } = await context.request.json();
        const activeEmail = user_email || admin_email;
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!activeEmail) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const user = await db.prepare("SELECT role FROM users WHERE email = ?").bind(activeEmail).first();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        if (!filename || !imageBase64) {
            return new Response(JSON.stringify({ success: false, error: 'File gambar tidak lengkap.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Standardisasi nama file ke .webp
        let cleanName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
        if (!cleanName.endsWith('.webp')) {
            cleanName = cleanName.replace(/\.[^/.]+$/, "") + ".webp";
        }

        const folder = targetFolder || 'assets/images/posts';
        const filePath = `${folder}/${cleanName}`;

        // Upload file baru ke GitHub
        const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'User-Agent': 'Cloudflare-Pages-Function',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload image: ${cleanName}`,
                content: imageBase64,
                branch: 'main'
            })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        // Hapus gambar lama jika ada, berbeda path, dan bukan file default
        if (oldImagePath && oldImagePath !== `/${filePath}` && !oldImagePath.includes('default.webp')) {
            const cleanOldPath = oldImagePath.replace(/^\/+/, '');
            try {
                const getOldFile = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${cleanOldPath}`, {
                    headers: { 'Authorization': `Bearer ${githubToken}`, 'User-Agent': 'Cloudflare-Pages-Function' }
                });
                if (getOldFile.ok) {
                    const oldFileData = await getOldFile.json();
                    await fetch(`https://api.github.com/repos/${githubRepo}/contents/${cleanOldPath}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'User-Agent': 'Cloudflare-Pages-Function',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Delete old image: ${cleanOldPath}`,
                            sha: oldFileData.sha,
                            branch: 'main'
                        })
                    });
                }
            } catch (e) {
                console.error('Gagal menghapus gambar lama:', e);
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            path: `/${filePath}`, 
            message: 'Gambar berhasil diunggah ke GitHub.' 
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}