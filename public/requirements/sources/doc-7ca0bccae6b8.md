# KinForge: Competitors and Working-Control Acceptance

Research and source review: 23 September 2026. Release candidate: 1.1.3.

This document adds comparison evidence and acceptance tests. It does not replace or abbreviate Ideas.md, the glyph requirements, the MacFamilyTree walkthroughs, or the independent-feature contract. Competitor descriptions are observations, not proof of KinForge implementation. Official product pages were reviewed; this is not a hands-on examination of every competing product.

## Primary Comparisons

| Product | Official evidence | What to evaluate in KinForge |
| --- | --- | --- |
| MyHeritage | [Product overview](https://www.myheritage.com/help/en/articles/12852500-what-is-myheritage) describes tree building, historical research and DNA services. MyHeritage product material also emphasizes Record Matches, Smart Matches, Instant Discoveries, Record Detective, DNA matching and ethnicity tools, photo tools and Family Tree Builder. | Keep the original Markdown's complete matching, discovery, media and DNA scope. Evaluate actual evidence review and results rather than adopting provider names or claiming access to its collections. A local KinForge substitute must be a working record/research/matching workflow with visible evidence, confidence, review, attachment and undo; a generic search box or provider link is not parity. |
| MacFamilyTree 11 | [Version 11 features](https://www.syniumsoftware.com/macfamilytree/whatsnew) include photo processing, source/place customization, offline place lookup and website generation. | Compare inspector editing, traceable citations, real place data, independent chart behavior and configurable publication. Existing local walkthrough documents remain additional evidence; this web review is not a new installed-app walkthrough. |
| Ancestry | [Tree navigation documentation](https://help.ancestry.com/hc/en-us/articles/53933347829779-Navigating-an-Ancestry-Family-Tree) describes different tree views and media/search navigation. [Tree overview](https://www.ancestry.com/c/family-tree) describes building trees and importing GEDCOM. | Test continuity between chart, person profile, life events, media and attached evidence, alongside all the additional Ancestry-derived requirements already in Ideas.md. |

## Additional Comparisons

These are reference products, not required connectors, services or purchases.

| Product | Official evidence | KinForge acceptance focus |
| --- | --- | --- |
| RootsMagic | [Product overview](https://www.rootsmagic.com/RootsMagic) describes genealogy organization, research and publishing on Mac and Windows. | Data entry, evidence organization, portability and matching behavior across both desktop platforms. |
| Family Tree Maker | [Product features](https://www2.mackiev.com/ftm/index.html) describe change rollback, branch colors, charts and relative review. | Reversible edits, meaningful color coding, reviewable family contributions and recovery. Do not substitute a cloud subscription for an owned feature. |
| Family Historian | [Official help contents](https://www.family-historian.co.uk/help/fh7/hh_toc.htm) include property editing, nontraditional family relationships, source citations and record correction. | Precise relationship semantics, useful editing panes and citations that survive corrections. |
| Reunion | [Reunion 14 features](https://www.leisterpro.com/doc/v14/newfeatures/new14features.php) include event-linked media, custom report sections, note editing, chart tools and GEDCOM 7/GEDZIP. | Real media attachments, independent editable report sections, chart navigation and verified interchange. |
| Gramps | [Feature overview](https://blog.gramps-project.org/wiki/index.php/Features) describes dedicated people, family, event, place, citation, repository, media and note views. | Distinct workspaces with bidirectional links rather than one generic form reused under different names. |
| webtrees | [Features](https://webtrees.net/features/) describe collaboration and privacy at site, tree, user, record and fact levels. | Permission tests for specific records and sensitive facts, not merely a public/private label. |
| GenoPro | [Product overview](https://genopro.com/) describes genograms, contextual family editing, medical/criminal history panels and issue detection. | Relationship-symbol clarity and optional private annotations. Never infer a diagnosis or expose sensitive information through a glyph. |
| Legacy Family Tree | [Official tips and how-tos](https://legacyfamilytree.com/help/en/collections/17871831-tips-and-how-tos) cover backup restoration, additional parents, duplicate work, media handling and split views. | Actual recovery, complex families, comparison before merging and correct media references. |
| Heredis | [Product page](https://www.heredis.com/en/) describes family-tree software with tree, research, sources, maps, reports and publishing workflows. | Treat as a check on ergonomics: fast entry, guided research, maps, publishing and clear source traceability must be independently usable in KinForge. |
| Gramps Web | [Project site](https://www.grampsweb.org/) describes browser-based collaboration around Gramps genealogy data. | Collaboration, permissions and webapp behavior require real account/role tests, not just a local sign-in screen. |
| FamilySearch Family Tree | [Family Tree product page](https://www.familysearch.org/en/family-tree/) describes a shared collaborative family tree and record discovery. | Because the newest instruction says no connector/external service, KinForge must not fake FamilySearch integration; it can only provide local research tasks, reviewed citations, GEDCOM import/export and user-managed evidence unless a future connector is explicitly approved. |

## Competitor-Derived Working Feature Themes

These themes consolidate MyHeritage, MacFamilyTree 11, Ancestry and the additional competitor review into testable KinForge behavior. They must be checked against the exact Markdown requirements, not used to replace them.

| Theme | Required KinForge behavior | Not acceptable |
| --- | --- | --- |
| Dynamic tree editing | Add parents before and after, add spouses/partners/children/siblings, keep siblings side by side, place descendants under prior generations, branch children from the couple line, and keep relationship names on person cards or legends rather than on connector labels. | Static screenshot, linear list, or lines with relationship text in the middle. |
| Evidence and hints | Local research assistant proposes missing-data questions, lets the user attach records/sources, preserves citations, shows confidence/notes, and keeps changes reversible. | Provider logos, external search links, unreviewed auto-merge, or sample-only discoveries. |
| Charts and reports | Every named chart/list/report in Ideas.md needs its own active generator path, editable draft, export path and verification. Reports with glyphs must label glyph meanings. | Multiple names pointing to the same generic page without distinct content or export validation. |
| Media | Photos, documents, PDFs, audio, video and web references must attach to people/families/sources/places/events, persist after reload and appear in relevant reports when requested. | Text-only "media note" standing in for real inserted images/PDFs. |
| Privacy and collaboration | Living/private data settings must alter exported files and shared views; account controls must persist user state and refuse invalid input. | Cosmetic lock labels or a local sign-in form that does not affect access behavior. |
| DNA and health/access annotations | DNA tools must expose recorded segment data, matching notes, side filters and citations without pretending to perform lab work. Disability/access glyphs must be user-authored, private by default and always labelled in trees/reports/charts. | Automatic diagnosis, ethnicity claims without data, or unlabeled sensitive glyphs. |
| Native and publish output | Web/webapp/native packaging controls must produce tangible files or navigable output; Mac/Windows packages must be validated separately and signing/notarization status must be stated. | Alerts telling the user to run a command, broken download buttons, or claiming pure Cocoa when the build is Electron. |

## Current 1.1.3 Control Correction

The Publish page's Mac App card previously opened an instruction alert. That did not meet the working-control gate. In 1.1.3 source, it downloads `KinForge-mac-release-instructions.txt` with concrete build targets and acceptance checks, so the control has an observable result even though packaging still occurs outside the browser at build time.

The acceptance focus column is our design inference from these sources, not a claim that KinForge already matches or surpasses the product. Proprietary artwork, collections and branding are not being copied.

## Exact-Requirement Rule

The source register retains original passages, source line ranges and SHA-256 hashes. Its indexed content-block count is not a completed-feature count or a count of atomic requirements. Each compound passage still needs individual acceptance cases for every behavior it contains.

An implementation must retain the original passage alongside its test cases. Similar wording or a working button is not sufficient. Examples from Ideas.md:

| Exact source text | Required verification | Current boundary |
| --- | --- | --- |
| "Add PDFs or images" | Insert real content into an editable report; verify output and reopen. | The existing Add Media/PDF Note control inserts text only. Requirement unfinished. |
| "Unlimited undo & redo" | No arbitrary product history limit; reversible operations and recoverable resource exhaustion. | General history currently retains 50 states. Literal requirement not fulfilled. |
| "Optimize media" | Actual media processing with original retention, measured output and restoration. | Tag cleanup is now named Clean media tags. It is not media optimization. |
| "Search & replace, including nested hierarchical queries" | Review matching records, scope the tree, apply exact changes, undo, and test nested queries. | Literal text replacement is implemented with preview; nested queries remain unfinished. |
| "Developed in pure, native Cocoa" | A Cocoa implementation, not an Electron wrapper. | The current Mac preview uses Electron. It does not satisfy this literal technology requirement. |
| "Full FamilySearch integration (optional)" | Actual supported remote integration if enabled. | Conflicts with the newer no-connector instruction. Local research does not silently count as remote integration. |

Other provider-specific hosting, live institutional synchronization and external database claims have the same explicit conflict boundary. Software alone cannot provide cheek-swab/saliva laboratory processing, and an owned searchable record collection requires lawful data acquisition. Preserve these requirements, but do not mark an incompatible substitute complete.

## Working-Control Gate

Every command needs an observable outcome, appropriate validation, an error/retry path, persistence where relevant and an outcome-based test. The shared Button component now requires an action handler. That prevents one class of inert buttons; it is not proof of correct behavior.

- A missing implementation must not be disguised as a permanently disabled control, an external link, a success message, sample data or an unrelated action.
- Temporary unavailability is legitimate only when required by state, such as Undo before any change or importing before a valid preview. Tests must also reach a valid state and activate the control.
- Export tests must inspect the downloaded content, not just the download event.
- Save tests must reopen data and compare meaningful fields, relationships and attachments.
- Editor tests must cancel, apply, undo/redo where supported, and check other trees remain unchanged.
- Empty-result actions must report that no changes were needed, without creating a false change-history entry.
- Privacy tests must inspect the exported or shared data, not just the setting on screen.

## Concrete Maintenance Correction

The earlier maintenance implementation iterated through all trees, parsed ambiguous dates through JavaScript Date, removed people without examining all their data, and labelled tag cleanup Optimize media. The 1.1.2 source replaces those actions with a reviewable plan scoped to the active tree.

- Preview is read-only. Apply is explicit, and Cancel changes nothing.
- A stale preview cannot overwrite edits made after it was prepared.
- Literal replacement preserves punctuation and replacement dollar signs.
- Date normalization only reformats valid year-first numeric dates. Ambiguous dates, date qualifiers and invalid dates are preserved; this is not full genealogical date correction.
- Name spacing is cleaned without changing cultural capitalization.
- Only entirely empty, unreferenced people can be removed. Linked people, notes, sensitive details, access-needs data and events are preserved.
- Family cleanup removes missing, repeated and cross-tree member references; it does not infer parentage or resolve all mismatched partnerships.
- Undo and Redo are available in Maintenance. The existing 50-state limit remains a separate unfinished requirement.
- Tag cleanup has its own accurate name. The original optimization requirement remains in the source register.

Evidence entry points: src/maintenance.test.ts, tests/browser/maintenance.spec.ts and tests/native-smoke.mjs. Actual pass/fail results belong to the test run and release Verification.json; the existence of these tests does not certify the entire product.

## Outstanding Control and Feature Audit

The following are confirmed gaps or areas requiring deeper validation, not completed work:

| Area | Observed boundary / remaining acceptance work |
| --- | --- |
| Charts | Many named choices still share a simplified rendering path. Verify every named layout, independent customization, saved positioning, pagination and real output. |
| Reports | Named templates require independent field/content checks; media-note text is not embedding. Verify editable exports and person-specific regeneration. |
| DNA | Add Segment inserts preset coordinates. Sorting shared cM is not genetic clustering, phasing, ethnicity inference or scientifically validated matching. |
| Media | Rotate, Warm tone and Contrast are basic display adjustments. Local crop, repair, ML colorization, transcription, scanning, recording and animation need their actual implementations and saved derivatives. |
| Maps and places | Place fields and decorative globe/map views are not a real offline globe, statistical map or sufficiently broad gazetteer. |
| Templates | Template names and generic fields do not establish 100 distinct, useful source templates or exact citation formatting. |
| Accounts | Local prototype login and password reset do not establish secure multi-user authentication, ownership, recovery or collaboration. Do not use the preview for sensitive production records. |
| Merging | Merge First Duplicate needs a field comparison, user resolution of conflicts and complete reference-preservation tests. |
| GEDCOM | Verify each requested encoding, version, subset, media reference, privacy rule and round trip. A small parser test set is not full standards coverage. |
| Research | Local archive search and reviewed links are a working subset. Licensed datasets, explainable hints, cross-tree discoveries, relationship theories and notifications remain separate work. |
| Platform delivery | Mac package checks do not certify Windows installation, live website deployment, every PWA/browser, Intel hardware or a pure Cocoa implementation. |
| Accessibility and scale | Per-person optional annotations are not a full accessibility audit. Test keyboard access, assistive technologies, supported languages and realistic large trees. |

This is an initial risk-focused control audit, not a claim to have exhaustively exercised every UI control. Full feature acceptance remains open.
