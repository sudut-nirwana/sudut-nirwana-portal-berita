export async function onRequestPost(context) {
    try {
        const { admin_email, user_email, filename, imageBase64, targetFolder, oldImagePath } = await context.request.json();
        
        // Deteksi Path Traversal (Percobaan Hapus/Overwrite File Sistem Luar Folder Gambar)
        if ((filename && filename.includes('..')) || (targetFolder && targetFolder.includes('..')) || (oldImagePath && oldImagePath.includes('..'))) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const activeEmail = user_email || admin_email;
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!activeEmail) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const user = await db.prepare("SELECT role FROM users WHERE email = ?").bind(activeEmail).first();
        if (!user) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Anda sepertinya salah jalan... Segera putar balik dan pulang! 🛑' 
            }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        if (!filename || !imageBase64) {
            return new Response(JSON.stringify({ success: false, error: 'File gambar tidak lengkap.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Paksa sanitasi ekstensi dan nama file aman
        let cleanName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
        if (!cleanName.endsWith('.webp')) {
            cleanName = cleanName.replace(/\.[^/.]+$/, "") + ".webp";
        }

        // Kunci folder tujuan hanya pada jalur assets/images/
        let folder = (targetFolder || 'assets/images/posts').replace(/^\/+|\/+$/g, '');
        if (!folder.startsWith('assets/images')) {
            folder = 'assets/images/posts';
        }

        const filePath = `${folder}/${cleanName}`;

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

        // Hapus gambar lama jika valid & berada dalam jalur assets/images/
        if (oldImagePath && oldImagePath !== `/${filePath}` && !oldImagePath.includes('default.webp')) {
            const cleanOldPath = oldImagePath.replace(/^\/+/, '').replace(/\.\.\//g, '');
            if (cleanOldPath.startsWith('assets/images/')) {
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