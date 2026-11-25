#!/usr/bin/env python3
"""Generate offline, e-ink-safe line icons for MySuperPrettyDashboard.

SVG designs intentionally use Supernote-like geometry: fine black strokes,
simple silhouettes, no emoji/color, and a common 32x32 viewport. Section illustrations are rendered within matching circles by React.
"""
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "pretty"
OUT.mkdir(parents=True, exist_ok=True)

icons = {
    # Official Supernote Toolbar's Quick Access icon is a linked chain +, not a notebook.
    # Reference: https://support.supernote.com/en_US/introduction-to-the-toolbar
    "quick": '<path d="M14 8l4-4c4-4 10 2 7 6l-6 7M18 24l-4 4c-4 4-11-1-8-6l6-8M12 19l8-8M26 19v10M21 24h10"/>',
    "new-note": '<path d=\'M7 3h19v20H7zM4 4v19M4 8h6M4 14h6M4 20h6M14 10h8M14 15h7M14 20h6M25 28v-9M20.5 23.5h9\'/>',
    "last-note": '<path d="M4 8q5-3 11 0v19q-6-3-11 0zM17 8q6-3 11 0v19q-5-3-11 0zM16 7v20M10 11h3M10 16h3M10 21h3M20 12h5M20 17h5M20 22h5"/><circle cx="16" cy="11" r="1" fill="#111"/><circle cx="16" cy="17" r="1" fill="#111"/><circle cx="16" cy="23" r="1" fill="#111"/>',
    "notebook": '<path d=\'M9 3h19v26H9zM5 3v26M5 8h7M5 14h7M5 20h7M15 11h9M15 16h9M15 22h6\'/>',
    "wifi": '<path d="M3 12c7-6 19-6 26 0M7 17c5-4 13-4 18 0M11 22c3-2 7-2 10 0"/><circle cx="16" cy="27" r="1.6" fill="#111" stroke="none"/>',
    "wifi-off": '<path d="M3 12c4-3 9-5 13-5M21 8c3 1 6 2 8 4M7 17c2-1 3-2 5-2M18 15c3 0 5 1 7 2M11 22c3-2 7-2 10 0M3 3l26 26"/><circle cx="16" cy="27" r="1" fill="#111"/>',
    "keywords": '<path d="M4 5h15l10 11-10 11H4zM9 11h11M9 16h8M9 21h6"/><circle cx="22" cy="16" r="1" fill="#111"/>',
    "pending": '<path d="M8 3h16v26H8zM12 2v5M20 2v5M12 15l3 3 6-7" stroke="#888" stroke-dasharray="2.2,2.2" stroke-width="1.6"/>',
    "charging": '<path d="M18 2 8 18h8l-2 12 11-17h-8z"/>',
    "chicken": '<path d=\'M11 21c-3-3-5-7-3-11C10 3 19 2 25 8c5 5 4 13-2 16-4 2-8 0-10-2l-4 4M9 26c-1 3-4 3-5 1-2 0-3-2-2-4 1-2 3-2 4-1l4-4\'/><path d=\'M12 8c3-3 7-3 10 0\' stroke-width=\'1.5\'/>',
    "file": '<path d="M8 3h11l6 6v20H8zM19 3v7h6M12 15h9M12 20h9M12 25h6"/>',
    "files": '<path d="M3 10h10l3 3h13v14H3zM3 10V6h10l3 3h10"/>',
    "calendar": '<rect x="4" y="7" width="24" height="21" rx="1.5"/><path d="M4 14h24M10 3v8M22 3v8M10 18h2M16 18h2M22 18h2M10 23h2M16 23h2"/>',
    "todo": '<rect x="4" y="7" width="24" height="21" rx="1.5"/><path d="M4 14h24M10 3v8M22 3v8M11 21l4 4 7-8"/>',
    "list": '<circle cx="7" cy="8" r="1.1"/><circle cx="7" cy="16" r="1.1"/><circle cx="7" cy="24" r="1.1"/><path d="M13 8h15M13 16h15M13 24h15"/>',
    "recent": '<circle cx="16" cy="16" r="12"/><path d="M16 8v8l6 4"/>',
    "search": '<circle cx="13" cy="13" r="8.8"/><path d="M19.5 19.5L28 28"/>',
    "favorites": '<path d="M2 10h11l3 3h13v15H2zM2 10V6h10l3 3h12"/><path d="M19 14l2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.5-3.4 4.8-.7z" fill="white"/>',
    "star": '<path d="M16 2.8 20.3 11.5 30 12.9 23 19.7 24.7 29.4 16 24.8 7.3 29.4 9 19.7 2 12.9 11.7 11.5z"/>',
    "star-filled": '<path d="M16 2.8 20.3 11.5 30 12.9 23 19.7 24.7 29.4 16 24.8 7.3 29.4 9 19.7 2 12.9 11.7 11.5z" fill="#111" stroke-width="1"/>',
    "book": '<path d="M16 27C11 23 7 24 3 24V6c5-1 10 0 13 4 3-4 8-5 13-4v18c-4 0-8-1-13 3zM16 10v17M6 11h6M20 11h6"/>',
    "home": '<path d="M4 15 16 5l12 10M8 13v15h16V13M14 28v-9h5v9"/>',
    "settings": '<path d="M13 2h6l1 4 3 2 4-2 3 5-3 3v4l3 3-3 5-4-2-3 2-1 4h-6l-1-4-3-2-4 2-3-5 3-3v-4l-3-3 3-5 4 2 3-2z"/><circle cx="16" cy="16" r="5"/>',
    "grid": '<rect x="3" y="3" width="10" height="10" rx="1"/><rect x="19" y="3" width="10" height="10" rx="1"/><rect x="3" y="19" width="10" height="10" rx="1"/><rect x="19" y="19" width="10" height="10" rx="1"/>',
    "edit": '<path d="M6 24l1-6L23 2l7 7-16 16-6 1zM19 6l7 7"/>',
    "plus": '<path d="M16 4v24M4 16h24"/>',
    "refresh": '<path d="M28 14a12 12 0 0 0-21-6L3 12M3 4v8h8M4 18a12 12 0 0 0 21 6l4-4M21 20h8v8"/>',
    "back": '<path d="M21 5 10 16l11 11"/>',
    # User-approved whimsical functional illustrations, not a decorative footer.
    "lizard": '<path d=\'M4 22c3-1 4-5 7-6 3-2 6-1 8-4 3-4 8-4 10-1 1 3-3 5-6 4-1 4-5 7-8 5-4 0-4 6-10 6M12 17l-4-5M16 20l2 6M22 14l5 6M9 21l-5 1\'/><circle cx=\'26\' cy=\'11\' r=\'1\' fill=\'#111\' stroke=\'none\'/>',
    "stars": '<path d="M15 2 18 11 27 12 20 18 22 27 15 22 8 27 10 18 3 12 12 11zM26 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
    "dice": '<rect x=\'15.5\' y=\'4\' width=\'13\' height=\'14\' rx=\'1.6\' transform=\'rotate(9 22 11)\'/><rect x=\'3.5\' y=\'13.5\' width=\'15\' height=\'15\' rx=\'1.6\' transform=\'rotate(-9 11 21)\'/><circle cx=\'20\' cy=\'9\' r=\'1.2\' fill=\'#111\'/><circle cx=\'25\' cy=\'13\' r=\'1.2\' fill=\'#111\'/><circle cx=\'9\' cy=\'19\' r=\'1.2\' fill=\'#111\'/><circle cx=\'14\' cy=\'24\' r=\'1.2\' fill=\'#111\'/>',
    "ramen": '<path d="M4 15h24c0 12-7 14-12 14S4 27 4 15zM3 15h26M8 11c-4-5 3-6 0-9M16 11c-4-5 3-6 0-9M24 11c-4-5 3-6 0-9M20 14l9-10"/>',
    "controller": '<path d="M9 10h14c3 0 5 4 6 12 0 3-3 4-5 2l-5-5h-6l-5 5c-2 2-5 1-5-2 1-8 3-12 6-12zM7 15h9M11.5 11v9"/><circle cx="22" cy="14" r="1"/><circle cx="26" cy="17" r="1"/>',
    "jellyfish": '<path d=\'M5 16C5 4 27 4 27 16c-3 4-7 1-11 3-4-2-8 1-11-3zM9 20c-2 3 2 5 0 9M16 20v10M23 20c-2 3 2 5 0 9\'/><path d=\'M3 6 1 4M29 6l2-2M2 13H0M30 13h2\' stroke-width=\'1.4\'/><circle cx=\'11\' cy=\'13\' r=\'1\' fill=\'#111\'/><circle cx=\'21\' cy=\'13\' r=\'1\' fill=\'#111\'/>',
    "plants": '<path d=\'M16 15V9M16 11C9 11 7 8 7 3c5 0 9 2 9 8zM16 9c0-6 5-8 10-7-1 6-4 9-10 9zM7 17h19l-2 13H9zM7 17h19M12 24h9\'/>',
    "octopus": '<path d="M8 20V13c0-12 16-12 16 0v7M8 20c-9 1 0 12 2 5M12 20c-6 10 3 11 4 4M20 20c-1 9 9 9 5 0M24 20c8 2 6 11 0 8"/><circle cx="12" cy="15" r="1" fill="#111"/><circle cx="20" cy="15" r="1" fill="#111"/>',
    "rocks": '<path d=\'M4 27 6 14 14 5 23 11 29 24 23 29H9zM14 5l-1 13L4 27M13 18l10-7M13 18l10 11M23 11l6 13\'/><path d=\'M26 2v4M24 4h4M2 5l3 2-3 2-2-2zM29 9l2 2-2 2-2-2z\' stroke-width=\'1.25\'/>',
    "coffee": '<path d=\'M6 11h19v12a9 9 0 0 1-9 7h-1a9 9 0 0 1-9-8zM25 14h2c5 0 5 9-2 9M4 30h25M10 2c-3 4 4 5 0 9M19 2c-3 4 4 5 0 9\'/>',
}

