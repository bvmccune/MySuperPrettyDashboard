# Build 45+ · Full Manta change-list acceptance matrix

This work implements the user's complete November 24 feedback following
build 44. It does **not** alter the existing Pretty Calendar Cloudflare
Worker, iPhone automation, TRMNL plugin, or native Supernote Calendar.

## Header / navigation
- [x] Network/Wi-Fi indicator beside battery (Android ConnectivityManager).
- [x] Battery + charge, Refresh, and Settings on date row; bolder time at same
  nominal icon height as New Note, on second row.
- [x] Black circular lizard inside Home closes to underlying note.
- [x] **No external floating Home overlay**: always hide, do not recreate.
- [x] Today circle and all weekday circles exactly 48 scaled units, matching
  header lizard circle.
- [x] Calendar shortcut opens *Pretty Dashboard's* seven-day agenda anchored
  on **today**, not native Supernote Calendar (which has no verified selected-
  date deep link).
- [x] Notes Folder shortcut opens actual `/storage/emulated/0/Note`.
- [x] Last Opened Note closes the overlay back to the originating note.
- [ ] Direct native sidebar entry or gesture invoking an individual plugin:
  not documented by Supernote. Use the official Plugins toolbar and optional
  Quick Access link to the launching notebook; do not hook private gestures.

## Approved icons
- [x] Section icons each inside 48-unit matched circles: coffee, sprouting
  plant, jellyfish with motion whiskers, crystal with sparkles, d20, chicken
  drumstick. No hearts and no gratuitous sparkle marks on other illustrations.
- [x] Header New Note standalone glyph (not circled); Shortcuts icons standalone
  with **no boxed buttons**; large 36-unit functional glyphs.
- [x] Practical note icon in Recent and Notes Created.
- [x] Pending native To-do tasks display a light gray dashed unchecked-box/
  checkmark, not a completed indicator.
- [x] No decorative footer row.

## Content / layout
- [x] Fixed non-scrollable Home with three equal-height bands, separated by
  full-width horizontal rules and non-intersecting vertical dividers.
- [x] Section header labels unchanged size, now bold; consistent smaller
  content text, larger Shortcuts and Event titles. Exact visual fit requires
  physical Manta inspection.
- [x] Quick Access uses maximum rows that fit, with starred document marks,
  editable in device-local Settings; titles wrap.
- [x] Authentic read-only Supernote To-do, with black OVERDUE badges, due
  dates MM/DD and dashed pending glyph.
- [x] Six shortcut default actions: Calendar (today's dashboard agenda),
  Notes folder, Favorites, Search, Keywords, Last opened note (close).
- [x] Old settings `stars` entries migrate to `keywords`; no Star OCR
  vs handwriting setting and no external floating bubble settings.
- [x] `Notes Created` fixed section label, day `DDD MM/DD` aligned right;
  list includes individual note creation timestamps.
- [x] Events title `DDD MM/DD Events`, click event for full details.
- [x] Event rows show summary left; start–end plus duration right.
- [x] Overflow `+N more` indicator opens agenda if events exceed rows.
- [x] Overlapping events show two overlapping circles.
- [x] Calendar day tap switches Notes Created / Events; calendar header date
  resets selected date to today.
- [x] Header actions Edit/View all use identical small styling.
- [x] Favorites popup closes before opening its item.
- [x] Manual refresh rescans note creation times and relevant files, plus
  real To-do and calendar.
- [x] One owner-controlled New Note chooser: exact name, real-time recognition
  or standard note, system template, explicit Create. No auto names and no
  undocumented attempt to open an internal native creation screen. The plugin
  SDK's documented `getNoteSystemTemplates` and `createNote` are used.

## Calendar pages
- [x] Read-only Event Details redesigned as a compact, bordered summary card,
  presenting title, date, time, duration, calendar and overlapping status.
- [x] Seven-day agenda redesigned as a two-column day-card grid with readable
  headings, all-day grouping, time ranges, duration and conflict markers.
- [x] Agenda navigation to previous / next seven-day blocks, and Today.
- [x] Empty day outside observed feed event span is labeled accordingly.
- [ ] Historical events **not provided by the source JSON** cannot be
  retrieved. This plugin does not change the Worker, maintain extra historical
  event copies or fabricate past meetings. A separately approved
  worker-side historical window would be required if seven days of past data
  must always be available. The JSON may also omit past meetings from today.

## Technical validation
- [x] Remove obsolete shortcuts/settings that no longer match home UI.
- [x] Read-only Cloudflare calendar feed URL remains encrypted on Manta.
- [x] No account/event data or sensitive URLs added to public GitHub source.
- [ ] On-device tests: glyph fidelity, font sizes, visual spacing, create-note
  on firmware, native Notes folder navigation, native To-do tasks, Wi-Fi state,
  source response dates, selected-day agenda, refresh performance and e-ink
  artifacts. A successful GitHub Actions build alone does not prove these.
