export async function onRequestPost(context) {
    try {
        const { admin_email, target_user_id, new_email, new_password, old_password } = await context.request.json();
        const db = context.env.DB;

        const requester = await db.prepare("SELECT * FROM users WHERE email = ?").bind(admin_email).first();
        if (!requester) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
        }

        let targetId = requester.id;
        let isChangingEmail = false;

        if (new_email && new_email !== requester.email) {
            if (requester.role !== 'admin') {
                return new Response(JSON.stringify({ success: false, error: 'Hanya admin yang dapat mengubah nama email.' }), { status: 403 });
            }
            if (!new_email.endsWith('@sudutnirwana.com')) {
                return new Response(JSON.stringify({ success: false, error: 'Email baru wajib menggunakan domain @sudutnirwana.com' }), { status: 400 });
            }
            if (target_user_id) targetId = target_user_id;
            isChangingEmail = true;
        }

        if (new_password) {
            if (requester.role !== 'admin' && requester.password_hash !== old_password) {
                return new Response(JSON.stringify({ success: false, error: 'Password lama salah.' }), { status: 401 });
            }
            await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(new_password, targetId).run();
        }

        if (isChangingEmail) {
            await db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(new_email, targetId).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'Akun berhasil diperbarui.' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
    }
}