export async function onRequestPost(context) {
    try {
        const { admin_email } = await context.request.json();
        const db = context.env.DB;

        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), { status: 403 });
        }

        const users = await db.prepare("SELECT id, name, email, role, created_at FROM users").all();
        const comments = await db.prepare("SELECT id, article_slug, author_name, content, status, created_at FROM comments").all();

        return new Response(JSON.stringify({ success: true, users: users.results, comments: comments.results }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
    }
}