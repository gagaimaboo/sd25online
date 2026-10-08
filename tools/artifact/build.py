#!/usr/bin/env python3
"""Builds the mobile artifact from index.html.

An artifact page can't load anything from other hosts, so this bundles every
remote sprite, sound, track and font with the page:
  .artifact-build/ub.html          the page (fonts inlined, asset shim added)
  .artifact-build/pack/assets.json sprites as data URIs, plus the audio file map
  .artifact-build/a/*.ogg|wav      sounds and music
  .artifact-build/files.json       the `files` list for the Artifact publish

usage: python3 tools/artifact/build.py [--no-collect]
  --no-collect  reuse the last asset list instead of running the page again
Downloads are cached in .artifact-cache/, so rebuilds only fetch new assets.
"""
import base64, hashlib, json, os, re, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, 'index.html')
CACHE = os.path.join(REPO, '.artifact-cache')
DL = os.path.join(CACHE, 'dl')
OUT = os.path.join(REPO, '.artifact-build')
URLS = os.path.join(CACHE, 'urls.json')

# raw.githubusercontent fallbacks and their jsdelivr twins (the shim maps the same way)
PAIRS = [
    ('https://raw.githubusercontent.com/fachinformatiker/undertale/master/', 'https://cdn.jsdelivr.net/gh/fachinformatiker/undertale@master/'),
    ('https://raw.githubusercontent.com/TeamBlossomDevs/DeltaruneDecomp/chapter2/', 'https://cdn.jsdelivr.net/gh/TeamBlossomDevs/DeltaruneDecomp@chapter2/'),
    ('https://raw.githubusercontent.com/BenSFGamer/Deltarune-web/main/', 'https://cdn.jsdelivr.net/gh/BenSFGamer/Deltarune-web@main/'),
]


def canon(u):
    for raw, cdn in PAIRS:
        if u.startswith(raw):
            return cdn + u[len(raw):]
    return u


def mirror(u):
    for raw, cdn in PAIRS:
        if u.startswith(cdn):
            return raw + u[len(cdn):]
    return None


def key(u):
    return hashlib.sha1(u.encode()).hexdigest()[:16]


def collect():
    env = dict(os.environ)
    try:
        root = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
        env['NODE_PATH'] = os.pathsep.join(p for p in (env.get('NODE_PATH'), root) if p)
    except FileNotFoundError:
        pass
    subprocess.run(['node', os.path.join(REPO, 'tools/artifact/collect.js'), SRC, URLS], env=env, check=True)


def fetch(u):
    """Downloads u (or its raw.githubusercontent mirror) into the cache. Returns (url, status)."""
    dst = os.path.join(DL, key(u))
    if os.path.exists(dst):
        return u, 'cached'
    code = '?'
    for src in filter(None, (u, mirror(u))):
        tmp = dst + '.part'
        r = subprocess.run(['curl', '-sS', '-L', '--max-time', '60', '--retry', '2', '-o', tmp, '-w', '%{http_code}', src],
                           capture_output=True, text=True)
        code = r.stdout.strip() or r.stderr.strip()[:60]
        if r.returncode == 0 and code == '200' and os.path.getsize(tmp) > 0:
            os.replace(tmp, dst)
            return u, 'new'
        if os.path.exists(tmp):
            os.remove(tmp)
    return u, code


