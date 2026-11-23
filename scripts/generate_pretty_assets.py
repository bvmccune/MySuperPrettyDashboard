#!/usr/bin/env python3
"""Generate offline, e-ink-safe line icons for MySuperPrettyDashboard.

SVG designs intentionally use Supernote-like geometry: fine black strokes,
simple silhouettes, no emoji/color, and a common 32x32 viewport. Decorative
icons are non-interactive and rendered within circles by the React UI.
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
    "new-note": '<path d="M8 3h18v21H8zM5 3v21M5 7h5M5 14h5M5 21h5M14 10h7M14 16h7M25 29v-9M20.5 24.5h9"/>',
    "last-note": '<path d="M4 8q5-3 11 0v19q-6-3-11 0zM17 8q6-3 11 0v19q-5-3-11 0zM16 7v20M10 11h3M10 16h3M10 21h3M20 12h5M20 17h5M20 22h5"/><circle cx="16" cy="11" r="1" fill="#111"/><circle cx="16" cy="17" r="1" fill="#111"/><circle cx="16" cy="23" r="1" fill="#111"/>',
    "notebook": '<path d="M10 3h17v25H10zM6 3v25M6 8h6M6 14h6M6 20h6M16 12h7M16 17h7M16 22h5"/>',
    "charging": '<path d="M18 2 8 18h8l-2 12 11-17h-8z"/>',
    "file": '<path d="M8 3h11l6 6v20H8zM19 3v7h6M12 15h9M12 20h9M12 25h6"/>',
    "files": '<path d="M3 10h10l3 3h13v14H3zM3 10V6h10l3 3h10"/>',
    "calendar": '<rect x="4" y="7" width="24" height="21" rx="1.5"/><path d="M4 14h24M10 3v8M22 3v8M10 18h2M16 18h2M22 18h2M10 23h2M16 23h2"/>',
    "todo": '<rect x="4" y="7" width="24" height="21" rx="1.5"/><path d="M4 14h24M10 3v8M22 3v8M11 21l4 4 7-8"/>',
    "list": '<circle cx="7" cy="8" r="1.1"/><circle cx="7" cy="16" r="1.1"/><circle cx="7" cy="24" r="1.1"/><path d="M13 8h15M13 16h15M13 24h15"/>',
    "recent": '<circle cx="16" cy="16" r="12"/><path d="M16 8v8l6 4"/>',
    "search": '<circle cx="13" cy="13" r="8.8"/><path d="M19.5 19.5L28 28"/>',
    "favorites": '<path d="M2 10h11l3 3h13v15H2zM2 10V6h10l3 3h12"/><path d="M19 14l2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.5-3.4 4.8-.7z" fill="white"/>',
    "star": '<path d="M16 2.8 20.3 11.5 30 12.9 23 19.7 24.7 29.4 16 24.8 7.3 29.4 9 19.7 2 12.9 11.7 11.5z"/>',
    "book": '<path d="M16 27C11 23 7 24 3 24V6c5-1 10 0 13 4 3-4 8-5 13-4v18c-4 0-8-1-13 3zM16 10v17M6 11h6M20 11h6"/>',
    "home": '<path d="M4 15 16 5l12 10M8 13v15h16V13M14 28v-9h5v9"/>',
    "settings": '<path d="M13 2h6l1 4 3 2 4-2 3 5-3 3v4l3 3-3 5-4-2-3 2-1 4h-6l-1-4-3-2-4 2-3-5 3-3v-4l-3-3 3-5 4 2 3-2z"/><circle cx="16" cy="16" r="5"/>',
    "grid": '<rect x="3" y="3" width="10" height="10" rx="1"/><rect x="19" y="3" width="10" height="10" rx="1"/><rect x="3" y="19" width="10" height="10" rx="1"/><rect x="19" y="19" width="10" height="10" rx="1"/>',
    "edit": '<path d="M6 24l1-6L23 2l7 7-16 16-6 1zM19 6l7 7"/>',
    "plus": '<path d="M16 4v24M4 16h24"/>',
    "refresh": '<path d="M28 14a12 12 0 0 0-21-6L3 12M3 4v8h8M4 18a12 12 0 0 0 21 6l4-4M21 20h8v8"/>',
    "back": '<path d="M21 5 10 16l11 11"/>',
    # Personal footer: intentionally compact, low-detail silhouettes.
    "lizard": '<path d="M4 22c3-1 4-4 7-6 4-2 6-1 8-4 3-4 8-4 9-1s-3 4-5 4c-1 4-3 6-7 5-5 0-5 6-10 6M13 17l-4-5M16 19l1 6M23 14l4 5M10 20l-4 1"/><circle cx="25" cy="11" r=".7" fill="#111" stroke="none"/>',
    "stars": '<path d="M15 2 18 11 27 12 20 18 22 27 15 22 8 27 10 18 3 12 12 11zM26 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
    "dice": '<rect x="3" y="11" width="15" height="15" rx="1.5" transform="rotate(-9 10 19)"/><path d="M16 12 26 5l4 15-11 7"/><circle cx="8" cy="16" r="1.1" fill="#111"/><circle cx="13" cy="22" r="1.1" fill="#111"/><circle cx="23" cy="14" r="1.1" fill="#111"/>',
    "ramen": '<path d="M4 15h24c0 12-7 14-12 14S4 27 4 15zM3 15h26M8 11c-4-5 3-6 0-9M16 11c-4-5 3-6 0-9M24 11c-4-5 3-6 0-9M20 14l9-10"/>',
    "controller": '<path d="M9 10h14c3 0 5 4 6 12 0 3-3 4-5 2l-5-5h-6l-5 5c-2 2-5 1-5-2 1-8 3-12 6-12zM7 15h9M11.5 11v9"/><circle cx="22" cy="14" r="1"/><circle cx="26" cy="17" r="1"/>',
    "jellyfish": '<path d="M5 16C5 3 27 3 27 16c-4 5-7 0-11 3-4-3-7 2-11-3zM9 19c-3 5 3 6 0 11M15 20v10M22 20c-3 5 3 6 0 11"/>',
    "plants": '<path d="M16 29V12M16 18C7 19 4 15 4 8c7-1 12 2 12 10zM16 14C16 6 21 3 28 4c0 8-5 11-12 10zM9 29h14"/>',
    "octopus": '<path d="M8 20V13c0-12 16-12 16 0v7M8 20c-9 1 0 12 2 5M12 20c-6 10 3 11 4 4M20 20c-1 9 9 9 5 0M24 20c8 2 6 11 0 8"/><circle cx="12" cy="15" r="1" fill="#111"/><circle cx="20" cy="15" r="1" fill="#111"/>',
    "rocks": '<path d="M2 27 8 13l8-6 4 8 9 4v8zM8 13l9 6-1-12M17 19l3-4M8 13l-1 14M17 19l2 8M25 19l-6 8"/>',
    "coffee": '<path d="M6 12h19v10a9 9 0 0 1-9 8h-1a9 9 0 0 1-9-8zM25 14h2c6 0 5 9-2 9M9 2c-4 4 5 4 1 9M18 2c-4 4 5 4 1 9"/>',
}

for name, paths in icons.items():
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" '
           'viewBox="0 0 32 32"><g fill="none" stroke="#111" stroke-width="2.15" '
           'stroke-linecap="round" stroke-linejoin="round">' + paths + '</g></svg>')
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(OUT / (name + ".png")))
print("Generated", len(icons), "Supernote-style icons in", OUT)
