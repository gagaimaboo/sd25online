// Lists every remote asset index.html can load, for tools/artifact/build.py.
// usage: node collect.js <index.html> <out.json>
// Runs the page offline: every http(s) request is recorded and aborted, every
// mobileAssetSource() call is recorded, and the static asset tables are walked.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const [src,out]=process.argv.slice(2);
 const b=await chromium.launch();
 const p=await b.newPage();
 const net=new Set();
 await p.route('**/*',r=>{const u=r.request().url();if(/^https?:/.test(u)){net.add(u);return r.abort()}return r.continue()});
 await p.goto('file://'+path.resolve(src),{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{window.__rec=new Set();const o=mobileAssetSource;mobileAssetSource=async u=>{window.__rec.add(u);return o(u)}});
 for(let i=0;i<120;i++){if(await p.evaluate(()=>screen)!=='loading')break;await sleep(500)}
 await p.evaluate(()=>{try{nbLoadAssets()}catch(_){}try{DR.load()}catch(_){}});
 // wait for the loaders to go quiet
 let last=-1;
 for(let i=0;i<60;i++){
  await sleep(1000);
  const n=net.size+await p.evaluate(()=>window.__rec.size);
  if(n===last)break;last=n;
 }
 const stat=await p.evaluate(()=>{
  const out=new Set();
  const walk=v=>{if(typeof v==='string'){if(/^https?:/.test(v))out.add(v)}else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk)};
  for(const t of [IMG,NB_ASSETS,SFX,MUSIC,EMBED])walk(t);
  for(const [n,[w,h,xo,yo,ids]] of Object.entries(DR_ASSETS.spr))ids.forEach(g=>out.add(DR_RAW+`sprites/${n}/${g}.png`));
  for(const f of Object.keys(DR_ASSETS.font))out.add(DR_RAW+`fonts/${f}/${f}.png`);
  return [...out];
 });
 const rec=await p.evaluate(()=>[...window.__rec].filter(u=>/^https?:/.test(u)));
 const all=[...new Set([...stat,...rec,...net])].sort();
 fs.writeFileSync(out,JSON.stringify(all,null,1));
 console.log(`collect: ${stat.length} from tables, ${rec.length} asset loads, ${net.size} requests -> ${all.length} urls`);
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
