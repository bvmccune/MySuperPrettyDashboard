# Supernote Manta icon audit — build 24

This is an audit of **every functional icon displayed by the Pretty home**
against public Supernote documentation and the owner's November 23 photographs.
It does **not** claim that our artwork is extracted from firmware.

| Pretty icon | Native/documented reference | Result |
| --- | --- | --- |
| New note | Manta sidebar: spiral notebook with small plus | Recreated as spiral book with plus. Native form closely followed; not an original firmware asset. |
| Last opened note | Manta sidebar: open book with spine loops/dots | Redrawn in build 24: double page with vertical binding dots. Not original firmware asset. |
| To-do | Manta sidebar app tile: ring-bound calendar with a checkmark | Matches structure and meaning, but manually traced. |
| Calendar | Manta sidebar app tile: ring-bound calendar with date grid | Matches structure and meaning, but manually traced. |
| Files | Manta sidebar app tile: tabbed folder | Matches general outline; Supernote's exact folder edge differs slightly. |
| Search | Native quick settings: magnifying glass | Matches structure; manually traced. |
| Settings | Native quick settings: gear | Matches structure; manually traced. |
| Home | Supernote floating Home control: house inside circular surround | Inner house recreated; circular styling is provided by host UI/overlay, not the icon file. |
| Recent notes | Native sidebar Recent Files: clock | Clock recreated; recent file rows now use native-style notebook icon. |
| Quick access | Native note toolbar: link/chain icon with plus | Changed from a notebook to a link/plus icon in build 17. Header is visually related to Quick Access; settings manage independent pins. |
| Favorites | Native Files uses a five-point STAR marker for a favorite file | Recreated the five-point star inside a folder outline. Composite is custom; the star mark is documented native iconography, distinct from recognized handwritten Star Marks. |
| Stars | Native note Star Mark: outline five-point star | Uses matching outline star; feature scans recognized star marks rather than file favorites. |
| Document | Native Files/Document: file/page symbol | Recreated in matching monochrome line weight. |
| Notebook | Native Files/Note: notebook with spiral binding | Recreated and shown for `.note` files. |
| Shortcut heading | No corresponding native feature heading | Project-specific four-tile grid; not claimed native. |
| Edit/back | Generic pencil and back chevron | Compatible line-style approximations, not demonstrated original assets. |
| Charging | Device battery charge status | Custom lightning emblem; charging state comes from Android battery API. |
| Decorative footer: ten circles | Personal symbols, no native counterparts | Intentionally original illustrations, styled with consistent 2px strokes. |

Public sources:
- https://support.supernote.com/en_US/Tools-Features/using-the-new-sidebar
- https://support.supernote.com/favorites-and-quick-access
- https://support.supernote.com/en_US/Tools-Features/introduction-to-the-toolbar
- https://ib.supernote.com/x2/X2_V3.25.39_EN.pdf

**Implementation rule:** An existing documented icon can be recreated with
geometry checked against the user's device photos. No generic placeholder icon
should be described as a native system asset. User-chosen exceptions, such as
the heart for Favorites and the decorative footer, must be labeled custom.

## Interface/API support

- Official published plugin stack: React Native with Supernote Plugin SDK;
  documented file operations, note creation, and note template retrieval through
  `sn-plugin-lib` (`PluginFileAPI`, `PluginCommAPI`).
- Community-tested native navigation: Android app launch intents for Files,
  Calendar, To-do; custom Java bridge for file stats, battery, floating Home.
  These are not official public deep-link APIs.
- To-do preview: account-authenticated read-only Supernote Cloud, based on
  documented community reverse engineering. This is **not** an official SDK
  method and must be explicitly enabled/tested by the owner.
- Date to Calendar: no verified native arbitrary-day deep-link. User can tap
  date/day to launch Calendar; selected-day behavior remains unimplemented.
- Quick access / Favorites: dashboard-managed paths that open the exact file
  or folder. They do NOT represent or overwrite native Supernote collections.
