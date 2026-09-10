export async function onRequestPost(context) {
    try {
        const { admin_email, filename, imageBase64 } = await context.request.json();
        const db = context.env.DB;
        const githubToken = context.env.GITHUB_TOKEN;
        const githubRepo = context.env.GITHUB_REPO;

        if (!admin_email) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak. Bukan admin.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        if (!filename || !imageBase64) {
            return new Response(JSON.stringify({ success: false, error: 'File gambar tidak lengkap.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const cleanFileName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
        const filePath = `assets/images/posts/${cleanFileName}`;

        const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'User-Agent': 'Cloudflare-Pages-Function',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload post image: ${cleanFileName}`,
                content: imageBase64,
                branch: 'main'
            })
        });

        if (!githubResponse.ok) {
            const errText = await githubResponse.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
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