# Pretty Calendar live feed — implementation v0.3

## Architecture

Source of truth (already maintained by the owner; this project MUST NOT edit it):

`Redacted`

The existing iPhone Shortcut / Cloudflare Worker / TRMNL plugin run unchanged.
MySuperPrettyDashboard issues a read-only HTTPS GET, validates the complete
JSON document, atomically saves a replacement **local app-private snapshot**,
and renders both compact/expanded views from the same snapshot.
No calendar records are replicated into the Supernote native Calendar.
No additional accounts, credentials, or cloud calendars are created.

JSON event fields used: `summary`, `start`, `end`, `all_day`, `calendar`.
Metadata fields: `updated_at`, `polled_at`, `polled_epoch`.
Descriptions, locations, URLs, attendees and permanent event IDs are **not**
part of the feed and are never invented.

## Home layout

No scrolling on the primary Home. Three two-column bands:

- Quick access / genuine Supernote To-do
- Six shortcuts / recent notes
- Notes for selected day / Events for selected day

A Monday–Sunday date strip switches both lower panels' selected date. The
Events panel uses a fried-chicken icon. Each event row is:

```
EVENT NAME [up to 2 lines]           START–END · DURATION
```

The right-hand time range stays visually secondary and right-aligned. There
is **no description**. All-day entries show `All day`. Event names
are tappable and open an in-dashboard read-only detail panel with full title,
date, start/end, duration, calendar, all-day flag. `View all` opens an
expanded scrolling agenda of the next seven days starting with today.
Tapping its day heading selects that day on Home.

## Sync, cache, and errors

- Refresh on dashboard open or reentry and the existing refresh button.
- Automatic refresh at 5-minute intervals only while React Native reports
  the app is active; refresh on foreground/wake events (best effort).
- HTTP timeout: 15 seconds. At most one in-flight request at a time.
- Last valid JSON snapshot saved privately in the Android app's files dir using
  `android.util.AtomicFile`. Invalid or truncated JSON never replaces it.
- A failed request keeps the latest good snapshot and marks the view cached.
- Valid feed with `events: []` produces an intentional empty state;
  failure without cache produces an unavailable state.
- Settings shows last successful retrieval, source updated/polled timestamps,
  refresh now, and privacy guidance.
- No task/event titles are logged or transmitted to any other service.

## Event selection

- Local device time zone is used for timed events.
- All-day ISO dates are handled as literal calendar days without UTC-to-local
  conversion. Their end date is interpreted as exclusive.
- Events spanning multiple days appear for each applicable day.
- All-day events display ahead of timed events; time order is chronological.
- Explicitly cancelled meeting titles (`Canceled: …`, `Cancelled: …`)
  are not displayed. Other cancellations not encoded in the feed **cannot**
  be detected reliably.
- Duplicate named holiday records on the same date range are collapsed.
- Other identical events are retained because feed lacks stable IDs.

## QA

GitHub Actions must run TypeScript, offline Jest unit tests, Android compile,
package verification and release publication. Tests include all-day UTC
boundary, duplicate holidays, cancelled titles, overlapping meetings,
30-minute durations, rolling seven-day dates, offline failover, snapshot
replacement, and schema validation. Physical Manta tests remain necessary
for network permission, encrypted/private disk behavior, wake refresh, taps,
layout fit, and battery usage.

**Privacy/security check:** The owner should confirm that transferring work
calendar metadata to the existing Cloudflare Worker is permitted by their
employer and that the public feed URL has adequate access controls. This
implementation does not change the worker or add authentication. The assistant
has not verified source endpoint access from its environment; the actual
response schema still requires on-device validation.
