import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const store = getStore({ name: "sd25-public-posts", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "post:" });

  const records = [];
  for (const item of blobs.slice(-200)) {
    try {
      const post = await store.get(item.key, { type: "json", consistency: "strong" });
      if (post && post.status === "ready" && post.publicPostId) {
        const { editTokenHash, sourceVideoUrl, cacheError, ...safe } = post;
        records.push({
          ...safe,
          videoUrl: `/api/media?id=${encodeURIComponent(post.publicPostId)}`
        });
      }
    } catch {}
  }

  records.sort((a, b) => Number(b.publishedAt || b.createdAt || 0) - Number(a.publishedAt || a.createdAt || 0));

  return Response.json(
    { posts: records.slice(0, 80) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const config = {
  path: "/api/feed"
};
