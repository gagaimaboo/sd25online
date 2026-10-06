// Plays the built artifact offline on an emulated phone and checks that it needs
// nothing from other hosts. Run after tools/artifact/build.py, before publishing.
// usage: node tools/artifact/verify.js   (exits 1 on any failure)
const {chromium,devices}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ROOT=path.join(__dirname,'../../.artifact-build');
const SHOT=path.join(__dirname,'../../.artifact-cache/verify.png');
const TYPES={'.html':'text/html','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg'};
// roughly what the artifact host allows: own files, data: and blob:, and the script CDNs
const CSP="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com";
(async()=>{
 const page=fs.readFileSync(path.join(ROOT,'ub.html'),'utf8');
 const doc=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`;
 const srv=http.createServer((q,s)=>{
  const u=decodeURIComponent(q.url.split('?')[0]);
  if(u==='/'){s.writeHead(200,{'content-type':'text/html','content-security-policy':CSP});return s.end(doc)}
  const f=path.join(ROOT,path.normalize(u));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)){s.writeHead(404);return s.end()}
  s.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
 }).listen(0);
 const base=`http://localhost:${srv.address().port}/`;
 const b=await chromium.launch();
 const ctx=await b.newContext({...devices['iPhone 13 landscape']});
 const p=await ctx.newPage();
 const errs=[],ext=new Set();
 p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith(base)||!/^https?:/.test(u))return r.continue();ext.add(u);return r.abort()});
 // the CSP stops most outside loads before they reach the network, so count its violations too
 await p.addInitScript(()=>{window.__blocked=[];document.addEventListener('securitypolicyviolation',e=>window.__blocked.push(e.blockedURI))});
 await p.goto(base,{waitUntil:'domcontentloaded'});
 for(let i=0;i<120;i++){if(await p.evaluate(()=>typeof screen==='string'?screen:'loading')!=='loading')break;await sleep(500)}
 // sprites can be <img> or tinted canvases
 const ok=im=>`!!(${im}&&(${im}.naturalWidth||${im}.width))`;
 const title=await p.evaluate(`({screen,heart:${ok('images.heart')},font:${ok('images.fntMainAtlas')},froggit:${ok('images.froggit&&images.froggit[0]')},buttons:${ok('images.btn_fight_sel')},menus:['main','text','small','sans','logo','save'].every(k=>ui6Img[k])})`);
 // a Susie + Noelle party battle on the new engine pulls in the DELTARUNE sprites
 await p.evaluate(()=>{newEngineEnabled=true;vanillaMode=false;sandboxConfig.vanilla=false;sandboxConfig.enemyOverrides={};supportPartyIds=[];sandboxConfig.party=['classic','susie','noelle'];bossSelected=BOSS_OPTIONS.findIndex(b=>b.id==='froggit');startPracticeMode()});
 for(let i=0;i<40;i++){if(await p.evaluate(()=>DR.ready))break;await sleep(500)}
 await sleep(1500);
 const battle=await p.evaluate(()=>({party:!!(NB.S&&NB.S.party&&NB.S.party.length===3),deltarune:!!(DR.ready&&DR.gfx.frame('spr_headsusie',0)?.naturalWidth)}));
 const audio=await p.evaluate(async()=>{const a=await loadAudioAsset(Object.values(MUSIC)[0]);return a.src.startsWith('blob:')});
 for(const u of await p.evaluate(()=>window.__blocked))if(/^https?:/.test(u))ext.add(u);
 // assets missing upstream (404 on the CDNs too) fail on the real site as well
 const missing=new Set(JSON.parse(fs.readFileSync(path.join(__dirname,'../../.artifact-cache/missing.json'),'utf8')));
 for(const u of [...ext])if(missing.has(u))ext.delete(u);
 await p.screenshot({path:SHOT});
 await b.close();srv.close();
 const checks={title:title.screen!=='loading',sprites:title.heart&&title.font&&title.froggit&&title.buttons,menus:title.menus,party:battle.party,deltarune:battle.deltarune,audio,offline:ext.size===0,errors:errs.length===0};
 if(!checks.sprites||!checks.menus)console.log('title screen:',JSON.stringify(title));
 for(const [k,v] of Object.entries(checks))console.log(`${v?'ok  ':'FAIL'} ${k}`);
 if(ext.size)console.log('external requests:',[...ext].slice(0,10));
 if(errs.length)console.log('page errors:',errs.slice(0,10));
 console.log('screenshot:',SHOT);
 process.exit(Object.values(checks).every(Boolean)?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
