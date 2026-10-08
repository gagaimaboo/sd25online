# DEVICE_KNIGHT bundle
The Roaring Knight runs the attacks of Radi0's DEVICE_KNIGHT (shadowcrystal.dev/DEVICE_KNIGHT).
To rebuild: mirror its site into ./DEVICE_KNIGHT next to these files, `npm i esbuild`, run
`node build_dk.mjs dk_bundle.js` and `python3 atlas.py DEVICE_KNIGHT/assets/sprites out`, then splice
the bundle into index.html (the <script> before the game) and the atlas json into DK_ATLAS.
