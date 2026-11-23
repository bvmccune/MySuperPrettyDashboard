# MySuperPrettyDashboard: Supernote API and icon audit

Checked against official Supernote documentation, device photos supplied by
the owner, and documented device-tested community implementations.

## Reference sources
- Official developer docs: https://docs.supernote.com/en/
- Toolbar and native Quick Access icon: https://support.supernote.com/en_US/introduction-to-the-toolbar
- Native sidebar: https://support.supernote.com/Tools-Features/using-the-new-sidebar
- Favorites semantics: https://support.supernote.com/en_US/organizing/favorites-and-quick-access
- User-supplied Manta photographs from November 23, 2026.
- SDK research: https://github.com/apclark31/supernote-plugin-research
- Community device-tested Android intents: https://github.com/AgP42/SuperDashboard/blob/main/docs/FINDINGS.md
- Community-tested native To-do cloud read: https://github.com/Sparkinman/task-hub-supernote-plugin

## Icon verification table
The actual icon assets are custom, monochrome SVG drawings rasterized as PNG.
Official support screens publish icon references, but the official plugin SDK
does not expose a reusable native firmware icon pack. Do not claim exact assets.

| Dashboard role | Native icon reference | Implemented drawing |
|---|---|---|
| Quick access header | Official toolbar: chain link with plus | Link with plus |
| To-do launcher/header | User native sidebar: calendar/check | Calendar/check |
| Calendar | User native sidebar | Calendar page |
| Files | User native sidebar | Folder |
| New note | User native sidebar: spiral notebook with plus | Notebook with plus |
| Last opened note | User native sidebar: open notebook | Open notebook |
| Recent notes | User native sidebar: clock | Clock |
| Search | Native panel photo | Magnifying glass |
| Stars | Native note stars | Five-point star |
| Favorites | Official Files: star on file | Starred file/folder, semantic match |
| Settings | Native panel photo | Gear |
| Home | Native panel photo | House |
| Note files | Native note icon in Recent | Notebook icon |
| Shortcut grid | No native equivalent verified | Four squares (custom) |
| Battery/charging | Native status bar photo | Battery/bolt, visual match |
| Footer | Personal themes, no native equivalents | Custom 10-icon art |

## Documented APIs and limitations
- The official React Native SDK exposes PluginFileAPI.createNote/openFile,
  PluginCommAPI.getNoteSystemTemplates and file/permission APIs. File opening
  uses SDK first and the community-tested native-intent fallback.
- No documented day-specific native Calendar deep-link parameter was found.
  Earlier speculative selectedDate/date extras were removed; date taps launch
  the Calendar but cannot guarantee that day is selected. Still open requirement.
- Native Favorites/Quick Access lists are not available to third-party plugins
  through a documented SDK API. The dashboard now intentionally maintains
  real, separate, persistent file-link lists with add, browse, reorder, remove,
  and test-open actions; no empty Favorites placeholder.
- Native To-do reading uses a publicly documented community-tested unofficial
  Supernote Cloud transport. It reads existing tasks; no duplicate local list.
  Cloud sign-in remains optional, session token encrypted with Android Keystore.
  Native To-do write/completion is not advertised as supported.
- Star previews use existing SuperDashboard scanner geometry and supported
  note file APIs; content image/OCR is best-effort, with an explicit no-preview
  message if not available.
- Android battery API exposes charge status and percentage. The UI must still
  be checked for residual ghosting on device; build success cannot prove it.
- Settings and Preferences implement and persist Quick access, Favorites,
  six shortcuts, text size, Star preview mode, note mode, floating Home position.
  Save operations serialize and Done waits for and verifies the saved result.
- The main dashboard cannot scroll. Secondary pickers, settings, and View all
  can scroll.

## On-device acceptance tests
1. Verify UI text, icon appearance, battery and icon overlap/ghosting.
2. Add real notebook, PDF and folder to Quick access. Test open and restart.
3. Add a dashboard Favorite; test open and restart/persistence.
4. Verify native Supernote To-do task titles and due dates via Cloud sync.
5. Create blank recognition and standard notes and confirm opening the note.
6. Open Stars, verify handwriting/recognized-text previews and page jumps.
7. Verify floating Home initial position and dragging on native pages.
8. Confirm Calendar launches from date and shortcut; selected-date jumping is
   not supported unless an actual documented/verified deep link is found.
9. Test long task/filename truncation and fixed home screen no-scrolling.

Do not mark any of these device-dependent steps complete based on code review
or Android packaging alone.
