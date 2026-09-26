# Google Drive and OneDrive

KinForge 1.3.0 adds optional drive connections to the account owner's full private library. Find them under **Cloud drives** in the signed-in app. The integration requires app registration with Google and Microsoft before real accounts can connect. KinForge sign-in and the existing account cloud library remain independent of these providers.

## Included behavior

- Automatically mirror accepted library revisions, including trees, collections, nested subcollections, books, people, relationship data, report drafts and media attachments.
- Capture generated downloads (PDF, fillable PDF, RTF, text, HTML, CSV, GEDCOM, chart files, backups and individual-item downloads) in the owner's cloud export library, with automatic uploads to each connected provider.
- Save export jobs on the originating device while offline and retry only under the same account and library. A report that finishes generating after an account switch stays bound to its originating account.
- Download and delete saved exports from any signed-in device. Export deletion removes its connected-drive copies; local downloaded files stay on the devices.
- Pause, resume, reconnect, disconnect and manually retry providers independently.
- Detect drive-library changes before replacement. The owner reviews the copies and chooses the current KinForge library or restores the drive version. Stale review decisions fail; previous KinForge snapshots and the reviewed drive document are retained.
- Verify referenced drive files by provider versions. Rebuild missing attachments and exports, and keep independently edited files as separate copies when restoring the canonical library copy.
- Keep recovery-code downloads local. Guest mode and shared-library members cannot connect drives or read the owner's saved exports. Shared-editor changes to the main library are still mirrored through the owner's existing drive connections after the server accepts them.

## Registration

Production origin: `https://kinforge-genealogy-studio.marianneleong3.chatgpt.site`

1. In Google Cloud, enable the Google Drive API, configure the consent screen, and create a **Web application** OAuth client. Register this exact return address:
   `https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/api/drive-oauth/google/callback`
2. Configure Google's `drive.file` permission. KinForge only requests access to files it creates. Configure permitted test users while the consent app is in testing, or finish Google's publishing requirements for broader use.
3. In Microsoft Entra, register KinForge for personal Microsoft accounts and organizational accounts. Add this **Web** redirect:
   `https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/api/drive-oauth/onedrive/callback`
4. Configure delegated Microsoft Graph `Files.ReadWrite.AppFolder` and `offline_access`, then create a client secret. This supports OneDrive storage, not Outlook mail or calendars.
5. Configure the following production runtime values with Sites. Do not put secrets in frontend code, source control, installers or a chat message:

| Variable | Value |
| --- | --- |
| `DRIVE_PUBLIC_ORIGIN` | The production origin above, without a trailing slash |
| `DRIVE_TOKEN_KEY` | A random 32-byte key encoded as 64 hexadecimal characters; secret |
| `GOOGLE_DRIVE_CLIENT_ID` | Google Web OAuth client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Google client secret; secret |
| `ONEDRIVE_CLIENT_ID` | Microsoft application/client ID |
| `ONEDRIVE_CLIENT_SECRET` | Microsoft client secret; secret |

Deploy a saved Site version after updating runtime values. Each library owner then selects **Connect Google Drive** or **Connect OneDrive** and grants access in the provider's browser screen. No family data is sent before connection. Mac and Windows use the system browser with a short-lived, single-use, account-bound authorization ticket.

## Storage and security

Each provider has a separate `KinForge-<library ID>` folder, so separate KinForge accounts do not mix even when linked to the same drive account. Google stores it at the drive root; OneDrive uses its KinForge application folder. `Library.json` contains the complete structured library and references to uploaded media and exports. `Library media` preserves attachments as lossless data-URL files; exported reports and media downloads retain their normal file types in category folders.

Drive copies include sensitive owner-private details. They follow the sharing controls of that drive account. KinForge never changes drive sharing permissions or makes these files public. Provider refresh tokens are encrypted with AES-GCM on the server; they never enter the app state, browser storage, exports or installers. Provider credentials are scoped to the library owner. OAuth uses a single-use state, PKCE, a browser-bound cookie and a still-valid KinForge initiating session.

## Current limits and validation boundary

- The primary cross-device library remains KinForge's cloud database. Drive copies update after accepted saves; arbitrary edits made directly to `Library.json` are reviewed, not silently merged.
- Large libraries transfer in durable batches. Keep KinForge open until both providers say **Up to date**; an active app retries every 20 seconds, and accepted saves also start background transfers. No always-on scheduled drain is provisioned.
- Export uploads currently support files up to 36 MB. Larger files still download locally, with an explicit notice.
- Previously downloaded files are not scanned from the computer's Downloads folder. Generate them again to include them in cloud exports.
- Restore validates the library and its existing media references. A manually modified copy referring to media unknown to this KinForge library is rejected.
- Disconnect removes KinForge's saved provider credentials but retains already uploaded files. Provider consent can also be revoked in the provider's own account settings.
- System printing, system-share sheets, and static glyph links are not captured as saved file exports. Saved report drafts and explicitly downloaded report files are included.
- Provider API tests use simulated endpoints and synthetic data. Real Google/Microsoft OAuth, quotas and permissions must also be tested after app registration; do not describe mocked-provider tests as a live-account sync test.

Official references: [Google OAuth web flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [OneDrive application folders](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder), [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
