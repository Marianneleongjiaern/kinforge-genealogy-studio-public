# KinForge 1.3.0 validation

25 September 2026. Product of Dreams of Serene Landscapes.

## Scope

Optional Google Drive and OneDrive mirrors of the complete account-owner library, plus an account-scoped cloud export library. The existing KinForge cloud database remains the primary cross-device store. See DRIVE_SYNC_SETUP.md for configuration, consent, privacy and transfer limits.

## Completed checks

- 606 unit/component tests across 31 files passed.
- 59 cloud API, privacy and drive integration tests passed. The 10 drive tests use synthetic records and simulated Google/Microsoft endpoints, including OAuth state/PKCE, browser binding, disconnect during authorization, owner-only access, full library/media/export transfer, offline-independent primary saves, conflicts, stale restore decisions, pause during upload, missing-file repair and preservation of independently edited files.
- 16 targeted browser workflows passed: 4 account/cloud workflows, 10 recovery-download workflows and 2 cloud-drive/export workflows. These include offline export persistence, resumed upload, second-device retrieval/deletion, guest isolation and responsive cloud-drive controls at 390, 820 and 1440 pixels.
- The production build and server TypeScript checks passed.
- 3 desktop startup regression tests passed: a fresh profile avoids unnecessary Keychain access, existing sign-ins still require encrypted storage, and an unreadable saved session does not prevent the window from opening.
- Existing requirements preservation passed for 26 documents and 1,433 blocks. This is a document preservation check, not proof that every historical feature request is complete.
- Apple Silicon native workflow checks passed using an isolated test profile, including relaunch persistence, maintenance preview/apply/undo/redo, family generation placement, centered child branches and network restrictions.
- A separate read-only review found no remaining blocker in the four targeted security/concurrency fixes after their regression coverage was added.

## Not Claimed

- Real Google or Microsoft account connection is not yet validated. Both providers require their OAuth app registrations and server-side client credentials before users can connect. No provider credentials or family data were taken from personal accounts for these tests.
- Drive sync is asynchronous. Active apps retry queued work; large libraries should remain open until the providers show Up to date. There is no always-on scheduled drain.
- Apple notarization is not available without Developer ID certificates and Apple notarization credentials. Local ad-hoc signing is not Developer ID signing or notarization.
- Windows EXEs and Intel Mac packages were built, but their workflows were not run on Windows or Intel hardware.
- The targeted tests do not certify every historical feature request or complete parity with competing products.

Package hashes and final artifact checks are delivered alongside the installers in the Applications folder.

The publication follow-up passed 70 combined server/startup tests, including 8 new release-upload/download tests. The installed app in `/Applications/KinForge Genealogy Studio/KinForge Genealogy Studio.app` also passed the native workflow test. See DESKTOP_RELEASE_PUBLISHING.md for the protected old-app replacement limitation and public-download verification procedure.
