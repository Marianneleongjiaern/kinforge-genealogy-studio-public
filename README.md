# KinForge Genealogy Studio

KinForge is a family-tree, genealogy, and character-record application by Dreams of Serene Landscapes. This repository contains the version 1.3.8 desktop, webapp, website, and ChatGPT Site source.

- [Open the live app and website](https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/)
- [Download desktop installers](https://github.com/Aesdocktectics/kinforge-genealogy-studio/releases)
- [Live downloads and in-app update feed](https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/downloads)

## Project layout

| Folder | Purpose |
| --- | --- |
| `src/` | Shared React application: trees, people, reports, libraries, and account UI |
| `electron/` | Mac and Windows desktop wrapper, protected native sessions, and update downloads |
| `website/` | Companion website assets |
| `public/` | Installable webapp manifest, service worker, glyphs, fonts, and preserved requirements |
| `server/` | Cloud authentication, account libraries, sharing, files, and release endpoints |
| `db/`, `drizzle/` | Database schema and migrations, without user records |
| `.openai/hosting.json` | Existing ChatGPT Site project and storage-binding configuration |
| `tests/`, `src/*.test.ts` | Browser, cloud, native-wrapper, and unit checks |

## Run locally

Use Node.js 22.12 or newer in the Node.js 22 series, and npm. Install dependencies, validate the preserved requirements, and build:

```sh
npm ci
npm run build
```

Run the local account/database service in one terminal and the browser app in another:

```sh
npm run dev:cloud
```

```sh
npm run dev -- --port 5174
```

Open `http://127.0.0.1:5174`. The local service uses a separate development database in `.cloud-dev/`. Email delivery, support routing, and drive OAuth require their documented service configuration; credentials are not included in this repository.

## Validate changes

```sh
npm test
npm run build
npm run test:cloud
node --test tests/releases.test.mjs tests/native-startup.test.mjs
```

For browser checks, start the local services above, then run:

```sh
npx playwright install chromium
npm run test:browser
```

Pull requests run the build, unit, cloud, release, and native-wrapper checks on GitHub Actions. Browser/device validation and Apple notarization are separate release checks.

## Releases and hosting

GitHub Releases holds Apple Silicon and Intel DMG/PKG/ZIP packages, Windows setup/portable EXEs, checksums, and a web deployment archive. See [the GitHub publishing guide](docs/GITHUB_PUBLISHING.md) for the pull-request and release process.

The live webapp, website, and authenticated cloud service continue to run on the existing ChatGPT Site. GitHub stores their source and downloadable build. The cloud service requires database and object-storage bindings; uploading its source to GitHub does not migrate account records or run that server on GitHub Pages.

The 1.3.8 Mac packages are locally signed and are **not Apple-notarized**. Windows packages are not represented as code-signed. Do not describe a package as notarized or signed by a verified publisher without verifying those credentials and artifacts.

Preserved requirement documents and historical release notes are included for continuity. They are not proof that every requested feature is implemented or tested. Beta backup controls do not guarantee that experimental software can never lose data.

Copyright (c) Dreams of Serene Landscapes. No open-source license is granted by this repository. Bundled third-party assets retain their included licenses.
