// Konversi string biasa ke Base64URL (untuk Header & Payload)
function base64url(source) {
    let encoded = btoa(source);
    return encoded.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Konversi ArrayBuffer Signature langsung ke Base64URL secara aman
function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let base64 = btoa(binary);
    return base64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Konversi PEM Private Key ke CryptoKey Cloudflare
async function importPrivateKey(pem) {
    if (!pem) {
        throw new Error("Variabel GOOGLE_PRIVATE_KEY kosong atau belum diset di Cloudflare.");
    }
    
    let cleanPem = pem.trim();
    if ((cleanPem.startsWith('"') && cleanPem.endsWith('"')) || (cleanPem.startsWith("'") && cleanPem.endsWith("'"))) {
        cleanPem = cleanPem.slice(1, -1);
    }

    cleanPem = cleanPem
        .replace(/\\n/g, '')
        .replace(/[\r\n]+/g, '')
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');

    let binaryDerString;
    try {
        binaryDerString = atob(cleanPem);
    } catch (e) {
        throw new Error("Gagal memproses Base64 kunci privat. Periksa kembali isi key di Cloudflare.");
    }

    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    
    return crypto.subtle.importKey(
        "pkcs8",
        binaryDer.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );
}

export async function onRequestPost(context) {
    try {
        const { admin_email, slug, category } = await context.request.json();
        const db = context.env.DB;
        
        const clientEmail = context.env.GOOGLE_CLIENT_EMAIL;
        const privateKeyPEM = context.env.GOOGLE_PRIVATE_KEY;

        // Validasi Hak Akses Admin
        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        if (!slug || !category) {
            return new Response(JSON.stringify({ success: false, error: 'Data artikel tidak lengkap' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const rawCategory = category.split(',')[0].trim().toLowerCase();
        const targetUrl = `https://sudutnirwana.com/${rawCategory}/${slug}`;

        // Pembuatan JWT Token
        const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + 3600;
        const payload = JSON.stringify({
            iss: clientEmail,
            scope: "https://www.googleapis.com/auth/indexing",
            aud: "https://oauth2.googleapis.com/token",
            exp: exp,
            iat: iat
        });

        const stringToSign = base64url(header) + "." + base64url(payload);
        const privateKey = await importPrivateKey(privateKeyPEM);
        
        const encoder = new TextEncoder();
        const signatureBuffer = await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            privateKey,
            encoder.encode(stringToSign)
        );
        
        const jwtToken = stringToSign + "." + bufferToBase64Url(signatureBuffer);

        // Tukar JWT dengan Access Token
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`
        });
        
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            return new Response(JSON.stringify({ success: false, error: `Google OAuth Error: ${tokenData.error_description || tokenData.error}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Kirim ke Google Indexing API
        const googleResponse = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: targetUrl,
                type: "URL_UPDATED"
            })
        });

        const googleResult = await googleResponse.json();
        if (!googleResponse.ok) {
            return new Response(JSON.stringify({ success: false, error: `Google Indexing Error: ${googleResult.error?.message || 'Gagal mengirim'}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: true, message: 'URL sukses dikirim ke Google Indexing!' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}