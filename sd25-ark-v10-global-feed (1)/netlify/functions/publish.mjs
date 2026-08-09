import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";

const hashToken = (value) =>
  createHash("sha256").update(String(value || "")).digest("hex");

const cleanText = (value, max) => String(value || "").trim().slice(0, max);

export default async function handler(req) {
  const posts = getStore({ name: "sd25-public-posts", consistency: "strong" });

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

    const sourceVideoUrl = cleanText(body.sourceVideoUrl, 2048);
    const editToken = cleanText(body.editToken, 256);

    let parsed;
    try { parsed = new URL(sourceVideoUrl); }
    catch { return Response.json({ error: "Invalid video URL" }, { status: 400 }); }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return Response.json({ error: "Video URL must be http(s)" }, { status: 400 });
    }
    if (editToken.length < 20) {
      return Response.json({ error: "Missing publish token" }, { status: 400 });
    }

    const publicPostId = randomUUID();
    const record = {
      publicPostId,
      localId: cleanText(body.localId, 100),
      user: cleanText(body.user, 40) || "creator",
      displayName: cleanText(body.displayName, 60),
      prompt: cleanText(body.prompt, 1500),
      ratio: cleanText(body.ratio, 16) || "9/16",
      kind: cleanText(body.kind, 24) || "generation",
      createdAt: Number(body.createdAt) || Date.now(),
      publishedAt: Date.now(),
      likes: 0,
      comments: 0,
      remixes: 0,
      status: "processing",
      sourceVideoUrl,
      editTokenHash: hashToken(editToken)
    };

    await posts.setJSON(`post:${publicPostId}`, record);
    return Response.json({ publicPostId, status: "processing" }, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id") || "";
    let body;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

    const key = `post:${id}`;
    const record = await posts.get(key, { type: "json", consistency: "strong" });
    if (!record) return Response.json({ error: "Post not found" }, { status: 404 });

    if (hashToken(body.editToken) !== record.editTokenHash) {
      return Response.json({ error: "You can't remove this post from this browser" }, { status: 403 });
    }

    await posts.delete(key);
    const videos = getStore({ name: "sd25-public-videos", consistency: "strong" });
    await videos.delete(id).catch(() => {});

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

export const config = {
  path: "/api/publish"
};
