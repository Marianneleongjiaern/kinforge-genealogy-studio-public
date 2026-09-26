# KinForge 1.3.2: Form and Library Alignment

## Corrected

- Reproduced the Manage Trees misalignment in the installed Mac app using Computer Use: collection rows exceeded the book panel, fields entered the adjacent tree list, and download/delete controls overlapped neighboring content.
- Keep book and collection inputs within their grid tracks, including long names.
- Give collection names, placement fields and action buttons explicit positions. Stack the placement fields according to the panel's available width.
- Keep tree download/delete buttons beside their own tree heading, above the placement fields.
- Keep dropdown labels and controls together in tree settings, person editing, places, sources, charts, media assignment, export settings and DNA matches. This also gives previously detached labels a proper association with their control.
- Adapt settings columns to available space. Give compound date editors a full row and preserve editable date ranges on small screens.
- Add consistent spacing between the library toolbar, book panels and active-tree settings.

## Validation

- 620 unit tests passed across 34 files.
- 24 existing browser workflows passed, covering library placement, saved-item downloads/deletion/undo, person facts, profile editing, tree controls, navigation and offline reopening.
- Four new browser tests cover five form views at 1440, 1024, 820 and 390 pixels: Manage Trees, person editing, Places & Sources, Charts and DNA. They assert container/window bounds, label placement, non-overlapping library actions, and persistent edits after reload, including date-range fields.
- Desktop and phone screenshots were inspected. Layout changes do not alter account data or cloud-sync rules.
- The final combined browser run passed all 28 cases. Eight release-route tests passed.
- Both installed Mac copies are version 1.3.2. The isolated native workflow passed tree layout, profile navigation, maintenance apply/undo/redo and reload checks with no page errors.
- Apple Silicon and Intel DMGs were mounted, PKGs expanded, and their app signatures, architectures and bundled frontend assets verified. ZIP integrity and Windows executable headers passed. These checks are not a claim of Intel or Windows hardware execution.

## Release Boundaries

Mac apps remain ad-hoc signed, not Apple-notarized. PKGs and Windows executables are not publisher-signed. Intel and Windows hardware execution is not claimed. See the release folder's publication record for final installed-app, installer and deployment verification.
