# KinForge 1.3.1: Returning-User Startup

## Fixed

- Reproduced the installed Mac blank window with an existing signed-in profile. The renderer crashed while reading `customFactTerms.map` from an older library without that newer field.
- Use the same library schema upgrade for cloud snapshots, cached drafts, legacy device libraries and the guest demo. Fill missing collections with empty values, not sample family records. Preserve existing records and private fields.
- Add a render-error recovery screen instead of leaving the app window empty. Recovery does not erase saved data.
- Create the native window before attempting to unlock saved account credentials. Keep encrypted session storage and trusted-frame checks.

## Faster Reopening

- Render an upgraded local cache while checking its cloud revision. Keep editing locked until remote access and the device's editing lock are confirmed.
- Keep a small account-scoped startup preview (up to 512 KB of text, without attachment bytes) so the tree can appear even while IndexedDB opens. The preview cannot be edited or downloaded and is never used as a sync base. The full durable draft replaces it before controls become available.
- Fetch only a revision response for a clean, unchanged cached library. Dirty drafts and unresolved conflicts still fetch the full remote state before merging.
- Do not immediately repeat a successful startup revision check.
- Show a verified library without waiting for its background cache write to finish.
- Load the workspace and optional drive/export tools on demand. The initial JavaScript entry is approximately 390 KB instead of 2.8 MB; this reduces initial shell loading, not the total size of all features.
- Defer plausibility, duplicate and evidence analysis until Dashboard, Maintenance or Consistency Checker is opened.
- Start drive and export background work after the library is available and unlocked.

## Boundaries

Cloud verification still requires a real network round trip; zero latency is not promised. Mac packages are ad-hoc signed, not Apple-notarized. Windows executables are not publisher-signed. Provider registrations are still needed to activate Google Drive and OneDrive connections.
