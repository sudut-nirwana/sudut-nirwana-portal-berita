export async function onRequestPost(context) {
    try {
        const { admin_email, target_user_id, new_name, new_email, new_password, old_password } = await context.request.json();
        const db = context.env.DB;

        const requester = await db.prepare("SELECT * FROM users WHERE email = ?").bind(admin_email).first();
        if (!requester) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        let targetId = requester.id;

        // Jika admin ingin mengubah data/sandi pengguna lain
        if (target_user_id && requester.role === 'admin') {
            targetId = target_user_id;
        }

        // Validasi Email jika diubah
        if (new_email && new_email !== requester.email) {
            if (requester.role !== 'admin') {
                return new Response(JSON.stringify({ success: false, error: 'Hanya admin yang dapat mengubah alamat email.' }), { 
                    status: 403, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            if (!new_email.endsWith('@sudutnirwana.com')) {
                return new Response(JSON.stringify({ success: false, error: 'Email baru wajib menggunakan domain @sudutnirwana.com' }), { 
                    status: 400, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        }

        // Validasi Password jika diisi
        if (new_password) {
            // Jika author mengubah password sendiri, wajib verifikasi password lama.
            // Jika admin mereset password akun lain (targetId !== requester.id), tidak perlu password lama.
            if (targetId === requester.id && requester.role !== 'admin') {
                if (requester.password !== old_password) {
                    return new Response(JSON.stringify({ success: false, error: 'Password lama salah.' }), { 
                        status: 401, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
            }
            await db.prepare("UPDATE users SET password = ? WHERE id = ?").bind(new_password, targetId).run();
        }

        // Perbarui Nama Lengkap
        if (new_name) {
            await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(new_name, targetId).run();
        }

        // Perbarui Email
        if (new_email) {
            await db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(new_email, targetId).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'Akun berhasil diperbarui.' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}