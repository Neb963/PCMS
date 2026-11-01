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

Provenance review added two independent same-Persona documents, so a native localStorage write by either is observed by its sibling; equal auth reads alone cannot certify the join. The extra protected read-only witness never replaces an editor/review tab, and only its exact untouched owned document may be closed. Both documents, cookie versions and source guard are checked before/after the donor/Core cut; loss/rotation is incomplete. Witness checks use at most two accounts concurrently and no new source/provider write.

Initial P29 T41306484738 failed: one standalone capture fixture omitted the real Backup initializer needed for maintenance during Pause, and the new donor helper eagerly required storage observers during unrelated Accounts construction. The helper now fails closed only when capture is invoked without that API; ordinary Accounts remains usable. The fixture now runs the actual initializer. S in that run measured50 staged participants with50 independent Core writes,9.31s total and451ms Core barrier on4 CPUs/16.76GB; this is partial synthetic evidence only, not a passing phase run. The unchanged P28 B passed; full P29 B remains pending.

P29 source46c268a passed232 T/build, including50-participant S (16.55s staging/verification,689ms Core barrier on4 CPUs/16.76GB). The unchanged P28 journey hit its nondeterministic timer fault again: rapid changes can still leave a valid observation window. The synthetic rotation fault now writes the actual guard at each native digest yield and retains the real digest result, guaranteeing the intended race without modifying production code/CSP. Passing P28 evidence remains its original artifact; full P29 B is still pending.

## Required P29 B added

The affected installed job now selects the full production capture journey: two protected origins with independent storage-event documents, real cookies, staged package ZIP, all seven modules, NUL credential/draft/full source/history and an independently reopened1MiB binary, retained Possible writer, concurrent Core progress, exact cut revision, donor rotation invalidation, previous-good, real process interruption/fresh account revalidation and actual capture recovery controls. It is written and pending; no B success claimed.

Added an independent two-document T oracle: a write then restore to the same auth bytes leaves the writer's own storage-event count zero but changes its sibling's count, preventing equal-read-only consistency claims. Trusted human intent is retained for witness cleanup, and missing documents/listeners report Unknown.

First full B41307455587 failed during fixture package generation (MANIFEST_MISSING) before invoking capture. The staged package fixture now uses Python's independent ZIP writer over the tested XPI's exact bundled package, then the actual file-input/Install control. Production package validation remains strict; no capture behavior or evidence claim was changed.

Full B41307673711 reached the real capture adapter and held AUTH_CONTEXT_CHANGED before staging: the new owned witness tab still exposed its initial about:blank document. Reused the established P14 readiness rule: persist identity, await the exact completed protected URL, then install/check document witness. New collection contexts use the same rule. Scope/witness checks remain strict. All234 focused tests and S passed in that run; required full B remains pending.

## Witness recovery bound

An owned witness whose observation continuity is lost now blocks another witness allocation for that account instead of accumulating abandoned tabs. Its exact collection tab has a packaged Open action; user work is preserved for inspection. A witness with trusted human input is parked as review and never reused or automatically closed. Only an exact untouched owned document is removed. These changes still need affected T/B verification.

Required B now also holds the second fixture origin briefly while the first participant writes/restores the same guard. Native sibling storage events must force a fresh round despite equal bytes. Trusted WebDriver input in that owned witness must survive as parked review. Interrupted orphan witnesses, if restored, are inspected through the actual contextual button before the fixture user closes them and prepares fresh data. No production test gate was added.
