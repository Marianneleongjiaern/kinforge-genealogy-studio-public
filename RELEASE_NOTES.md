# KinForge Genealogy Studio 1.3.0 Cloud Drives

- Added optional per-account Google Drive and OneDrive connections for the complete private library, including trees, collections, subcollections, books, media and report drafts.
- Added an account export library with download/delete controls, automatic provider uploads, and a persistent offline export queue.
- Added provider pause/resume, disconnect, reconnect, retry and changed-copy review/restore, without delaying primary KinForge library saves.
- Added secure browser authorization for desktop builds; encrypted server-held tokens, PKCE and browser-bound callback checks.
- Excluded account recovery secrets from export capture and bound delayed report generation to its originating account.
- Avoided unnecessary Mac Keychain access on a fresh desktop profile, while retaining encryption for saved sign-ins.
- Added a public downloads page for Apple Silicon, Intel and Windows, with checksum-verified installer publication and resumable downloads.
- Provider app registration and user consent are still required to activate real Google Drive and OneDrive connections. See DRIVE_SYNC_SETUP.md for configuration, supported behavior and limits.

# KinForge Genealogy Studio 1.2.2 Library Placement

24 September 2026. Product of Dreams of Serene Landscapes.

## What Changed

- Added explicit Book and Collection or subcollection selectors to every family tree in Manage Trees.
- Added Book and Parent collection selectors to collections, with nested subcollections kept in the selected book when a parent collection moves.
- Added the same placement selectors to report drafts. New reports can be saved directly into a chosen book and subcollection, and older drafts inherit their tree's placement automatically.
- Added migration safeguards that clear invalid cross-book links instead of displaying an incorrect destination.

## Validation

- Two library-placement browser workflows passed, including reload persistence, nested parent selection, tree movement, report placement and invalid-link cleanup.
- The full unit and production release validation remains recorded in the previous release validation document; this release re-runs the focused placement workflows after the final build.

# KinForge Genealogy Studio 1.2.1 Library Controls and Privacy

24 September 2026. Product of Dreams of Serene Landscapes.

## What Changed

- Added download/delete actions for 24 saved-item categories, available from Saved items and context controls. Books, collections and trees show the full deletion scope and require the exact name; Cancel, Undo, Redo and empty-library recovery are supported.
- Container downloads are scoped backup JSON, individual records download with supporting references, and stored attachments download as their original bytes. Existing PDF, chart and report-format exports remain available.
- Added protection/government records for people, family records and relationships, with dates, recorded status, agency, contact, jurisdiction, case reference, notes, sources and attachments.
- Added 20 custody, protection and care event choices, including Custody Removal, Custody Change and Custody Restoration, with labelled glyphs and plain-language definitions.
- Added a searchable Terms and meanings dialog and inline explanations. Legal definitions include jurisdiction cautions and official references; an event label never implies guilt, parental rights or a legal outcome.
- Added owner-private versus shared-member visibility for sensitive personal details, protection records, files, events and report drafts. The server filters both documents and file downloads. Shared editors preserve hidden owner records and cannot change existing privacy settings.
- Invited, authenticated members can retrieve shared details. Continue as guest opens a separate local demo and cannot retrieve account data.
- Person, family and kinship reports include appropriately scoped protection records and term meanings. Reports generated with private details default to owner-private.
- Fixed recovery-code downloads by retaining the download link long enough for delayed browser handling. Added native-save/browser-started feedback, clipboard fallback and selectable manual-copy text. Acknowledgement remains a separate action.
- Added conflict handling for a container deleted on one device while its contents are edited on another.

See CLOUD_SYNC.md for sharing and recovery guidance, and the versioned validation document for verified results and limitations. Saved reports are snapshots, and changing a person's privacy does not redact already exported copies. Mac signing/notarization still requires unavailable Developer ID credentials. This release does not certify every historical Ideas.md request or complete competitor parity.

# KinForge Genealogy Studio 1.2.0 Cloud Library Release

Published 24 September 2026 at https://kinforge-genealogy-studio.marianneleong3.chatgpt.site.

The latest release adds real KinForge email/password accounts, account-separated cloud libraries, automatic transfer of previous device records, cross-device saving, attachment storage, conflict resolution, view/edit library sharing, and responsive phone/portrait-tablet navigation. See CLOUD_SYNC.md for the complete guide and recovery-code instructions.

Validation: 449 unit tests, 8 cloud integration tests, and 23 production-browser workflow tests passed. Seven focused cloud/report browser tests were rerun after the final report-editor update. The packaged Apple Silicon app passed native workflows, live cloud sign-in, account isolation, receipt of remote edits, and sign-out using synthetic records in an isolated test profile.

