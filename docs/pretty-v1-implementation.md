# MySuperPrettyDashboard v1: implementation and limitations

The home screen matches the owner's November 23 Manta sketch: a fixed no-scroll
portrait composition, compact date/time and seven-day calendar, Quick access
on the upper left, Supernote To-do preview on the upper right, six shortcut
buttons on the lower left, five recent files on the lower right, and ten small
circular monochrome illustrations in a single alternating row at the bottom.

## Implementation details
- **Typography:** Google Sans Flex from the supplied TRMNL Pretty Calendar
  `shared.liquid`; its OFL licensed font is downloaded during CI and bundled
  as an Android font asset. Offline on the device.
- **Iconography:** Supernote-style monochrome icons generated consistently at
  build time from `scripts/generate_pretty_assets.py` as PNG assets.
  These are faithful *stylistic matches*, not extracted proprietary firmware art.
- **Calendar:** Monday-first week, black filled today circle; dots only if
  Android reports a file *creation* date for a .note. Without a trustworthy
  birth time, no marker is shown. No mtime substitution.
- **Quick access:** Uses existing saved `shortcuts` zone entries from Settings
  (files/folders); five on home, View all opens a secondary list.
- **Recent notes:** Uses `readRecent()`; on firmware that blocks /Recent,
  this falls back to recently modified files with the plugin's own open history.
- **To-do:** When Relay's `relay-tasks.json` exists, show five incomplete native
  task mirrors with due dates and black white-text OVERDUE badges. Without Relay,
  show local Dashboard To-do clips (no native due dates). Without either, show
  a helpful empty state. Tapping a task opens its source note, or the native app.
  The circular status marker is read-only; completion is not faked.
- **View all:** Quick access and recent lists open their own overlays; To-do
  opens the native application. Handwritten Star marks have a real on-demand
  scan in a secondary overlay.
- **Favorites:** Opens native Files, where users can navigate to Favorites;
  direct deep-linking to its Favorites tab remains undocumented.
- **New note:** Uses official `PluginFileAPI.createNote` with recognition mode
  (1), then opens the result. If the firmware refuses creation from a document
  context, shows a clear error and opens Files.
- **Settings:** Existing SuperDashboard configuration screen remains available.
  The `shortcuts` zone controls Quick access pins; legacy zones and scanning
  capabilities remain in source for migration. The old arbitrarily arranged
  widgets no longer appear on the custom home screen.
- **Refresh:** Data is reloaded on opening the dashboard or via the
  `dashboard_refresh_all` event, battery/time once a minute.
- **Home no-scroll:** Main content uses flex constraints and hidden overflow,
  with horizontal/vertical dividers kept apart using insets. Only secondary
  View all overlays scroll.
- **Footer:** Ten non-interactive circle-contained icons: lizard, stars, dice,
  ramen, controller, jellyfish, plants, octopus, rocks, coffee.

## Device verification still needed
Test on the actual Manta: exact text sizing versus firmware display dp,
font registration under the plugin host, creation-time availability, native
To-do feed availability, New Note action from note and document contexts,
Favorites navigation, and recognition star scans. Do not treat build success
as proof of these runtime integrations.
