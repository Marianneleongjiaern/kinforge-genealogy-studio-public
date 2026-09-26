# Future Genealogy App Feature Checklist

Product reference: KinForge Genealogy Studio 1.2.2
Brand footer: Product of Dreams of Serene Landscapes  
Purpose: Use this as a reusable feature list when asking someone to build or improve a family tree and genealogy app in the future.

This is a requirements checklist, not proof that every item is completed. Use the versioned release notes and test evidence to distinguish delivered functionality from remaining requirements.

## Latest Additions: Saved Items, Privacy and Recovery

- Item-specific download and delete controls, plus a searchable Saved items workspace.
- Book, collection and tree deletion includes descendant contents, with a preview and exact-name confirmation.
- Cancel, Undo and Redo, empty-library recovery, reference cleanup and cross-device deletion conflict review.
- Scoped backup downloads for containers, original-byte downloads for attachments and structured downloads for individual records.
- Private-to-owner versus authenticated-shared-member visibility; unauthenticated guests only use a separate demo.
- Independent visibility for protection records, government files, events and saved report drafts.
- Server-side redaction and attachment authorization; shared-editor saves preserve hidden owner records.
- Person, family and relationship protection records: type, status, dates, agency, contact, jurisdiction, case reference, notes, sources and attachments.
- Custody removal/change/restoration, protection status and orders, care placements, social-worker and facility events.
- Plain-language, searchable glossary with inline meanings and jurisdiction cautions for legal terms.
- Recovery-code download feedback, delayed download-link cleanup and copy/manual-copy fallbacks.
- A saved report is a snapshot. Changing source-record visibility does not remove sensitive text from an existing report or previously downloaded copy.

## Account Cloud Libraries

- Separate KinForge email/password accounts, each owning a separate cloud library.
- The same account can access its library from the Mac app, Windows app, browser and installed webapp.
- Automatic transfer of a device's previous records to its first signed-in cloud account, with no manual import step and the original device copy preserved.
- Account switches never silently copy the previous account's records into another account.
- Trees, books, collections, subcollections, people, relationships, sources, research, report drafts, portraits and attached files sync together.
- Automatic saving and refresh on reconnect/focus, with account-specific pending-edit storage.
- Independent record/field edits merge; conflicting edits require a visible choice retained across reloads.
- Single-use library sharing invitations with view/edit permissions, expiration and owner revocation.
- Server-checked account permissions on every private data and attachment request.
- Protected browser session cookies and operating-system-encrypted native session storage.
- Private recovery-code password reset, session revocation and replacement recovery codes. Email reset delivery is not included in 1.2.0.
- Online session validation is required when reopening a private library; an already open library can retain edits while temporarily offline.
- Cloud data is not end-to-end encrypted. Invited accounts see ordinary library records and sensitive records explicitly shared with members; owner-private details are withheld by the server.
- Hamburger navigation on phones and portrait iPads; the original sidebar on wide landscape and desktop layouts.
- Automated tests for account isolation, cross-device changes, conflicts, recovery, sharing and responsive navigation.

## 1. Product Versions and Release Formats

- Web version that runs in a browser.
- Installable webapp/PWA for iPhone, iPad, and desktop browser "Add to Home Screen" use.
- Product website with app description, release status, screenshots, and download references.
- Mac app package for Apple Silicon.
- Mac app package for Intel Macs.
- Mac DMG download.
- Mac PKG installer download.
- Mac ZIP app bundle download.
- Windows setup installer EXE.
- Windows portable EXE.
- Versioned release folder in Downloads.
- SHA-256 checksum file for all release artifacts.
- Release notes for each version.
- Clear signing/notarization status file.
- Published ChatGPT Sites version for hosted webapp/website access.

## 2. Branding and Visual Direction

- App name and logo.
- Branded product footer or corner mark.
- Rose-gold, silver, and pastel aesthetic direction.
- Logo applied to app shell, sign-in screen, website, PWA manifest, Mac icon, and Windows icon.
- Consistent navigation labels and app identity across web, webapp, Mac, Windows, and website.
- Non-placeholder product website.

## 3. Authentication, Privacy, and Data Protection

