import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{20,60}$/i.test(id)) {
    return new Response("Invalid media id", { status: 400 });
  }

  const store = getStore("sd25-public-videos");
  const entry = await store.getWithMetadata(id, { type: "stream" });

  if (!entry || !entry.data) {
    return new Response("Video not found", { status: 404 });
  }

  const contentType = entry.metadata?.contentType || "video/mp4";
  const size = entry.metadata?.size;

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "none"
  });
  if (size) headers.set("Content-Length", String(size));

  if (req.method === "HEAD") return new Response(null, { headers });
  return new Response(entry.data, { headers });
}

export const config = {
  path: "/api/media"
};
