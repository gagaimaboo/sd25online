import json,os,re,sys
from PIL import Image
SRC=sys.argv[1]; OUT=sys.argv[2]
m=json.load(open(SRC+'/manifest.json'))
SKIP=re.compile(r'^spr_(krisb?_|kris_|susie|ralsei|bname|head(kris|susie|ralsei)|bt(act|defend|fight|item|spare|tech)|tensionbar|tensionmarker|tplogo|tm_|textbox|face_|tvlandfont|zapper|rouxls|lanino|shutta|ch3_|dw_snow|cakesmoke|undyne_dw|hpname|hpslash|attack_(cut|mash|slap)|cc_fountain|bg_fountain|dw_fountain|bullet_dice|sunbolt|snowflake|yheart|rudebuster)')
keep={n:v for n,v in m.items() if not SKIP.match(n)}
print('keep',len(keep),'of',len(m))
frames=[]
for n,v in keep.items():
    for i,f in enumerate(v['files']):
        im=Image.open(os.path.join(SRC,f)).convert('RGBA')
        frames.append((n,i,im))
# shelf pack, tallest first, into 2048 sheets
frames.sort(key=lambda t:(-t[2].height,-t[2].width))
SW=2048;sheets=[];pos={}
cur=None;x=y=rowh=0
def newsheet():
    s=Image.new('RGBA',(SW,SW),(0,0,0,0));sheets.append(s);return s
cur=newsheet()
for n,i,im in frames:
    w,h=im.size
    if w>SW or h>SW:raise SystemExit('too big '+n)
    if x+w>SW:x=0;y+=rowh+1;rowh=0
    if y+h>SW:cur=newsheet();x=y=rowh=0
    cur.paste(im,(x,y));pos[(n,i)]=(len(sheets)-1,x,y,w,h);x+=w+1;rowh=max(rowh,h)
# crop last sheet height
last=sheets[-1];bb=last.getbbox();
if bb:sheets[-1]=last.crop((0,0,SW,min(SW,bb[3]+1)))
os.makedirs(OUT,exist_ok=True)
for k,s in enumerate(sheets):s.save(f'{OUT}/dk_atlas_{k}.png',optimize=True)
meta={}
for n,v in keep.items():
    mm={k:v[k] for k in ('w','h','ox','oy','frames','bbox','playback','playbacktype') if k in v}
    mm['f']=[pos[(n,i)] for i in range(len(v['files']))]
    meta[n]=mm
json.dump(meta,open(f'{OUT}/dk_atlas.json','w'),separators=(',',':'))
print('sheets',len(sheets),[os.path.getsize(f'{OUT}/dk_atlas_{k}.png') for k in range(len(sheets))],'meta',os.path.getsize(f'{OUT}/dk_atlas.json'))
