export async function onRequestPost(context) {
    try {
        const { email, password } = await context.request.json();
        const db = context.env.DB;

        if (!email || !password) {
            return new Response(JSON.stringify({ success: false, error: 'Email dan password wajib diisi' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const user = await db.prepare("SELECT id, name, email, role, password_hash FROM users WHERE email = ?").bind(email).first();

        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Email atau password salah' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
        const inputHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        if (inputHash !== user.password_hash) {
            return new Response(JSON.stringify({ success: false, error: 'Email atau password salah' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Login berhasil', 
            user: { id: user.id, name: user.name, email: user.email, role: user.role } 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}