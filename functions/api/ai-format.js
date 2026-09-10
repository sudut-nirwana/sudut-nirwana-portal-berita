export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const body = await request.json();
        const rawText = body.rawText;

        if (!rawText) {
            return new Response(JSON.stringify({ success: false, error: 'Draf mentah kosong' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ success: false, error: 'Gemini API Key belum dikonfigurasi di Environment Variables Cloudflare.' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 500
            });
        }

        const prompt = `Anda adalah editor senior, sejarawan, dan content writer profesional untuk portal berita & lifestyle "Sudut Nirwana". Analisis draf mentah penulis, sempurnakan gaya bahasanya, lengkapi data/fakta sejarah atau informasi medis secara akurat dengan rujukan kredibel, dan berikan output HANYA dalam format JSON valid tanpa teks tambahan di luar JSON dengan struktur kunci berikut:
{
  "title": "Judul artikel yang menarik dan SEO-friendly (tambahkan [Part X] jika artikel berseri)",
  "slug": "slug-url-singkat-maksimal-6-kata",
  "category": "pilih salah satu yang valid dari daftar ini: jurnal, kuliner, lifestyle, musik, olahraga, otomotif, seni-budaya, wisata, sosial",
  "popular": "true jika ini artikel tunggal atau Part 1 dari artikel berseri; isi 'false' jika ini Part 2, Part 3, atau seterusnya",
  "description": "Ringkasan pendek (meta description) yang memikat pembaca",
  "imageName": "nama-file-pendek-relevan.webp",
  "tags": "tag1, tag2, tag3",
  "content": "Isi lengkap artikel dalam format Markdown lengkap dengan heading (##, ###), teks tebal (**), penekanan (>), dan sisipkan tag komponen Liquid sbb: {% include alert-single.html category='nama_kategori' %} atau {% include alert-group.html category='nama_kategori' %} secara natural di sela-sela sub-bab."
}

Draf Mentah dari Penulis:
${rawText}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || `Google API Error (${response.status})`);
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
            throw new Error('Respons dari Google AI kosong atau diblokir filter keamanan.');
        }

        const cleanedJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanedJson);

        return new Response(JSON.stringify({ success: true, data: parsedData }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}