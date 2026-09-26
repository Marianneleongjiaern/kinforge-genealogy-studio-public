# KinForge 1.2.1 Validation

24 September 2026. Product of Dreams of Serene Landscapes.

## Release Scope

This release adds working saved-item download/delete controls, plain-language meanings, custody/protection/care records and symbols, shared-member privacy enforcement, and recovery-code download fixes. It does not certify every historical Ideas.md capability or complete MacFamilyTree/MyHeritage/Ancestry parity.

Custody Change, Custody Removal and Custody Restoration are separate choices. Records attach to a person, family or relationship and support dates, status, agency, contact, jurisdiction, case reference, notes, sources, attachments and visibility. The event label alone does not establish a legal outcome.

## Automated Checks

- 593 unit/component tests passed across 28 files.
- 49 cloud integration checks passed, including account isolation, guest denial, member roles, private file filtering, hidden-field preservation, privacy-flag tampering, recovery, stale writes, revocation and deletion.
- 87 browser workflow scenarios have passing results across the full run and focused reruns. This was not one uninterrupted clean run: two stale selectors were corrected; an offline test passed after the build stopped changing; one development-only helper assertion moved to four unit tests while all ten recovery UI tests remained intact. Two shared-account navigation click timeouts passed on an unchanged rerun; their initial timing cause remains unconfirmed.
- Final focused production reruns passed: 30 generation/glyph/workspace tests and 19 saved-item/protection/terms/report-symbol/recovery tests.
- Five shared-library browser scenarios passed, covering real owner/editor/viewer interactions, shared editing without losing private fields, visibility revocation, guests after sign-out, cross-device tree deletion and Undo after a privacy-rejected change.
- Production build, TypeScript and whitespace checks passed. The requirements-preservation check retained 26 documents and 1,433 indexed blocks; preservation is not feature-completion testing.
- Exported 142 labelled glyphs, including all 20 new protection/care events.

Browser tests used synthetic local accounts and records. They did not inspect or modify the user's real cloud library.

## Native and Packaging Checks

- Built Apple Silicon and Intel DMG, PKG and ZIP artifacts, plus Windows x64 setup and portable EXE artifacts.
- Both DMGs passed checksum verification and mounted read-only. Their application versions and architectures were checked as 1.2.1 / arm64 and 1.2.1 / x86_64. No AppleDouble files were found in the mounted images.
- Both Mac ZIP archives passed integrity checks. Both PKGs expanded successfully and declared version 1.2.1, the expected architecture and an /Applications installation target. Running the PKG installation flow itself was not tested.
- The Apple Silicon packaged app and the installed /Applications app each passed native launch, profile navigation, persistence, family branches, relationships, maintenance, Undo/Redo and network-boundary checks in isolated profiles.
- A separate native recovery smoke test exercised the actual repository Electron app and file bridge, confirming exact recovery-file bytes, the saved path, real filesystem-failure fallback, deliberate acknowledgement and temporary-data cleanup.
- The previous installed 1.2.0 application was moved intact to the new Downloads release folder's Previous Applications folder. Existing account sessions and library data were not replaced by test data.
- Windows artifacts are installer executables containing an x86-64 app. They were built here but were not executed on Windows. The Intel build was not executed on Intel hardware.

## Security and Distribution Limits

No Developer ID signing identity is installed. Mac applications/installers remain unsigned by a Developer ID and are not Apple-notarized. Strict Apple signature verification does not pass for these unsigned bundles; Gatekeeper may block a downloaded copy. A working local native test is not notarization.

Private sensitive records are filtered by the server, not merely hidden in the interface. Invited signed-in members can retrieve explicitly shared details; guests cannot retrieve account libraries or their files. Only owners can change existing privacy settings. Shared editors cannot delete a container holding hidden owner records.

Reports and downloaded files are snapshots. Changing source-record visibility or revoking membership cannot retract copies already shared or downloaded. The cloud is not end-to-end encrypted. Password recovery uses a private recovery code, not email delivery. Deletion affects the current library, not historical recovery snapshots or unrelated local files.

Downloads contains the installers, portable builds, webapp and website archives, release notes, cloud guide and future genealogy-app feature checklist. The webapp archive is a client build, not a standalone hosted database; cross-device account sync uses the published KinForge service.