- Sign in screen.
- Create account screen.
- Login screen.
- Forgot password/reset flow.
- Sign out flow.
- Guest/local mode for testing.
- Private tree support.
- Living-person privacy controls.
- Private profile flags.
- Private facts and sensitive notes.
- Private government and protective-services records.
- Report/export filters for private and living people.
- Local-first data storage.
- Backup export.
- Offline webapp support.
- Native app network access restricted to the KinForge cloud service; unrelated network requests blocked.
- Publicly reachable sign-in page, with all private account libraries protected by KinForge authentication.
- Server-backed accounts and library roles are implemented in 1.2.0. Email-based reset delivery, end-to-end encryption and formal security certification remain separate requirements.

## 4. Core Family Tree Data Model

- Multiple family trees.
- Multiple collections and subcollections.
- Unlimited people path.
- Unlimited generation growth path.
- Tree author metadata.
- Family groups.
- Family types such as nuclear family, immediate family, extended family, stepfamily, blended family, foster family, adoptive family, biological family, single-parent family, in-law family, chosen family, household family, and guardianship family.
- Person records.
- Family records.
- Relationship records.
- Event records.
- Fact records.
- Source records.
- Citation records.
- Place records.
- Media records.
- Historical record collections.
- Research task records.
- Change history records.

## 5. Person Profile Features

- Profile overview.
- Right-side profile/details panel when a person is clicked.
- Show more / detailed overview behavior.
- Profile picture for each individual.
- Camera/profile picture change control.
- Biography/life story.
- Notes.
- Aliases and alternate names.
- Labels.
- Gender field.
- Birth date.
- Birth place.
- Living/deceased state.
- Death date.
- Family relationship overview.
- Parents, partners, children, siblings, guardians, wards.
- Relationship type labels on the person's card/profile, not on chart connector lines.
- Timeline/facts view inspired by MyHeritage-style profile sections.
- Photos and videos section.
- Immediate family section.
- Facts section.
- Research this person action.
- Edit person action.
- Add relative action.
- More actions area.

## 6. Person Facts to Include

- Age.
- Age at event.
- Age range.
- Height.
- Weight.
- Eye color.
- Hair color.
- Hair texture.
- Body type.
- Build.
- Complexion.
- Skin tone.
- Dominant hand.
- Distinguishing marks.
- Birthmark.
- Scar.
- Tattoo.
- Physical description.
- Blood type.
- Allergy.
- Medication.
- Medical condition.
- Diagnosis.
- Disability or access need.
- Mobility aid.
- Assistive technology.
- DNA kit.
- Ethnicity estimate.
- Genetic group.
- Haplogroup.
- Religion.
- Language.
- Nationality.
- Citizenship.
- Ethnicity.
- Clan or tribe.
- Education level.
- School.
- Degree.
- Occupation.
- Employer.
- Job title.
- Cause of death.
- Medical note.
- Military rank.
- Title.
- Nickname.
- Preferred name.
- Name pronunciation.
- Adopted status.
- Foster status.
- Protective status.
- Custody status.
- Criminal case.
- Government identifier.
- LDS Baptism, Confirmation, Initiatory, Endowment, Sealing to Parents, and Sealing to Spouse.
- Custom user-defined fact types.

## 7. Birth, Death, Burial, and Sensitive Life Details

- Birth method such as natural birth, C-section, surrogacy, and other birth notes.
- Hospital or facility linked to birth or death.
- Gravesite.
- Burial site.
- Cemetery site.
- Cemetery location.
- Cemetery plot or section.
- Grave number.
- Gravestone yes/no.
- Gravestone inscription.
- Funeral home.
- Memorial URL.
- Place where the person died.
- Hospital where the person died.
- Death notes.
- Doctor association.
- Social worker association.
- Government facility association.
- Government protection status.
- In-patient, daycare, facility, or care setting notes.
- Protective services record upload.
- Custody change record upload.
- Removal record upload.
- Foster record upload.
- Criminal record upload.
- Arrest record upload.
- House arrest record upload.
- Restraining order record upload.
- Personal protection order record upload.
- Other government or court file upload.

## 8. Relationship and Family Structure Features

