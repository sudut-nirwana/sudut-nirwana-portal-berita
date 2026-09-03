export async function onRequestPost(context) {
    try {
        const { email, password } = await context.request.json();
        const db = context.env.DB;

        const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

        if (!user || user.password_hash !== password) {
            return new Response(JSON.stringify({ success: false, error: 'Email atau password salah' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Login berhasil', 
            user: { name: user.name, email: user.email, role: user.role } 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}