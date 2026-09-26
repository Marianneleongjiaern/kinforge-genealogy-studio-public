# GitHub publishing

Repository: https://github.com/Marianneleongjiaern/kinforge-genealogy-studio

This private repository keeps the shared application source for Mac, Windows, webapp, website, and the current ChatGPT Site together. Installer binaries belong in Releases rather than Git history. Family libraries, runtime databases, private attachments, session files, and deployment secrets are excluded.

## Pull requests

1. Create a branch from `main`.
2. Make the scoped change and run the relevant checks described in the README.
3. Push the branch and open a pull request describing behavior, checks, and release impact.
4. Review the diff and GitHub checks before merging.
5. Build releases from the reviewed commit and publish the matching version tag.

The initial import is a clean 1.3.8 source snapshot, including the existing environment-token option in the installer upload helper. Old local Git history, installer build directories, runtime data, screenshots, and browser traces were not imported.

## Webapp, website, and ChatGPT Site

`npm run build` produces `dist/client`, `dist/server`, and `dist/.openai`. The browser assets include the website, webapp manifest, service worker, fonts, glyphs, and requirements. The server provides the authenticated account API and requires the `DB` and `BUCKET` bindings named in `.openai/hosting.json`.

GitHub Actions retains a downloadable web build for each passing run. The 1.3.8 release also includes a deployment archive. Publishing a GitHub commit or release does not automatically deploy to ChatGPT Sites; its existing deployment process and secrets remain separate. Verify `/api/health` and `/api/releases/latest` after deploying a live update.

## Desktop release

Build on the appropriate supported platform and validate the packages before uploading. The existing build scripts are in `scripts/`, with release details in `DESKTOP_RELEASE_PUBLISHING.md`.

Create a draft release for the reviewed version tag, attach the installers and web build, and include SHA-256 checksums. Verify every uploaded asset before making the release available. The initial 1.3.8 GitHub release mirrors the already-built installers byte-for-byte; it does not change the installed Mac version or its update feed.

Native signing and Apple notarization require the owner's signing credentials. The current 1.3.8 Mac release is locally signed, not Apple-notarized.

## Access and secrets

Repository and release downloads require access to this private repository. The live site's public download page remains available for people without GitHub access. Keep service credentials in the deployment environment or GitHub Actions secrets when a workflow requires them. Never commit runtime databases or private libraries.
