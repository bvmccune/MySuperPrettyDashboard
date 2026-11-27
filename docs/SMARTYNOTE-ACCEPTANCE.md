# SmartyNote release acceptance checklist

Use the newest release candidate whose GitHub Actions workflow passed every step. Keep v68 available for rollback. Do not use production-critical tasks for the first live write test.

## Device acceptance — required before stable release
1. Install the candidate; report Manta firmware version and visible SmartyNote build number. The toolbar must show the approved filled jellyfish SmartyNote launcher, no old plugin clip or dashboard-only task buttons. Home must open directly, close on the SmartyNote title, and reopen.
2. Send a full-screen dashboard photo showing all quadrants. Verify the approved type weights, compact rows, native dotted and solid dividers, wide shallow Quick access buttons, and no scrolling or clipped rows, Wi-Fi/battery, the header icon artwork and New Note.
3. Select days with an overlap, adjacent timed appointments and all-day events. Verify exact hatch/separator and +N behavior. Open event details and View all. Select another date in the native Calendar, leave, then launch Calendar from SmartyNote's header and pinned shortcut. Note whether Today is selected.
4. Add Calendar, Stars, a folder, a note and a PDF in Quick access. Set their names and icons; reorder, save, reopen. Verify the eleven approved icon choices and launch each destination. For Stars, verify a known starred notebook page opens. Native PDF star search is available via Native search → Star; direct native category selection is not documented.
5. Verify a date with more than three created notes; switch days, check note count, timestamp and group divider.
6. Enable Supernote To-do sync and use two disposable tasks, one linked from handwriting. From SmartyNote long-press one task, edit name and due date using the calendar picker (including Today and No due date), save, then native-sync. Complete the other by tapping its circle. Verify native results and unrelated tasks are unchanged. Compare overdue label (above date). Tap the linked-note icon and report whether it reaches the right page and whether the native handwriting indication appears. Exact handwriting highlighting is not guaranteed.
7. Turn off Wi-Fi for a disposable task edit; it must fail visibly, not mark the task complete. Reconnect, refresh, and check sync.
8. Create a real-time recognition note and a standard note, then reopen both. Verify saved settings survive a plugin restart. Weather, availability, Rocky, possum, old home overlay and legacy capture buttons must not appear.

## Outstanding native integration
The native account profile image is no longer required. The Stardust button must open native device Settings, never SmartyNote Settings. The direct Stars category remains unresolved; do not claim a custom Stars view is native.

## Release gates
- TypeScript, regression tests, asset allowlist and both package layers must pass.
- Native task mutation/sync, Calendar Today behavior, and visual acceptance require the physical device.
- Record unresolved firmware behavior; do not promote as a stable release until accepted. The normal Calendar launch and notebook-page/native To-do alternatives remain functional even if the more precise native APIs are unavailable.
