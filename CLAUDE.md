# notes for claude

- the user plays this on mobile through an artifact: https://claude.ai/artifact/K38NWc8BeiBxdLBGLQF7E7
- after every game update (any change to index.html), rebuild and republish that artifact to the same url without being asked. read it with the Artifact tool first (`action: "read"`), then publish with `url` set so the link stays the same.
- the artifact can't load anything from other hosts, so the build has to bundle every remote sprite, sound and font with the page.
