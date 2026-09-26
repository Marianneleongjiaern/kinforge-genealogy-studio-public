# Competitor research and release priorities

Reviewed 22 September 2026. This is a targeted comparison of eight established products, not an exhaustive survey or an independently verified superiority benchmark. Sources are the publishers' own documentation. Product strengths are not described as weaknesses simply because KinForge does not have them.

| Product | Documented benchmark / trade-off | KinForge response in 0.3.0 |
| --- | --- | --- |
| MyHeritage | GEDCOM exports contain text and may reference photographs rather than contain the actual image bytes. Broad record and photo services remain strengths. | Full ZIP backups include the original media bytes; no equivalent record corpus or AI photo service is claimed. |
| Ancestry | Some DNA features require a subscription and traits may require an additional purchase. Its large matching population is not reproducible by a local app alone. | Local segment-file inspection has no genealogy-provider account dependency. It is not an ethnicity, traits or raw-genotype matching engine. |
| MacFamilyTree 11 | Comprehensive Mac-specific charts, sources, reports, import/export and privacy options set a demanding feature benchmark. | Cross-platform browser workflows and a Mac build kit. KinForge does not match its complete chart suite or mature native Mac implementation. |
| Gramps Web | Open data, import previews, revision history and private-record access controls already exist; server installation adds operational work. | Local IndexedDB, previewed imports and reversible transactions. No server administration is needed for a private local archive, but multi-user collaboration is not implemented. |
| RootsMagic 11 | Detailed sources, reviewable merges and data cleanup are strengths. Its published comparison distinguishes free and paid functions. | Explicit match reasons, reviewed merges preserving alternate details, editable templates and local maintenance previews. Not a claim of greater citation breadth. |
| Family Historian | Rich source citations and research notes are strong evidence-management benchmarks. | Event-level source links, page references, quotes, confidence and research reasoning. Full citation-style and rich-note parity remains unfinished. |
| Family Tree Maker 2024 | Turn Back Time documents 5,000 changes; photo editing preserves originals. Cloud-backed collaboration is distinct from local editing. | Persistent undo/redo without a fixed transaction-count cap, original-preserving photo adjustments and portable backups. Storage remains finite. |
| Heredis | Broad tree, research and publishing workflows and multi-platform applications. | A single bundled web runtime with offline source entry, mapping, reports and file-based transfer. Not complete parity. |

## Sources

- MyHeritage: https://www.myheritage.com/help/en/articles/12851866-how-do-i-download-export-a-gedcom-file-of-my-family-tree-from-my-family-site
- Ancestry: https://www.ancestry.com/c/dna-learning-hub/what-to-expect-ancestrydna-test
- MacFamilyTree 11: https://www.syniumsoftware.com/macfamilytree/tech-specs
- Gramps Web: https://www.grampsweb.org/features/
- RootsMagic 11: https://help.rootsmagic.com/RM11/feature-list.html
- RootsMagic merge review: https://help.rootsmagic.com/RM11/merging-sources-and-citations.html
- Family Historian: https://www.family-historian.co.uk/tour
- Family Tree Maker: https://www.mackiev.com/ftm/
- Heredis: https://home.heredis.com/en/

## Engineering references

- GEDCOM 7: https://gedcom.io/specifications/FamilySearchGEDCOMv7.html
- Bundled parser: https://docs.arbre.app/read-gedcom/pages/quickstart.html
- Apple WebKit: https://developer.apple.com/documentation/webkit/wkwebview/
- Apple distribution: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution

## What follows from the comparison

The priorities above are engineering judgements, not evidence that all competitors lack these capabilities. Preserve data, show the evidence behind suggestions, make changes reversible, expose private-export boundaries, and avoid silent feature placeholders. Many mature genealogy products already pursue these goals. Independent usability tests, large-tree benchmarks, interoperability fixtures and macOS QA are needed before claiming KinForge is superior.
