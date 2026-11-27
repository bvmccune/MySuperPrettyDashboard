# Calendar feed configuration

SmartyNote reads a user-configured HTTPS Cloudflare Worker endpoint ending in `/calendar`. Configure the URL locally in plugin Settings; it is stored in encrypted preferences. Do not publish the endpoint or credentials. The integration does not write native calendar records.

The JSON response contains an `events` array. Each event supplies `summary`, `start`, `end`, `all_day`, and `calendar`. Optional feed metadata includes `updated_at`, `polled_at`, and `polled_epoch`. All-day end dates are exclusive. Timed events use the device's timezone.

The dashboard refreshes on demand and periodically while active. A failed fetch retains the last valid local snapshot. Protect calendar feeds with appropriate access controls and obtain authorization before transferring workplace calendar data.
