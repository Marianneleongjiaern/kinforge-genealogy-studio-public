# KinForge 0.3.0

This release is a substantial functional upgrade, not completion of Ideas.md and not a production-certified genealogy platform.

## Working workflows

- Twelve separate pages with shared local archive storage and automatic migration from the earlier localStorage format. Existing data is not deleted.
- IndexedDB transactions, persistent undo/redo, revision-conflict checks, multi-tree management, books and nested collection definitions.
- People, relationships, custom event/fact types, labels, saved text filters, tasks and an audit history.
- Relationship-driven family, genealogy/pedigree, descendant, hourglass and wedge fan views; selectable focus/depth, zoom, pan and SVG download. Rectangular layouts support direction and movable nodes. The fan follows up to two recorded parents per branch; Family shows all relationship types.
- Single-click compact person overview and Show more/Show less details, on-chart navigation between relatives, profile-photo upload/change/removal, original retention and backup of thumbnails.
- Thirty-five event types and thirty-five relationship types with colour-coded symbols/line patterns and readable legends, including dating, engaged, married, separated, divorced, annulled, biological/adoptive/foster/step families, siblings and cousins. Status is user-entered, not inferred.
- Optional private accessibility and single-parent badges; off in charts by default and excluded from sharing-safe exports. Private chart exports require confirmation.
- Source templates, editable fields, transcriptions, per-event citations and research reasoning. Local record CSV import, search and human-reviewed links.
- Date/evidence checks, duplicate suggestions with explanations, and reversible reviewed merges retaining alternate records.
- Offline world map with user-entered coordinates and event-journey lines. No remote tiles or geocoding service.
- Actual image/audio/video/PDF storage and file downloads; original-preserving manual crop, rotate, brightness and contrast. Metadata can link to people, relationships, sources, events or places.
- Validated chromosome-segment CSV import and inspection, per-match totals, duplicate-row removal and overlap warnings. No claims of biological relationship or ethnicity inference.
- Generated reports/lists, editable saved drafts with stale-data warnings, HTML/CSV/text/RTF export, browser printing/PDF, and simple family-book/website HTML export.
- Reviewed core GEDCOM 5.5.1/7 imports, original-file retention, common-record exports, sharing-safe exports and full ZIP backup/restore including media.
- The original Ideas.md is bundled unchanged. The requirement register preserves each listed item's wording and distinguishes partial, missing and Mac-untested work.

## Important limits

- No historical-record corpus, DNA testing, ethnicity models, population match database, inferred traits, autonomous relationship discoveries, AI photo restoration/animation, AI handwriting transcription, messaging, multi-user access controls or cloud sync.
- Most advanced/fractal/genogram charts, 3D views, quizzes, extensive language translations and full chart/report design tooling remain unfinished.
- GEDCOM is a core-record mapping, not full lossless standards conformance. The original imported file is retained. Export does not preserve arbitrary extensions, complete media relationships, all family-event semantics, more than two parents per GEDCOM family, guardian/sibling links or all source metadata. Use full ZIP backups for lossless application data. Files over 30 MB are not imported.
- Ahnentafel follows recorded Father/Mother links and stops after 4,095 entries. Anniversary lists include recorded event dates; Today's matching currently recognises day-month GEDCOM date text. These are partial implementations.
- Manual photo adjustments are not machine-learning enhancement or restoration. Media files are limited to 100 MB each and the editor to 40 megapixels.
- ZIP restore limits are 300 MB compressed and 500 MB expanded. Browser storage is finite. Storage and full backups are not encrypted at rest. Keep backups secure.
- Safe exports use a conservative allowlist: no living/unknown/private people, private/sensitive events, free-text biography/government notes, sources, DNA, facts, media, tasks, drafts or audit logs. Manually edited reports must be reviewed before sharing.
- Archive and Mac app do not sync automatically. Use full backup/restore to transfer. Undo history is local and is not included in exported backups.
- Mac host/build scripts are supplied as source. No Mac executable, real DMG or PKG has been built, signed, notarised or tested in this Linux environment. A ZIP is not advertised as a DMG.

See VALIDATION.md for actual verification results and platform exclusions.
# Version 0.3.1

- Fixed backup snapshot consistency when edits occur while media is loading.
- ZIP restores now require state and media checksums and all referenced files; they cannot silently use unrelated local media. Legacy JSON imports remain supported with explicit legacy status.
- Added nine backup regression tests, including disk roundtrip, media restoration and persistent undo/redo. Total: 84 passing automated tests.
- Prepared manual macOS build jobs for Apple Silicon and Intel, plus noninteractive packaging and DMG/package/application smoke-check scripts. These jobs have not run; the download remains a build kit, not a compiled Mac app.
- Added a source ZIP containing the workflow, source, tests and build tools for transfer to an actual macOS-capable build environment.