for name, paths in icons.items():
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" '
           'viewBox="0 0 32 32"><g fill="none" stroke="#111" stroke-width="2.15" '
           'stroke-linecap="round" stroke-linejoin="round">' + paths + '</g></svg>')
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(OUT / (name + ".png")))
print("Generated", len(icons), "Supernote-style icons in", OUT)

# Approved original vector set. The compressed JSON is the exact source artwork;
# extract it before rasterizing for the React Native asset loader.
import base64, lzma, hashlib, json, re
source=Path(__file__).resolve().parents[1] / 'assets' / 'approved' / 'originals.json.xz'
packed=source.read_bytes()
assert hashlib.sha256(packed).hexdigest() == 'a6986e155f5ebc21ae54c160e6fdaeca835dad3009ed05ae5605dfcb1a1808a3', 'Approved artwork archive changed'
originals=json.loads(lzma.decompress(packed))
source_dir=source.parent / 'svg'
source_dir.mkdir(parents=True,exist_ok=True)
for filename,svg in originals.items():
    if filename.endswith('.svg'):
        (source_dir/filename).write_text(svg,encoding='utf-8')
        cairosvg.svg2png(bytestring=svg.encode(),write_to=str(OUT/filename.replace('.svg','.png')),output_width=240,output_height=240)
