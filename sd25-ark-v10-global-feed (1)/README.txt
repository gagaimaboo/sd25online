SD2.5 v10 — GLOBAL FOR YOU

This version makes public posts truly shared across everyone using the same Netlify site.

HOW IT WORKS
- Private Drafts: still localStorage, private to the browser.
- Local username/password: still local, intentionally lightweight.
- Public Post: sent to a Netlify Function.
- Public metadata: stored in site-wide Netlify Blobs.
- Public video: copied by a Netlify Background Function into site-wide Blob storage.
- For You: fetches /api/feed and shows everyone's ready public posts.
- Feed auto-refreshes every 20 seconds.
- Search now searches the global public feed.
- Global video viewer/remixing/cameos continue to work.

DEPLOYMENT
This version CANNOT be only a single static HTML file, because a global feed requires shared server-side state.

Recommended Netlify deployment:
1. Unzip this folder into a Git repo.
2. Import the repo into Netlify.
3. Netlify installs @netlify/blobs and deploys the functions automatically.

Or with Netlify CLI:
  npm install
  npx netlify deploy --build --prod

Do not use plain single-file Netlify Drop for v10; that would omit the shared backend.

FILES
- index.html
- package.json
- netlify.toml
- netlify/functions/feed.mjs
- netlify/functions/publish.mjs
- netlify/functions/cache-video.mjs
- netlify/functions/media.mjs

LIMITS / NOTES
- Public video copy limit in this build: 250 MB per post.
- Local usernames are display identities, not verified global identities.
- Per-post random edit tokens prevent casual deletion of somebody else's post.
- Netlify Blobs is intentionally being used as a simple small-group shared feed, not as a full relational social network.
- The Ark API key is still embedded client-side from the previous build; public client code cannot keep it secret.
