export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  if (request.method === "POST") {
    const { slug } = await request.json();
    if (!slug) return new Response(JSON.stringify({error: "slug required"}), {status: 400});

    // 1. Tambah 1 view. Kalo belum ada slug nya, bikin baru
    await DB.prepare(`
      INSERT INTO article_views (slug, views) VALUES (?, 1)
      ON CONFLICT(slug) DO UPDATE SET views = views + 1
    `).bind(slug).run();

    // 2. Ambil jumlah view terbaru
    const { results } = await DB.prepare(`SELECT views FROM article_views WHERE slug =?`).bind(slug).all();
    const views = results[0]?.views || 0;

    return new Response(JSON.stringify({ views: views }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({error: "Method not allowed"}), {status: 405});
}