# V15 Progress Sync Changelog

- Added normalized sectioned Firestore progress storage.
- Added automatic migration from old UID/email progress documents.
- Added background load/save retry with request timeouts.
- Removed destructive reset-to-default behavior on load errors.
- Removed noisy false sync/load notifications.
- Added Firebase ID-token refresh retry.
- Preserved all Z-score history calculation bases.
- Prevented repeated same-day predictor writes.
- Added progress and Z-score regression tests.
