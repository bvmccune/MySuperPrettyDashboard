#!/usr/bin/env python3
"""Release asset allowlist. Only active SmartyNote artwork is generated."""
from pathlib import Path
import hashlib, json, lzma, re, shutil
import cairosvg

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'pretty'
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
source=ROOT/'assets'/'approved'/'originals.json.xz'
packed=source.read_bytes()
assert hashlib.sha256(packed).hexdigest()=='a6986e155f5ebc21ae54c160e6fdaeca835dad3009ed05ae5605dfcb1a1808a3', 'Approved originals changed'
originals=json.loads(lzma.decompress(packed))

def render(svg,dest,width=240,height=240):
    cairosvg.svg2png(bytestring=svg.encode('utf-8'),write_to=str(dest),output_width=width,output_height=height)
# The compressed originals remain only a source archive, never a packaged asset.
for name in ('wifi','calendar','open-notebook','new-note','notebook','auto-refresh','settings','search','refresh','calendar-dot'):
    render(originals[name+'.svg'],OUT/(name+'.png'))
render(originals['lightning.svg'],OUT/'charging.png')
render(originals['notebook.svg'],OUT/'file.png')
empty=re.sub(r'(id="charge-fill"[^>]*?width=")[^"]+(")',r'\g<1>0\2',originals['battery.svg'])
render(empty,OUT/'battery.png',272,176)

revision=ROOT/'assets'/'approved'/'revision'
for source_name,target in [('planned','recent'),('files','files'),('keywords','keywords'),('stars','stars'),('rocks','rocks'),('coffee','coffee'),('plants','plants'),('lizard','lizard')]:
    render((revision/(source_name+'.svg')).read_text(encoding='utf-8'),OUT/(target+'.png'))
# Existing utility glyphs, not retired decorative artwork.
for name,body in {
    'wifi-off':'<path d="M3 12c4-3 9-5 13-5M21 8c3 1 6 2 8 4M7 17c2-1 3-2 5-2M18 15c3 0 5 1 7 2M11 22c3-2 7-2 10 0M3 3l26 26"/><circle cx="16" cy="27" r="1" fill="#111"/>',
    'plus':'<path d="M16 4v24M4 16h24"/>',
    'back':'<path d="M21 5 10 16l11 11"/>'
}.items():
    render('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="#111" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">'+body+'</g></svg>',OUT/(name+'.png'))

render((revision/'stardust.svg').read_text(encoding='utf-8'),OUT/'profile.png')
launcher=(revision/'jellyfish.svg').read_text(encoding='utf-8')
render(launcher,ROOT/'assets'/'icon.png')
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    path=ROOT/'android'/'app'/'src'/'main'/'res'/('mipmap-'+density)
    path.mkdir(parents=True,exist_ok=True)
    for name in ('ic_launcher.png','ic_launcher_round.png'):
        render(launcher,path/name,size,size)
expected={'new-note','file','files','calendar','recent','search','stars','settings','charging','notebook','plus','refresh','back','lizard','plants','rocks','coffee','wifi','wifi-off','keywords','battery','calendar-dot','open-notebook','auto-refresh','profile'}
actual={p.stem for p in OUT.glob('*.png')}
assert expected==actual,(expected-actual,actual-expected)
print('Release artwork:',len(actual),'active icons and filled jellyfish launcher')