assert len(list(source_dir.glob('*.svg'))) == 22
aliases={'lizard':'gecko-transparent','plants':'plant','rocks':'crystal','coffee':'coffee-circle','chicken':'mcnuggets-refined','pending':'check-circle','charging':'lightning','last-note':'stardust','favorites':'star-filled','files':'open-notebook','quick':'open-notebook','todo':'check-circle','book':'open-notebook','recent':'notebook','file':'notebook','new-note':'new-note','calendar':'calendar','keywords':'search'}
import shutil
for dest,src in aliases.items():
    if dest!=src: shutil.copyfile(OUT/(src+'.png'), OUT/(dest+'.png'))
# Use the approved battery outline; the fill is drawn dynamically from the actual level.
empty=re.sub(r'(id="charge-fill"[^>]*?width=")[^"]+(")',r'\g<1>0\2',originals['battery.svg'])
cairosvg.svg2png(bytestring=empty.encode(),write_to=str(OUT/'battery.png'),output_width=272,output_height=176)
# Preserve the original placeholder in the approved archive. Quantize only
# its rendered copy to 16 evenly spaced grayscale levels. Composite
# transparency on white first, so it never becomes a dark fringe.
from PIL import Image
from io import BytesIO
cat=Image.open(BytesIO(base64.b64decode(originals['cats-placeholder.png']))).convert('RGBA')
white=Image.new('RGBA',cat.size,(255,255,255,255))
white.alpha_composite(cat)
gray=white.convert('L')
lut=[min(15,(v+8)//17)*17 for v in range(256)]
gray.point(lut).convert('RGB').save(OUT/'cats-placeholder.png')
shutil.copyfile(OUT/'stardust.png',OUT.parent/'icon.png')
print('Verified and rasterized all 22 approved SVGs')

# Weather Iconic: preserve original SVG geometry and render transparent monochrome masks.
weather_source=Path(__file__).resolve().parents[1]/'assets'/'weather-iconic'
weather_map=json.loads((weather_source/'mapping.json').read_text(encoding='utf-8'))
assert len(weather_map['conditions'])==16
weather_names=set(weather_map['conditions'].values())|set(weather_map['variants'].values())
assert weather_names=={p.stem for p in (weather_source/'svg').glob('*.svg')}
assert (weather_source/'LICENSE').is_file()
for name in sorted(weather_names):
    svg=(weather_source/'svg'/(name+'.svg')).read_bytes()
    rendered=cairosvg.svg2png(bytestring=svg,output_width=240,output_height=240)
    mask=Image.open(BytesIO(rendered)).convert('RGBA').getchannel('A')
    assert mask.getextrema()==(0,255), f'Invalid transparent mask: {name}'
    mono=Image.new('RGBA',(240,240),(0,0,0,0))
    mono.putalpha(mask)
    mono.save(OUT/('weather-'+name+'.png'))
print('Weather Iconic:',len(weather_names),'licensed monochrome assets')

# Preserve the supplied blank-sign SVG wrapper; render to a native image at build time.
cairosvg.svg2png(url=str(ROOT/'assets'/'artwork'/'rocky-sign.svg'),write_to=str(OUT/'rocky-sign.png'),output_width=240,output_height=240)
