# KinForge 1.3.1 Validation

Validated on this Apple Silicon Mac on 25 September 2026. This document records the startup fix and release checks, not a claim that every historical feature has been re-tested.

## Reproduction and Fix

The installed 1.3.0 app opened an empty window with an existing signed-in profile. The recorded renderer error was `Cannot read properties of undefined (reading 'map')`, from reading `customFactTerms` in an older cloud library. Fresh guest profiles did not reproduce the crash. Shared hydration now upgrades cloud, cache, legacy and guest libraries consistently, without inserting sample family data into account libraries.

## Automated Checks

- Production TypeScript/Vite/cloud build passed. Requirements baseline check preserved 26 source documents and 1,433 blocks.
- 620 unit tests passed across 34 files, including library hydration, startup preview and cloud synchronization.
- 63 cloud API, privacy, drive and native-startup checks passed; all eight release-route tests passed, for 71 server/native-contract checks.
- Four cloud browser scenarios passed: automatic migration with account isolation, two-device updates, offline edits, responsive navigation, and persisted conflict resolution.
- Three new startup browser scenarios passed: a five-second device-storage delay with a visible but inert tree preview; an older cached library before delayed cloud verification; and recovery controls for a renderer error. The cached-library check asserts one startup revision request before scheduled polling. Screenshot capture happens after that assertion so slow screenshot encoding cannot be mistaken for a duplicate startup request.
- Ten recovery-code browser checks passed, including actual download behavior.
- The final installed Mac app passed the isolated native workflow: guest opening, profile/timeline routes, research, requirement search, maintenance preview/apply/undo/redo/reload, nine-person tree layout, centered children, relationship legend, and blocked unapproved network destinations. No renderer errors were observed.
- A read-only test of the existing signed-in Mac profile passed opening, cloud verification and reload. It did not edit records, change credentials or log account/record contents.

## Timing Observations

On a measured launch after packaging completed, the process/window was ready at 6.102 seconds from launch, the library was visible at 7.566 seconds, and cloud verification completed at 7.592 seconds. Reload displayed the library in 361 ms and completed cloud verification in 712 ms. These are observed timings, not guaranteed limits. Process startup, disk load, Keychain and network conditions still vary.

The first upgraded opening must populate the new lightweight preview from the durable cache. During concurrent packaging, that opening took 13.452 seconds to show the library and 16.429 seconds to verify; the storage read alone took about 9.2 seconds. Its subsequent reload displayed the library in 217 ms. The new slow-storage browser test specifically verifies that later preview-backed openings show the tree without waiting five seconds for IndexedDB, while preventing edits and downloads from an incomplete preview.

## Installers and Installation

- Both `/Applications/KinForge Genealogy Studio.app` and `/Applications/KinForge Genealogy Studio/KinForge Genealogy Studio.app` were replaced with the final 1.3.1 Apple Silicon build and strictly signature-verified.
- Previous app bundles were retained in `/Applications/KinForge Genealogy Studio/Previous Applications`.
- Existing account data and `~/Downloads/KinForge Genealogy Studio` reports were left in place.
- Apple Silicon and Intel DMGs were mounted read-only; their contained apps passed strict signature, architecture, version, source-asset equality and AppleDouble-file checks.
- Both PKGs were expanded and their app payloads passed the same checks. Both ZIPs passed archive integrity checks.
- Windows setup and portable EXEs were built; both have valid executable headers. Actual Windows and Intel-Mac execution remain untested.
- The eight installers are in `/Applications/KinForge Genealogy Studio/Installers/1.3.1`; their exact sizes and SHA-256 hashes are recorded in `server/releaseManifest.ts` and the installer folder's `SHA256SUMS.txt`.

## Publication and Remaining Boundaries

Website deployment and download upload are separate release steps. This validation file is prepared before publication; the final task response and deployment/upload results record their outcome. The publisher checks each public file's metadata, server-verified SHA-256 and first/last download ranges. The temporary upload secret must be removed and the saved Site version redeployed after successful uploads.

Mac apps are ad-hoc signed, not Apple Developer ID signed or Apple-notarized. PKGs and Windows executables are not publisher-signed. Google Drive and OneDrive still require provider registrations and user consent. Zero-latency authentication and cloud access cannot be guaranteed, and account verification has not been bypassed for performance.
