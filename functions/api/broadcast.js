export async function onRequestPost(context) {
    try {
        const { admin_email, slug, title, description, image, category } = await context.request.json();
        const db = context.env.DB;
        const resendApiKey = context.env.RESEND_API_KEY;

        if (!admin_email) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validasi hak akses admin
        const admin = await db.prepare("SELECT role FROM users WHERE email = ?").bind(admin_email).first();
        if (!admin || admin.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Akses ditolak. Bukan admin.' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!slug || !title) {
            return new Response(JSON.stringify({ success: false, error: 'Data artikel tidak lengkap.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        // AMBIL DAN BERSIHKAN KATEGORI LANGSUNG DARI REQUEST
        const rawCategory = (category || 'jurnal').split(',')[0].trim();
        const catSlug = rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const articleUrl = `https://sudutnirwana.com/${catSlug}/${slug}/`;

        // Ambil seluruh daftar email subscriber
        const { results: subscribers } = await db.prepare("SELECT email FROM subscribers").all();
        if (!subscribers || subscribers.length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'Belum ada subscriber terdaftar.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const absImage = image && image.startsWith('http') ? image : `https://sudutnirwana.com${image || '/assets/images/posts/sample.webp'}`;

        let successCount = 0;

        for (const sub of subscribers) {
            const recipientEmail = sub.email;
            const unsubUrl = `https://sudutnirwana.com/?unsub=${encodeURIComponent(recipientEmail)}`;

            const htmlContent = `
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #3E3E3B; background: #fdfbf7; padding: 20px; border: 1px solid #e5e0dc; border-radius: 8px;">
                  <tr>
                    <td style="text-align: center; padding-bottom: 20px;">
                      <h2 style="margin: 0; color: #896340;">Sudut Nirwana</h2>
                      <p style="font-size: 12px; color: #76756e; margin: 4px 0 0 0;">Lensa Berita & Lifestyle Terkurasi</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <img src="${absImage}" alt="${title}" style="width: 100%; height: auto; border-radius: 6px; display: block; margin-bottom: 16px;">
                      <h3 style="font-size: 18px; margin: 0 0 10px 0; color: #1a1a1a;">
                        <a href="${articleUrl}" style="color: #896340; text-decoration: none;">${title}</a>
                      </h3>
                      <p style="font-size: 14px; line-height: 1.6; color: #585752; margin-bottom: 20px;">
                        ${description || 'Baca selengkapnya artikel terbaru kami di situs Sudut Nirwana.'}
                      </p>
                      <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${articleUrl}" style="background: #896340; color: #ffffff; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Baca Selengkapnya</a>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top: 1px solid #e5e0dc; padding-top: 15px; text-align: center;">
                      <p style="font-size: 11px; color: #76756e; margin: 0;">
                        Anda menerima email ini karena terdaftar di buletin Sudut Nirwana.<br>
                        Tidak ingin menerima update lagi? <a href="${unsubUrl}" style="color: #896340; text-decoration: underline;">Berhenti Berlangganan</a>
                      </p>
                    </td>
                  </tr>
                </table>
            `;

            try {
                const resendRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'Sudut Nirwana <newsletter@sudutnirwana.com>',
                        to: [recipientEmail],
                        subject: `Update: ${title}`,
                        html: htmlContent
                    })
                });

                if (resendRes.ok) successCount++;
            } catch (err) {
                console.error(`Gagal mengirim ke ${recipientEmail}:`, err);
            }
        }

        return new Response(JSON.stringify({ success: true, sent: successCount, total: subscribers.length }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}