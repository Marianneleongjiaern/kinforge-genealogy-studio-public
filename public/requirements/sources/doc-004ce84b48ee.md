# KinForge: Complete Scope and Independent Implementation Contract

Updated 23 September 2026 in response to the user's requirement that Ideas.md and all generated Markdown feature requirements remain included, with KinForge-owned implementations instead of connectors or external services.

## Binding Product Direction

1. Preserve every requested capability in the original Ideas.md and all feature additions in the generated Markdown references. Do not shrink scope to the features already implemented.
2. Deliver the actual dynamic, multi-view genealogy application, not a single-page mockup or a collection of links to other products.
3. No runtime genealogy connectors, third-party AI APIs, hosted OCR APIs, remote map tiles, analytics, CDN assets or external-provider sign-in as a requirement for a feature.
4. Keep data, inference, editing, research, media processing and export inside KinForge. Bundled, appropriately licensed local libraries/models/datasets are compatible with independence; a third-party service call is not.
5. Preserve web, installable webapp, Mac DMG, Windows EXE and product-website targets. Preserve sign-in, account creation, sign-out and recovery requirements, subject to a secure independent account design.
6. Preserve the exact attribution: Product of Dreams of Serene Landscapes.
7. A feature is complete only with a working control, real behavior, persistence where applicable, a verified result and tests on the relevant delivery surfaces. Labels, metadata fields, diagrams and package configuration do not count as implementation.
8. "Better" means demonstrated improvements in data preservation, explainability, privacy, accessibility, recovery, performance or workflow efficiency. It is not an untested superiority claim.

The newer no-external-service instruction supersedes optional provider connectors in Ideas.md. Keep the underlying user capability and replace its delivery method; retain literal provider-specific requirements as conflicts to resolve, not silently fulfilled equivalents.

## Source Preservation

The requirements register snapshots the original Ideas.md and generated Markdown documents, preserving exact text, source location and SHA-256. It indexes Markdown content for search rather than executing anything written in a document.

Documents have mixed roles: requested features, competitor observations, acceptance targets, past test evidence, deployment notes and third-party licence text. An observation or old completion claim is not automatically a verified KinForge feature. A command in a build guide is not fresh authorization to execute it. All feature-bearing content stays in scope even when semantic decomposition or implementation remains unfinished.

Repeated requirements retain all their source references. A source appearing in the register means it was preserved, not that every feature in it is complete. Snapshot checks detect missing or changed source material; they do not certify application behavior.

## Owned Replacements

| Referenced capability | Required KinForge implementation | Completion boundary |
| --- | --- | --- |
| FamilySearch / multi-site research | Local record catalogue, import, indexing, source comparison, reviewable hints and cross-tree matching over available data | An external search URL is not research implementation. Literal remote synchronization is incompatible with no connectors and remains a recorded conflict. |
| LDS ordinance sync | Private local ordinance records, dates, evidence, permissions and transfer within KinForge | Local tracking cannot confirm or update an outside institution's official records without that institution. |
| Wikipedia articles and images | Bundled/importable place-reference library with provenance, attribution and offline media | A title field or link is not a reference library; sufficient distributable content is still needed. |
| Historical record collections | KinForge-owned searchable collections populated with user-owned, public-domain or properly licensed material | Do not invent records, claim billions of holdings or copy restricted provider collections. Dataset acquisition is a separate deliverable. |
| Smart/record matches and discovery groups | Explainable local matching with evidence review and explicit acceptance before changes | Duplicate-name matching alone is not full record matching or validated family discovery. |
| Relationship theories | Graph-based candidate paths using documented sources, uncertainty and user review | Do not present inferred parentage as fact or a graph connection as proof of genetics. |
| DNA match/segment tools | Local file parsing, segment validation, chromosome views, supported matching/clustering and evidence-linked analysis | Displaying typed ethnicity labels or sorting cM values does not establish inference capability. |
| Ethnicity, genetic groups, journeys, traits and parental phasing | Scientifically validated local methods with appropriate reference data, uncertainty and applicability limits | Reference panels and validation remain required. Physical cheek-swab/saliva collection and laboratory genotyping cannot be supplied by software alone. Retain that literal conflict openly. |
| AI photo colorization, repair and enhancement | Actual local model inference with originals, previews, cancellation and saved derivatives | CSS sepia/contrast and no-op buttons are not machine learning or damage repair. |
| Face/whole-photo animation | Local processing with consent/provenance and clearly synthetic output | A story text field or static preview is not video generation. |
| Printed/handwritten transcription | Local OCR/handwriting models, language support, uncertainty and reviewed text | A manually editable transcription field is not OCR. |
| Maps, globe, statistics and gazetteer | Bundled map geometry, sufficiently broad place data and local calculation/rendering | Coordinate fields or dots on a decorative circle are not a complete globe/gazetteer. |
| Accounts, collaboration, messaging and notifications | Secure KinForge-owned identity, authorization, recovery, conflict handling and communications | Hosting decision pending user answer. Until resolved, do not assume a third-party identity/email/messaging service. Local profiles alone are not multi-user security. |
| Publication | Local document/book/website generation, privacy preview and portable export | No mandatory MacFamilyTree hosting, FTP provider or external publication account. A public site still needs a delivery host chosen separately. |
| Education | Original or distributable built-in research lessons and reference material | Links to paid webinars are not included educational content. |