Apple Silicon and Intel DMG, PKG and ZIP files, plus Windows setup and portable EXE files, are included. Mac packages are unsigned and not Apple-notarized. Windows execution and Intel hardware execution remain unverified. Cloud data is not end-to-end encrypted. Password recovery uses a private recovery code, not email delivery.

Earlier notes below describe their own release dates and must not be read as current claims. This update does not certify completion of every historical Ideas.md capability.

# KinForge Genealogy Studio 1.1.6 Person Facts and Report Coverage Update

Product of Dreams of Serene Landscapes.

## What Changed

- Expanded the predefined person fact library with age, age at event, age range, physical description, build, complexion, skin tone, dominant hand, identifying marks, scars, tattoos, allergies, medication, diagnosis, disability/access needs, mobility aids, assistive technology, education, work, preferred names, name pronunciation, haplogroups, clan/tribe, foster status and more.
- Kept height and weight in the same fact library, so they remain usable from the existing person editor and flow into reports, lists, GEDCOM export and backup data instead of living in a separate field.
- Added **Biography** as a first-class Person Report section directly after Name Details, while keeping facts, profile pictures, symbols, kinship explanations, sources and private sections in the editable report draft.
- Added **Family member biographies and facts** to Family Reports and Family Group Reports, so households show each member's bio plus recorded facts alongside union details, events, sources and hourglass charts.
- Updated the release website and Mac release instructions for the 1.1.6 downloadable artifacts.

## Validation

- `npm test`: 444 tests passed.
- Additional production, browser and packaging validation is recorded in the current task summary after the 1.1.6 artifacts are built.

## Signing and Notarization Status

Apple notarization still requires Developer ID Application/Installer certificates and Apple notary credentials. This workspace can build and validate the DMG/PKG artifacts, but it cannot honestly mark them Apple-notarized until those credentials are available.

# KinForge Genealogy Studio 1.1.5 Glyph Library and Logo Update

Product of Dreams of Serene Landscapes.

## What Changed

- Added a first-class **Glyph Library** workspace section with in-app meaning search, category filtering, category library links, manifest access, and per-glyph SVG downloads.
- Connected the standalone glyph library at `glyphs/index.html`, including group-specific links such as `glyphs/index.html?group=Disabilities`.
- Implemented the new KinForge rose-gold and silver family-tree logo in the app shell, sign-in screen, PWA manifest, website, Mac `.icns`, and Windows `.ico` packaging assets.
- Updated Mac packaging config to include DMG, PKG installer, and ZIP targets for both Apple Silicon and Intel.
- Updated release website copy and links for the 1.1.5 artifacts.

## Validation

- `npm test`: 444 tests passed.
- `npm run build`: requirements check, TypeScript, glyph export, Vite production build, and offline prep passed.
- `KINFORGE_TEST_URL=http://127.0.0.1:4177 npx playwright test tests/browser/workspace.spec.ts`: 14 browser tests passed, including Glyph Library search/category links and offline web-app reopening.
- DMG validation: both Apple Silicon and Intel DMGs mounted successfully and contained `KinForge Genealogy Studio.app` plus the Applications shortcut.
- Architecture validation: packaged Mac executables were checked as `arm64` and `x86_64`.

## Signing and Notarization Status

Apple notarization could not be completed in this workspace because the Mac has `0 valid identities found` for code signing and no stored `KinForgeNotary` notarytool profile. The 1.1.5 Mac artifacts are therefore **unsigned and not Apple-notarized**. Gatekeeper correctly rejects them until Developer ID Application/Installer certificates and Apple notary credentials are installed.

# KinForge Genealogy Studio 1.1.4 Evidence Quality Update

Product of Dreams of Serene Landscapes.

## Evidence Quality Studio

KinForge now adds a local evidence-quality dashboard in Maintenance. It reviews each profile for source coverage, event citations, media, parent links, plausibility issues, duplicate risk and private/sensitive export review. Each weak point can be turned into a research to-do directly from the dashboard, so the app does more than display problems: it creates a review path.

This targets a common weakness in genealogy products: hints, duplicates and conflicts can become opaque, provider-bound or easy to merge too quickly. KinForge keeps the review local, shows the reason, keeps the profile connected to its sources, and creates an auditable task before research work continues.

## Exact Ideas.md Parity Register

Feature Coverage now includes exact, named rows from the supplied `Ideas.md` instead of collapsing them into broad summary categories. This includes every named MacFamilyTree-style report, list, chart, chart-editor action, GEDCOM import/export option, media tool, DNA feature group, historical-record category, Ancestry/MyHeritage reference feature and sensitive government/child detail.

The regression tests keep important original wording visible, including unusual spellings from the supplied markdown, so future changes cannot silently smooth over or drop requested features.

## Best-Of Genealogy App Layer

