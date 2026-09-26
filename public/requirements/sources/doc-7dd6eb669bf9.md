# KinForge Sites Deployment

Published successfully on 23 September 2026 at 10:33 Singapore time.

## Open KinForge

- [Interactive web workspace and installable web app](https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/app/)
- [Product website](https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/website/)
- [Versions and current limits](https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/website/versions.html)
- [Previous archive](https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/)

The existing owner-only access policy was preserved. This is not a public launch.
The requested credit, "Product of Dreams of Serene Landscapes", appears in the
workspace and product website.

## Verification

- Original archive: 84 automated checks passed.
- New workspace: 15 automated checks passed.
- Browser suite: all 12 workflows passed against the final combined production
  build served locally. The prior full run also passed all 12 twice consecutively.
- Browser checks cover routes, profiles, relatives, circular-ancestry rejection,
  edits, undo/redo, tree isolation, chart dragging and zoom, mobile layout, PDF
  download, page links, image loading and offline reopening.
- The coexistence test verifies that edits in the newer workspace do not modify
  the previous archive's database and that both offline caches remain available.
- Production dependency audits: no reported vulnerabilities in either app's
  production dependencies. Development-only audit findings remain; development
  servers are not deployed.
- Sites returned a terminal `succeeded` deployment status with the production
  URL. Authenticated production interaction and installation on every physical
  browser/device were not independently tested in this publication step.

A rapid-selection bug found during testing was fixed: immediate edits after
selecting a search result can no longer reach the previously selected person.
Mobile navigation was checked in screenshots and the added links were placed in
the navigation menu to avoid crowding the header.

## Important Limits

This completes the Sites publishing step, not the entire Ideas.md specification.
Cloud accounts, verified email password recovery, cross-device sync,
collaboration, provider connections and several advanced genealogy capabilities
remain incomplete. Local profile passwords do not encrypt the archive or
provide separate per-user data. ChatGPT Sites access is a separate protection.

The previous archive and newer workspace have separate browser-local data
stores. Existing records were not migrated, overwritten or uploaded. Localhost,
the published Site, different browsers and native desktop applications each
have separate storage. Backups are still required.

Mac/Windows installers were not rebuilt or hosted as part of this publication.
Their existing platform validation and signing limits still apply.

## Release Identity

- Site: `appgprj_6ab29683c4f88191bf9c49518e772acf`
- Pushed source: `9e27ffeec4a09ea85a00221180ddbc9e29eac6d7`
- Deployment: `appgdep_6ab33a686c38819180e5f923d4dd5ebf`
- Saved version: `appgprj_6ab29683c4f88191bf9c49518e772acf~appgver_8d52c8f094a88191875f5fb8802868d5`
- Archive: `kinforge-sites-deploy.tar.gz`
- Archive SHA-256: `d8708a9826851224a06fb4c1c001d32c56449a6ce847217833681690181b6a93`

The installed Sites packaging helper disappeared during preparation. The
unchanged tested output was packaged directly, the exact remote source commit
was verified, and the native Sites save-and-deploy operation succeeded.
