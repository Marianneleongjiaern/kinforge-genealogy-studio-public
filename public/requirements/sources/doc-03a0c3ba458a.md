# Genealogy product SWOT and KinForge decisions

22 September 2026. This analysis uses official product documentation reviewed for this release. It is not an exhaustive review of every app, a hands-on benchmark of the competitors, or proof of KinForge's superiority. Strengths and documented trade-offs are source-based. Opportunities and threats are explicitly strategic inferences.

## SWOT

| Product | Strengths | Weakness / trade-off | Opportunity for KinForge (inference) | Competitive threat (inference) |
| --- | --- | --- | --- | --- |
| MyHeritage | Broad family research, consistency checks and distinctive photo services. | A GEDCOM file references photographs rather than embedding their bytes; portable preservation needs more than that export. | Make a full archive, media included, exportable and restorable without a service account. | Large record and matching networks and established photo capabilities are difficult to reproduce. |
| Ancestry | Historical records, a large DNA ecosystem, family stories and research aids. | Some DNA capabilities require a subscription and traits can require another purchase. Offline independence is not its documented central model. | Offer account-independent work on user-owned evidence and segment files, with explicit explanations. | Its corpus and matching population have network advantages local software cannot simply replicate. |
| MacFamilyTree 11 | Deep chart, report, source, privacy and Mac-native functionality. | Its desktop product targets Apple platforms. This is a platform choice, not evidence of poor quality. | Provide the same local archive workflows in a browser on several platforms. | Its mature native interface and extensive visualisation suite exceed this release. |
| Gramps Web | Open data, revision history, import previews, privacy controls, reports and collaboration. | Self-hosting entails server setup and maintenance; server-backed features have operational requirements. | Offer a private single-user archive with no database server to manage. | A mature open-source community already provides many of the transparency and ownership advantages KinForge seeks. |
| RootsMagic 11 | Rich sources, citation reuse, reviewed merging and cleanup. | The publisher's feature table separates free and full-version capabilities, including some backup/media and analysis functions. | Put clear local workflows together without provider connectors; make suggestions explainable and reversible. | Existing interoperability, documentation and source tooling set a high reliability benchmark. |
| Family Historian | Detailed source citations, research notes, transcriptions and rich reporting. | Its extensive source architecture implies learning effort; this is an inference from the documented workflow, not a measured usability defect. | Keep an event's evidence, quotation, page reference and reasoning together in the edit form. | Serious researchers may prefer its established evidence and publishing depth. |
| Family Tree Maker 2024 | Long edit history, original-preserving photo editing, charts and mature tree workflows. | Some collaboration and companion-app workflows use TreeVault; local editing and cloud collaboration are different capabilities. | Preserve originals and recovery locally and make file-based portability explicit. | Its long development history, ecosystem and relationship to Ancestry are significant advantages. |
| Heredis | Broad tree-building, research and publishing workflows across platforms. | Publisher documentation references linked online services; an offline equivalent to those services cannot be assumed. No unsupported claim of inferior core functionality is made. | Make the boundary between local features and unavailable external collections unambiguous. | Broad capabilities, localisation and an established user base make parity a substantial project. |

## Decisions Implemented in 0.3.0

| SWOT finding | Concrete change | Verification evidence |
| --- | --- | --- |
| Preservation must include media, not only links | ZIP backups contain original bytes, imported GEDCOM originals and archive metadata; SHA-256 checks catch corruption. | Integrity unit tests and browser backup/restore workflow. Hashes detect corruption, not malicious authorship. |
| Researchers need to see why a suggestion exists | Name/year/place match contributions are displayed. Link acceptance creates evidence without silently changing vital facts. | Matching unit tests; reviewed-link browser test. Scores are not probabilities. |
| Mistakes must be recoverable | IndexedDB transaction history, undo/redo, merge alternatives and original-preserving photo edits. | Merge unit tests, browser undo and media tests. No fixed history count, but finite storage. |
| Imports must not quietly damage the archive | Preview before append/new-tree import; malformed data rejected; unsupported mappings disclosed; original retained. | GEDCOM fixtures and import preview workflow. Full GEDCOM conformance remains unverified. |
| Privacy needs an explicit export boundary | Sharing exports omit private/living/unknown people and sensitive containers; full backups warn about private data. | Privacy unit test and sharing-report/export browser tests. This is not encryption or multi-user access control. |
| Two editing windows can cause lost work | Revision check prevents stale-window writes from replacing newer data. | Two-window conflict regression test. Unsaved form text remains available when a save is rejected. |
| Core workflows should not require genealogy services | Runtime libraries, maps and processing are bundled locally; no runtime genealogy API or CDN. | Browser network checks and offline navigation/editing test. Hosted delivery itself still uses a web host. |
| Feature claims must be auditable | Original requirements retained verbatim, with implementation status and visible limitations. | Requirement-text preservation test and release matrix. Missing work is not presented as a functional control. |

## Where KinForge Still Loses

Record breadth, DNA reference populations, production-grade photo AI, advanced chart design, native Mac maturity, full localisation, multi-user collaboration, mobile-device QA, scale testing, citation-style breadth and standards conformance remain major gaps. No claim that KinForge currently outcompetes these products is justified.

The next competitive milestones should be measured: demonstrated GEDCOM interoperability, restoration of large media archives, independently assessed source accuracy, accessible research workflows, and verified Mac installation. Features should count as complete only after their acceptance tests pass on supported platforms.

## Sources

1. MyHeritage GEDCOM export: https://www.myheritage.com/help/en/articles/12851866-how-do-i-download-export-a-gedcom-file-of-my-family-tree-from-my-family-site
2. MyHeritage consistency checks: https://education.myheritage.com/article/keep-your-family-tree-accurate-with-the-tree-consistency-checker/
3. Ancestry DNA feature qualifications: https://www.ancestry.com/c/dna-learning-hub/what-to-expect-ancestrydna-test
4. Ancestry family research: https://www.ancestry.com/c/ancestry-family
5. MacFamilyTree technical specification: https://www.syniumsoftware.com/macfamilytree/tech-specs
6. Gramps Web features: https://www.grampsweb.org/features/
7. RootsMagic feature table: https://help.rootsmagic.com/RM11/feature-list.html
8. RootsMagic reviewed merging: https://help.rootsmagic.com/RM11/merging-sources-and-citations.html
9. Family Historian tour: https://www.family-historian.co.uk/tour
10. Family Tree Maker feature descriptions: https://www.mackiev.com/ftm/
11. Heredis product overview: https://home.heredis.com/en/

No competitor account data, protected records or proprietary model assets were copied into KinForge.