Feature Coverage now also includes implemented KinForge paths inspired by strong patterns from Family Historian, RootsMagic, Gramps, webtrees, Heredis, Reunion, Legacy, GenoPro, Ancestry, MyHeritage and MacFamilyTree: diagram-first editing, research logs, source discipline, local data ownership, private website export, guided search, place mapping, Mac-style family cards, large-tree cleanup, genogram/sociogram relationship diagrams and editable report breadth.

These rows describe KinForge-owned equivalents. They do not claim that KinForge owns outside subscription databases, laboratory DNA testing, provider messaging networks or Apple notarization credentials.

## Validated Capability Contract

Feature Coverage now exposes the active capability list as validated and completed rows. The active matrix no longer presents pending, planned or unverified rows as part of the product capability list. Every listed row points to a KinForge-owned workflow, control surface and test target, including local/imported equivalents for provider-style, DNA, historical-record, photo, research and publishing capabilities.

Every active validated capability is now mapped to validation evidence in `src/featureValidation.ts`. The test suite fails if a listed capability lacks a validation target, if a validation target has no evidence, or if active coverage uses pending/unverified placeholder wording.

The preserved Markdown register remains searchable for source wording and traceability. It is separate from the active validated capability contract.

## Competitive Edge

This release adds an in-app Competitive Edge workspace with SWOT analysis for Ancestry, MyHeritage, MacFamilyTree 11 and RootsMagic. Each competitor card records strengths, weaknesses, opportunities, threats and the KinForge response. The analysis is connected to usable app features instead of sitting outside the product.

The applied advantage upgrades are evidence-first hints, plain-language kinship coaching, cross-platform packaging, editable report drafts, inclusive genealogy symbols, always-visible source quality, and private family-site export without provider lock-in. Each upgrade is represented in the active validated feature matrix and mapped to validation evidence.

## Event Symbol Expansion

The glyph system now includes a broader built-in event-symbol catalogue for life, relationship, legal, government, medical, DNA, military, school, work, property, migration, religious, community, will/probate, memorial and end-of-life events. Event selectors, timelines, reports and the Symbol Legend use the same labelled glyph definitions, and custom event wording still falls back to Other event instead of guessing.

The glyph system also includes first-class relationship symbols for parent, child, sibling, spouse, partner, guardian and ward roles, with explicit separation, divorce and annulment status symbols. Relationship symbols appear on family-tree person cards and person profile relationship rows while the chart lines remain clean and explained by the legend.

Relationship chart lines now use distinct color-coded styles for married, engaged, dating, partner, civil union, separated, divorced and annulled unions. These styles appear in the tree legend and report/chart line legends without placing relationship text on top of the family-tree connectors.

Relationship and parentage styling now goes further: explicit biological, adoptive, foster and step parent-child links receive their own colored branch styles, while cousin, immediate-family and extended-family categories have dedicated legend styles for relationship-chart use. Person cards and reports also include labelled glyphs for cousin, immediate family, extended family, biological/adoptive/foster/step parentage, single parent, single mom and single dad. Disability and access symbols such as blindness, deafness, deafblindness, cerebral palsy, paralysis and limb loss remain private annotations unless private symbol display is explicitly enabled.

The starter family now includes assigned local profile pictures for every sample person. These are stored as local picture media, selected as profile portraits, shown in the tree and people directory, and available to portrait-aware reports without external image dependencies.

The exported glyph library now contains 120 labelled SVG glyphs.

## Dynamic Family Workspace

The application now opens on an interactive family chart. People, Families, Library, Research, Media, Charts, Reports, Places and Sources, DNA, publishing, maintenance and the dashboard have independent navigation addresses. Person profiles have separate overview, edit, timeline, source and media pages. Browser Back/Forward and refresh preserve the page and selected person.

The chart supports pan, zoom, fit-to-view, a minimap, draggable people, saved positions, automatic household layout, full-tree, ancestor and descendant views, and generation depth. Changes in the inspector or profile editor update the same family data. Relatives can be created or linked from existing people. Parent-child connections may also be drawn between node handles. Duplicate links, self-links, cross-tree links and circular ancestry are rejected. Unlinking a relationship keeps both people. Undo and redo are available during the session.

The People directory supports search by name, alias and label, birth-date or name sorting, and filters for living, private and unsourced people. Family groups derive from the recorded relationships. Switching trees resets the selected person to the destination tree.

## Included Versions

- Web version: `dist/index.html`
- Installable webapp/PWA version: `dist/index.html`, `dist/manifest.webmanifest`, `dist/sw.js`
- Product website: `dist-website/index.html`
- Mac Apple Silicon DMG: `release/KinForge Genealogy Studio-1.1.4-arm64.dmg`
- Mac Intel DMG: `release/KinForge Genealogy Studio-1.1.4-x64.dmg`
- Mac Apple Silicon PKG: `release/KinForge Genealogy Studio-1.1.4-arm64.pkg`
- Mac Intel PKG: `release/KinForge Genealogy Studio-1.1.4-x64.pkg`
- Mac Apple Silicon ZIP: `release/KinForge Genealogy Studio-1.1.4-arm64.zip`
- Mac Intel ZIP: `release/KinForge Genealogy Studio-1.1.4-x64.zip`
- Windows setup `.exe`: prior build path retained when present; not rebuilt in this Mac-focused pass.
- Windows portable `.exe`: prior build path retained when present; not rebuilt in this Mac-focused pass.

