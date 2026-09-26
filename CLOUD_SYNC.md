# KinForge 1.2.2: Your Account Library

Sign in with the same KinForge email and password on each device. Each account has a separate cloud library. Trees, people, relationships, books, collections, subcollections, report drafts, research records, photographs and files attached inside KinForge save together.

## Existing Work

The first cloud sign-in on a device automatically transfers that device's previous KinForge library into the signed-in account. There is no import or export step. The original device copy remains untouched. A marker prevents that same device library from being copied into a different account after an account switch.

Existing device-only accounts with passwords of at least 12 characters can be upgraded during sign-in. Accounts with shorter passwords need a cloud account created with the same email and a longer password; the records still transfer automatically. An account already created in the cloud always requires its cloud password.

## Saving and Reconnection

The header shows Saving to cloud, Synced, or a connection/access issue. Changes save after editing pauses briefly. Open sessions check for updates about every five seconds and when the app regains focus or connectivity.

While a signed-in library is open, offline edits are kept in an account-specific device cache and sent when connectivity returns. Opening a private library on a fresh launch requires an online session check. Keep the window open if device storage reports a failure, or download a backup.

Independent changes merge by record and field. If two devices edit the same field, or one deletes a record the other edits, KinForge asks which version to keep. That unresolved choice remains after a reload. Only one tab per library can edit within the same browser profile, protecting unsaved device changes.

## Sharing

Account & sharing lists your library and libraries shared with you. The owner can create a single-use invitation code valid for seven days, with Can view or Can edit permission. The receiving person signs into their own KinForge account and accepts the code. Invitation codes are not emailed automatically.

Private sensitive details stay with the library owner's account. "Visible to shared-library members" means signed-in invited accounts, not public internet visitors. Continue as guest opens a separate device-only demo and cannot retrieve any account library.

The person-level setting controls government/care details, facts marked private, and accessibility annotations. Protection records, files, events and report drafts have separate settings. Government-file uploads default to private for an owner and shared for a shared editor. Other existing media remains shared unless marked private. Only the owner can change existing sharing settings. Shared editors can edit shared details but cannot overwrite hidden owner records or delete a container that contains protected hidden records.

Report drafts generated with private annotations default to private for the owner. Reports are saved snapshots: changing a person's visibility does not retroactively redact an already shared report, pasted prose or downloaded file. Review a report and its own visibility before sharing it.

The owner can revoke unused invitations and remove a member's future access. Removing access cannot erase copies someone has already downloaded.

If a shared editor attempts a change that would affect hidden owner records, sync shows Changes need review. The pending work remains on that device and Undo stays available. Undo the rejected change, correct it, or ask the owner to make it. Retry does not bypass privacy protection.

## Library Placement

From Manage Trees, choose a book and a collection or subcollection for every family tree. Collections can be moved to another book and can be assigned a different parent collection; nested subcollections follow their parent when the parent moves books. A report draft has the same Book and Collection or subcollection selectors in Reports. Older reports inherit the placement of their tree automatically, and invalid cross-book links are cleared during migration.

## Account Recovery

New cloud accounts receive a private recovery code. Download it and keep it securely. The download button reports a confirmed native save or browser download initiation; browsers cannot confirm the eventual file save. Copy recovery details provides a fallback, including selectable text if clipboard access is blocked. "I have saved it" remains a separate, deliberate confirmation. Forgot password requires this code and creates a replacement recovery code. Password reset signs out older sessions. Email-based reset messages are not sent by this release.

Passwords are stored as salted scrypt hashes. The server verifies account and library permissions on every data request. Browser session cookies are protected; native sessions are encrypted through the operating system. Cloud data is not end-to-end encrypted.

## Devices and Navigation

Use the published KinForge address on the web. Safari's Add to Home Screen installs the webapp on iPhone and iPad. The Mac and Windows editions connect to the same service.

Phones and screens up to 960 CSS pixels use a hamburger menu. Portrait tablets up to 1024 CSS pixels also use it. Wider landscape tablets and desktops keep the sidebar. The compact menu opens vertically and closes when a page is selected.

Exports downloaded outside KinForge remain local copies. Reports and attachments stored inside the account library sync. The webapp does not silently scan the Downloads folder or unrelated device files.

## Deletion and Downloads

Saved items offers individual downloads and deletion for books, collections, trees, people, relationships, family records, events, sources, places, media, research tasks, DNA matches, historical records, protection records, report drafts, templates, person facts, access annotations, labels and custom types. A tree, book or collection deletion previews its contents and requires its exact name. Changes can be undone in the current editing session and sync to the account. A concurrent edit inside a deleted container requires a choice rather than silently losing the edited records.

Book, collection and tree downloads are scoped backup JSON files. Saved-item downloads contain the selected record and supporting references; uploaded files download as their original bytes. Existing chart/report PDF and document exports remain in their respective workspaces. These actions do not delete user accounts, unrelated device files, previously exported copies or historical cloud recovery snapshots.

## Release Notes

The Mac installers are not Apple-notarized because no Developer ID signing identity is installed. Windows installer files are built on this Mac; Windows execution needs separate validation on Windows.
