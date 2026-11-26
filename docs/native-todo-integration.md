# SmartyNote: real Supernote To-do integration

## Implemented behavior
- The user's existing Supernote Cloud task records are authoritative. No duplicate dashboard task database.
- Enable native To-do syncing (Settings > My Account > Data Sync), connect in SmartyNote Settings, and refresh. Only an encrypted session token is persisted; credentials and task contents are not.
- Open tasks are sorted by due date, undated last. The original due date remains visible on overdue tasks.
- Tap a circle to complete an existing record; long press the title to edit its name and due date. View all opens native To-do.
- Every update reads the current server row, preserves unedited fields including links and unknown metadata, uses PUT (not POST), then verifies the requested state by reading the server again. A failed or unconfirmed write is reported, not marked complete. No offline mutation queue or automatic write retry. Overlapping local refreshes cannot overwrite a successful write with an older snapshot.
- The cloud read asks for up to 1000 rows and explicitly reports truncation. Native sync remains required; the dashboard cannot force the firmware to pull changes at a particular instant.

## Linked handwriting
The note icon appears when the cloud record contains link metadata. On tap the resolver searches Note and Document for local notebooks. It prioritizes stable FILE_ID/PAGEID metadata (including moved/reordered pages), uses a unique path/name plus page number only when stronger identifiers are absent, and refuses ambiguous/stale matches. It opens the zero-based page through the SDK. If the SDK refuses or the link cannot be resolved, the real native To-do app is available through an explicit fallback screen. No speculative Android intent or private database edit.

**Limit:** the public SDK page-opening API is not a task-anchor/highlight API. No verified external intent that selects the exact native handwritten task was found. No guarantee of native handwriting highlighting, exact stroke-level navigation, or mutation of the linked ink. Use the native task's own note icon for that behavior. The cloud write changes the real task status; it does not rewrite the handwritten page. Native To-do list changes and sync timing require Manta acceptance testing. Advanced task controls (moving lists, deleting, reordering) remain in native To-do; this dashboard intentionally supports completion and name/due-date edits, as requested. Native task repeat/priority controls are not exposed by the researched cloud implementation; unknown fields are preserved rather than interpreted.

## Research basis
- Official native To-do user guide: https://support.supernote.com/Whats-New/the-to-do-app (native note link, completion, rename, due date, moving and deleting).
- Manta/Nomad release notes: https://support.supernote.com/en_US/changelog-for-manta-and-nomad (native data sync).
- Official plugin docs index: https://docs.supernote.com/llms.txt. The detailed API index was unavailable to the research fetcher; SDK reference and inherited working SDK opener were cross-checked instead.
- SDK research reference: https://github.com/apclark31/supernote-plugin-research/blob/main/SDK-REFERENCE.md.
- Community protocol evidence: https://github.com/Sparkinman/task-hub-supernote-plugin/blob/main/HANDOFF.md and src/snclient.ts, src/sncloud.ts (reported live account completion/rename, maxResults, PUT semantics, local-midnight dates, status vs completedTime). Independently implemented in SmartyNote; no copied library. This is an unofficial API, not a Supernote support guarantee.
- Inherited native file parser already reads stable FILE_ID/PAGEID from local note metadata; no file mutation is necessary for linking.

## Acceptance tests (device)
1. Use a disposable native task and a disposable task created from a lassoed handwritten note. Sync first.
2. Confirm sorted real tasks, date labels and link icon. Complete one test task from SmartyNote; confirm Cloud and native list after sync.
3. Long press another task, change name/date, save, confirm native result after sync. Check linked-note icon survives. Clear the date and confirm.
4. Tap a linked note icon. Verify exact notebook/page, including after renaming/reordering if metadata permits. Native note icon remains the exact-task alternative.
5. Disconnect Wi-Fi and try a change. It must visibly fail, not disappear optimistically or create a duplicate. Reconnect and refresh before retrying.
6. Ensure unrelated tasks are unchanged. Do not test on irreplaceable production tasks initially.

Mocked tests exercise the request payloads, server refusals, verification, and identity resolution; they are not live account or device tests.
