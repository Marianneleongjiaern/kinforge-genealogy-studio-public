# Report and Symbol Design QA

Date: 23 September 2026. Scope: implemented local report renderer and captioned person symbols, not certification of the whole application or exact MacFamilyTree equivalence.

## Evidence

- Source visual truth: `/Users/marianneleonghost/Documents/Codex/2026-09-23/i-n/work/mft-report-page-381.png`, rendered from printed page 374 of Synium's official MacFamilyTree 11.1 English manual. Editing references: `work/mft-report-reference-416.png` and `work/mft-report-reference-418.png` under the same workspace root.
- Implementation: `verification/reports/person-report-with-photo.png`; local preview `http://127.0.0.1:4175/#/trees/tree_demo/reports`.
- Side-by-side full and focused comparison: `verification/reports/report-symbols-design-comparison.png` (1200 x 1260). Both the source and implementation are present in the same comparison input and were visually inspected.
- Source page: 1132 x 1600 pixels. Source app crop: (130,160,874,604); source report crop: (342,214,430,510). Source screenshot device density is not documented in the manual; paper widths, not screen pixel sizes, were normalized for comparison.
- Implementation: 1440 x 960 CSS viewport, device scale factor 1, full-page image 1440 x 1139. Report paper x=323, y=385, width=794 CSS pixels; only the visible portion is compared, not the full continuous document height.
- Full source app crop is scaled to 560 px wide; implementation full screenshot to 560 px wide. Focused report regions are both scaled to 540 px wide. This is not a 1:1 font-pixel comparison.
- State: Person Report, June Chang, three generations, private details excluded, editable draft, chosen profile bitmap. Source uses JFK sample records; implementation uses synthetic records and a coloured bitmap test attachment. These are intentionally different datasets, not replacement artwork or copied personal data.
- Additional inspected evidence: `tree-with-captioned-symbols.png`, `report-symbol-meanings.png`, `kinship-symbols-mobile.png`, `symbols-verified-1.png` through `symbols-verified-3.png`, all under `verification/reports/`.
- Mobile viewport: 390 x 844 CSS pixels, density 1. Full-page images show the existing fixed mobile navigation at its viewport position; screenshots are not representations of a single enormous phone viewport.

## Findings and Iterations

1. Earlier P1: initial PDF conversion produced blank/overlapping output and unreliable margins. Replaced the conversion with one-page-at-a-time high-resolution HTML rendering. The later parity update adds a searchable Unicode text layer and a separate genuine AcroForm export. The original image-only limitation is superseded.
2. Earlier P2: report media stacked vertically instead of a thumbnail row. Added a three-column media grid, two columns on mobile. Browser checks assert the two sample thumbnails share a row.
3. Earlier P2: a tall diagram left a fragment on the next PDF page. The export now selects an earlier valid page boundary, constrains image height, and explicitly preserves chart aspect ratio. `symbols-verified-1.png` contains the whole diagram; page 2 starts with its labelled key, not a diagram fragment. Genogram circles are not stretched into ovals.
4. Earlier P2: extra tree glyphs could reveal a clipped second row; keyboard scrolling was intercepted by the graph. Replaced the vertical row overflow with a stable horizontal strip and scoped arrow-key handling. The browser test confirms captions remain beneath their icons and inside the strip height, and ArrowRight scrolls the strip. The person card and family connections keep their dimensions.
5. No remaining actionable P0/P1/P2 visual issue was found in the implemented report/annotation scope after those corrections. Whole-product content gaps are separate acceptance failures, listed in `../KinForge-Report-Content-Parity.md`, and are not marked complete by this visual QA.

## Required Fidelity Surfaces

- Typography: Arial/Helvetica-style body, black text, bold fields/section titles, zero letter spacing. Report body and explanations are 15 pt as requested, intentionally larger than the manual's dense source sample. Compact diagram text scales with the diagram; complete 15 pt textual keys follow it. Long compact captions may abbreviate, while the full record wording and meaning remain in the key.
- Spacing/layout: portrait left and report header right with an aqua separator; aqua section bands; body returns to the same left edge below the header; editable values retain their page layout. Media grid, desktop format inspector and stacked mobile controls were checked. KinForge navigation remains its own design. The default is continuous flow; optional canvas mode positions whole report blocks, not internal chart nodes. Onscreen preview is not automatically paginated into separate sheets.
- Colours: white paper, near-black copy, pale aqua section bands (`#e0f0f2`) and turquoise rules (`#61bdc6`). UI chrome uses KinForge's existing neutral/teal system rather than copying MacFamilyTree's sidebar.
- Images/icons: the selected embedded profile image persists and appears in Person/Kinship headers; no portrait is invented for an unillustrated profile. Internal library glyphs are rasterized locally for documents and exported with their captions. Per-person glyphs, genogram shapes and illustrated relationship/status keys were checked. No source product artwork is bundled.
- Copy/content: named kinship examples, explicit once/twice/three-times-removed explanations, non-diagnostic symbol meanings, and separation/divorce/annulment distinctions are retained. Private annotations require opt-in; generated reports state their privacy scope. The content matrix distinguishes implemented sections from missing equivalents.

