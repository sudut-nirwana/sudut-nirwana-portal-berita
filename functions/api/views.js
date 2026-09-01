export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug required" }), { status: 400 });
  }

  // Bind DB D1 di Cloudflare Dashboard diberi nama "DB"
  const DB = env.DB; 

  if (request.method === "POST") {
    // Tambah 1 jumlah view untuk slug ini
    await DB.prepare(`
      INSERT INTO article_views (slug, views) 
      VALUES (?, 1) 
      ON CONFLICT(slug) DO UPDATE SET views = views + 1
    `).bind(slug).run();
  }

  // Ambil total view terbaru
  const result = await DB.prepare(`SELECT views FROM article_views WHERE slug = ?`).bind(slug).first();
  const totalViews = result ? result.views : 0;

  return new Response(JSON.stringify({ views: totalViews }), {
    headers: { "Content-Type": "application/json" }
  });
}