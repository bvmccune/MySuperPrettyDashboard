# Native Supernote To-do integration

The owner requested **the real Supernote To-do list**, not a different task
database. v0.2 implements a read-only preview of incomplete tasks via the
Supernote Cloud schedule/task/all endpoint. It is **off until the owner opts
in** under MySuperPrettyDashboard settings.

## User flow
1. Enable Supernote Cloud To-do sync on the Manta.
2. Go to MySuperPrettyDashboard Settings → Supernote To-do.
3. Enter the Supernote account credentials and (if prompted) the verification
   code delivered by Supernote. Only official viewer.supernote.com endpoints
   receive these login requests; the plugin's server is not involved.
4. A short-lived session is saved in Android Keystore-encrypted private
   preferences under MySuperPrettyDashboard's unique alias; no plaintext
   password, verification code or account task data is persisted by the plugin.
5. The home preview reads actual task titles, due dates, and completion states.
   Completed tasks are excluded; due dates drive the black OVERDUE indicator.
   Tapping a task or View all opens the native To-do app.

## Behavior and limitations
- Supernote does not publish a native plugin To-do read API. This is a
  **best-effort unofficial Supernote Cloud API** based on public protocol
  research in GPLv3 Task Hub (Sparkinman/task-hub-supernote-plugin); this code
  is independently written. API behavior is not guaranteed to persist.
- The home makes no fake local fallback. If sign-in, internet permission,
  network, sync, or token validity fails, the section shows the error and
  directs the user to the connection flow.
- Session expires after roughly 30 days. There is no documented refresh
  endpoint: reconnect as needed.
- Task database is NOT editable via this dashboard. Tapping a circular marker
  opens the native app rather than claiming to complete an unsynced task.
- Unofficial API maxResults=1000 is used; truncated responses are flagged,
  not silently treated as complete.
- The cloud bridge requires both Android INTERNET and PluginHost
  plugin.permission.INTERNET (requested contextually).
- On-device testing required before claiming sign-in or task list is working.
