# KinForge 1.2.0 Release Validation

Date: 24 September 2026.

## Completed Checks

- 449 unit tests passed.
- 8 isolated cloud integration tests passed against D1 and R2-compatible storage.
- 23 production-browser workflow checks passed; the 7 cloud/report checks were rerun after the last report-editor change.
- Cross-device changes, automatic previous-device transfer, account isolation, report drafts, books, subcollections, offline pending edits, conflict persistence, recovery, sharing and revocation were exercised.
- Responsive navigation was checked at phone, portrait tablet, landscape tablet and desktop sizes.
- Production cloud health returned version 1.2.0. An unauthenticated library request was rejected with HTTP 401.
- Two synthetic production accounts and independent sessions verified cloud persistence and isolation. No personal family records were used for these tests.
- The packaged Apple Silicon Mac app signed into the live service, received a remote person update and signed out successfully.
- The Apple Silicon application was installed from its DMG into /Applications/KinForge Genealogy Studio.app. That installed copy passed the family chart, profile, timeline, refresh, centred child branches, relationship legend, maintenance, undo/redo and unrelated-network blocking checks without JavaScript errors.
- Both Mac DMG checksums passed. Both mounted successfully and contained version 1.2.0, with arm64 and x86_64 executables respectively.
- Both Mac ZIP files passed archive integrity checks.
- Both PKG installers expanded successfully, declare version 1.2.0, target /Applications, and restrict installation to the matching processor architecture.
- Windows setup and portable executables were generated; the packaged application is x86-64.
- Older installed KinForge app bundles were moved intact into the release folder's Previous Applications directory. The existing application data directory was not replaced or deleted.

## Limits And Remaining Work

- These Mac artifacts are unsigned and not Apple-notarized. No valid Developer ID signing identity was available. Strict Apple code-signature verification does not pass. Gatekeeper may block opening downloaded copies; do not describe these as signed production releases.
- Windows execution and Intel Mac hardware execution were not tested on their respective devices.
- Mobile/iPad checks used browser emulation, not physical-device testing.
- Password reset uses a private recovery code, not emailed reset links. Cloud data is not end-to-end encrypted.
- Sharing grants access to the whole selected library, including sensitive documents. Removing access cannot erase previously downloaded copies.
- Reopening a private library requires an online account check. An open library retains pending edits during temporary disconnection.
- Generated report files outside the app and unrelated files in Downloads are not automatically uploaded. Records and attachments saved inside KinForge are synced.
- The pre-existing demo portrait placeholders can show as broken sample images; this release does not claim a complete media-quality audit.
- A requirements register and passing tests for this update do not prove that all historical Ideas.md requests or complete competitor parity have been delivered.

The webapp ZIP contains client assets, not a standalone cloud server. The hosted service also requires the protected worker, database and object storage. Use the published KinForge URL for the functioning cross-device app.
