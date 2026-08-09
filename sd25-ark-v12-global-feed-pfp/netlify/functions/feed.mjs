import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const store = getStore({ name: "sd25-public-posts", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "post:" });

  const records = [];
  for (const item of blobs.slice(-250)) {
    try {
      const post = await store.get(item.key, { type: "json", consistency: "strong" });
      if (!post || !post.publicPostId) continue;

      // Don't make a post invisible while its permanent video copy is still running.
      // A fresh Ark URL is usable immediately; once the Blob copy is ready, switch to it.
      if (!["processing", "ready", "failed"].includes(post.status)) continue;

      const {
        editTokenHash,
        cacheError,
        sourceVideoUrl,
        status,
        ...safe
      } = post;

      records.push({
        ...safe,
        cacheStatus: status,
        videoUrl: status === "ready"
          ? `/api/media?id=${encodeURIComponent(post.publicPostId)}`
          : sourceVideoUrl
      });
    } catch {}
  }

  records.sort((a, b) => Number(b.publishedAt || b.createdAt || 0) - Number(a.publishedAt || a.createdAt || 0));

  return Response.json(
    { posts: records.slice(0, 100) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const config = { path: "/api/feed" };
