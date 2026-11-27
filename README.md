# SmartyNote

A fixed, monochrome, non-scrolling home dashboard for the Supernote Manta, based on [SuperDashboard](https://github.com/AgP42/SuperDashboard).

## Features
- Weekly date strip and four quadrants: Events, To-do, Quick access, Recent notes.
- Read-only external calendar feed, event details, overlap hatching, back-to-back separators and measured overflow counts.
- Read and update existing Supernote To-do tasks through Supernote Cloud. Tap the circle to complete; long-press the title to edit the name or due date using a calendar picker. Changes are verified against the server, not stored as a separate task list.
- A dynamically fitted two-column grid of up to 30 saved shortcuts, +N overflow, editable labels, eleven approved icon choices, folders, notes, documents, Calendar and Stars.
- Date-specific recently created notes, creation dots, and recent files.
- Native Search, New Note, battery, Wi-Fi, refresh and Settings. Tap the SmartyNote title to return to your note.

## Install and configure
Use the latest **SmartyNote release candidate** in [Releases](../../releases), not an older SuperDashboard package. Copy the `SmartyNote.snplg` into MyStyle, then on the Manta open Settings → Apps → Plugins → Choose Installation Package. Enable the plugin and add its button to the native notebook toolbar. Its filled jellyfish icon launches Home. Stardust on Home opens native Supernote Settings, if the firmware exposes a resolvable vendor launcher.

In SmartyNote Settings, configure your read-only Pretty Calendar endpoint and optionally connect Supernote Cloud for tasks. Enable native To-do synchronization on the Manta. The account session and calendar URL are stored locally in encrypted preferences; credentials and task content are not published. File permission is needed for shortcuts, notes and preferences. Internet permission is needed for the calendar and task integration.

## Platform boundaries
- The approved Stardust artwork replaces the native profile image requirement. Its Settings shortcut resolves the installed vendor Settings launcher; this requires device verification. It never opens plugin Settings as a substitute.
- Native Calendar is requested on Today using a manifest-resolved Android date URI if available. If the installed firmware does not expose that handler, Calendar opens normally and its own Today button is the fallback.
- Stars opens actual starred notebook pages using Supernote's star data and offers native Search for the broader Star category, including PDFs. A documented way to preselect the native Star search category was not found.
- Linked task icons resolve notebook/page metadata. Exact handwriting highlighting is not supported by the verified plugin API. Native To-do remains the alternative. Cloud task writes require internet access and normal native synchronization.
- This is a Manta release candidate, not a claim of live-device certification. See [acceptance checklist](docs/SMARTYNOTE-ACCEPTANCE.md) and [native task integration](docs/native-todo-integration.md).

## Version numbering
SmartyNote uses `00.00.000` (major, feature/design milestone, patch), with GitHub Actions build IDs preserved separately. See the complete [version history](docs/VERSION-HISTORY.md). Historical download links remain valid. New releases show the padded version on the dashboard and in Supernote plugin metadata.

## Build
The release workflow uses Node 20, JDK 21, Android SDK 35, and NDK 27.1.12297006. It prepares the approved icon allowlist and Google Sans Flex, checks TypeScript, runs regression tests, packages the ARM64 plugin and verifies both package layers for retired resources. Use the GitHub Actions workflow for reproducible releases. Build history and older design sources remain available on the prior branch and commits.

## Attribution
Based on SuperDashboard by AgP42 (MIT, see [LICENSE](LICENSE)). Google Sans Flex is licensed under the SIL Open Font License. Both notices accompany the installation package. User-supplied artwork is preserved in its original SVG form.
