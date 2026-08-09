SD2.5 v12 — GLOBAL FEED FIX + PROFILE PICTURES

FIXED
- Public posts appear in For You immediately after metadata publish.
- While the permanent Netlify video copy is processing, For You uses the fresh source video URL.
- Once caching finishes, feed silently switches to /api/media Blob storage.
- Global feed no longer hides processing posts.

PROFILE PICTURES
- Edit Profile now supports image upload, change, and remove.
- Client crops/resizes PFP to 256x256 before storing it.
- PFP appears on profile, creator labels, and immersive viewer.
- New public posts include PFP metadata.
- Editing your profile syncs handle/display name/PFP to public posts you own from this browser.

IMPORTANT DEPLOYMENT
Deploy the WHOLE project, not only index.html. This ZIP includes the Netlify Functions again.
