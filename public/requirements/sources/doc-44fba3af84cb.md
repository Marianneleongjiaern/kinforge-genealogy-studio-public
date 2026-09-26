# KinForge Genealogy Studio 1.1.0

Product of Dreams of Serene Landscapes.

## Dynamic Family Workspace

The application now opens on an interactive family chart. People, Families, Library, Research, Media, Charts, Reports, Places and Sources, DNA, publishing, maintenance and the dashboard have independent navigation addresses. Person profiles have separate overview, edit, timeline, source and media pages. Browser Back/Forward and refresh preserve the page and selected person.

The chart supports pan, zoom, fit-to-view, a minimap, draggable people, saved positions, automatic household layout, full-tree, ancestor and descendant views, and generation depth. Changes in the inspector or profile editor update the same family data. Relatives can be created or linked from existing people. Parent-child connections may also be drawn between node handles. Duplicate links, self-links, cross-tree links and circular ancestry are rejected. Unlinking a relationship keeps both people. Undo and redo are available during the session.

The People directory supports search by name, alias and label, birth-date or name sorting, and filters for living, private and unsourced people. Family groups derive from the recorded relationships. Switching trees resets the selected person to the destination tree.

## Included Versions

- Web version: `dist/index.html`
- Installable webapp/PWA version: `dist/index.html`, `dist/manifest.webmanifest`, `dist/sw.js`
- Product website: `dist-website/index.html`
- Mac Apple Silicon DMG: `release/KinForge Genealogy Studio-1.1.0-arm64.dmg`
- Mac Intel DMG: `release/KinForge Genealogy Studio-1.1.0-x64.dmg`
- Mac Apple Silicon ZIP: `release/KinForge Genealogy Studio-1.1.0-arm64.zip`
- Mac Intel ZIP: `release/KinForge Genealogy Studio-1.1.0-x64.zip`
- Windows setup `.exe`: `release/KinForge Genealogy Studio-1.1.0-x64-setup.exe`
- Windows portable `.exe`: `release/KinForge Genealogy Studio-1.1.0-x64-portable.exe`

## Scope Of Verification

The entire Ideas.md feature list is not complete or independently tested. The existing Feature Coverage screen is a planning map; its labels and the presence of controls are not proof that every advertised capability is finished. This release verifies the dynamic family chart, connected pages, data isolation, persistence and workflows listed below.

Outstanding work includes full provider synchronization, hosted collaboration and accounts, actual machine-learning photograph processing, comprehensive chart-type implementations and translations. Search launchers do not constitute provider synchronization; local account screens do not provide a hosted identity service. The desktop app uses Electron and is not the pure Cocoa implementation described in Ideas.md. Mac packages are separate arm64 and x64 builds, not a single universal binary.

## Verification Performed

- TypeScript production build succeeded.
- Web/PWA build succeeded.
- Product website build succeeded.
- 15 unit tests passed: the existing 8 tests plus genealogy traversal, layout and overlap checks, wide families, relationship validation, family membership synchronization, and navigation-route validation.
- 9 Playwright browser tests passed against the production build: chart/profile navigation, Back/Forward and refresh; adding a relative; live editing; undo/redo; duplicate/cycle rejection; ancestry depth; dragging/zoom and position persistence; tree isolation; responsive screens; unlinking and profile edits; all 14 workspace page addresses; offline profile reopening.
- Screenshots inspected at desktop and mobile sizes. Layout checks ran at widths of 1440, 1024, 768 and 390 pixels.
- Packaged Apple Silicon app launched and passed the chart/profile/timeline/refresh workflow without JavaScript errors.
- The Apple Silicon app was also copied out of its mounted DMG into a separate installation-check directory and passed the same native workflow. Running directly from the mounted read-only images timed out; the installed-copy check is the verified path.
- Mac DMG checksum verification passed for both Apple Silicon and Intel images.
- DMG mount/readback confirmed:
  - Apple Silicon DMG contains a Mach-O `arm64` executable.
  - Intel DMG contains a Mach-O `x86_64` executable.
- Windows setup and portable `.exe` files were produced by Electron Builder.
- Local browser preview: `http://127.0.0.1:4173/?v=1.1.0`.

Browser screenshots are in `verification/`. Reusable browser tests are in `tests/browser/`; the native launch check is `tests/native-smoke.mjs`.

## Known Release Notes

- Mac DMGs are unsigned and not notarized. No Apple Developer ID certificate or notarization credentials were available in this workspace.
- Strict macOS code-signature verification does not pass for these development bundles. Signed distribution remains unfinished.
- Windows executables are build artifacts produced on macOS; they were packaged successfully, but not launched on a Windows machine here.
- Intel Mac launch checks timed out on this Apple Silicon host. The Intel DMG's integrity and x86_64 executable were verified, but a working Intel launch has not been verified.
- Electron Builder reported duplicate dependency references and the default Electron icon is used. These are packaging polish items, not functional blockers.
- Dependency audit advisories remain unresolved; this is a development release, not a security-certified production release.
- The website and app are local build outputs. No public website deployment was performed.
