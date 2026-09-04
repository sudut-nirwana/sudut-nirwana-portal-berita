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
        let targetUser = requester;

        if (target_user_id && requester.role === 'admin') {
            targetId = target_user_id;
            targetUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(targetId).first();
            if (!targetUser) {
                return new Response(JSON.stringify({ success: false, error: 'Target user not found' }), { 
                    status: 404, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        }

        if (new_email && new_email !== targetUser.email) {
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

        const encoder = new TextEncoder();

        if (new_password) {
            if (targetId === requester.id && requester.role !== 'admin') {
                if (!old_password) {
                    return new Response(JSON.stringify({ success: false, error: 'Password lama wajib diisi.' }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                const oldHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(old_password));
                const oldInputHash = Array.from(new Uint8Array(oldHashBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                if (oldInputHash !== targetUser.password_hash) {
                    return new Response(JSON.stringify({ success: false, error: 'Password lama salah.' }), { 
                        status: 401, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
            }

            const newHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(new_password));
            const newPasswordHash = Array.from(new Uint8Array(newHashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newPasswordHash, targetId).run();
        }

        if (new_name) {
            await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(new_name, targetId).run();
        }

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