# MySuperPrettyDashboard · current v0.2.1 development design and behavior

This document reflects build 25-era source, not the first v1 prototype.
The user-approved home has no scrolling: compact Pretty Calendar header,
seven-day week, five pinned Quick Access items, five genuine Supernote
To-do previews, six customizable shortcuts, five Recent Notes, and a
single row of ten fixed circular decorations.

## Components and real behavior

| Area | Behavior | Configuration | API confidence |
| --- | --- | --- | --- |
| Font | Google Sans Flex, bundled offline at build | Size: Standard / Large / Extra large | Verified on prior Manta screenshot |
| Clock/date/battery | Local time and day; Android battery level plus charging status | No clock/time settings (intentional) | Android standard |
| Weekly calendar | Monday-first; today black; dots use creation date from note FILE_ID where known | No additional settings | Native .note format parsing; tested on previous Manta build |
| Calendar tap | Opens native Calendar | Not configurable | Native app launch community-tested; **specific date selection unsupported** |
| Quick access | First 5 manually pinned files/folders on Home, View all for more; opens actual item | Add / open / remove / reorder in Settings | Uses SDK file open + existing native file manager fallback; device validation pending |
| To-do | Real incomplete tasks read from **the user's Supernote Cloud**, never a second list | Connect / verify / test / disconnect Supernote account | Unofficial community reverse-engineered API; account and device testing needed |
| To-do action | Tapping task or View all opens native To-do | None | Community-tested app launch |
| Shortcut launcher | Exactly 6 configurable actions (Calendar, Files, Favorites, Search, Stars, Last opened note, To-do, New note, Quick access) | Change each of 6 button positions | Distinct real action per option. No dead Keywords option |
| Favorites | Dashboard-managed pinned files/folders, independent of native file star collection | Add / open / remove / reorder in Settings | Same file opener as Quick Access; no native-favorites deep-link |
| Stars | Scans handwritten Supernote recognized Star Marks; handwriting preview and optional OCR; jump to source page | Handwriting/OCR preview mode | SDK note scan and image renderer from SuperDashboard |
| Recent notes | Up to five available recent .note items; note icons; file access history when available | No count control (fixed at five per approved design) | ReadRecent + fallback to modification when history inaccessible |
| New note | Tries documented system note templates from PluginCommAPI and creates with PluginFileAPI; checks result, shows error if declined | Standard vs real-time recognition | SDK documented; device testing pending |
| Floating Home | Show/hide and six starting positions; draggable overlay | Position and enable/disable | Native Java bridge from SuperDashboard, device verification pending |
| Decorations | Ten custom monochrome icons in equal-sized circles, one straight row | Fixed by design | Static local assets |

## Configuration

`src/PrettySettings.tsx` is the sole settings screen shown by the app.
It edits `src/prettyPrefs.ts` settings, saved in
`/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/pretty-prefs.json`.
A serialized save queue and re-read on Done detect persistence failures.
Quick access and Favorites are independent lists; neither modifies
Supernote's native collection.

Some inherited SuperDashboard data paths are retained for migration,
especially floating Home and scanner behavior, but the legacy configurable
zone renderer no longer controls home layout. Settings correctly describe
what the home implements and do not offer an unimplemented Keywords action.

## Source support and caveats

The official Supernote plugin stack supports React Native and documented
SDK operations. Some native Android activities (Calendar, To-do, Files) and
the floating Home overlay are community-tested integrations rather than
officially published deep-links. The native Calendar has **no verified
deep-link to a particular day** in the sources checked; the date launch
does not guarantee the selected date. Cloud To-do uses an unofficial
interface documented by Task Hub's public, hardware-tested research.
The owner must explicitly connect an account. Passwords are not saved;
tokens are Keystore-encrypted. Never claim its live data is verified
until the device returns an actual task list.

All icons are custom vector drawings checked against user's native Supernote
photos and publicly documented icon imagery, not original firmware asset
files. See `docs/icon-audit.md` for a glyph-by-glyph mapping.

## Required Manta acceptance tests
1. Settings Quick Access: pin 2 notes and 1 folder, use **Open**, return
   to Home, ensure all pins survive plugin close/reopen, test View all.
2. Settings Favorites: pin at least 1 different item; verify Favorites
   displays and opens it; remove it and confirm blank-state behavior.
3. Settings shortcut changes: change 2 of 6 buttons, save, reopen, test each.
4. Settings display size and floating Home location: save, reload, inspect
   visual fit and button position on another Supernote screen.
5. Native To-do sign-in: connect account, test sync, compare 5 title/due dates
   with native app; test expired-session and network failure messages.
6. New note: create Standard and recognition notebook on device; confirm
   document written and opened (no false-positive from success:true result:false).
7. Star mark preview: inspect one note with multiple recognized stars;
   verify handwriting strips visible and page links correct.
8. Verify charging symbol, battery refresh without ghosting, and local
   calendar note-creation dots.
9. Verify the static footer matches approved circles and remains in one row.
10. Verify exact application identity appears as MySuperPrettyDashboard.

A passing Android build proves compilation/package validity, not these
on-device behaviors.

## References
- https://support.supernote.com/en_US/Tools-Features/using-the-new-sidebar
- https://support.supernote.com/favorites-and-quick-access
- https://support.supernote.com/en_US/Tools-Features/introduction-to-the-toolbar
- https://docs.supernote.com/en
- https://github.com/Sparkinman/task-hub-supernote-plugin
