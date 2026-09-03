export async function onRequestPost(context) {
    try {
        const { admin_email, comment_id } = await context.request.json();
        const db = context.env.DB;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), { status: 403 });
        }

        await db.prepare("DELETE FROM comments WHERE id = ?").bind(comment_id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
    }
}