- Add parents before a person.
- Add descendants after a person.
- Add generations before and after the selected person.
- Add mother, father, parent, child, sibling, spouse, partner, guardian, ward.
- Add biological parents.
- Add adoptive parents.
- Add foster parents.
- Add step parents.
- Add in-laws.
- Add cousin-in-laws.
- Add cousins and extended relationships.
- Add relationship subtypes.
- Record married, engaged, dating, partner, civil union, separated, divorced, annulled, co-parent, guardian, ward, biological, adoptive, foster, and step relationships.
- Record single mom and single dad status.
- Keep chart connector lines clean without relationship text sitting between person cards.
- Put relationship meanings in the legend and person profile/card metadata.

## 9. Dynamic Family Tree Chart Behavior

- Interactive family tree chart.
- Siblings appear beside each other.
- Children and descendants appear below the prior generation.
- Children branch from the centered couple line.
- If there are two children, one can branch left and one right from the centered parent junction.
- More than one child branches from a centered horizontal fork.
- Couples connect with a clean line.
- Parent-child lines branch downward from the couple connection.
- No words such as "sibling" or "spouse" placed in the middle of connector lines.
- Legend explains line styles.
- Family groups visually branch as family units.
- Full tree view.
- Ancestors view.
- Descendants view.
- Generation depth controls.
- Pan and zoom.
- Fit to view.
- Minimap.
- Draggable person cards.
- Saved positions.
- Undo and redo.
- Reject circular ancestry.
- Reject duplicate links.
- Reject self-links.
- Preserve both people when unlinking relationships.
- Browser back/forward support.
- Refresh preserves selected person and route.

## 10. Chart and Diagram Views

- Family tree chart.
- Ancestor chart.
- Descendant chart.
- Hourglass chart.
- Fan chart.
- Relationship chart.
- Ahnentafel diagram.
- Genogram.
- Sociogram.
- Timeline chart.
- Name distribution chart.
- Statistics chart.
- Map/statistic geography views.
- Virtual tree.
- Virtual globe/place projection.
- Gallery view.
- Family quiz path.
- Pedigree-map style feature view.
- Family infographics view.
- Print charts and books view.

## 11. Line Styles, Color Coding, and Symbols

- Color-coded spouse/partner/marriage lines.
- Distinct line types for engaged, dating, married, divorced, separated, annulled, civil union, partner, and co-parent relationships.
- Distinct parentage styles for biological, adoptive, foster, and step parent-child links.
- Immediate family line/category.
- Extended family line/category.
- Cousin line/category.
- Guardian and ward style.
- Sibling or "parents not linked" style.
- Co-parents with no union recorded style.
- Relationship chart line legend.
- Tree legend.
- Report/chart legend.
- Glyph labels wherever glyphs appear.

## 12. Glyph and Symbol Library

- In-app Glyph Library section.
- Search glyph meanings inside the app.
- Link to each glyph library/category.
- Standalone glyph library page.
- Group-specific glyph links.
- Downloadable SVG glyphs.
- Event glyphs.
- Relationship glyphs.
- Disability glyphs.
- Accessibility-needs glyphs.
- Record-status glyphs.
- Person symbols.
- Gender symbols.
- Symbols for blindness.
- Symbols for deafness.
- Symbols for deafblindness.
- Symbols for cerebral palsy.
- Symbols for paralysis.
- Symbols for limb loss/amputee.
- Symbols for neurological impairment.
- Symbols for access needs such as captions, sign language, screen reader, quiet environment, reduced lighting, extra time, communication aid, and personal assistance.
- Symbols for separation, divorce, annulment, adoption, guardianship, foster care, child custody, criminal/legal/government events, medical events, DNA, school, work, property, migration, religious events, will/probate, burial, cremation, memorial, and death.
- Glyph meaning labels in family tree, report charts, kinship reports, and generated reports.

## 13. Reports and Editable Drafts

