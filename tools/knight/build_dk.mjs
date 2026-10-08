import * as esbuild from 'esbuild';
import fs from 'fs';
const out=process.argv[2];
const patches={
 'render/sprites.js':[[/export async function loadSprites\([^)]*\)\s*\{[\s\S]*?\n\}/,"export async function loadSprites() {\n  return globalThis.DK_SPRITES || new Map();\n}"]],
 'render/draw/gm.js':[
  ["  const c = tintInto(document.createElement('canvas'), img, color);","  const c = tintInto(document.createElement('canvas'), img, color);\n  c.__knight = img.__knight; c.__idle = img.__idle;"],
  ["  g.drawImage(img, 0, 0);\n  if (key) remember(key, c);\n  return c;\n}\n\nexport function drawSpriteExt","  g.drawImage(img, 0, 0);\n  c.__knight = img.__knight; c.__idle = img.__idle;\n  if (key) remember(key, c);\n  return c;\n}\n\nexport function drawSpriteExt"]],
 'render/canvas.js':[
  ["    ctx.fillStyle = COLORS.bg;\n    ctx.fillRect(0, 0, VIEW_W, VIEW_H);","    ctx.fillStyle = COLORS.bg;\n    if (state.embed) ctx.clearRect(0, 0, VIEW_W, VIEW_H); else ctx.fillRect(0, 0, VIEW_W, VIEW_H);"],
  ["    drawSnowBackdrop(ctx,","    if (!state.embed) drawSnowBackdrop(ctx,"],
  ["    drawBackground(ctx, state, sprites);","    if (!state.embed) drawBackground(ctx, state, sprites);"],
  ["    const tbEarly = !!state.tensionBar?.early;","    const tbEarly = !state.embed && !!state.tensionBar?.early;"],
  ["    if (!tbEarly) drawTensionBar(ctx, state, sprites);","    if (!tbEarly && !state.embed) drawTensionBar(ctx, state, sprites);"],
  ["    drawAttackVfx(ctx, state, sprites);\n    drawRudeBuster(ctx, state, sprites);\n    drawDmgNumbers(ctx, state, sprites);","    if (!state.embed) { drawAttackVfx(ctx, state, sprites);\n    drawRudeBuster(ctx, state, sprites);\n    drawDmgNumbers(ctx, state, sprites); }"],
  ["    drawDialogue(ctx, state, sprites);\n    drawMenu(ctx, state, sprites);","    if (!state.embed) { drawDialogue(ctx, state, sprites);\n    drawMenu(ctx, state, sprites); }"],
  ["    drawHealWriters(ctx, state, sprites);","    if (!state.embed) drawHealWriters(ctx, state, sprites);"],
  ["    drawFightBar(ctx, state.fightBar, sprites, undefined, undefined, state);","    if (!state.embed) drawFightBar(ctx, state.fightBar, sprites, undefined, undefined, state);"]],
};
const plugin={name:'dkpatch',setup(b){
 b.onLoad({filter:/\.js$/},async a=>{
  let src=fs.readFileSync(a.path,'utf8');
  for(const [k,list] of Object.entries(patches)){
   if(!a.path.endsWith('/DEVICE_KNIGHT/'+k))continue;
   for(const [from,to] of list){
    const before=src;
    src=typeof from==='string'?src.split(from).join(to):src.replace(from,to);
    if(src===before)throw new Error('patch missed in '+k+': '+String(from).slice(0,60));
   }
  }
  // the page has no module URL: asset bases come from the host
  src=src.replace(/import\.meta\.url/g,'(globalThis.DK_URL||"https://x/render/x.js")');
  return {contents:src,loader:'js'};
 });
}};
const r=await esbuild.build({entryPoints:['entry.js'],bundle:true,format:'iife',target:'es2020',minify:true,write:false,plugins:[plugin],logLevel:'warning',
 define:{'process.env.KNIGHT_PAIR_DEBUG':'undefined','process.env.KNIGHT_HIT_DEBUG':'undefined','process.env.KNIGHT_PAIR_FRAMES':'undefined'}});
fs.writeFileSync(out,r.outputFiles[0].text);
console.log('bundle',r.outputFiles[0].text.length,'bytes');
