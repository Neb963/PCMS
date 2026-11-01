# Current work

**P31 — manual Backup export and shared Downloads integration. Plan before implementation.**

P30 [PR22](https://github.com/Neb963/PCMS/pull/22) merged main9e5742e3fa1011a7b977ba9259b55f3729560086/treea8d36f0e3967ff2624fc86683598174cbd6a2d31; post41315969925 PASS. Source4aa752e9dfa918b1f5650416dcb3a41090c9983c:35T/build41315775854, XPId045844d48f8792d64c0a4005c2dc6595af5d2e4f07baf0d2f5ce307c6dd8faf. P29 native/UI capture evidence reused unchanged with original identities in memory.

## P31 implementation plan

1. Add real Settings → Backup **Back up now**, safe relative destination and unencrypted credential notice. Existing coverage/Prepare/Check remain diagnostic actions; export has its own durable state, capture reference, destination, last complete result and exact recovery. Existing profiles receive explicit compatible Backup module update.
2. Compose the existing finite P29 capture and Core queue with one Backup EXPORT job referencing its completed qualified cut. Encode/self-validate outside the barrier using P30. Dedupe double clicks, preserve capture refs/uncertain effects and prior files, and avoid a second scheduler/controller. Errors identify incomplete capture, missing/removed data, quota, encoding or download failure without secret text.
3. Extend the shared Core Downloads adapter to immutable Blob/chunk staging, preserving existing Uint8Array Journal/Discover behavior. Hash without a giant archive ArrayBuffer; persist verified chunks/receipt before the synchronous final download dispatch. Ensure partial local stages cannot be referenced as complete; make staging recoverable/collectible. All commit/dispatch admission checks include current Backup generation/enabled state. Global Pause permits Backup; Journal Disable has no effect.
4. Use unique receipt-owned filenames and the existing exact Firefox download reconciliation, including lost-ID/ACK and ambiguous/history-loss holds. Persist prepared/possible/in-progress/complete/failure. Completed download metadata establishes browser completion/bytes only; production archive correctness is from P30, independent disk evidence from DSK. No retry of a possibly dispatched download by timeout/restart.
5. Connect receipt completion/wake to Backup status and module lifecycle drain. Reuse shared receipt-aware retention primitives and file ownership; P31 manual exports are never automatic cleanup candidates. Six-hour schedule/90-day cleanup and restore belong to P32–P34.
6. Focused T covers Blob/chunk fidelity, receipt identity/authority, double-click/failure/restart/reconciliation, module Disable and Journal separation. Reuse P30's ZIP corpus instead of repeating it wholesale. Targeted qualifying Firefox B/DSK clicks actual **Back up now** through production capture/codec/Downloads, independently reopens disk ZIPs and compares every declared section/binary/secret/package, tests interruption/invalid capture/destination failure, last-good/manual/unrelated preservation and Pause/disabled Journal. Keep all fixtures synthetic/local.
7. Push meaningful exact remote code+todo checkpoints, verify files/parents/trees/ref and required evidence, merge a lightweight PR, verify postmerge main, then continue P32–P34 and P36 without confirmation.

## Holds and limits

P19 remains held by missing qualified native revision/precondition evidence; source fingerprints are not CAS. P20–P27/P35/P37/P38 and descendants wait. Accepted Discovery ZIP cannot be extracted while local runtime is unavailable; GitHub/Actions operate. No historical investigation or unauthorized live provider operation is repeated.

H/G/P1–P5 NOT TESTED/unauthorized, P42–P49 require named disposable effects. Production archive byte portability does not prove login/route/fleet readiness. No P31 disk evidence exists yet.

## Storage and export checkpoint

Implemented private verified Blob→existing1MiB chunk staging with durable partial metadata/pin and guarded writes; incomplete blobs cannot be read/referenced as complete. Core Downloads gains Blob preparation/readback while preserving Journal/Discover byte API. Backup0.4 adds explicit typed export capability, one EXPORT job joins the existing full capture, production codec/Downloads final dispatch and same-ID readback; partial local stages can be explicitly discarded only before any possible download. Added separate export status/settings/recovery; no schedule/restore added. UI and focused/B/DSK evidence are still pending. No completion claim.