def kind(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n': return 'image/png', 'png'
    if data[:6] in (b'GIF87a', b'GIF89a'): return 'image/gif', 'gif'
    if data[:4] == b'OggS': return 'audio/ogg', 'ogg'
    if data[:4] == b'RIFF' and data[8:12] == b'WAVE': return 'audio/wav', 'wav'
    if data[:3] == b'ID3' or data[:2] == b'\xff\xfb': return 'audio/mpeg', 'mp3'
    if data[4:8] == b'ftyp': return 'audio/mp4', 'mp4'
    if data[:4] == b'wOF2': return 'font/woff2', 'woff2'
    if data[:4] == b'wOFF': return 'font/woff', 'woff'
    if data[:4] in (b'\x00\x01\x00\x00', b'OTTO', b'true'): return 'font/ttf', 'ttf'
    return None, None


SHIM = '''
// ARTIFACT BUILD: an artifact page can't load anything from other hosts, so every
// sprite, sound and track ships with the page: sprites in pack/assets.json, sounds
// as their own files. mobileAssetSource() asks here first.
const ARTIFACT_PACK=fetch('pack/assets.json').then(r=>r.ok?r.json():null).catch(()=>null);
const artifactAudioURLs=new Map();
function artifactKey(url){
 for(const [raw,cdn] of [[RAW_FALLBACK,RAW],[DR_RAW_FALLBACK,DR_RAW],['https://raw.githubusercontent.com/BenSFGamer/Deltarune-web/main/','https://cdn.jsdelivr.net/gh/BenSFGamer/Deltarune-web@main/']])
  if(url.startsWith(raw))return cdn+url.slice(raw.length);
 return url;
}
async function artifactAsset(url){
 const pack=await ARTIFACT_PACK;if(!pack)return null;
 const k=artifactKey(url);
 if(pack.img[k])return pack.img[k];
 const file=pack.aud[k];if(!file)return null;
 if(!artifactAudioURLs.has(file))artifactAudioURLs.set(file,fetch(file).then(r=>r.ok?r.blob():null).then(b=>b?URL.createObjectURL(b):file).catch(()=>file));
 return artifactAudioURLs.get(file);
}
'''


def patch(text, old, new, what):
    if text.count(old) != 1:
        sys.exit(f'build: {what}: expected 1 match in index.html, found {text.count(old)} (index.html changed; update tools/artifact/build.py)')
    return text.replace(old, new, 1)


def main():
    if '--no-collect' not in sys.argv or not os.path.exists(URLS):
        os.makedirs(CACHE, exist_ok=True)
        collect()
    urls = sorted({canon(u) for u in json.load(open(URLS))})

    os.makedirs(DL, exist_ok=True)
    with ThreadPoolExecutor(16) as ex:
        res = list(ex.map(fetch, urls))
    new = sum(1 for _, s in res if s == 'new')
    failed = [(u, s) for u, s in res if s not in ('new', 'cached')]
    print(f'download: {len(urls)} urls, {new} new, {len(failed)} unavailable')
    for u, s in failed:
        print(f'  {s} {u}')
    # verify.js lets the page ask for these: they are missing upstream, so the site can't load them either
    with open(os.path.join(CACHE, 'missing.json'), 'w') as f:
        json.dump(sorted({v for u, _ in failed for v in (u, mirror(u)) if v}), f, indent=1)

    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(os.path.join(OUT, 'pack'))
    os.makedirs(os.path.join(OUT, 'a'))
    img, aud, fonts = {}, {}, {}
    for u in urls:
        p = os.path.join(DL, key(u))
        if not os.path.exists(p):
            continue
        data = open(p, 'rb').read()
        mime, ext = kind(data)
        if not mime:
            print(f'  unknown type, skipped: {u}')
        elif mime.startswith('image/'):
            img[u] = f'data:{mime};base64,' + base64.b64encode(data).decode()
        elif mime.startswith('audio/'):
            name = f'a/{key(u)}.{ext}'
            open(os.path.join(OUT, name), 'wb').write(data)
            aud[u] = name
        else:
            fonts[ext] = f'data:{mime};base64,' + base64.b64encode(data).decode()
    with open(os.path.join(OUT, 'pack/assets.json'), 'w') as f:
        json.dump({'img': img, 'aud': aud}, f, separators=(',', ':'))

    src = open(SRC, encoding='utf-8').read()
    # the publish wraps the page in its own doctype/head/body, so keep only <style> and the body
    css = src[src.index('<style>'):src.index('</head>')]
    body = src[src.index('<body>') + len('<body>'):src.index('</body>')]
    # fonts inlined: an artifact may only load fonts from Google Fonts
    for ext in ('ttf', 'woff2'):
        if ext not in fonts:
            sys.exit(f'build: no {ext} font downloaded')
    css, n1 = re.subn(r'url\("https://s3-us-west-2[^)]*\) format\("woff"\),url\("https://static\.wfonts[^)]*\) format\("truetype"\)',
                      f'url("{fonts["ttf"]}") format("truetype")', css)
    css, n2 = re.subn(r'url\("https://cdn\.jsdelivr\.net/gh/ThetaApps[^)]*\) format\("woff2"\),url\("https://raw\.githubusercontent\.com/ThetaApps[^)]*\) format\("woff"\)',
                      f'url("{fonts["woff2"]}") format("woff2")', css)
    if (n1, n2) != (1, 1):
        sys.exit(f'build: @font-face rules changed (matched {n1},{n2}); update tools/artifact/build.py')
    css = css.replace('<style>', '<style>\n:root{color-scheme:dark;background:#000}', 1)
    # the page sits inside the phone's safe-area padding: size the game to what is left
    css = patch(css, '#wrap{position:relative;width:min(100vw,calc(100vh * 1448 / 1086));',
                '#wrap{position:relative;width:min(100vw,calc((100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)) * 1448 / 1086));',
                '#wrap width rule')
    anchor = "const DR_RAW_FALLBACK='https://raw.githubusercontent.com/TeamBlossomDevs/DeltaruneDecomp/chapter2/';\n"
    body = patch(body, anchor, anchor + SHIM, 'DR_RAW_FALLBACK line')
    hook = " if(!MOBILE_BUILD||!/^https?:/i.test(url))return url;\n"
    body = patch(body, hook, hook + " {const packed=await artifactAsset(url);if(packed)return packed}\n", 'mobileAssetSource guard')
    with open(os.path.join(OUT, 'ub.html'), 'w', encoding='utf-8') as f:
        f.write('<title>Undertale Battlegrounds</title>\n' + css + body)

    files = sorted(os.path.relpath(os.path.join(dp, f), OUT) for dp, _, fs in os.walk(OUT) for f in fs if f != 'ub.html')
    with open(os.path.join(OUT, 'files.json'), 'w') as f:
        json.dump([{'path': p} for p in files], f)
    page = os.path.getsize(os.path.join(OUT, 'ub.html'))
    total = sum(os.path.getsize(os.path.join(OUT, p)) for p in files) + page
    print(f'build: {len(img)} sprites, {len(aud)} sounds, {len(fonts)} fonts -> page {page / 1e6:.2f} MB, '
          f'pack {os.path.getsize(os.path.join(OUT, "pack/assets.json")) / 1e6:.2f} MB, {len(files)} files, {total / 1e6:.2f} MB total')
    # artifact limits: page and each file 16MB, one publish 255 files / 64MB
    big = [p for p in files + ['ub.html'] if os.path.getsize(os.path.join(OUT, p)) > 16e6]
    if big or len(files) > 254 or total > 64e6:
        sys.exit(f'build: over the artifact limits (files over 16MB: {big}, {len(files)} files, {total / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
