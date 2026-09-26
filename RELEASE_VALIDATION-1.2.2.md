# KinForge 1.2.2 Validation

24 September 2026. Product of Dreams of Serene Landscapes.

## Release Scope

This release adds working library placement controls. Trees, collections, subcollections and report drafts can each be assigned to a book. Collections and subcollections can also be assigned to a parent collection, and the interface keeps nested collections in the same book when their parent collection moves. Existing report drafts inherit their tree placement when older saved data has no explicit destination. Invalid cross-book links are cleared during state hydration so a tree or report cannot silently appear in a different book.

People, families, events, media and other records continue to belong to their tree and therefore inherit that tree's book and collection placement. Placement is stored in the account state and travels through the existing local, cloud, webapp and desktop sync paths.

## Automated Checks

- 595 unit/component tests passed across 29 files.
- 49 cloud integration checks passed, including account isolation, guest denial, member roles, private-field filtering, recovery, stale writes and deletion.
- The focused placement unit suite passed: invalid cross-book links are repaired and legacy report destinations inherit the tree destination.
- Two development browser scenarios passed, covering tree, nested collection and report placement plus reload and invalid-link cleanup.
- Four production browser scenarios passed, covering the two placement scenarios plus existing library and report navigation checks.
- Production build, TypeScript and whitespace checks passed. The requirements-preservation check retained 26 documents and 1,433 indexed blocks; preservation is not feature-completion testing.
- Browser tests used synthetic local records and did not inspect or modify the user's real cloud library.

## Native and Packaging Checks

- Built Apple Silicon and Intel DMG, PKG and ZIP artifacts, plus Windows x64 setup and portable EXE artifacts.
- Both DMGs passed checksum verification and read-only mounting. Their application versions and architectures were checked as 1.2.2 / arm64 and 1.2.2 / x86_64, with no AppleDouble files found. The arm64 DMG needed one retry after a stale 1.2.1 image was ejected.
- Both Mac ZIP archives passed integrity checks. Both PKGs expanded successfully, declared version 1.2.2, contained the expected architecture and targeted /Applications. The PKG installation flow itself was not run.
- The Apple Silicon packaged app and the installed /Applications app each passed the native launch smoke test in isolated profiles. The checks covered profile navigation, saved tree persistence, family branches, relationships, maintenance preview/apply/undo/redo and the native network boundary.
- Windows artifacts are built here but are not executed on Windows hardware. The Intel build is not executed on Intel hardware.

## Security and Distribution Limits

No Developer ID signing identity is installed. Mac applications/installers remain unsigned by a Developer ID and are not Apple-notarized. Strict Apple signature verification therefore does not pass for these unsigned bundles; Gatekeeper may block a downloaded copy. A working local native test is not notarization.

The downloadable webapp archive is a client build, not a standalone hosted database. Cross-device account sync continues to use the published KinForge service. Reports and downloaded files are snapshots; changing placement later does not move copies that were already downloaded.

The previous installed Mac application is retained in the new release folder's Previous Applications folder. Existing library data and account sessions are not replaced by test data.
