export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const DB = env.DB;

  // GET: Ambil Komentar (Beserta Foto & Nama)
  if (request.method === "GET") {
    if (!slug) return new Response("Slug required", { status: 400 });
    const { results } = await DB.prepare(
      `SELECT name, avatar, message, created_at FROM comments WHERE slug = ? ORDER BY id DESC`
    ).bind(slug).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POST: Simpan Komentar Terverifikasi
  if (request.method === "POST") {
    const data = await request.json();
    if (!data.slug || !data.name || !data.email || !data.avatar || !data.message) {
      return new Response("Data tidak lengkap", { status: 400 });
    }

    await DB.prepare(
      `INSERT INTO comments (slug, name, email, avatar, message) VALUES (?, ?, ?, ?, ?)`
    ).bind(data.slug, data.name, data.email, data.avatar, data.message).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}