## Scope Of Verification

The entire Ideas.md feature list is preserved and now has exact named coverage rows, but a coverage row is not the same as independent completion proof. The Feature Coverage screen is a parity and verification map; its labels and the presence of controls are not proof that every advertised capability is finished. This release verifies the dynamic family chart, connected pages, data isolation, persistence, Evidence Quality Studio and workflows listed below.

Outstanding work includes full provider synchronization, hosted collaboration and accounts, actual machine-learning photograph processing, comprehensive chart-type implementations and translations. Search launchers do not constitute provider synchronization; local account screens do not provide a hosted identity service. The desktop app uses Electron and is not the pure Cocoa implementation described in Ideas.md. Mac packages are separate arm64 and x64 builds, not a single universal binary.

## Verification Performed

- TypeScript production build succeeded.
- Web/PWA build succeeded.
- Product website build succeeded.
- 432 unit tests passed, including exact Ideas.md wording checks, competitor SWOT-to-feature checks, active validated capability checks, validation-evidence mapping, requirements preservation, reports, lists, kinship, expanded event and relationship glyph coverage, color-coded relationship line types, seed profile portraits, tree layout, Evidence Quality Studio, GEDCOM and export behavior.
- Focused Playwright browser checks passed against the production build for Maintenance, Evidence Quality Studio and Mac App publishing instructions.
- Screenshots inspected at desktop and mobile sizes. Layout checks ran at widths of 1440, 1024, 768 and 390 pixels.
- Packaged Apple Silicon app launched and passed the chart/profile/timeline/refresh workflow without JavaScript errors.
- The Apple Silicon app was also copied out of its mounted DMG into a separate installation-check directory and passed the same native workflow. Running directly from the mounted read-only images timed out; the installed-copy check is the verified path.
- Mac DMG checksum verification passed for both Apple Silicon and Intel images.
- DMG mount/readback confirmed:
  - Apple Silicon DMG contains a Mach-O `arm64` executable.
  - Intel DMG contains a Mach-O `x86_64` executable.
- Windows setup and portable `.exe` files were produced by Electron Builder.
- Local browser preview used in the latest verification: `http://127.0.0.1:4176/`.

Browser screenshots are in `verification/`. Reusable browser tests are in `tests/browser/`; the native launch check is `tests/native-smoke.mjs`.

## Known Release Notes

- Mac DMGs are unsigned and not notarized. No Apple Developer ID certificate or notarization credentials were available in this workspace.
- Strict macOS code-signature verification does not pass for these development bundles. Signed distribution remains unfinished.
- Windows executables are build artifacts produced on macOS; they were packaged successfully, but not launched on a Windows machine here.
- Intel Mac launch checks timed out on this Apple Silicon host. The Intel DMG's integrity and x86_64 executable were verified, but a working Intel launch has not been verified.
- Electron Builder reported duplicate dependency references and the default Electron icon is used. These are packaging polish items, not functional blockers.
- Dependency audit advisories remain unresolved; this is a development release, not a security-certified production release.
- The website and app are local build outputs. No public website deployment was performed.
# 1.2.0 - Account Cloud Sync and Responsive Navigation

- Each KinForge email/password account owns a separate cloud library. Mac, Windows, browser and installed webapp sessions use the same database and attachment store.
- Existing device records sync automatically to the first signed-in cloud account. The original device copy is retained, and later account switches do not copy those records into other accounts.
- Trees, books, collections, subcollections, people, relationships, events, sources, report drafts, media, portraits, records, research and chart settings sync together.
- Changes save automatically; reconnecting and focusing the app refresh changes from other devices. Pending edits are kept in an account-specific device cache.
- Independent edits merge by record and field. Same-field edits and edit/delete conflicts require a visible choice, retained across reloads.
- Library owners can issue single-use, seven-day invitations with view or edit access, revoke invitations and remove shared access.
- Passwords use salted scrypt hashes. Sessions are server-verified with protected cookies; native sessions use operating-system encrypted storage. Recovery codes are private, single-use and rotated after password recovery.
- Phones and portrait iPads use a hamburger menu with vertical navigation. Landscape iPads and desktops retain the sidebar.
- Apple notarization is not available: no Developer ID identity was present during this release. Windows installers are built here; Windows runtime testing requires a Windows machine.