- Editable report drafts that behave like formatted fillable forms.
- MacFamilyTree-inspired report layout and styling.
- Report text size set to 15 pt.
- Profile image included in person-centered reports.
- No unnecessary indentation under top report sections.
- Plain-language explanations for kinship terms.
- Person Report.
- Family Report.
- Family Group Report.
- Kinship Report.
- Relationship Report.
- Narrative Report.
- Person Events Report.
- Ahnentafel Report.
- Descendancy Report.
- Register Report.
- Status Report.
- Timeline Report.
- Today Report.
- Map Report.
- Particularities Report.
- Person Analysis.
- Plausibility Report.
- Sources List.
- Facts List.
- Events List.
- Anniversary List.
- Places List.
- Person List.
- Marriage List.
- Marriages List.
- To-do List.
- Changes List.
- LDS Ordinances List.
- Distinctive Persons List.
- Fan Chart report.
- Hourglass Chart report.
- Relationship Chart report.
- Ahnentafel Diagram report.
- Genogram report.
- Sociogram report.
- Timeline Chart report.
- Name Distribution Report.
- Name Distribution Chart.
- Influential People Report.
- Family Tree Book.
- Report sections for biography, facts, events, media, partners, parents, children, ancestors, descendants, notes, sources, citations, world history, kinship explanations, access needs, and government/sensitive details.
- Family Reports include family member biographies and facts.

## 14. Kinship Explanations

- Explain maternal vs paternal side.
- Explain relationship paths from the selected person's point of view.
- Explain 1st, 2nd, 3rd cousin and beyond.
- Explain once removed, twice removed, thrice removed and beyond.
- Explain cousin-in-law vs blood cousin.
- Explain generation removed counts.
- Example-style explanation such as "A's first cousin once removed is B because..."
- Include kinship explanation in Person Reports and Kinship Reports.
- Include cousin and relationship symbols where applicable.

## 15. Sources, Citations, and Evidence Quality

- Source templates.
- 100+ predefined source templates.
- Custom source template fields.
- Citation style presentation.
- Source list report.
- Claims without attached citations.
- Evidence quality dashboard.
- Source coverage score.
- Event citation score.
- Media coverage checks.
- Parent-link review.
- Duplicate-risk review.
- Plausibility issue review.
- Private/sensitive export review.
- Generate research to-do tasks from weak evidence points.
- Reviewed evidence linking that does not overwrite vital facts.
- Local research workflow without requiring outside providers.

## 16. Research, Records, DNA, and Import/Export

- Research launcher.
- Search targets for genealogy websites.
- Local archive/evidence search.
- Historical records workspace.
- Record transcription.
- Record citation.
- Link records to people.
- DNA workspace.
- DNA matches.
- Genetic groups.
- Chromosome segments.
- Cluster notes.
- Centimorgan values.
- Relationship estimates.
- Ethnicity estimates.
- GEDCOM 5.5.1 import/export.
- GEDCOM 7 import/export.
- GEDCOM append to existing tree.
- GEDCOM new-tree import.
- GEDCOM duplicate merge review.
- GEDCOM privacy export controls.
- Export private/living-person-safe subsets.
- Static family website export.
- Backup JSON export.

## 17. Media and Shared Library

- Shared media library.
- Upload photos.
- Upload videos.
- Upload audio.
- Upload PDFs.
- Upload documents.
- Upload websites/URLs.
- Assign media to people.
- Assign media to families.
- Assign media to sources.
- Assign media to places.
- Assign media to events.
- Profile portrait selection.
- Picture rotation state.
- Crop state.
- Colorize flag/workflow.
- Enhance flag/workflow.
- Repair flag/workflow.
- Tags.
- Story/caption fields.
- Transcript fields.
- Gallery views.
- Profile photos in reports.

## 18. Maintenance and Quality Tools

- Consistency checker.
- Plausibility checker.
- Duplicate finder.
- Search and replace.
- Preview maintenance changes before applying.
- Apply, undo, and redo maintenance changes.
- Date normalization.
- Name reformatting.
- Empty-entry cleanup.
- Family repair.
- Media cleanup.
- Evidence maintenance.
- Change history.
- Feature Coverage screen mapping capabilities to validation evidence.
- Exact Ideas.md wording preservation.
- Competitive SWOT workspace for Ancestry, MyHeritage, MacFamilyTree, RootsMagic and other genealogy patterns.

## 19. User Interface Sections

