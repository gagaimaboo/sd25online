# notes for claude

- the user plays this on mobile through an artifact: https://claude.ai/artifact/K38NWc8BeiBxdLBGLQF7E7
- after every game update (any change to index.html), rebuild and republish that artifact to the same url without being asked:
  1. `python3 tools/artifact/build.py` (the artifact can't load anything from other hosts, so this bundles every remote sprite, sound and font into `.artifact-build/`)
  2. `NODE_PATH=$(npm root -g) node tools/artifact/verify.js` must pass (plays the build offline on an emulated phone)
  3. Artifact tool: `action: "read"` on the url, then `action: "list", scope: "files"` on it, then publish with `url`, `file_path: ".artifact-build/ub.html"`, `root: ".artifact-build"` and `files` = the contents of `.artifact-build/files.json`
  - files you leave out of a publish stay as they were, and the audio files are named by their URL hash, so after the first publish of a session it's enough to send `pack/assets.json` plus any `a/*` files that are new
