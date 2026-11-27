# Feature 10 — requirements and acceptance
Baseline 00.09.114 (af1761cc); last verified release tag 00.10.117. Source audit at 834d2a83 plus corrections in this commit. S = source present, P = partial, D = device dependent, G = release gate. Not an assertion of successful CI or device tests. Original numbered 114 checklist not fully recovered.
| ID | Requirement | Status / evidence |
|---|---|---|
| F01 | Build beneath SmartyNote | S PrettyHome BUILD_LABEL; verify package |
| F02 | Clock weight 600 | S prettyDesign |
| F03 | Remove Favorites from settings | S main settings group removed, saved data retained |
| F04 | Compact reorder-only Quick Access | S separate screen, up/down |
| F05 | Tap plus opens individual add | S |
| F06 | Long press pin edits one | S |
| F07 | Long press plus/empty or Edit opens reorder | S separate screen, not in-place drag |
| F08 | Filled star and persistence | S asset/allowlist; corrected 12-icon test |
| F09 | Add/edit/delete/reorder save/read-back | S/P hidden add accessibility, device gestures |
| F10 | Seven-day full-width date rail with two EVENT columns | S row-major |
| F11 | Natural heights, minimized whitespace | S visual verification required |
| F12 | Retain event row design/tap details | S |
| F13 | Fixed retrieval timestamp | S above scroll |
| F14 | TRMNL h:mm, spaced uppercase AM/PM, en dash, period elision | S timezone must match |
| F15 | Ceil minute duration, h/m | S |
| F16 | Zero-minute start only, no duration or overlap | S details corrected |
| F17 | Wrap past seven-character compact reference | S strip :00/spaces for decision only |
| F18 | Overlap always wraps duration and marker together | S |
| F19 | Time unbroken and right aligned | P long range may shrink/truncate at device width |
| F20 | All-day no duration/conflict/busy interval | S |
| F21 | Agenda Today resets date/scroll | S |
| F22 | Native Calendar Today | D firmware behavior unresolved |
| F23 | Native Calendar diagnostic | S/D Settings > Dashboard navigation > Inspect native Calendar navigation |
| F24 | Task name tap no action | S |
| F25 | Long press task name edits | S |
| F26 | Gray check circle completes real task | S/D |
| F27 | Note icon only on linked task | P/D cloud metadata unknown |
| F28 | Open exact linked notebook/page | P/D safe fallback if unresolved |
| F29 | Task-note diagnostic | S/D Settings > Supernote To-do > Inspect note-link fields |
| F30 | Native Search/custom Stars retained | S regression needed |
| F31 | Diagnostics readable | S scrollable status output; device check |
TRMNL parity limits: device timezone vs TRMNL configured timezone; all-day date ranges, filtering/title substitutions and time-window behavior not proven identical. No Worker changes. Seven-character reference is applied to compact-equivalent length while preserving TRMNL display text. Row-major agenda and separate reorder screen are implementation choices. 
## Regression gates (developer)
- [ ] Verify tag contains audit changes, TypeScript, calendar/prefs/navigation/cloud Jest tests, asset generation, Android/package verification, version/identity and download.
- [ ] Add targeted tests for agenda layout, shortcut gestures and diagnostic rendering as needed; check current CI results rather than assuming pass.
- [ ] Preserve no-scroll four quadrants, header, grayscale, approved icons, selected-day events/notes, first three created notes and overflow, recent notes, New Note, native Search/Stars.
- [ ] Calendar cache, manual/five-minute refresh, date changes, 8–6 schedule extension, exact conflicts and +N, instant/all-day excluded from occupied rail.
- [ ] Native task read/edit/complete, due-date/overdue, no duplicates, safe failure; settings persistence/reopen, no account reset.
- [ ] Preserve retired modules as retired (weather/art/availability cards).
## Device punch list after successful package
1. Upgrade without reset; check displayed version, settings/links/connection, clock weight, home fits.
2. Quick access: add a test shortcut, choose filled star, save, open, long press edit, reorder via Edit or long press plus/blank, reopen, delete test shortcut; existing pins intact.
3. Calendar: busy-day View all, date rail and two columns per day, natural heights, fixed timestamp while scrolling, previous/next/Today, tap event/back. Compare TRMNL time/duration, short vs long wrap, overlap always wraps, zero-minute and all-day events. Report clipped ranges.
4. Native Calendar: navigate to a non-today date, return to dashboard, tap Calendar and report resulting date. Settings > Dashboard navigation > Inspect native Calendar navigation; capture full report, scroll if needed.
5. Linked task: use a synced disposable linked task and unlinked task. Run Settings > Supernote To-do > Inspect note-link fields BEFORE completing test tasks; capture full report. Verify note icon only for linked task, opens exact page; name tap no action, long press edit, gray check completes disposable task; verify native sync.
6. Smoke test selected-day notes, recent notes, native Search/Stars, New Note, manual refresh and save/reopen settings. Report only deviations plus both diagnostics.
