# GitHub import validation: 1.3.8

The initial GitHub import preserved the current 1.3.8 application behavior and mirrored the existing desktop installers without modification. It added repository documentation, exclusions for local/private files, a pull-request template, and GitHub Actions checks. Follow-up fixes in pull request #1 repair the failures found below.

## Follow-up corrections in pull request #1

- All 647 unit tests now pass across 37 files.
- All 60 cloud tests, including nested privacy cases, now pass across the API, privacy, and drive-sync suites.
- Report section selectors now cover all seven medical and work-file report types, including their empty-state summaries.
- All 47 previously unmapped built-in events now have explicit labelled glyphs. The tests require the exact recorded event label and retain the generic fallback for uncertain/custom wording.
- Hierarchy assertions now require a tree's subcollection to belong to a collection in the selected book. Repeated normalization is checked for stable placement without duplicate collections.
- Cloud fixtures bundle their language dependency and include the required journal and feedback arrays. Authentication, authorization, visibility, and conflict assertions remain in place.

These corrections are in the pull request after the `v1.3.8` release tag. The mirrored installer files and live deployment have not been rebuilt with these follow-up changes.

## Original import checks

- Clean dependency installation completed from the committed lockfile.
- Requirements preservation passed: 26 documents and 1,433 indexed blocks. This checks source preservation, not feature completion.
- The full unit suite ran: 637 passed and 10 failed across 37 files.
- The production webapp, website, and cloud-worker build completed.
- Release delivery and native-wrapper checks passed: 13 tests.
- The original cloud run failed during setup: the API/drive fixtures transformed `src/domain.ts` in isolation, leaving its relative `languageCatalog` import unresolved, and the privacy fixture omitted the required journal and feedback arrays.
- All eight existing desktop installers matched their published SHA-256 manifest before upload.
- A targeted scan found no common GitHub/OpenAI/AWS token patterns, embedded HTTP credentials, or private-key headers in the imported files. This is not a comprehensive security audit.
- Local databases, libraries, private attachments, browser traces, screenshots, old build directories, and local Git history were excluded.

## Inherited unit failures

| Area | Failures | Observed mismatch |
| --- | ---: | --- |
| Report section options | 7 | Medical, diagnosis, prescription, treatment, work-contract, company, and character-work reports produce headings missing from the selectable-section catalog. |
| Event glyph coverage | 1 | At least one built-in event falls back to the generic event glyph. |
| Library placement tests | 2 | Existing assertions differ from the current book/collection/subcollection normalization results. |

These failures existed in the source snapshot before GitHub configuration was added. The follow-up corrections above keep the original coverage enabled. The unchanged `v1.3.8` installer mirror is not a claim that the original baseline passed every test.
