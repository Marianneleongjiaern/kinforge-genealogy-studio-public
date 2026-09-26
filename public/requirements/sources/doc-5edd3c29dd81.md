# KinForge Report Content and Symbol Acceptance Checklist

Updated 23 September 2026. Supplements Ideas.md and all earlier requirements; does not replace or mark those requirements complete.

## Latest User Requirements

- Generated reports must have the corresponding MacFamilyTree 11 report's features and content, not merely the same title or appearance.
- Every included person glyph must have its meaning stated beneath it in the family tree, reports, report charts and kinship reports. Any report containing symbols must label or explain every symbol used.
- Preserve the profile photograph, form-like draft editing, 15 pt report text, unindented body sections and named explanations of cousin degree/removal.

## Reference and Scope

Reference: [Synium's official MacFamilyTree 11.1 English manual](https://download.syniumsoftware.com/Manuals/MacFamilyTree_11.1_EN.pdf), printed pages 374-414. The manual was inspected locally, including rendered report and editing examples. This is not a claim of a fresh live walkthrough of the installed Mac app.

The independent KinForge generators use local records and local rendering. No provider account, connector, remote medical inference or external report-generation service is used. The expanded implementations below close the earlier missing report generators and many editing/export gaps. They do not establish identical proprietary datasets, every native interaction, or pixel-identical parity.

## Content Matrix

| Corresponding report | Implemented and testable locally | Remaining equivalence gaps |
| --- | --- | --- |
| Person, pp. 374-375 | Names, events, pictures, facts, unions/offspring, explicit parentage, independently limited ancestor/descendant generations, narrative, hourglass, kinships, lifetime history, citations, profile photo and section selection | History catalogue is finite; no assertion that every proprietary field is replicated |
| Person Events, p. 376 | Person/immediate-family/all-relatives scope, event types, date intervals, lifetime filtering and unknown bounds | Approximate dates without a bounded interval do not acquire invented precision |
| Kinship, p. 377 | Maternal/paternal roles, named cousin degree/removal explanations, cousin-in-law distinction, symbols, relationship-category and parentage filters | Does not enumerate every longer path in pedigree-collapse families |
| Ahnentafel, p. 378 | Numbered mother/father slots, repeated ancestors, narratives including unnumbered ambiguous ancestors, parentage scope | Ambiguous parent roles are disclosed rather than assigned artificial numbers |
| Timeline, p. 379 | Chronological text/chart, recorded events and optional cited lifetime history | Independent chart styling; not every Mac template |
| Family, p. 380 | Family membership, unions, offspring, events, hourglass, citations and section selection | Local evidence only; unknown family facts are not inferred |
| Descendancy/Register, pp. 381-382 | Partners, descent paths, generation groups, continuation numbers, Roman child numbers and translated prose | Independent numbering implementation; unusual cyclic data is bounded |
| Map, p. 383 | Offline Natural Earth/D3 map, recorded coordinates, numbered place legend, events, citations, conservative chronological connections and missing-coordinate list | Contemporary generalized 1:110m land; no roads, historical borders or automatic geocoding |
| Narrative, p. 384 | Recorded life/family/event prose in 15 selectable languages and optional history | User text, stable headings and supplemental labels are not automatically translated |
| Today, p. 385 | Recurring Gregorian month/day calendar using parsed original dates | No current-year lunar/religious observance calculation |
| Status, p. 386 | Privacy-scoped entity counts, linked/unassigned media options and source counts | No external database statistics |
| Saved Reports, p. 387 | Restore content, report/list mode, generation options and presentation; rename/delete, undo; separate from original people | Old drafts remain unchanged until explicitly regenerated |
| Story, p. 388 | Documentary, album and chronicle templates, local photos/captions, narrative, citations, glyph meanings and page breaks | No proprietary Mac artwork/templates bundled |
| Persons/Marriages/Events/Facts/Places/Sources, pp. 390-395 | Configurable columns, sorting/grouping, event types/date filters, places, citations and uncited claims | Options are scoped to generators where they have an effect |
| ToDo/Anniversaries, pp. 396-397 | Task status filter, priority, sorted/grouped lists and month/day anniversary calendar | Gregorian recurrence only |
| Plausibility, p. 398 | Date intervals, parent/marriage/lifespan thresholds, cycles, duplicates, missing evidence and burial delay checks | A warning is not proof of error; unknown dates are not guessed |
| Distinctive Persons, p. 399 | Configurable child-count, early-death, marriage/parent-age and lifespan thresholds with bounded-date analysis | Unbounded ABT/CAL/EST values cannot establish exact ages |
| Analysis, p. 400 | Fact/event/person axes, counts, distributions, statistical summaries and local bar models | Not a statistical inference or causal-analysis service |
| Changes/LDS, pp. 401-402 | Local change log and explicit LDS fact types for baptism, confirmation, initiatory, endowment and sealings | No external ordinance registry; user date/status/temple text retained as recorded |
| Report editor, pp. 406-414 | Form-like editable fields, text formatting, image dimensions/alt/alignment, block multiselect/reorder, optional free-position X/Y/width/layer controls and multi-object drag, themes, crests, watermark, orientation/margins, header/footer/page numbers and explicit page breaks | Continuous onscreen preview rather than automatically paginated sheets; no chart-internal object editor claim; free-position placement retained in PDF/HTML, not plain text/CSV/RTF |
| Exports | Searchable Unicode hybrid PDF, genuine fillable AcroForm PDF, styled HTML/RTF, plain text/CSV, browser print and capability-based sharing | PDF visuals use local raster rendering plus text/widgets; native sharing varies by host |
| Family Tree Book / World History | Illustrated privacy-scoped person chapters, numbered contents, chapter citations/breaks; cited local and bundled historical context | Contents use chapter numbers, not computed page-number TOC; bundled history contains eight entries from 1776-1993, extensible through local dated/cited records |

## Date and Language Boundaries

- Original date text and GEDCOM qualifiers are preserved. Explicit Julian, Hebrew, historical French Revolutionary and arithmetic Islamic dates can be converted for chronological comparisons using a local calendar library. Unlabelled dates are not guessed to use another calendar.
- French Revolutionary conversion is restricted to historical years 1-14. Arithmetic Islamic conversion is not an observed lunar calendar. Anniversary recurrence is Gregorian, not a prediction of religious observances.
- Narrative languages: English, German, Danish, French, Finnish, Italian, Dutch, Brazilian Portuguese, Russian, Spanish, Swedish, Hungarian, Polish, Norwegian Bokmal and Czech. Generated sentence templates are translated; user-authored facts and citations are never rewritten by a translation service.
- Parentage is explicitly recorded as unspecified, biological, adoptive, foster or step. Missing parentage is never silently treated as biological. Existing links and new parent/child controls can edit this value.

## Symbol Contract

- Person symbols use one shared definition catalogue. The family tree captions sit directly beneath icons; a fixed-height scrollable annotation area prevents long lists moving family connectors.
- Private disability/access-needs annotations require the explicit tree toggle or report private-data option. No condition is inferred from gender, a relationship, an access request or a different diagnosis.
- Reports show the glyph, caption and full meaning. A custom record label is preserved alongside the catalogue meaning and recorded details.
- Network diagrams include captioned symbols in the person card. Up to three are shown in a compact diagram card; the person's complete labelled key follows the chart. A visible note points to additional symbols when necessary.
- Genogram shapes are labelled on the person card and explained in the report. Relationship line samples are paired with meanings. Separation, divorce and annulment marks are distinguished explicitly. Connection text remains off the tree connectors.
- Kinship reports attach meanings to the reference person and each displayed relative, including when names are duplicated. Private profiles receive no identifying symbol detail unless included.
- PDF/RTF include embedded bitmaps and captions. Text/CSV retain the caption and explanation but cannot contain an image. User-edited drafts are not silently rewritten; regenerate a new draft to receive new generated content.
- PDFs include searchable Unicode text over the rendered page. The separate fillable PDF action exports real AcroForm fields with editable values and Unicode appearances. Original SVG input is not accepted; trusted internal library symbols are rasterized locally before insertion.

## Verification

Automated checks include the existing catalogue, report, kinship, symbols and family-layout suites plus reportContentOptions, reportNarrativeLocales, reportRich, reportParentage, reportCalendarDates, reportImportedDates and reportPdfExports. Browser suites exercise report editing, rich reports, parentage/history entry and downloaded PDF validation. These checks cover specified local behaviour, not every Ideas.md feature or every Mac interaction.

Visual evidence and current test totals are recorded in the project's design-qa.md. The local source/preview update does not rebuild, deploy or certify native installers.