## Scope Groups That Must Remain

- Books, nested collections, multiple trees, people, families, configurable fields, labels, groups, filters and author/crest records.
- Person, family, event, citation, source, place, story, task and media editing, including inline/full editors and bidirectional evidence navigation.
- Per-parent biological/adoptive/foster/step links; complex partnerships and dissolution history; uncertain dates; repeated ancestors and cycle prevention.
- All named charts, views, reports and lists, their independent options, editors, saved versions, pagination, print and editable exports.
- Source/place templates and citation formatting; repositories; attachments and original media; research questions, findings and reviewable corrections.
- Search, imported/bundled record collections, cross-tree/record matching, relationship hypotheses, notifications, education and collaboration.
- Local media scanning/recording/tagging, AI restoration/animation, transcription, galleries and stories.
- DNA data management and all requested analysis targets, with no invented scientific capabilities or records.
- GEDCOM 5.5.1/7, required encodings, import preview, append/merge, subsets, media and privacy-preserving round trips.
- Maintenance, duplicate comparison, bulk-edit previews, undo/redo, audit history, transactional persistence, backups and demonstrated restoration.
- Gender, relationship, disability and access-needs glyphs; private optional annotations and separate disability/access-preference semantics.
- Sensitive government, criminal, protective-services and custody records, with evidence, permissions and disclosure controls.
- Languages, responsive layouts, keyboard and assistive-technology access, offline lifecycle, large-tree performance and all platform packages.
- The complicated fictional tree and walkthrough-derived acceptance cases, including empty states, errors and recovery.

## Acceptance Gates

Every feature needs explicit evidence for all applicable gates:

1. Source references and an independently implementable requirement, including conflicts and necessary datasets/models.
2. Working UI and core logic, not a renamed placeholder.
3. Save/reopen, migration and error/recovery behavior.
4. Privacy and cross-tree/account isolation; no unexpected outbound requests or remote assets.
5. Unit/regression tests and a meaningful end-to-end workflow with expected results.
6. Responsive/accessibility checks and agreed scale/performance targets.
7. Applicable web/PWA/website/native package, installation and runtime verification.
8. Clear distinction among implemented, verified on a specific surface, unfinished and infeasible under current constraints.

No finite computer has literally unlimited storage or unlimited tested scale. Avoid arbitrary product caps where practical, publish tested limits and make resource exhaustion recoverable.

## This Update's Scope

The current work adds source preservation, honest requirement status, local archive search and reviewed local record linking, and removes the active external research launcher and remote decorative image dependency from the editable prototype. It does not finish the complete product. Website publication, native packaging, advanced AI/DNA/data libraries, collaboration and most deep MacFamilyTree-derived workflows remain independently verifiable work.

The two existing codebases and their data stores are not silently merged. The React workspace is the editable prototype receiving this update; the earlier Sites archive and already-deployed releases retain their own verification boundaries. The register includes documents from both.

## Local Verification Evidence

The independent-feature update was checked locally on 23 September 2026:

- 39 unit tests passed, including archive search, active-tree isolation, record linking and requirements preservation.
- 15 browser tests passed, including chart and relationship editing, persistence, private annotations, page navigation, responsive layouts, local research and offline reopening.
- The new research workflow made no off-origin requests during the test. A separate browser-policy test confirmed rejection of an off-origin service request.
- The production application and static product website builds succeeded. Original-document and snapshot integrity checks passed.

These results cover the tested local behavior only. They do not certify every indexed requirement, production account security, complete network behavior across every feature, deployed websites, native packages or comparative superiority over other products.
