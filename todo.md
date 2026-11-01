# Current work

**P29 — consistent complete capture cut. Plan before implementation.**

P01–P18 and P28 implemented/verified. P28 [PR20](https://github.com/Neb963/PCMS/pull/20) merged main `cd783732cd3cd9c2451f17f2a68ead70f8a01f2c`, exact tree `db020360bd06e3df0bc860703927bf9c4e25de44`. Source07df68f89fb9fd53699ea095bc679d79f4edbe2b passed225 T/build + required B41304693540; XPIadba318b49fb40ebf709ab16046c3da838cfe2a814e3d6a35e0a17a1ea5d2f14. Postmerge41305056036 pending; verify before phase completion.

## P29 implementation plan

Use the existing Backup module, Core queue and Settings page. No new controller, native export API or broad site workspace collector.

1. Extend the privileged donor collector with capture-scoped provenance: current account/principal/document, the known session-change guard, observed scoped storage/cookie changes and individual start/end times. Stage bounded per-account reads and revalidation turns outside the Core cut. Restart/lost observation continuity or rotation invalidates the join; retry a bounded participant or report incomplete. Keep P28's coverage-only control separate from immutable capture progress.
2. Reuse the donor state manager's existing withWorkflowAdmissionLock/getRevision/getBootId and extension storage services for a short revision-checked full local/sync donor inventory. Include all donor-owned extension data/credentials/recovery/settings/scripts/packages, not only normalized state. Export no OS/bridge process/lease authority.
3. Add one privileged Core capture primitive over the one existing IDB. Its single all-store transaction is the short write barrier: read the active logical records, views/drafts, jobs/effects/acceptance, modules/settings/payload references, credential store and retained Journal at one revision; validate reference closure and pin immutable referenced blobs. Do not await provider/login/native work in this transaction. Omit older disk-export payload bytes while retaining receipt metadata; do not omit configured credentials. Include possible effects and classify runtime leases/tab/container/route authority as non-authoritative on import.
4. Join scoped session evidence and donor revision to the chosen Core cut. Check account/principal/mapping revisions and configured credential/package/blob requirements. Read/verify pinned immutable bytes in finite turns outside the barrier. An unavailable participant, missing reference, changed revision or unjoined session yields an explicit incomplete capture and preserves the previous complete cut. Release only the capture's own resources, never global Pause/writer holds.
5. Persist the immutable capture and private section references in Core; expose secret-safe section/count/progress/individual collection-time reports in Settings → Backup. Provide Prepare capture / Check capture controls, exact missing-context recovery and last-good/stale state. Do not expose Back up now as successful disk export until P31.
6. T tests full section/reference closure, missing Git credentials/blobs/packages, concurrent Core/donor/auth rotation, restart and barrier release. S measures 50 synthetic participants and finite collection/barrier duration without claiming real routes. Required B uses the actual packaged capture coordinator and Settings UI with controlled protected auth/cookies/donor storage, observes immutable cut/revisions while other work continues, rotation/closed-origin failures and interrupted collection. Reuse existing P28 scoped-collector evidence; test only the new join/cut boundary.
7. Push frequent exact remotely verified code+todo checkpoints. Select focused T/build and affected B in the existing two CI jobs; merge completed verified P29 and postverify main, then proceed P30/P31 and further eligible work.

## Existing holds

P19 is unimplemented/held: accessible pinned Alpha app.saveGenerator code has no qualified provider revision/precondition recipe; accepted Discovery ZIP cannot be extracted while the local runtime is unavailable. P18 sourceStamp/providerRevision:null is not CAS. P20–P27/P35/P37/P38 and descendants remain dependency-blocked; do not invent a provider facade or local-lock stale-write protection. P36 remains independent after eligible Backup work.

H/G/P1–P5 NOT TESTED/unauthorized. P42–P49 need named disposable resources/effects. P48 qualifies actual login inventory/portability; synthetic capture bytes never prove operational login. All reported verification runs in remote Actions while local execution is unavailable.

## Core cut checkpoint

Added the private all-store IDB capture cut and pinned reference closure. The native transaction is the short write barrier; it awaits only IDB operations, never provider/native/login work. Captures include active logical rows/history/views/commands/credentials/modules/retained Journal and immutable blob descriptors. Old download payload bytes and older derived capture payloads are excluded explicitly to prevent recursive archives; their metadata remains. Required configured Git credentials and package references are checked. Derived capture secrets are invalidated by existing account removal. Integration/T/S/B pending. P28 postmerge41305056036 passed both jobs.

## Donor provenance checkpoint

Added private capture-scoped scoped-auth storage-event/document witnesses and cookie-change counters, fresh known guard/fingerprint checks, bounded witness lifetime and explicit loss on event-page restart. Full donor local/sync data is read under the existing state-manager admission lock/revision, with a managed-Persona census and no new native export service. The Core cut callback runs only after origin staging/revalidation; donor mutation or missing managed coverage invalidates it. Integration and verification pending.

## Finite capture integration checkpoint

Backup0.3 adds explicit compatible capture capability and STAGE/CHECK/CUT/BLOBS turns on the same queue. Staged secrets stay in scoped credentials; observed witnesses must survive revalidation, and restart/loss/rotation is bounded or incomplete. The donor-locked cut includes all logical Core data plus donor/auth sections; every pinned blob is independently length/hash checked outside the barrier before completion. Previous completed cuts remain available, and disabled work settles only its own read effects. Settings UI/tests remain pending.

## Focused capture verification checkpoint

Added production Core-cut tests for exact drafts/credentials/source/history, old export-payload exclusion, configured-secret/package/reference/account failures and write usability after abort. Added finite full-capture T for private donor/auth sections, previous-good, bounded lost/rotating witnesses, donor post-cut invalidation and 50-participant S measurements while unrelated Core writes progress. These tests are written but not yet run.

## Capture UI checkpoint

Settings → Backup now has actual Prepare capture / Check capture controls, finite phase progress, checked Core/donor revisions, byte/reference/barrier counts, exact missing-account links and previous-complete preservation. Capture readiness explicitly says no backup file was exported. The existing session-coverage controls remain separate and operational; old Backup packages require compatible update for the new capability. Required installed full-capture B is not yet added/passed.
