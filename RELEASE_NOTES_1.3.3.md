# KinForge 1.3.3: Books, Collections and Subcollections

## Corrected Hierarchy

- Each book has its own Add collection control. A book can contain multiple independent collections.
- Each collection has an Add subcollection control. Its subcollections are rendered visibly nested beneath it, rather than flattened into a book-wide list.
- Real arrow buttons expand and collapse collection details and nested contents independently. They support keyboard activation and expose their expanded state to assistive technology.
- Every collection and subcollection has an editable name. Renames save through the existing library persistence and sync pipeline; the names survive reload.
- New collections belong to the chosen book, not whichever tree happens to be active. Multiple new items receive distinct default names.
- Tree and report destination lists show full collection paths, distinguishing identically named subcollections under different parents.
- Moving a collection moves its nested subcollections and filed trees/reports together. Unrelated content stays in place. Circular parent assignments are rejected.
- Invalid legacy parent loops are repaired without deleting collections or genealogy records. Existing names and IDs are preserved.
- Responsive form alignment from 1.3.2 is retained.

## Validation

- 626 unit tests passed across 35 files, including six new hierarchy cases.
- 31 browser workflow tests passed against the production build. They include creating and renaming multiple collections/subcollections, independent mouse/keyboard collapse and expansion, saved names after reload, branch moves, report placement, deletion/undo, and offline reopening.
- Alignment checks passed at 1440, 1024, 820 and 390 pixels. Desktop and phone screenshots were visually inspected.
- Eight publication/download route tests passed.
- The packaged Apple Silicon app passed the isolated native workflow, including the new hierarchy controls, renaming, collapse/expand and reload, plus existing tree and maintenance workflows.

## Release Limits

Mac apps remain ad-hoc signed, not Developer ID signed or Apple-notarized. PKGs
and Windows executables are not publisher-signed. Intel and Windows hardware
execution is not claimed. See the local installer folder's publication record
for final package verification, installed-app and deployment status.
