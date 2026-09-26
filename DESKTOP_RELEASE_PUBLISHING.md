# KinForge desktop publication

## Release 1.3.3

- Public downloads: https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/downloads
- Web app: https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/
- Website: https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/website/
- Local installers: `/Applications/KinForge Genealogy Studio/Installers/1.3.3`
- Installed Mac app: `/Applications/KinForge Genealogy Studio.app`
- Matching second copy: `/Applications/KinForge Genealogy Studio/KinForge Genealogy Studio.app`
- Previous app bundles: `/Applications/KinForge Genealogy Studio/Previous Applications`
- Reports and exported data remain in `~/Downloads/KinForge Genealogy Studio`.

Apple Silicon and Intel each have DMG, PKG and ZIP files. Windows has setup and portable EXEs. Mac apps are ad-hoc signed, not Developer ID signed or Apple-notarized. The PKG installers and Windows packages are not publisher-signed. Both installed Mac copies have been replaced with 1.3.3 after verifying their signatures; previous bundles were moved into the backup folder. Account data and reports were not moved or erased.

## Publication safeguards

Only the eight explicitly listed installers in `server/releaseManifest.ts` can be uploaded or downloaded. Account libraries and their attachments use different routes and storage keys; the public download routes do not accept arbitrary object keys.

`scripts/prepare-release-manifest.mjs` calculates sizes and SHA-256 checksums from the verified local files. Uploads use the existing private storage binding and the [Cloudflare R2 multipart API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/). A temporary server-side publisher secret and expiry are required. No account password, family data, Google token or Microsoft token is used to publish installers.

`scripts/publish-installers.mjs` reads its temporary secret through hidden standard input and uploads bounded parts. The server checks the full file checksum before making its download visible. The publisher then checks the public file size/checksum and compares downloaded first/last byte ranges with the local file, verifying download resumption without repeatedly downloading every large package. Remove the temporary publisher secret after publication and redeploy the same saved version to disable further uploads.

Downloads include Content-Disposition filenames, byte-range support for resumption, and a checksum on the downloads page. Web publication and installer upload are separate steps: a successful Site deployment alone does not prove that the eight downloads have been uploaded.

## Validation

The hierarchy update passed 626 unit tests, 31 browser workflow tests and eight release-route tests. Hierarchy tests cover multiple collections per book, multiple subcollections per collection, rename persistence, collapse/expand, and moving branches with their contents. Alignment cases cover five form views at desktop, landscape tablet, portrait tablet and phone widths. Release-route tests cover unauthorized and expired uploads, unknown filenames, partial uploads, incorrect lengths/checksums, downloads, HEAD requests, range requests, and the download page. The packaged Mac app passed the native workflow test with an isolated profile, including the new hierarchy controls. Intel and Windows execution on their respective hardware remains untested. See RELEASE_NOTES_1.3.3.md and the release folder's publication record for final installer, deployment and existing-account verification status.

Google Drive and OneDrive integrations require provider app registration and user consent before they can connect. See DRIVE_SYNC_SETUP.md.