## Verification

- Earlier baseline: 188 unit tests and 33 Playwright browser tests passed. Later parity tests and final integration results are recorded below, separately from this earlier snapshot.
- Console/page-error checks passed in report-editing and symbol workflows. Production build and requirements-source verification passed; the build still reports a large bundle warning.
- No edits were made to the user's MyHeritage account or MacFamilyTree database. Tests used an isolated browser and synthetic records. Native packages were not rebuilt or revalidated.

## Residual Boundaries

- Identical proprietary templates, full world-history coverage, historical map boundaries, translation of all supplemental labels, current-year lunar anniversaries and chart-internal object editing are not claimed. Map, Story, Book, multilingual narrative and searchable/fillable PDF implementations now exist and are covered by the later checks below.
- Very large trees, every device/printer and every possible long custom annotation have not been exhaustively visually tested. Full symbol meanings are available in the report key even when a compact diagram is scaled down.
- Source and implementation data, zoom and application chrome differ. The result is reference-informed styling with the user's explicit readability changes, not a pixel-identical clone.

final result: passed

## Expanded Report Parity Verification

The 23 September follow-up adds working offline maps, illustrated Story templates, Family Tree Book chapters, lifetime historical context, parentage filters and editing, per-report section/content options, configurable analysis/plausibility checks, fifteen narrative languages, preserved imported date precision and explicitly labelled calendar conversion. The complete feature matrix is in `../KinForge-Report-Content-Parity.md`.

- Combined final unit run: 424 tests passed in 21 files. This includes the existing family chart/kinship/privacy tests and new report-content, language, rich-report, parentage, calendar, imported-date and PDF contract tests, including invalid-page-height safeguards.
- Production build, TypeScript compilation and requirement-preservation checks passed. The existing bundle-size warning remains.
- Main browser regression: 47 of 48 scenarios passed in `verification/report-parity-final`. The rich-report scenario hit a temporary HTTP 404 on reload while the preview build was being replaced; its saved network trace confirms the interruption preceded sign-in and report generation. It passed unchanged against the stable build in `verification/report-parity-rich-recheck` (8.9 seconds). All 48 unique scenarios therefore passed across the final run and this isolated rerun; this is not described as one uninterrupted green run.
- PDF tests inspect the actual editor downloads with two independent parsers/renderers. They verify searchable Latin/Cyrillic/CJK/non-BMP strings, page breaks, orientation, margins, wrapped header/footer separation, canonical AcroForm fields/widgets, duplicate labels, empty/multiline values and refilling with new Chinese/Cyrillic characters. The old value is not baked into the page beneath the editable widget.
- The local PDF fonts are bundled and included in the offline precache. CJK fillable PDFs can be substantially larger because the editable glyph repertoire is embedded, not fetched from a third party.
- Rich browser checks generate reports while offline and verify actual coast/ocean/marker pixels, numbered places, private-media exclusion, photo captions, saved/reopened stories, chapter breaks and mobile overflow. No external requests or page errors were observed in that focused run.
- Inspected rich-report images: `/tmp/kinforge-rich-browser/report-rich-offline-map-an-4cf7e-d-remain-readable-on-mobile/offline-report-map.png` and `illustrated-story-photo-mobile.png` in that directory. Synthetic image blocks are test attachments, not portraits of real people.
- Reference review used the downloaded official manual and rendered report/editing pages, not a fresh live inspection of the installed MacFamilyTree app. No account or user genealogy database was changed by browser tests.
- The local preview is updated independently of downloadable native packages and public hosting. Neither native installers nor public deployment were refreshed by these checks.
- Visual inspection caught clipping of a refilled single-line CJK field despite passing text extraction. Corrected the actual AcroForm multiline flag so only wrapped/multiline fields use it. Re-rendered evidence under `work/report-pdf-test-results/` shows complete new Chinese/Cyrillic values. This is not a parser-only validation claim.
- Canvas verification covers conversion from flow without moving blocks by more than one pixel, constrained X/Y/width/layer edits, multiple selected blocks dragged together, front/back order, reload, PDF/HTML export and returning to flow. PDF parser checks confirm intended coordinates across two pages with no inserted blank first page. The second page render was inspected.
- Desktop/mobile editor screenshots and generated PDF pages were visually inspected. Stable evidence is under `verification/report-parity-final/`; rich map/story evidence is under `verification/report-parity-rich-recheck/`. Full report text remains 15 pt, with symbol captions/complete keys and unindented body sections.
