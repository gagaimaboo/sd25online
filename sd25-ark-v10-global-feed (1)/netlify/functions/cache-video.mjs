import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const hashToken = (value) =>
  createHash("sha256").update(String(value || "")).digest("hex");

export default async function handler(req) {
  let body;
  try { body = await req.json(); }
  catch { return; }

  const id = String(body.publicPostId || "");
  const sourceVideoUrl = String(body.sourceVideoUrl || "");
  const editToken = String(body.editToken || "");
  if (!id || !sourceVideoUrl || !editToken) return;

  const posts = getStore({ name: "sd25-public-posts", consistency: "strong" });
  const key = `post:${id}`;
  const record = await posts.get(key, { type: "json", consistency: "strong" });
  if (!record) return;
  if (hashToken(editToken) !== record.editTokenHash) return;

  try {
    const upstream = await fetch(sourceVideoUrl, {
      headers: { "User-Agent": "SD2.5-Netlify-Video-Cache/1.0" }
    });
    if (!upstream.ok) throw new Error(`Upstream video returned ${upstream.status}`);

    const contentType = upstream.headers.get("content-type") || "video/mp4";
    const declaredLength = Number(upstream.headers.get("content-length") || 0);

    if (declaredLength && declaredLength > 250 * 1024 * 1024) {
      throw new Error("Video is larger than the 250 MB public-feed limit");
    }

    const blob = await upstream.blob();
    if (blob.size > 250 * 1024 * 1024) {
      throw new Error("Video is larger than the 250 MB public-feed limit");
    }

    const videos = getStore({ name: "sd25-public-videos", consistency: "strong" });
    await videos.set(id, blob, {
      metadata: {
        contentType,
        size: blob.size,
        cachedAt: Date.now()
      }
    });

    record.status = "ready";
    record.readyAt = Date.now();
    delete record.cacheError;
    await posts.setJSON(key, record);
  } catch (error) {
    record.status = "failed";
    record.cacheError = String(error?.message || error).slice(0, 500);
    await posts.setJSON(key, record);
  }
}

export const config = {
  path: "/api/cache-video",
  background: true
};
