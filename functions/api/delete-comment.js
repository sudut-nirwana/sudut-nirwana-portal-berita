export async function onRequestPost(context) {
    try {
        const { admin_email, comment_id } = await context.request.json();
        const db = context.env.DB;

        if (!admin_email || !comment_id) {
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

        await db.prepare("DELETE FROM comments WHERE id = ?").bind(comment_id).run();
        
        return new Response(JSON.stringify({ success: true, message: 'Komentar berhasil dihapus.' }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' } 
        });
    }
}