# GitHub import validation: 1.3.8

The initial GitHub import preserves the current 1.3.8 application behavior. It adds repository documentation, exclusions for local/private files, a pull-request template, and GitHub Actions checks. Existing desktop installers are mirrored without modification.

## Checks run during import

- Clean dependency installation completed from the committed lockfile.
- Requirements preservation passed: 26 documents and 1,433 indexed blocks. This checks source preservation, not feature completion.
- The full unit suite ran: 637 passed and 10 failed across 37 files.
- All eight existing desktop installers matched their published SHA-256 manifest before upload.
- A targeted scan found no common GitHub/OpenAI/AWS token patterns, embedded HTTP credentials, or private-key headers in the imported files. This is not a comprehensive security audit.
- Local databases, libraries, private attachments, browser traces, screenshots, old build directories, and local Git history were excluded.

## Inherited unit failures

| Area | Failures | Observed mismatch |
| --- | ---: | --- |
| Report section options | 7 | Medical, diagnosis, prescription, treatment, work-contract, company, and character-work reports produce headings missing from the selectable-section catalog. |
| Event glyph coverage | 1 | At least one built-in event falls back to the generic event glyph. |
| Library placement tests | 2 | Existing assertions differ from the current book/collection/subcollection normalization results. |

These failures existed in the source snapshot before GitHub configuration was added. The checks remain enabled and failing until the behavior or outdated assertions are properly repaired. Importing and mirroring 1.3.8 is not a claim that this baseline passes every test.