- Dashboard.
- Family Tree.
- People.
- Families.
- Library.
- Places and Sources.
- Research.
- Media.
- Charts.
- Reports.
- Publish and GEDCOM.
- DNA.
- Maintenance.
- Feature Coverage.
- Glyph Library.
- Evidence Quality Studio.
- Competitive Edge/SWOT.
- My family tree feature area.
- My photos feature area.
- Import GEDCOM feature area.
- Manage trees feature area.
- Print charts and books feature area.
- Family infographics feature area.
- Consistency checker feature area.
- Timeline feature area.
- PedigreeMap-style feature area.
- Relationship report feature area.
- Sources feature area.
- Backup feature area.

## 20. Export and Publishing

- PDF export.
- Fillable PDF export.
- RTF export.
- CSV export.
- Text export.
- Print workflow.
- Family Tree Book export.
- Chart PDF export.
- Static website export.
- GEDCOM export.
- Backup export.
- Webapp ZIP.
- Website ZIP.
- Mac release instructions.
- Windows release artifacts.
- Release checksums.
- Notarization/signing disclosure.

## 21. Testing and Validation to Ask For Next Time

- Unit tests for data model, charts, reports, GEDCOM, privacy, kinship, glyphs, sources, and maintenance.
- Browser tests for family tree navigation, person editing, profile photo persistence, report drafts, offline PWA behavior, and responsive layout.
- Native Mac launch smoke test.
- DMG checksum verification.
- ZIP archive integrity checks.
- Windows installer and portable executable build verification.
- Published website/webapp deployment confirmation.
- Downloads folder checksum verification.
- Honest signed/notarized status.
- Exact requirement-to-feature matrix.
- Known limitations section.

## 22. Important Production Notes for a Future App Brief

- Say whether authentication must be local-only, ChatGPT Sites private access, or true cloud account authentication.
- Say whether cloud sync and multi-user collaboration are required.
- Say whether Apple notarization is required; if yes, provide Developer ID certificates and notary credentials.
- Say whether Windows executables must be tested on a real Windows machine.
- Say whether provider integrations are required or whether the app must remain independent without connectors.
- Say whether AI photo tools must run locally, use a hosted model, or be represented as reviewable manual workflows.
- Say whether medical, disability, legal, child protection, and government records should be hidden by default and require explicit private export permission.
- Say which reports must match MacFamilyTree exactly and which can be KinForge-styled.
- Say which chart layouts are mandatory: family tree, fan, hourglass, genogram, sociogram, relationship chart, timeline, name distribution, map.
- Say that no controls should be placeholders: every visible button, dropdown, menu item, and report type should either work or be marked unfinished.

## 23. Optional Google Drive and OneDrive Connections (1.3.0)

- Account-owner connections for full private libraries, trees, books, collections, nested subcollections, media and saved report drafts.
- Automatic copying of accepted library changes; a separate offline queue for generated reports, backups and other exported files.
- Saved-export list with download and deletion across devices and connected providers.
- Provider status, last sync, pause/resume, disconnect/reconnect and manual retry.
- Review changed drive-library copies and preserve prior snapshots before restore.
- Server-encrypted provider tokens, browser-bound OAuth with PKCE and single-use authorization tickets.
- Exclude account recovery secrets, guest work and another account's jobs from provider uploads.
- Register provider applications, configure server-only credentials and verify real-account consent, transfer and recovery before claiming a live connection is ready.
- Keep the primary KinForge account cloud library available independently of provider failures.

## 24. Short Prompt You Can Reuse Later

Build a dynamic, multi-page genealogy app, not a single-page mockup. Include interactive family-tree charts with siblings beside each other, descendants below parents, centered couple-to-children branching, clean connector lines, legends, relationship symbols, profile photos, person overview/edit panels, biography, age/height/weight and expanded person facts, family types, relationship subtypes, foster/adoptive/biological parentage, government-sensitive record uploads, birth/death/burial details, media library, GEDCOM import/export, source/citation management, research tasks, evidence quality checks, DNA workspace, glyph library, full report generator, editable MacFamilyTree-style report drafts, kinship explanations, privacy controls, backups, website export, installable webapp/PWA, Mac DMG/PKG/ZIP, Windows EXE, release notes, checksums, and tests for every major workflow. Every listed feature must have a working control, validation evidence, and an honest status.
