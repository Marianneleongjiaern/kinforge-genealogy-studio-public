# KinForge Sites Release

## Published layout

- `/app/`: interactive KinForge workspace 1.1.0 and installable web app.
- `/website/`: product website, with a separate versions/status page.
- `/index.html` and the existing page addresses: previous archive 0.3.1.

The existing owner-only Sites audience is retained. Existing IndexedDB records
are not migrated, overwritten or uploaded by this release. The newer workspace
uses a separate local browser store. Moving between browsers, desktop apps or
devices does not synchronize genealogy data.

Both applications have independently scoped offline caches. The previous
archive's worker handles only its own known resources, and the new workspace's
worker handles only `/app/`. Each worker removes only its own obsolete caches.

Person selection now commits synchronously, preventing a rapid edit immediately
after a search result selection from reaching the previously selected person.
Visible edits are persisted before paint and survive immediate reloads.

## Scope and limits

This release publishes the existing local workspace; it does not complete the
entire Ideas.md specification. The requirement lists are planning information,
not evidence that every capability is implemented or tested.

Local profile screens are not secure cloud authentication. They do not isolate
records per user or encrypt local records. Verified recovery email, cloud
storage, synchronization, collaboration and several advanced genealogy
capabilities remain unfinished. The Site's access policy is separate from these
local profiles.

Desktop installers are not hosted in this deployment. The local release folder
contains separate Apple Silicon/Intel DMGs and Windows builds. Only the Apple
Silicon copied installation has passed the local native smoke test. Intel and
Windows runtime validation, macOS distribution signing and notarization remain
outstanding.

## Repeatable checks

- Existing archive: `npm test` in the Site root.
- Interactive workspace: `npm test --prefix workspace`.
- Combined production build: `npm run build` in the Site root.
- Production browser checks: serve `dist` locally, then run the workspace's
  browser suite with `KINFORGE_TEST_URL` set to that server's `/app/` URL.

The browser suite covers dynamic routes, person edits, relationships,
ancestor/descendant controls, history, mobile widths, offline reopening,
website links and images, and coexistence with the original local archive.

Deployment completion is verified through the Sites deployment status, not by
treating a local preview as the published product.

The web-only copy uses jsPDF 4.2.1 to remove advisories reported against the
older PDF library. Production dependency audits pass for both applications.
Development-only dependencies still have audit findings and must not be
exposed as production servers. Sites serves the generated static output only.
